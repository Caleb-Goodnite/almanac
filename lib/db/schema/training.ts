import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const prKindEnum = pgEnum("pr_kind", ["e1rm", "weight", "reps", "volume"]);

/**
 * Exercise library. Seeded rows (owner_id null) are shared; a user's custom
 * exercises carry their owner_id and are filtered the same way custom foods are.
 */
export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    equipment: text("equipment"),
    level: text("level"),
    mechanic: text("mechanic"),
    force: text("force"),
    movementPattern: text("movement_pattern"),
    // Our volume-tracking groups (chest, back, quads...), primary then secondary.
    primaryGroups: text("primary_groups").array().notNull().default([]),
    secondaryGroups: text("secondary_groups").array().notNull().default([]),
    instructions: text("instructions").array().notNull().default([]),
    source: text("source").notNull().default("free-exercise-db"),
  },
  (t) => [
    unique("exercises_slug_owner_key").on(t.slug, t.ownerId).nullsNotDistinct(),
    index("exercises_owner_idx").on(t.ownerId),
  ],
).enableRLS();

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    position: smallint("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("routines_user_idx").on(t.userId)],
).enableRLS();

export const routineExercises = pgTable(
  "routine_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    position: smallint("position").notNull().default(0),
    targetSets: smallint("target_sets").notNull().default(3),
    targetRepsMin: smallint("target_reps_min").notNull().default(8),
    targetRepsMax: smallint("target_reps_max").notNull().default(12),
    restSeconds: smallint("rest_seconds").notNull().default(120),
  },
  (t) => [index("routine_exercises_routine_idx").on(t.userId, t.routineId)],
).enableRLS();

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    date: date("date").notNull(),
    name: text("name").notNull(),
    routineId: uuid("routine_id").references(() => routines.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    kcalEstimate: integer("kcal_estimate"),
    notes: text("notes"),
  },
  (t) => [
    index("workouts_user_date_idx").on(t.userId, t.date),
    uniqueIndex("workouts_user_client_idx").on(t.userId, t.clientId),
  ],
).enableRLS();

export const workoutSets = pgTable(
  "workout_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    exerciseOrder: smallint("exercise_order").notNull().default(0),
    setNumber: smallint("set_number").notNull(),
    reps: smallint("reps").notNull(),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2, mode: "number" }).notNull(),
    rpe: numeric("rpe", { precision: 3, scale: 1, mode: "number" }),
    rir: smallint("rir"),
    isWarmup: boolean("is_warmup").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("workout_sets_workout_idx").on(t.userId, t.workoutId),
    index("workout_sets_exercise_idx").on(t.userId, t.exerciseId, t.completedAt.desc()),
  ],
).enableRLS();

export const cardioSessions = pgTable(
  "cardio_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    date: date("date").notNull(),
    // Key into the Compendium activity table in lib/science/met.ts.
    activity: text("activity").notNull(),
    label: text("label").notNull(),
    durationSec: integer("duration_sec").notNull(),
    distanceM: integer("distance_m"),
    avgHr: smallint("avg_hr"),
    maxHr: smallint("max_hr"),
    met: numeric("met", { precision: 4, scale: 1, mode: "number" }).notNull(),
    kcalEstimate: integer("kcal_estimate"),
    notes: text("notes"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cardio_user_date_idx").on(t.userId, t.date),
    uniqueIndex("cardio_user_client_idx").on(t.userId, t.clientId),
  ],
).enableRLS();

export const personalRecords = pgTable(
  "personal_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    kind: prKindEnum("kind").notNull(),
    value: numeric("value", { precision: 9, scale: 2, mode: "number" }).notNull(),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2, mode: "number" }),
    reps: smallint("reps"),
    setId: uuid("set_id").references(() => workoutSets.id, { onDelete: "cascade" }),
    achievedOn: date("achieved_on").notNull(),
  },
  (t) => [index("prs_user_exercise_idx").on(t.userId, t.exerciseId, t.kind, t.achievedOn.desc())],
).enableRLS();
