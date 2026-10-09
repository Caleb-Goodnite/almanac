import { createHmac, timingSafeEqual } from "node:crypto";
import { ageFromBirthDate, parseDate, type CalendarDate } from "@/lib/science/age";
import { MINIMUM_AGE } from "@/lib/safety/policy";

/**
 * The age gate.
 *
 * A visitor enters a date of birth before any account exists. If they are
 * under 13 we keep nothing about them except a short-lived "blocked" cookie,
 * which stops the form being retried with a different date straight away (a
 * neutral age screen, as the FTC's COPPA guidance describes).
 *
 * If they pass, we issue a signed, short-lived cookie holding only the month
 * and year of birth. Account creation is refused on the server unless that
 * cookie is present and valid (see lib/auth/index.ts), so the gate cannot be
 * skipped by calling the sign-up API directly.
 */

export const AGE_OK_COOKIE = "almanac_age";
export const AGE_BLOCK_COOKIE = "almanac_age_block";
export const AGE_OK_TTL_SECONDS = 60 * 60;
export const AGE_BLOCK_TTL_SECONDS = 60 * 60 * 24;

export type AgeClaim = { birthYear: number; birthMonth: number };

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`age-gate:${payload}`).digest("base64url");
}

export function issueAgeToken(claim: AgeClaim, nowMs = Date.now()): string {
  const expires = Math.floor(nowMs / 1000) + AGE_OK_TTL_SECONDS;
  const payload = `${claim.birthYear}.${claim.birthMonth}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAgeToken(token: string | undefined | null, nowMs = Date.now()): AgeClaim | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [y, m, exp, mac] = parts as [string, string, string, string];
  const expected = sign(`${y}.${m}.${exp}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const birthYear = Number(y);
  const birthMonth = Number(m);
  const expires = Number(exp);
  if (!Number.isInteger(birthYear) || !Number.isInteger(birthMonth) || !Number.isInteger(expires)) return null;
  if (expires * 1000 < nowMs) return null;
  if (birthMonth < 1 || birthMonth > 12) return null;
  return { birthYear, birthMonth };
}

export type AgeCheck =
  | { ok: true; claim: AgeClaim; age: number }
  | { ok: false; reason: "invalid" | "under_age" };

/** Evaluates a date of birth (YYYY-MM-DD) against the minimum age. */
export function checkDateOfBirth(dob: string, today: CalendarDate): AgeCheck {
  const birth = parseDate(dob);
  if (!birth) return { ok: false, reason: "invalid" };
  const age = ageFromBirthDate(birth, today);
  if (age < 0 || age > 120) return { ok: false, reason: "invalid" };
  if (age < MINIMUM_AGE) return { ok: false, reason: "under_age" };
  return { ok: true, claim: { birthYear: birth.year, birthMonth: birth.month }, age };
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function todayUtc(): CalendarDate {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
