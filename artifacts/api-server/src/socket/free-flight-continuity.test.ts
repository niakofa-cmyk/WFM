import assert from "node:assert/strict";
import test from "node:test";
import { isFreeFlightSnapshotV1, rotate, type FreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import { readExplorationReceipt } from "../game/exploration-encounter";
import type { UniversePatrolEncounter } from "../game/universe-patrols";
import { createFreeFlightRuntime, recoverFreeFlightShield } from "./free-flight-runtime";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function fleet(id: string): UniversePatrolEncounter {
  return { patrolId: `continuity-${id}`, locationId: "phobos-yard", faction: "accord",
    callsign: id, route: ["phobos-yard"], revision: 0,
    ships: [{ id: `continuity-ship-${id}`, hullId: "mandjet", name: "Mandjet", callsign: id }] };
}
function harness() {
  const packets: Record<string, any>[] = [];
  let snapshot: FreeFlightSnapshotV1;
  const socket = { readyState: 1, bufferedAmount: 0,
    send(data: string) {
      const packet = JSON.parse(data);
      packets.push(packet);
      if (isFreeFlightSnapshotV1(packet.snapshot)) snapshot = packet.snapshot;
    }, close() {} };
  return { packets, socket, frame: () => snapshot! };
}
const controls = (seq: number, overrides = {}) => ({
  version: 5, seq, targetId: null, throttle: 0, yaw: 0, pitch: 0, strafe: 0,
  vertical: 0, roll: 0, fire: false, missile: false, boost: false,
  brake: false, inertial: false, aimAssist: false, countermeasure: false, ...overrides,
});

test("shared shield recovery matches Combat Lab delay and rate for every faction", () => {
  assert.equal(recoverFreeFlightShield(50, 100, 10, 69), 50);
  assert.equal(recoverFreeFlightShield(50, 100, 10, 70), 50.1);
  let shield = 50;
  for (let tick = 70; tick < 100; tick++) shield = recoverFreeFlightShield(shield, 100, 10, tick);
  assert.ok(Math.abs(shield - 53) < 1e-9);
  assert.equal(recoverFreeFlightShield(99.99, 100, -1, 1), 100);
});

test("holding a missile does not block primary-fire admission for a new fleet", async () => {
  const h = harness(), contact = fleet("mixed-fire");
  let claims = 0;
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "sentinel" }),
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => { claims++; return contact; },
    settleScoutEncounter: async () => { throw new Error("No result expected"); },
  });
  try {
    await runtime.handle(h.socket, "continuous-pilot", { type: "freeflight_join" });
    await runtime.handle(h.socket, "continuous-pilot", { type: "freeflight_input",
      input: controls(1, { fire: true, missile: true }) });
    assert.ok(h.packets.some((packet) => packet.type === "freeflight_input_accepted" &&
      packet.fire === true && packet.missile === false));
    assert.equal(claims, 1);
    assert.ok(h.packets.some((packet) => packet.type === "freeflight_engagement_started"));
  } finally { await runtime.close(); }
});

test("directory refresh is single-flight and discards a response after saved-location travel", async () => {
  const h = harness();
  let key = "mars:phobos-yard", slow = false, reads = 0;
  let finish!: (value: UniversePatrolEncounter[]) => void;
  const pending = new Promise<UniversePatrolEncounter[]>((resolve) => { finish = resolve; });
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: key, faction: "ussf", shipId: "sentinel" }),
    resolveUniversePatrols: async () => { reads++; return slow ? pending : []; },
  });
  let now = Date.now();
  try {
    await runtime.handle(h.socket, "continuous-pilot", { type: "freeflight_join" });
    slow = true;
    runtime.advance(now += 15_100);
    await flush();
    const startedReads = reads;
    for (let index = 0; index < 4; index++) runtime.advance(now += 15_100);
    await flush();
    assert.equal(reads, startedReads, "pending requests must not fan out");
    key = "mars:rust-disc";
    finish([fleet("wrong-location")]);
    await flush();
    assert.equal(h.frame().actors.filter((actor) => actor.kind === "patrol").length, 0);
  } finally { finish([]); await runtime.close(); }
});

