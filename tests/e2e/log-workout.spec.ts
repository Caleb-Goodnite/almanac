import { expect, test } from "@playwright/test";
import { signUpAdult } from "./helpers";

test("log a strength workout with sets, a record and a rest timer", async ({ page }) => {
  await signUpAdult(page);
  await page.getByRole("link", { name: "Train", exact: true }).first().click();
  await page.getByRole("button", { name: "Start a workout" }).click();
  await page.waitForURL("**/train/workout/**");

  await page.getByRole("button", { name: "Add exercise" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox", { name: "Search exercises" }).fill("barbell squat");
  await dialog.getByRole("button", { name: /^Barbell Squat/ }).first().click();

  await expect(page.getByText("First time logging this.")).toBeVisible();
  await page.getByLabel("Weight (kg)").fill("100");
  await page.getByLabel("Reps").fill("5");
  await page.getByRole("button", { name: "Log set" }).click();

  // The rest timer starts and the next set is pre-filled with the last one.
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByLabel("Weight (kg)")).toHaveValue("100");
  await expect(page.getByLabel("Reps")).toHaveValue("5");

  await page.getByLabel("Weight (kg)").fill("105");
  await page.getByRole("button", { name: "Log set" }).click();
  await expect(page.getByText(/^Record:/)).toBeVisible();

  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: /Finish workout \(2 sets\)/ }).click();
  await page.waitForURL("**/train");

  await expect(page.getByText(/2 sets, below range/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
  await expect(page.getByText(/1 exercise · 2 sets/)).toBeVisible();
});

test("another user's workout id is not found", async ({ browser }) => {
  const a = await browser.newContext();
  const pageA = await a.newPage();
  await signUpAdult(pageA);
  await pageA.goto("/train");
  await pageA.getByRole("button", { name: "Start a workout" }).click();
  await pageA.waitForURL("**/train/workout/**");
  const url = new URL(pageA.url()).pathname;

  const b = await browser.newContext();
  const pageB = await b.newPage();
  await signUpAdult(pageB);
  await pageB.goto(url);
  // The page is streamed, so the status is already sent; what matters is that
  // user B gets the not-found page and none of user A's workout.
  await expect(pageB.getByRole("heading", { name: /Nothing on this page/ })).toBeVisible();
  await expect(pageB.getByRole("button", { name: "Add exercise" })).toHaveCount(0);

  await a.close();
  await b.close();
});

test("log cardio with a labelled estimate", async ({ page }) => {
  await signUpAdult(page);
  await page.goto("/train/cardio");
  await page.getByLabel("Activity").selectOption("run_6mph");
  await page.getByLabel("Duration").fill("30");
  // 9.3 MET x 80 kg x 0.5 h = 372 kcal, shown as an estimate.
  await expect(page.getByText("~372")).toBeVisible();
  await page.getByRole("button", { name: "Log activity" }).click();
  await page.waitForURL("**/train");
  await expect(page.getByText(/Running, 6 mph/)).toBeVisible();
  await expect(page.getByText("~372 kcal est.")).toBeVisible();
});
