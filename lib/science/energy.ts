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

/**
 * REE = 370 + 21.6 x fat-free mass (kg). Published by Cunningham (1991) and
 * widely known as the Katch-McArdle equation. Only as good as the body-fat
 * figure it is given.
 */
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
 * Physical activity level (PAL): total daily energy expenditure divided by
 * resting expenditure.
 *
 * The values sit inside the lifestyle bands of the FAO/WHO/UNU expert
 * consultation (2004): sedentary or light 1.40-1.69, active or moderately
 * active 1.70-1.99, vigorous 2.00-2.40. Doubly-labelled-water studies agree:
 * the average adult PAL is about 1.7-1.8 (Westerterp 2013), and about 1.2 is
 * the floor seen only in non-ambulant people (Black et al. 1996), which is why
 * the often-quoted "sedentary = 1.2" is not used here.
 *
 * Any one person can still differ a good deal, and people tend to overstate
 * how active they are (Lichtman et al. 1992). So this is a starting estimate
 * that the app replaces with one derived from the user's own data after two
 * weeks (see adaptive.ts).
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.4,
  light: 1.55,
  moderate: 1.75,
  very: 1.9,
  // The bottom of the vigorous band, not the middle: this level is
  // self-selected, and an overestimate here means a smaller real deficit (or a
  // larger surplus) than the person expects.
  extra: 2.0,
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
