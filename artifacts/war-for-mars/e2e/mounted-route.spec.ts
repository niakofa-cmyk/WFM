import { expect, test } from "@playwright/test";

const configuredBasePath = process.env.BASE_PATH || "/";
const basePath = configuredBasePath.endsWith("/")
  ? configuredBasePath
  : `${configuredBasePath}/`;

test("mounted Kids WFM route renders the Orbital entry and keeps sign-in in scope", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(basePath);
  await expect(page.getByRole("heading", { name: /war for mars/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "CREATE PILOT ACCOUNT" }))
    .toHaveAttribute("href", `${basePath}sign-up`);
  await expect(page.getByRole("link", { name: "SIGN IN" }))
    .toHaveAttribute("href", `${basePath}sign-in`);

  await page.goto(`${basePath}sign-in`);
  await expect(page).toHaveURL(new RegExp(`${basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}sign-in$`));
  await expect.poll(async () => {
    const text = await page.locator("body").innerText();
    return /connecting to sign-in|welcome back, pilot|sign in/i.test(text);
  }, { timeout: 20_000 }).toBe(true);
  expect(pageErrors).toEqual([]);
});