test("a live-battle diagonal dodge moves the hull without interrupting primary fire or its lease", async () => {
  const h = harness(), contact = fleet("dodge");
  let directory = [contact], claims = 0;
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "sentinel" }),
    resolveUniversePatrols: async () => directory,
    reserveUniversePatrol: async () => { claims++; return contact; },
    settleScoutEncounter: async () => { throw new Error("No result expected"); },
  });
  const now = Date.now();
  try {
    await runtime.handle(h.socket, "continuous-pilot", { type: "freeflight_join", openingEncounter: true });
    const before = h.frame().actors.find((actor) => actor.own)!;
    await runtime.handle(h.socket, "continuous-pilot", { type: "freeflight_input",
      input: controls(1, { fire: true }) });
    await runtime.handle(h.socket, "continuous-pilot", {
      type: "freeflight_vector_boost", protocol: "orbital-vector-boost-v1",
      seq: 1, direction: "up-right",
    });
    assert.ok(h.packets.some((packet) => packet.type === "freeflight_vector_boost_state" &&
      packet.accepted === true));
    runtime.advance(now + 150);
    const after = h.frame().actors.find((actor) => actor.own)!;
    assert.ok(after.position.y > before.position.y, "dodge physically raises the ship");
    assert.ok(Math.hypot(after.position.x - before.position.x,
      after.position.z - before.position.z) > 0.1, "diagonal dodge also translates laterally");
    assert.ok(h.packets.some((packet) => packet.type === "freeflight_weapon_fired" &&
      packet.sourceActorId === h.frame().ownActorId));
    directory = [];
    runtime.advance(now + 15_100);
    await flush();
    assert.ok(h.frame().actors.some((actor) => actor.actorId === "patrol-ship:continuity-ship-dodge"),
      "a directory departure must not replace an active encounter's actors");
    assert.equal(claims, 1, "refresh retains the original combat lease");
  } finally { await runtime.close(); }
});

test("durable fleets arrive and depart during one flight without reconnect or pilot reset", async () => {
  const h = harness();
  let directory: UniversePatrolEncounter[] = [];
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "sentinel" }),
    resolveUniversePatrols: async (_user, faction) => faction === "ussf" ? directory : [],
  });
  let now = Date.now();
  try {
    await runtime.handle(h.socket, "continuous-pilot", { type: "freeflight_join" });
    const original = h.frame().actors.find((actor) => actor.own)!;
    assert.equal(h.frame().actors.length, 1);
    directory = [fleet("arrival")];
    runtime.advance(now += 15_100);
    await flush();
    assert.ok(h.frame().actors.some((actor) => actor.actorId === "patrol-ship:continuity-ship-arrival"));
    const retained = h.frame().actors.find((actor) => actor.own)!;
    assert.equal(retained.actorId, original.actorId);
    assert.deepEqual(retained.position, original.position);
    assert.equal(retained.hull, original.hull);
    directory = [];
    runtime.advance(now += 15_100);
    await flush();
    assert.equal(h.frame().actors.filter((actor) => actor.kind === "patrol").length, 0);
    assert.equal(h.packets.filter((packet) => packet.type === "freeflight_joined").length, 1);
  } finally { await runtime.close(); }
});

