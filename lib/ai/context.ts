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

type ContextOptions = { frequentFoods: readonly string[]; floorKcal: number };

export function buildCoachContext(s: Snapshot, options: ContextOptions): string {
  const t = s.targets;
  const a = s.adaptive;
  const round = (n: number | null, d = 0) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

  const facts = {
    as_of: s.asOf,
    person: {
      age_band: s.ageBand === "teen" ? "13-17" : "18+",
      goal: s.goal,
      activity_level: s.activityLevel,
      does_strength_training: s.resistanceTraining,
      support_mode: s.supportMode,
    },
    daily_targets: t
      ? {
          calories: t.calories,
          protein_g: t.proteinG,
          carbs_g: t.carbsG,
          fat_g: t.fatG,
          fiber_g: t.fiberG,
          water_ml: t.waterMl,
          sleep_hours: [t.sleepMinMinutes / 60, t.sleepMaxMinutes / 60],
          activity_minutes_per_week: t.activityMinutesPerWeek,
          estimated_expenditure_kcal: t.tdeeKcal,
          expenditure_source: t.source,
          minimum_calories_app_will_ever_set: options.floorKcal,
        }
      : null,
    nutrition: {
      days_logged_last_7: s.nutrition.loggedDays7,
      days_logged_last_30: s.nutrition.loggedDays30,
      average_last_7_days: s.nutrition.loggedDays7 > 0 ? s.nutrition.avg7 : null,
      average_last_30_days: s.nutrition.loggedDays30 > 0 ? s.nutrition.avg30 : null,
      water_ml_average_last_7: s.nutrition.waterAvg7Ml,
    },
    // Teens and people in support mode: weight is reported without a rate, so the coach is not drawn into optimising it.
    weight:
      s.ageBand === "teen" || s.supportMode
        ? { weigh_ins_last_28_days: s.weight.weighIns28, losing_faster_than_safe: s.weight.tooFast }
        : {
            latest_kg: round(s.weight.latestKg, 1),
            seven_day_average_kg: s.weight.avg7Kg,
            weigh_ins_last_28_days: s.weight.weighIns28,
            trend_kg_per_week: s.weight.slopeKgPerWeek,
            trend_percent_bodyweight_per_week: s.weight.pctPerWeek,
            losing_faster_than_safe: s.weight.tooFast,
          },
    measured_expenditure: a
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
      average_hours_last_7: s.sleep.avg7Min == null ? null : round(s.sleep.avg7Min / 60, 1),
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
