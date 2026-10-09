import "server-only";
import { z } from "zod";
import { tidyName, type FoodInput } from "./types";

/**
 * Open Food Facts product lookup by barcode.
 * Data is licensed under the Open Database License (ODbL); the UI credits
 * Open Food Facts wherever one of its products is shown.
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

const num = z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().finite()).optional();

const productSchema = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional(),
      brands: z.string().optional(),
      serving_size: z.string().optional(),
      serving_quantity: num,
      nutriments: z
        .object({
          "energy-kcal_100g": num,
          energy_100g: num,
          proteins_100g: num,
          carbohydrates_100g: num,
          fat_100g: num,
          fiber_100g: num,
          sugars_100g: num,
          sodium_100g: num,
          "saturated-fat_100g": num,
        })
        .partial()
        .optional(),
    })
    .optional(),
});

export async function findOffByBarcode(barcode: string): Promise<FoodInput | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Almanac/0.1 (health tracker; contact via app owner)" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts lookup failed: ${res.status}`);

  const parsed = productSchema.safeParse(await res.json());
  if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) return null;
  const p = parsed.data.product;
  const n = p.nutriments ?? {};
  const name = p.product_name?.trim();
  if (!name) return null;

  const protein = n.proteins_100g ?? 0;
  const carbs = n.carbohydrates_100g ?? 0;
  const fat = n.fat_100g ?? 0;
  // energy_100g is in kJ; 1 kcal = 4.184 kJ.
  const kcal = n["energy-kcal_100g"] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null);
  if (kcal == null || kcal < 0 || kcal > 950) return null;

  const micros: Record<string, number> = {};
  if (n["saturated-fat_100g"]) micros.saturatedFatG = n["saturated-fat_100g"];

  return {
    source: "off",
    sourceId: barcode,
    barcode,
    name: tidyName(name),
    brand: p.brands ? tidyName(p.brands.split(",")[0] ?? "", 80) : null,
    servingG: p.serving_quantity && p.serving_quantity > 0 ? p.serving_quantity : null,
    servingLabel: p.serving_size ? tidyName(p.serving_size, 60) : null,
    kcal,
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
    fiberG: n.fiber_100g ?? null,
    sugarG: n.sugars_100g ?? null,
    // Open Food Facts reports sodium in grams.
    sodiumMg: n.sodium_100g != null ? n.sodium_100g * 1000 : null,
    micros,
  };
}
