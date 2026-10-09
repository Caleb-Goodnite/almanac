import type { DayTotals } from "@/lib/data/food-logs";
import { fmt } from "@/lib/format";
import { mean } from "@/lib/science/trend";

export type Insight = { tone: "good" | "note" | "neutral"; text: string };

type TargetLike = { calories: number; proteinG: number; fiberG: number };

/**
 * Plain-language observations about a stretch of logged days. Deterministic
 * and conservative: with too few days it says so instead of drawing a
 * conclusion, and for teens or support mode it never frames eating less as
 * the goal.
 */
export function nutritionInsights(
  days: readonly DayTotals[],
  target: TargetLike,
  windowDays: number,
  options: { neutral: boolean },
): Insight[] {
  const out: Insight[] = [];
  const n = days.length;

  if (n === 0) {
    return [{ tone: "neutral", text: `Nothing logged in the last ${windowDays} days yet. Log a few days and patterns will show up here.` }];
  }
  if (n < 4) {
    out.push({
      tone: "neutral",
      text: `Only ${n} of the last ${windowDays} days ${n === 1 ? "has" : "have"} food logged, which is too few to draw conclusions from. Log a few more days and this will say something useful.`,
    });
    return out;
  }

  const kcal = mean(days.map((d) => d.kcal)) ?? 0;
  const protein = mean(days.map((d) => d.proteinG)) ?? 0;
  const fiber = mean(days.map((d) => d.fiberG)) ?? 0;

  const proteinRatio = protein / target.proteinG;
  if (proteinRatio < 0.8) {
    out.push({
      tone: "note",
      text: `Protein averaged ${fmt(protein)} g against a ${fmt(target.proteinG)} g target. Closing about half of that gap, roughly ${fmt((target.proteinG - protein) / 2)} g more a day, is the change most likely to help.`,
    });
  } else if (proteinRatio <= 1.25) {
    out.push({ tone: "good", text: `Protein averaged ${fmt(protein)} g, right around your ${fmt(target.proteinG)} g target.` });
  }

  const diff = kcal - target.calories;
  const pct = Math.abs(diff) / target.calories;
  {
    if (pct <= 0.07) {
      out.push({ tone: "good", text: `Calories averaged ${fmt(kcal)} a day, within a few percent of your ${fmt(target.calories)} target.` });
    } else if (diff > 0) {
      out.push({
        tone: "note",
        text: `Calories averaged ${fmt(kcal)} a day, about ${fmt(diff)} above your ${fmt(target.calories)} target.`,
      });
    } else {
      out.push({
        tone: "note",
        text: options.neutral
          ? `Calories averaged ${fmt(kcal)} a day, about ${fmt(-diff)} below what you need. Eating enough matters more than hitting a low number.`
          : `Calories averaged ${fmt(kcal)} a day, about ${fmt(-diff)} below your ${fmt(target.calories)} target. If that was not deliberate, check whether some meals went unlogged.`,
      });
    }
  }

  if (fiber < target.fiberG * 0.6) {
    out.push({
      tone: "note",
      text: `Fiber averaged ${fmt(fiber)} g against a ${fmt(target.fiberG)} g guideline. Fruit, vegetables, beans and whole grains raise it quickly.`,
    });
  }

  return out;
}
