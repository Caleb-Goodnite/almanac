/**
 * Ways to say how much of a food was eaten. Everything is stored in grams;
 * these are the units offered for entering it. Pure, and safe to use in the
 * browser.
 */
export type Portion = { label: string; grams: number };

export type Unit = {
  id: string;
  label: string;
  /** Grams in one of this unit. */
  grams: number;
  group: "measure" | "weight" | "volume";
  /** A sensible starting amount, e.g. 3 for "3 oz" or 0.5 for "half a breast". */
  typical: number;
};

export const GRAMS_PER_OZ = 28.3495;
export const GRAMS_PER_LB = 453.592;

const ML: Record<string, number> = { cup: 236.588, tbsp: 14.787, tsp: 4.929, "fl oz": 29.574, ml: 1 };
const VOLUME_LABEL: Record<string, string> = { cup: "cups", tbsp: "tbsp", tsp: "tsp", "fl oz": "fl oz", ml: "ml" };

/** Splits "0.5 breast, skin removed" into a count and what is being counted. */
export function parsePortion(portion: Portion): { count: number; unit: string; gramsEach: number } {
  const match = /^(\d+(?:\.\d+)?)\s+(.+)$/.exec(portion.label.trim());
  const count = match ? Number(match[1]) : 1;
  const unit = (match?.[2] ?? portion.label).trim();
  return count > 0 ? { count, unit, gramsEach: portion.grams / count } : { count: 1, unit, gramsEach: portion.grams };
}

function volumeKey(unit: string): string | null {
  const m = /^(cup|tbsp|tsp|fl oz|ml)\b/i.exec(unit);
  return m ? m[1]!.toLowerCase() : null;
}

type FoodForUnits = { servingG: number | null; servingLabel: string | null; portions: Portion[] | null };

/**
 * Every unit a food can be entered in, the most natural first: its own
 * household measures (a medium banana, a slice, a cup), then weight, then
 * kitchen volumes worked out from the food's own cup or spoon weight when the
 * source gives one. Volume is never guessed for a food with no such measure.
 */
export function unitsFor(food: FoodForUnits): Unit[] {
  const units: Unit[] = [];
  let weightTypical: { oz: number } | null = null;
  let density: { gramsPerMl: number; from: string } | null = null;
  const direct = new Set<string>();

  const portions = food.portions?.length
    ? food.portions
    : food.servingG && food.servingG > 0
      ? [{ label: food.servingLabel ?? "1 serving", grams: food.servingG }]
      : [];

  portions.forEach((portion, index) => {
    if (!(portion.grams > 0)) return;
    const { count, unit, gramsEach } = parsePortion(portion);
    // "3 oz" is a weight, not a measure of its own: remember it as the typical amount of ounces.
    if (/^oz\b/i.test(unit) && !/\(/.test(unit)) {
      weightTypical ??= { oz: count };
      return;
    }
    if (/^g(rams?)?$/i.test(unit)) return;
    const key = volumeKey(unit);
    if (key) {
      density ??= { gramsPerMl: gramsEach / ML[key]!, from: key };
      if (unit.toLowerCase() === key) direct.add(key);
    }
    units.push({ id: `m${index}`, label: unit, grams: gramsEach, group: "measure", typical: count });
  });

  const oz: number = (weightTypical as { oz: number } | null)?.oz ?? 1;
  units.push(
    { id: "g", label: "grams", grams: 1, group: "weight", typical: 100 },
    { id: "oz", label: "oz", grams: GRAMS_PER_OZ, group: "weight", typical: oz },
    { id: "lb", label: "lb", grams: GRAMS_PER_LB, group: "weight", typical: 1 },
  );

  const known = density as { gramsPerMl: number; from: string } | null;
  if (known) {
    for (const key of Object.keys(ML)) {
      if (direct.has(key)) continue;
      units.push({
        id: `v:${key}`,
        label: VOLUME_LABEL[key]!,
        grams: known.gramsPerMl * ML[key]!,
        group: "volume",
        typical: key === "ml" ? 100 : 1,
      });
    }
  }
  return units;
}

const NICE = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];

function isTidy(amount: number): boolean {
  if (amount <= 0 || amount > 50) return false;
  const whole = Math.floor(amount + 1e-6);
  const rest = amount - whole;
  return rest < 0.02 || rest > 0.98 || NICE.some((f) => Math.abs(rest - f) < 0.02);
}

export function tidy(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * What to show when the amount dialog opens. A food being logged for the
 * first time starts at its typical serving. A repeat starts at the amount
 * logged last time, shown in whichever unit expresses it cleanly.
 */
export function startingAmount(units: Unit[], lastGrams: number | null): { unitId: string; amount: number } {
  const first = units[0]!;
  if (lastGrams == null) {
    // A food whose only typical serving is a weight ("3 oz") opens in ounces.
    const ounces = units.find((u) => u.id === "oz");
    if (first.group === "weight" && ounces && ounces.typical !== 1) return { unitId: "oz", amount: ounces.typical };
    return { unitId: first.id, amount: first.typical };
  }
  for (const unit of units) {
    if (unit.group !== "measure") continue;
    const amount = lastGrams / unit.grams;
    if (isTidy(amount)) return { unitId: unit.id, amount: tidy(amount) };
  }
  return { unitId: "g", amount: Math.round(lastGrams * 10) / 10 };
}

/** "105 kcal per medium" style summary for a list row. */
export function typicalServing(food: FoodForUnits): { grams: number; label: string } | null {
  const first = food.portions?.[0] ?? (food.servingG ? { label: food.servingLabel ?? "serving", grams: food.servingG } : null);
  if (!first || !(first.grams > 0)) return null;
  return { grams: first.grams, label: first.label.replace(/^1\s+/, "") };
}
