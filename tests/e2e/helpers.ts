import { expect, type Page } from "@playwright/test";

export const STUB = "http://127.0.0.1:4011";

let counter = 0;
/** A unique throwaway account for each test. These exist only in the test database. */
export function newAccount() {
  counter += 1;
  const id = `${Date.now()}-${counter}-${Math.floor(Math.random() * 1e6)}`;
  return { name: "Sam", email: `e2e-${id}@example.test`, password: `pw-${id}-Long-enough` };
}

export async function enterBirthDate(page: Page, year: number, month = "6", day = "15") {
  await page.goto("/sign-up");
  await page.getByLabel("Month").selectOption(month);
  await page.getByLabel("Day").fill(day);
  await page.getByLabel("Year").fill(String(year));
  await page.getByRole("button", { name: "Continue" }).click();
}

export async function createAccount(page: Page, account = newAccount()) {
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("First name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/welcome");
  return account;
}

type Onboarding = { goal?: "Lose fat" | "Build muscle" | "Get fitter" | "Stay where I am"; weightKg?: string; heightCm?: string };

export async function finishOnboarding(page: Page, options: Onboarding = {}) {
  await page.getByRole("radio", { name: "Male", exact: true }).check({ force: true });
  await page.getByLabel("Height").fill(options.heightCm ?? "180");
  await page.getByLabel("Weight").fill(options.weightKg ?? "80");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: new RegExp(`^${options.goal ?? "Lose fat"}`) }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /^Active/ }).check({ force: true });
  await page.getByRole("radio", { name: /^Yes/ }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("checkbox", { name: /not medical advice/ }).check();
  await page.getByRole("button", { name: "Show my plan" }).click();
  await expect(page.getByText("Your starting plan")).toBeVisible();
}

/** Signs up an adult, completes onboarding and lands on Today. */
export async function signUpAdult(page: Page, options: Onboarding = {}) {
  await enterBirthDate(page, 1995);
  const account = await createAccount(page);
  await finishOnboarding(page, options);
  await page.getByRole("link", { name: "Start logging" }).click();
  await page.waitForURL("**/today");
  return account;
}
