"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import { getLatestWeight } from "@/lib/data/profile";
import {
  addSet,
  createCustomExercise,
  createRoutine,
  deleteCardio,
  deleteRoutine,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getPreviousSession,
  logCardio,
  startWorkout,
  type ExerciseSummary,
} from "@/lib/data/training";
import type { Pr } from "@/lib/science/strength";
import { todayIn } from "@/lib/time";
import {
  addSetSchema,
  cardioSchema,
  customExerciseSchema,
  routineSchema,
  startWorkoutSchema,
} from "@/lib/validation/training";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check what you entered.";

function refresh() {
  revalidatePath("/train");
  revalidatePath("/today");
}

export async function startWorkoutAction(input: unknown): Promise<ActionResult<string>> {
  const viewer = await requireViewer();
  const parsed = startWorkoutSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  // One open session at a time: resume it instead of starting a second.
  const active = await getActiveWorkout(viewer.userId);
  if (active) return { ok: true, data: active.id };
  const id = await startWorkout(viewer.userId, { ...parsed.data, date: todayIn(viewer.profile.timezone) });
  refresh();
  return { ok: true, data: id };
}

export type SetResult = { id: string; setNumber: number; records: Pr[] };

export async function addSetAction(input: unknown): Promise<ActionResult<SetResult>> {
  const viewer = await requireViewer();
  const parsed = addSetSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { rpe, ...rest } = parsed.data;
  const result = await addSet(viewer.userId, {
    ...rest,
    rpe,
    // Reps in reserve follow from RPE on the RIR-based scale: RIR = 10 - RPE.
    rir: rpe == null ? null : Math.max(0, Math.round(10 - rpe)),
  });
  if (!result) return fail("That workout or exercise could not be found.");
  refresh();
  return { ok: true, data: { id: result.set.id, setNumber: result.set.setNumber, records: result.records } };
}

export async function deleteSetAction(setId: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = z.uuid().safeParse(setId);
  if (!parsed.success) return fail("Unknown set.");
  await deleteSet(viewer.userId, parsed.data);
  refresh();
  return { ok: true, data: undefined };
}

export async function finishWorkoutAction(workoutId: unknown): Promise<void> {
  const viewer = await requireViewer();
  const parsed = z.uuid().safeParse(workoutId);
  if (parsed.success) {
    const weight = await getLatestWeight(viewer.userId);
    await finishWorkout(viewer.userId, parsed.data, weight?.kg ?? null);
    refresh();
  }
  redirect("/train");
}

export async function deleteWorkoutAction(workoutId: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = z.uuid().safeParse(workoutId);
  if (!parsed.success) return fail("Unknown workout.");
  await deleteWorkout(viewer.userId, parsed.data);
  refresh();
  return { ok: true, data: undefined };
}

export async function createRoutineAction(input: unknown): Promise<ActionResult<string>> {
  const viewer = await requireViewer();
  const parsed = routineSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const items = parsed.data.items.map((i) => ({ ...i, targetRepsMax: Math.max(i.targetRepsMin, i.targetRepsMax) }));
  const id = await createRoutine(viewer.userId, { name: parsed.data.name, items });
  refresh();
  return { ok: true, data: id };
}

export async function deleteRoutineAction(routineId: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = z.uuid().safeParse(routineId);
  if (!parsed.success) return fail("Unknown routine.");
  await deleteRoutine(viewer.userId, parsed.data);
  refresh();
  return { ok: true, data: undefined };
}

export async function createExerciseAction(input: unknown): Promise<ActionResult<ExerciseSummary>> {
  const viewer = await requireViewer();
  const parsed = customExerciseSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  return { ok: true, data: await createCustomExercise(viewer.userId, parsed.data) };
}

export async function logCardioAction(input: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = cardioSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const today = todayIn(viewer.profile.timezone);
  if (parsed.data.date > today) return fail("That date is in the future.");
  const weight = await getLatestWeight(viewer.userId);
  const { durationMin, distanceKm, ...rest } = parsed.data;
  const ok = await logCardio(
    viewer.userId,
    { ...rest, durationSec: Math.round(durationMin * 60), distanceM: distanceKm == null ? null : Math.round(distanceKm * 1000) },
    weight?.kg ?? null,
  );
  if (!ok) return fail("Choose an activity from the list.");
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteCardioAction(id: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail("Unknown session.");
  await deleteCardio(viewer.userId, parsed.data);
  refresh();
  return { ok: true, data: undefined };
}

export async function previousSessionAction(input: unknown) {
  const viewer = await requireViewer();
  const parsed = z.object({ workoutId: z.uuid(), exerciseId: z.uuid() }).safeParse(input);
  if (!parsed.success) return null;
  return getPreviousSession(viewer.userId, parsed.data.workoutId, parsed.data.exerciseId);
}
