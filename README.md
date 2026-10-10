# Almanac

A health and fitness tracker for the web: nutrition, training, body metrics, sleep and recovery in one place, with an AI coach that reads your own numbers. Every default, formula and limit is traced to a source in [`docs/RESEARCH.md`](docs/RESEARCH.md).

Almanac is not medical advice and makes no compliance claims. Read [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) before letting real users in, especially anyone under 18.

## Contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deploying](#deploying)
- [Mobile apps](#mobile-apps)
- [Architecture](#architecture)
- [Tradeoffs worth knowing](#tradeoffs-worth-knowing)
- [Known gaps](#known-gaps)
- [Before launch](#before-launch)
- [Data and licences](#data-and-licences)

## What it does

**Nutrition**
- A built-in list of 178 everyday foods (a banana, a slice of bread, a cup of rice) that opens at a typical serving, plus search across USDA FoodData Central and Open Food Facts, barcode scanning, custom foods and saved meals.
- Amounts can be entered in the food's own household measures, in grams, ounces or pounds, or in cups and spoons where the source gives the food's weight per cup. Everything is stored in grams.
- One-tap re-logging from recent and frequent foods, and "same as the day before" for a whole meal.
- Calorie and macro targets, water, daily and weekly views, and per-day micronutrient totals.

**Training**
- Routines and a set logger that shows last session's numbers inline, with a rest timer.
- An 876-exercise library with instructions and a progress chart per exercise.
- Personal records, estimated one-rep max, weekly hard sets per muscle group against a target range, and an "aim for today" suggestion.
- Cardio sessions with energy estimates and heart-rate zones.

**Body and recovery**
- Weight with a smoothed trend, measurements, sleep, and a ten-second daily check-in.
- Entries can be added or corrected for any past day.

**Targets that adapt**
- Starting targets come from published equations (Mifflin-St Jeor, Cunningham, Schofield for 13 to 17).
- After a few weeks of logging, energy needs are re-estimated from your own intake and weight trend.

**Today and trends**
- A dashboard for the day, trends over 7, 30 and 90 days or all time, and a plain-language weekly review.

**Coach**
- Streaming chat that sees a summary of your recent data, limited to 10 replies a day per person.
- It cannot change a target; all numbers come from code.

**Safety**
- A 13+ age gate that asks for a date of birth before any account exists.
- Stricter limits for 13 to 17 year olds, hard calorie floors for everyone, and a support mode that replaces optimisation with helplines when a message signals distress or disordered eating.
- An under-18 cannot set a fat-loss goal until a parent or guardian approves it from an emailed link, in seven deliberate steps. They can withdraw it at any time.

**Account**
- Email and password or Google sign-in, password reset, JSON export of everything held, and full account deletion.
- Light and dark themes, metric and imperial units, installable as a home-screen app.

## Quick start

Requires Node.js 20.9 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local      # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm dev
```

Open http://localhost:3000.

With no `DATABASE_URL`, development runs on PGlite, a real Postgres compiled to WebAssembly and stored in `./.data`. It migrates and seeds itself on first start, so there is nothing else to install.

To use a hosted Postgres (Supabase, Neon):

```bash
# put the pooled connection string in .env.local as DATABASE_URL, then
pnpm db:migrate
pnpm db:seed          # loads the exercise library and the everyday foods
```

To see the app with data in it, sign up, then fill that account with five weeks of sample logs:

```bash
pnpm db:demo you@example.com
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `BETTER_AUTH_SECRET` | Yes | Signs sessions and the age-gate cookie. At least 32 characters. |
| `BETTER_AUTH_URL` | In production | The site's public origin, e.g. `https://almanac.example`. |
| `DATABASE_URL` | In production | Postgres connection string. Supabase: the transaction pooler string. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | Enables "Continue with Google". Redirect URI: `<origin>/api/auth/callback/google`. |
| `GOOGLE_IOS_CLIENT_ID` | No | Enables Google sign-in inside the iPhone app. The "iOS" OAuth client id from the same Google Cloud project; public, not a secret. |
| `OPENROUTER_API_KEY` | No | Enables the coach. Without it the app works and the weekly review uses the built-in rules. |
| `OPENROUTER_MODEL` | No | Default `anthropic/claude-haiku-5.5`. |
| `OPENROUTER_FALLBACK_MODEL` | No | Default `openai/gpt-6-luna`. Used if the first model fails before any text is shown. |
| `COACH_DAILY_MESSAGES` | No | Coach replies per person per day. Default 10. |
| `COACH_DAILY_USD_CAP` | No | Spending backstop per person per day. Default 0.10. |
| `COACH_MESSAGES_PER_MINUTE` | No | Default 6. |
| `COACH_REASONING` | No | `off` (default) or `low`. See `evals/report.md` before changing. |
| `OPENROUTER_DATA_COLLECTION` | No | Default `deny`: coach requests go only to zero-data-retention providers that do not train on prompts. |
| `USDA_API_KEY` | No | Free from fdc.nal.usda.gov. The default `DEMO_KEY` is heavily rate limited. |
| `RESEND_API_KEY`, `EMAIL_FROM` | For password reset and guardian approval | Without the key, production hides "Forgot your password?" and under-18s cannot ask for fat-loss approval; development writes the email to `.data/outbox.jsonl`. |
| `ALLOWED_COUNTRIES` | No | Default `US`. Sign-up is refused elsewhere when the host reports the visitor's country. |
| `OPERATOR_NAME`, `CONTACT_EMAIL` | Before launch | Shown on the privacy and terms pages. |

The environment is validated at startup (`lib/env.ts`); a missing or malformed value stops the server with a message naming it. `.env.local` is gitignored and must never be committed.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server on port 3000. |
| `pnpm build`, `pnpm start` | Production build and server. |
| `pnpm typecheck`, `pnpm lint` | TypeScript (strict) and ESLint. |
| `pnpm test` | Unit tests (Vitest). |
| `pnpm test:e2e` | End-to-end tests (Playwright). |
| `pnpm db:generate` | Create a migration from schema changes. |
| `pnpm db:migrate`, `pnpm db:seed` | Apply migrations; load the exercise library and the everyday foods. |
| `pnpm db:demo <email>` | Fill one existing account with five weeks of sample data. Development only. |
| `pnpm eval:coach` | Live evaluation of the coach against the real models (a few cents). Writes `evals/report.md`. |
| `pnpm support:clear <email>` | Operator tool: switch support mode off for an under-18 after a parent or clinician has been involved. |

## Testing

- **Unit (`pnpm test`):** the science and safety modules against published worked values, the rule-based insights, the coach's context builder, and the migrations.
- **End to end (`pnpm test:e2e`):** runs a production build on a throwaway database with a stand-in AI provider, so it never touches `DATABASE_URL` or a paid API. It covers sign-up and the age gate, the guardian approval flow, logging a meal and a workout, the coach, password reset, offline logging, barcode scanning on a fake camera, and an axe accessibility scan (WCAG 2.2 AA) in both themes. The first run needs `pnpm exec playwright install chromium`.
- **Coach evaluation (`pnpm eval:coach`):** 11 fixed cases on both configured models with coded assertions plus a reviewing model. It calls the real API and costs a few cents.

## Deploying

The app is a standard Next.js server and runs anywhere Node does. On Vercel:

1. Import the repository. The defaults (framework Next.js, `pnpm build`) need no changes.
2. Add the environment variables from the table above under **Settings → Environment Variables**. Set `BETTER_AUTH_URL` to the production origin.
3. Run `pnpm db:migrate` and `pnpm db:seed` once against the production database from your own machine.
4. Add the production redirect URI, `<origin>/api/auth/callback/google`, to the Google OAuth client.
5. For a custom domain, add it under **Settings → Domains**, create the CNAME record Vercel shows, and update `BETTER_AUTH_URL` and the Google redirect URI to match.

Work through [Before launch](#before-launch) first. `GET /api/health` reports whether the server can reach the database, for uptime checks.

## Mobile apps

The Android app (and, later, the iOS app) is a [Capacitor](https://capacitorjs.com) shell: a native web view that opens the deployed site. Almanac renders on the server, so nothing is bundled into the app except the page shown when the site cannot be reached (`mobile/www`).

Building needs a JDK (21) and the Android SDK, with `ANDROID_HOME` set.

```bash
pnpm mobile:android            # builds android/app/build/outputs/apk/debug/app-debug.apk
pnpm mobile:android:install    # builds and installs on a phone connected with USB debugging on
```

- **Which site it opens:** `https://health.anchorforgedigital.com`, set in `capacitor.config.ts`. Set `CAP_SERVER_URL` before building to point a build somewhere else.
- **Google sign-in uses the native account sheet.** Google refuses its web sign-in inside web views, so the apps ask the phone for a Google ID token and the server verifies it. Android needs an "Android" OAuth client (package name and the signing certificate's SHA-1) in Google Cloud; iPhone needs an "iOS" OAuth client, its id in `GOOGLE_IOS_CLIENT_ID`, and its reversed id as a URL scheme in `ios/App/App/Info.plist`. Without those the button is hidden on that platform.
- **Barcode scanning** uses the camera through the web view; the app asks for camera permission the first time.
- **Icons and splash screens** are drawn by `pnpm exec tsx scripts/build-mobile-icons.tsx`.
- **Store release:** the debug build is for testing on your own phone. A Play Store release needs a signing key and a release build, and app stores may reject apps that are only a wrapper around a website.

## Architecture

```
app/
  (marketing)/   landing, research, privacy, terms, style guide
  (auth)/        sign-up (age gate first), sign-in, password reset
  (app)/         today, food, train, body, trends, coach, settings, support
  api/           auth, food search and barcode, exercise search, coach chat (SSE), coach insights (JSON), data export, health
  welcome/       onboarding
components/      ui primitives, charts, and one folder per feature
lib/
  science/       pure calculations, no I/O, unit tested: energy, targets, trends, adaptive TDEE, strength, volume, MET, heart rate, BMI-for-age
  safety/        hard limits (policy.ts), message screening, support resources, region check
  data/          the only code that queries user tables; every function takes the user id first
  ai/            OpenRouter client, context builder, prompts, fixed safety replies
  auth/          Better Auth config, age gate, session helpers
  db/            Drizzle schema, migrations, seeds, connection
  insights/      rule-based weekly review and nutrition insights
evals/           live coach evaluation and its latest report
tests/           Playwright specs and the stand-in AI provider
proxy.ts         per-request CSP nonce and the unauthenticated redirect
```

**Stack.** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4, Motion, Drizzle on Postgres, Better Auth, Zod 4, TanStack Query, visx, Vitest, Playwright.

**Why Drizzle.** Queries read like SQL, so "every query filters by user id" is easy to see in review; there is no engine binary; and one schema runs on Supabase's pooler and on PGlite.

**Data isolation.** Pages, actions and routes never hold a database handle. They call `lib/data`, whose functions require the session's user id. An ESLint rule blocks importing the connection anywhere else. Row Level Security is enabled with no policies on every table, so Supabase's public REST API can read nothing. End-to-end tests check that one user cannot see another's foods or workouts.

**Calculations.** All numbers shown to users come from `lib/science`, computed on the server. The client never submits a calorie target, and the AI coach cannot change one.

**The coach.**
- Called only from route handlers; the key is in a `server-only` module. A test asserts it never appears in any response to the browser.
- The model sees a compact block of numbers (about 1,200 tokens): age band, goal, targets, averages, trends. No name, email, account id or birth date.
- The only user-typed text included is a short list of food names, scrubbed of markup and fenced as data. Tests cover a hostile food name.
- Messages are screened in code before any model is called. Self-harm and purging language get fixed, human-written replies with helplines; the model is not involved.
- Replies are checked afterwards; one that suggests eating below the calorie floor gets a visible correction.
- Limits: 10 replies a day per person, 6 a minute, and a dollar cap. Safety replies are never rationed.
- Failures: timeout, stalled stream, mid-stream error and empty reply are each handled; one retry on the fallback model if nothing has been shown yet.
- Verdicts ("below range", "12 minutes short") are computed in code and handed to the model, and figures are withheld when they should not be quoted: averages from too few days, all calorie and weight figures for under-18s, and every nutrition figure in a flagged conversation.
- Latest evaluation result: see `evals/report.md`. Expect a few percent of replies to contain a slip; the hard limits do not depend on the model.

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
- Automated tests use a stand-in AI provider, so a provider-side change would only show up in `pnpm eval:coach` or manual testing.
- Barcode scanning uses the browser's `BarcodeDetector` where it exists and ZXing elsewhere (Safari, Firefox). Both paths are tested with a generated barcode on a fake camera; neither has been tried on a physical iPhone.
- Micronutrient totals cover only foods whose source lists them, so they are a lower bound.
- No Apple Health or Google Fit import.
- Guardian approval is friction and informed consent, not identity verification: the app cannot prove who opened the email. See `docs/COMPLIANCE.md`.
- Under-18s cannot leave support mode in the app; the operator clears it with `pnpm support:clear`. There is no parent-facing flow.
- Number and date formatting is fixed to `en-US`; units switch between metric and imperial.
- Helplines are United States only.
- Lighthouse mobile performance measured 89 to 98 (accessibility 100) on a local production build with normal run-to-run variance; it has not been measured on a deployed site.

## Before launch

1. Create a **separate database for production**. A development one will contain test accounts and sample data. Run `pnpm db:migrate` and `pnpm db:seed` against the new one.
2. **Rotate** the database password, Google client secret and OpenRouter key if any were ever shared in plain text, and generate a new `BETTER_AUTH_SECRET` for production.
3. Scan the history for secrets: `gitleaks git .` (the history was checked by hand for the known values and common key patterns on 2026-10-09 and was clean).
4. Set `RESEND_API_KEY`, `EMAIL_FROM` (a verified domain), `OPERATOR_NAME`, `CONTACT_EMAIL`, `BETTER_AUTH_URL`, and add the production redirect URI in Google Cloud.
5. Have a lawyer review `/privacy`, `/terms` and `docs/COMPLIANCE.md`, and a clinician review `lib/safety/policy.ts` and the fixed replies in `lib/ai/safety-replies.ts`.
6. Run `pnpm eval:coach` and read the report.

## Data and licences

No licence has been chosen for Almanac's own code yet, so by default all rights are reserved. Add a `LICENSE` file before making the repository public if others should be able to use it.

Third-party data:

- **USDA FoodData Central**: public domain (CC0).
- **Open Food Facts**: Open Database License; credited wherever its products appear. See the note in `COMPLIANCE.md`.
- **Everyday foods**: nutrients and household measures from USDA FoodData Central (SR Legacy, public domain); the friendly names and default servings are chosen in `scripts/build-common-foods.mjs`, which rebuilds `lib/db/seed-data/common-foods.json`.
- **Exercises**: [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain (Unlicense). Images are not used. Rebuild the seed with `node scripts/build-exercise-seed.mjs <exercises.json>`.
- **MET values**: 2024 Adult Compendium of Physical Activities.
- **BMI-for-age**: CDC 2000 growth charts.
- **Fonts**: Fraunces, Instrument Sans, Geist Mono (SIL Open Font License), self-hosted by `next/font`.
