import { describe, expect, it } from "vitest";
import { calorieFloor } from "@/lib/safety/policy";
import {
  ageBand,
  ageFromBirthDate,
  ageFromBirthMonth,
  bestsFrom,
  bmi,
  bmiForAgePercentile,
  brzycki,
  computeTargets,
  detectRecords,
  epley,
  estimateAdaptiveTdee,
  estimateBmr,
  estimatedMaxHr,
  estimateOneRepMax,
  estimateTdee,
  exponentialTrend,
  feetInchesToCm,
  fiberTargetG,
  isHardSet,
  katchMcArdle,
  kcalFromMet,
  kgToLb,
  lbToKg,
  linearRegression,
  mifflinStJeor,
  movingAverage,
  normalCdf,
  parseDate,
  rateOfChangeWarning,
  schofieldAdolescent,
  weeklyVolume,
  zonesFromMaxHr,
  zonesFromReserve,
  addDays,
  type Point,
  type TargetInput,
} from "./index";

describe("units", () => {
  it("converts weight both ways", () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3);
    expect(lbToKg(220.462)).toBeCloseTo(100, 3);
  });
  it("converts feet and inches to centimetres", () => {
    expect(feetInchesToCm(5, 11)).toBeCloseTo(180.34, 2);
  });
});

describe("age", () => {
  it("counts exact age from a full date of birth", () => {
    const birth = parseDate("2013-10-10")!;
    expect(ageFromBirthDate(birth, parseDate("2026-10-09")!)).toBe(12);
    expect(ageFromBirthDate(birth, parseDate("2026-10-10")!)).toBe(13);
  });
  it("rounds toward younger when only the birth month is stored", () => {
    expect(ageFromBirthMonth(2013, 10, parseDate("2026-10-31")!)).toBe(12);
    expect(ageFromBirthMonth(2013, 10, parseDate("2026-11-01")!)).toBe(13);
    expect(ageFromBirthMonth(2008, 12, parseDate("2026-12-15")!)).toBe(17);
  });
  it("rejects impossible dates", () => {
    expect(parseDate("2011-02-30")).toBeNull();
    expect(parseDate("11/02/2011")).toBeNull();
  });
  it("bands ages", () => {
    expect(ageBand(12)).toBe("under13");
    expect(ageBand(13)).toBe("teen");
    expect(ageBand(17)).toBe("teen");
    expect(ageBand(18)).toBe("adult");
  });
});

describe("resting energy", () => {
  // Worked by hand from the published equations.
  it("Mifflin-St Jeor", () => {
    expect(mifflinStJeor({ sex: "male", weightKg: 80, heightCm: 180, ageYears: 30 })).toBe(1780);
    expect(mifflinStJeor({ sex: "female", weightKg: 60, heightCm: 165, ageYears: 25 })).toBe(1345.25);
    expect(mifflinStJeor({ sex: "unspecified", weightKg: 70, heightCm: 170, ageYears: 40 })).toBe(1484.5);
  });
  it("Katch-McArdle", () => {
    expect(katchMcArdle(80, 20)).toBeCloseTo(1752.4, 1);
  });
  it("Schofield, ages 10-18", () => {
    expect(schofieldAdolescent("male", 60)).toBeCloseTo(1719.36, 2);
    expect(schofieldAdolescent("female", 55)).toBeCloseTo(1428.72, 2);
  });
  it("chooses the equation by age and available data", () => {
    const base = { sex: "male" as const, weightKg: 80, heightCm: 180 };
    expect(estimateBmr({ ...base, ageYears: 30 }).equation).toBe("mifflin-st-jeor");
    expect(estimateBmr({ ...base, ageYears: 30, bodyFatPct: 20 }).equation).toBe("katch-mcardle");
    expect(estimateBmr({ ...base, ageYears: 16, bodyFatPct: 20 }).equation).toBe("schofield");
    expect(estimateBmr({ ...base, ageYears: 30, bodyFatPct: 99 }).equation).toBe("mifflin-st-jeor");
  });
  it("applies the activity multiplier", () => {
    expect(estimateTdee(1780, "moderate")).toBeCloseTo(3115, 0);
    expect(estimateTdee(1780, "sedentary")).toBeCloseTo(2492, 0);
  });
});

