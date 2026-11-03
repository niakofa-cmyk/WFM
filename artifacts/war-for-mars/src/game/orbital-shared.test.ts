import assert from "node:assert/strict";
import test from "node:test";
import { IDLE_ORBITAL, ORBITAL_DT } from "@workspace/orbital-sim";
import { createOrbitalAuthority } from "../../../api-server/src/game/orbital-authority";
import { SHIPS as serverShips } from "../../../api-server/src/game/ships";
import { SHIPS } from "./ships";
import { createMatch, type StepInput } from "./sim";
import { prepareOrbital } from "./orbital-sim";
import { integrateFlight } from "./orbital-flight";
import { launchMissile, primaryBullet, updateAcquisition } from "./orbital-weapons";

const idle: StepInput = { throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null };
test("client and server share roster flight axes, boost, inertia and braking", () => {
  assert.deepEqual(SHIPS, serverShips);
  const server = createOrbitalAuthority();
  const client = prepareOrbital(createMatch("duskbreaker", "ussf", 0, "practice", { seed: 1938 }));
  client.rocks = [];
  for (let tick = 1; tick <= 100; tick++) {
    const controls = { throttle: .5, yaw: .1, pitch: .2, strafe: .15, vertical: .25, roll: .12, boost: tick < 15, brake: tick > 80, inertial: tick === 20, aimAssist: tick === 30 };
    assert.equal(server.input(0, { ...IDLE_ORBITAL, seq: tick, ...controls }).ok, true);
    integrateFlight(client.player, { ...idle, ...controls }, ORBITAL_DT, 1, client);
    const actual = server.step().pilots[0];
    assert.deepEqual(actual.space, client.player.space);
    assert.equal(actual.x, client.player.x); assert.equal(actual.z, client.player.z);
  }
});

test("acquired lock cannot be transferred to a different target or survive clear", () => {
  const match = prepareOrbital(createMatch("duskbreaker", "ussf", 0, "practice", { foeCount: 2, seed: 1938 }));
  match.rocks = [];
  const pilot = match.player; const first = match.enemies[0]; const second = match.enemies[1];
  second.x = 1; second.z = -4; second.space!.y = 0;
  pilot.lockTargetId = first.id;
  for (let i = 0; i < 80; i++) updateAcquisition(match, pilot, 1 / 60);
  assert.equal(pilot.space!.lockProgress, 1);
  pilot.lockTargetId = second.id;
  assert.equal(launchMissile(match, pilot), false);
  updateAcquisition(match, pilot, 1 / 60);
  assert.ok(pilot.space!.lockProgress < .02);
  pilot.lockTargetId = null; updateAcquisition(match, pilot, 1 / 60);
  assert.equal(pilot.space!.lockProgress, 0);
});

test("asteroid occlusion blocks lock and assisted pulse steering in three dimensions", () => {
  const match = prepareOrbital(createMatch("duskbreaker", "ussf", 0, "practice", { foeCount: 1, seed: 1938 }));
  const pilot = match.player; const target = match.enemies[0];
  pilot.lockTargetId = target.id; target.x = 2;
  match.rocks = [];
  assert.ok(primaryBullet(match, pilot, 10).vx > 0);
  match.rocks = [{ x: 1, z: 12, r: 4 }];
  for (let i = 0; i < 80; i++) updateAcquisition(match, pilot, 1 / 60);
  assert.equal(pilot.space!.lockProgress, 0);
  assert.equal(primaryBullet(match, pilot, 10).vx, 0);
  assert.equal(launchMissile(match, pilot), false);
  match.rocks = [];
  for (let i = 0; i < 80; i++) updateAcquisition(match, pilot, 1 / 60);
  assert.equal(pilot.space!.lockProgress, 1);
  assert.equal(launchMissile(match, pilot), true);
});
