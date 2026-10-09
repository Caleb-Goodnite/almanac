import "server-only";
import { isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cardioSessions, checkins, sleepLogs, weights } from "@/lib/db/schema";
import type { NormalizedHealth } from "@/lib/health-import/normalize";
import { activityByKey, kcalFromMet } from "@/lib/science/met";

export type ImportCounts = { weights: number; sleep: number; restingHr: number; workouts: number };

/**
 * Saves data read from Apple Health or Health Connect. It only ever fills
 * gaps: a day that already has a weight, a night of sleep or a resting heart
 * rate keeps what is there, so anything typed in by hand wins, and running
 * the import twice adds nothing the second time.
 */
export async function importHealth(
  userId: string,
  data: NormalizedHealth,
  options: { weightKg: number | null; includeWeight: boolean },
): Promise<ImportCounts> {
  const counts: ImportCounts = { weights: 0, sleep: 0, restingHr: 0, workouts: 0 };

  if (options.includeWeight && data.weights.length > 0) {
    const rows = await db
      .insert(weights)
      .values(data.weights.map((w) => ({ userId, date: w.date, kg: w.kg })))
      .onConflictDoNothing({ target: [weights.userId, weights.date] })
      .returning({ id: weights.id });
    counts.weights = rows.length;
  }

  if (data.sleep.length > 0) {
    const rows = await db
      .insert(sleepLogs)
      .values(data.sleep.map((s) => ({ userId, ...s })))
      .onConflictDoNothing({ target: [sleepLogs.userId, sleepLogs.date] })
      .returning({ id: sleepLogs.id });
    counts.sleep = rows.length;
  }

  if (data.restingHr.length > 0) {
    // Resting heart rate lives on the daily check-in; add it without touching mood, energy or notes.
    const rows = await db
      .insert(checkins)
      .values(data.restingHr.map((r) => ({ userId, date: r.date, restingHr: r.bpm })))
      .onConflictDoUpdate({
        target: [checkins.userId, checkins.date],
        set: { restingHr: sql`excluded.resting_hr` },
        setWhere: isNull(checkins.restingHr),
      })
      .returning({ id: checkins.id });
    counts.restingHr = rows.length;
  }

  const sessions = data.workouts.flatMap((w) => {
    const activity = activityByKey(w.activity);
    if (!activity) return [];
    return [
      {
        userId,
        clientId: w.clientId,
        date: w.date,
        activity: activity.key,
        label: activity.label,
        durationSec: w.durationSec,
        distanceM: w.distanceM,
        met: activity.met,
        kcalEstimate: options.weightKg ? Math.round(kcalFromMet(activity.met, options.weightKg, w.durationSec / 60)) : null,
        notes: "Imported from your phone's health data",
        startedAt: w.startedAt,
      },
    ];
  });
  if (sessions.length > 0) {
    const rows = await db
      .insert(cardioSessions)
      .values(sessions)
      .onConflictDoNothing({ target: [cardioSessions.userId, cardioSessions.clientId] })
      .returning({ id: cardioSessions.id });
    counts.workouts = rows.length;
  }

  return counts;
}
