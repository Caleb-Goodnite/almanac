"use server";

import { revalidatePath } from "next/cache";
import { getSession, requireViewer } from "@/lib/auth/session";
import { cancelGuardianRequest, createGuardianRequest, getGuardianStatus } from "@/lib/data/guardian";
import { GuardianNeededError, recomputeTargets, setSupportMode, updateProfile } from "@/lib/data/profile";
import { rateLimit } from "@/lib/data/rate-limit";
import { guardianRequestEmail } from "@/lib/email/guardian";
import { sendEmail } from "@/lib/email/send";
import { env, features } from "@/lib/env";
import { REQUESTS_PER_DAY, sameMailbox } from "@/lib/safety/guardian";
import { guardianRequestSchema, profileUpdateSchema } from "@/lib/validation/settings";

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

  let targets;
  try {
    targets = await updateProfile(viewer.userId, { ...rest, weeklyRatePct });
  } catch (err) {
    if (err instanceof GuardianNeededError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/", "layout");
  if (!targets) return { ok: true, message: "Saved. Log a weight to get updated targets." };
  const note = targets.guardrails[0]?.message;
  return {
    ok: true,
    message: `Saved. Your target is now ${targets.calories.toLocaleString("en-US")} kcal with ${targets.proteinG} g protein.${note ? ` ${note}` : ""}`,
  };
}

/**
 * Lets an adult leave support mode themselves. Entering it is automatic (see
 * lib/safety). Under-18s cannot switch it off: the check is here on the
 * server, not only in the page, and it is cleared for them by the operator
 * (`pnpm support:clear <email>`) after a parent or clinician has been involved.
 */
export async function leaveSupportModeAction(): Promise<SettingsResult> {
  const viewer = await requireViewer();
  if (viewer.isTeen) {
    return { ok: false, error: "This can't be switched off from here. Please talk to a parent, guardian or doctor." };
  }
  await setSupportMode(viewer.userId, false);
  await recomputeTargets(viewer.userId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Your usual targets are back." };
}

/**
 * An under-18 asks a parent or guardian to approve a fat-loss goal. The
 * approval itself happens from the emailed link (app/guardian), never from the
 * teen's own session.
 */
export async function requestGuardianApprovalAction(input: unknown): Promise<SettingsResult> {
  const viewer = await requireViewer();
  if (!viewer.isTeen) return { ok: false, error: "You can choose this goal yourself." };
  if (!features.guardianApproval) return { ok: false, error: "This is not available yet." };
  const parsed = guardianRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the email address." };

  const own = (await getSession())?.user.email ?? "";
  if (sameMailbox(parsed.data.email, own)) {
    return { ok: false, error: "Enter your parent or guardian's own email address, not yours." };
  }
  if ((await getGuardianStatus(viewer.userId)).state === "approved") {
    return { ok: false, error: "This has already been approved." };
  }
  const limit = await rateLimit(`guardian:${viewer.userId}`, REQUESTS_PER_DAY, 24 * 60 * 60);
  if (!limit.allowed) return { ok: false, error: "You have asked a few times today. Try again tomorrow." };

  const token = await createGuardianRequest(viewer.userId, parsed.data.email);
  await sendEmail({
    to: parsed.data.email,
    ...guardianRequestEmail(viewer.firstName, `${env.BETTER_AUTH_URL}/guardian/${token}`),
  });
  revalidatePath("/settings");
  return { ok: true, message: "Sent. Ask them to check their email; the link works for 7 days." };
}

export async function cancelGuardianRequestAction(): Promise<SettingsResult> {
  const viewer = await requireViewer();
  await cancelGuardianRequest(viewer.userId);
  revalidatePath("/settings");
  return { ok: true, message: "Request cancelled." };
}
