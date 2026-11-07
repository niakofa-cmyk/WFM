import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const preview = readFileSync(new URL("./OrbitalFlightPreview.tsx", import.meta.url), "utf8");
const boot = readFileSync(new URL("./OrbitalBoot.tsx", import.meta.url), "utf8");

test("Cinder station activities are exposed only after native local docking", () => {
  assert.match(preview, /\{docked\s*\?\s*\(\s*<section[^>]*data-testid="orbital-station-console"/);
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
});

test("the native activity handoff does not submit local docking or training to an API", () => {
  assert.doesNotMatch(preview, /\bfetch\s*\(|customFetch|\/api\//);
  assert.match(preview, /href=\{servicesHref\}/);
  assert.match(boot, /servicesHref=\{HUB\}/);
});
