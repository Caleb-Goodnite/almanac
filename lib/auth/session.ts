import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ageFacts, enforceGuardianLock, getProfile, type Profile } from "@/lib/data/profile";
import { auth } from "./index";

/** The current session, read once per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** The signed-in user's id, or a redirect to sign-in. Call this in every protected page, action and route. */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user.id;
}

export type Viewer = {
  userId: string;
  /** Used for greetings only. Never sent to the AI provider. */
  firstName: string;
  profile: Profile;
  ageYears: number;
  ageMonths: number;
  isTeen: boolean;
};

const loadViewer = cache(async (): Promise<Viewer | "no-session" | "no-profile"> => {
  const session = await getSession();
  if (!session) return "no-session";
  let profile = await getProfile(session.user.id);
  if (!profile) return "no-profile";
  // An under-18's fat-loss goal only stands while a guardian's approval does.
  if (profile.goal === "lose_fat" && ageFacts(profile).isTeen && (await enforceGuardianLock(session.user.id))) {
    profile = (await getProfile(session.user.id)) ?? profile;
  }
  return {
    userId: session.user.id,
    firstName: session.user.name.trim().split(/\s+/)[0] ?? "",
    profile,
    ...ageFacts(profile),
  };
});

/** The signed-in, onboarded user, or null. For route handlers, which answer with a status code instead of a redirect. */
export async function getViewer(): Promise<Viewer | null> {
  const viewer = await loadViewer();
  if (typeof viewer === "string" || !viewer.profile.onboardedAt) return null;
  return viewer;
}

/**
 * The signed-in, onboarded user. Redirects to sign-in, to the age gate (an
 * account with no profile never passed it), or to onboarding as needed.
 */
export async function requireViewer(options: { allowNotOnboarded?: boolean } = {}): Promise<Viewer> {
  const viewer = await loadViewer();
  if (viewer === "no-session") redirect("/sign-in");
  if (viewer === "no-profile") redirect("/sign-up?error=AGE_REQUIRED");
  if (!viewer.profile.onboardedAt && !options.allowNotOnboarded) redirect("/welcome");
  return viewer;
}
