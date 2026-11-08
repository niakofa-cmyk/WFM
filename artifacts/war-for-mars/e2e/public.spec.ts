import { expect, test } from "@playwright/test";

test("public landing sends players to the single Orbital universe entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("link-landing-local-universe")).toBeVisible();
  await expect(page.getByTestId("link-landing-local-universe")).toHaveAttribute(
    "href",
    "/combat-lab.html?universe=1&destination=cinder-ring",
  );
  await expect(page.getByText("ONE ORBITAL ENTRY.")).toBeVisible();
  await expect(page.getByText(/multiplayer operations remain unavailable here until rebuilt/)).toBeVisible();
});

test("standalone Combat Lab selects a faction and enters native Cinder flight", async ({ page }) => {
  const requests: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/combat-lab.html");
  await expect(page.getByTestId("text-offline-scope")).toContainText("ORBITAL NATIVE ENTRY");
  await page.getByTestId("button-faction-accord").click();
  await expect(page.getByTestId("button-faction-accord")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("button-launch-local-universe")).toContainText("APPROACH CINDER");
  await page.getByTestId("button-launch-local-universe").click();
  await expect(page.getByTestId("button-orbital-preview-toggle")).toHaveText("EXIT FLIGHT");
  await expect(page.getByTestId("orbital-preview-hud")).toBeVisible();
  await expect(page.locator('canvas[aria-label="Orbital flight scene with player ship and Cinder asteroids"]')).toBeVisible();

  expect(requests.some((url) => /three(?:[-./]|$)/i.test(url))).toBe(false);
  expect(pageErrors).toEqual([]);
});

test("flight and play routes open the same Orbital scene without legacy chunks", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  for (const path of ["/flight", "/play"]) {
    await page.goto(path);
    await expect(page.getByTestId("button-orbital-preview-toggle")).toBeVisible();
    await expect(page.getByTestId("button-orbital-preview-toggle")).toHaveText("EXIT FLIGHT");
    await expect(page.getByTestId("orbital-preview-hud")).toBeVisible();
  }

  expect(requests.some((url) => /three(?:[-./]|$)/i.test(url))).toBe(false);
});

test("retired expedition route starts no operation or reward flow", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
  });
  await page.goto("/expedition");
  await expect(page.getByRole("heading", { name: "CO-OP FLIGHT RETIRED" })).toBeVisible();
  await expect(page.getByText(/No operation session or reward can be started/)).toBeVisible();
  expect(writes).toEqual([]);
});
