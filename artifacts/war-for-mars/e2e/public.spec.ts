import { expect, test } from "@playwright/test";
import type {} from "../src/game/controls-probe";

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
  // A canvas/HUD alone can be visible even when WebGL initialization failed.
  await expect.poll(() => page.evaluate(() => typeof window.__controlsTest?.getYaw === "function")).toBe(true);
  const speedBefore = await page.evaluate(() => window.__controlsTest!.getSpeed());
  await page.evaluate(() => window.__controlsTest!.setKeys!(["KeyW"]));
  await expect.poll(() => page.evaluate(() => window.__controlsTest!.getSpeed())).toBeGreaterThan(speedBefore);
  await page.evaluate(() => window.__controlsTest!.setKeys!([]));

  await page.getByRole("button", { name: "EXIT SOLO FLIGHT" }).click();
  await expect(page.getByTestId("solo-flight")).toBeVisible();
});

test("mobile flight controls reserve device safe areas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play");

  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("viewport-fit=cover");
  expect(viewport).not.toContain("maximum-scale=1");

  await page.getByTestId("button-solo-launch").click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__controlsTest))).toBe(true);

  const leftStyle = await page.getByTestId("flight-controls-left").getAttribute("style");
  const rightStyle = await page.getByTestId("flight-controls-right").getAttribute("style");
  expect(leftStyle).toContain("safe-area-inset-left");
  expect(leftStyle).toContain("safe-area-inset-bottom");
  expect(rightStyle).toContain("safe-area-inset-right");
  expect(rightStyle).toContain("safe-area-inset-bottom");

  const presetOne = page.getByTestId("flight-preset-1");
  await presetOne.focus();
  await page.keyboard.down("Space");
  await expect.poll(() => page.evaluate(() => window.__controlsTest?.getFiring?.())).toBe(false);
  await page.keyboard.up("Space");
  await expect(presetOne).toHaveAttribute("aria-pressed", "true");

  const presetTwo = page.getByTestId("flight-preset-2");
  await expect(presetTwo).toHaveCSS("opacity", "1", { timeout: 6000 });
  await presetTwo.focus();
  await expect(presetTwo).toBeFocused();
  await presetTwo.press("Enter");
  await expect(presetTwo).toHaveAttribute("aria-pressed", "true");

  for (const viewportSize of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewportSize);
    for (const controls of [
      page.getByTestId("flight-controls-left"),
      page.getByTestId("flight-controls-right"),
    ]) {
      const box = await controls.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewportSize.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewportSize.height);
    }
  }

  await page.getByRole("button", { name: "EXIT SOLO FLIGHT" }).click();
});

test("graphics context loss exits safely without submitting a reward", async ({ page }) => {
  let rewardRequests = 0;
  page.on("request", (request) => {
    if (/\/api\/strikes\/[^/]+\/claim$/.test(new URL(request.url()).pathname)) rewardRequests++;
  });
  await page.goto("/play");
  await page.getByTestId("button-solo-launch").click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__controlsTest))).toBe(true);
  const contextLossAvailable = await page.locator("canvas").first().evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext("webgl2");
    const extension = context?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  expect(contextLossAvailable).toBe(true);
  await expect(page.getByTestId("solo-flight")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Graphics connection lost");
  expect(rewardRequests).toBe(0);
  await page.getByTestId("button-solo-launch").click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__controlsTest))).toBe(true);
  await page.getByRole("button", { name: "EXIT SOLO FLIGHT" }).click();
});

test("a rendered Practice flight completes with a real debrief and releases controls", async ({ page }) => {
  test.setTimeout(210_000);
  await page.setViewportSize({ width: 640, height: 400 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.name));
  await page.goto("/play");
  await page.getByTestId("button-solo-launch").click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__controlsTest))).toBe(true);
  // Arena deliberately waits for the pilot to acknowledge its outcome overlay.
  const debrief = page.getByRole("button", { name: "Debrief", exact: true });
  await expect(debrief).toBeVisible({ timeout: 190_000 });
  await debrief.click();
  await expect(page.getByTestId("panel-solo-result")).toBeVisible();
  await expect(page.getByTestId("text-solo-outcome")).toHaveText(/Victory|Defeat|Draw/);
  await expect.poll(() => page.evaluate(() => Boolean(window.__controlsTest))).toBe(false);
  expect(pageErrors).toEqual([]);
});
