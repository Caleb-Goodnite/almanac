import "server-only";
import { desc, eq } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { tdeeEstimates } from "@/lib/db/schema";
import { estimateAdaptiveTdee, type AdaptiveResult } from "@/lib/science/adaptive";
import { estimateBmr, estimateTdee } from "@/lib/science/energy";
import { rateOfChangeWarning } from "@/lib/science/targets";
import { addDays, linearRegression, mean, movingAverage } from "@/lib/science/trend";
import type { DateString } from "@/lib/science/types";
import type { MuscleVolume } from "@/lib/science/volume";
import { todayIn } from "@/lib/time";
import { activeDates, currentRun, listCheckins, listSleep, listWeights } from "./body";
import { getDailyTotals, getDailyWater, type DayTotals } from "./food-logs";
import { getTargets, recomputeTargets, type TargetRow } from "./profile";
import { getVolume, listCardio, listRecentRecords, listWorkouts, type RecentRecord } from "./training";

const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const r0 = (n: number | null) => (n == null ? null : Math.round(n));

export type MacroAverages = { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; fiberG: number | null };

/**
 * Everything the app knows about a user's last 30 days, reduced to numbers.
 * The dashboard, the trends page, the weekly review and the coach all read
 * this one structure, so they can never disagree with each other.
 *
 * It contains no name, email, account id or birth date. Free text the user
 * typed (food names, notes) is deliberately left out.
 */
export type Snapshot = {
  asOf: DateString;
  ageBand: "teen" | "adult";
  goal: string;
  activityLevel: string;
  resistanceTraining: boolean;
  supportMode: boolean;
  targets: Pick<
    TargetRow,
    "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "waterMl" | "sleepMinMinutes" | "sleepMaxMinutes" | "activityMinutesPerWeek" | "tdeeKcal" | "source"
  > | null;
  nutrition: {
    loggedDays7: number;
    loggedDays30: number;
    avg7: MacroAverages;
    avg30: MacroAverages;
    waterAvg7Ml: number | null;
    days: DayTotals[];
  };
  weight: {
    latestKg: number | null;
    latestDate: DateString | null;
    avg7Kg: number | null;
    weighIns28: number;
    slopeKgPerWeek: number | null;
    pctPerWeek: number | null;
    tooFast: boolean;
    points: { date: DateString; value: number }[];
  };
  training: {
    sessions7: number;
    sessions30: number;
    cardioMinutes7: number;
    volume7: MuscleVolume[];
    records30: RecentRecord[];
  };
  sleep: { nights7: number; avg7Min: number | null; avg30Min: number | null; avgQuality7: number | null; points: { date: DateString; value: number }[] };
  checkin: { days7: number; mood7: number | null; energy7: number | null; soreness7: number | null; restingHr7: number | null };
  adaptive: AdaptiveResult | null;
  logging: { daysLogged7: number; currentRun: number };
};

function averages(days: readonly DayTotals[]): MacroAverages {
  return {
    kcal: r0(mean(days.map((d) => d.kcal))),
    proteinG: r0(mean(days.map((d) => d.proteinG))),
    carbsG: r0(mean(days.map((d) => d.carbsG))),
    fatG: r0(mean(days.map((d) => d.fatG))),
    fiberG: r0(mean(days.map((d) => d.fiberG))),
  };
}

