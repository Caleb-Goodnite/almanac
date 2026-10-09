import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createAccount, enterBirthDate, finishOnboarding } from "./helpers";

const OUTBOX = path.join(process.cwd(), ".data", "outbox.jsonl");

function linkEmailedTo(address: string, pattern: RegExp): string {
  const lines = readFileSync(OUTBOX, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { to: string; text: string });
  const mine = lines.filter((l) => l.to === address);
  const link = mine[mine.length - 1]?.text.match(pattern)?.[0];
  if (!link) throw new Error(`No matching link emailed to ${address}`);
  return new URL(link).pathname;
}

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`), label).toEqual([]);
}

test("an under-18's fat-loss goal stays locked until a guardian approves it, and locks again when they withdraw", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await enterBirthDate(page, new Date().getFullYear() - 15);
  const teen = await createAccount(page);
  await finishOnboarding(page, { goal: "Get fitter", weightKg: "90", heightCm: "170" });
  await page.getByRole("link", { name: "Start logging" }).click();
  await page.waitForURL("**/today");

  // Locked: the goal is not offered, and the teen cannot name their own address.
  await page.goto("/settings");
  await expect(page.getByRole("radio", { name: "Lose fat" })).toHaveCount(0);
  const guardianField = page.getByLabel("Parent or guardian's email");
  await guardianField.fill(teen.email.replace("@", "+mum@"));
  await page.getByRole("button", { name: "Ask for approval" }).click();
  await expect(page.getByText(/not yours/)).toBeVisible();

  const guardianEmail = `parent-${Date.now()}@example.test`;
  await guardianField.fill(guardianEmail);
  await page.getByRole("button", { name: "Ask for approval" }).click();
  await expect(page.getByText(/Waiting for an answer/)).toBeVisible();
  await expectAccessible(page, "settings: request pending");

  // The guardian opens the emailed link in their own browser, with no session.
  const guardianContext = await browser.newContext();
  const guardian = await guardianContext.newPage();
  await guardian.goto(linkEmailedTo(guardianEmail, /http\S+\/guardian\/\S+/));
  const opened = Date.now();
  await expect(guardian.getByRole("heading", { name: "Sam is asking for your approval" })).toBeVisible();
  await expect(guardian.getByText(/risk factor for eating disorders/)).toBeVisible();
  await expectAccessible(guardian, "guardian: read");
  await guardian.getByRole("button", { name: "I have read this" }).click();

  // Each step holds the Continue button until it is done.
  const next = guardian.getByRole("button", { name: "Continue" });
  await expect(next).toBeDisabled();
  await expectAccessible(guardian, "guardian: confirm");
  for (const box of await guardian.getByRole("checkbox").all()) await box.check();
  await next.click();

  await guardian.getByLabel("Your full name").fill("Pat Parent");
  await expect(next).toBeDisabled();
  await guardian.getByRole("radio", { name: "Parent", exact: true }).check({ force: true });
  await next.click();

  await guardian.getByLabel("Type the sentence").fill("I understand");
  await expect(next).toBeDisabled();
  await guardian.getByLabel("Type the sentence").fill("i understand the risks");
  await next.click();

  await expectAccessible(guardian, "guardian: slide");
  await guardian.getByLabel(/Move the slider/).fill("99");
  await expect(next).toBeDisabled();
  await guardian.getByLabel(/Move the slider/).fill("100");
  await next.click();

  // Letting go early does not count; holding for the full time does.
  const hold = guardian.getByRole("button", { name: /Press and hold/ });
  await expectAccessible(guardian, "guardian: hold");
  await hold.focus();
  await guardian.keyboard.down("Space");
  await guardian.waitForTimeout(1500);
  await guardian.keyboard.up("Space");
  await expect(next).toBeDisabled();
  await guardian.keyboard.down("Space");
  await expect(guardian.getByRole("button", { name: /Held/ })).toBeVisible({ timeout: 8000 });
  await guardian.keyboard.up("Space");
  await next.click();

  // The server refuses an approval that arrives before the page could have been read.
  const waitFor = 16_000 - (Date.now() - opened);
  if (waitFor > 0) await guardian.waitForTimeout(waitFor);
  await guardian.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(guardian.getByRole("dialog")).toContainText("Are you sure?");
  await expectAccessible(guardian, "guardian: final confirm");
  await guardian.getByRole("button", { name: "Yes, I approve" }).click();
  await expect(guardian.getByRole("heading", { name: "Approved" })).toBeVisible();

  // The link is single use.
  await guardian.reload();
  await expect(guardian.getByRole("heading", { name: "Already approved" })).toBeVisible();

  // The teen now has the goal, inside the teen limits.
  await page.reload();
  await expect(page.getByText(/Approved by Pat Parent/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Lose fat" })).toBeChecked();

  // The guardian withdraws from the confirmation email; the goal locks again.
  await guardian.goto(linkEmailedTo(guardianEmail, /http\S+\/guardian\/revoke\/\S+/));
  await guardian.getByRole("button", { name: "Withdraw approval" }).click();
  await expect(guardian.getByRole("heading", { name: "Approval withdrawn" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Lose fat" })).toHaveCount(0);
  await expect(page.getByText(/withdrew their approval/)).toBeVisible();
  await guardianContext.close();
});

test("a made-up guardian link approves nothing", async ({ page }) => {
  await page.goto("/guardian/not-a-real-token-not-a-real-token-1234");
  await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible();
});
