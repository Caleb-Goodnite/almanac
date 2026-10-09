import "server-only";
import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profile, targets, tdeeEstimates, weights } from "@/lib/db/schema";
import { ageFromBirthMonth, ageMonthsFromBirthMonth } from "@/lib/science/age";
import { computeTargets, type Targets } from "@/lib/science/targets";
import type { ActivityLevel, DateString, Goal, Sex } from "@/lib/science/types";
import { todayIn, toCalendarDate } from "@/lib/time";

export type Profile = typeof profile.$inferSelect;
export type TargetRow = typeof targets.$inferSelect;

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1);
  return row ?? null;
}

/** Age facts derived from the stored birth month, in the user's own time zone. */
export function ageFacts(p: Pick<Profile, "birthYear" | "birthMonth" | "timezone">) {
  const today = toCalendarDate(todayIn(p.timezone));
  const ageYears = ageFromBirthMonth(p.birthYear, p.birthMonth, today);
  return {
    ageYears,
    ageMonths: ageMonthsFromBirthMonth(p.birthYear, p.birthMonth, today),
    isTeen: ageYears < 18,
  };
}

export async function getLatestWeight(userId: string): Promise<{ date: DateString; kg: number } | null> {
  const [row] = await db
    .select({ date: weights.date, kg: weights.kg })
    .from(weights)
    .where(eq(weights.userId, userId))
    .orderBy(desc(weights.date))
    .limit(1);
  return row ?? null;
}

/** The targets in force on a given date: the newest row effective on or before it. */
export async function getTargets(userId: string, on: DateString): Promise<TargetRow | null> {
  const [row] = await db
    .select()
    .from(targets)
    .where(and(eq(targets.userId, userId), lte(targets.effectiveFrom, on)))
    .orderBy(desc(targets.effectiveFrom), desc(targets.createdAt))
    .limit(1);
  return row ?? null;
}

export type OnboardingInput = {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  unitSystem: "metric" | "imperial";
  timezone: string;
  goal: Goal;
  activityLevel: ActivityLevel;
  resistanceTraining: boolean;
  trainingDaysPerWeek: number;
  weeklyRatePct: number | null;
};

function targetValues(userId: string, on: DateString, t: Targets, source: "formula" | "adaptive") {
  return {
    userId,
    effectiveFrom: on,
    source,
    bmrKcal: t.bmrKcal,
    tdeeKcal: t.tdeeKcal,
    calories: t.calories,
    proteinG: t.proteinG,
    carbsG: t.carbsG,
    fatG: t.fatG,
    fiberG: t.fiberG,
    waterMl: t.waterMl,
    sleepMinMinutes: t.sleepMinMinutes,
    sleepMaxMinutes: t.sleepMaxMinutes,
    activityMinutesPerWeek: t.activityMinutesPerWeek,
    detail: {
      bmrEquation: t.bmrEquation,
      weeklyRatePct: t.weeklyRatePct,
      proteinGPerKg: t.proteinGPerKg,
      guardrails: t.guardrails,
    },
  };
}

/**
 * Saves onboarding answers, the first weigh-in and the computed targets in one
 * transaction. Targets are always computed on the server from lib/science; the
 * client never supplies a calorie number.
 */
export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<Targets> {
  const existing = await getProfile(userId);
  if (!existing) throw new Error("Profile not found");

  const today = todayIn(input.timezone);
  const age = ageFacts({ ...existing, timezone: input.timezone });
  const computed = computeTargets({
    sex: input.sex,
    ageYears: age.ageYears,
    ageMonths: age.ageMonths,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    bodyFatPct: input.bodyFatPct,
    goal: input.goal,
    activityLevel: input.activityLevel,
    resistanceTraining: input.resistanceTraining,
    weeklyRatePct: input.weeklyRatePct,
    supportMode: existing.supportMode,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(profile)
      .set({
        sex: input.sex,
        heightCm: input.heightCm,
        bodyFatPct: input.bodyFatPct,
        unitSystem: input.unitSystem,
        timezone: input.timezone,
        goal: input.goal,
        activityLevel: input.activityLevel,
        resistanceTraining: input.resistanceTraining,
        trainingDaysPerWeek: input.trainingDaysPerWeek,
        weeklyRatePct: computed.weeklyRatePct,
        disclaimerAcceptedAt: existing.disclaimerAcceptedAt ?? new Date(),
        onboardedAt: existing.onboardedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(profile.userId, userId));

    await tx
      .insert(weights)
      .values({ userId, date: today, kg: input.weightKg, bodyFatPct: input.bodyFatPct })
      .onConflictDoUpdate({
        target: [weights.userId, weights.date],
        set: { kg: input.weightKg, bodyFatPct: input.bodyFatPct },
      });

    await tx.insert(targets).values(targetValues(userId, today, computed, "formula"));
  });

  return computed;
}

/**
 * Recomputes targets from the stored profile and latest weight, using the
 * newest adaptive TDEE estimate when one exists. Called after profile edits
 * and by the weekly adaptive update.
 */
export async function recomputeTargets(userId: string): Promise<Targets | null> {
  const p = await getProfile(userId);
  const w = await getLatestWeight(userId);
  if (!p || !w || p.heightCm == null) return null;

  const [adaptive] = await db
    .select({ tdeeKcal: tdeeEstimates.tdeeKcal })
    .from(tdeeEstimates)
    .where(eq(tdeeEstimates.userId, userId))
    .orderBy(desc(tdeeEstimates.computedOn))
    .limit(1);

  const age = ageFacts(p);
  const computed = computeTargets({
    sex: p.sex,
    ageYears: age.ageYears,
    ageMonths: age.ageMonths,
    weightKg: w.kg,
    heightCm: p.heightCm,
    bodyFatPct: p.bodyFatPct,
    goal: p.goal,
    activityLevel: p.activityLevel,
    resistanceTraining: p.resistanceTraining,
    weeklyRatePct: p.weeklyRatePct,
    tdeeOverrideKcal: adaptive?.tdeeKcal ?? null,
    supportMode: p.supportMode,
  });

  await db
    .insert(targets)
    .values(targetValues(userId, todayIn(p.timezone), computed, adaptive ? "adaptive" : "formula"));
  return computed;
}

export async function setSupportMode(userId: string, on: boolean): Promise<void> {
  await db
    .update(profile)
    .set({ supportMode: on, supportModeAt: on ? new Date() : null, updatedAt: new Date() })
    .where(eq(profile.userId, userId));
}

/** Creates the profile for an account that passed the age gate but has none (a failed sign-up hook). */
export async function ensureProfile(userId: string, claim: { birthYear: number; birthMonth: number }): Promise<void> {
  await db
    .insert(profile)
    .values({ userId, birthYear: claim.birthYear, birthMonth: claim.birthMonth })
    .onConflictDoNothing();
}
