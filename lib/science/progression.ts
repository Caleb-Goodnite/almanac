/**
 * Progressive overload: what to aim for today, given last time.
 *
 * Rule (ACSM position stand on progression, 2009): when someone can do the
 * current load for the top of the target rep range on every set, raise the
 * load by 2-10% and start again from the bottom of the range. Until then,
 * keep the load and add reps ("double progression"). Novices are advised to
 * work in an 8-12 rep range, which is the default when no routine sets one.
 */

export type LastSet = { weightKg: number; reps: number; isWarmup?: boolean };
export type RepRange = { min: number; max: number };

export const DEFAULT_REP_RANGE: RepRange = { min: 8, max: 12 };

export type Suggestion = {
  weightKg: number;
  reps: number;
  kind: "add_load" | "add_reps" | "repeat";
  reason: string;
};

/** Smallest practical jump: 1.25 kg below 25 kg, otherwise 2.5 kg. */
function step(weightKg: number): number {
  return weightKg < 25 ? 1.25 : 2.5;
}

export function suggestNext(previous: readonly LastSet[], range: RepRange = DEFAULT_REP_RANGE): Suggestion | null {
  const sets = previous.filter((s) => !s.isWarmup && s.reps > 0);
  if (sets.length === 0) return null;

  // Work from the heaviest load used last time.
  const top = Math.max(...sets.map((s) => s.weightKg));
  const atTop = sets.filter((s) => s.weightKg === top);
  const fewest = Math.min(...atTop.map((s) => s.reps));

  // Bodyweight movements progress by reps.
  if (top === 0) {
    return { weightKg: 0, reps: fewest + 1, kind: "add_reps", reason: `Last time your lowest set was ${fewest} reps. Aim for one more.` };
  }

  if (fewest >= range.max) {
    // About 5%, rounded to a loadable step, and kept inside the 2-10% window.
    const jump = Math.max(step(top), Math.round((top * 0.05) / step(top)) * step(top));
    const pct = jump / top;
    if (pct >= 0.02 && pct <= 0.1) {
      return {
        weightKg: top + jump,
        reps: range.min,
        kind: "add_load",
        reason: `You reached ${range.max} reps on every set last time, so add a little weight and build back up from ${range.min}.`,
      };
    }
    // The smallest plate is too big a jump at this load: keep adding reps instead.
    return { weightKg: top, reps: fewest + 1, kind: "add_reps", reason: "The next weight up is a big jump at this load, so add a rep first." };
  }

  if (fewest < range.min) {
    return {
      weightKg: top,
      reps: range.min,
      kind: "repeat",
      reason: `Last time you got ${fewest} on your lowest set. Stay at this weight until every set reaches ${range.min}.`,
    };
  }

  return {
    weightKg: top,
    reps: Math.min(range.max, fewest + 1),
    kind: "add_reps",
    reason: `Same weight, one more rep than your lowest set last time (${fewest}). Add weight once every set reaches ${range.max}.`,
  };
}
