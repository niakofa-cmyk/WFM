import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { IDLE_ORBITAL, ORBITAL_DT } from "@workspace/orbital-sim";
import * as sharedDetmath from "@workspace/orbital-sim/detmath";
import { createOrbitalAuthority } from "../../../api-server/src/game/orbital-authority";
import { SHIPS as serverShips } from "../../../api-server/src/game/ships";
import {
  createMatch as createServerMatch,
  step as stepServerMatch,
} from "../../../api-server/src/game/sim";
import { prepareOrbital as prepareServerOrbital } from "../../../api-server/src/game/orbital-sim";
import { SHIPS } from "./ships";
import { createMatch, step as stepClientMatch, type StepInput } from "./sim";
import { prepareOrbital } from "./orbital-sim";
import { integrateFlight } from "./orbital-flight";
import { launchMissile, primaryBullet, updateAcquisition } from "./orbital-weapons";
import * as gameDetmath from "./detmath";

const idle: StepInput = { throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null };

test("shared orbital simulation avoids runtime-approximated Math functions", async () => {
  const modules = await Promise.all([
    readFile(new URL("../../../../lib/orbital-sim/src/flight.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../../lib/orbital-sim/src/weapons.ts", import.meta.url), "utf8"),
  ]);
  for (const source of modules) {
    assert.doesNotMatch(source, /\bMath\.(?:sin|cos|atan2|asin|acos|exp|hypot)\s*\(/);
  }
});

test("browser and server math adapters use the same shared deterministic source", () => {
  const inputs = [-1000, -Math.PI, -2.4, -0.1, 0, 0.1, 1.4, Math.PI, 1000];
  for (const x of inputs) {
    assert.equal(gameDetmath.detSin(x), sharedDetmath.detSin(x));
    assert.equal(gameDetmath.detCos(x), sharedDetmath.detCos(x));
    assert.equal(gameDetmath.detAtan(x), sharedDetmath.detAtan(x));
    assert.equal(gameDetmath.detExp(x), sharedDetmath.detExp(x));
    assert.equal(gameDetmath.detHypot(x, x / 2), sharedDetmath.detHypot(x, x / 2));
    assert.equal(gameDetmath.detAcos(Math.max(-1, Math.min(1, x / 2))), sharedDetmath.detAcos(Math.max(-1, Math.min(1, x / 2))));
  }
  for (const [y, x] of [[0, 0], [1, 0], [-1, 2], [2, -1], [-4, -3]] as const) {
    assert.equal(gameDetmath.detAtan2(y, x), sharedDetmath.detAtan2(y, x));
  }
});

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

test("versioned Contact orbital replay advances identically on client and reward server", () => {
  const setup = {
    seed: 8851,
    goal: "disc" as const,
    disc: "rust" as const,
    allyCount: 4,
    foeCount: 4,
  };
  const client = prepareOrbital(createMatch("duskbreaker", "ussf", 0, "practice", setup));
  const server = prepareServerOrbital(createServerMatch("duskbreaker", "ussf", 0, "practice", setup));
  const controls: StepInput = {
    ...idle,
    throttle: 0.35,
    yaw: 0.08,
    pitch: -0.05,
    fire: true,
    lock: true,
    vertical: 0.1,
    roll: -0.04,
    boost: true,
    brake: false,
    inertial: false,
    missile: false,
    aimAssist: false,
  };
  const releasedControls: StepInput = { ...controls, lock: false, boost: false };
  for (let tick = 0; tick < 240 && !client.over; tick += 1) {
    const input = tick === 0 ? controls : tick === 60
      ? { ...releasedControls, missile: true }
      : tick === 61
        ? { ...releasedControls, missile: false }
        : tick === 90
          ? { ...releasedControls, inertial: true }
          : tick === 91
            ? { ...releasedControls, inertial: false }
            : releasedControls;
    stepClientMatch(client, input, 1 / 60);
    stepServerMatch(server, input, 1 / 60);
    assert.deepEqual(server, client, `orbital replay diverged at frame ${tick + 1}`);
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
