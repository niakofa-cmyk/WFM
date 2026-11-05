import { expect, test } from "@playwright/test";
import type {} from "../src/game/controls-probe";

test("landing page explains the game and offers a solo flight", async ({ page }) => {
  await page.route("**/api/game/leaderboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        entries: [{ rank: 1, callsign: "Rook 7", score: 42 }],
      }),
    }),
  );
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /war for mars/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "WING LEADERBOARD" })).toBeVisible();
  await expect(page.getByText("Rook 7")).toBeVisible();
  await expect(page.getByText("42 CR")).toBeVisible();
  await expect(page.getByRole("link", { name: "TRY SOLO FLIGHT" })).toHaveAttribute("href", "/play");
  await expect(page.getByRole("link", { name: "CREATE PILOT ACCOUNT" })).toHaveAttribute(
    "href",
    "/sign-up",
  );
});

test("landing page presents the Orbital training entry without a separate Rust Disc command", async ({ page }) => {
  await page.goto("/");

  const operations = page.getByTestId("details-public-operations");
  await expect(operations.locator("summary")).toContainText("TRAINING & CO-OP OPERATIONS");
  await expect(page.getByTestId("link-landing-rust-disc")).toHaveCount(0);

  await operations.locator("summary").click();
  await expect(page.getByTestId("link-landing-combat-lab")).toHaveAttribute("href", "/combat-lab.html");
});

