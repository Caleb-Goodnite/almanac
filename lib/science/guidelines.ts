import type { Sex } from "./types";

/** Population guidelines used as default targets. Sources: docs/RESEARCH.md. */

/** Sleep, minutes per night. Adults: at least 7 h (AASM/SRS), range 7-9 h (NSF). Teens 13-18: 8-10 h (AASM). */
export function sleepTargetMinutes(isTeen: boolean): { min: number; max: number } {
  return isTeen ? { min: 480, max: 600 } : { min: 420, max: 540 };
}

/**
 * Aerobic activity, WHO 2020. Adults: 150-300 min/week moderate (or 75-150
 * vigorous). Ages 5-17: an average of 60 min/day moderate-to-vigorous.
 */
export function activityTargetMinutesPerWeek(isTeen: boolean): number {
  return isTeen ? 60 * 7 : 150;
}

/** WHO 2020: muscle-strengthening on 2+ days/week for adults, 3+ for ages 5-17. */
export function strengthDaysPerWeek(isTeen: boolean): number {
  return isTeen ? 3 : 2;
}

/** Fiber: 14 g per 1,000 kcal (Dietary Reference Intakes; Dietary Guidelines for Americans). */
export function fiberTargetG(calories: number): number {
  return Math.round((calories / 1000) * 14);
}

/**
 * Fluids to drink per day, in ml. The Dietary Reference Intakes set an
 * Adequate Intake for total water of 3.7 L (men) and 2.7 L (women), of which
 * about 3.0 L and 2.2 L come from drinks; the rest comes from food. The app
 * tracks drinks, so it uses the drinks figure. Teen values scale the DRI
 * total-water AI for their age band by the same 81% share.
 * This is a population reference, not a requirement: needs vary with heat,
 * body size and activity.
 */
export function waterTargetMl(sex: Sex, ageYears: number): number {
  const pick = (male: number, female: number) =>
    sex === "male" ? male : sex === "female" ? female : Math.round((male + female) / 2 / 50) * 50;
  if (ageYears >= 19) return pick(3000, 2200);
  if (ageYears >= 14) return pick(2700, 1900);
  return pick(1950, 1700);
}

/** Acceptable Macronutrient Distribution Ranges, percent of calories. */
export const AMDR = {
  adult: { fat: [20, 35], carbs: [45, 65], protein: [10, 35] },
  teen: { fat: [25, 35], carbs: [45, 65], protein: [10, 30] },
} as const;
