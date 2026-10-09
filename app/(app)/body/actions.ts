"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import { TOO_FAST, writingTooFast } from "@/lib/data/rate-limit";
import { deleteWeight, logMeasurement, logSleep, logWeight, saveCheckin } from "@/lib/data/body";
import { todayIn } from "@/lib/time";
import { dateSchema } from "@/lib/validation/food";
import { checkinSchema, measurementSchema, sleepSchema, weightSchema } from "@/lib/validation/body";

export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check what you entered.";

function refresh() {
  revalidatePath("/body");
  revalidatePath("/today");
}

async function viewerAndToday() {
  const viewer = await requireViewer();
  return { viewer, today: todayIn(viewer.profile.timezone) };
}

export async function logWeightAction(input: unknown): Promise<ActionResult> {
  const { viewer, today } = await viewerAndToday();
  if (await writingTooFast(viewer.userId)) return fail(TOO_FAST);
  const parsed = weightSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (parsed.data.date > today) return fail("That date is in the future.");
  await logWeight(viewer.userId, parsed.data.date, parsed.data.kg, parsed.data.bodyFatPct);
  refresh();
  return { ok: true };
}

export async function deleteWeightAction(date: unknown): Promise<ActionResult> {
  const { viewer } = await viewerAndToday();
  if (await writingTooFast(viewer.userId)) return fail(TOO_FAST);
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) return fail("Invalid date.");
  await deleteWeight(viewer.userId, parsed.data);
  refresh();
  return { ok: true };
}

export async function logSleepAction(input: unknown): Promise<ActionResult> {
  const { viewer, today } = await viewerAndToday();
  if (await writingTooFast(viewer.userId)) return fail(TOO_FAST);
  const parsed = sleepSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (parsed.data.date > today) return fail("That date is in the future.");
  await logSleep(viewer.userId, parsed.data);
  refresh();
  return { ok: true };
}

export async function saveCheckinAction(input: unknown): Promise<ActionResult> {
  const { viewer, today } = await viewerAndToday();
  if (await writingTooFast(viewer.userId)) return fail(TOO_FAST);
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (parsed.data.date > today) return fail("That date is in the future.");
  await saveCheckin(viewer.userId, parsed.data);
  refresh();
  return { ok: true };
}

export async function logMeasurementAction(input: unknown): Promise<ActionResult> {
  const { viewer, today } = await viewerAndToday();
  if (await writingTooFast(viewer.userId)) return fail(TOO_FAST);
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (parsed.data.date > today) return fail("That date is in the future.");
  await logMeasurement(viewer.userId, parsed.data.date, parsed.data.site, parsed.data.cm);
  refresh();
  return { ok: true };
}
