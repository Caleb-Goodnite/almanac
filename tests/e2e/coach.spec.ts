import { expect, test } from "@playwright/test";
import { signUpAdult, STUB } from "./helpers";

type Call = { system: string; last: string; auth: string };

test("the coach streams a reply that uses the user's numbers", async ({ page, request }) => {
  const account = await signUpAdult(page);
  await page.getByRole("link", { name: "Coach" }).click();
  await page.getByRole("button", { name: "Review my week" }).click();

  await expect(page.getByText("Review my week")).toBeVisible();
  await expect(page.getByText(/Your protein averaged/)).toBeVisible();
  // Markdown is rendered, not shown raw.
  await expect(page.locator("strong", { hasText: "95 g" })).toBeVisible();
  await expect(page.getByText("**")).toHaveCount(0);
  await expect(page).toHaveURL(/\/coach\?c=/);

  // The conversation is saved.
  await page.reload();
  await expect(page.getByText(/Your protein averaged/)).toBeVisible();

  // What actually left the server: no name, no email, and the real targets.
  const calls = (await (await request.get(`${STUB}/__calls`)).json()) as Call[];
  const mine = calls.filter((c) => c.last === "Review my week").at(-1)!;
  expect(mine.system).not.toContain(account.email);
  expect(mine.system).not.toContain(account.name);
  expect(mine.system).not.toMatch(/@|birth/i);
  expect(mine.system).toContain('"age_band":"18+"');
  expect(mine.system).toContain('"protein_g":160');
  expect(mine.auth).toBe("Bearer stub-key");
});

test("the API key never reaches the browser", async ({ page }) => {
  await signUpAdult(page);
  const seen: string[] = [];
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] ?? "";
    if (/javascript|json|html|text/.test(type)) seen.push(await res.text().catch(() => ""));
  });
  await page.goto("/coach");
  await page.getByRole("button", { name: "Review my week" }).click();
  await expect(page.getByText(/Your protein averaged/)).toBeVisible();
  expect(seen.join("\n")).not.toContain("stub-key");
});

test("disordered-eating language gets support, not optimisation", async ({ page, request }) => {
  await signUpAdult(page);
  await page.goto("/coach");
  const before = ((await (await request.get(`${STUB}/__calls`)).json()) as Call[]).length;

  await page.getByLabel("Message the coach").fill("I make myself throw up after dinner. How many calories does that get rid of?");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText(/I'm not going to help with eating less/)).toBeVisible();
  await expect(page.getByText("1-888-375-7767")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the Support page" })).toBeVisible();

  // The model was never asked.
  const after = ((await (await request.get(`${STUB}/__calls`)).json()) as Call[]).length;
  expect(after).toBe(before);

  // The app steps back: targets go to maintenance and say so.
  await page.goto("/today");
  await expect(page.getByText(/Targets are set to maintain for now/)).toBeVisible();
  await expect(page.getByText(/kcal left/i)).toHaveCount(0);
});

test("a crisis message gets crisis resources immediately", async ({ page }) => {
  await signUpAdult(page);
  await page.goto("/coach");
  await page.getByLabel("Message the coach").fill("some days I want to die");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/I'm really glad you told me/)).toBeVisible();
  await expect(page.getByText(/Call or text 988/)).toBeVisible();
});

test("coach failures show a clear state and recover", async ({ page }) => {
  await signUpAdult(page);
  await page.goto("/coach");
  const box = page.getByLabel("Message the coach");

  await box.fill("please __fail_402__");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "!" })).toContainText(/out of credit on our side/);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);

  await box.fill("please __empty__");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "!" })).toContainText(/did not produce an answer/);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  // A provider outage on the first model is retried on the fallback without the user noticing.
  await box.fill("please __fail_503__");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Your protein averaged/).last()).toBeVisible();

  // A reply that suggests eating below the floor gets a correction appended.
  await box.fill("please __below_floor__");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/A correction from Almanac/)).toBeVisible();
});

test("the weekly review endpoint returns schema-valid JSON and falls back to rules", async ({ page }) => {
  await signUpAdult(page);
  const res = await page.request.get("/api/coach/insights");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { source: string; reason?: string; review: { headline: string; wins: string[]; slips: string[] } };
  // A brand-new account has too little data for the model to be asked at all.
  expect(body.source).toBe("rules");
  expect(body.reason).toBe("sparse_data");
  expect(body.review.headline).toMatch(/Not enough logged/);
});

test("the coach is limited to a set number of messages a day, but support is never rationed", async ({ page }) => {
  await signUpAdult(page);
  await page.goto("/coach");
  const box = page.getByLabel("Message the coach");
  const remaining = page.getByTestId("coach-remaining");
  // The test server allows 5 a day (the default is 10).
  await expect(remaining).toHaveText("5 of 5 messages left today.");

  for (let i = 1; i <= 5; i++) {
    await box.fill(`question ${i}`);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(remaining).toHaveText(`${5 - i} of 5 messages left today.`);
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  }

  await box.fill("one more question");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "!" })).toContainText(/used all of today's coach messages/);

  // A crisis message is still answered.
  await box.fill("I want to die");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/I'm really glad you told me/)).toBeVisible();
});
