import { expect, test, type Page } from "@playwright/test";
import { signUpAdult } from "./helpers";

async function createAndLogFood(page: Page, name: string) {
  await page.goto("/food/add?meal=breakfast");
  await page.getByRole("tab", { name: "Mine" }).click();
  await page.getByRole("button", { name: "Create a food" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Calories per 100 g").fill("370");
  await page.getByLabel("Protein").fill("13");
  await page.getByLabel("Carbohydrate").fill("60");
  await page.getByLabel(/^Fat/).fill("7");
  await page.getByRole("button", { name: "Save food" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Log it" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Food today" })).toBeVisible();
}

test("yesterday's meal can be copied to today in one tap", async ({ page }) => {
  await signUpAdult(page);
  // Log breakfast on the previous day, then look at today.
  await page.goto("/food");
  await page.getByRole("link", { name: /^Previous day/ }).click();
  await page.waitForURL(/date=\d{4}-\d{2}-\d{2}/);
  const yesterday = new URL(page.url()).searchParams.get("date")!;
  await page.goto(`/food/add?meal=breakfast&date=${yesterday}`);
  await page.getByRole("tab", { name: "Mine" }).click();
  await page.getByRole("button", { name: "Create a food" }).click();
  await page.getByLabel("Name").fill("Usual breakfast");
  await page.getByLabel("Calories per 100 g").fill("400");
  await page.getByLabel("Protein").fill("20");
  await page.getByLabel("Carbohydrate").fill("50");
  await page.getByLabel(/^Fat/).fill("10");
  await page.getByRole("button", { name: "Save food" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Log it" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Usual breakfast", { exact: true })).toBeVisible();

  await page.goto("/food");
  await expect(page.getByText("Usual breakfast", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Same as the day before" }).first().click();
  await expect(page.getByText("Usual breakfast", { exact: true })).toBeVisible();
  await expect(page.getByText("400 kcal").first()).toBeVisible();
});

test("sleep and weight can be filled in for a past day, and a weigh-in can be removed", async ({ page }) => {
  await signUpAdult(page);
  await page.goto("/body");
  await page.getByRole("link", { name: /^Previous day/ }).click();
  await page.waitForURL(/date=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("heading", { level: 1, name: "How were you that day?" })).toBeVisible();

  await page.getByLabel("That night").fill("7");
  await page.getByLabel("and").fill("30");
  await page.getByRole("button", { name: "Log sleep" }).click();
  await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible();

  await page.getByLabel("Weight that day").fill("80.6");
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(page.getByLabel(/Weight that day \(logged\)/)).toHaveValue("80.6");

  // Two weigh-ins now exist: onboarding (today) and the one just added.
  // Opened and operated from the keyboard, as someone not using a pointer would.
  await page.getByText(/Recent weigh-ins \(2\)/).focus();
  await page.keyboard.press("Enter");
  const remove = page.getByRole("button", { name: /^Remove the weigh-in from/ }).last();
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Recent weigh-ins \(1\)/)).toBeVisible();

  // Today is untouched by what was logged for yesterday.
  await page.goto("/body");
  await expect(page.getByLabel("Last night")).toHaveValue("");
});

test("the exercise library can be searched and shows instructions and progress", async ({ page }) => {
  await signUpAdult(page);
  await page.goto("/train");
  await page.getByRole("link", { name: "Browse exercises" }).click();
  await page.getByLabel("Search").fill("barbell squat");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: /^Barbell Squat/ }).first().click();

  await expect(page.getByRole("heading", { level: 1, name: /Barbell Squat/ })).toBeVisible();
  await expect(page.getByText("How to do it")).toBeVisible();
  await expect(page.getByText(/You have not logged this yet/)).toBeVisible();
});

