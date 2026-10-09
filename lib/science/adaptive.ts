import { KCAL_PER_KG } from "./energy";
import { dayNumber, linearRegression, mean, type Point } from "./trend";
import type { DateString } from "./types";
import { clamp } from "./units";

/**
 * Adaptive TDEE from the user's own data, by energy balance:
 *
 *   expenditure = average intake - (rate of weight change x energy per kg)
 *
 * If someone eats 2,400 kcal a day and their weight trend is flat, they burn
 * about 2,400. If they are losing 0.3 kg a week on that intake, they burn
 * about 2,400 + 0.3 x 7,700 / 7 = 2,730. This is the principle behind
 * adaptive trackers such as MacroFactor; the constants and blending below are
 * our own and are documented in docs/RESEARCH.md#adaptive.
 */

export const ADAPTIVE_MIN_SPAN_DAYS = 14;
export const ADAPTIVE_MIN_LOGGED_DAYS = 10;
export const ADAPTIVE_MIN_WEIGH_INS = 6;
export const ADAPTIVE_WINDOW_DAYS = 28;

export type Confidence = "low" | "medium" | "high";

export type AdaptiveResult =
  | {
      ok: true;
      tdeeKcal: number;
      observedKcal: number;
      avgIntakeKcal: number;
      slopeKgPerWeek: number;
      loggedDays: number;
      weighIns: number;
      windowDays: number;
      confidence: Confidence;
    }
  | { ok: false; reason: string; loggedDays: number; weighIns: number };

export type AdaptiveInput = {
  /** Total kcal eaten per logged day. Days with no entry must be absent, not 0. */
  intake: readonly Point[];
  weights: readonly Point[];
  today: DateString;
  /** The formula estimate, used as a prior and as a sanity bound. */
  formulaTdeeKcal: number;
  windowDays?: number;
};

export function estimateAdaptiveTdee(input: AdaptiveInput): AdaptiveResult {
  const windowDays = input.windowDays ?? ADAPTIVE_WINDOW_DAYS;
  const end = dayNumber(input.today);
  const start = end - windowDays + 1;
  const inWindow = (p: Point) => dayNumber(p.date) >= start && dayNumber(p.date) <= end;

  // A day logged at under 600 kcal is almost always a half-logged day; counting
  // it would make expenditure look far lower than it is.
  const intake = input.intake.filter(inWindow).filter((p) => p.value >= 600);
  const weights = input.weights.filter(inWindow);
  const loggedDays = intake.length;
  const weighIns = weights.length;

  if (weighIns < ADAPTIVE_MIN_WEIGH_INS) {
    return { ok: false, reason: `Needs at least ${ADAPTIVE_MIN_WEIGH_INS} weigh-ins in the last ${windowDays} days.`, loggedDays, weighIns };
  }
  if (loggedDays < ADAPTIVE_MIN_LOGGED_DAYS) {
    return { ok: false, reason: `Needs at least ${ADAPTIVE_MIN_LOGGED_DAYS} fully logged days in the last ${windowDays} days.`, loggedDays, weighIns };
  }
  const days = weights.map((p) => dayNumber(p.date));
  const span = Math.max(...days) - Math.min(...days) + 1;
  if (span < ADAPTIVE_MIN_SPAN_DAYS) {
    return { ok: false, reason: `Weigh-ins need to span at least ${ADAPTIVE_MIN_SPAN_DAYS} days.`, loggedDays, weighIns };
  }

  const fit = linearRegression(weights);
  const avgIntake = mean(intake.map((p) => p.value));
  if (!fit || avgIntake === null) {
    return { ok: false, reason: "Not enough data to fit a trend.", loggedDays, weighIns };
  }

  const observed = avgIntake - fit.slopePerDay * KCAL_PER_KG;

  // Under-logging is common and makes observed expenditure look low. Bound the
  // observation to within 30% of the formula so one bad month cannot produce a
  // dangerous target, then blend by how much data we have.
  const bounded = clamp(observed, input.formulaTdeeKcal * 0.7, input.formulaTdeeKcal * 1.3);

  const coverage = Math.min(loggedDays / windowDays, 1);
  const confidence: Confidence =
    loggedDays >= 21 && weighIns >= 14 ? "high" : loggedDays >= 14 && weighIns >= 8 ? "medium" : "low";
  const weight = (confidence === "high" ? 0.85 : confidence === "medium" ? 0.6 : 0.35) * (0.5 + coverage / 2);
  const blended = weight * bounded + (1 - weight) * input.formulaTdeeKcal;

  return {
    ok: true,
    tdeeKcal: Math.round(blended),
    observedKcal: Math.round(observed),
    avgIntakeKcal: Math.round(avgIntake),
    slopeKgPerWeek: Math.round(fit.slopePerDay * 7 * 1000) / 1000,
    loggedDays,
    weighIns,
    windowDays,
    confidence,
  };
}
