import type { Snapshot } from "@/lib/data/snapshot";
import { fmt, fmtDuration } from "@/lib/format";
import { MUSCLE_LABELS } from "@/lib/science/volume";
import type { Review } from "./review";

/**
 * A rule-based weekly review built from the snapshot. It is what the dashboard
 * shows when the AI coach is unavailable, over budget, or not configured, and
 * it is the baseline the AI version has to be at least as careful as.
 *
 * Rules of the house: quote the user's own numbers, name at most three things
 * each way, give exactly one thing to change, and say plainly when there is
 * not enough data to say anything.
 */
export function weeklyReview(s: Snapshot): Review {
  const t = s.targets;
  const neutral = s.ageBand === "teen" || s.supportMode;
  const wins: string[] = [];
  const slips: string[] = [];
  type Focus = { priority: number; action: string; why: string };
  const candidates: Focus[] = [];

  if (!t || s.logging.daysLogged7 < 3) {
    return {
      headline: "Not enough logged this week to review yet.",
      wins: [],
      slips: [],
      focus: {
        action: "Log something on three more days this week, even if it is just one meal.",
        why: "A review needs a few days to compare. Rough entries are far more useful than none.",
      },
      dataNote: `You logged on ${s.logging.daysLogged7} of the last 7 days.`,
    };
  }

  const n = s.nutrition;
  const enoughFood = n.loggedDays7 >= 4;

  // Safety comes first and overrides everything else.
  if (s.weight.tooFast && s.weight.pctPerWeek != null) {
    slips.push(`Your weight trend is falling about ${fmt(Math.abs(s.weight.pctPerWeek), 1)}% a week, which is faster than is safe to keep up.`);
    candidates.push({
      priority: 100,
      action: "Eat a little more each day, around 200 to 300 kcal, until the trend slows.",
      why: "Losing this fast costs muscle, energy and sleep, and is the pattern most likely to rebound.",
    });
  }

  if (enoughFood && n.avg7.proteinG != null) {
    const ratio = n.avg7.proteinG / t.proteinG;
    if (ratio >= 0.9) wins.push(`Protein averaged ${fmt(n.avg7.proteinG)} g against a ${fmt(t.proteinG)} g target.`);
    else if (ratio < 0.8) {
      slips.push(`Protein averaged ${fmt(n.avg7.proteinG)} g against a ${fmt(t.proteinG)} g target.`);
      candidates.push({
        priority: 60,
        action: `Add about ${fmt(Math.min(40, (t.proteinG - n.avg7.proteinG) / 2))} g of protein a day, for example one extra serving at breakfast.`,
        why: "Protein is what lets training turn into muscle, and it is the gap furthest from your target.",
      });
    }
  }

  if (enoughFood && n.avg7.kcal != null) {
    const diff = n.avg7.kcal - t.calories;
    const pct = diff / t.calories;
    if (Math.abs(pct) <= 0.07) wins.push(`Calories averaged ${fmt(n.avg7.kcal)}, within a few percent of your ${fmt(t.calories)} target.`);
    else if (pct < -0.15 && neutral) {
      slips.push(`Calories averaged ${fmt(n.avg7.kcal)}, well under the ${fmt(t.calories)} your body needs.`);
      candidates.push({
        priority: 90,
        action: "Add a proper snack or a bigger breakfast each day.",
        why: "Eating enough is what fuels growth, mood and training. Under-eating works against all three.",
      });
    } else if (pct > 0.12 && !neutral && s.goal === "lose_fat") {
      slips.push(`Calories averaged ${fmt(n.avg7.kcal)}, about ${fmt(diff)} above your ${fmt(t.calories)} target.`);
      candidates.push({
        priority: 40,
        action: "Pick the one meal that runs highest and trim it a little, rather than cutting everywhere.",
        why: "One steady change is easier to keep than a strict week followed by a blowout.",
      });
    }
  }

  if (s.sleep.nights7 >= 3 && s.sleep.avg7Min != null) {
    if (s.sleep.avg7Min >= t.sleepMinMinutes) wins.push(`Sleep averaged ${fmtDuration(s.sleep.avg7Min)} a night.`);
    else if (s.sleep.avg7Min < t.sleepMinMinutes - 30) {
      slips.push(`Sleep averaged ${fmtDuration(s.sleep.avg7Min)}, short of the ${fmtDuration(t.sleepMinMinutes)} minimum for your age.`);
      candidates.push({
        priority: 70,
        action: "Bring bedtime forward by 30 minutes this week.",
        why: "Short sleep undercuts recovery, appetite control and mood, which makes every other goal harder.",
      });
    }
  }

  if (s.resistanceTraining) {
    const trained = s.training.volume7.filter((v) => v.sets > 0);
    const inRange = trained.filter((v) => v.status === "within");
    if (s.training.sessions7 === 0) {
      slips.push("No strength sessions were logged this week.");
      candidates.push({
        priority: 50,
        action: "Fit in one short strength session, even 20 minutes.",
        why: "One session keeps the habit alive and is enough to hold on to what you have built.",
      });
    } else {
      wins.push(
        `${s.training.sessions7} strength ${s.training.sessions7 === 1 ? "session" : "sessions"}` +
          (inRange.length > 0 ? `, with ${inRange.map((v) => MUSCLE_LABELS[v.group].toLowerCase()).slice(0, 3).join(", ")} in the 10 to 20 set range.` : "."),
      );
    }
  }
  if (s.training.records30.length > 0 && wins.length < 3) {
    wins.push(`A new best on ${s.training.records30[0]!.exerciseName}.`);
  }

  if (enoughFood && n.avg7.fiberG != null && n.avg7.fiberG < t.fiberG * 0.6) {
    slips.push(`Fiber averaged ${fmt(n.avg7.fiberG)} g against a ${fmt(t.fiberG)} g guideline.`);
    candidates.push({
      priority: 20,
      action: "Add one serving of fruit, vegetables or beans to a meal you already eat.",
      why: "Fiber helps with fullness and digestion, and most people get well under the guideline.",
    });
  }

  if (s.logging.daysLogged7 >= 6 && wins.length < 3) wins.push(`You logged on ${s.logging.daysLogged7} of 7 days.`);

  candidates.sort((a, b) => b.priority - a.priority);
  const top = candidates[0];

  const headline =
    slips.length === 0
      ? "A steady week. Nothing needs fixing."
      : wins.length >= slips.length
        ? "A good week, with one thing worth adjusting."
        : "A mixed week. One change would help most.";

  return {
    headline,
    wins: wins.slice(0, 3),
    slips: slips.slice(0, 3),
    focus: top
      ? { action: top.action, why: top.why }
      : { action: "Keep doing what you are doing.", why: "Your numbers are on target, and consistency is what makes them count." },
    dataNote: enoughFood ? null : `Food was logged on only ${n.loggedDays7} of 7 days, so the nutrition numbers are not reviewed.`,
  };
}