test("pilot defeats one fleet, keeps flying, and encounters two additional fleets concurrently", async (t) => {
  const h = harness();
  const first = fleet("first"), second = fleet("second"), third = fleet("third");
  let directory = [first];
  let clock = Date.now(), sequence = 0;
  // Advance both clocks together: production's input-rate and scout timers
  // must not see 30 simulated seconds of input arrive in one wall-clock second.
  t.mock.method(Date, "now", () => clock);
  const settled: string[] = [];
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "sentinel" }),
    resolveUniversePatrols: async (_user, faction) => faction === "ussf" ? directory : [],
    patrolSpawnDistanceMeters: 80,
    reserveUniversePatrol: async (_users, _faction, contact) =>
      directory.find((candidate) => candidate.patrolId === contact.patrolId) ?? null,
    settleScoutEncounter: async (receipt) => {
      const result = readExplorationReceipt(receipt);
      const id = directory.find((candidate) => candidate.ships.some((ship) =>
        result.pilots.some((pilot) => pilot.destroyedActorIds.includes(`patrol-ship:${ship.id}`))))?.patrolId;
      if (!id) {
        assert.ok(result.pilots.every((pilot) => pilot.kills === 0 && pilot.credits === 0),
          "a defeated pilot cannot receive a fabricated victory");
        return { status: "settled", awards: result.pilots.map((pilot) => ({
          ...pilot, balanceAfter: 0, revision: settled.length,
        })) };
      }
      settled.push(id);
      directory = directory.filter((candidate) => candidate.patrolId !== id);
      return { status: "settled", awards: result.pilots.map((pilot) => ({
        ...pilot, balanceAfter: pilot.credits, revision: settled.length,
      })) };
    },
  });
  const tick = async (fire: boolean) => {
    clock += 34;
    const frame = h.frame(), own = frame.actors.find((actor) => actor.own)!;
    const target = frame.actors.find((actor) => actor.kind === "patrol" && actor.alive);
    const bounded = (value: number) => Math.max(-1, Math.min(1, value));
    let yaw = 0, pitch = 0, throttle = 0;
    if (target) {
      const dx = target.position.x - own.position.x, dy = target.position.y - own.position.y;
      const dz = target.position.z - own.position.z;
      const q = own.orientation;
      const local = rotate([-q.x, -q.y, -q.z, q.w], dx, dy, dz);
      const yawError = Math.atan2(-local.x, -local.z);
      const pitchError = Math.atan2(local.y, Math.hypot(local.x, local.z));
      yaw = bounded(yawError * 4);
      pitch = bounded(pitchError * 4);
      throttle = Math.hypot(dx, dy, dz) > 45 &&
        Math.abs(yawError) < 0.4 && Math.abs(pitchError) < 0.4 ? 1 : 0;
    }
    await runtime.handle(h.socket, "continuous-pilot", { type: "freeflight_input",
      input: controls(++sequence, { fire, missile: fire, yaw, pitch, throttle,
        strafe: Math.sin(sequence / 28) * 0.25, vertical: Math.cos(sequence / 28) * 0.25 }) });
    runtime.advance(clock);
    await flush();
  };
  try {
    await runtime.handle(h.socket, "continuous-pilot", { type: "freeflight_join", openingEncounter: true });
    const originalId = h.frame().ownActorId;
    for (let step = 0; step < 2400 && settled.length < 1; step++) await tick(true);
    assert.equal(settled.length, 1, JSON.stringify({
      reason: "first native battle must settle a victory",
      actors: h.frame().actors.map((actor) => ({ kind: actor.kind, alive: actor.alive,
        hull: actor.hull, shield: actor.shield, position: actor.position })),
      shots: h.packets.filter((packet) => packet.type === "freeflight_weapon_fired").length,
      errors: h.packets.filter((packet) => packet.type === "error").slice(-3),
      results: h.packets.filter((packet) => packet.type === "freeflight_combat_result"),
    }));
    const afterFirst = h.frame().actors.find((actor) => actor.own)!;
    assert.ok(afterFirst.alive, "pilot survives using the ordinary ship and evasive input");
    const positionAfterFirst = { ...afterFirst.position };
    for (let step = 0; step < 45; step++) await tick(false);
    const exploring = h.frame().actors.find((actor) => actor.own)!;
    assert.ok(Math.hypot(exploring.position.x - positionAfterFirst.x,
      exploring.position.y - positionAfterFirst.y, exploring.position.z - positionAfterFirst.z) > 0.5);
    directory = [second, third];
    runtime.advance(clock += 15_100);
    await flush();
    assert.ok(h.frame().actors.some((actor) => actor.actorId === "patrol-ship:continuity-ship-second"));
    assert.ok(h.frame().actors.some((actor) => actor.actorId === "patrol-ship:continuity-ship-third"));
    // Primary firing uses the ordinary input path; both fleets may
    // reinforce a live fight rather than switching to another battle runtime.
    const overlapping = () => h.packets.some((packet) =>
      packet.type === "freeflight_engagement_state" && packet.activeEncounterCount >= 2);
    for (let step = 0; step < 1800 && !overlapping(); step++) await tick(true);
    assert.ok(overlapping(), JSON.stringify({
      reason: "both additional fleets must have simultaneous live contracts",
      actors: h.frame().actors.map((actor) => ({ kind: actor.kind, alive: actor.alive,
        hull: actor.hull, shield: actor.shield })),
      started: h.packets.filter((packet) => packet.type === "freeflight_engagement_started"),
      errors: h.packets.filter((packet) => packet.type === "error").slice(-3),
    }));
    assert.equal(new Set(settled).size, settled.length, "no completed fleet settles twice");
    assert.ok(h.packets.some((packet) => packet.type === "freeflight_engagement_started" &&
      packet.patrolId === second.patrolId));
    assert.ok(h.packets.some((packet) => packet.type === "freeflight_engagement_started" &&
      packet.patrolId === third.patrolId));
    assert.equal(h.frame().ownActorId, originalId);
    assert.equal(h.packets.filter((packet) => packet.type === "freeflight_joined").length, 1);
    assert.ok(h.packets.some((packet) => packet.type === "freeflight_combat_result" &&
      packet.status === "settled" && packet.kills === 1 && packet.creditsAwarded > 0));
  } finally { await runtime.close(); }
});
