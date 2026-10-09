import "server-only";
import { and, asc, between, desc, eq, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { foodLogs, savedMealItems, savedMeals, waterLogs, foods } from "@/lib/db/schema";
import type { DateString } from "@/lib/science/types";
import { getFood } from "./foods";

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export const MEALS: readonly Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export type FoodLog = typeof foodLogs.$inferSelect;

export type Totals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export const ZERO_TOTALS: Totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 };

const r2 = (n: number) => Math.round(n * 100) / 100;

export type LogFoodInput = {
  clientId: string;
  date: DateString;
  meal: Meal;
  foodId: string;
  quantityG: number;
};

/**
 * Logs a quantity of a food. Nutrients are computed here from the food row,
 * never taken from the client, and snapshotted on the log. Repeating the same
 * clientId is a no-op, so an offline retry cannot double-log.
 */
export async function logFood(userId: string, input: LogFoodInput): Promise<FoodLog | null> {
  const food = await getFood(userId, input.foodId);
  if (!food) return null;
  const f = input.quantityG / 100;

  const [row] = await db
    .insert(foodLogs)
    .values({
      userId,
      clientId: input.clientId,
      date: input.date,
      meal: input.meal,
      foodId: food.id,
      name: food.name,
      brand: food.brand,
      quantityG: input.quantityG,
      servingLabel: food.servingLabel,
      kcal: r2(food.kcal * f),
      proteinG: r2(food.proteinG * f),
      carbsG: r2(food.carbsG * f),
      fatG: r2(food.fatG * f),
      fiberG: r2((food.fiberG ?? 0) * f),
      sugarG: r2((food.sugarG ?? 0) * f),
      sodiumMg: r2((food.sodiumMg ?? 0) * f),
    })
    .onConflictDoNothing({ target: [foodLogs.userId, foodLogs.clientId] })
    .returning();
  if (row) return row;

  const [existing] = await db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.clientId, input.clientId)))
    .limit(1);
  return existing ?? null;
}

export type QuickAddInput = {
  clientId: string;
  date: DateString;
  meal: Meal;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Logs calories and macros directly, with no food record, for when someone only knows the label. */
export async function quickAdd(userId: string, input: QuickAddInput): Promise<void> {
  await db
    .insert(foodLogs)
    .values({ userId, ...input, foodId: null, quantityG: 0 })
    .onConflictDoNothing({ target: [foodLogs.userId, foodLogs.clientId] });
}

export async function deleteFoodLog(userId: string, logId: string): Promise<void> {
  await db.delete(foodLogs).where(and(eq(foodLogs.id, logId), eq(foodLogs.userId, userId)));
}

export async function updateFoodLogQuantity(userId: string, logId: string, quantityG: number): Promise<void> {
  const [log] = await db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.id, logId), eq(foodLogs.userId, userId)))
    .limit(1);
  if (!log || log.quantityG <= 0) return;
  // Rescale the stored snapshot, so an edit never depends on the food still existing.
  const k = quantityG / log.quantityG;
  await db
    .update(foodLogs)
    .set({
      quantityG,
      kcal: r2(log.kcal * k),
      proteinG: r2(log.proteinG * k),
      carbsG: r2(log.carbsG * k),
      fatG: r2(log.fatG * k),
      fiberG: r2(log.fiberG * k),
      sugarG: r2(log.sugarG * k),
      sodiumMg: r2(log.sodiumMg * k),
    })
    .where(and(eq(foodLogs.id, logId), eq(foodLogs.userId, userId)));
}

export async function getFoodLogs(userId: string, date: DateString): Promise<FoodLog[]> {
  return db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, date)))
    .orderBy(asc(foodLogs.loggedAt));
}

export function sumTotals(logs: readonly Pick<FoodLog, keyof Totals>[]): Totals {
  const t = { ...ZERO_TOTALS };
  for (const l of logs) {
    t.kcal += l.kcal;
    t.proteinG += l.proteinG;
    t.carbsG += l.carbsG;
    t.fatG += l.fatG;
    t.fiberG += l.fiberG;
    t.sugarG += l.sugarG;
    t.sodiumMg += l.sodiumMg;
  }
  return t;
}

