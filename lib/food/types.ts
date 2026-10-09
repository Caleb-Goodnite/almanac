/** A food normalised from any source. All nutrients are per 100 g (or 100 ml). */
export type FoodInput = {
  source: "usda" | "off" | "custom";
  sourceId: string;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  servingG?: number | null;
  servingLabel?: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
  micros?: Record<string, number>;
};

/** Label and unit for each micronutrient key stored in `foods.micros`. */
export const MICRO_LABELS: Record<string, { label: string; unit: string }> = {
  saturatedFatG: { label: "Saturated fat", unit: "g" },
  cholesterolMg: { label: "Cholesterol", unit: "mg" },
  calciumMg: { label: "Calcium", unit: "mg" },
  ironMg: { label: "Iron", unit: "mg" },
  potassiumMg: { label: "Potassium", unit: "mg" },
  magnesiumMg: { label: "Magnesium", unit: "mg" },
  zincMg: { label: "Zinc", unit: "mg" },
  vitaminCMg: { label: "Vitamin C", unit: "mg" },
  vitaminDUg: { label: "Vitamin D", unit: "µg" },
  vitaminAUg: { label: "Vitamin A", unit: "µg" },
  vitaminB12Ug: { label: "Vitamin B12", unit: "µg" },
};

/**
 * Tidies names from food databases, which are often in capitals
 * ("GREEK YOGURT"). Text is user-visible data only; it is never interpreted.
 */
export function tidyName(raw: string, max = 120): string {
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  if (s.length > 3 && s === s.toUpperCase()) {
    return s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
  }
  return s;
}

export function isBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value);
}
