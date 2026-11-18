import { expect, test } from "@playwright/test";

const configuredBasePath = process.env.BASE_PATH || "/kids/wfm/";
const basePath = `/${configuredBasePath.split("/").filter(Boolean).join("/")}/`;

test("the mounted mobile entry opens Orbital sign-in before authenticated play", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(basePath, { waitUntil: "domcontentloaded" });

  const escapedBasePath = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page).toHaveURL(new RegExp(`${escapedBasePath}sign-in$`));
  await expect(page.getByTestId("orbital-signin-page")).toBeVisible();
  await expect(page.getByText("WAR FOR MARS · ORBITAL UNIVERSE")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome back, pilot" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /email address/i })).toBeVisible();
  await expect(page.getByTestId("auth-initialization")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Connecting to sign-in…" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sign-in is taking longer than expected" })).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);

  const signUpHref = await page.getByRole("link", { name: /sign up/i }).getAttribute("href");
  expect(signUpHref).not.toBeNull();
  expect(new URL(signUpHref!, page.url()).pathname).toBe(`${basePath}sign-up`);
  expect(new URL(signUpHref!, page.url()).origin).toBe(new URL(page.url()).origin);
  expect(pageErrors).toEqual([]);
});
