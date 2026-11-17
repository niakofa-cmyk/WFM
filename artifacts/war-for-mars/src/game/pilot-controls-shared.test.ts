import assert from "node:assert/strict";
import test from "node:test";
import {
  createSectorFlight, integrateSpatialFlight, newFlight, NEUTRAL_SECTOR_FLIGHT_INPUT,
  neutralFlightControls, normalizeFlightControls, pilotAxesToSpatialAxes,
  stepSectorFlight, toOrbitalPilotStepInput, toOrbitalStepInput, toSectorFlightInput,
  type SectorFlightInput, type SectorFlightWorld, type SpatialCraft,
} from "@workspace/orbital-sim";
import * as compatibility from "./flight-control";
import { SHIPS } from "./ships";

test("browser pilot adapters are the shared engine functions, not parallel implementations", () => {
  assert.equal(compatibility.neutralFlightControls, neutralFlightControls);
  assert.equal(compatibility.normalizeFlightControls, normalizeFlightControls);
  assert.equal(compatibility.toOrbitalStepInput, toOrbitalStepInput);
  assert.equal(compatibility.toOrbitalPilotStepInput, toOrbitalPilotStepInput);
  assert.equal(compatibility.toSectorFlightInput, toSectorFlightInput);
  const first = neutralFlightControls();
  first.throttle = 1;
  assert.equal(neutralFlightControls().throttle, 0);
});

test("engine pilot signs are bounded and retain existing Rust Disc conventions", () => {
  const values = [-Infinity, -3, -1, -0.25, 0, 0.25, 1, 3, Infinity, NaN];
  for (const value of values) {
    const expected = Number.isFinite(value) ? -Math.max(-1, Math.min(1, value)) : -0;
    assert.deepEqual(pilotAxesToSpatialAxes({ yaw: value, roll: value, strafe: value }), {
      yaw: expected, roll: expected, strafe: expected,
    });
  }
});

test("shared sector and Orbital pilot axes produce identical canonical flight trajectories", () => {
  const world: SectorFlightWorld = {
    id: "engine-parity-test", version: 1, radius: 10000, rocks: [],
    relay: { x: 5000, y: 5000, z: 5000 },
    extraction: { x: -5000, y: -5000, z: -5000 }, hostileFireDisabled: true,
  };
  const cases: Partial<SectorFlightInput>[] = [
    { throttle: 0.65, yaw: 0.2, pitch: -0.15, roll: 0.1, strafe: -0.3, vertical: 0.25 },
    { throttle: 1, yaw: -0.25, pitch: 0.1, roll: -0.2, boost: true },
    { throttle: 0.4, strafe: 0.5, vertical: -0.4, drift: true },
    { throttle: 0.3, brake: true },
  ];
  for (const variant of cases) {
    const input = { ...NEUTRAL_SECTOR_FLIGHT_INPUT, ...variant };
    const state = createSectorFlight("duskbreaker", world);
    const craft: SpatialCraft = {
      id: 0, x: 0, z: 70, yaw: 0, pitch: 0, speed: 0, steer: 0,
      hull: 100, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
      cloak: 0, untargetable: 0, radius: 2, lockTargetId: null, space: newFlight(),
    };
    const controls = toOrbitalPilotStepInput(input);
    for (let tick = 0; tick < 120; tick++) {
      stepSectorFlight(state, input, 1 / 60, world, SHIPS.duskbreaker);
      integrateSpatialFlight(craft, controls, 1 / 60, 2, [], SHIPS.duskbreaker, { boundaryRadius: null });
    }
    assert.deepEqual(state.position, { x: craft.x, y: craft.space!.y, z: craft.z });
    assert.deepEqual(state.velocity, { x: craft.space!.vx, y: craft.space!.vy, z: craft.space!.vz });
    assert.deepEqual(state.orientation, {
      x: craft.space!.q[0], y: craft.space!.q[1], z: craft.space!.q[2], w: craft.space!.q[3],
    });
    assert.equal(state.energy, craft.space!.energy);
  }
});
