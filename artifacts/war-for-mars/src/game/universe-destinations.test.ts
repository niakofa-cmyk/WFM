import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DESTINATIONS, STATUS_LABEL, localFactionBrief } from "./universe-destinations";

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
  assert.doesNotMatch(source, /fetch\(|new WebSocket|@workspace\/api-client-react/);
});

test("local faction briefing reflects the actual opposing training side without inventing a world", () => {
  assert.match(localFactionBrief("ussf", "training"), /Accord AI defenders/);
  assert.match(localFactionBrief("accord", "training"), /USSF AI defenders/);
  assert.match(localFactionBrief("ussf", "approach"), /no patrols, territory or station allegiance/);
  assert.match(localFactionBrief("accord", "approach"), /no patrols, territory or station allegiance/);
  assert.match(localFactionBrief("ussf", "planned"), /no effect here/);
  assert.match(localFactionBrief("accord", "planned"), /no effect here/);
});
