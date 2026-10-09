import "server-only";
import { and, asc, between, desc, eq, gte, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  cardioSessions,
  exercises,
  personalRecords,
  routineExercises,
  routines,
  workoutSets,
  workouts,
} from "@/lib/db/schema";
import { activityByKey, kcalFromMet } from "@/lib/science/met";
import { bestsFrom, detectRecords, type Pr } from "@/lib/science/strength";
import type { DateString } from "@/lib/science/types";
import { weeklyVolume, type MuscleVolume } from "@/lib/science/volume";

export type Exercise = typeof exercises.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type CardioSession = typeof cardioSessions.$inferSelect;

export type ExerciseSummary = Pick<Exercise, "id" | "name" | "equipment" | "category" | "primaryGroups" | "movementPattern">;

const exerciseSummary = {
  id: exercises.id,
  name: exercises.name,
  equipment: exercises.equipment,
  category: exercises.category,
  primaryGroups: exercises.primaryGroups,
  movementPattern: exercises.movementPattern,
};

/** The shared library plus this user's own exercises. */
function visibleTo(userId: string) {
  return or(isNull(exercises.ownerId), eq(exercises.ownerId, userId));
}

export async function searchExercises(
  userId: string,
  options: { query?: string; group?: string; limit?: number },
): Promise<ExerciseSummary[]> {
  const filters = [visibleTo(userId), ne(exercises.category, "stretching")];
  // Every word must appear somewhere in the name, in any order.
  for (const word of (options.query ?? "").split(/\s+/).filter(Boolean).slice(0, 6)) {
    filters.push(ilike(exercises.name, `%${word.replace(/[%_\\]/g, "\\$&")}%`));
  }
  if (options.group) {
    filters.push(sql`${options.group} = any(${exercises.primaryGroups})`);
  }
  return db
    .select(exerciseSummary)
    .from(exercises)
    .where(and(...filters))
    .orderBy(sql`(${exercises.ownerId} is null)`, sql`length(${exercises.name})`, asc(exercises.name))
    .limit(options.limit ?? 40);
}

export async function getExercise(userId: string, exerciseId: string): Promise<Exercise | null> {
  const [row] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), visibleTo(userId)))
    .limit(1);
  return row ?? null;
}

export async function createCustomExercise(
  userId: string,
  input: { name: string; primaryGroups: string[] },
): Promise<ExerciseSummary> {
  const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
  const [row] = await db
    .insert(exercises)
    .values({ slug, ownerId: userId, name: input.name, category: "strength", primaryGroups: input.primaryGroups, source: "custom" })
    .returning(exerciseSummary);
  if (!row) throw new Error("Could not create exercise");
  return row;
}

/* Routines */

export type RoutineItem = {
  exerciseId: string;
  name: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSeconds: number;
};
export type Routine = { id: string; name: string; items: RoutineItem[] };

export async function listRoutines(userId: string): Promise<Routine[]> {
  const rows = await db
    .select({
      id: routines.id,
      name: routines.name,
      exerciseId: routineExercises.exerciseId,
      exerciseName: exercises.name,
      targetSets: routineExercises.targetSets,
      targetRepsMin: routineExercises.targetRepsMin,
      targetRepsMax: routineExercises.targetRepsMax,
      restSeconds: routineExercises.restSeconds,
    })
    .from(routines)
    .leftJoin(routineExercises, and(eq(routineExercises.routineId, routines.id), eq(routineExercises.userId, userId)))
    .leftJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .where(eq(routines.userId, userId))
    .orderBy(asc(routines.position), asc(routines.createdAt), asc(routineExercises.position));

  const byId = new Map<string, Routine>();
  for (const r of rows) {
    const routine = byId.get(r.id) ?? { id: r.id, name: r.name, items: [] };
    if (r.exerciseId && r.exerciseName) {
      routine.items.push({
        exerciseId: r.exerciseId,
        name: r.exerciseName,
        targetSets: r.targetSets ?? 3,
        targetRepsMin: r.targetRepsMin ?? 8,
        targetRepsMax: r.targetRepsMax ?? 12,
        restSeconds: r.restSeconds ?? 120,
      });
    }
    byId.set(r.id, routine);
  }
  return [...byId.values()];
}

export type RoutineInput = {
  name: string;
  items: { exerciseId: string; targetSets: number; targetRepsMin: number; targetRepsMax: number; restSeconds: number }[];
};

