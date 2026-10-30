import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

const testEmail = process.env.WFM_E2E_EMAIL!;

test("WFM Development pilot signs in, enters the game, and signs out", async ({ page }) => {
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

  await expect(page.getByText("PRESS TO ENTER", { exact: true })).toBeVisible();
  await page.getByText("PRESS TO ENTER", { exact: true }).click();
  await expect(page.getByTestId("button-online-5v5")).toBeVisible();
  await expect(page.getByText("PLAYER PROFILE UNAVAILABLE")).toHaveCount(0);

  await clerk.signOut({ page });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "TRY SOLO FLIGHT" })).toBeVisible();
});