describe("BMI", () => {
  it("computes BMI", () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 2);
  });
  it("normal CDF matches known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.036433)).toBeCloseTo(0.85, 4);
    expect(normalCdf(-1.644854)).toBeCloseTo(0.05, 4);
  });
  // Reference percentile values from the CDC 2000 BMI-for-age data file.
  it("reproduces CDC percentiles for boys at 15.04 years", () => {
    expect(bmiForAgePercentile("male", 180.5, 16.55481067)).toBeCloseTo(5, 1);
    expect(bmiForAgePercentile("male", 180.5, 19.85766121)).toBeCloseTo(50, 1);
    expect(bmiForAgePercentile("male", 180.5, 23.45117065)).toBeCloseTo(85, 1);
    expect(bmiForAgePercentile("male", 180.5, 26.83688026)).toBeCloseTo(95, 1);
  });
  it("reproduces CDC percentiles for girls at 17.04 years", () => {
    expect(bmiForAgePercentile("female", 204.5, 17.21234472)).toBeCloseTo(5, 1);
    expect(bmiForAgePercentile("female", 204.5, 19.10585083)).toBeCloseTo(25, 1);
    expect(bmiForAgePercentile("female", 204.5, 25.20482218)).toBeCloseTo(85, 1);
  });
  it("interpolates between tabulated ages", () => {
    const p = bmiForAgePercentile("male", 183.5, 20.03);
    expect(p).toBeGreaterThan(48);
    expect(p).toBeLessThan(52);
  });
});

const adult: TargetInput = {
  sex: "male",
  ageYears: 30,
  weightKg: 80,
  heightCm: 180,
  goal: "lose_fat",
  activityLevel: "moderate",
  resistanceTraining: true,
};

