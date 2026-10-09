import "server-only";
import { and, asc, between, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cardioSessions, checkins, foodLogs, measurements, sleepLogs, weights, workouts } from "@/lib/db/schema";
import type { DateString } from "@/lib/science/types";
import { addDays } from "@/lib/science/trend";

export type WeightRow = { date: DateString; kg: number; bodyFatPct: number | null };
export type SleepRow = typeof sleepLogs.$inferSelect;
export type CheckinRow = typeof checkins.$inferSelect;
export type MeasurementSite = (typeof measurements.$inferSelect)["site"];

/* Weight */

export async function logWeight(userId: string, date: DateString, kg: number, bodyFatPct: number | null): Promise<void> {
  await db
    .insert(weights)
    .values({ userId, date, kg, bodyFatPct })
    .onConflictDoUpdate({ target: [weights.userId, weights.date], set: { kg, bodyFatPct, loggedAt: new Date() } });
}

export async function deleteWeight(userId: string, date: DateString): Promise<void> {
  await db.delete(weights).where(and(eq(weights.userId, userId), eq(weights.date, date)));
}

export async function listWeights(userId: string, from: DateString, to: DateString): Promise<WeightRow[]> {
  return db
    .select({ date: weights.date, kg: weights.kg, bodyFatPct: weights.bodyFatPct })
    .from(weights)
    .where(and(eq(weights.userId, userId), between(weights.date, from, to)))
    .orderBy(asc(weights.date));
}

export async function firstWeightDate(userId: string): Promise<DateString | null> {
  const [row] = await db.select({ date: sql<string | null>`min(${weights.date})` }).from(weights).where(eq(weights.userId, userId));
  return row?.date ?? null;
}

/* Measurements */

export async function logMeasurement(userId: string, date: DateString, site: MeasurementSite, cm: number): Promise<void> {
  await db
    .insert(measurements)
    .values({ userId, date, site, cm })
    .onConflictDoUpdate({ target: [measurements.userId, measurements.date, measurements.site], set: { cm } });
}

/** The latest reading for each site, with the one before it for comparison. */
export async function latestMeasurements(userId: string) {
  const rows = await db
    .select({ site: measurements.site, date: measurements.date, cm: measurements.cm })
    .from(measurements)
    .where(eq(measurements.userId, userId))
    .orderBy(asc(measurements.site), desc(measurements.date));
  const out = new Map<MeasurementSite, { date: DateString; cm: number; previousCm: number | null }>();
  const seen = new Map<MeasurementSite, number>();
  for (const r of rows) {
    const n = seen.get(r.site) ?? 0;
    if (n === 0) out.set(r.site, { date: r.date, cm: r.cm, previousCm: null });
    else if (n === 1) out.get(r.site)!.previousCm = r.cm;
    seen.set(r.site, n + 1);
  }
  return out;
}

/* Sleep */

export type SleepInput = { date: DateString; durationMin: number; quality: number | null; bedtime: string | null; wakeTime: string | null };

export async function logSleep(userId: string, input: SleepInput): Promise<void> {
  const { date, ...rest } = input;
  await db
    .insert(sleepLogs)
    .values({ userId, date, ...rest })
    .onConflictDoUpdate({ target: [sleepLogs.userId, sleepLogs.date], set: rest });
}

export async function listSleep(userId: string, from: DateString, to: DateString): Promise<SleepRow[]> {
  return db
    .select()
    .from(sleepLogs)
    .where(and(eq(sleepLogs.userId, userId), between(sleepLogs.date, from, to)))
    .orderBy(asc(sleepLogs.date));
}

/* Check-ins */

export type CheckinInput = {
  date: DateString;
  mood: number | null;
  energy: number | null;
  soreness: number | null;
  restingHr: number | null;
  note: string | null;
};

export async function saveCheckin(userId: string, input: CheckinInput): Promise<void> {
  const { date, ...rest } = input;
  await db
    .insert(checkins)
    .values({ userId, date, ...rest })
    .onConflictDoUpdate({ target: [checkins.userId, checkins.date], set: rest });
}

export async function listCheckins(userId: string, from: DateString, to: DateString): Promise<CheckinRow[]> {
  return db
    .select()
    .from(checkins)
    .where(and(eq(checkins.userId, userId), between(checkins.date, from, to)))
    .orderBy(asc(checkins.date));
}

/* Logging days */

/**
 * Dates in the range on which the user logged anything at all. This feeds the
 * "days logged" count, which is shown as a plain fact: there is no penalty,
 * reset animation or reminder when a day is missed.
 */
export async function activeDates(userId: string, from: DateString, to: DateString): Promise<Set<DateString>> {
  const tables = [foodLogs, weights, sleepLogs, checkins, workouts, cardioSessions] as const;
  const results = await Promise.all(
    tables.map((t) =>
      db
        .selectDistinct({ date: t.date })
        .from(t)
        .where(and(eq(t.userId, userId), between(t.date, from, to))),
    ),
  );
  return new Set(results.flat().map((r) => r.date));
}

export function currentRun(dates: ReadonlySet<DateString>, today: DateString): number {
  // A run still counts if today has nothing yet: the day is not over.
  let day = dates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}
