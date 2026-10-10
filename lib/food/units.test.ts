import { describe, expect, it } from "vitest";
import { GRAMS_PER_OZ, parsePortion, startingAmount, typicalServing, unitsFor } from "./units";

const banana = {
  servingG: 118,
  servingLabel: "1 medium",
  portions: [
    { label: "1 medium (7\" to 7-7/8\" long)", grams: 118 },
    { label: "1 cup, sliced", grams: 150 },
    { label: "1 large", grams: 136 },
  ],
};
const chicken = { servingG: 85, servingLabel: "3 oz", portions: [{ label: "3 oz", grams: 85 }] };
const milk = { servingG: 244, servingLabel: "1 cup", portions: [{ label: "1 cup", grams: 244 }, { label: "1 fl oz", grams: 30.5 }] };
const plain = { servingG: null, servingLabel: null, portions: null };

describe("food units", () => {
  it("splits a portion label into a count and a unit", () => {
    expect(parsePortion({ label: "0.5 breast, skin removed", grams: 86 })).toEqual({ count: 0.5, unit: "breast, skin removed", gramsEach: 172 });
    expect(parsePortion({ label: "10 fries", grams: 76 })).toMatchObject({ count: 10, unit: "fries", gramsEach: 7.6 });
    expect(parsePortion({ label: "serving", grams: 30 })).toMatchObject({ count: 1, unit: "serving" });
  });

  it("offers a food's own measures first, then weight, then volume from its cup weight", () => {
    const units = unitsFor(banana);
    expect(units.map((u) => u.label)).toEqual([
      "medium (7\" to 7-7/8\" long)",
      "cup, sliced",
      "large",
      "grams",
      "oz",
      "lb",
      "cups",
      "tbsp",
      "tsp",
      "fl oz",
      "ml",
    ]);
    // A tablespoon is a sixteenth of the food's own cup weight.
    expect(units.find((u) => u.label === "tbsp")!.grams).toBeCloseTo(150 / 16, 1);
  });

  it("does not repeat a volume the source already lists exactly, and never guesses volume", () => {
    expect(unitsFor(milk).filter((u) => u.group === "volume").map((u) => u.label)).toEqual(["tbsp", "tsp", "ml"]);
    expect(unitsFor(plain).map((u) => u.id)).toEqual(["g", "oz", "lb"]);
    expect(unitsFor(chicken).some((u) => u.group === "volume")).toBe(false);
  });

  it("starts a new food at its typical serving", () => {
    expect(startingAmount(unitsFor(banana), null)).toEqual({ unitId: "m0", amount: 1 });
    expect(startingAmount(unitsFor(chicken), null)).toEqual({ unitId: "oz", amount: 3 });
    expect(startingAmount(unitsFor(plain), null)).toEqual({ unitId: "g", amount: 100 });
  });

  it("reopens a repeat in the unit that expresses it cleanly, else grams", () => {
    expect(startingAmount(unitsFor(banana), 236)).toEqual({ unitId: "m0", amount: 2 });
    expect(startingAmount(unitsFor(banana), 75)).toEqual({ unitId: "m1", amount: 0.5 });
    expect(startingAmount(unitsFor(banana), 97)).toEqual({ unitId: "g", amount: 97 });
  });

  it("uses exact ounce and pound weights", () => {
    const units = unitsFor(plain);
    expect(units.find((u) => u.id === "oz")!.grams).toBe(GRAMS_PER_OZ);
    expect(units.find((u) => u.id === "lb")!.grams / GRAMS_PER_OZ).toBeCloseTo(16, 3);
  });

  it("summarises the typical serving for a list row", () => {
    expect(typicalServing(banana)).toEqual({ grams: 118, label: "medium (7\" to 7-7/8\" long)" });
    expect(typicalServing(plain)).toBeNull();
  });
});
