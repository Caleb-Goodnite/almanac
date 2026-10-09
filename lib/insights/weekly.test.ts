import { describe, expect, it } from "vitest";
import type { Snapshot } from "@/lib/data/snapshot";
import { MUSCLE_GROUPS } from "@/lib/science/volume";
import { reviewSchema } from "./review";
import { weeklyReview } from "./weekly";

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  const avg = { kcal: 2300, proteinG: 155, carbsG: 270, fatG: 65, fiberG: 30 };
  return {
    asOf: "2026-10-09",
    ageBand: "adult",
    goal: "lose_fat",
    activityLevel: "moderate",
    resistanceTraining: true,
    supportMode: false,
    targets: {
      calories: 2300, proteinG: 160, carbsG: 270, fatG: 64, fiberG: 32, waterMl: 3000,
      sleepMinMinutes: 420, sleepMaxMinutes: 540, activityMinutesPerWeek: 150, tdeeKcal: 2750, source: "formula",
    },
    nutrition: { loggedDays7: 7, loggedDays30: 26, avg7: avg, avg30: avg, waterAvg7Ml: 2200, days: [] },
    weight: { latestKg: 80, latestDate: "2026-10-09", avg7Kg: 80.4, weighIns28: 20, slopeKgPerWeek: -0.4, pctPerWeek: -0.5, tooFast: false, points: [] },
    training: {
      sessions7: 3, sessions30: 12, cardioMinutes7: 70,
      volume7: MUSCLE_GROUPS.map((group) => ({ group, sets: group === "chest" ? 12 : 0, status: group === "chest" ? "within" : "none" })),
      records30: [],
    },
    sleep: { nights7: 7, avg7Min: 450, avg30Min: 440, avgQuality7: 4, points: [] },
    checkin: { days7: 5, mood7: 3.5, energy7: 3.4, soreness7: 2.5, restingHr7: 58 },
    adaptive: null,
    logging: { daysLogged7: 7, currentRun: 20 },
    ...overrides,
  };
}

describe("weekly review", () => {
  it("always matches the shared schema", () => {
    for (const s of [snapshot(), snapshot({ targets: null }), snapshot({ logging: { daysLogged7: 1, currentRun: 1 } })]) {
      expect(reviewSchema.safeParse(weeklyReview(s)).success).toBe(true);
    }
  });

  it("says so when too little is logged, and concludes nothing else", () => {
    const r = weeklyReview(snapshot({ logging: { daysLogged7: 2, currentRun: 2 } }));
    expect(r.headline).toMatch(/Not enough/);
    expect(r.wins).toEqual([]);
    expect(r.slips).toEqual([]);
    expect(r.dataNote).toMatch(/2 of the last 7/);
  });

  it("quotes real numbers and gives exactly one thing to change", () => {
    const s = snapshot();
    s.nutrition.avg7 = { ...s.nutrition.avg7, proteinG: 94 };
    const r = weeklyReview(s);
    expect(r.slips.join(" ")).toMatch(/Protein averaged 94 g against a 160 g target/);
    expect(r.focus?.action).toMatch(/protein/i);
    expect(r.wins.length).toBeLessThanOrEqual(3);
    expect(r.slips.length).toBeLessThanOrEqual(3);
  });

  it("puts unsafe weight loss ahead of every other suggestion", () => {
    const s = snapshot();
    s.nutrition.avg7 = { ...s.nutrition.avg7, proteinG: 80 };
    s.weight = { ...s.weight, pctPerWeek: -1.6, tooFast: true };
    const r = weeklyReview(s);
    expect(r.focus?.action).toMatch(/Eat a little more/);
  });

  it("never tells a teen or someone in support mode to eat less", () => {
    for (const patch of [{ ageBand: "teen" as const }, { supportMode: true }]) {
      const s = snapshot(patch);
      s.nutrition.avg7 = { ...s.nutrition.avg7, kcal: 2900 };
      const over = weeklyReview(s);
      expect(JSON.stringify(over)).not.toMatch(/trim|above your|cut/i);

      s.nutrition.avg7 = { ...s.nutrition.avg7, kcal: 1700 };
      const under = weeklyReview(s);
      expect(under.focus?.action).toMatch(/snack|breakfast/i);
    }
  });

  it("does not review nutrition from a thinly logged week", () => {
    const s = snapshot();
    s.nutrition = { ...s.nutrition, loggedDays7: 2, avg7: { ...s.nutrition.avg7, proteinG: 20, kcal: 600 } };
    const r = weeklyReview(s);
    expect(r.slips.join(" ")).not.toMatch(/Protein|Calories/);
    expect(r.dataNote).toMatch(/only 2 of 7/);
  });
});
