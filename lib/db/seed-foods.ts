import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Database } from "./connect";
import { foods, type FoodPortion } from "./schema";

type CommonFood = {
  id: string;
  name: string;
  category: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  micros: Record<string, number>;
  portions: FoodPortion[];
};

/**
 * Loads the built-in list of everyday foods. Nutrients and household measures
 * come from USDA FoodData Central (SR Legacy, public domain); the friendly
 * names and the choice of default serving are ours. Rebuild the file with
 * scripts/build-common-foods.mjs. Safe to run repeatedly.
 */
export async function seedCommonFoods(db: Database): Promise<number> {
  const file = path.join(process.cwd(), "lib/db/seed-data/common-foods.json");
  const common = JSON.parse(readFileSync(file, "utf8")) as CommonFood[];
  await db
    .insert(foods)
    .values(
      common.map((f) => ({
        source: "common" as const,
        sourceId: f.id,
        name: f.name,
        category: f.category,
        portions: f.portions,
        servingG: f.portions[0]?.grams ?? null,
        servingLabel: f.portions[0]?.label ?? null,
        kcal: f.kcal,
        proteinG: f.proteinG,
        carbsG: f.carbsG,
        fatG: f.fatG,
        fiberG: f.fiberG,
        sugarG: f.sugarG,
        sodiumMg: f.sodiumMg,
        micros: f.micros,
      })),
    )
    .onConflictDoUpdate({
      target: [foods.source, foods.sourceId],
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        portions: sql`excluded.portions`,
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
      },
    });
  return common.length;
}
