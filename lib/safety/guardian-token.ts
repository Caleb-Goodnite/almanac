import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MAX_SESSION_SECONDS, MIN_READ_SECONDS } from "./guardian";

/** Link tokens and timing checks for guardian approval. Server only: uses node:crypto. */

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`guardian:${payload}`).digest("base64url");
}

/** A signed note of when the approval page was opened, bound to one request. */
export function issueStartStamp(tokenHash: string, nowMs = Date.now()): string {
  return `${nowMs}.${sign(`${tokenHash}.${nowMs}`)}`;
}

export type StampCheck = "ok" | "invalid" | "too_soon" | "expired";

export function checkStartStamp(stamp: string, tokenHash: string, nowMs = Date.now()): StampCheck {
  const [at = "", mac = ""] = stamp.split(".");
  const expected = Buffer.from(sign(`${tokenHash}.${at}`));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "invalid";
  const elapsed = (nowMs - Number(at)) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < 0) return "invalid";
  if (elapsed < MIN_READ_SECONDS) return "too_soon";
  if (elapsed > MAX_SESSION_SECONDS) return "expired";
  return "ok";
}
