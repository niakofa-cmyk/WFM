import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DESTINATIONS, STATUS_LABEL, localFactionBrief } from "./universe-destinations";
import { MARS_ADVENTURES, MARS_ADVENTURE_STATE_LABEL } from "./mars-adventure-network";

test("universe entry offers only the two existing local flight experiences", () => {
  assert.deepEqual(
    DESTINATIONS.filter((destination) => destination.status !== "planned")
      .map(({ id, status }) => ({ id, status })),
    [
      { id: "mars-orbit", status: "training" },
      { id: "cinder-ring", status: "approach" },
    ],
  );
  assert.match(STATUS_LABEL.training, /LOCAL TRAINING/);
  assert.match(STATUS_LABEL.approach, /LOCAL APPROACH/);
  assert.match(STATUS_LABEL.planned, /PLANNED.*UNAVAILABLE/);
});

test("charted destinations have unique identities and bounded map positions", () => {
  assert.equal(new Set(DESTINATIONS.map(({ id }) => id)).size, DESTINATIONS.length);
  for (const destination of DESTINATIONS) {
    assert.ok(destination.x > 0 && destination.x < 100);
    assert.ok(destination.y > 0 && destination.y < 100);
    assert.ok(destination.summary.length > 0 && destination.detail.length > 0);
    if (destination.status === "planned") {
      assert.ok(destination.detail.includes("Planned destination"));
    }
  }
});

test("local universe entry keeps flight lazy and blocks planned destination launches", () => {
  const source = readFileSync(new URL("./OrbitalBoot.tsx", import.meta.url), "utf8");
  assert.match(source, /const Arena = lazy\(/);
  assert.match(source, /const CinderRingDockingApproach = lazy\(/);
  assert.match(source, /if \(dest.status === "planned"\) return/);
  assert.match(source, /<button[^>]*disabled[^>]*data-testid="button-destination-unavailable"/);
  assert.doesNotMatch(source, /fetch\(|new WebSocket/);
  assert.match(source, /useGetWorldPatrols/);
  assert.match(source, /enabled: Boolean\(userId && !standalone && \(mode === "entry" \|\| mode === "universe"\) && worldQuery\.data\)/);
  assert.match(source, /serverStartLocation === startLocation/);
  assert.match(source, /patrolDirectory,[\s\S]*canInterceptPatrol,[\s\S]*onInterceptPatrol/);
  assert.match(source, /traffic=\{localTraffic\}/);
});

test("standalone boot does not call Clerk auth outside a provider", () => {
  const source = readFileSync(new URL("./OrbitalBoot.tsx", import.meta.url), "utf8");
  assert.match(source, /return standalone[\s\S]*?<OrbitalBootCore standalone/);
  assert.match(source, /function AuthenticatedOrbitalBoot\(\) \{\s*const \{ getToken, userId \} = useAuth\(\);/);
  assert.match(source, /function OrbitalBootCore\(/);
});

test("local faction briefing reflects the actual opposing training side without inventing a world", () => {
  assert.match(localFactionBrief("ussf", "training"), /Accord AI defenders/);
  assert.match(localFactionBrief("accord", "training"), /USSF AI defenders/);
  assert.match(localFactionBrief("ussf", "approach"), /no patrols, territory or station allegiance/);
  assert.match(localFactionBrief("accord", "approach"), /no patrols, territory or station allegiance/);
  assert.match(localFactionBrief("ussf", "planned"), /no effect here/);
  assert.match(localFactionBrief("accord", "planned"), /no effect here/);
});

test("Mars route atlas preserves unique IDs and labels local, compatibility, and planned state separately", () => {
  assert.equal(new Set(MARS_ADVENTURES.map(({ id }) => id)).size, MARS_ADVENTURES.length);
  assert.equal(MARS_ADVENTURES.length, 11);
  assert.ok(MARS_ADVENTURES.some(({ id, state }) => id === "cinder-ring" && state === "orbital-local"));
  assert.ok(MARS_ADVENTURES.some(({ id, state }) => id === "rust-disc" && state === "compatibility"));
  assert.ok(MARS_ADVENTURES.some(({ id, state }) => id === "night-side-station" && state === "orbital-local"));
  assert.notEqual(MARS_ADVENTURE_STATE_LABEL["orbital-local"], MARS_ADVENTURE_STATE_LABEL.compatibility);
  assert.notEqual(MARS_ADVENTURE_STATE_LABEL.compatibility, MARS_ADVENTURE_STATE_LABEL.planned);
  for (const adventure of MARS_ADVENTURES) {
    assert.ok(adventure.concept.length > 0);
    assert.ok(adventure.currentEvidence.length > 0);
    assert.ok(adventure.nextGate.length > 0);
  }
});

test("route atlas is informational and does not claim live events or launch compatibility routes through local flight", () => {
  const component = readFileSync(new URL("./MarsAdventureAtlas.tsx", import.meta.url), "utf8");
  const boot = readFileSync(new URL("./OrbitalBoot.tsx", import.meta.url), "utf8");
  assert.match(component, /Routes are travel guidance; adventures become live only when their gameplay and authority are connected/);
  assert.match(boot, /<MarsAdventureAtlas \/>/);
  assert.match(boot, /if \(dest.status === "planned"\) return/);
  assert.doesNotMatch(component, /fetch\(|new WebSocket|onClick=/);
});
