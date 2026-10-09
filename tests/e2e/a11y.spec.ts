import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUpAdult } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function check(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`);
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("public pages have no WCAG 2.2 AA violations", async ({ page }) => {
      for (const path of ["/", "/sign-up", "/sign-in", "/research", "/styleguide"]) {
        await page.goto(path);
        await check(page, path);
      }
    });

    test("app pages have no WCAG 2.2 AA violations", async ({ page }) => {
      await signUpAdult(page);
      for (const path of ["/today", "/food", "/food/add", "/food/week", "/train", "/train/cardio", "/train/routines/new", "/body", "/trends", "/coach", "/settings", "/support"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await check(page, path);
      }
    });
  });
}

test("the page can be used with the keyboard alone", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Get started" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("reduced motion is honoured", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/styleguide");
  const duration = await page.locator(".bar-grow, .chart-draw, .step-in, body").first().evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
  await context.close();
});
