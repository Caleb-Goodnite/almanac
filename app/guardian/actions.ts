"use server";

import { z } from "zod";
import { approveGuardianRequest, revokeGuardianApproval } from "@/lib/data/guardian";
import { rateLimit } from "@/lib/data/rate-limit";
import { guardianApprovedEmail } from "@/lib/email/guardian";
import { sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { HOLD_MS, RELATIONSHIPS, phraseMatches } from "@/lib/safety/guardian";
import { checkStartStamp, hashToken } from "@/lib/safety/guardian-token";

const approvalSchema = z.object({
  token: z.string().min(20).max(200),
  stamp: z.string().min(10).max(200),
  name: z.string().trim().min(2, "Enter your full name").max(80),
  relationship: z.enum(RELATIONSHIPS),
  isGuardian: z.literal(true),
  hasRead: z.literal(true),
  willSupervise: z.literal(true),
  phrase: z.string().max(100).refine(phraseMatches),
  slider: z.literal(100),
  heldMs: z.number().min(HOLD_MS),
});

export type GuardianResult = { ok: true } | { ok: false; error: string };

/**
 * Records a guardian's approval. Every step of the page is checked again here,
 * so the request cannot be shortened by calling this directly: the three
 * confirmations, the typed phrase, the slider, the hold, and a signed
 * timestamp showing the page was open long enough to read.
 */
export async function approveAction(input: unknown): Promise<GuardianResult> {
  const parsed = approvalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some steps are not complete. Go back and finish each one." };
  const { token, stamp, name, relationship } = parsed.data;
  const tokenHash = hashToken(token);

  const limit = await rateLimit(`guardian-approve:${tokenHash}`, 10, 60 * 60);
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Try again in an hour." };

  const timing = checkStartStamp(stamp, tokenHash);
  if (timing === "too_soon") return { ok: false, error: "Please take a little longer to read each step, then confirm again." };
  if (timing !== "ok") return { ok: false, error: "This page has been open too long. Reload it and start again." };

  const approval = await approveGuardianRequest(token, { name, relationship });
  if (!approval) return { ok: false, error: "This link is no longer valid. Ask for a new one from the app's Settings." };

  await sendEmail({
    to: approval.guardianEmail,
    ...guardianApprovedEmail(approval.firstName, `${env.BETTER_AUTH_URL}/guardian/revoke/${approval.revokeToken}`),
  });
  return { ok: true };
}

export async function revokeAction(token: unknown): Promise<GuardianResult> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return { ok: false, error: "This link is not valid." };
  const limit = await rateLimit(`guardian-revoke:${hashToken(token)}`, 10, 60 * 60);
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Try again in an hour." };
  const done = await revokeGuardianApproval(token);
  return done ? { ok: true } : { ok: false, error: "This approval has already been withdrawn." };
}
