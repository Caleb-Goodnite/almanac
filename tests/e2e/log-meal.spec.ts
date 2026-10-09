import { expect, test } from "@playwright/test";
import { signUpAdult } from "./helpers";

test("log a meal, then log it again in one tap", async ({ page }) => {
  await signUpAdult(page);

  // Two taps from the dashboard: "Log food", then the food.
  await page.getByRole("navigation", { name: "Quick actions" }).getByRole("link", { name: "Log food" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add food" })).toBeVisible();

  // A food of our own, so the test needs no outside food database.
  await page.getByRole("tab", { name: "Mine" }).click();
  await page.getByRole("button", { name: "Create a food" }).click();
  await page.getByLabel("Name").fill("Test porridge");
  await page.getByLabel("Calories per 100 g").fill("370");
  await page.getByLabel("Protein").fill("13");
  await page.getByLabel("Carbohydrate").fill("60");
  await page.getByLabel(/^Fat/).fill("7");
  await page.getByRole("button", { name: "Save food" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Test porridge" })).toBeVisible();
  await dialog.getByLabel("Amount").fill("60");
  // 60 g of a 370 kcal/100 g food.
  await expect(dialog.getByText("222")).toBeVisible();
  await dialog.getByRole("button", { name: "Log it" }).click();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Food today" })).toBeVisible();
  await expect(page.getByText("Test porridge")).toBeVisible();
  await expect(page.getByText("222 kcal").first()).toBeVisible();

  // The repeat path: it is now under Recent with a one-tap button that reuses 60 g.
  await page.getByRole("link", { name: /Add to lunch/ }).click();
  const started = Date.now();
  await page.getByRole("button", { name: /Log Test porridge again/ }).click();
  await expect(page.getByText("Logged", { exact: true })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(5000);

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Test porridge", { exact: true })).toHaveCount(2);

  // Remove one entry; the total follows.
  await page.getByRole("button", { name: "Remove Test porridge" }).first().click();
  await expect(page.getByText("Test porridge", { exact: true })).toHaveCount(1);
});

test("water is one tap and can be undone", async ({ page }) => {
  await signUpAdult(page);
  const water = page.getByRole("meter", { name: "Water" });
  await expect(water).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "+ 250 ml" }).click();
  await expect(water).toHaveAttribute("aria-valuenow", "250");
  await page.getByRole("button", { name: "Undo last" }).click();
  await expect(water).toHaveAttribute("aria-valuenow", "0");
});

test("one user cannot read another user's food", async ({ browser }) => {
  const a = await browser.newContext();
  const pageA = await a.newPage();
  await signUpAdult(pageA);
  await pageA.goto("/food/add");
  await pageA.getByRole("tab", { name: "Mine" }).click();
  await pageA.getByRole("button", { name: "Create a food" }).click();
  await pageA.getByLabel("Name").fill("Private casserole");
  await pageA.getByLabel("Calories per 100 g").fill("150");
  await pageA.getByLabel("Protein").fill("10");
  await pageA.getByLabel("Carbohydrate").fill("10");
  await pageA.getByLabel(/^Fat/).fill("5");
  await pageA.getByRole("button", { name: "Save food" }).click();
  await pageA.getByRole("dialog").getByRole("button", { name: "Log it" }).click();

  const b = await browser.newContext();
  const pageB = await b.newPage();
  await signUpAdult(pageB);
  const res = await pageB.request.get("/api/foods/search?q=casserole");
  const body = (await res.json()) as { results: { name: string }[] };
  expect(body.results.map((r) => r.name)).not.toContain("Private casserole");
  await pageB.goto("/food");
  await expect(pageB.getByText("Private casserole")).toHaveCount(0);

  await a.close();
  await b.close();
});

test("something logged while offline is saved once the connection returns", async ({ page, context }) => {
  await signUpAdult(page);
  const water = page.getByRole("meter", { name: "Water" });

  await context.setOffline(true);
  await page.getByRole("button", { name: "+ 500 ml" }).click();
  // Shown at once, and the app says it is holding the entry.
  await expect(water).toHaveAttribute("aria-valuenow", "500");
  await expect(page.getByText(/You are offline/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/You are offline/)).toHaveCount(0, { timeout: 30_000 });

  // Proof it reached the server: a fresh load still has it.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("meter", { name: "Water" })).toHaveAttribute("aria-valuenow", "500", { timeout: 3000 });
  }).toPass({ timeout: 30_000 });
});
