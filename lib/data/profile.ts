import "server-only";
import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { guardianConsents, profile, targets, tdeeEstimates, weights } from "@/lib/db/schema";
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

/** Whether a parent or guardian's approval for a fat-loss goal is currently in force. */
export async function hasGuardianApproval(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: guardianConsents.id })
    .from(guardianConsents)
    .where(and(eq(guardianConsents.userId, userId), eq(guardianConsents.status, "approved")))
    .limit(1);
  return Boolean(row);
}

/** The message shown when an under-18 asks for a fat-loss goal without approval. */
export const GUARDIAN_NEEDED =
  "A fat-loss goal needs a parent or guardian's approval. Choose another goal for now; you can ask them from Settings.";

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

/** Thrown when an under-18 tries to save a fat-loss goal that no guardian has approved. */
export class GuardianNeededError extends Error {
  constructor() {
    super(GUARDIAN_NEEDED);
    this.name = "GuardianNeededError";
  }
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
  const guardianApproved = age.isTeen ? await hasGuardianApproval(userId) : false;
  if (age.isTeen && input.goal === "lose_fat" && !guardianApproved) throw new GuardianNeededError();
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
    guardianApproved,
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
export async function recomputeTargets(userId: string, useDefaultRate = false): Promise<Targets | null> {
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
    weeklyRatePct: useDefaultRate ? null : p.weeklyRatePct,
    tdeeOverrideKcal: adaptive?.tdeeKcal ?? null,
    supportMode: p.supportMode,
    guardianApproved: age.isTeen ? await hasGuardianApproval(userId) : false,
  });

  await db
    .insert(targets)
    .values(targetValues(userId, todayIn(p.timezone), computed, adaptive ? "adaptive" : "formula"));
  // Keep the stored rate in step with what the guardrails actually allowed.
  await db.update(profile).set({ weeklyRatePct: computed.weeklyRatePct }).where(eq(profile.userId, userId));
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

export type ProfileUpdate = {
  sex: Sex;
  heightCm: number;
  unitSystem: "metric" | "imperial";
  goal: Goal;
  activityLevel: ActivityLevel;
  resistanceTraining: boolean;
  weeklyRatePct: number | null;
};

/** Saves profile edits from Settings and recomputes targets from them. */
export async function updateProfile(userId: string, input: ProfileUpdate): Promise<Targets | null> {
  if (input.goal === "lose_fat") {
    const p = await getProfile(userId);
    if (p && ageFacts(p).isTeen && !(await hasGuardianApproval(userId))) throw new GuardianNeededError();
  }
  await db
    .update(profile)
    .set({ ...input, weeklyRatePct: input.weeklyRatePct ?? 0, updatedAt: new Date() })
    .where(eq(profile.userId, userId));
  return recomputeTargets(userId, input.weeklyRatePct === null);
}

/**
 * Puts an under-18 whose stored goal is fat loss, but who has no guardian
 * approval in force, back on a maintenance goal and recomputes their targets.
 * Covers accounts created before approval was required and any approval that
 * was withdrawn. Returns true if anything changed.
 */
export async function enforceGuardianLock(userId: string): Promise<boolean> {
  if (await hasGuardianApproval(userId)) return false;
  await db
    .update(profile)
    .set({ goal: "maintain", weeklyRatePct: 0, updatedAt: new Date() })
    .where(and(eq(profile.userId, userId), eq(profile.goal, "lose_fat")));
  await recomputeTargets(userId);
  return true;
}