export async function createRoutine(userId: string, input: RoutineInput): Promise<string> {
  // Only exercises this user may see can go into a routine.
  const allowed = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(inArray(exercises.id, input.items.map((i) => i.exerciseId)), visibleTo(userId)));
  const ok = new Set(allowed.map((a) => a.id));
  const items = input.items.filter((i) => ok.has(i.exerciseId));

  return db.transaction(async (tx) => {
    const [routine] = await tx.insert(routines).values({ userId, name: input.name }).returning({ id: routines.id });
    if (!routine) throw new Error("Could not create routine");
    if (items.length > 0) {
      await tx.insert(routineExercises).values(items.map((it, position) => ({ userId, routineId: routine.id, position, ...it })));
    }
    return routine.id;
  });
}

export async function deleteRoutine(userId: string, routineId: string): Promise<void> {
  await db.delete(routines).where(and(eq(routines.id, routineId), eq(routines.userId, userId)));
}

/* Workouts */

export async function getActiveWorkout(userId: string): Promise<Workout | null> {
  const [row] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNull(workouts.endedAt)))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return row ?? null;
}

export async function startWorkout(
  userId: string,
  input: { clientId: string; date: DateString; name: string; routineId: string | null },
): Promise<string> {
  let routineId = input.routineId;
  if (routineId) {
    const [owned] = await db
      .select({ id: routines.id })
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
      .limit(1);
    if (!owned) routineId = null;
  }
  const [row] = await db
    .insert(workouts)
    .values({ userId, clientId: input.clientId, date: input.date, name: input.name, routineId })
    .onConflictDoUpdate({ target: [workouts.userId, workouts.clientId], set: { name: input.name } })
    .returning({ id: workouts.id });
  if (!row) throw new Error("Could not start workout");
  return row.id;
}

export type WorkoutDetail = {
  workout: Workout;
  blocks: {
    exercise: ExerciseSummary;
    sets: WorkoutSet[];
    /** Sets from the most recent earlier session that included this exercise. */
    previous: { date: DateString; sets: Pick<WorkoutSet, "reps" | "weightKg" | "rpe" | "rir" | "isWarmup">[] } | null;
    target: RoutineItem | null;
  }[];
};

async function previousSessions(userId: string, exerciseIds: string[], before: Date) {
  if (exerciseIds.length === 0) return new Map<string, WorkoutDetail["blocks"][number]["previous"]>();
  const rows = await db
    .select({
      exerciseId: workoutSets.exerciseId,
      workoutId: workoutSets.workoutId,
      date: workouts.date,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
      rpe: workoutSets.rpe,
      rir: workoutSets.rir,
      isWarmup: workoutSets.isWarmup,
      setNumber: workoutSets.setNumber,
      startedAt: workouts.startedAt,
    })
    .from(workoutSets)
    .innerJoin(workouts, and(eq(workouts.id, workoutSets.workoutId), eq(workouts.userId, userId)))
    .where(and(eq(workoutSets.userId, userId), inArray(workoutSets.exerciseId, exerciseIds), lt(workouts.startedAt, before)))
    .orderBy(desc(workouts.startedAt), asc(workoutSets.setNumber))
    .limit(400);

  const out = new Map<string, WorkoutDetail["blocks"][number]["previous"]>();
  const chosen = new Map<string, string>();
  for (const r of rows) {
    const pick = chosen.get(r.exerciseId) ?? r.workoutId;
    chosen.set(r.exerciseId, pick);
    if (pick !== r.workoutId) continue;
    const entry = out.get(r.exerciseId) ?? { date: r.date, sets: [] };
    entry.sets.push({ reps: r.reps, weightKg: r.weightKg, rpe: r.rpe, rir: r.rir, isWarmup: r.isWarmup });
    out.set(r.exerciseId, entry);
  }
  return out;
}

/** "Last time" for one exercise, relative to a workout the user owns. */
export async function getPreviousSession(userId: string, workoutId: string, exerciseId: string) {
  const [workout] = await db
    .select({ startedAt: workouts.startedAt })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) return null;
  return (await previousSessions(userId, [exerciseId], workout.startedAt)).get(exerciseId) ?? null;
}

