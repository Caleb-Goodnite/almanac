"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import { TOO_FAST, writingTooFast } from "@/lib/data/rate-limit";
import { deleteWeight, logMeasurement, logSleep, logWeight, saveCheckin } from "@/lib/data/body";
import { importHealth, type ImportCounts } from "@/lib/data/health-import";
import { getLatestWeight } from "@/lib/data/profile";
import { rateLimit } from "@/lib/data/rate-limit";
import { normalizeHealth } from "@/lib/health-import/normalize";
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

const isoTime = z.string().max(40);
const healthSchema = z.object({
  weights: z.array(z.object({ at: isoTime, kg: z.number().positive() })).max(400),
  sleep: z.array(z.object({ start: isoTime, end: isoTime })).max(3000),
  restingHr: z.array(z.object({ at: isoTime, bpm: z.number().positive() })).max(400),
  workouts: z
    .array(
      z.object({
        id: z.uuid(),
        type: z.string().max(60),
        start: isoTime,
        durationSec: z.number().positive(),
        distanceM: z.number().nonnegative().nullable(),
      }),
    )
    .max(400),
});

export type HealthImportResult = { ok: true; counts: ImportCounts } | { ok: false; error: string };

/**
 * Takes raw samples the phone app read from Apple Health or Health Connect.
 * Everything is validated and reduced to daily rows on the server
 * (lib/health-import), and only fills days that have nothing logged.
 */
export async function importHealthAction(input: unknown): Promise<HealthImportResult> {
  const { viewer, today } = await viewerAndToday();
  if (!(await rateLimit(`health-import:${viewer.userId}`, 20, 60 * 60)).allowed) return { ok: false, error: TOO_FAST };
  const parsed = healthSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That health data could not be read." };

  const data = normalizeHealth(parsed.data, viewer.profile.timezone, today);
  const latest = await getLatestWeight(viewer.userId);
  const counts = await importHealth(viewer.userId, data, {
    weightKg: latest?.kg ?? null,
    // In support mode weight tracking is turned down, so weigh-ins are not pulled in.
    includeWeight: !viewer.profile.supportMode,
  });
  refresh();
  revalidatePath("/train");
  revalidatePath("/trends");
  return { ok: true, counts };
}