describe("targets", () => {
  it("plans a default adult fat-loss target", () => {
    const t = computeTargets(adult);
    expect(t.bmrKcal).toBe(1780);
    expect(t.tdeeKcal).toBe(3115);
    // -0.5%/week of 80 kg = 0.4 kg = 440 kcal/day.
    expect(t.calories).toBe(2680);
    expect(t.proteinG).toBe(160);
    expect(t.fatG).toBe(74);
    expect(t.carbsG).toBe(344);
    expect(t.fiberG).toBe(fiberTargetG(2680));
    expect(t.guardrails).toEqual([]);
    expect(t.sleepMinMinutes).toBe(420);
    expect(t.activityMinutesPerWeek).toBe(150);
  });

  it("keeps protein within 1.6-2.2 g/kg for adults who lift", () => {
    for (const goal of ["lose_fat", "maintain", "build_muscle"] as const) {
      const t = computeTargets({ ...adult, goal });
      expect(t.proteinGPerKg).toBeGreaterThanOrEqual(1.6);
      expect(t.proteinGPerKg).toBeLessThanOrEqual(2.2);
    }
  });

  it("maintains at TDEE and ignores a rate for non-weight goals", () => {
    const t = computeTargets({ ...adult, goal: "maintain", weeklyRatePct: -1 });
    expect(t.calories).toBe(3120);
    expect(t.weeklyRatePct).toBeCloseTo(0, 1);
  });

  it("caps requested loss at 1% per week for adults", () => {
    const t = computeTargets({ ...adult, weightKg: 120, weeklyRatePct: -2 });
    expect(t.guardrails.map((g) => g.code)).toContain("rate_capped");
    expect(t.weeklyRatePct).toBeGreaterThanOrEqual(-1);
  });

  it("never goes below the adult calorie floor", () => {
    const t = computeTargets({
      sex: "female",
      ageYears: 30,
      weightKg: 45,
      heightCm: 152,
      goal: "lose_fat",
      activityLevel: "sedentary",
      resistanceTraining: false,
      weeklyRatePct: -1,
    });
    expect(t.calories).toBe(1200);
    const codes = t.guardrails.map((g) => g.code);
    expect(codes).toContain("deficit_capped");
    expect(codes).toContain("calorie_floor");
  });

  it("plans no deficit for an underweight adult", () => {
    const t = computeTargets({ ...adult, weightKg: 50, heightCm: 175 });
    expect(t.guardrails.map((g) => g.code)).toContain("underweight_no_deficit");
    expect(t.calories).toBeGreaterThanOrEqual(t.tdeeKcal - 10);
  });

  it("plans no deficit in support mode", () => {
    const t = computeTargets({ ...adult, supportMode: true });
    expect(t.guardrails.map((g) => g.code)).toEqual(["support_mode_no_deficit"]);
    expect(t.calories).toBe(3120);
  });

  it("uses an adaptive TDEE when given one", () => {
    const t = computeTargets({ ...adult, tdeeOverrideKcal: 3000 });
    expect(t.tdeeSource).toBe("adaptive");
    expect(t.calories).toBe(2560);
  });

  describe("teens", () => {
    const teen: TargetInput = {
      sex: "male",
      ageYears: 15,
      ageMonths: 180.5,
      weightKg: 60,
      heightCm: 170,
      goal: "lose_fat",
      activityLevel: "moderate",
      resistanceTraining: true,
      weeklyRatePct: -0.5,
    };

    it("get teen sleep and activity targets and the Schofield equation", () => {
      const t = computeTargets(teen);
      expect(t.bmrEquation).toBe("schofield");
      expect(t.sleepMinMinutes).toBe(480);
      expect(t.sleepMaxMinutes).toBe(600);
      expect(t.activityMinutesPerWeek).toBe(420);
    });

    it("hold a healthy-weight teen to the gentle rate", () => {
      const t = computeTargets(teen);
      expect(t.guardrails.map((g) => g.code)).toContain("teen_gentle_rate");
      expect(t.weeklyRatePct).toBeGreaterThanOrEqual(-0.26);
      // 1719 x 1.75 = 3009; 0.25% of 60 kg = 0.15 kg/week = 165 kcal/day.
      expect(t.calories).toBe(2840);
    });

    it("plan no deficit for a lean teen", () => {
      const t = computeTargets({ ...teen, sex: "female", weightKg: 45, heightCm: 165 });
      expect(t.guardrails.map((g) => g.code)).toContain("teen_low_bmi_no_deficit");
      expect(t.calories).toBeGreaterThanOrEqual(t.tdeeKcal - 10);
    });

    it("never plan loss faster than 0.5% per week or a deficit over 15%", () => {
      const t = computeTargets({ ...teen, weightKg: 110, heightCm: 175, activityLevel: "sedentary", weeklyRatePct: -3 });
      expect(t.weeklyRatePct).toBeGreaterThanOrEqual(-0.5);
      expect(t.calories).toBeGreaterThanOrEqual(Math.floor(t.tdeeKcal * 0.85) - 10);
      expect(t.calories).toBeGreaterThanOrEqual(t.bmrKcal);
    });

    it("keep protein within the 10-30% range for ages 4-18", () => {
      const t = computeTargets(teen);
      expect((t.proteinG * 4) / t.calories).toBeLessThanOrEqual(0.3);
    });
  });

  it("is exhaustive: no profile ever yields a target under the floor", () => {
    for (const sex of ["male", "female", "unspecified"] as const) {
      for (const ageYears of [13, 15, 17, 18, 35, 70]) {
        for (const weightKg of [35, 50, 80, 140]) {
          for (const activityLevel of ["sedentary", "extra"] as const) {
            const t = computeTargets({
              sex,
              ageYears,
              weightKg,
              heightCm: 165,
              goal: "lose_fat",
              activityLevel,
              resistanceTraining: false,
              weeklyRatePct: -5,
            });
            const floor = calorieFloor(sex, ageYears < 18, t.bmrKcal);
            expect(t.calories).toBeGreaterThanOrEqual(Math.floor(floor / 10) * 10);
            if (ageYears < 18) expect(t.weeklyRatePct).toBeGreaterThanOrEqual(-0.5);
            else expect(t.weeklyRatePct).toBeGreaterThanOrEqual(-1);
          }
        }
      }
    }
  });

  it("holds the teen floor at resting needs when those are higher", () => {
    expect(calorieFloor("female", true, 1450)).toBe(1600);
    expect(calorieFloor("female", true, 1900.2)).toBe(1901);
    expect(calorieFloor("male", false, 2200)).toBe(1500);
  });

  it("flags loss faster than the safe rate", () => {
    expect(rateOfChangeWarning(-1.0, 80, false)).toEqual({ pctPerWeek: -1.25, tooFast: true });
    expect(rateOfChangeWarning(-0.5, 80, false).tooFast).toBe(false);
    expect(rateOfChangeWarning(-0.5, 80, true).tooFast).toBe(true);
  });
});