test("Orbital Combat Lab keeps the reticle clear and verifies the live pilot controls", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/combat-lab.html");
  await page.getByTestId("button-launch-combat-lab").click();
  await expect(page.getByTestId("arena-stage")).toBeVisible();

  await expect(page.getByTestId("text-relay-status")).toHaveCount(0);
  await expect(page.getByText("TRAINING OPERATION")).toHaveCount(0);
  await expect(page.getByText("DESTROY ALL DEFENDERS · TRAINING ONLY")).toHaveCount(0);
  await expect(page.getByText("PAINTED")).toHaveCount(0);
  await expect(page.getByTestId("orbital-target-status")).toBeAttached();
  await expect(page.getByTestId("orbital-target-status")).toBeHidden();
  await expect(page.getByTestId("reticle-center")).toBeVisible();
  await expect(page.getByTestId("button-target-lock")).toBeVisible();
  await expect(page.getByTestId("button-missile")).toBeVisible();
  await expect(page.getByTestId("button-fire")).toBeVisible();
  const throttleMeter = page.getByTestId("pilot-throttle-meter");
  await expect(throttleMeter).toBeAttached();
  await expect(throttleMeter).toBeHidden();
  const boostButton = page.getByTestId("button-boost");
  await expect(boostButton).toBeVisible();
  const countermeasureButton = page.getByTestId("button-countermeasure");
  await expect(countermeasureButton).toBeHidden();

  const runtimeReady = await page.evaluate(() => typeof window.__controlsTest?.getSpeed === "function");
  console.log(`[orbital-lab] WebGL simulation ${runtimeReady ? "ready" : "unavailable"}; validating browser controls.`);
  const speedBefore = runtimeReady ? await page.evaluate(() => window.__controlsTest!.getSpeed()) : null;
  const flightStick = page.getByTestId("stick-flight");
  const flightBox = await flightStick.boundingBox();
  expect(flightBox).not.toBeNull();
  if (!flightBox) throw new Error("Orbital flight stick is missing.");
  const flightX = flightBox.x + flightBox.width / 2;
  const flightY = flightBox.y + flightBox.height / 2;
  await page.mouse.move(flightX, flightY);
  await page.mouse.down();
  await page.mouse.move(flightX, flightY - Math.min(30, flightBox.height * 0.3), { steps: 4 });
  await expect.poll(async () => Number(await flightStick.getAttribute("data-axis-y"))).toBeLessThan(-0.2);
  await page.waitForTimeout(350);
  await expect(throttleMeter).toBeVisible();
  await expect.poll(async () => Number(await throttleMeter.getAttribute("aria-valuenow"))).toBeGreaterThan(20);
  if (runtimeReady && speedBefore !== null) {
    const speedAfterThrust = await page.evaluate(() => window.__controlsTest!.getSpeed());
    expect(speedAfterThrust).toBeGreaterThan(speedBefore);
  }
  await page.mouse.up();
  await expect(flightStick).toHaveAttribute("data-axis-y", "0.000");
  await expect.poll(async () => Number(await throttleMeter.getAttribute("aria-valuenow"))).toBe(0);

  const boostBox = await boostButton.boundingBox();
  const fireBox = await page.getByTestId("button-fire").boundingBox();
  expect(boostBox).not.toBeNull();
  expect(fireBox).not.toBeNull();
  if (!boostBox) throw new Error("Forward boost control is missing.");
  if (!fireBox) throw new Error("Primary fire control is missing.");
  expect(Math.abs(boostBox.x + boostBox.width / 2 - fireBox.x - fireBox.width / 2)).toBeLessThan(2);
  expect(boostBox.y + boostBox.height).toBeLessThanOrEqual(fireBox.y);
  await expect.poll(async () => Number(await boostButton.getAttribute("data-energy-percent"))).toBeGreaterThan(0);
  await page.keyboard.down("w");
  const boostSpeedBefore = runtimeReady ? await page.evaluate(() => window.__controlsTest!.getSpeed()) : null;
  await page.mouse.move(boostBox.x + boostBox.width / 2, boostBox.y + boostBox.height / 2);
  await page.mouse.down();
  await expect(boostButton).toHaveAttribute("data-active", "true");
  const energyBefore = Number(await boostButton.getAttribute("data-energy-percent"));
  await expect.poll(async () => Number(await boostButton.getAttribute("data-energy-percent"))).toBeLessThan(energyBefore);
  if (runtimeReady && boostSpeedBefore !== null) {
    await expect.poll(() => page.evaluate(() => window.__controlsTest!.getSpeed())).toBeGreaterThan(boostSpeedBefore);
  }
  await page.waitForTimeout(350);
  const energyAfterBoost = Number(await boostButton.getAttribute("data-energy-percent"));
  await page.mouse.up();
  await page.keyboard.up("w");
  await expect.poll(async () => Number(await boostButton.getAttribute("data-energy-percent"))).toBeGreaterThan(energyAfterBoost);

  const aimStick = page.getByTestId("stick-aim");
  const aimBox = await aimStick.boundingBox();
  expect(aimBox).not.toBeNull();
  if (!aimBox) throw new Error("Orbital aim stick is missing.");
  const aimX = aimBox.x + aimBox.width / 2;
  const aimY = aimBox.y + aimBox.height / 2;
  await page.mouse.move(aimX, aimY);
  await page.mouse.down();
  await page.mouse.move(aimX + Math.min(24, aimBox.width * 0.25), aimY, { steps: 3 });
  await expect.poll(async () => Number(await aimStick.getAttribute("data-axis-x"))).toBeGreaterThan(0.2);
  await page.mouse.up();
  await expect(aimStick).toHaveAttribute("data-axis-x", "0.000");

  await page.getByTestId("button-maneuvers").click();
  await expect(page.getByTestId("pilot-maneuver-actions")).toBeVisible();
  await expect(page.getByTestId("button-boost")).toBeVisible();
  await expect(page.getByTestId("button-brake")).toBeVisible();
  await expect(page.getByTestId("button-drift")).toBeVisible();
  await page.getByTestId("button-maneuvers").click();

  if (runtimeReady) {
    const targetLockButton = page.getByTestId("button-target-lock");
    await targetLockButton.click();
    const targetStatus = page.getByTestId("orbital-target-status");
    await expect(targetStatus).toBeVisible({ timeout: 5_000 });
    await expect(targetStatus).toHaveAttribute("data-faction", /^(ussf|accord)$/);
    await expect(targetLockButton).toHaveAttribute("data-locked", "true");
    const statusBox = await targetStatus.boundingBox();
    const reticleBox = await page.getByTestId("reticle-center").boundingBox();
    expect(statusBox).not.toBeNull();
    expect(reticleBox).not.toBeNull();
    if (statusBox && reticleBox) expect(statusBox.x + statusBox.width).toBeLessThan(reticleBox.x);

  }

  expect(pageErrors).toEqual([]);
});

