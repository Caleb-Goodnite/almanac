import type { Snapshot } from "@/lib/data/snapshot";
import { MUSCLE_GROUPS } from "@/lib/science/volume";

/** A fixed, realistic 30-day snapshot. Each eval case changes only what it is about. */
export function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  const avg = { kcal: 2033, proteinG: 95, carbsG: 221, fatG: 69, fiberG: 27 };
  return {
    asOf: "2026-10-09",
    ageBand: "adult",
    goal: "lose_fat",
    activityLevel: "moderate",
    resistanceTraining: true,
    supportMode: false,
    targets: {
      calories: 2050, proteinG: 160, carbsG: 230, fatG: 57, fiberG: 29, waterMl: 3000,
      sleepMinMinutes: 420, sleepMaxMinutes: 540, activityMinutesPerWeek: 150, tdeeKcal: 2497, source: "adaptive",
    },
    nutrition: { loggedDays7: 7, loggedDays30: 27, avg7: avg, avg30: { ...avg, kcal: 2114, proteinG: 100 }, waterAvg7Ml: 1800, days: [] },
    weight: { latestKg: 80.5, latestDate: "2026-10-09", avg7Kg: 80.9, weighIns28: 24, slopeKgPerWeek: -0.3, pctPerWeek: -0.37, tooFast: false, points: [] },
    training: {
      sessions7: 2, sessions30: 12, cardioMinutes7: 72,
      volume7: MUSCLE_GROUPS.map((group) => ({ group, sets: ["back", "shoulders", "calves"].includes(group) ? 6 : 3, status: "below" as const })),
      records30: [],
    },
    sleep: { nights7: 6, avg7Min: 408, avg30Min: 410, avgQuality7: 3.7, points: [] },
    checkin: { days7: 7, mood7: 3.3, energy7: 3, soreness7: 2.6, restingHr7: 58 },
    adaptive: { ok: true, tdeeKcal: 2497, observedKcal: 2439, avgIntakeKcal: 2114, slopeKgPerWeek: -0.3, loggedDays: 26, weighIns: 24, windowDays: 28, confidence: "high" },
    logging: { daysLogged7: 7, currentRun: 35 },
    ...overrides,
  };
}

export const FOODS = ["Oats with milk and banana", "Chicken, rice and vegetables", "Salmon, potatoes and salad", "Greek yogurt and berries"];
