"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AGE_BLOCK_COOKIE,
  AGE_BLOCK_TTL_SECONDS,
  AGE_OK_COOKIE,
  AGE_OK_TTL_SECONDS,
  checkDateOfBirth,
  issueAgeToken,
  todayUtc,
} from "@/lib/auth/age-gate";
import { dobSchema } from "@/lib/validation/onboarding";

export type AgeFormState = { error?: string };

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function verifyAge(_prev: AgeFormState, formData: FormData): Promise<AgeFormState> {
  const jar = await cookies();
  // Once blocked, the answer does not change for a day whatever is submitted.
  if (jar.get(AGE_BLOCK_COOKIE)) redirect("/sign-up");

  const parsed = dobSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    day: formData.get("day"),
  });
  if (!parsed.success) return { error: "Enter your full date of birth." };

  const { year, month, day } = parsed.data;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const result = checkDateOfBirth(iso, todayUtc());

  if (!result.ok && result.reason === "invalid") {
    return { error: "That date does not look right. Check the day, month and year." };
  }
  if (!result.ok) {
    // Under 13: remember only that this browser was turned away. The date
    // itself is discarded here and never written anywhere.
    jar.set(AGE_BLOCK_COOKIE, "1", { ...cookieBase, maxAge: AGE_BLOCK_TTL_SECONDS });
    jar.delete(AGE_OK_COOKIE);
    redirect("/sign-up");
  }

  jar.set(AGE_OK_COOKIE, issueAgeToken(result.claim), { ...cookieBase, maxAge: AGE_OK_TTL_SECONDS });
  redirect("/sign-up");
}

/** Lets someone who passed the gate correct a mistyped date. */
export async function clearAge(): Promise<void> {
  const jar = await cookies();
  jar.delete(AGE_OK_COOKIE);
  redirect("/sign-up");
}
