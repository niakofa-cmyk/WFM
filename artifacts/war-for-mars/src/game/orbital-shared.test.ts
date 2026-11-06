import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  guideMissile,
  IDLE_ORBITAL,
  LEGACY_ORBITAL_RULES_VERSION,
  LEGACY_ORBITAL_RUNTIME_ID,
  MISSILE_CATALOG,
  ORBITAL_DT,
  ORBITAL_RULES_VERSION,
  ORBITAL_RUNTIME_ID,
  PRIMARY_WEAPON_CATALOG,
  newFlight,
  type SpatialBullet,
  type SpatialCraft,
} from "@workspace/orbital-sim";
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
import { launchMissile, primaryBullet, primaryVolley, updateAcquisition } from "./orbital-weapons";
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

test("versioned Orbital weapon catalog covers every compatible hull fit", () => {
  assert.equal(LEGACY_ORBITAL_RUNTIME_ID, "orbital-v1");
  assert.equal(ORBITAL_RUNTIME_ID, "orbital-v2");
  assert.equal(LEGACY_ORBITAL_RULES_VERSION, 1);
  assert.equal(ORBITAL_RULES_VERSION, 2);
  const primaryFits = new Set<string>();
  const missileFits = new Set<string>();
  for (const ship of Object.values(SHIPS)) {
    const primary = PRIMARY_WEAPON_CATALOG[ship.primaryFit];
    const missile = MISSILE_CATALOG[ship.missileFit];
    assert.ok(primary.compatibleShipIds.includes(ship.id), `${ship.id} must fit ${primary.fitId}`);
    assert.ok(missile.compatibleShipIds.includes(ship.id), `${ship.id} must fit ${missile.fitId}`);
    assert.equal(primary.ammoCapacity, null);
    assert.equal(primary.ammoCost, 0);
    assert.equal(primary.energyCost, 0);
    assert.equal(primary.heatPerShot, 0);
    assert.equal(missile.ammoCost, 1);
    primaryFits.add(primary.fitId);
    missileFits.add(missile.fitId);
  }
  assert.equal(primaryFits.size, Object.keys(PRIMARY_WEAPON_CATALOG).length);
  assert.equal(missileFits.size, Object.keys(MISSILE_CATALOG).length);
});

test("Orbital v2 fires deterministic multi-projectile primary and missile salvos", () => {
  const primaryMatch = prepareOrbital(createMatch("shakuna", "accord", 0, "practice", { seed: 402 }));
  primaryMatch.rocks = [];
  const primaryPilot = primaryMatch.player;
  primaryPilot.space!.aimAssist = false;
  const primary = primaryVolley(primaryMatch, primaryPilot, SHIPS.shakuna.shotDmg);
  assert.equal(primary.length, 2);
  assert.ok(Math.abs(primary.reduce((sum, bullet) => sum + bullet.dmg, 0) - SHIPS.shakuna.shotDmg) < 1e-9);
  assert.deepEqual(primary.map((bullet) => bullet.weaponId), ["twin-pulse", "twin-pulse"]);
  assert.notEqual(primary[0]!.vx, primary[1]!.vx);
  const integrated = prepareOrbital(createMatch("shakuna", "accord", 0, "practice", { seed: 405 }));
  integrated.rocks = [];
  stepClientMatch(integrated, { ...idle, fire: true }, 1 / 30);
  assert.equal(integrated.bullets.length, 2, "the actual orbital step must execute both twin-pulse projectiles");

  const missileMatch = prepareOrbital(createMatch("garuda", "accord", 0, "practice", { seed: 403, foeCount: 1 }));
  missileMatch.rocks = [];
  const pilot = missileMatch.player;
  const target = missileMatch.enemies[0]!;
  pilot.lockTargetId = target.id;
  pilot.space!.lockTargetId = target.id;
  pilot.space!.lockProgress = 1;
  assert.equal(launchMissile(missileMatch, pilot), true);
  assert.equal(missileMatch.bullets.length, 3);
  assert.ok(Math.abs(missileMatch.bullets.reduce((sum, bullet) => sum + bullet.dmg, 0) - SHIPS.garuda.missileDamage) < 1e-9);
  assert.equal(pilot.space!.ammo, SHIPS.garuda.missileAmmo - 1);
  assert.equal(pilot.space!.missileCd, MISSILE_CATALOG["swarm-pod"].cooldownSeconds);
  assert.ok(missileMatch.bullets.every((bullet) => bullet.weaponId === "swarm-pod" && bullet.guidance === "active"));
});

test("semi-active missile guidance stops steering when the launcher loses lock", () => {
  const target: SpatialCraft = {
    id: 2, x: 20, z: -20, yaw: 0, pitch: 0, speed: 0, steer: 0,
    hull: 100, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
    cloak: 0, untargetable: 0, radius: 1, lockTargetId: null, space: newFlight(),
  };
  const launcher = { lockTargetId: null };
  const missile: SpatialBullet = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: -30, life: 4,
    dmg: 10, r: 0.5, homeId: target.id, missile: true, guidance: "semi-active",
  };
  guideMissile(missile, target, 1 / 30, launcher);
  assert.equal(missile.vx, 0);
  assert.equal(missile.vz, -30);
  launcher.lockTargetId = target.id;
  guideMissile(missile, target, 1 / 30, launcher);
  assert.ok(missile.vx > 0);
});

test("Orbital v1 retains the former generic primary and missile behavior", () => {
  const match = prepareOrbital(
    createMatch("duskbreaker", "ussf", 0, "practice", { seed: 404, foeCount: 1 }),
    LEGACY_ORBITAL_RULES_VERSION,
  );
  match.rocks = [];
  const pilot = match.player;
  const target = match.enemies[0]!;
  pilot.lockTargetId = target.id;
  pilot.space!.lockTargetId = target.id;
  pilot.space!.lockProgress = 1;
  const primary = primaryBullet(match, pilot, SHIPS.duskbreaker.shotDmg);
  assert.equal(primary.vz, -SHIPS.duskbreaker.shotSpeed);
  assert.equal(primary.r, 0.3);
  assert.equal(primary.life, 1.6);
  assert.equal(launchMissile(match, pilot), true);
  const missile = match.bullets[0]!;
  assert.equal(missile.vz, -38);
  assert.equal(missile.r, 0.5);
  assert.equal(missile.life, 4);
  assert.equal(pilot.space!.missileCd, 3.5);
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

test("Orbital v2 multi-projectile fire remains bit-identical across browser and reward server", () => {
  const setup = { seed: 7791, goal: "disc" as const, disc: "rust" as const, allyCount: 1, foeCount: 2 };
  const client = prepareOrbital(createMatch("garuda", "accord", 0, "practice", setup));
  const server = prepareServerOrbital(createServerMatch("garuda", "accord", 0, "practice", setup));
  client.rocks = [];
  server.rocks = [];
  const fire = { ...idle, fire: true, aimAssist: false };
  for (let tick = 0; tick < 3; tick++) {
    stepClientMatch(client, fire, 1 / 30);
    stepServerMatch(server, fire, 1 / 30);
    assert.deepEqual(server, client, `weapon simulation diverged at tick ${tick + 1}`);
  }
  assert.equal(client.bullets.filter((bullet) => bullet.own).length, 3);
  assert.ok(client.bullets.filter((bullet) => bullet.own).every((bullet) => bullet.weaponId === "swarm-pulse"));
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
