import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const sexEnum = pgEnum("sex", ["male", "female", "unspecified"]);
export const unitSystemEnum = pgEnum("unit_system", ["metric", "imperial"]);
export const goalEnum = pgEnum("goal", ["lose_fat", "build_muscle", "maintain", "improve_fitness"]);
export const activityLevelEnum = pgEnum("activity_level", [
  "sedentary",
  "light",
  "moderate",
  "very",
  "extra",
]);
export const targetSourceEnum = pgEnum("target_source", ["formula", "adaptive", "manual"]);

export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // Data minimisation: only the month and year of birth are kept. That is
  // enough to enforce the 13+ gate and to know when a teen turns 18. Age is
  // always computed as if the birthday were the last day of the month, so the
  // rounding can only make someone look younger, never older.
  birthYear: smallint("birth_year").notNull(),
  birthMonth: smallint("birth_month").notNull(),
  sex: sexEnum("sex").notNull().default("unspecified"),
  heightCm: numeric("height_cm", { precision: 5, scale: 1, mode: "number" }),
  bodyFatPct: numeric("body_fat_pct", { precision: 4, scale: 1, mode: "number" }),
  unitSystem: unitSystemEnum("unit_system").notNull().default("metric"),
  timezone: text("timezone").notNull().default("UTC"),
  goal: goalEnum("goal").notNull().default("maintain"),
  activityLevel: activityLevelEnum("activity_level").notNull().default("light"),
  // Intended weekly change as a signed percent of bodyweight (-0.5 = lose 0.5%/week).
  weeklyRatePct: numeric("weekly_rate_pct", { precision: 4, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  trainingDaysPerWeek: smallint("training_days_per_week").notNull().default(3),
  resistanceTraining: boolean("resistance_training").notNull().default(true),
  // Set when disordered-eating signals are detected. While true the app shows
  // support resources and stops surfacing deficit targets and weight prompts.
  supportMode: boolean("support_mode").notNull().default(false),
  supportModeAt: timestamp("support_mode_at", { withTimezone: true }),
  disclaimerAcceptedAt: timestamp("disclaimer_accepted_at", { withTimezone: true }),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Versioned history of computed targets; the newest row at or before a date applies. */
export const targets = pgTable(
  "targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    effectiveFrom: date("effective_from").notNull(),
    source: targetSourceEnum("source").notNull().default("formula"),
    bmrKcal: integer("bmr_kcal").notNull(),
    tdeeKcal: integer("tdee_kcal").notNull(),
    calories: integer("calories").notNull(),
    proteinG: integer("protein_g").notNull(),
    carbsG: integer("carbs_g").notNull(),
    fatG: integer("fat_g").notNull(),
    fiberG: integer("fiber_g").notNull(),
    waterMl: integer("water_ml").notNull(),
    sleepMinMinutes: integer("sleep_min_minutes").notNull(),
    sleepMaxMinutes: integer("sleep_max_minutes").notNull(),
    activityMinutesPerWeek: integer("activity_minutes_per_week").notNull(),
    // Which equation was used, which guardrails fired, and their inputs.
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("targets_user_effective_idx").on(t.userId, t.effectiveFrom.desc())],
).enableRLS();

/** Adaptive TDEE estimates derived from logged intake and the weight trend. */
export const tdeeEstimates = pgTable(
  "tdee_estimates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    computedOn: date("computed_on").notNull(),
    windowDays: smallint("window_days").notNull(),
    tdeeKcal: integer("tdee_kcal").notNull(),
    avgIntakeKcal: integer("avg_intake_kcal").notNull(),
    weightSlopeKgPerWeek: numeric("weight_slope_kg_per_week", {
      precision: 5,
      scale: 3,
      mode: "number",
    }).notNull(),
    loggedDays: smallint("logged_days").notNull(),
    weighIns: smallint("weigh_ins").notNull(),
    confidence: text("confidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tdee_user_date_idx").on(t.userId, t.computedOn.desc())],
).enableRLS();
