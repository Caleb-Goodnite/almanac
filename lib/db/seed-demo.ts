/**
 * Fills one existing account with five weeks of plausible data so the
 * dashboard, charts and coach have something to show during development.
 *
 *   pnpm db:demo someone@example.test
 *
 * It only ever touches the account whose email you pass, and replaces that
 * account's logged data. It refuses to run with NODE_ENV=production.
 */
import { and, eq, inArray } from "drizzle-orm";
import { closeDatabase, db } from "./client";
import {
  cardioSessions,
  checkins,
  exercises,
  foodLogs,
  personalRecords,
  profile,
  sleepLogs,
  user,
  waterLogs,
  weights,
  workoutSets,
  workouts,
} from "./schema";

const DAYS = 35;

// Small deterministic generator so every run produces the same data.
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const jitter = (spread: number) => (rand() - 0.5) * 2 * spread;
const iso = (d: Date) => d.toISOString().slice(0, 10);

const MEALS = [
  { meal: "breakfast" as const, name: "Oats with milk and banana", kcal: 430, p: 17, c: 68, f: 10, fiber: 8, sugar: 22, sodium: 120 },
  { meal: "lunch" as const, name: "Chicken, rice and vegetables", kcal: 640, p: 46, c: 72, f: 16, fiber: 7, sugar: 6, sodium: 720 },
  { meal: "dinner" as const, name: "Salmon, potatoes and salad", kcal: 690, p: 41, c: 55, f: 32, fiber: 8, sugar: 7, sodium: 610 },
  { meal: "snack" as const, name: "Greek yogurt and berries", kcal: 210, p: 19, c: 22, f: 4, fiber: 3, sugar: 17, sodium: 70 },
  { meal: "snack" as const, name: "Toast with peanut butter", kcal: 290, p: 10, c: 28, f: 15, fiber: 4, sugar: 5, sodium: 310 },
];

