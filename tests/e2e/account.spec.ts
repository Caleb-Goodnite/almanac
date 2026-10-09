import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { enterBirthDate, newAccount, signUpAdult } from "./helpers";

const OUTBOX = path.join(process.cwd(), ".data", "outbox.jsonl");

function lastEmailTo(address: string): { subject: string; text: string } {
  const lines = readFileSync(OUTBOX, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { to: string; subject: string; text: string });
  const mine = lines.filter((l) => l.to === address);
  if (mine.length === 0) throw new Error(`No email to ${address}`);
  return mine[mine.length - 1]!;
}

test("a forgotten password can be reset by email, and the old one stops working", async ({ page }) => {
  const account = await signUpAdult(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill(account.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  let link = "";
  await expect(async () => {
    const email = lastEmailTo(account.email);
    expect(email.subject).toMatch(/Reset your Almanac password/);
    link = /https?:\/\/\S+/.exec(email.text)![0];
  }).toPass({ timeout: 10_000 });

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  const fresh = `new-${account.password}`;
  await page.getByLabel("New password").fill(fresh);
  await page.getByLabel("Type it again").fill(fresh);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText(/Your password has been changed/)).toBeVisible();

  // The old password no longer works; the new one does.
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "!" })).toContainText(/do not match/);
  await page.getByLabel("Password").fill(fresh);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Today/ })).toBeVisible();

  // A reset link works once.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: /no longer works|Choose a new password/ })).toBeVisible();
  if (await page.getByRole("heading", { name: "Choose a new password" }).isVisible()) {
    await page.getByLabel("New password").fill(`again-${fresh}`);
    await page.getByLabel("Type it again").fill(`again-${fresh}`);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "!" })).toContainText(/expired or was already used/);
  }
});

test("asking to reset an unknown address looks exactly the same", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(newAccount().email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test.describe("outside the launch region", () => {
  test.use({ extraHTTPHeaders: { "x-vercel-ip-country": "DE" } });

  test("sign-up is closed and says why, in the page and in the API", async ({ page, request }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: /not available in your country yet/ })).toBeVisible();
    await expect(page.getByLabel("Year")).toHaveCount(0);

    const res = await request.post("/api/auth/sign-up/email", { data: newAccount(), headers: { origin: "http://localhost:3100" } });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("REGION_UNAVAILABLE");
  });
});

test("a US visitor can still sign up when the platform reports their country", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-vercel-ip-country": "US" } });
  const page = await context.newPage();
  await enterBirthDate(page, 1995);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await context.close();
});

test("a teen cannot switch support mode off; an adult can", async ({ browser }) => {
  for (const who of ["teen", "adult"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    if (who === "adult") {
      await signUpAdult(page);
    } else {
      const { createAccount, finishOnboarding } = await import("./helpers");
      await enterBirthDate(page, new Date().getFullYear() - 15);
      await createAccount(page);
      await finishOnboarding(page, { goal: "Get fitter", weightKg: "60", heightCm: "170" });
      await page.getByRole("link", { name: "Start logging" }).click();
      await page.waitForURL("**/today");
    }
    await page.goto("/coach");
    await page.getByLabel("Message the coach").fill("I've been making myself throw up after meals");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/I'm not going to help with eating less/)).toBeVisible();

    await page.goto("/settings");
    const off = page.getByRole("button", { name: "Go back to my usual targets" });
    if (who === "teen") {
      await expect(off).toHaveCount(0);
      await expect(page.getByText(/This stays on for now/)).toBeVisible();
    } else {
      await off.click();
      await expect(off).toHaveCount(0);
      await page.goto("/today");
      await expect(page.getByText(/Targets are set to maintain for now/)).toHaveCount(0);
    }
    await context.close();
  }
});

test("a signed-in user can change their password", async ({ page }) => {
  const account = await signUpAdult(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Change password" }).click();
  await page.getByLabel("Current password").fill("definitely-not-it");
  await page.getByLabel("New password").fill(`changed-${account.password}`);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "!" })).toContainText(/current password is not right/);

  await page.getByLabel("Current password").fill(account.password);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(`changed-${account.password}`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Today/ })).toBeVisible();
});

test("the health check and crawler rules respond", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true });
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/api\//);
  expect(robots).toMatch(/Disallow: \/today/);
});
