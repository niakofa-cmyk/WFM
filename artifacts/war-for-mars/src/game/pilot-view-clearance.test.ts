import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Orbital exploration defaults to fixed sticks and offers touch-anywhere controls by preference", () => {
  const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  const stick = readFileSync(new URL("./PilotFlightStick.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("./HomeScreen.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("./combat-lab.css", import.meta.url), "utf8");
  assert.match(arena, /pilotControlLayout = "fixed"/);
  assert.match(arena, /pilotControlLayout === "touch-anywhere"/);
  assert.match(arena, /floatingSide=\{touchAnywhereControls \? "left" : undefined\}/);
  assert.match(arena, /floatingSide=\{touchAnywhereControls \? "right" : undefined\}/);
  assert.match(home, /button-control-layout-fixed/);
  assert.match(home, /button-control-layout-touch-anywhere/);
  assert.match(home, /props\.onPilotControlLayout\("fixed"\)/);
  assert.match(home, /props\.onPilotControlLayout\("touch-anywhere"\)/);
  assert.match(stick, /dataset\.active = "true"/);
  assert.match(css, /pilot-flight-stick-zone\[data-active=true\] \.pilot-flight-stick-visual\{opacity:\.78\}/);
  assert.match(css, /pointer-events:none/);
});

test("campaign progress is moved into the flight menu instead of overlaying the pilot view", () => {
  const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  const campaign = readFileSync(new URL("./GlobalCampaignStatus.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("./combat-lab.css", import.meta.url), "utf8");
  assert.match(arena, /data-testid="campaign-status-slot"/);
  assert.match(campaign, /createPortal\(/);
  assert.match(campaign, /campaign-menu-status/);
  assert.match(css, /status-global-campaign\]:not\(\.campaign-menu-status\)/);
});
