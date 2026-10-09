"use server";

import { requireViewer } from "@/lib/auth/session";
import { completeOnboarding } from "@/lib/data/profile";
import type { Targets } from "@/lib/science/targets";
import { onboardingSchema } from "@/lib/validation/onboarding";

export type OnboardingResult =
  | { ok: true; targets: Targets }
  | { ok: false; errors: Record<string, string> };

export async function finishOnboarding(input: unknown): Promise<OnboardingResult> {
  const viewer = await requireViewer({ allowNotOnboarded: true });
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const { acceptedDisclaimer: _accepted, ...data } = parsed.data;
  void _accepted;
  const targets = await completeOnboarding(viewer.userId, data);
  return { ok: true, targets };
}
