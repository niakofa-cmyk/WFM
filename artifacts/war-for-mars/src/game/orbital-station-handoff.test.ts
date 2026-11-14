import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const preview = readFileSync(new URL("./OrbitalFlightPreview.tsx", import.meta.url), "utf8");
const boot = readFileSync(new URL("./OrbitalBoot.tsx", import.meta.url), "utf8");
const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");

test("Cinder station activities are exposed only after native local docking", () => {
  assert.match(preview, /\{docked\s*\?\s*\(\s*<section[^>]*data-testid="orbital-station-console"/);
  assert.match(preview, /data-testid="button-cinder-native-skirmish"/);
  assert.match(preview, /const launchNativeSkirmish = \(\) => \{[\s\S]*?dockedRef\.current[\s\S]*?createNativeCinderSkirmish\(shipId\)/);
  assert.match(preview, /dockedRef\.current \? snapshotDockedFlightForTraining\(flight\) : null/);
  assert.match(preview, /if \(!snapshot\) return;\s*clearInput\(bus\);\s*onLaunchTraining\(snapshot\)/);
  assert.match(preview, /data-testid="link-cinder-account-operations"/);
  assert.match(preview, /This local dock grants no access or rewards/);
});

test("local training uses the explicit compatibility route and keeps its return snapshot", () => {
  assert.match(boot, /onLaunchTraining=\{\(snapshot\) => \{\s*setTrainingReturnSnapshot\(snapshot\);[\s\S]*?setMode\("arena"\);/);
  assert.match(boot, /trainingReturnSnapshot=\{trainingReturnSnapshot\}/);
  assert.match(boot, /onTrainingReturnConsumed=\{\(\) => setTrainingReturnSnapshot\(null\)\}/);
  assert.match(boot, /setSummary\(`Mars Orbit training complete\.[\s\S]*?setMode\("entry"\)/);
  assert.match(boot, /onNetworkExit=\{\(\) => \{ throw new Error\("Offline training must not open a network session\."\); \}\}/);
  assert.match(preview, /data-testid="button-cinder-local-training"[^>]*onClick=\{launchTraining\}/);
  assert.match(preview, /data-testid="orbital-native-debrief"/);
  assert.match(preview, /RECOVER AT STATION · LOCAL RESET/);
});

test("native skirmish is the station default while Arena remains a separate rollback route", () => {
  assert.match(preview, /button-cinder-native-skirmish/);
  assert.match(preview, /button-cinder-local-training/);
  assert.match(preview, /lock: state\.lock \* 100/);
  assert.match(preview, /missileReady: state\.stage === "drone" && state\.lock >= 1 && state\.missiles > 0/);
  assert.match(preview, /data-testid="button-orbital-preview-missile" disabled=\{!hud\.missileReady\}/);
  assert.match(preview, /HOLD LOCK TO 100% BEFORE MISSILE/);
  assert.match(boot, /modeId="orbital-combat-lab" runtime=\{ORBITAL_RUNTIME_ID\}/);
  assert.match(arena, /new THREE\.WebGLRenderer\(/);
  assert.match(arena, /new THREE\.Scene\(/);
});

test("the native activity handoff does not submit local docking or training to an API", () => {
  assert.doesNotMatch(preview, /\bfetch\s*\(|customFetch|\/api\//);
  assert.match(preview, /href=\{servicesHref\}/);
  assert.match(boot, /servicesHref=\{HUB\}/);
});
