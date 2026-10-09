"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import {
  addWater,
  deleteFoodLog,
  deleteSavedMeal,
  logFood,
  logSavedMeal,
  quickAdd,
  saveMealFromDay,
  undoLastWater,
  updateFoodLogQuantity,
} from "@/lib/data/food-logs";
import { createCustomFood, deleteCustomFood, type FoodSummary } from "@/lib/data/foods";
import {
  customFoodSchema,
  dateSchema,
  logFoodSchema,
  mealSchema,
  quickAddSchema,
  waterSchema,
} from "@/lib/validation/food";
import { z } from "zod";

/*
 * Every action re-reads the session, validates its input with Zod, and passes
 * the session's user id to the data layer. Nothing trusts an id from the client.
 */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check what you entered.";

function refresh() {
  revalidatePath("/food");
  revalidatePath("/today");
}

export async function logFoodAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = logFoodSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const log = await logFood(userId, parsed.data);
  if (!log) return fail("That food could not be found.");
  refresh();
  return { ok: true, data: undefined };
}

export async function quickAddAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  await quickAdd(userId, parsed.data);
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteFoodLogAction(logId: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = z.uuid().safeParse(logId);
  if (!parsed.success) return fail("Unknown entry.");
  await deleteFoodLog(userId, parsed.data);
  refresh();
  return { ok: true, data: undefined };
}

export async function updateFoodLogQuantityAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = z
    .object({ logId: z.uuid(), quantityG: z.coerce.number().positive().max(5000) })
    .safeParse(input);
  if (!parsed.success) return fail("Enter an amount in grams.");
  await updateFoodLogQuantity(userId, parsed.data.logId, parsed.data.quantityG);
  refresh();
  return { ok: true, data: undefined };
}

export async function addWaterAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = waterSchema.safeParse(input);
  if (!parsed.success) return fail("Enter an amount between 50 and 2,000 ml.");
  await addWater(userId, parsed.data.date, parsed.data.ml);
  refresh();
  return { ok: true, data: undefined };
}

export async function undoWaterAction(date: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) return fail("Invalid date.");
  await undoLastWater(userId, parsed.data);
  refresh();
  return { ok: true, data: undefined };
}

export async function createCustomFoodAction(input: unknown): Promise<ActionResult<FoodSummary>> {
  const userId = await requireUserId();
  const parsed = customFoodSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const food = await createCustomFood(userId, parsed.data);
  return { ok: true, data: food };
}

export async function deleteCustomFoodAction(foodId: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = z.uuid().safeParse(foodId);
  if (!parsed.success) return fail("Unknown food.");
  await deleteCustomFood(userId, parsed.data);
  revalidatePath("/food/add");
  return { ok: true, data: undefined };
}

export async function saveMealAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = z
    .object({ name: z.string().trim().min(1, "Give the meal a name").max(60), date: dateSchema, meal: mealSchema })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const saved = await saveMealFromDay(userId, parsed.data.name, parsed.data.date, parsed.data.meal);
  if (!saved) return fail("There is nothing in that meal to save yet.");
  revalidatePath("/food/add");
  return { ok: true, data: undefined };
}

export async function logSavedMealAction(input: unknown): Promise<ActionResult<number>> {
  const userId = await requireUserId();
  const parsed = z
    .object({ savedMealId: z.uuid(), date: dateSchema, meal: mealSchema, clientId: z.uuid() })
    .safeParse(input);
  if (!parsed.success) return fail("Could not log that meal.");
  const n = await logSavedMeal(userId, parsed.data.savedMealId, parsed.data.date, parsed.data.meal, parsed.data.clientId);
  refresh();
  return { ok: true, data: n };
}

export async function deleteSavedMealAction(savedMealId: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = z.uuid().safeParse(savedMealId);
  if (!parsed.success) return fail("Unknown meal.");
  await deleteSavedMeal(userId, parsed.data);
  revalidatePath("/food/add");
  return { ok: true, data: undefined };
}
