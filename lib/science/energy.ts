import type { ActivityLevel, Sex } from "./types";

/**
 * Resting energy expenditure and total daily energy expenditure.
 * Sources and how each is used: docs/RESEARCH.md#energy.
 */

type MifflinInput = { sex: Sex; weightKg: number; heightCm: number; ageYears: number };

/**
 * Mifflin-St Jeor (1990): REE = 10 x kg + 6.25 x cm - 5 x age + s,
 * where s = +5 for men and -161 for women. Developed in adults aged 19-78.
 * For "unspecified" we use the midpoint of the two constants (-78).
 */
export function mifflinStJeor({ sex, weightKg, heightCm, ageYears }: MifflinInput): number {
  const s = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + s;
}

/** Katch-McArdle: REE = 370 + 21.6 x lean body mass (kg). Needs a body fat estimate. */
export function katchMcArdle(weightKg: number, bodyFatPct: number): number {
  const leanKg = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * leanKg;
}

/**
 * Schofield (1985) weight-only equations for ages 10-18, as tabulated by
 * FAO/WHO/UNU (2004). Used for 13-17 year olds because Mifflin-St Jeor was
 * not developed in adolescents.
 */
export function schofieldAdolescent(sex: Sex, weightKg: number): number {
  const male = 17.686 * weightKg + 658.2;
  const female = 13.384 * weightKg + 692.6;
  if (sex === "male") return male;
  if (sex === "female") return female;
  return (male + female) / 2;
}

export type BmrEquation = "mifflin-st-jeor" | "katch-mcardle" | "schofield";

export type BmrInput = MifflinInput & { bodyFatPct?: number | null };

/** Picks the most appropriate equation for the person and says which it used. */
export function estimateBmr(input: BmrInput): { kcal: number; equation: BmrEquation } {
  if (input.ageYears < 18) {
    return { kcal: schofieldAdolescent(input.sex, input.weightKg), equation: "schofield" };
  }
  const bf = input.bodyFatPct;
  if (bf != null && bf >= 3 && bf <= 60) {
    return { kcal: katchMcArdle(input.weightKg, bf), equation: "katch-mcardle" };
  }
  return { kcal: mifflinStJeor(input), equation: "mifflin-st-jeor" };
}

/**
 * Activity multipliers. These five steps are a long-standing convention, not a
 * measured result: they sit inside the FAO/WHO/UNU physical activity level
 * ranges (1.40-1.69 light, 1.70-1.99 active, 2.00-2.40 vigorous) but any one
 * person's true value can differ a good deal. That is why the app replaces
 * this estimate with one derived from the user's own data after two weeks
 * (see adaptive.ts).
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export function estimateTdee(bmrKcal: number, level: ActivityLevel): number {
  return bmrKcal * ACTIVITY_MULTIPLIERS[level];
}

/**
 * Energy content of body-weight change used to convert a weekly rate into a
 * daily calorie adjustment: 7,700 kcal per kg (the "3,500 kcal per pound"
 * rule). Hall (2008) shows this fits people with higher body fat and
 * overstates the deficit needed for leaner people, so it is an approximation.
 */
export const KCAL_PER_KG = 7700;

export function dailyKcalForWeeklyChange(weeklyKg: number): number {
  return (weeklyKg * KCAL_PER_KG) / 7;
}
