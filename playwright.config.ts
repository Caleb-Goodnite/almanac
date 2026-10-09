import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const STUB_PORT = 4011;
const BASE = `http://localhost:${PORT}`;

/**
 * End-to-end tests run a production build on a throwaway in-process database
 * (ALMANAC_E2E=1 with DATABASE_URL blanked, see lib/db/client.ts) and a local
 * stand-in for OpenRouter. They never touch a real database or a paid API.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    // Most logging happens on a phone, so that is what is tested.
    ...devices["Pixel 7"],
  },
  webServer: [
    {
      command: "node tests/stubs/openrouter-stub.mjs",
      url: `http://127.0.0.1:${STUB_PORT}/__calls`,
      env: { STUB_PORT: String(STUB_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `pnpm build && rm -rf .data/e2e .data/outbox.jsonl && pnpm start -p ${PORT}`,
      url: BASE,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        ALMANAC_E2E: "1",
        DATABASE_URL: "",
        BETTER_AUTH_URL: BASE,
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        OPENROUTER_API_KEY: "stub-key",
        OPENROUTER_BASE_URL: `http://127.0.0.1:${STUB_PORT}/api/v1`,
        COACH_MESSAGES_PER_MINUTE: "30",
        COACH_DAILY_MESSAGES: "5",
      },
    },
  ],
});
