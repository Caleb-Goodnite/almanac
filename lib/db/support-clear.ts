/**
 * Operator tool: switch support mode off for one account.
 *
 *   pnpm support:clear someone@example.com
 *
 * Under-18s cannot leave support mode from the app. Run this only after a
 * parent, guardian or clinician has been in touch. Targets are recomputed the
 * next time the person opens Settings and saves, or by the weekly update.
 */
import { eq } from "drizzle-orm";
import { closeDatabase, db } from "./client";
import { profile, user } from "./schema";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: pnpm support:clear <email>");
  const [account] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (!account) throw new Error(`No account with email ${email}.`);
  const updated = await db
    .update(profile)
    .set({ supportMode: false, supportModeAt: null, updatedAt: new Date() })
    .where(eq(profile.userId, account.id))
    .returning({ userId: profile.userId });
  console.log(updated.length ? `Support mode cleared for ${email}.` : "That account has no profile.");
  await closeDatabase();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDatabase();
  process.exit(1);
});
