import "server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { env, features } from "@/lib/env";
import { regionAllowed } from "@/lib/safety/region";
import { AGE_OK_COOKIE, readCookie, verifyAgeToken } from "./age-gate";

type HookContext = { headers?: Headers; request?: Request } | null | undefined;

function ageClaimFrom(ctx: HookContext) {
  const cookieHeader = ctx?.headers?.get("cookie") ?? ctx?.request?.headers.get("cookie");
  return verifyAgeToken(readCookie(cookieHeader, AGE_OK_COOKIE));
}

export const auth = betterAuth({
  appName: "Almanac",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],

  database: drizzleAdapter(db, { provider: "pg", schema }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Addresses are not verified at sign-up (see README "Known gaps").
    requireEmailVerification: false,
    // Password reset. The link is valid for one hour and signs out every other
    // session when used. The send is not awaited, so response time does not
    // reveal whether an address has an account.
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Reset your Almanac password",
        text: [
          "Someone asked to reset the password for your Almanac account.",
          "",
          `Choose a new password here (the link works for one hour):`,
          url,
          "",
          "If this was not you, you can ignore this email. Your password has not changed.",
        ].join("\n"),
      });
    },
  },

  socialProviders: features.google
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 300 },
  },

  user: {
    deleteUser: { enabled: true },
  },

  // Counters live in Postgres so limits hold across serverless instances.
  rateLimit: {
    // Off only for automated tests, which sign up many accounts from one address.
    enabled: env.NODE_ENV !== "test" && !env.ALMANAC_E2E,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/delete-user": { window: 60 * 10, max: 3 },
      "/request-password-reset": { window: 60 * 10, max: 3 },
      "/reset-password": { window: 60 * 10, max: 5 },
    },
  },

  advanced: {
    cookiePrefix: "almanac",
    useSecureCookies: env.NODE_ENV === "production" && env.BETTER_AUTH_URL.startsWith("https://"),
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
  },

  onAPIError: { errorURL: "/sign-up" },

  databaseHooks: {
    user: {
      create: {
        // The age gate, enforced where accounts are actually created. This
        // covers email sign-up and first-time Google sign-in alike.
        before: async (data, ctx) => {
          const hook = ctx as HookContext;
          const requestHeaders = hook?.headers ?? hook?.request?.headers;
          if (requestHeaders && !regionAllowed(requestHeaders, env.ALLOWED_COUNTRIES)) {
            throw new APIError("FORBIDDEN", {
              code: "REGION_UNAVAILABLE",
              message: "Almanac is not available in your country yet.",
            });
          }
          if (!ageClaimFrom(ctx as HookContext)) {
            throw new APIError("FORBIDDEN", {
              code: "AGE_REQUIRED",
              message: "Please confirm your date of birth before creating an account.",
            });
          }
          return { data };
        },
        after: async (user, ctx) => {
          const claim = ageClaimFrom(ctx as HookContext);
          if (!claim) return;
          await db
            .insert(schema.profile)
            .values({ userId: user.id, birthYear: claim.birthYear, birthMonth: claim.birthMonth })
            .onConflictDoNothing();
        },
      },
    },
  },

  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