const SPLIT: Record<number, { name: string; lifts: [slug: string, kg: number, reps: number][] }> = {
  1: { name: "Upper body", lifts: [["barbell-bench-press-medium-grip", 72.5, 8], ["bent-over-barbell-row", 65, 8], ["dumbbell-shoulder-press", 22, 10], ["barbell-curl", 30, 10]] },
  3: { name: "Lower body", lifts: [["barbell-squat", 95, 6], ["romanian-deadlift", 85, 8], ["standing-calf-raises", 60, 12], ["plank", 0, 1]] },
  5: { name: "Upper body", lifts: [["barbell-bench-press-medium-grip", 70, 10], ["pullups", 0, 8], ["dumbbell-shoulder-press", 22, 10], ["triceps-pushdown", 30, 12]] },
};

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
  const email = process.argv[2];
  if (!email) throw new Error("Usage: pnpm db:demo <email of an existing account>");

  const [account] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (!account) throw new Error(`No account with email ${email}. Sign up in the app first.`);
  const userId = account.id;
  const [p] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1);
  if (!p?.onboardedAt) throw new Error("Finish onboarding for that account first.");

  const slugs = [...new Set(Object.values(SPLIT).flatMap((s) => s.lifts.map((l) => l[0])))];
  const found = await db.select({ id: exercises.id, slug: exercises.slug }).from(exercises).where(inArray(exercises.slug, slugs));
  const bySlug = new Map(found.map((e) => [e.slug, e.id]));
  if (bySlug.size === 0) throw new Error("Exercise library is empty. Run pnpm db:seed first.");

  for (const table of [foodLogs, waterLogs, sleepLogs, checkins, cardioSessions, personalRecords, workoutSets, workouts, weights]) {
    await db.delete(table).where(eq(table.userId, userId));
  }

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const startKg = 82.4;
  let sets = 0;

  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const date = iso(d);
    const dayIndex = DAYS - 1 - i;
    const week = Math.floor(dayIndex / 7);
    const weekday = d.getUTCDay();

    // Weight: about -0.35 kg a week with day-to-day noise; skipped some days.
    if (rand() > 0.2) {
      await db.insert(weights).values({ userId, date, kg: Math.round((startKg - (dayIndex / 7) * 0.35 + jitter(0.5)) * 10) / 10 });
    }

    // Food: most days logged; protein runs under target on purpose.
    if (rand() > 0.12) {
      const scale = 1 + jitter(0.12) + (weekday === 6 ? 0.18 : 0);
      const todays = MEALS.filter((_, k) => k < 3 || rand() > 0.35);
      await db.insert(foodLogs).values(
        todays.map((m) => ({
          userId,
          clientId: crypto.randomUUID(),
          date,
          meal: m.meal,
          foodId: null,
          name: m.name,
          quantityG: 0,
          kcal: Math.round(m.kcal * scale),
          proteinG: Math.round(m.p * scale * 0.8),
          carbsG: Math.round(m.c * scale),
          fatG: Math.round(m.f * scale),
          fiberG: Math.round(m.fiber * scale),
          sugarG: Math.round(m.sugar * scale),
          sodiumMg: Math.round(m.sodium * scale),
          loggedAt: d,
        })),
      );
      await db.insert(waterLogs).values({ userId, date, ml: 250 * (5 + Math.floor(rand() * 5)), loggedAt: d });
    }

    // Sleep: a little short on average, worse midweek.
    if (rand() > 0.15) {
      const minutes = Math.round(405 + jitter(55) - (weekday === 3 ? 35 : 0) + (weekday === 0 ? 45 : 0));
      await db.insert(sleepLogs).values({ userId, date, durationMin: minutes, quality: Math.max(1, Math.min(5, Math.round(minutes / 110))) });
    }

    if (rand() > 0.3) {
      await db.insert(checkins).values({
        userId,
        date,
        mood: 3 + Math.round(jitter(1)),
        energy: 3 + Math.round(jitter(1)),
        soreness: SPLIT[(weekday + 6) % 7] ? 3 + Math.round(rand()) : 2,
        restingHr: 58 + Math.round(jitter(4)),
      });
    }

    const plan = SPLIT[weekday];
    if (plan && rand() > 0.1) {
      const startedAt = new Date(d.getTime() + 6 * 3_600_000);
      const [w] = await db
        .insert(workouts)
        .values({ userId, clientId: crypto.randomUUID(), date, name: plan.name, startedAt, endedAt: new Date(startedAt.getTime() + 55 * 60_000), kcalEstimate: 260 })
        .returning({ id: workouts.id });
      let order = 0;
      for (const [slug, kg, reps] of plan.lifts) {
        const exerciseId = bySlug.get(slug);
        if (!exerciseId || !w) continue;
        // Slow progression: 2.5 kg every other week on loaded lifts.
        const load = kg > 0 ? kg + Math.floor(week / 2) * 2.5 : 0;
        await db.insert(workoutSets).values(
          [0, 1, 2].map((n) => ({
            userId,
            workoutId: w.id,
            exerciseId,
            exerciseOrder: order,
            setNumber: n + 1,
            reps: Math.max(1, reps - (n === 2 ? 1 : 0)),
            weightKg: load,
            rpe: 7 + n * 0.5,
            rir: 3 - n,
            completedAt: new Date(startedAt.getTime() + (order * 12 + n * 3) * 60_000),
          })),
        );
        sets += 3;
        order += 1;
      }
    }

    if (weekday === 2 || weekday === 6) {
      await db.insert(cardioSessions).values({
        userId,
        clientId: crypto.randomUUID(),
        date,
        activity: weekday === 6 ? "run_6mph" : "walk_brisk",
        label: weekday === 6 ? "Running, 6 mph (10 min/mile)" : "Walking, brisk (3.5-3.9 mph)",
        durationSec: (weekday === 6 ? 32 : 40) * 60,
        distanceM: weekday === 6 ? 5100 : 3900,
        avgHr: weekday === 6 ? 156 : 112,
        met: weekday === 6 ? 9.3 : 4.8,
        kcalEstimate: weekday === 6 ? 405 : 262,
        startedAt: d,
      });
    }
  }

  // Make sure nothing was left half-open.
  await db.delete(workouts).where(and(eq(workouts.userId, userId), eq(workouts.name, "")));
  console.log(`Seeded ${DAYS} days of demo data for ${email} (${sets} sets).`);
  await closeDatabase();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDatabase();
  process.exit(1);
});
