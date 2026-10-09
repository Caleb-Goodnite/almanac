import { sql } from "drizzle-orm";
import {
  check,
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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const foodSourceEnum = pgEnum("food_source", ["usda", "off", "custom"]);
export const mealEnum = pgEnum("meal", ["breakfast", "lunch", "dinner", "snack"]);

const n = (name: string) => numeric(name, { precision: 9, scale: 2, mode: "number" });

/**
 * Foods. USDA and Open Food Facts rows are a shared cache (owner_id null) that
 * any user may read. Custom rows belong to exactly one user; the data layer
 * always filters `source <> 'custom' OR owner_id = :userId`.
 * Nutrients are per 100 g (or 100 ml for liquids).
 */
export const foods = pgTable(
  "foods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: foodSourceEnum("source").notNull(),
    sourceId: text("source_id").notNull(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    barcode: text("barcode"),
    name: text("name").notNull(),
    brand: text("brand"),
    servingG: n("serving_g"),
    servingLabel: text("serving_label"),
    kcal: n("kcal").notNull(),
    proteinG: n("protein_g").notNull().default(0),
    carbsG: n("carbs_g").notNull().default(0),
    fatG: n("fat_g").notNull().default(0),
    fiberG: n("fiber_g"),
    sugarG: n("sugar_g"),
    sodiumMg: n("sodium_mg"),
    // Micronutrients where the source has them, keyed by nutrient, per 100 g.
    micros: jsonb("micros").$type<Record<string, number>>().notNull().default({}),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("foods_source_id_idx").on(t.source, t.sourceId),
    index("foods_barcode_idx").on(t.barcode),
    index("foods_owner_idx").on(t.ownerId),
    check("foods_custom_has_owner", sql`(${t.source} = 'custom') = (${t.ownerId} is not null)`),
  ],
).enableRLS();

/**
 * One logged food. Nutrients are snapshotted for the logged quantity so that
 * history never changes when a cached food is refreshed, and daily totals are
 * a plain SUM.
 */
export const foodLogs = pgTable(
  "food_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Generated on the device so a retried offline write is idempotent.
    clientId: uuid("client_id").notNull(),
    date: date("date").notNull(),
    meal: mealEnum("meal").notNull(),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    brand: text("brand"),
    quantityG: n("quantity_g").notNull(),
    servingLabel: text("serving_label"),
    kcal: n("kcal").notNull(),
    proteinG: n("protein_g").notNull(),
    carbsG: n("carbs_g").notNull(),
    fatG: n("fat_g").notNull(),
    fiberG: n("fiber_g").notNull().default(0),
    sugarG: n("sugar_g").notNull().default(0),
    sodiumMg: n("sodium_mg").notNull().default(0),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("food_logs_user_date_idx").on(t.userId, t.date),
    index("food_logs_user_food_idx").on(t.userId, t.foodId, t.loggedAt.desc()),
    uniqueIndex("food_logs_user_client_idx").on(t.userId, t.clientId),
  ],
).enableRLS();

export const savedMeals = pgTable(
  "saved_meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_meals_user_idx").on(t.userId)],
).enableRLS();

export const savedMealItems = pgTable(
  "saved_meal_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Denormalised so every table can be filtered by user directly.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    savedMealId: uuid("saved_meal_id")
      .notNull()
      .references(() => savedMeals.id, { onDelete: "cascade" }),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    quantityG: n("quantity_g").notNull(),
    position: smallint("position").notNull().default(0),
  },
  (t) => [index("saved_meal_items_meal_idx").on(t.userId, t.savedMealId)],
).enableRLS();

export const waterLogs = pgTable(
  "water_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    ml: integer("ml").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("water_logs_user_date_idx").on(t.userId, t.date)],
).enableRLS();
