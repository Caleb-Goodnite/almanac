"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth/session";
import { recomputeTargets, setSupportMode, updateProfile } from "@/lib/data/profile";
import { profileUpdateSchema } from "@/lib/validation/settings";

export type SettingsResult = { ok: true; message: string } | { ok: false; error: string };

export async function updateProfileAction(input: unknown): Promise<SettingsResult> {
  const viewer = await requireViewer();
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check what you entered." };
  const { pace, ...rest } = parsed.data;

  // The requested pace is only a request: computeTargets clamps it to what is
  // allowed for this person's age and size.
  let weeklyRatePct: number | null = 0;
  if (rest.goal === "lose_fat") weeklyRatePct = pace === "gentle" ? -0.25 : pace === "faster" ? -1 : -0.5;
  else if (rest.goal === "build_muscle") weeklyRatePct = pace === "faster" ? 0.5 : 0.25;

  const targets = await updateProfile(viewer.userId, { ...rest, weeklyRatePct });
  revalidatePath("/", "layout");
  if (!targets) return { ok: true, message: "Saved. Log a weight to get updated targets." };
  const note = targets.guardrails[0]?.message;
  return {
    ok: true,
    message: `Saved. Your target is now ${targets.calories.toLocaleString("en-US")} kcal with ${targets.proteinG} g protein.${note ? ` ${note}` : ""}`,
  };
}

/** Lets someone leave support mode themselves. Entering it is automatic (see lib/safety). */
export async function leaveSupportModeAction(): Promise<SettingsResult> {
  const viewer = await requireViewer();
  await setSupportMode(viewer.userId, false);
  await recomputeTargets(viewer.userId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Your usual targets are back." };
}
