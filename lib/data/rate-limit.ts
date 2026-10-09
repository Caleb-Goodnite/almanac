import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appRateLimits } from "@/lib/db/schema";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Fixed-window rate limit backed by Postgres, so it holds across serverless
 * instances with no extra infrastructure. One atomic upsert per check.
 * `key` should already include the user id, e.g. `coach:${userId}`.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);

  const [row] = await db
    .insert(appRateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [appRateLimits.key, appRateLimits.windowStart],
      set: { count: sql`${appRateLimits.count} + 1` },
    })
    .returning({ count: appRateLimits.count });

  // Opportunistic cleanup of old windows, roughly one call in fifty.
  if (Math.random() < 0.02) {
    await db.delete(appRateLimits).where(lt(appRateLimits.windowStart, new Date(now - 24 * 60 * 60 * 1000)));
  }

  const count = row?.count ?? 1;
  const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now) / 1000);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
}
