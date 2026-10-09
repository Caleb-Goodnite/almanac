import { describe, expect, it } from "vitest";
import type { DayTotals } from "@/lib/data/food-logs";
import { nutritionInsights } from "./nutrition";

const target = { calories: 2300, proteinG: 160, fiberG: 32 };

function day(i: number, kcal: number, proteinG: number, fiberG = 30): DayTotals {
  return { date: `2026-10-0${i + 1}`, entries: 4, kcal, proteinG, carbsG: 250, fatG: 70, fiberG, sugarG: 40, sodiumMg: 2000 };
}

describe("nutrition insights", () => {
  it("says so when there is no data", () => {
    const out = nutritionInsights([], target, 7, { neutral: false });
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toMatch(/Nothing logged/);
  });

  it("refuses to conclude anything from fewer than four days", () => {
    const out = nutritionInsights([day(0, 900, 20), day(1, 950, 25)], target, 7, { neutral: false });
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toMatch(/too few/);
  });

  it("quotes the user's actual protein average and target", () => {
    const days = [0, 1, 2, 3, 4].map((i) => day(i, 2300, 94));
    const out = nutritionInsights(days, target, 7, { neutral: false });
    expect(out.some((i) => /Protein averaged 94 g against a 160 g target/.test(i.text))).toBe(true);
    expect(out.some((i) => /within a few percent/.test(i.text))).toBe(true);
  });

  it("never frames under-eating as a win for teens or support mode", () => {
    const days = [0, 1, 2, 3, 4].map((i) => day(i, 1500, 150));
    const adult = nutritionInsights(days, target, 7, { neutral: false }).map((i) => i.text).join(" ");
    const teen = nutritionInsights(days, target, 7, { neutral: true }).map((i) => i.text).join(" ");
    expect(adult).toMatch(/below your 2,300 target/);
    expect(teen).toMatch(/Eating enough matters more/);
    expect(teen).not.toMatch(/Going well|great/i);
  });
});
