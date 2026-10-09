import path from "node:path";
import { expect, test } from "@playwright/test";
import { ean13, writeBarcodeVideo } from "./barcode-video";
import { signUpAdult } from "./helpers";

// A valid EAN-13 in the range reserved for in-store use, so no real product matches it.
const CODE = ean13("200000012345");
const VIDEO = writeBarcodeVideo(CODE, path.join(process.cwd(), "test-results", "barcode.y4m"));

test.use({
  permissions: ["camera"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${VIDEO}`],
  },
});

for (const engine of ["built-in detector", "ZXing fallback (as in Safari)"] as const) {
  test(`the camera scanner reads a barcode with the ${engine}`, async ({ page }) => {
    if (engine !== "built-in detector") {
      // Remove the built-in API so the page takes the same path as Safari and Firefox.
      await page.addInitScript(() => {
        delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
      });
    }
    await signUpAdult(page);
    await page.goto("/food/add");
    const hasNative = await page.evaluate(() => "BarcodeDetector" in window);
    test.skip(engine === "built-in detector" && !hasNative, "This browser build has no built-in BarcodeDetector.");
    expect(hasNative).toBe(engine === "built-in detector");

    await page.getByRole("tab", { name: "Scan" }).click();
    // The decoded number is looked up; this code matches nothing, and the app says so by number.
    await expect(page.getByText(new RegExp(`barcode ${CODE}`))).toBeVisible({ timeout: 30_000 });
  });
}

test("a typed barcode works when there is no camera", async ({ page }) => {
  await signUpAdult(page);
  await page.goto("/food/add");
  await page.getByRole("tab", { name: "Scan" }).click();
  await page.getByLabel("Or type the barcode number").fill(CODE);
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText(new RegExp(`barcode ${CODE}`))).toBeVisible({ timeout: 30_000 });
});