export async function getWorkoutDetail(userId: string, workoutId: string): Promise<WorkoutDetail | null> {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) return null;

  const sets = await db
    .select()
    .from(workoutSets)
    .where(and(eq(workoutSets.userId, userId), eq(workoutSets.workoutId, workoutId)))
    .orderBy(asc(workoutSets.exerciseOrder), asc(workoutSets.setNumber));

  let planned: RoutineItem[] = [];
  if (workout.routineId) {
    planned = (await listRoutines(userId)).find((r) => r.id === workout.routineId)?.items ?? [];
  }

  // Exercises in the order they were first performed, then any planned ones not yet started.
  const order: string[] = [];
  for (const s of sets) if (!order.includes(s.exerciseId)) order.push(s.exerciseId);
  for (const p of planned) if (!order.includes(p.exerciseId)) order.push(p.exerciseId);

  const info =
    order.length > 0
      ? await db.select(exerciseSummary).from(exercises).where(and(inArray(exercises.id, order), visibleTo(userId)))
      : [];
  const infoById = new Map(info.map((e) => [e.id, e]));
  const previous = await previousSessions(userId, order, workout.startedAt);

  return {
    workout,
    blocks: order
      .filter((id) => infoById.has(id))
      .map((id) => ({
        exercise: infoById.get(id)!,
        sets: sets.filter((s) => s.exerciseId === id),
        previous: previous.get(id) ?? null,
        target: planned.find((p) => p.exerciseId === id) ?? null,
      })),
  };
}

export type AddSetInput = {
  workoutId: string;
  exerciseId: string;
  reps: number;
  weightKg: number;
  rpe: number | null;
  rir: number | null;
  isWarmup: boolean;
};

/**
 * Records a set and reports any personal records it breaks, judged against
 * every earlier non-warm-up set of that exercise by this user.
 */
export async function addSet(userId: string, input: AddSetInput): Promise<{ set: WorkoutSet; records: Pr[] } | null> {
  const [workout] = await db
    .select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .where(and(eq(workouts.id, input.workoutId), eq(workouts.userId, userId)))
    .limit(1);
  const exercise = await getExercise(userId, input.exerciseId);
  if (!workout || !exercise) return null;

  const existing = await db
    .select({ exerciseId: workoutSets.exerciseId, exerciseOrder: workoutSets.exerciseOrder, setNumber: workoutSets.setNumber })
    .from(workoutSets)
    .where(and(eq(workoutSets.userId, userId), eq(workoutSets.workoutId, input.workoutId)));
  const mine = existing.filter((s) => s.exerciseId === input.exerciseId);
  const exerciseOrder = mine[0]?.exerciseOrder ?? (existing.length ? Math.max(...existing.map((s) => s.exerciseOrder)) + 1 : 0);
  const setNumber = mine.length ? Math.max(...mine.map((s) => s.setNumber)) + 1 : 1;

  const history = await db
    .select({ weightKg: workoutSets.weightKg, reps: workoutSets.reps, isWarmup: workoutSets.isWarmup })
    .from(workoutSets)
    .where(and(eq(workoutSets.userId, userId), eq(workoutSets.exerciseId, input.exerciseId)));
  const records = detectRecords(bestsFrom(history), input);

  const [set] = await db
    .insert(workoutSets)
    .values({
      userId,
      workoutId: input.workoutId,
      exerciseId: input.exerciseId,
      exerciseOrder,
      setNumber,
      reps: input.reps,
      weightKg: input.weightKg,
      rpe: input.rpe,
      rir: input.rir,
      isWarmup: input.isWarmup,
    })
    .returning();
  if (!set) return null;

  if (records.length > 0) {
    await db.insert(personalRecords).values(
      records.map((r) => ({
        userId,
        exerciseId: input.exerciseId,
        kind: r.kind,
        value: Math.round(r.value * 100) / 100,
        weightKg: input.weightKg,
        reps: input.reps,
        setId: set.id,
        achievedOn: workout.date,
      })),
    );
  }
  return { set, records };
}

export async function deleteSet(userId: string, setId: string): Promise<void> {
  // personal_records rows for this set go with it (ON DELETE CASCADE).
  await db.delete(workoutSets).where(and(eq(workoutSets.id, setId), eq(workoutSets.userId, userId)));
}

/** Ends a workout and stores a rough energy estimate (general weight training, 3.5 MET). */
export async function finishWorkout(userId: string, workoutId: string, weightKg: number | null): Promise<void> {
  const [w] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!w || w.endedAt) return;
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(workoutSets)
    .where(and(eq(workoutSets.userId, userId), eq(workoutSets.workoutId, workoutId)));
  if (n === 0) {
    // An empty session is not worth keeping.
    await db.delete(workouts).where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
    return;
  }
  const endedAt = new Date();
  // Cap at four hours in case a session was left open overnight.
  const minutes = Math.min((endedAt.getTime() - w.startedAt.getTime()) / 60000, 240);
  const met = activityByKey("weights")?.met ?? 3.5;
  await db
    .update(workouts)
    .set({ endedAt, kcalEstimate: weightKg ? Math.round(kcalFromMet(met, weightKg, minutes)) : null })
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
}

