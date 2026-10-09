import { z } from "zod";

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
export const mealSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const grams = z.coerce.number().positive("Enter an amount").max(5000, "That amount looks too large");
const per100 = (max: number) => z.coerce.number().min(0).max(max);
const optional100 = (max: number) =>
  z.union([z.literal(""), z.null(), z.undefined(), z.coerce.number().min(0).max(max)]).transform((v) => (v === "" || v == null ? null : v));

export const logFoodSchema = z.object({
  clientId: z.uuid(),
  date: dateSchema,
  meal: mealSchema,
  foodId: z.uuid(),
  quantityG: grams,
});

export const quickAddSchema = z.object({
  clientId: z.uuid(),
  date: dateSchema,
  meal: mealSchema,
  name: z.string().trim().min(1, "Give it a name").max(80),
  kcal: z.coerce.number().min(0).max(5000),
  proteinG: z.coerce.number().min(0).max(500).default(0),
  carbsG: z.coerce.number().min(0).max(1000).default(0),
  fatG: z.coerce.number().min(0).max(500).default(0),
});

export const customFoodSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(120),
  brand: z.string().trim().max(80).transform((v) => v || null).nullable().default(null),
  servingG: optional100(5000),
  servingLabel: z.string().trim().max(60).transform((v) => v || null).nullable().default(null),
  kcal: per100(950),
  proteinG: per100(100),
  carbsG: per100(100),
  fatG: per100(100),
  fiberG: optional100(100),
  sugarG: optional100(100),
  sodiumMg: optional100(40000),
});

export const searchQuerySchema = z.string().trim().min(2).max(80);
export const barcodeSchema = z.string().regex(/^\d{8,14}$/, "Not a barcode");
export const waterSchema = z.object({ date: dateSchema, ml: z.coerce.number().int().min(50).max(2000) });
