import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Cinder Ring exposes only asteroid competition, not separate approach or private games", () => {
  const galaxy = readFileSync(new URL("./GalaxyScreen.tsx", import.meta.url), "utf8");
  const hub = readFileSync(new URL("./AsteroidArenaHub.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("./WarApp.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(galaxy, /CinderRingDockingApproach|BEGIN FLIGHT APPROACH|onCreatePrivateRoom|onLaunchExpedition|onLaunchCampaign|setLocation|ENTER ASTEROID FLIGHT CIRCUIT/);
  assert.match(galaxy, /atCinderRing && onJoinCompetitiveQueue && onCancelCompetitiveQueue/);
  assert.match(galaxy, /<AsteroidArenaHub/);
  assert.match(hub, /ARCADE SKIRMISH · 5V5/);
  assert.match(hub, /current server-authoritative arena uses Wing Relay rules/);
  assert.match(hub, /const canQueue = atAsteroid && queueAvailable && isLoaded && Boolean\(isSignedIn\) && !queueing/);
  assert.match(hub, /button-cancel-asteroid-queue/);
  assert.doesNotMatch(hub, /panel-cinder-ring-private-dock|button-create-private-room|button-join-private-room/);
  assert.match(app, /returnToOrbitalAfterOperationRef\.current = true;\s*joinOnline\("", "competitive"\)/);
  assert.match(galaxy, /canLaunchEncounter=\{false\}/);
  assert.match(galaxy, /SHARED UNIVERSE · STATION SERVICES/);
  assert.match(galaxy, /Close services to resume your existing flight/);
});