test("the logger suggests what to aim for, based on last time", async ({ page }) => {
  await signUpAdult(page);

  const session = async (weight: string, reps: string, sets: number) => {
    await page.goto("/train");
    await page.getByRole("button", { name: "Start a workout" }).click();
    await page.waitForURL("**/train/workout/**");
    await page.getByRole("button", { name: "Add exercise" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("searchbox", { name: "Search exercises" }).fill("barbell curl");
    await dialog.getByRole("button", { name: /^Barbell Curl/ }).first().click();
    return async () => {
      await page.getByLabel("Weight (kg)").fill(weight);
      await page.getByLabel("Reps").fill(reps);
      for (let i = 0; i < sets; i++) {
        await page.getByRole("button", { name: "Log set" }).click();
        await expect(page.getByRole("row")).toHaveCount(i + 2);
      }
      await page.getByRole("button", { name: /Finish workout/ }).click();
      await page.waitForURL("**/train");
    };
  };

  // First session: 30 kg for 12, 12, 12. No suggestion yet (nothing to go on).
  const first = await session("30", "12", 3);
  await expect(page.getByText("Aim for today")).toHaveCount(0);
  await first();

  // Second session: every set hit 12, so add about 5% (2.5 kg) and restart at 8.
  await session("30", "12", 0);
  await expect(page.getByText("Aim for today")).toBeVisible();
  await expect(page.getByText("32.5 kg × 8")).toBeVisible();
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)")).toHaveValue("32.5");
  await expect(page.getByLabel("Reps")).toHaveValue("8");
});

test("a food logged today shows in the day view totals", async ({ page }) => {
  await signUpAdult(page);
  await createAndLogFood(page, "Totals porridge");
  // 100 g at 370 kcal per 100 g.
  await expect(page.getByText("370 kcal").first()).toBeVisible();
  await expect(page.getByRole("meter", { name: "Protein" })).toHaveAttribute("aria-valuenow", "13");
});

test("an everyday food opens at its typical serving and can be measured other ways", async ({ page }) => {
  await signUpAdult(page);
  await page.goto("/food/add");

  // With nothing typed, the built-in list is offered by category.
  await expect(page.getByText(/Everyday foods with typical servings/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Banana/ })).toBeVisible();
  await expect(page.getByText(/105 kcal per medium \(118 g\)/)).toBeVisible();
  await page.getByRole("button", { name: "Dairy" }).click();
  await expect(page.getByRole("button", { name: /^Milk, whole/ })).toBeVisible();
  await page.getByRole("button", { name: "Fruit" }).click();

  await page.getByRole("button", { name: /^Banana/ }).click();
  const dialog = page.getByRole("dialog");
  const amount = dialog.getByLabel("Amount");
  const unit = dialog.getByLabel("Measured in");

  // One medium banana, 118 g, 105 kcal.
  await expect(amount).toHaveValue("1");
  await expect(unit.locator("option:checked")).toHaveText(/^medium/);
  await expect(dialog.getByText("That is 118 g.")).toBeVisible();
  await expect(dialog.getByText("105", { exact: true })).toBeVisible();

  // Changing only the unit keeps the same amount of food.
  await unit.selectOption({ label: "oz" });
  await expect(amount).toHaveValue("4.16");
  await unit.selectOption({ label: "grams" });
  await expect(amount).toHaveValue("118");

  // Weight, the food's own measures and kitchen volumes are all offered.
  for (const label of ["grams", "oz", "lb", "tbsp", "ml"]) await expect(unit.locator("option", { hasText: new RegExp(`^${label}$`) })).toHaveCount(1);
  await expect(unit.locator("option", { hasText: /^cup, sliced/ })).toHaveCount(1);

  // Two medium bananas with the plus button, then log.
  await unit.selectOption({ index: 0 });
  await expect(amount).toHaveValue("1");
  await dialog.getByRole("button", { name: /^More/ }).click();
  await dialog.getByRole("button", { name: /^More/ }).click();
  await expect(amount).toHaveValue("2");
  await expect(dialog.getByText("That is 236 g.")).toBeVisible();
  await dialog.getByRole("button", { name: "Log it" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Food today" })).toBeVisible();
  await expect(page.getByText("Banana", { exact: true })).toBeVisible();
  await expect(page.getByText("210 kcal").first()).toBeVisible();

  // Searching finds the everyday entry first.
  await page.goto("/food/add");
  await page.getByRole("tab", { name: "Search" }).click();
  await page.getByPlaceholder(/Search foods/).fill("banana");
  await expect(page.getByRole("button", { name: /^Banana/ }).first()).toBeVisible();
});