test("empty Wing leaderboard explains its reward eligibility requirement", async ({ page }) => {
  await page.route("**/api/game/leaderboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [] }),
    }),
  );
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "WING LEADERBOARD" })).toBeVisible();
  await expect(page.getByTestId("public-wing-leaderboard")).toContainText(
    "No eligible Wing rewards yet.",
  );
  await expect(page.getByTestId("public-wing-leaderboard")).toContainText(
    "Private room-code matches do not qualify",
  );
  await expect(page.getByTestId("public-wing-leaderboard")).toContainText(
    "server-settled competitive Wing reward",
  );
});

test("sign-up route renders the existing Clerk form", async ({ page }) => {
  await page.goto("/sign-up");

  await expect(page.getByRole("textbox", { name: /email address/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^password$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
});

test("small-phone landing and solo setup respond to vertical touch scrolling", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const swipeUp = async () => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: 160, y: 520, radiusX: 8, radiusY: 8, force: 1 }],
    });
    for (const y of [440, 350, 260, 170]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ id: 1, x: 160, y, radiusX: 8, radiusY: 8, force: 1 }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  };

  try {
    await page.route("**/api/game/leaderboard", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entries: [] }),
      }),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /war for mars/i })).toBeVisible();
    const landing = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(landing.scrollHeight).toBeGreaterThan(landing.clientHeight);
    expect(landing.scrollWidth).toBeLessThanOrEqual(landing.clientWidth);
    await swipeUp();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await page.goto("/play");
    await expect(page.getByTestId("solo-flight")).toBeVisible();
    const setup = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(setup.scrollHeight).toBeGreaterThan(setup.clientHeight);
    expect(setup.scrollWidth).toBeLessThanOrEqual(setup.clientWidth);
    await page.evaluate(() => window.scrollTo(0, 0));
    await swipeUp();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test("solo flight launches and exits the playable 3D scene", async ({ page }) => {
  page.on("pageerror", (error) => console.error(`[solo-flight page error] ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`[solo-flight console error] ${message.text()}`);
  });
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

test("Rust Disc defers 3D startup until launch and reuses it on warm relaunch", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  let runtimeRequests = 0;

  try {
    await page.route("**/three-flight-runtime*", async (route) => {
      runtimeRequests++;
      if (runtimeRequests === 1) await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });
    await page.goto("/flight");
    await expect(page.getByTestId("button-launch")).toBeVisible();

    const beforeLaunch = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    expect(beforeLaunch.some((url) => url.includes("three-flight-runtime"))).toBe(false);

    const coldStart = await page.evaluate(() => performance.now());
    await page.getByTestId("button-launch").click();
    await expect(page.getByTestId("status-flight-engine-loading")).toBeVisible();
    await expect(page.getByTestId("status-flight-engine-loading")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('[data-testid="canvas-flight"] canvas')).toBeVisible();
    const coldFirstFrameMs = await page.evaluate((start) => performance.now() - start, coldStart);
    expect(runtimeRequests).toBe(1);

    const flightStick = page.getByTestId("stick-flight");
    const stickBox = await flightStick.boundingBox();
    expect(stickBox).not.toBeNull();
    if (!stickBox) throw new Error("Rust Disc flight stick is missing its touch target.");
    const stickCenterX = stickBox.x + stickBox.width / 2;
    const stickCenterY = stickBox.y + stickBox.height / 2;
    await page.mouse.move(stickCenterX, stickCenterY);
    await page.mouse.down();
    await page.mouse.move(stickCenterX, stickCenterY - stickBox.height * 0.32);
    await expect.poll(async () => Number(await flightStick.getAttribute("data-axis-y"))).toBeLessThan(-0.2);
    await page.mouse.up();
    await expect(flightStick).toHaveAttribute("data-axis-y", "0.000");
    await expect(flightStick).toHaveAttribute("data-recenter", "true");

    const upperSectorY = stickBox.y + stickBox.height * 0.06;
    await page.mouse.click(stickCenterX, upperSectorY);
    await page.waitForTimeout(110);
    await page.mouse.click(stickCenterX, upperSectorY);
    await expect(flightStick.getByText("UP THRUST", { exact: true })).toBeVisible();

    await page.getByTestId("button-pause").click();
    await page.getByTestId("button-briefing").click();
    await expect(page.getByTestId("button-launch")).toBeVisible();

    const warmStart = await page.evaluate(() => performance.now());
    await page.getByTestId("button-launch").click();
    await expect(page.getByTestId("status-flight-engine-loading")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('[data-testid="canvas-flight"] canvas')).toBeVisible();
    const warmFirstFrameMs = await page.evaluate((start) => performance.now() - start, warmStart);

    expect(runtimeRequests).toBe(1);
    expect(warmFirstFrameMs).toBeLessThan(coldFirstFrameMs);
    console.info(
      `Rust Disc browser simulation: cold ${coldFirstFrameMs.toFixed(0)} ms, warm ${warmFirstFrameMs.toFixed(0)} ms; software-WebGL/mobile emulation, not physical Android timing.`,
    );
  } finally {
    await context.close();
  }
});

test("local performance sampling is opt-in and does not submit reward requests", async ({ page }) => {
  const rewardRequests: string[] = [];
  page.on("request", (request) => {
    if (/reward|claim/i.test(new URL(request.url()).pathname)) rewardRequests.push(request.url());
  });
  await page.goto("/play");

  const capture = page.getByTestId("checkbox-local-performance");
  await expect(page.getByTestId("text-solo-notice")).toContainText("do not save campaign progress or award rewards");
  await expect(capture).not.toBeChecked();
  await capture.check();
  await expect(capture).toBeChecked();
  await expect(page.getByTestId("button-pace-strike")).toContainText(
    "Up to six minutes; may end early when the mission resolves.",
  );
  await expect(page.getByTestId("local-performance-toggle")).toContainText("No account, server, reward, or upload is used");
  await expect(page.getByTestId("local-performance-toggle")).toContainText("single browser-only run");
  await expect(page.getByTestId("local-performance-toggle")).toContainText("Normal Strike is unchanged");
  await expect(page.getByTestId("local-performance-toggle")).toContainText("Result-screen frames are reported separately");
  await page.getByTestId("button-pace-strike").click();
  await page.getByTestId("button-solo-launch").click();
  await expect(page.getByTestId("arena-stage")).toHaveAttribute("data-local-endurance", "true");
  await expect(page.getByTestId("button-exit-solo-flight")).toHaveText("END SAMPLE");
  await page.getByTestId("button-exit-solo-flight").click();
  await expect(page.getByTestId("performance-target-warning")).toContainText("of 360 active game seconds");
  expect(rewardRequests).toEqual([]);
});

test("mobile flight controls reserve device safe areas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play");

  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("viewport-fit=cover");
  expect(viewport).not.toContain("maximum-scale=1");

  await page.getByTestId("button-solo-launch").click();
  await expect(page.getByTestId("arena-stage")).toHaveCSS("touch-action", "none");
  await expect(page.getByTestId("arena-stage")).toHaveCSS("overflow", "hidden");
  await expect.poll(() => page.evaluate(() => Boolean(window.__controlsTest))).toBe(true);

  const moveStick = page.getByTestId("stick-move");
  const moveBox = await moveStick.boundingBox();
  expect(moveBox).not.toBeNull();
  if (!moveBox) throw new Error("Move stick is missing its touch target.");
  const touchStartX = moveBox.x + moveBox.width * 0.72;
  const touchStartY = moveBox.y + moveBox.height * 0.5;
  await page.mouse.move(touchStartX, touchStartY);
  await page.mouse.down();
  await expect(moveStick).toHaveAttribute("data-axis-x", "0.000");
  await page.mouse.move(touchStartX + 20, touchStartY);
  await expect.poll(async () => Number(await moveStick.getAttribute("data-axis-x"))).toBeGreaterThan(0.2);
  await page.mouse.up();
  await expect(moveStick).toHaveAttribute("data-axis-x", "0.000");

  const leftStyle = await page.getByTestId("flight-controls-left").getAttribute("style");
  const rightStyle = await page.getByTestId("flight-controls-right").getAttribute("style");
  expect(leftStyle).toContain("safe-area-inset-left");
  expect(leftStyle).toContain("safe-area-inset-bottom");
  expect(rightStyle).toContain("safe-area-inset-right");
  expect(rightStyle).toContain("safe-area-inset-bottom");

  await page.getByTestId("button-pause").click();
  await expect(page.getByTestId("button-resume-sortie")).toBeVisible();
  const resume = page.getByTestId("button-resume-sortie");
  await resume.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("button-pause")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__controlsTest?.getFiring?.())).toBe(false);

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
