import assert from "node:assert/strict";
import test from "node:test";
import { cinderRingEntrySurface } from "./cinder-ring-entry";
import { readFileSync } from "node:fs";

test("Cinder Ring no longer mounts a separate approach or private-match game", () => {
  const galaxy = readFileSync(new URL("./GalaxyScreen.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(galaxy, /CinderRingDockingApproach|BEGIN FLIGHT APPROACH|AsteroidArenaHub|onCreatePrivateRoom|onJoinCompetitiveQueue/);
  assert.match(galaxy, /SHARED UNIVERSE · STATION SERVICES/);
  assert.match(galaxy, /Close services to resume your existing flight/);
});
