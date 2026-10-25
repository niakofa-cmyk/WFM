import { expect, test } from "@playwright/test";

test("landing page explains the game and offers a solo flight", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /war for mars/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "TRY SOLO FLIGHT" })).toHaveAttribute("href", "/play");
  await expect(page.getByRole("link", { name: "CREATE PILOT ACCOUNT" })).toHaveAttribute(
    "href",
    "/sign-up",
  );
});

test("sign-up route renders the existing Clerk form", async ({ page }) => {
  await page.goto("/sign-up");

  await expect(page.getByRole("textbox", { name: /email address/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^password$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
});

test("solo flight launches and exits the playable 3D scene", async ({ page }) => {
  await page.goto("/play");

  await expect(page.getByTestId("solo-flight")).toBeVisible();
  await expect(page.getByTestId("button-ship-duskbreaker")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("button-pace-practice")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("button-solo-launch").click();
  await expect(page.getByRole("button", { name: "EXIT SOLO FLIGHT" })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();

  await page.getByRole("button", { name: "EXIT SOLO FLIGHT" }).click();
  await expect(page.getByTestId("solo-flight")).toBeVisible();
});
