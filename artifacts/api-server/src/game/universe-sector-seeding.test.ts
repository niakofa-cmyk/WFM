import assert from "node:assert/strict";
import test from "node:test";
import {
  anomalyGravityAcceleration,
  anomalyGravityWellForSector,
  integrateSpatialFlight,
  isAnomalyGravityWellV1,
  isFreeFlightEnvironmentV1,
  newFlight,
  normalizeFlightControls,
  seedUniverseSector,
  UNIVERSE_MARS_REFERENCE,
  UNIVERSE_MOON_REFERENCE,
} from "@workspace/orbital-sim";
import { SHIPS } from "./ships";

test("Orbital sector seeding repeats deterministically for large addresses", () => {
  const key = "900719925474099312345:-19:4";
  const server = seedUniverseSector(key);
  const clientReference = seedUniverseSector(key);
  assert.deepEqual(server, clientReference);
  assert.ok(server.asteroids.length >= 3 && server.asteroids.length <= 5);
  assert.ok(server.asteroids.every(({ x, y, z, r, seed }) =>
    [x, y, z, r, seed].every(Number.isFinite),
  ));
  assert.notDeepEqual(server, seedUniverseSector("900719925474099312346:-19:4"));
});

test("Orbital sector seeding rejects missing identity instead of silently creating origin content", () => {
  assert.throws(() => seedUniverseSector(""));
});

test("seeded anomaly lens assemblies stay clear of Mars and the Moon in nearby sectors", () => {
  const bodies = [UNIVERSE_MARS_REFERENCE, UNIVERSE_MOON_REFERENCE];
  let anomalyCount = 0;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const sector = seedUniverseSector(`${x}:${y}:${z}`);
        if (!sector.anomaly) continue;
        anomalyCount += 1;
        const worldPosition = {
          x: x * 512 + sector.anomaly.x,
          y: y * 512 + sector.anomaly.y,
          z: z * 512 + sector.anomaly.z,
        };
        for (const body of bodies) {
          const distance = Math.hypot(
            worldPosition.x - body.position.x,
            worldPosition.y - body.position.y,
            worldPosition.z - body.position.z,
          );
          assert.ok(
            distance >= body.radius + 36,
            `anomaly in ${x}:${y}:${z} should leave the lens assembly clear of ${body.id}`,
          );
        }
      }
    }
  }
  assert.ok(anomalyCount > 0, "the nearby sector sample includes anomaly content");
});

test("anomaly gravity is deterministic, finite, bounded, and integrated by the shared flight kernel", () => {
  const well = anomalyGravityWellForSector("mars:mars-orbit");
  assert.ok(well);
  assert.ok(isAnomalyGravityWellV1(well));
  assert.deepEqual(well, anomalyGravityWellForSector("mars:mars-orbit"));
  assert.deepEqual(
    anomalyGravityAcceleration(well.center, well),
    { x: 0, y: 0, z: 0 },
  );
  const point = { x: well.center.x + 30, y: well.center.y, z: well.center.z };
  const acceleration = anomalyGravityAcceleration(point, well);
  assert.ok(acceleration.x < 0, "the force points toward the anomaly center");
  assert.ok(Math.hypot(acceleration.x, acceleration.y, acceleration.z) <= well.maxAcceleration);
  assert.deepEqual(
    anomalyGravityAcceleration(
      { x: well.center.x + well.influenceRadius + 1, y: well.center.y, z: well.center.z },
      well,
    ),
    { x: 0, y: 0, z: 0 },
  );

  const craft = {
    id: 0, x: point.x, z: point.z, yaw: 0, pitch: 0, speed: 0, steer: 0,
    hull: 100, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
    cloak: 0, untargetable: 0, radius: 2, lockTargetId: null, space: newFlight(),
  };
  integrateSpatialFlight(
    craft,
    normalizeFlightControls({}),
    1 / 30,
    1,
    [],
    SHIPS.duskbreaker,
    { boundaryRadius: null, gravityWells: [well] },
  );
  assert.ok(craft.space!.vx < 0);
  assert.ok(craft.x < point.x);
});

test("free-flight environment packets are strict and keep gravity disabled until negotiated", () => {
  const well = anomalyGravityWellForSector("mars:mars-orbit");
  assert.ok(well);
  const disabled = {
    protocol: "orbital-freeflight-environment-v1",
    sessionInstanceId: "00000000-0000-4000-8000-000000000000",
    enabled: false,
    gravityWells: [],
  };
  assert.equal(isFreeFlightEnvironmentV1(disabled), true);
  assert.equal(isFreeFlightEnvironmentV1({ ...disabled, gravityWells: [well] }), false);
  assert.equal(isFreeFlightEnvironmentV1({ ...disabled, enabled: true, gravityWells: [well] }), true);
  assert.equal(isFreeFlightEnvironmentV1({ ...disabled, untrusted: true }), false);
});