function series(start: string, values: number[]): Point[] {
  return values.map((value, i) => ({ date: addDays(start, i), value }));
}

describe("trends", () => {
  it("averages over a trailing 7-day window", () => {
    const out = movingAverage(series("2026-01-01", [80, 81, 79, 80, 82, 78, 80, 87]));
    expect(out[6]!.value).toBeCloseTo(80, 6);
    expect(out[7]!.value).toBeCloseTo(81, 6);
  });
  it("skips missing days rather than treating them as zero", () => {
    const out = movingAverage([
      { date: "2026-01-01", value: 80 },
      { date: "2026-01-10", value: 78 },
    ]);
    expect(out[1]!.value).toBe(78);
  });
  it("fits a straight line exactly", () => {
    const fit = linearRegression(series("2026-01-01", [80, 79.9, 79.8, 79.7, 79.6]))!;
    expect(fit.slopePerDay).toBeCloseTo(-0.1, 6);
    expect(fit.r2).toBeCloseTo(1, 6);
  });
  it("smooths noise with an exponential trend", () => {
    const out = exponentialTrend(series("2026-01-01", [80, 82, 80, 82, 80]));
    expect(out[4]!.value).toBeGreaterThan(80);
    expect(out[4]!.value).toBeLessThan(81);
  });
});

