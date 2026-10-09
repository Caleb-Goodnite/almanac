import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";

/**
 * Everything stored about one user, for the "download my data" button.
 * Password hashes, OAuth tokens and session tokens are left out: they are
 * credentials, not the user's data, and exporting them would be a risk.
 */
export async function exportUserData(userId: string) {
  const own = <T extends { userId: unknown }>(table: T) => eq(table.userId as never, userId);

  const [
    [account],
    [profile],
    targets,
    tdeeEstimates,
    foodLogs,
    customFoods,
    savedMeals,
    savedMealItems,
    waterLogs,
    routines,
    routineExercises,
    workouts,
    workoutSets,
    cardioSessions,
    personalRecords,
    customExercises,
    weights,
    measurements,
    sleepLogs,
    checkins,
    conversations,
    messages,
    insights,
    aiUsage,
    guardianConsents,
  ] = await Promise.all([
    db.select({ name: t.user.name, email: t.user.email, createdAt: t.user.createdAt }).from(t.user).where(eq(t.user.id, userId)),
    db.select().from(t.profile).where(own(t.profile)),
    db.select().from(t.targets).where(own(t.targets)),
    db.select().from(t.tdeeEstimates).where(own(t.tdeeEstimates)),
    db.select().from(t.foodLogs).where(own(t.foodLogs)),
    db.select().from(t.foods).where(eq(t.foods.ownerId, userId)),
    db.select().from(t.savedMeals).where(own(t.savedMeals)),
    db.select().from(t.savedMealItems).where(own(t.savedMealItems)),
    db.select().from(t.waterLogs).where(own(t.waterLogs)),
    db.select().from(t.routines).where(own(t.routines)),
    db.select().from(t.routineExercises).where(own(t.routineExercises)),
    db.select().from(t.workouts).where(own(t.workouts)),
    db.select().from(t.workoutSets).where(own(t.workoutSets)),
    db.select().from(t.cardioSessions).where(own(t.cardioSessions)),
    db.select().from(t.personalRecords).where(own(t.personalRecords)),
    db.select().from(t.exercises).where(eq(t.exercises.ownerId, userId)),
    db.select().from(t.weights).where(own(t.weights)),
    db.select().from(t.measurements).where(own(t.measurements)),
    db.select().from(t.sleepLogs).where(own(t.sleepLogs)),
    db.select().from(t.checkins).where(own(t.checkins)),
    db.select().from(t.conversations).where(own(t.conversations)),
    db.select().from(t.messages).where(own(t.messages)),
    db.select().from(t.insights).where(own(t.insights)),
    db.select().from(t.aiUsage).where(own(t.aiUsage)),
    db.select().from(t.guardianConsents).where(own(t.guardianConsents)),
  ]);

  const strip = <R extends Record<string, unknown>>(rows: R[]) => rows.map(({ userId: _u, ownerId: _o, ...rest }) => rest);

  return {
    exportedAt: new Date().toISOString(),
    format: "almanac-export-v1",
    account,
    profile: profile ? strip([profile])[0] : null,
    // Link tokens are credentials, so their hashes are left out.
    guardianApprovals: strip(guardianConsents).map(({ tokenHash: _t, revokeTokenHash: _r, ...rest }) => rest),
    targets: strip(targets),
    tdeeEstimates: strip(tdeeEstimates),
    nutrition: {
      foodLogs: strip(foodLogs),
      customFoods: strip(customFoods),
      savedMeals: strip(savedMeals),
      savedMealItems: strip(savedMealItems),
      waterLogs: strip(waterLogs),
    },
    training: {
      routines: strip(routines),
      routineExercises: strip(routineExercises),
      workouts: strip(workouts),
      workoutSets: strip(workoutSets),
      cardioSessions: strip(cardioSessions),
      personalRecords: strip(personalRecords),
      customExercises: strip(customExercises),
    },
    body: { weights: strip(weights), measurements: strip(measurements), sleepLogs: strip(sleepLogs), checkins: strip(checkins) },
    coach: { conversations: strip(conversations), messages: strip(messages), weeklyReviews: strip(insights), usage: strip(aiUsage) },
  };
}
