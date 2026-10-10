import { z } from "zod";

/**
 * Server environment, validated once at startup (imported by instrumentation.ts).
 * Only server code may import this. It is not marked `server-only` because the
 * migration and seed scripts run it outside Next; on a client it would throw,
 * since none of these variables exist in the browser.
 */
// Treat `FOO=` in an env file as "not set" rather than as an empty value.
const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Postgres connection string (Supabase/Neon). When unset outside production
    // the app runs on PGlite, an in-process Postgres stored under ./.data.
    DATABASE_URL: z.url().optional(),

    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),

    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    // The "iOS" OAuth client from the same Google Cloud project. Needed only for
    // Google sign-in inside the iPhone app; it is public, not a secret.
    GOOGLE_IOS_CLIENT_ID: z.string().min(1).optional(),

    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_MODEL: z.string().default("anthropic/claude-haiku-5.5"),
    OPENROUTER_FALLBACK_MODEL: z.string().default("openai/gpt-6-luna"),
    // Points the coach at a stub server in end-to-end tests.
    OPENROUTER_BASE_URL: z.url().default("https://openrouter.ai/api/v1"),
    // "low" lets the model think briefly before answering. Slower to start and
    // roughly double the cost, but better at arithmetic. See evals/report.md.
    COACH_REASONING: z.enum(["off", "low"]).default("off"),
    COACH_DAILY_USD_CAP: z.coerce.number().positive().default(0.1),
    COACH_MESSAGES_PER_MINUTE: z.coerce.number().int().positive().default(6),
    // How many coach replies each person gets per day (UTC). Safety replies do not count.
    COACH_DAILY_MESSAGES: z.coerce.number().int().positive().default(10),

    // "deny" keeps coach requests away from providers that store or train on prompts.
    OPENROUTER_DATA_COLLECTION: z.enum(["deny", "allow"]).default("deny"),

    USDA_API_KEY: z.string().min(1).default("DEMO_KEY"),

    // Email (password reset). Without RESEND_API_KEY, production hides the reset
    // link; development writes emails to .data/outbox.jsonl instead of sending.
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).default("Almanac <onboarding@resend.dev>"),

    // Shown on the privacy and terms pages. Set both before launch.
    OPERATOR_NAME: z.string().min(1).optional(),
    CONTACT_EMAIL: z.email().optional(),

    // Comma-separated ISO country codes where sign-up is open. The country comes
    // from the hosting platform's geo header; with no header (local, some hosts)
    // sign-up is not restricted.
    ALLOWED_COUNTRIES: z.string().default("US"),

    // End-to-end test mode: run a production build on a throwaway local
    // database. Refused if DATABASE_URL is also set, so tests can never touch
    // a real database.
    ALMANAC_E2E: z.enum(["1"]).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.ALMANAC_E2E && env.DATABASE_URL) {
      ctx.addIssue({ code: "custom", path: ["ALMANAC_E2E"], message: "cannot be combined with DATABASE_URL" });
    }
    if (env.NODE_ENV === "production" && !env.DATABASE_URL && !env.ALMANAC_E2E) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "is required in production",
      });
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_SECRET"],
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
      });
    }
  });

export type Env = z.infer<typeof schema>;

function load(): Env {
  const cleaned = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, blankToUndefined(v)]));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new Error(
      `Invalid environment. Copy .env.example to .env.local and fix:\n${lines.join("\n")}`,
    );
  }
  return parsed.data;
}

export const env = load();

export const features = {
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  coach: Boolean(env.OPENROUTER_API_KEY),
  // Password reset is offered when email can be sent, or outside production
  // where the message is written to a local outbox for testing.
  passwordReset: Boolean(env.RESEND_API_KEY) || env.NODE_ENV !== "production" || Boolean(env.ALMANAC_E2E),
  // Guardian approval for an under-18's fat-loss goal travels by email too.
  guardianApproval: Boolean(env.RESEND_API_KEY) || env.NODE_ENV !== "production" || Boolean(env.ALMANAC_E2E),
} as const;
