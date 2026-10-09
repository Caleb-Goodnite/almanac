import type { Sex } from "@/lib/science/types";

/**
 * Safety policy: the limits the app will not go past, whatever a user asks for.
 *
 * Where a number comes from published guidance it is cited in
 * docs/RESEARCH.md#safety. Where it is a deliberately cautious product choice
 * (most of the teen limits), RESEARCH.md says so and COMPLIANCE.md flags it
 * for clinical review. Do not loosen anything here without that review.
 */

export const MINIMUM_AGE = 13;
export const ADULT_AGE = 18;

/** Fastest weight change the app will plan, as a percent of bodyweight per week. */
export const RATE_LIMITS = {
  adult: { maxLossPct: 1.0, defaultLossPct: 0.5, maxGainPct: 0.5, defaultGainPct: 0.25 },
  teen: { maxLossPct: 0.5, defaultLossPct: 0.25, maxGainPct: 0.5, defaultGainPct: 0.25 },
} as const;

/** Largest deficit as a share of estimated expenditure. */
export const MAX_DEFICIT_FRACTION = { adult: 0.25, teen: 0.15 } as const;

/** Hard calorie floors (kcal/day). A target is never set below these. */
const ADULT_FLOOR: Record<Sex, number> = { female: 1200, male: 1500, unspecified: 1500 };
const TEEN_FLOOR: Record<Sex, number> = { female: 1600, male: 1800, unspecified: 1800 };

/**
 * The lowest calorie target allowed. For teens it is also never below their
 * estimated resting needs, because they are still growing.
 */
export function calorieFloor(sex: Sex, isTeen: boolean, bmrKcal: number): number {
  if (isTeen) return Math.max(TEEN_FLOOR[sex], Math.ceil(bmrKcal));
  return ADULT_FLOOR[sex];
}

/**
 * BMI-for-age percentile bands for teens.
 * Below `noDeficitBelow`: no deficit at all. Between that and
 * `fullRateFrom`: only the gentle default rate. At or above: up to the teen max.
 */
export const TEEN_BMI_PERCENTILE = { noDeficitBelow: 25, fullRateFrom: 85 } as const;

/** Lowest calorie figure a user may type as a manual target or ask the coach about without a safety response. */
export const EXTREME_INTAKE_KCAL = 1000;
