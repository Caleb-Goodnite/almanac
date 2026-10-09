import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { guardianConsents, profile, user } from "@/lib/db/schema";
import { REQUEST_TTL_DAYS, maskEmail, type Relationship } from "@/lib/safety/guardian";
import { hashToken, newToken } from "@/lib/safety/guardian-token";
import { ageFacts, recomputeTargets } from "./profile";

export type GuardianStatus =
  | { state: "none" }
  | { state: "pending"; sentTo: string; expiresAt: Date }
  | { state: "expired"; sentTo: string }
  | { state: "approved"; by: string; relationship: string; at: Date }
  | { state: "revoked"; at: Date };

/** Where an under-18's fat-loss approval stands, for their own Settings page. */
export async function getGuardianStatus(userId: string): Promise<GuardianStatus> {
  const [row] = await db
    .select()
    .from(guardianConsents)
    .where(eq(guardianConsents.userId, userId))
    .orderBy(desc(guardianConsents.createdAt))
    .limit(1);
  if (!row) return { state: "none" };
  if (row.status === "approved" && row.approvedAt) {
    return { state: "approved", by: row.guardianName ?? "", relationship: row.relationship ?? "", at: row.approvedAt };
  }
  if (row.status === "revoked" && row.revokedAt) return { state: "revoked", at: row.revokedAt };
  const sentTo = maskEmail(row.guardianEmail);
  if (row.expiresAt < new Date()) return { state: "expired", sentTo };
  return { state: "pending", sentTo, expiresAt: row.expiresAt };
}

/**
 * Starts a new request and returns the one-time token for the emailed link.
 * Any earlier unanswered request from the same user is dropped, so only the
 * newest link works.
 */
export async function createGuardianRequest(userId: string, guardianEmail: string): Promise<string> {
  const token = newToken();
  await db.transaction(async (tx) => {
    await tx
      .delete(guardianConsents)
      .where(and(eq(guardianConsents.userId, userId), eq(guardianConsents.status, "pending")));
    await tx.insert(guardianConsents).values({
      userId,
      guardianEmail: guardianEmail.trim().toLowerCase(),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000),
    });
  });
  return token;
}

export async function cancelGuardianRequest(userId: string): Promise<void> {
  await db
    .delete(guardianConsents)
    .where(and(eq(guardianConsents.userId, userId), eq(guardianConsents.status, "pending")));
}

export type GuardianRequest = {
  /** The teen's first name only. Nothing else about the account is shown to the guardian. */
  firstName: string;
  state: "pending" | "expired" | "approved" | "revoked" | "adult";
};

function firstNameOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.replace(/[^\p{L}\p{M}'’-]/gu, "").slice(0, 40) || "Your teen";
}

/**
 * Looks a request up by the token from the emailed link. This is the one place
 * a row is read without a session: holding the token is the authorisation.
 */
export async function findGuardianRequest(token: string): Promise<GuardianRequest | null> {
  const [row] = await db
    .select({
      status: guardianConsents.status,
      expiresAt: guardianConsents.expiresAt,
      name: user.name,
      birthYear: profile.birthYear,
      birthMonth: profile.birthMonth,
      timezone: profile.timezone,
    })
    .from(guardianConsents)
    .innerJoin(user, eq(user.id, guardianConsents.userId))
    .innerJoin(profile, eq(profile.userId, guardianConsents.userId))
    .where(eq(guardianConsents.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return null;
  const firstName = firstNameOf(row.name);
  if (row.status !== "pending") return { firstName, state: row.status };
  if (!ageFacts(row).isTeen) return { firstName, state: "adult" };
  if (row.expiresAt < new Date()) return { firstName, state: "expired" };
  return { firstName, state: "pending" };
}

export type Approval = { firstName: string; guardianEmail: string; revokeToken: string };

/**
 * Records the approval, switches the teen's goal to fat loss and recomputes
 * their targets (which stay inside every teen limit in lib/safety/policy.ts).
 * Returns null if the link is unknown, used, expired or the user is now an adult.
 */
export async function approveGuardianRequest(
  token: string,
  guardian: { name: string; relationship: Relationship },
): Promise<Approval | null> {
  const request = await findGuardianRequest(token);
  if (request?.state !== "pending") return null;

  const revokeToken = newToken();
  const [row] = await db
    .update(guardianConsents)
    .set({
      status: "approved",
      approvedAt: new Date(),
      guardianName: guardian.name,
      relationship: guardian.relationship,
      revokeTokenHash: hashToken(revokeToken),
    })
    .where(
      and(
        eq(guardianConsents.tokenHash, hashToken(token)),
        eq(guardianConsents.status, "pending"),
        gt(guardianConsents.expiresAt, new Date()),
      ),
    )
    .returning({ userId: guardianConsents.userId, guardianEmail: guardianConsents.guardianEmail });
  if (!row) return null;

  await db
    .update(profile)
    .set({ goal: "lose_fat", weeklyRatePct: 0, updatedAt: new Date() })
    .where(eq(profile.userId, row.userId));
  await recomputeTargets(row.userId, true);
  return { firstName: request.firstName, guardianEmail: row.guardianEmail, revokeToken };
}

/** The teen's first name for an approval that can still be withdrawn, or null. */
export async function findRevocable(revokeToken: string): Promise<{ firstName: string } | null> {
  const [row] = await db
    .select({ name: user.name })
    .from(guardianConsents)
    .innerJoin(user, eq(user.id, guardianConsents.userId))
    .where(and(eq(guardianConsents.revokeTokenHash, hashToken(revokeToken)), eq(guardianConsents.status, "approved")))
    .limit(1);
  return row ? { firstName: firstNameOf(row.name) } : null;
}

/** Withdraws an approval and puts the teen back on maintenance targets. */
export async function revokeGuardianApproval(revokeToken: string): Promise<boolean> {
  const [row] = await db
    .update(guardianConsents)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(eq(guardianConsents.revokeTokenHash, hashToken(revokeToken)), eq(guardianConsents.status, "approved")))
    .returning({ userId: guardianConsents.userId });
  if (!row) return false;
  await db
    .update(profile)
    .set({ goal: "maintain", weeklyRatePct: 0, updatedAt: new Date() })
    .where(and(eq(profile.userId, row.userId), eq(profile.goal, "lose_fat")));
  await recomputeTargets(row.userId);
  return true;
}
