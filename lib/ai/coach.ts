import "server-only";
import type { Viewer } from "@/lib/auth/session";
import { frequentFoodNames } from "@/lib/data/coach";
import { getLatestWeight } from "@/lib/data/profile";
import type { Snapshot } from "@/lib/data/snapshot";
import { calorieFloor } from "@/lib/safety/policy";
import { estimateBmr } from "@/lib/science/energy";
import { buildCoachContext } from "./context";

/** The context block and calorie floor for one user, shared by chat and insights. */
export async function coachContextFor(viewer: Viewer, snapshot: Snapshot): Promise<{ context: string; floorKcal: number }> {
  const [foods, weight] = await Promise.all([frequentFoodNames(viewer.userId), getLatestWeight(viewer.userId)]);
  const p = viewer.profile;
  const bmr =
    weight && p.heightCm
      ? estimateBmr({ sex: p.sex, weightKg: weight.kg, heightCm: p.heightCm, ageYears: viewer.ageYears, bodyFatPct: p.bodyFatPct }).kcal
      : 0;
  const floorKcal = calorieFloor(p.sex, viewer.isTeen, bmr);
  return { context: buildCoachContext(snapshot, { frequentFoods: foods, floorKcal }), floorKcal };
}
