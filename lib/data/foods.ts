import "server-only";
import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { foodLogs, foods, type FoodPortion } from "@/lib/db/schema";
import type { FoodInput } from "@/lib/food/types";

export type Food = typeof foods.$inferSelect;

/** What the client needs to show and log a food. */
export type FoodSummary = Pick<
  Food,
  "id" | "source" | "sourceId" | "name" | "brand" | "servingG" | "servingLabel" | "portions" | "category" | "kcal" | "proteinG" | "carbsG" | "fatG"
>;

const summaryColumns = {
  id: foods.id,
  source: foods.source,
  sourceId: foods.sourceId,
  name: foods.name,
  brand: foods.brand,
  servingG: foods.servingG,
  servingLabel: foods.servingLabel,
  portions: foods.portions,
  category: foods.category,
  kcal: foods.kcal,
  proteinG: foods.proteinG,
  carbsG: foods.carbsG,
  fatG: foods.fatG,
};

/** Shared catalogue rows, plus this user's own custom foods. Never anyone else's. */
function visibleTo(userId: string) {
  return or(ne(foods.source, "custom"), eq(foods.ownerId, userId));
}

/** Caches foods fetched from USDA or Open Food Facts. These rows are shared, not user data. */
export async function cacheFoods(inputs: readonly FoodInput[]): Promise<FoodSummary[]> {
  const rows = inputs.filter((f) => f.source !== "custom");
  if (rows.length === 0) return [];
  return db
    .insert(foods)
    .values(
      rows.map((f) => ({
        source: f.source,
        sourceId: f.sourceId,
        ownerId: null,
        barcode: f.barcode ?? null,
        name: f.name,
        brand: f.brand ?? null,
        servingG: f.servingG ?? null,
        servingLabel: f.servingLabel ?? null,
        kcal: f.kcal,
        proteinG: f.proteinG,
        carbsG: f.carbsG,
        fatG: f.fatG,
        fiberG: f.fiberG ?? null,
        sugarG: f.sugarG ?? null,
        sodiumMg: f.sodiumMg ?? null,
        micros: f.micros ?? {},
      })),
    )
    .onConflictDoUpdate({
      target: [foods.source, foods.sourceId],
      set: {
        name: sql`excluded.name`,
        brand: sql`excluded.brand`,
        barcode: sql`excluded.barcode`,
        servingG: sql`excluded.serving_g`,
        servingLabel: sql`excluded.serving_label`,
        kcal: sql`excluded.kcal`,
        proteinG: sql`excluded.protein_g`,
        carbsG: sql`excluded.carbs_g`,
        fatG: sql`excluded.fat_g`,
        fiberG: sql`excluded.fiber_g`,
        sugarG: sql`excluded.sugar_g`,
        sodiumMg: sql`excluded.sodium_mg`,
        micros: sql`excluded.micros`,
        fetchedAt: sql`now()`,
      },
    })
    .returning(summaryColumns);
}

export async function searchCachedFoods(userId: string, query: string, limit = 20): Promise<FoodSummary[]> {
  const pattern = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  return db
    .select(summaryColumns)
    .from(foods)
    .where(and(visibleTo(userId), or(ilike(foods.name, pattern), ilike(foods.brand, pattern))))
    // The user's own foods first, then the built-in everyday foods, then shorter (more generic) names.
    .orderBy(sql`(${foods.ownerId} is null)`, sql`(${foods.source} <> 'common')`, sql`length(${foods.name})`)
    .limit(limit);
}

/** The built-in list of everyday foods, for browsing before anything is typed. */
export async function listCommonFoods(): Promise<FoodSummary[]> {
  return db.select(summaryColumns).from(foods).where(eq(foods.source, "common")).orderBy(foods.category, foods.name);
}

/** Records the household measures looked up for a shared catalogue food. */
export async function savePortions(foodId: string, portions: FoodPortion[]): Promise<void> {
  await db.update(foods).set({ portions }).where(and(eq(foods.id, foodId), isNull(foods.ownerId)));
}

export async function findCachedByBarcode(barcode: string): Promise<FoodSummary | null> {
  const [row] = await db
    .select(summaryColumns)
    .from(foods)
    .where(and(eq(foods.barcode, barcode), isNull(foods.ownerId)))
    .limit(1);
  return row ?? null;
}

export async function getFood(userId: string, foodId: string): Promise<Food | null> {
  const [row] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.id, foodId), visibleTo(userId)))
    .limit(1);
  return row ?? null;
}

export type CustomFoodInput = {
  name: string;
  brand: string | null;
  servingG: number | null;
  servingLabel: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
};

export async function createCustomFood(userId: string, input: CustomFoodInput): Promise<FoodSummary> {
  const [row] = await db
    .insert(foods)
    .values({ ...input, source: "custom", sourceId: crypto.randomUUID(), ownerId: userId, micros: {} })
    .returning(summaryColumns);
  if (!row) throw new Error("Could not save food");
  return row;
}

export async function listCustomFoods(userId: string): Promise<FoodSummary[]> {
  return db
    .select(summaryColumns)
    .from(foods)
    .where(and(eq(foods.source, "custom"), eq(foods.ownerId, userId)))
    .orderBy(foods.name);
}

export async function deleteCustomFood(userId: string, foodId: string): Promise<void> {
  await db.delete(foods).where(and(eq(foods.id, foodId), eq(foods.source, "custom"), eq(foods.ownerId, userId)));
}

export type QuickFood = FoodSummary & { lastQuantityG: number; lastMeal: string; timesLogged: number };

/**
 * Foods this user has logged, for one-tap re-logging. `order` picks between
 * most recent and most frequent. Each comes back with the quantity used last
 * time so a repeat item needs no typing at all.
 */
export async function quickFoods(userId: string, order: "recent" | "frequent", limit = 30): Promise<QuickFood[]> {
  const stats = db
    .select({
      foodId: foodLogs.foodId,
      timesLogged: sql<number>`count(*)::int`.as("times_logged"),
      lastLoggedAt: sql<Date>`max(${foodLogs.loggedAt})`.as("last_logged_at"),
    })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), sql`${foodLogs.foodId} is not null`))
    .groupBy(foodLogs.foodId)
    .as("stats");

  const rows = await db
    .select({ ...summaryColumns, timesLogged: stats.timesLogged, lastLoggedAt: stats.lastLoggedAt })
    .from(stats)
    .innerJoin(foods, eq(foods.id, stats.foodId))
    .where(visibleTo(userId))
    .orderBy(order === "recent" ? desc(stats.lastLoggedAt) : desc(stats.timesLogged), desc(stats.lastLoggedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  // The quantity and meal used the last time each food was logged.
  const last = await db
    .selectDistinctOn([foodLogs.foodId], {
      foodId: foodLogs.foodId,
      quantityG: foodLogs.quantityG,
      meal: foodLogs.meal,
    })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), inArray(foodLogs.foodId, rows.map((r) => r.id))))
    .orderBy(foodLogs.foodId, desc(foodLogs.loggedAt));
  const lastById = new Map(last.map((l) => [l.foodId, l]));

  return rows.map(({ lastLoggedAt: _ignored, ...r }) => {
    void _ignored;
    const l = lastById.get(r.id);
    return { ...r, lastQuantityG: l?.quantityG ?? r.servingG ?? 100, lastMeal: l?.meal ?? "snack" };
  });
}
