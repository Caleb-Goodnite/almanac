import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { tidyName, type FoodInput } from "./types";

/** USDA FoodData Central. Data is public domain (CC0). https://fdc.nal.usda.gov/api-guide */

const BASE = "https://api.nal.usda.gov/fdc/v1";

const nutrientSchema = z.object({
  nutrientId: z.number(),
  value: z.number().optional(),
});

const foodSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  dataType: z.string().optional(),
  gtinUpc: z.string().optional(),
  brandOwner: z.string().optional(),
  brandName: z.string().optional(),
  servingSize: z.number().optional(),
  servingSizeUnit: z.string().optional(),
  householdServingFullText: z.string().optional(),
  foodNutrients: z.array(nutrientSchema).default([]),
});

const searchSchema = z.object({ foods: z.array(foodSchema).default([]) });

// FoodData Central nutrient ids. Search results report values per 100 g.
const ID = {
  kcal: [1008, 2047, 2048],
  protein: [1003],
  fat: [1004],
  carbs: [1005],
  fiber: [1079, 2033],
  sugar: [2000, 1063],
  sodium: [1093],
} as const;

const MICRO_IDS: Record<number, string> = {
  1258: "saturatedFatG",
  1253: "cholesterolMg",
  1087: "calciumMg",
  1089: "ironMg",
  1092: "potassiumMg",
  1090: "magnesiumMg",
  1095: "zincMg",
  1162: "vitaminCMg",
  1114: "vitaminDUg",
  1106: "vitaminAUg",
  1178: "vitaminB12Ug",
};

function normalise(food: z.infer<typeof foodSchema>): FoodInput | null {
  const byId = new Map(food.foodNutrients.map((n) => [n.nutrientId, n.value]));
  const pick = (ids: readonly number[]) => {
    for (const id of ids) {
      const v = byId.get(id);
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return null;
  };

  const protein = pick(ID.protein) ?? 0;
  const fat = pick(ID.fat) ?? 0;
  const carbs = pick(ID.carbs) ?? 0;
  // Some Foundation foods omit energy; fall back to the 4-4-9 Atwater factors.
  const kcal = pick(ID.kcal) ?? protein * 4 + carbs * 4 + fat * 9;
  if (!(kcal >= 0) || kcal > 950) return null;

  const micros: Record<string, number> = {};
  for (const [id, key] of Object.entries(MICRO_IDS)) {
    const v = byId.get(Number(id));
    if (typeof v === "number" && Number.isFinite(v) && v > 0) micros[key] = v;
  }

  const unit = food.servingSizeUnit?.toLowerCase();
  const servingG = food.servingSize && (unit === "g" || unit === "ml" || unit === "grm" || unit === "mlt") ? food.servingSize : null;
  const brand = food.brandName || food.brandOwner;

  return {
    source: "usda",
    sourceId: String(food.fdcId),
    barcode: food.gtinUpc ? food.gtinUpc.replace(/\D/g, "") || null : null,
    name: tidyName(food.description),
    brand: brand ? tidyName(brand, 80) : null,
    servingG,
    servingLabel: food.householdServingFullText ? tidyName(food.householdServingFullText, 60).toLowerCase() : null,
    kcal,
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
    fiberG: pick(ID.fiber),
    sugarG: pick(ID.sugar),
    sodiumMg: pick(ID.sodium),
    micros,
  };
}

async function search(query: string, dataType: string, pageSize: number, signal: AbortSignal): Promise<FoodInput[]> {
  const url = new URL(`${BASE}/foods/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("dataType", dataType);
  url.searchParams.set("pageSize", String(pageSize));
  // Without this, "rolled oats" matches anything containing "rolls" or "oat".
  url.searchParams.set("requireAllWords", "true");
  url.searchParams.set("api_key", env.USDA_API_KEY);
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`USDA search failed: ${res.status}`);
  const parsed = searchSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("USDA search returned an unexpected shape");
  return parsed.data.foods.map(normalise).filter((f): f is FoodInput => f !== null);
}

/** Generic foods first (Foundation, SR Legacy), then branded products. */
export async function searchUsda(query: string): Promise<FoodInput[]> {
  const signal = AbortSignal.timeout(6000);
  const [generic, branded] = await Promise.allSettled([
    search(query, "Foundation,SR Legacy", 10, signal),
    search(query, "Branded", 12, signal),
  ]);
  if (generic.status === "rejected" && branded.status === "rejected") throw generic.reason;
  return [
    ...(generic.status === "fulfilled" ? generic.value : []),
    ...(branded.status === "fulfilled" ? branded.value : []),
  ];
}

export async function findUsdaByBarcode(barcode: string): Promise<FoodInput | null> {
  const results = await search(barcode, "Branded", 3, AbortSignal.timeout(6000));
  const digits = barcode.replace(/^0+/, "");
  return results.find((f) => f.barcode && f.barcode.replace(/^0+/, "") === digits) ?? null;
}

const portionSchema = z.object({
  foodPortions: z
    .array(
      z.object({
        amount: z.number().optional(),
        modifier: z.string().optional(),
        portionDescription: z.string().optional(),
        measureUnit: z.object({ name: z.string().optional() }).optional(),
        gramWeight: z.number().optional(),
        sequenceNumber: z.number().optional(),
      }),
    )
    .default([]),
});

/**
 * Household measures for one USDA food ("1 cup, sliced" = 150 g). Search
 * results do not carry these, so they are fetched once when a food is first
 * opened and then kept. Branded products have none; their label serving is
 * already on the food.
 */
export async function fetchUsdaPortions(fdcId: string): Promise<{ label: string; grams: number }[]> {
  const url = new URL(`${BASE}/food/${encodeURIComponent(fdcId)}`);
  url.searchParams.set("api_key", env.USDA_API_KEY);
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!res.ok) throw new Error(`USDA food lookup failed: ${res.status}`);
  const parsed = portionSchema.safeParse(await res.json());
  if (!parsed.success) return [];

  const seen = new Set<string>();
  return parsed.data.foodPortions
    .slice()
    .sort((a, b) => (a.sequenceNumber ?? 99) - (b.sequenceNumber ?? 99))
    .flatMap((p) => {
      const unitName = p.measureUnit?.name && p.measureUnit.name !== "undetermined" ? p.measureUnit.name : "";
      let text = tidyName(p.modifier || p.portionDescription || unitName || "", 60);
      const grams = p.gramWeight ?? 0;
      if (!text || !(grams > 0) || grams > 2000) return [];
      text = text
        .replace(/^each /i, "")
        .replace(/, NS as to .*$/i, "")
        .replace(/NLEA serving/i, "standard serving")
        .replace(/\btablespoons?\b/gi, "tbsp")
        .replace(/\bteaspoons?\b/gi, "tsp");
      const label = /^\d/.test(text) ? text : `${p.amount && p.amount !== 1 ? p.amount : 1} ${text}`;
      if (seen.has(label)) return [];
      seen.add(label);
      return [{ label, grams: Math.round(grams * 10) / 10 }];
    })
    .slice(0, 10);
}