export type DayTotals = Totals & { date: DateString; entries: number };

/** Per-day totals over a date range (inclusive). Days with nothing logged are absent, not zero. */
export async function getDailyTotals(userId: string, from: DateString, to: DateString): Promise<DayTotals[]> {
  const sum = (c: AnyColumn) => sql<number>`coalesce(sum(${c}), 0)::float8`;
  return db
    .select({
      date: foodLogs.date,
      entries: sql<number>`count(*)::int`,
      kcal: sum(foodLogs.kcal),
      proteinG: sum(foodLogs.proteinG),
      carbsG: sum(foodLogs.carbsG),
      fatG: sum(foodLogs.fatG),
      fiberG: sum(foodLogs.fiberG),
      sugarG: sum(foodLogs.sugarG),
      sodiumMg: sum(foodLogs.sodiumMg),
    })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), between(foodLogs.date, from, to)))
    .groupBy(foodLogs.date)
    .orderBy(asc(foodLogs.date));
}

/* Water */

export async function addWater(userId: string, date: DateString, ml: number): Promise<void> {
  await db.insert(waterLogs).values({ userId, date, ml });
}

export async function undoLastWater(userId: string, date: DateString): Promise<void> {
  const [last] = await db
    .select({ id: waterLogs.id })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date)))
    .orderBy(desc(waterLogs.loggedAt))
    .limit(1);
  if (last) await db.delete(waterLogs).where(and(eq(waterLogs.id, last.id), eq(waterLogs.userId, userId)));
}

export async function getWaterMl(userId: string, date: DateString): Promise<number> {
  const [row] = await db
    .select({ ml: sql<number>`coalesce(sum(${waterLogs.ml}), 0)::int` })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date)));
  return row?.ml ?? 0;
}

export async function getDailyWater(userId: string, from: DateString, to: DateString) {
  return db
    .select({ date: waterLogs.date, ml: sql<number>`sum(${waterLogs.ml})::int` })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), between(waterLogs.date, from, to)))
    .groupBy(waterLogs.date);
}

/* Saved meals */

export type SavedMeal = { id: string; name: string; items: number; kcal: number };

export async function listSavedMeals(userId: string): Promise<SavedMeal[]> {
  return db
    .select({
      id: savedMeals.id,
      name: savedMeals.name,
      items: sql<number>`count(${savedMealItems.id})::int`,
      kcal: sql<number>`coalesce(sum(${foods.kcal} * ${savedMealItems.quantityG} / 100), 0)::float8`,
    })
    .from(savedMeals)
    .leftJoin(savedMealItems, and(eq(savedMealItems.savedMealId, savedMeals.id), eq(savedMealItems.userId, userId)))
    .leftJoin(foods, eq(foods.id, savedMealItems.foodId))
    .where(eq(savedMeals.userId, userId))
    .groupBy(savedMeals.id)
    .orderBy(asc(savedMeals.name));
}

/** Saves everything logged in one meal on one day as a reusable meal. */
export async function saveMealFromDay(userId: string, name: string, date: DateString, meal: Meal): Promise<boolean> {
  const logs = await db
    .select({ foodId: foodLogs.foodId, quantityG: foodLogs.quantityG })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, date), eq(foodLogs.meal, meal)))
    .orderBy(asc(foodLogs.loggedAt));
  const items = logs.filter((l): l is { foodId: string; quantityG: number } => l.foodId !== null && l.quantityG > 0);
  if (items.length === 0) return false;

  await db.transaction(async (tx) => {
    const [saved] = await tx.insert(savedMeals).values({ userId, name }).returning({ id: savedMeals.id });
    if (!saved) throw new Error("Could not save meal");
    await tx.insert(savedMealItems).values(
      items.map((it, position) => ({ userId, savedMealId: saved.id, foodId: it.foodId, quantityG: it.quantityG, position })),
    );
  });
  return true;
}

