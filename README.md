# Almanac

A health and fitness tracker: nutrition, training, body metrics, sleep and recovery, with an AI coach that reads your own numbers. Every default, formula and limit is traced to a source in [`docs/RESEARCH.md`](docs/RESEARCH.md).

It is not medical advice and makes no compliance claims. Read [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) before letting real users in, especially anyone under 18.

## Quick start

```bash
pnpm install
cp .env.example .env.local      # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm dev
```

With no `DATABASE_URL`, development runs on PGlite, a real Postgres compiled to WebAssembly and stored in `./.data`. It migrates and seeds itself on first start, so there is nothing else to install.

To use a hosted Postgres (Supabase, Neon):

```bash
# put the pooled connection string in .env.local as DATABASE_URL, then
pnpm db:migrate
pnpm db:seed          # loads the 876-exercise library
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `BETTER_AUTH_SECRET` | Yes | Signs sessions and the age-gate cookie. At least 32 characters. |
| `BETTER_AUTH_URL` | In production | The site's public origin, e.g. `https://almanac.example`. |
| `DATABASE_URL` | In production | Postgres connection string. Supabase: the transaction pooler string. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | Enables "Continue with Google". Redirect URI: `<origin>/api/auth/callback/google`. |
| `OPENROUTER_API_KEY` | No | Enables the coach. Without it the app works and the weekly review uses the built-in rules. |
| `OPENROUTER_MODEL` | No | Default `anthropic/claude-haiku-5.5`. |
| `OPENROUTER_FALLBACK_MODEL` | No | Default `openai/gpt-6-luna`. Used if the first model fails before any text is shown. |
| `COACH_DAILY_MESSAGES` | No | Coach replies per person per day. Default 10. |
| `COACH_DAILY_USD_CAP` | No | Spending backstop per person per day. Default 0.10. |
| `COACH_MESSAGES_PER_MINUTE` | No | Default 6. |
| `USDA_API_KEY` | No | Free from fdc.nal.usda.gov. The default `DEMO_KEY` is heavily rate limited. |
| `OPENROUTER_DATA_COLLECTION` | No | Default `deny`: coach requests go only to zero-data-retention providers that do not train on prompts. |
| `COACH_REASONING` | No | `off` (default) or `low`. See `evals/report.md` before changing. |
| `RESEND_API_KEY`, `EMAIL_FROM` | For password reset | Without the key, production hides "Forgot your password?"; development writes the email to `.data/outbox.jsonl`. |
| `ALLOWED_COUNTRIES` | No | Default `US`. Sign-up is refused elsewhere when the host reports the visitor's country. |
| `OPERATOR_NAME`, `CONTACT_EMAIL` | Before launch | Shown on the privacy and terms pages. |

The environment is validated at startup (`lib/env.ts`); a missing or malformed value stops the server with a message naming it.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server on port 3000. |
| `pnpm build`, `pnpm start` | Production build and server. |
| `pnpm typecheck`, `pnpm lint` | TypeScript (strict) and ESLint. |
| `pnpm test` | Vitest: science, safety, insights, coach context, migrations. |
| `pnpm test:e2e` | Playwright against a production build on a throwaway database and a stub AI provider. Never touches `DATABASE_URL` or a paid API. |
| `pnpm db:generate` | Create a migration from schema changes. |
| `pnpm db:migrate`, `pnpm db:seed` | Apply migrations; load the exercise library. |
| `pnpm db:demo <email>` | Fill one existing account with five weeks of sample data. Development only. |
| `pnpm eval:coach` | Live evaluation of the coach against the real models (a few cents). Writes `evals/report.md`. |
| `pnpm support:clear <email>` | Operator tool: switch support mode off for an under-18 after a parent or clinician has been involved. |

## Architecture

```
app/
  (marketing)/   landing, research, style guide
  (auth)/        sign-up (age gate first), sign-in
  (app)/         today, food, train, body, trends, coach, settings, support
  api/           auth, food search and barcode, exercise search, coach chat (SSE), coach insights (JSON), data export
  welcome/       onboarding
lib/
  science/       pure calculations, no I/O, unit tested: energy, targets, trends, adaptive TDEE, strength, volume, MET, heart rate, BMI-for-age
  safety/        hard limits (policy.ts), message screening, support resources
  data/          the only code that queries user tables; every function takes the user id first
  ai/            OpenRouter client, context builder, prompts, fixed safety replies
  auth/          Better Auth config, age gate, session helpers
  db/            Drizzle schema, migrations, seeds, connection
  insights/      rule-based weekly review and nutrition insights
proxy.ts         per-request CSP nonce and the unauthenticated redirect
```

**Stack.** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4, Motion, Drizzle on Postgres, Better Auth, Zod 4, TanStack Query, visx, Vitest, Playwright.

**Why Drizzle.** Queries read like SQL, so "every query filters by user id" is easy to see in review; there is no engine binary; and one schema runs on Supabase's pooler and on PGlite.

**Data isolation.** Pages, actions and routes never hold a database handle. They call `lib/data`, whose functions require the session's user id. An ESLint rule blocks importing the connection anywhere else. Row Level Security is enabled with no policies on every table, so Supabase's public REST API can read nothing. End-to-end tests check that one user cannot see another's foods or workouts.

