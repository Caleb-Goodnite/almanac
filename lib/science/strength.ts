/**
 * Estimated one-repetition maximum (e1RM) and personal-record detection.
 * Both formulas are regressions on sub-maximal sets and get less accurate as
 * reps rise; we only estimate from sets of 12 reps or fewer.
 */

export const E1RM_MAX_REPS = 12;

/** Epley (1985): 1RM = w x (1 + reps / 30). */
export function epley(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** Brzycki (1993): 1RM = w x 36 / (37 - reps). */
export function brzycki(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : (weightKg * 36) / (37 - reps);
}

/**
 * The app's e1RM: the mean of Epley and Brzycki, which agree at 10 reps and
 * bracket most other published formulas below that. Null when the set cannot
 * support an estimate.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !Number.isInteger(reps) || reps < 1 || reps > E1RM_MAX_REPS) return null;
  if (reps === 1) return weightKg;
  return (epley(weightKg, reps) + brzycki(weightKg, reps)) / 2;
}

export type SetLike = { weightKg: number; reps: number; isWarmup?: boolean };

export type Bests = {
  /** Highest e1RM. */
  e1rm: number | null;
  /** Heaviest weight lifted for at least one rep. */
  weight: number | null;
  /** Most reps at each weight, keyed by weight in kg. */
  repsAtWeight: Record<string, number>;
  /** Largest single-set volume (weight x reps). */
  volume: number | null;
};

export const EMPTY_BESTS: Bests = { e1rm: null, weight: null, repsAtWeight: {}, volume: null };

export function bestsFrom(sets: readonly SetLike[]): Bests {
  const bests: Bests = { e1rm: null, weight: null, repsAtWeight: {}, volume: null };
  for (const s of sets) {
    if (s.isWarmup || s.reps < 1 || s.weightKg <= 0) continue;
    const e = estimateOneRepMax(s.weightKg, s.reps);
    if (e !== null && (bests.e1rm === null || e > bests.e1rm)) bests.e1rm = e;
    if (bests.weight === null || s.weightKg > bests.weight) bests.weight = s.weightKg;
    const key = String(s.weightKg);
    if ((bests.repsAtWeight[key] ?? 0) < s.reps) bests.repsAtWeight[key] = s.reps;
    const v = s.weightKg * s.reps;
    if (bests.volume === null || v > bests.volume) bests.volume = v;
  }
  return bests;
}

export type PrKind = "e1rm" | "weight" | "reps" | "volume";
export type Pr = { kind: PrKind; value: number; previous: number | null };

/**
 * Which records a new set breaks, compared with everything logged before it.
 * A first-ever set of an exercise is not reported as a record: there is
 * nothing to beat yet.
 */
export function detectRecords(previous: Bests, set: SetLike): Pr[] {
  if (set.isWarmup || set.reps < 1 || set.weightKg <= 0) return [];
  if (previous.weight === null) return [];
  const out: Pr[] = [];
  // A small tolerance so floating-point noise never reports a record.
  const beats = (a: number, b: number | null) => b === null || a > b + 1e-6;

  const e = estimateOneRepMax(set.weightKg, set.reps);
  if (e !== null && previous.e1rm !== null && beats(e, previous.e1rm)) {
    out.push({ kind: "e1rm", value: e, previous: previous.e1rm });
  }
  if (beats(set.weightKg, previous.weight)) {
    out.push({ kind: "weight", value: set.weightKg, previous: previous.weight });
  }
  const prevReps = previous.repsAtWeight[String(set.weightKg)];
  if (prevReps !== undefined && set.reps > prevReps) {
    out.push({ kind: "reps", value: set.reps, previous: prevReps });
  }
  const v = set.weightKg * set.reps;
  if (previous.volume !== null && beats(v, previous.volume)) {
    out.push({ kind: "volume", value: v, previous: previous.volume });
  }
  return out;
}
