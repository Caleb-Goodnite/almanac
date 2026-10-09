import { expect, test } from "@playwright/test";
import { createAccount, enterBirthDate, finishOnboarding, newAccount, signUpAdult } from "./helpers";

const thisYear = new Date().getFullYear();

test.describe("age gate", () => {
  test("blocks someone under 13 and does not let them simply try again", async ({ page }) => {
    await enterBirthDate(page, thisYear - 10);
    await expect(page.getByRole("heading", { name: /not available for you yet/ })).toBeVisible();
    await expect(page.getByText(/have not kept your date of birth/)).toBeVisible();

    // Going back to the form shows the same message, with no form to resubmit.
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: /not available for you yet/ })).toBeVisible();
    await expect(page.getByLabel("Year")).toHaveCount(0);
  });

  test("the sign-up API refuses anyone who has not passed the gate", async ({ request }) => {
    const account = newAccount();
    const noCookie = await request.post("/api/auth/sign-up/email", { data: account, headers: { origin: "http://localhost:3100" } });
    expect(noCookie.status()).toBe(403);
    expect((await noCookie.json()).code).toBe("AGE_REQUIRED");

    const forged = await request.post("/api/auth/sign-up/email", {
      data: account,
      headers: { origin: "http://localhost:3100", cookie: "almanac_age=2000.1.9999999999.forged" },
    });
    expect(forged.status()).toBe(403);
  });

  test("rejects an impossible date instead of guessing", async ({ page }) => {
    await enterBirthDate(page, 2005, "2", "31");
    await expect(page.getByRole("alert").filter({ hasText: "!" })).toContainText(/does not look right/);
  });

  test("app pages redirect to sign-in without a session", async ({ page }) => {
    await page.goto("/today");
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test("an adult can sign up, onboard in a few steps and reach Today", async ({ page }) => {
  await enterBirthDate(page, 1995);
  await createAccount(page);
  await finishOnboarding(page);

  // 80 kg, 180 cm, male, active, fat loss: the plan is computed on the server.
  await expect(page.getByText("kilocalories a day")).toBeVisible();
  await expect(page.getByText("7-9 h")).toBeVisible();
  await expect(page.getByText("150 min/wk")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Protein" })).toHaveAttribute("aria-valuenow", "160");

  await page.getByRole("link", { name: "Start logging" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Today/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Quick actions" })).toBeVisible();
});

test("a 15-year-old gets the teen experience", async ({ page }) => {
  await enterBirthDate(page, thisYear - 15);
  await createAccount(page);

  await page.getByRole("radio", { name: "Male", exact: true }).check({ force: true });
  await page.getByLabel("Height").fill("170");
  await page.getByLabel("Weight").fill("60");
  // Body fat is not asked of under-18s.
  await expect(page.getByLabel(/Body fat/)).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /^Lose fat/ }).check({ force: true });
  // Only the two gentle paces are offered; the adult "Faster" option is not.
  await expect(page.getByRole("radio", { name: /^Gentle/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Steady/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Faster/ })).toHaveCount(0);
  await expect(page.getByText(/tell a parent or your doctor/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /^Active/ }).check({ force: true });
  await page.getByRole("radio", { name: /^Yes/ }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: /not medical advice/ }).check();
  await page.getByRole("button", { name: "Show my plan" }).click();

  await expect(page.getByText("8-10 h")).toBeVisible();
  await expect(page.getByText("60 min/day")).toBeVisible();
  await expect(page.getByText(/kept gentle.*because you are still growing/)).toBeVisible();

  // On Today, calories are shown against needs, not as a budget to stay under.
  await page.getByRole("link", { name: "Start logging" }).click();
  await expect(page.getByText(/of about [\d,]+ kcal/i)).toBeVisible();
  await expect(page.getByText(/kcal left/i)).toHaveCount(0);
});

test("signing out and back in works", async ({ page }) => {
  const account = await signUpAdult(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Today/ })).toBeVisible();
});