**Calculations.** All numbers shown to users come from `lib/science`, computed on the server. The client never submits a calorie target, and the AI coach cannot change one.

**The coach.**
- Called only from route handlers; the key is in a `server-only` module. A test asserts it never appears in any response to the browser.
- The model sees a compact block of numbers (about 1,200 tokens): age band, goal, targets, averages, trends. No name, email, account id or birth date. For under-18s and anyone in support mode, weight figures are withheld.
- The only user-typed text included is a short list of food names, scrubbed of markup and fenced as data. Tests cover a hostile food name.
- Messages are screened in code before any model is called. Self-harm and purging language get fixed, human-written replies with helplines; the model is not involved.
- Replies are checked afterwards; one that suggests eating below the calorie floor gets a visible correction.
- Limits: 10 replies a day per person, 6 a minute, and a dollar cap. Safety replies are never rationed.
- Failures: timeout, stalled stream, mid-stream error and empty reply are each handled; one retry on the fallback model if nothing has been shown yet.
- Verdicts ("below range", "12 minutes short") are computed in code and handed to the model, and figures are withheld when they should not be quoted: averages from too few days, all calorie and weight figures for under-18s, and every nutrition figure in a flagged conversation.
- `pnpm eval:coach` runs 11 fixed cases (adult, teen, sparse data, stalled weight, prompt injection, unsafe requests, distress, medical, supplements) on both models with coded assertions plus a reviewing model. Latest result: see `evals/report.md`. Expect a few percent of replies to contain a slip; the hard limits do not depend on the model.

**Age and safety.** See `lib/safety/policy.ts` and `docs/COMPLIANCE.md`. The 13+ gate is enforced inside the auth library's user-creation hook, not just in the UI.

## Tradeoffs worth knowing

- **Cache Components is off.** Next 16 enables it by default, but its docs say it cannot be combined with a nonce-based Content Security Policy. Strict CSP won, so every page is rendered per request.
- **Styles allow `'unsafe-inline'` in the CSP.** Animation writes style attributes, which a nonce cannot cover. Scripts are nonce-only.
- **Offline logging uses an experimental Next.js flag** (`experimental.useOffline`): actions wait and retry when the connection returns, and client-generated ids make retries idempotent. There is no service worker, so the app shell itself does not load offline.
- **Charts are server-rendered SVG** using visx scales and shapes with CSS draw-in animations, so they add no client JavaScript.
- **Custom foods share the `foods` table** with an owner column and a check constraint.

## Known gaps

- Email addresses are not verified at sign-up. Password reset works once `RESEND_API_KEY` is set.
- The privacy and terms pages are plain-language drafts that have not been reviewed by a lawyer.
- The launch-region check relies on the host's geo header and is not an access control.
- Google sign-in is configured but was not exercised end to end in testing.
- The coach has been run against the live OpenRouter API (both configured models, streaming chat and the structured review). Automated tests use a local stand-in, so a provider-side change would only show up in manual testing.
- Barcode scanning needs the browser's `BarcodeDetector` (Chrome, Edge, Android). Safari and Firefox fall back to typing the number.
- Micronutrients are stored where the source has them but are not shown yet.
- No Apple Health or Google Fit import.
- No exercise library browsing page or exercise instructions view; exercises are found through search when logging.
- Past entries for sleep, check-ins and weight can only be logged for today from the UI.
- Number and date formatting is fixed to `en-US`; units switch between metric and imperial.
- Helplines are United States only.
- Lighthouse mobile performance measured 88 to 98 (accessibility 100) on a local production build with normal run-to-run variance; it has not been measured on a deployed site.

## Before launch

1. Create a **separate Supabase project for production**. The development one contains test accounts and sample data. Run `pnpm db:migrate` and `pnpm db:seed` against the new one.
2. **Rotate** the database password, Google client secret and OpenRouter key if any were ever shared in plain text, and generate a new `BETTER_AUTH_SECRET` for production.
3. Scan the history for secrets: `gitleaks git .` (the history was checked by hand for the known values and common key patterns on 2026-10-09 and was clean).
4. Set `RESEND_API_KEY`, `EMAIL_FROM` (a verified domain), `OPERATOR_NAME`, `CONTACT_EMAIL`, `BETTER_AUTH_URL`, and add the production redirect URI in Google Cloud.
5. Have a lawyer review `/privacy`, `/terms` and `docs/COMPLIANCE.md`, and a clinician review `lib/safety/policy.ts` and the fixed replies in `lib/ai/safety-replies.ts`.
6. Run `pnpm eval:coach` and read the report.

## Data and licences

- **USDA FoodData Central**: public domain (CC0).
- **Open Food Facts**: Open Database License; credited wherever its products appear. See the note in `COMPLIANCE.md`.
- **Exercises**: [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain (Unlicense). Images are not used. Rebuild the seed with `node scripts/build-exercise-seed.mjs <exercises.json>`.
- **MET values**: 2024 Adult Compendium of Physical Activities.
- **BMI-for-age**: CDC 2000 growth charts.
- **Fonts**: Fraunces, Instrument Sans, Geist Mono (SIL Open Font License), self-hosted by `next/font`.
