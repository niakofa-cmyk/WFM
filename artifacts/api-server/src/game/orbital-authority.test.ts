import assert from "node:assert/strict";
import test from "node:test";
import { IDLE_ORBITAL, ORBITAL_DT, ORBITAL_RULES_VERSION, parseOrbitalInput } from "@workspace/orbital-sim";
import { createOrbitalAuthority } from "./orbital-authority";

const packet = (seq: number, patch: Record<string, unknown> = {}) => ({ ...IDLE_ORBITAL, seq, ...patch });
test("strict versioned packets reject client state, outcomes, malformed controls and unsafe sequences", () => {
  assert.equal(parseOrbitalInput(packet(1)).ok, true);
  for (const patch of [{ damage: 9999 }, { x: 40 }, { hull: 999 }, { rewards: 10 }, { dt: 1 }, { maneuver: { version: 1, kind: "barrel-roll", direction: "right" } }, { fire: 1 }, { yaw: NaN }, { throttle: 2 }, { seq: 1.2 }, { seq: Infinity }, { seq: 0 }, { version: 2 }]) {
    assert.equal(parseOrbitalInput(packet(1, patch)).ok, false, JSON.stringify(patch));
  }
  for (const value of [null, [], "fire", {}, { ...packet(1), vertical: undefined }]) assert.equal(parseOrbitalInput(value).ok, false);
});

test("ten synthetic server seats use five ships per faction, detached snapshots and no client authority", () => {
  const server = createOrbitalAuthority(); const before = server.snapshot();
  assert.equal(before.pilots.length, 10);
  assert.equal(before.pilots.filter((p) => p.faction === "ussf").length, 5);
  assert.equal(before.pilots.filter((p) => p.faction === "accord").length, 5);
  assert.equal(before.version, ORBITAL_RULES_VERSION);
  before.pilots[0].hull = 0; before.pilots[0].space.ammo = 999;
  assert.notEqual(server.snapshot().pilots[0].hull, 0);
  assert.equal(server.snapshot().pilots[0].space.ammo, 8);
  assert.deepEqual(server.input(-1, packet(1)), { ok: false, reason: "seat" });
  assert.deepEqual(server.input(0, packet(1, { targetId: before.pilots[1].id })), { ok: false, reason: "target" });
  assert.equal(server.input(0, packet(1, { damage: 999 })).ok, false);
  const after = server.step();
  assert.equal(after.tick, 1); assert.equal(after.time, ORBITAL_DT); assert.equal(after.bullets.length, 0);
  assert.equal("maneuverRollRemaining" in after.pilots[0].space, false);
  assert.equal("maneuverCooldown" in after.pilots[0].space, false);
});

test("bounded input queue rejects stale, duplicate, jumping sequences and does not advance simulation on receive", () => {
  const server = createOrbitalAuthority();
  assert.deepEqual(server.input(0, packet(300)), { ok: false, reason: "sequence" });
  for (let seq = 1; seq <= 8; seq++) assert.equal(server.input(0, packet(seq, { throttle: 1 })).ok, true);
  assert.equal(server.snapshot().tick, 0);
  assert.deepEqual(server.input(0, packet(8)), { ok: false, reason: "sequence" });
  assert.deepEqual(server.input(0, packet(9)), { ok: false, reason: "queue_full" });
  assert.equal(server.step().pilots[0].lastSeq, 1);
  assert.equal(server.input(0, packet(9)).ok, true);
  for (let i = 0; i < 8; i++) server.step();
  assert.equal(server.snapshot().pilots[0].lastSeq, 9);
  assert.deepEqual(server.input(0, packet(8)), { ok: false, reason: "sequence" });
});

