import {
  MAX_DEFICIT_FRACTION,
  RATE_LIMITS,
  TEEN_BMI_PERCENTILE,
  calorieFloor,
} from "@/lib/safety/policy";
import { ADULT_UNDERWEIGHT_BMI, bmi, bmiForAgePercentile } from "./bmi";
import { dailyKcalForWeeklyChange, estimateBmr, estimateTdee, type BmrEquation } from "./energy";
import {
  activityTargetMinutesPerWeek,
  fiberTargetG,
  sleepTargetMinutes,
  waterTargetMl,
} from "./guidelines";
import type { ActivityLevel, Goal, Sex } from "./types";
import { clamp } from "./units";

export type TargetInput = {
  sex: Sex;
  ageYears: number;
  /** Needed for the teen growth-chart check; falls back to ageYears x 12. */
  ageMonths?: number;
  weightKg: number;
  heightCm: number;
  bodyFatPct?: number | null;
  goal: Goal;
  activityLevel: ActivityLevel;
  resistanceTraining: boolean;
  /** Signed percent of bodyweight per week. Omit to use the goal's default. */
  weeklyRatePct?: number | null;
  /** An adaptive TDEE estimate from the user's own data, if one exists. */
  tdeeOverrideKcal?: number | null;
  /** True when disordered-eating support mode is on: never plan a deficit. */
  supportMode?: boolean;
  /** Under-18s only: a parent or guardian has approved a fat-loss goal. Without it no deficit is planned. */
  guardianApproved?: boolean;
};

export type GuardrailCode =
  | "rate_capped"
  | "deficit_capped"
  | "calorie_floor"
  | "underweight_no_deficit"
  | "teen_low_bmi_no_deficit"
  | "teen_gentle_rate"
  | "teen_guardian_needed"
  | "support_mode_no_deficit";

export type Guardrail = { code: GuardrailCode; message: string };

export type Targets = {
  bmrKcal: number;
  bmrEquation: BmrEquation;
  tdeeKcal: number;
  tdeeSource: "formula" | "adaptive";
  calories: number;
  /** The rate actually planned after guardrails, signed percent per week. */
  weeklyRatePct: number;
  proteinG: number;
  proteinGPerKg: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  waterMl: number;
  sleepMinMinutes: number;
  sleepMaxMinutes: number;
  activityMinutesPerWeek: number;
  guardrails: Guardrail[];
};

/**
 * Protein, grams per kg of bodyweight per day.
 * Adults who lift: 1.6 (Morton 2018: no further gain in fat-free mass beyond
 * about 1.6, upper confidence limit 2.2), raised to 2.0 in a deficit, where
 * needs for retaining muscle are higher (Helms 2014; ISSN 2017).
 * Adults who do not lift: 1.2, or 1.6 in a deficit.
 * Teens: 1.4 if lifting (the lower end of the ISSN 1.4-2.0 range for exercising
 * people; the adult trials above did not include adolescents), otherwise 1.0.
 */
export function proteinPerKg(isTeen: boolean, lifting: boolean, inDeficit: boolean): number {
  if (isTeen) return lifting ? 1.4 : 1.0;
  if (lifting) return inDeficit ? 2.0 : 1.6;
  return inDeficit ? 1.6 : 1.2;
}

/**
 * Bodyweight used for the protein calculation. Protein needs track lean mass,
 * not fat mass, so at higher body weights g/kg of total weight overshoots. We
 * cap the reference weight at the weight that gives a BMI of 30 for the
 * person's height. This cap is a practical convention, not a published rule.
 */
export function proteinReferenceWeightKg(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.min(weightKg, 30 * m * m);
}

function defaultRate(goal: Goal, isTeen: boolean): number {
  const r = isTeen ? RATE_LIMITS.teen : RATE_LIMITS.adult;
  if (goal === "lose_fat") return -r.defaultLossPct;
  if (goal === "build_muscle") return r.defaultGainPct;
  return 0;
}