/** Logs every item of a saved meal. `clientId` seeds per-item ids so a retry stays idempotent. */
export async function logSavedMeal(userId: string, savedMealId: string, date: DateString, meal: Meal, clientId: string): Promise<number> {
  const items = await db
    .select({ id: savedMealItems.id, foodId: savedMealItems.foodId, quantityG: savedMealItems.quantityG })
    .from(savedMealItems)
    .where(and(eq(savedMealItems.userId, userId), eq(savedMealItems.savedMealId, savedMealId)))
    .orderBy(asc(savedMealItems.position));

  let logged = 0;
  for (const [i, item] of items.entries()) {
    const id = deriveUuid(clientId, i);
    if (await logFood(userId, { clientId: id, date, meal, foodId: item.foodId, quantityG: item.quantityG })) logged += 1;
  }
  return logged;
}

export async function deleteSavedMeal(userId: string, savedMealId: string): Promise<void> {
  await db.delete(savedMeals).where(and(eq(savedMeals.id, savedMealId), eq(savedMeals.userId, userId)));
}

/** Derives a stable UUID from a base UUID and an index by replacing its last 4 hex digits. */
function deriveUuid(base: string, index: number): string {
  return base.slice(0, -4) + index.toString(16).padStart(4, "0");
}

/* Micronutrients */

export type MicroTotals = { totals: Record<string, number>; entriesWithData: number; entries: number };

/**
 * Micronutrient totals for a day, from the foods' stored per-100 g values.
 * Only some foods carry this data (mostly USDA entries), so the result also
 * says how many of the day's entries contributed.
 */
export async function getMicroTotals(userId: string, date: DateString): Promise<MicroTotals> {
  const rows = await db
    .select({ quantityG: foodLogs.quantityG, micros: foods.micros, source: foods.source, ownerId: foods.ownerId })
    .from(foodLogs)
    .leftJoin(foods, eq(foods.id, foodLogs.foodId))
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, date)));

  const totals: Record<string, number> = {};
  let entriesWithData = 0;
  for (const row of rows) {
    // A custom food is only ever this user's own (it was logged by them), but check anyway.
    if (row.source === "custom" && row.ownerId !== userId) continue;
    const micros = row.micros ?? {};
    const keys = Object.keys(micros);
    if (keys.length === 0 || row.quantityG <= 0) continue;
    entriesWithData += 1;
    for (const key of keys) {
      totals[key] = (totals[key] ?? 0) + ((micros[key] ?? 0) * row.quantityG) / 100;
    }
  }
  return { totals, entriesWithData, entries: rows.length };
}

/* Copying a meal from another day */

/** How many entries each meal had on a given day, to decide whether "copy" is worth offering. */
export async function mealCounts(userId: string, date: DateString): Promise<Record<Meal, number>> {
  const rows = await db
    .select({ meal: foodLogs.meal, n: sql<number>`count(*)::int` })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, date)))
    .groupBy(foodLogs.meal);
  const out: Record<Meal, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const r of rows) out[r.meal] = r.n;
  return out;
}

/**
 * Copies every entry of one meal from one day to another, as fresh log rows.
 * The stored nutrient snapshot is copied as it is, so the result matches what
 * was eaten before even if a food has since changed. Idempotent per clientId.
 */
export async function copyMeal(userId: string, from: DateString, to: DateString, meal: Meal, clientId: string): Promise<number> {
  const source = await db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, from), eq(foodLogs.meal, meal)))
    .orderBy(asc(foodLogs.loggedAt));
  if (source.length === 0) return 0;

  const inserted = await db
    .insert(foodLogs)
    .values(
      source.map(({ id: _id, loggedAt: _at, ...row }, i) => ({
        ...row,
        date: to,
        clientId: deriveUuid(clientId, i),
      })),
    )
    .onConflictDoNothing({ target: [foodLogs.userId, foodLogs.clientId] })
    .returning({ id: foodLogs.id });
  return inserted.length;
}