export async function buildSnapshot(viewer: Viewer): Promise<Snapshot> {
  const { userId, profile } = viewer;
  const today = todayIn(profile.timezone);
  const d7 = addDays(today, -6);
  const d28 = addDays(today, -27);
  const d30 = addDays(today, -29);

  const [targets, days, water, weightRows, volume7, sessions, cardio, records, sleep, checkinRows, dates] = await Promise.all([
    getTargets(userId, today),
    getDailyTotals(userId, d30, today),
    getDailyWater(userId, d7, today),
    listWeights(userId, d30, today),
    getVolume(userId, d7, today),
    listWorkouts(userId, d30, today),
    listCardio(userId, d7, today),
    listRecentRecords(userId, d30),
    listSleep(userId, d30, today),
    listCheckins(userId, d7, today),
    activeDates(userId, addDays(today, -60), today),
  ]);

  const week = days.filter((d) => d.date >= d7);
  const weightPoints = weightRows.map((w) => ({ date: w.date, value: w.kg }));
  const last28 = weightPoints.filter((p) => p.date >= d28);
  const fit = last28.length >= 4 ? linearRegression(last28) : null;
  const latest = weightRows[weightRows.length - 1] ?? null;
  const ma = movingAverage(weightPoints, 7);
  const slope = fit ? fit.slopePerDay * 7 : null;
  const warn = slope != null && latest ? rateOfChangeWarning(slope, latest.kg, viewer.isTeen) : null;

  let adaptive: AdaptiveResult | null = null;
  if (latest && profile.heightCm) {
    const bmr = estimateBmr({ sex: profile.sex, weightKg: latest.kg, heightCm: profile.heightCm, ageYears: viewer.ageYears, bodyFatPct: profile.bodyFatPct });
    adaptive = estimateAdaptiveTdee({
      intake: days.map((d) => ({ date: d.date, value: d.kcal })),
      weights: weightPoints,
      today,
      formulaTdeeKcal: estimateTdee(bmr.kcal, profile.activityLevel),
    });
  }

  const sleep7 = sleep.filter((s) => s.date >= d7);
  const quality = sleep7.map((s) => s.quality).filter((q): q is number => q != null);
  const pick = (k: "mood" | "energy" | "soreness" | "restingHr") =>
    r1(mean(checkinRows.map((c) => c[k]).filter((v): v is number => v != null)));
  const daysLogged7 = Array.from({ length: 7 }, (_, i) => addDays(d7, i)).filter((d) => dates.has(d)).length;

  return {
    asOf: today,
    ageBand: viewer.isTeen ? "teen" : "adult",
    goal: profile.goal,
    activityLevel: profile.activityLevel,
    resistanceTraining: profile.resistanceTraining,
    supportMode: profile.supportMode,
    targets,
    nutrition: {
      loggedDays7: week.length,
      loggedDays30: days.length,
      avg7: averages(week),
      avg30: averages(days),
      waterAvg7Ml: r0(mean(water.map((w) => w.ml))),
      days,
    },
    weight: {
      latestKg: latest?.kg ?? null,
      latestDate: latest?.date ?? null,
      avg7Kg: r1(ma[ma.length - 1]?.value ?? null),
      weighIns28: last28.length,
      slopeKgPerWeek: slope == null ? null : Math.round(slope * 100) / 100,
      pctPerWeek: warn?.pctPerWeek ?? null,
      tooFast: warn?.tooFast ?? false,
      points: weightPoints,
    },
    training: {
      sessions7: sessions.filter((s) => s.date >= d7 && s.endedAt).length,
      sessions30: sessions.filter((s) => s.endedAt).length,
      cardioMinutes7: Math.round(cardio.reduce((n, c) => n + c.durationSec / 60, 0)),
      volume7,
      records30: records,
    },
    sleep: {
      nights7: sleep7.length,
      avg7Min: r0(mean(sleep7.map((s) => s.durationMin))),
      avg30Min: r0(mean(sleep.map((s) => s.durationMin))),
      avgQuality7: r1(mean(quality)),
      points: sleep.map((s) => ({ date: s.date, value: s.durationMin / 60 })),
    },
    checkin: { days7: checkinRows.length, mood7: pick("mood"), energy7: pick("energy"), soreness7: pick("soreness"), restingHr7: r0(pick("restingHr")) },
    adaptive,
    logging: { daysLogged7, currentRun: currentRun(dates, today) },
  };
}

/**
 * Stores a fresh adaptive TDEE estimate and recomputes targets, at most once
 * a week and only when there is enough data. Returns true when targets changed.
 */
export async function maybeUpdateAdaptiveTargets(userId: string, snapshot: Snapshot): Promise<boolean> {
  const a = snapshot.adaptive;
  // Never adapt targets downward for someone in support mode.
  if (!a || !a.ok || snapshot.supportMode) return false;

  const [last] = await db
    .select({ computedOn: tdeeEstimates.computedOn })
    .from(tdeeEstimates)
    .where(eq(tdeeEstimates.userId, userId))
    .orderBy(desc(tdeeEstimates.computedOn))
    .limit(1);
  if (last && last.computedOn > addDays(snapshot.asOf, -7)) return false;

  await db.insert(tdeeEstimates).values({
    userId,
    computedOn: snapshot.asOf,
    windowDays: a.windowDays,
    tdeeKcal: a.tdeeKcal,
    avgIntakeKcal: a.avgIntakeKcal,
    weightSlopeKgPerWeek: a.slopeKgPerWeek,
    loggedDays: a.loggedDays,
    weighIns: a.weighIns,
    confidence: a.confidence,
  });
  await recomputeTargets(userId);
  return true;
}