test("server acquires lock before missiles, owns cooldown/ammunition, and computes shield armor hull destruction", () => {
  const server = createOrbitalAuthority();
  const target = server.snapshot().pilots[5];
  assert.equal(server.input(0, packet(1, { targetId: target.id, missile: true })).ok, true);
  assert.equal(server.step().pilots[0].space.ammo, 8);
  let seq = 1; let destroyed = 0; let armorSeen = false; let shieldSeen = false; let hullSeen = false;
  for (let i = 0; i < 2300 && !destroyed; i++) {
    const previous = server.snapshot();
    const pilot = previous.pilots[0];
    const launch = pilot.space.lockProgress === 1 && pilot.space.missileCd === 0;
    server.input(0, packet(++seq, { targetId: target.id, fire: true, missile: launch }));
    const current = server.step(); const victim = current.pilots[5];
    shieldSeen ||= victim.shield < target.shield;
    armorSeen ||= victim.space.armor < target.space.armor;
    hullSeen ||= victim.hull < target.hull;
    destroyed += current.events.filter((event) => event.type === "destroyed" && event.target === target.id).length;
    assert.ok(current.pilots[0].space.ammo >= 0 && current.pilots[0].space.ammo <= 8);
    assert.ok(current.bullets.length <= 110);
  }
  assert.ok(shieldSeen && armorSeen && hullSeen);
  assert.equal(destroyed, 1);
  assert.equal(server.snapshot().pilots[5].alive, false);
  assert.ok(server.snapshot().pilots[0].space.ammo < 8);
  assert.equal(server.input(5, packet(1)).ok, false);
  for (let i = 0; i < 20; i++) assert.equal(server.step().events.some((event) => event.type === "destroyed" && event.target === target.id), false);
});

test("fixed-tick recorded controls replay identically without wall clock or client timestep", () => {
  const a = createOrbitalAuthority(42); const b = createOrbitalAuthority(42);
  for (let tick = 1; tick <= 240; tick++) {
    for (let seat = 0; seat < 10; seat++) {
      const input = packet(tick, { throttle: Math.sin(tick * .01 + seat) * .3, yaw: seat % 2 ? .1 : -.1, fire: tick % 3 === 0, vertical: seat % 2 ? .1 : -.1 });
      assert.deepEqual(a.input(seat, input), b.input(seat, input));
    }
    assert.deepEqual(a.step(), b.step());
  }
});

test("repeated launch requests cannot bypass the server's 1.25-second lock or 3.5-second cooldown", () => {
  const server = createOrbitalAuthority(); const target = server.snapshot().pilots[5];
  const launches: number[] = [];
  for (let seq = 1; seq <= 160; seq++) {
    assert.equal(server.input(0, packet(seq, { targetId: target.id, missile: true })).ok, true);
    const snapshot = server.step();
    if (snapshot.events.some((event) => event.type === "missile")) launches.push(snapshot.tick);
  }
  assert.equal(launches.length, 2);
  assert.ok(launches[0] * ORBITAL_DT >= 1.25);
  assert.ok((launches[1] - launches[0]) * ORBITAL_DT >= 3.5);
  assert.equal(server.snapshot().pilots[0].space.ammo, 6);
});

test("server rejects acquisition and stops real primary projectiles at an occluding asteroid", () => {
  const server = createOrbitalAuthority(1938, [{ x: 0, z: 12, r: 4 }]);
  const target = server.snapshot().pilots[5];
  for (let seq = 1; seq <= 180; seq++) {
    server.input(0, packet(seq, { targetId: target.id, missile: true, fire: true }));
    const snapshot = server.step();
    assert.equal(snapshot.pilots[0].space.lockProgress, 0);
    assert.equal(snapshot.pilots[0].space.ammo, 8);
    assert.equal(snapshot.events.some((event) => event.type === "hit"), false);
  }
  assert.equal(server.snapshot().pilots[5].shield, target.shield);
});

test("server owns the match clock, resolves the result and freezes completed state", () => {
  const server = createOrbitalAuthority();
  for (let tick = 0; tick < 3600; tick++) server.step();
  const snapshot = server.snapshot();
  assert.equal(snapshot.time, 120); assert.ok(snapshot.over !== null);
  assert.deepEqual(server.step(), snapshot);
  assert.deepEqual(server.input(0, packet(1)), { ok: false, reason: "inactive" });
});
