import type { Snapshot } from "@/lib/data/snapshot";

/**
 * Turns the snapshot into the compact block of facts the coach is given.
 *
 * Data minimisation: no name, email, account id, birth date or exact age.
 * The only user-typed text included is a short list of food names, and those
 * are scrubbed and fenced off as data (see sanitizeLabel and the system
 * prompt). Everything else is a number the app computed.
 */

/** Makes a user-entered label safe to quote: no control characters, markup or instruction-like punctuation. */
export function sanitizeLabel(raw: string, max = 40): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f]/g, " ")
    .replace(/[<>{}\[\]`"\\|#*_~=:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

type ContextOptions = {
  frequentFoods: readonly string[];
  floorKcal: number;
  /**
   * Set when the person may be struggling with food or their body (support
   * mode, or a message the safety screen flagged). Calorie, macro and weight
   * figures are then left out altogether, so the coach cannot quote them.
   */
  careful?: boolean;
};

const MIN_DAYS_FOR_AVERAGE = 4;

type Verdict = { status: string; detail: string };

/**
 * Plain verdicts worked out in code. The model is told to take these as given
 * rather than judge the raw numbers itself: live evaluation showed a model
 * reading "3 to 6 sets against a 10 to 20 range" and calling it "in range".
 */
export function assess(s: Snapshot): Record<string, Verdict> {
  const out: Record<string, Verdict> = {};
  const t = s.targets;
  const n = s.nutrition;
  const teen = s.ageBand === "teen";

  if (n.loggedDays7 < MIN_DAYS_FOR_AVERAGE) {
    out.nutrition = {
      status: "too_little_data",
      detail: `Food was logged on ${n.loggedDays7} of the last 7 days. That is too few to judge intake; say so and ask for more logging. Do not quote averages.`,
    };
  } else if (t) {
    if (n.avg7.proteinG != null) {
      const pct = Math.round((n.avg7.proteinG / t.proteinG) * 100);
      const gap = t.proteinG - n.avg7.proteinG;
      out.protein =
        pct >= 90
          ? { status: "on_target", detail: `${n.avg7.proteinG} g average is ${pct}% of the ${t.proteinG} g target.` }
          : { status: pct < 70 ? "well_below_target" : "below_target", detail: `${n.avg7.proteinG} g average is ${pct}% of the ${t.proteinG} g target, ${gap} g a day short.` };
    }
    if (n.avg7.kcal != null) {
      const diff = n.avg7.kcal - t.calories;
      const pct = Math.round((Math.abs(diff) / t.calories) * 100);
      if (teen) {
        out.energy =
          diff < -0.1 * t.calories
            ? { status: "eating_less_than_needed", detail: "Average intake is clearly below what this person needs. Encourage eating more. Do not state the size of the gap in calories." }
            : { status: "eating_enough", detail: "Average intake is in line with what this person needs." };
      } else {
        out.calories =
          pct <= 7
            ? { status: "on_target", detail: `${n.avg7.kcal} kcal average is within ${pct}% of the ${t.calories} kcal target.` }
            : { status: diff > 0 ? "above_target" : "below_target", detail: `${n.avg7.kcal} kcal average is ${Math.abs(diff)} kcal ${diff > 0 ? "above" : "below"} the ${t.calories} kcal target (${pct}%).` };
      }
    }
  }

  if (t && s.sleep.nights7 >= 3 && s.sleep.avg7Min != null) {
    const short = t.sleepMinMinutes - s.sleep.avg7Min;
    out.sleep =
      short <= 0
        ? { status: "in_range", detail: `${(s.sleep.avg7Min / 60).toFixed(1)} h average is inside the ${t.sleepMinMinutes / 60} to ${t.sleepMaxMinutes / 60} h range.` }
        : { status: short >= 45 ? "short" : "slightly_short", detail: `${(s.sleep.avg7Min / 60).toFixed(1)} h average is ${short} minutes short of the ${t.sleepMinMinutes / 60} h minimum.` };
  } else {
    out.sleep = { status: "too_little_data", detail: `Sleep was logged on ${s.sleep.nights7} of the last 7 nights.` };
  }

  if (s.resistanceTraining) {
    const below = s.training.volume7.filter((v) => v.status === "below").map((v) => v.group);
    const none = s.training.volume7.filter((v) => v.status === "none").map((v) => v.group);
    const within = s.training.volume7.filter((v) => v.status === "within").map((v) => v.group);
    const above = s.training.volume7.filter((v) => v.status === "above").map((v) => v.group);
    const total = s.training.volume7.length;
    const status =
      s.training.sessions7 === 0
        ? "no_strength_training_this_week"
        : within.length >= total * 0.6
          ? "mostly_in_range"
          : within.length === 0
            ? "below_range_for_every_muscle"
            : "below_range_for_most_muscles";
    out.training_volume = {
      status,
      detail: `Target is 10 to 20 hard sets per muscle per week. In range: ${within.join(", ") || "none"}. Below 10 sets: ${below.join(", ") || "none"}. No sets: ${none.join(", ") || "none"}. Above 20: ${above.join(", ") || "none"}.`,
    };
  }

  if (t) {
    const target = t.activityMinutesPerWeek;
    const done = s.training.cardioMinutes7;
    out.activity = {
      status: done >= target ? "meets_guideline" : done >= target / 2 ? "below_guideline" : "well_below_guideline",
      detail: `${done} minutes of logged cardio and sport in the last 7 days against a guideline of ${target} a week${teen ? " (60 a day)" : ""}. Only logged sessions are counted, so everyday activity such as walking to school or work is missing; say so rather than treating this as the whole picture.`,
    };
  }

  if (!teen && !s.supportMode) {
    if (s.weight.weighIns28 < 6 || s.weight.slopeKgPerWeek == null) {
      out.weight_trend = { status: "too_little_data", detail: `${s.weight.weighIns28} weigh-ins in the last 28 days; at least 6 are needed for a trend.` };
    } else if (s.weight.tooFast) {
      out.weight_trend = { status: "losing_too_fast", detail: `Losing ${Math.abs(s.weight.pctPerWeek ?? 0)}% of bodyweight a week, faster than the safe limit. Raise this first.` };
    } else {
      const slope = s.weight.slopeKgPerWeek;
      out.weight_trend = {
        status: Math.abs(slope) < 0.1 ? "flat" : slope < 0 ? "losing_at_a_safe_rate" : "gaining",
        detail: `${slope > 0 ? "+" : ""}${slope} kg a week over the last 4 weeks.`,
      };
    }
  }
  return out;
}

export function buildCoachContext(s: Snapshot, options: ContextOptions): string {
  const t = s.targets;
  const a = s.adaptive;
  const teen = s.ageBand === "teen";
  const careful = Boolean(options.careful) || s.supportMode;
  const round = (n: number | null, d = 0) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
  const enough7 = s.nutrition.loggedDays7 >= MIN_DAYS_FOR_AVERAGE;
  const enough30 = s.nutrition.loggedDays30 >= MIN_DAYS_FOR_AVERAGE * 2;

  // Under-18s: averages without the calorie figure.
  const forAge = (avg: Snapshot["nutrition"]["avg7"]) => {
    if (!teen) return avg;
    const { kcal: _kcal, ...rest } = avg;
    return rest;
  };

  const assessments = assess(s);
  if (careful) {
    delete assessments.calories;
    delete assessments.protein;
    delete assessments.energy;
    delete assessments.weight_trend;
    delete assessments.nutrition;
  }

  const facts = {
    as_of: s.asOf,
    person: {
      // No digits for under-18s: models turned "13-17" into guesses at an exact age.
      age_band: teen ? "under 18" : "adult",
      goal: careful ? "withheld" : s.goal,
      activity_level: s.activityLevel,
      does_strength_training: s.resistanceTraining,
      support_mode: s.supportMode,
    },
    // Verdicts computed by the app. Use these as the judgement; do not re-judge the raw numbers.
    assessments,
    daily_targets: t
      ? {
          ...(careful
            ? { note: "Calorie and macro targets are withheld in this conversation. Do not state or estimate them." }
            : {
                // Under-18s: no calorie figures at all, so no gap or "deficit" can be worked out or quoted.
                ...(teen ? { calories_note: "withheld for under-18s; use assessments.energy instead" } : { calories: t.calories }),
                protein_g: t.proteinG,
                carbs_g: t.carbsG,
                fat_g: t.fatG,
                fiber_g: t.fiberG,
                ...(teen
                  ? {}
                  : { minimum_calories_app_will_ever_set: options.floorKcal, estimated_expenditure_kcal: t.tdeeKcal, expenditure_source: t.source }),
              }),
          water_ml: t.waterMl,
          sleep_hours: [t.sleepMinMinutes / 60, t.sleepMaxMinutes / 60],
          activity_minutes_per_week: t.activityMinutesPerWeek,
        }
      : null,
    nutrition: careful
      ? { days_logged_last_7: s.nutrition.loggedDays7, note: "Intake figures are withheld in this conversation." }
      : {
          days_logged_last_7: s.nutrition.loggedDays7,
          days_logged_last_30: s.nutrition.loggedDays30,
          // Averages are only sent when enough days were logged to mean something.
          average_last_7_days: enough7 ? forAge(s.nutrition.avg7) : "withheld: too few logged days",
          average_last_30_days: enough30 ? forAge(s.nutrition.avg30) : "withheld: too few logged days",
          water_ml_average_last_7: s.nutrition.waterAvg7Ml,
        },
    // Teens, support mode and flagged conversations: no weight figures at all.
    weight:
      teen || careful
        ? { weigh_ins_last_28_days: s.weight.weighIns28, losing_faster_than_safe: s.weight.tooFast }
        : {
            latest_kg: round(s.weight.latestKg, 1),
            seven_day_average_kg: s.weight.avg7Kg,
            weigh_ins_last_28_days: s.weight.weighIns28,
            trend_kg_per_week: s.weight.slopeKgPerWeek,
            trend_percent_bodyweight_per_week: s.weight.pctPerWeek,
            losing_faster_than_safe: s.weight.tooFast,
          },
    measured_expenditure:
      teen || careful
        ? null
        : a
          ? a.ok
            ? { kcal_per_day: a.observedKcal, confidence: a.confidence, logged_days: a.loggedDays, weigh_ins: a.weighIns }
            : { available: false, reason: a.reason }
          : null,
    training: {
      strength_sessions_last_7: s.training.sessions7,
      strength_sessions_last_30: s.training.sessions30,
      cardio_minutes_last_7: s.training.cardioMinutes7,
      hard_sets_per_muscle_last_7: Object.fromEntries(s.training.volume7.filter((v) => v.sets > 0).map((v) => [v.group, v.sets])),
      muscles_with_no_sets_last_7: s.training.volume7.filter((v) => v.sets === 0).map((v) => v.group),
      recommended_weekly_sets_per_muscle: [10, 20],
      personal_records_last_30: s.training.records30.slice(0, 6).map((r) => ({
        exercise: sanitizeLabel(r.exerciseName, 50),
        kind: r.kind,
        weight_kg: r.weightKg,
        reps: r.reps,
        date: r.achievedOn,
      })),
    },
    sleep: {
      nights_logged_last_7: s.sleep.nights7,
      average_hours_last_7: s.sleep.nights7 >= 3 && s.sleep.avg7Min != null ? round(s.sleep.avg7Min / 60, 1) : "withheld: too few nights logged",
      average_hours_last_30: s.sleep.avg30Min == null ? null : round(s.sleep.avg30Min / 60, 1),
      average_quality_1_to_5: s.sleep.avgQuality7,
    },
    check_in_averages_last_7: {
      days: s.checkin.days7,
      mood_1_to_5: s.checkin.mood7,
      energy_1_to_5: s.checkin.energy7,
      soreness_1_to_5: s.checkin.soreness7,
      resting_heart_rate: s.checkin.restingHr7,
    },
    logging: { days_with_any_entry_last_7: s.logging.daysLogged7 },
  };

  const foods = options.frequentFoods.map((f) => sanitizeLabel(f)).filter(Boolean).slice(0, 12);

  return [
    "<user_data>",
    JSON.stringify(facts),
    "</user_data>",
    "<food_names>",
    foods.length > 0 ? foods.join("\n") : "(none logged yet)",
    "</food_names>",
  ].join("\n");
}
