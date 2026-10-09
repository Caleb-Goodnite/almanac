import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const measurementSiteEnum = pgEnum("measurement_site", [
  "waist",
  "hips",
  "chest",
  "arm",
  "thigh",
  "calf",
  "neck",
]);

export const weights = pgTable(
  "weights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kg: numeric("kg", { precision: 5, scale: 2, mode: "number" }).notNull(),
    bodyFatPct: numeric("body_fat_pct", { precision: 4, scale: 1, mode: "number" }),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weights_user_date_idx").on(t.userId, t.date)],
).enableRLS();

export const measurements = pgTable(
  "measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    site: measurementSiteEnum("site").notNull(),
    cm: numeric("cm", { precision: 5, scale: 1, mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("measurements_user_date_site_idx").on(t.userId, t.date, t.site)],
).enableRLS();

/** One row per night, keyed by the date the user woke up. */
export const sleepLogs = pgTable(
  "sleep_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    durationMin: integer("duration_min").notNull(),
    quality: smallint("quality"),
    bedtime: time("bedtime"),
    wakeTime: time("wake_time"),
  },
  (t) => [uniqueIndex("sleep_user_date_idx").on(t.userId, t.date)],
).enableRLS();

/** The ten-second daily check-in. Every scale is 1 (low) to 5 (high). */
export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    mood: smallint("mood"),
    energy: smallint("energy"),
    soreness: smallint("soreness"),
    restingHr: smallint("resting_hr"),
    note: text("note"),
  },
  (t) => [
    uniqueIndex("checkins_user_date_idx").on(t.userId, t.date),
    index("checkins_user_idx").on(t.userId),
  ],
).enableRLS();