/** Computes every daily target from a profile, applying the safety guardrails. */
export function computeTargets(input: TargetInput): Targets {
  const isTeen = input.ageYears < 18;
  const limits = isTeen ? RATE_LIMITS.teen : RATE_LIMITS.adult;
  const guardrails: Guardrail[] = [];

  const bmr = estimateBmr(input);
  const formulaTdee = estimateTdee(bmr.kcal, input.activityLevel);
  const tdee = input.tdeeOverrideKcal ?? formulaTdee;

  // 1. The requested rate, limited to what the goal allows.
  let rate = input.weeklyRatePct ?? defaultRate(input.goal, isTeen);
  if (input.goal === "lose_fat") rate = Math.min(rate, 0);
  else if (input.goal === "build_muscle") rate = Math.max(rate, 0);
  else rate = 0;

  if (rate < -limits.maxLossPct) {
    rate = -limits.maxLossPct;
    guardrails.push({
      code: "rate_capped",
      message: `Loss is planned at no more than ${limits.maxLossPct}% of bodyweight per week. Faster loss costs more muscle and is harder to sustain.`,
    });
  }
  if (rate > limits.maxGainPct) {
    rate = limits.maxGainPct;
    guardrails.push({
      code: "rate_capped",
      message: `Gain is planned at no more than ${limits.maxGainPct}% of bodyweight per week. Faster gain is mostly fat.`,
    });
  }

  // 2. Situations where no deficit is planned at all.
  if (rate < 0) {
    const bmiValue = bmi(input.weightKg, input.heightCm);
    if (input.supportMode) {
      rate = 0;
      guardrails.push({
        code: "support_mode_no_deficit",
        message: "Targets are set to maintain your weight for now.",
      });
    } else if (isTeen && !input.guardianApproved) {
      rate = 0;
      guardrails.push({
        code: "teen_guardian_needed",
        message:
          "A fat-loss goal needs a parent or guardian's approval first. Until then your targets are set to fuel growth and training.",
      });
    } else if (isTeen) {
      const pct = bmiForAgePercentile(input.sex, input.ageMonths ?? input.ageYears * 12, bmiValue);
      if (pct < TEEN_BMI_PERCENTILE.noDeficitBelow) {
        rate = 0;
        guardrails.push({
          code: "teen_low_bmi_no_deficit",
          message:
            "For your age and height, eating less is not a safe way to change your body. Your targets are set to fuel growth and training instead.",
        });
      } else if (pct < TEEN_BMI_PERCENTILE.fullRateFrom && rate < -limits.defaultLossPct) {
        rate = -limits.defaultLossPct;
        guardrails.push({
          code: "teen_gentle_rate",
          message: `Loss is kept gentle, at ${limits.defaultLossPct}% of bodyweight per week, because you are still growing.`,
        });
      }
    } else if (bmiValue < ADULT_UNDERWEIGHT_BMI) {
      rate = 0;
      guardrails.push({
        code: "underweight_no_deficit",
        message:
          "Your BMI is below 18.5, so no calorie deficit is planned. If you want to change your weight, please talk with a doctor first.",
      });
    }
  }

  // 3. Rate to calories, then cap the deficit and apply the hard floor.
  let calories = tdee + dailyKcalForWeeklyChange((rate / 100) * input.weightKg);

  const maxDeficit = tdee * (isTeen ? MAX_DEFICIT_FRACTION.teen : MAX_DEFICIT_FRACTION.adult);
  if (tdee - calories > maxDeficit) {
    calories = tdee - maxDeficit;
    guardrails.push({
      code: "deficit_capped",
      message: `The deficit is limited to ${Math.round((maxDeficit / tdee) * 100)}% of what you burn in a day.`,
    });
  }

  const floor = calorieFloor(input.sex, isTeen, bmr.kcal);
  if (calories < floor) {
    calories = floor;
    guardrails.push({
      code: "calorie_floor",
      message: `Your target is held at ${floor.toLocaleString("en-US")} kcal, the lowest this app will set. Going lower makes it hard to get enough nutrients without medical supervision.`,
    });
  }
  calories = Math.round(calories / 10) * 10;

  // The rate that the final calorie figure actually implies.
  const impliedRate = (((calories - tdee) * 7) / 7700 / input.weightKg) * 100;

  // 4. Macros.
  const inDeficit = calories < tdee - 50;
  const perKg = proteinPerKg(isTeen, input.resistanceTraining, inDeficit);
  const refKg = isTeen ? input.weightKg : proteinReferenceWeightKg(input.weightKg, input.heightCm);
  const proteinCapShare = isTeen ? 0.3 : 0.35;
  const proteinG = Math.round(Math.min(perKg * refKg, (calories * proteinCapShare) / 4));

  const fatShare = isTeen ? 0.3 : inDeficit ? 0.25 : 0.3;
  const fatG = Math.round((calories * fatShare) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  const sleep = sleepTargetMinutes(isTeen);

  return {
    bmrKcal: Math.round(bmr.kcal),
    bmrEquation: bmr.equation,
    tdeeKcal: Math.round(tdee),
    tdeeSource: input.tdeeOverrideKcal != null ? "adaptive" : "formula",
    calories,
    weeklyRatePct: Math.round(clamp(impliedRate, -limits.maxLossPct, limits.maxGainPct) * 100) / 100,
    proteinG,
    proteinGPerKg: Math.round((proteinG / input.weightKg) * 100) / 100,
    fatG,
    carbsG,
    fiberG: fiberTargetG(calories),
    waterMl: waterTargetMl(input.sex, input.ageYears),
    sleepMinMinutes: sleep.min,
    sleepMaxMinutes: sleep.max,
    activityMinutesPerWeek: activityTargetMinutesPerWeek(isTeen),
    guardrails,
  };
}

/**
 * Warns when the measured trend is faster than the safe limit, whatever the
 * plan says. `slopeKgPerWeek` is negative for loss.
 */
export function rateOfChangeWarning(
  slopeKgPerWeek: number,
  weightKg: number,
  isTeen: boolean,
): { pctPerWeek: number; tooFast: boolean } {
  const pct = (slopeKgPerWeek / weightKg) * 100;
  const limit = isTeen ? RATE_LIMITS.teen.maxLossPct : RATE_LIMITS.adult.maxLossPct;
  return { pctPerWeek: Math.round(pct * 100) / 100, tooFast: pct < -limit };
}
