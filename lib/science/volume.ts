/**
 * Weekly training volume per muscle group, counted in hard sets.
 * Sources: docs/RESEARCH.md#volume.
 */

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  abs: "Abs",
};

/**
 * Target range, sets per muscle group per week.
 * Lower bound 10: hypertrophy is greater at 10 or more weekly sets (Schoenfeld
 * 2017; ACSM 2026 position stand). Upper bound 20: in trained lifters 12-20
 * sets did as well as more than 20 for most muscles (Baz-Valle 2022), and
 * returns diminish as volume rises (Pelland 2026). Above 20 is not harmful as
 * such; it is simply where extra sets are least likely to pay for themselves.
 */
export const WEEKLY_SET_TARGET = { min: 10, max: 20 } as const;

/** A set aimed at a muscle indirectly counts as half a set (Pelland 2026, "fractional" method). */
export const SECONDARY_SET_WEIGHT = 0.5;

export type VolumeSet = {
  isWarmup: boolean;
  rpe?: number | null;
  rir?: number | null;
  primaryGroups: readonly string[];
  secondaryGroups: readonly string[];
};

/**
 * A "hard" set is a working set taken reasonably close to failure: 4 or fewer
 * reps in reserve, or RPE 6 and above on the reps-in-reserve scale
 * (RPE = 10 - RIR; Helms 2016). Sets need not reach failure to count (Refalo
 * 2023). A set logged with no effort rating is assumed to be a working set.
 */
export function isHardSet(set: Pick<VolumeSet, "isWarmup" | "rpe" | "rir">): boolean {
  if (set.isWarmup) return false;
  if (set.rir != null) return set.rir <= 4;
  if (set.rpe != null) return set.rpe >= 6;
  return true;
}

export type VolumeStatus = "none" | "below" | "within" | "above";

export type MuscleVolume = { group: MuscleGroup; sets: number; status: VolumeStatus };

export function volumeStatus(sets: number): VolumeStatus {
  if (sets === 0) return "none";
  if (sets < WEEKLY_SET_TARGET.min) return "below";
  if (sets > WEEKLY_SET_TARGET.max) return "above";
  return "within";
}

function isGroup(value: string): value is MuscleGroup {
  return (MUSCLE_GROUPS as readonly string[]).includes(value);
}

/** Totals hard sets per muscle group for one week's worth of sets. */
export function weeklyVolume(sets: readonly VolumeSet[]): MuscleVolume[] {
  const totals = new Map<MuscleGroup, number>(MUSCLE_GROUPS.map((g) => [g, 0]));
  for (const set of sets) {
    if (!isHardSet(set)) continue;
    for (const g of set.primaryGroups) {
      if (isGroup(g)) totals.set(g, (totals.get(g) ?? 0) + 1);
    }
    for (const g of set.secondaryGroups) {
      if (isGroup(g) && !set.primaryGroups.includes(g)) {
        totals.set(g, (totals.get(g) ?? 0) + SECONDARY_SET_WEIGHT);
      }
    }
  }
  return MUSCLE_GROUPS.map((group) => {
    const n = totals.get(group) ?? 0;
    return { group, sets: n, status: volumeStatus(n) };
  });
}

/**
 * Maps the muscle names used by free-exercise-db onto our volume groups.
 * Muscles we do not track for volume (neck, adductors, abductors) map to null.
 */
export const DATASET_MUSCLE_TO_GROUP: Record<string, MuscleGroup | null> = {
  chest: "chest",
  lats: "back",
  "middle back": "back",
  "lower back": "back",
  traps: "back",
  shoulders: "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  quadriceps: "quads",
  hamstrings: "hamstrings",
  glutes: "glutes",
  calves: "calves",
  abdominals: "abs",
  neck: null,
  adductors: null,
  abductors: null,
};
