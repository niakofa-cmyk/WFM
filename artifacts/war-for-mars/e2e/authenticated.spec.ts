import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

const testEmail = process.env.WFM_E2E_EMAIL!;

test("WFM Development pilot reaches the Orbital-native entry and signs out", async ({ page }) => {
  await page.goto("/");
  await clerk.loaded({ page });
  try {
    await clerk.signIn({ page, emailAddress: testEmail });
  } catch {
    throw new Error(
      "Clerk Development could not sign in the configured WFM test account. Confirm it exists in the selected Development instance and WFM_E2E_EMAIL is correct; account identifiers are redacted.",
    );
  }
  await page.goto("/");

  await expect(page.getByTestId("orbital-primary-boot")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("text-offline-scope")).toContainText("ORBITAL PRIMARY BOOT");
  await page.goto("/command");
  await expect(page.getByTestId("orbital-primary-boot")).toBeVisible();
  await expect(page.getByTestId("button-online-5v5")).toHaveCount(0);
  await expect(page.getByTestId("text-offline-scope")).toContainText("ORBITAL PRIMARY BOOT");

  await clerk.signOut({ page });
  await page.goto("/");
  await expect(page.getByTestId("link-landing-local-universe")).toBeVisible();
});