export async function deleteWorkout(userId: string, workoutId: string): Promise<void> {
  await db.delete(workouts).where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
}

export type WorkoutSummary = {
  id: string;
  date: DateString;
  name: string;
  startedAt: Date;
  endedAt: Date | null;
  kcalEstimate: number | null;
  sets: number;
  exercises: number;
  volumeKg: number;
};

export async function listWorkouts(userId: string, from: DateString, to: DateString): Promise<WorkoutSummary[]> {
  return db
    .select({
      id: workouts.id,
      date: workouts.date,
      name: workouts.name,
      startedAt: workouts.startedAt,
      endedAt: workouts.endedAt,
      kcalEstimate: workouts.kcalEstimate,
      sets: sql<number>`count(${workoutSets.id}) filter (where not ${workoutSets.isWarmup})::int`,
      exercises: sql<number>`count(distinct ${workoutSets.exerciseId})::int`,
      volumeKg: sql<number>`coalesce(sum(${workoutSets.weightKg} * ${workoutSets.reps}) filter (where not ${workoutSets.isWarmup}), 0)::float8`,
    })
    .from(workouts)
    .leftJoin(workoutSets, and(eq(workoutSets.workoutId, workouts.id), eq(workoutSets.userId, userId)))
    .where(and(eq(workouts.userId, userId), between(workouts.date, from, to)))
    .groupBy(workouts.id)
    .orderBy(desc(workouts.startedAt));
}

/** Hard sets per muscle group between two dates (inclusive). */
export async function getVolume(userId: string, from: DateString, to: DateString): Promise<MuscleVolume[]> {
  const rows = await db
    .select({
      isWarmup: workoutSets.isWarmup,
      rpe: workoutSets.rpe,
      rir: workoutSets.rir,
      primaryGroups: exercises.primaryGroups,
      secondaryGroups: exercises.secondaryGroups,
    })
    .from(workoutSets)
    .innerJoin(workouts, and(eq(workouts.id, workoutSets.workoutId), eq(workouts.userId, userId)))
    .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
    .where(and(eq(workoutSets.userId, userId), between(workouts.date, from, to)));
  return weeklyVolume(rows);
}

export type RecentRecord = { exerciseName: string; kind: Pr["kind"]; value: number; weightKg: number | null; reps: number | null; achievedOn: DateString };

export async function listRecentRecords(userId: string, since: DateString, limit = 12): Promise<RecentRecord[]> {
  return db
    .select({
      exerciseName: exercises.name,
      kind: personalRecords.kind,
      value: personalRecords.value,
      weightKg: personalRecords.weightKg,
      reps: personalRecords.reps,
      achievedOn: personalRecords.achievedOn,
    })
    .from(personalRecords)
    .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
    .where(and(eq(personalRecords.userId, userId), gte(personalRecords.achievedOn, since)))
    .orderBy(desc(personalRecords.achievedOn))
    .limit(limit);
}

/* Cardio */

export type CardioInput = {
  clientId: string;
  date: DateString;
  activity: string;
  durationSec: number;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  notes: string | null;
};

export async function logCardio(userId: string, input: CardioInput, weightKg: number | null): Promise<boolean> {
  const activity = activityByKey(input.activity);
  if (!activity) return false;
  await db
    .insert(cardioSessions)
    .values({
      userId,
      ...input,
      label: activity.label,
      met: activity.met,
      kcalEstimate: weightKg ? Math.round(kcalFromMet(activity.met, weightKg, input.durationSec / 60)) : null,
    })
    .onConflictDoNothing({ target: [cardioSessions.userId, cardioSessions.clientId] });
  return true;
}

export async function listCardio(userId: string, from: DateString, to: DateString): Promise<CardioSession[]> {
  return db
    .select()
    .from(cardioSessions)
    .where(and(eq(cardioSessions.userId, userId), between(cardioSessions.date, from, to)))
    .orderBy(desc(cardioSessions.startedAt));
}

export async function deleteCardio(userId: string, id: string): Promise<void> {
  await db.delete(cardioSessions).where(and(eq(cardioSessions.id, id), eq(cardioSessions.userId, userId)));
}