describe("adaptive TDEE", () => {
  const today = "2026-01-28";
  const start = "2026-01-01";

  it("recovers expenditure from intake and weight change", () => {
    // Eating 2,400 and losing 0.3 kg/week implies 2,400 + 0.3 x 7,700 / 7 = 2,730.
    const weights = series(start, Array.from({ length: 28 }, (_, i) => 80 - (0.3 / 7) * i));
    const intake = series(start, Array.from({ length: 28 }, () => 2400));
    const r = estimateAdaptiveTdee({ intake, weights, today, formulaTdeeKcal: 2600 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.observedKcal).toBe(2730);
    expect(r.confidence).toBe("high");
    expect(r.slopeKgPerWeek).toBeCloseTo(-0.3, 3);
    // Blended 85% toward the observation.
    expect(r.tdeeKcal).toBeGreaterThan(2700);
    expect(r.tdeeKcal).toBeLessThan(2730);
  });

  it("corrects an overestimated formula from noisy, incomplete, real-looking data", () => {
    // The person really burns 2,400 kcal. The formula guessed 2,900. They eat
    // about 2,000 with day-to-day swings, skip logging some days, weigh in
    // most mornings, and the scale bounces by up to 0.7 kg.
    let seed = 7;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const trueTdee = 2400;
    const intake: Point[] = [];
    const weights: Point[] = [];
    let kg = 85;
    for (let i = 0; i < 28; i++) {
      const eaten = 2000 + (rand() - 0.5) * 700 + (i % 7 === 6 ? 350 : 0);
      kg += (eaten - trueTdee) / 7700;
      const date = addDays(start, i);
      if (rand() > 0.15) intake.push({ date, value: Math.round(eaten) });
      if (rand() > 0.2) weights.push({ date, value: Math.round((kg + (rand() - 0.5) * 1.4) * 10) / 10 });
    }
    const r = estimateAdaptiveTdee({ intake, weights, today, formulaTdeeKcal: 2900 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Much closer to the truth than the formula was, despite the noise.
    expect(Math.abs(r.tdeeKcal - trueTdee)).toBeLessThan(250);
    expect(Math.abs(r.tdeeKcal - trueTdee)).toBeLessThan(Math.abs(2900 - trueTdee) / 2);
  });

  it("refuses to conclude anything from sparse data", () => {
    const r = estimateAdaptiveTdee({
      intake: series(start, [2400, 2300, 2500]),
      weights: series(start, [80, 79.9]),
      today,
      formulaTdeeKcal: 2600,
    });
    expect(r.ok).toBe(false);
  });

  it("bounds the estimate when logging is clearly incomplete", () => {
    const weights = series(start, Array.from({ length: 28 }, () => 80));
    const intake = series(start, Array.from({ length: 28 }, () => 1000));
    const r = estimateAdaptiveTdee({ intake, weights, today, formulaTdeeKcal: 2600 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tdeeKcal).toBeGreaterThanOrEqual(Math.round(2600 * 0.7));
  });
});

describe("strength", () => {
  it("Epley and Brzycki match their published forms", () => {
    expect(epley(100, 5)).toBeCloseTo(116.667, 3);
    expect(brzycki(100, 5)).toBeCloseTo(112.5, 3);
    expect(epley(100, 10)).toBeCloseTo(brzycki(100, 10), 6);
    expect(epley(100, 1)).toBe(100);
  });
  it("estimates 1RM as their mean and refuses high-rep sets", () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(114.583, 3);
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(60, 20)).toBeNull();
    expect(estimateOneRepMax(60, 11)).toBeNull();
    expect(estimateOneRepMax(60, 10)).not.toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
  });
  it("detects records against history and ignores warm-ups", () => {
    const history = bestsFrom([
      { weightKg: 100, reps: 5 },
      { weightKg: 110, reps: 2 },
      { weightKg: 140, reps: 1, isWarmup: true },
    ]);
    expect(history.weight).toBe(110);
    expect(detectRecords(history, { weightKg: 100, reps: 6 }).map((p) => p.kind).sort()).toEqual(
      ["e1rm", "reps", "volume"].sort(),
    );
    expect(detectRecords(history, { weightKg: 112.5, reps: 1 }).map((p) => p.kind)).toEqual(["weight"]);
    expect(detectRecords(history, { weightKg: 100, reps: 5 })).toEqual([]);
    expect(detectRecords(history, { weightKg: 200, reps: 5, isWarmup: true })).toEqual([]);
  });
  it("does not call a first-ever set a record", () => {
    expect(detectRecords(bestsFrom([]), { weightKg: 60, reps: 8 })).toEqual([]);
  });
});

describe("training volume", () => {
  it("counts only hard working sets", () => {
    expect(isHardSet({ isWarmup: true })).toBe(false);
    expect(isHardSet({ isWarmup: false })).toBe(true);
    expect(isHardSet({ isWarmup: false, rir: 2 })).toBe(true);
    expect(isHardSet({ isWarmup: false, rir: 6 })).toBe(false);
    expect(isHardSet({ isWarmup: false, rpe: 5 })).toBe(false);
    expect(isHardSet({ isWarmup: false, rpe: 8 })).toBe(true);
  });
  it("counts secondary muscles as half a set", () => {
    const bench = { isWarmup: false, primaryGroups: ["chest"], secondaryGroups: ["triceps", "shoulders"] };
    const v = weeklyVolume(Array.from({ length: 12 }, () => bench));
    const get = (g: string) => v.find((m) => m.group === g)!;
    expect(get("chest")).toMatchObject({ sets: 12, status: "within" });
    expect(get("triceps")).toMatchObject({ sets: 6, status: "below" });
    expect(get("quads")).toMatchObject({ sets: 0, status: "none" });
  });
});

describe("activity energy and heart rate", () => {
  it("computes kcal from MET, weight and time", () => {
    expect(kcalFromMet(8.5, 70, 30)).toBeCloseTo(297.5, 1);
  });
  it("estimates maximum heart rate (Tanaka)", () => {
    expect(estimatedMaxHr(40)).toBe(180);
    expect(estimatedMaxHr(20)).toBe(194);
  });
  it("builds ACSM zones", () => {
    const z = zonesFromMaxHr(180);
    expect(z.find((x) => x.key === "moderate")).toMatchObject({ min: 115, max: 137 });
    expect(z.find((x) => x.key === "vigorous")).toMatchObject({ min: 139, max: 171 });
    const r = zonesFromReserve(180, 60);
    expect(r.find((x) => x.key === "moderate")).toMatchObject({ min: 108, max: 131 });
  });
});
