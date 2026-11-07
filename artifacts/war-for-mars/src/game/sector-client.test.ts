import assert from "node:assert/strict";
import test from "node:test";
import {
  expeditionFeatureEnabled, generateRoomCode, holdInput, isTerminalClose, isValidRoomCode,
  missionLockState, parseSectorSnapshot, sanitizeInput, sectorClientProtocolVersion,
  sectorSocketUrl, createSeqCounter,
} from "./sector-client";
import {
  ORBITAL_SECTOR_SIMULATION_CONTRACT, SECTOR_MISSIONS, SECTOR_ORBITAL_PROTOCOL_VERSION,
} from "./sector-missions";
import { NEUTRAL_FLIGHT_INPUT, createFlight } from "./flight-sector";

test("feature is off in production unless explicitly enabled, on in development", () => {
  assert.equal(expeditionFeatureEnabled({ DEV: false }), false);
  assert.equal(expeditionFeatureEnabled({ DEV: true }), true);
  assert.equal(expeditionFeatureEnabled({ DEV: false, VITE_WFM_SECTOR_EXPEDITION_ENABLED: "true" }), true);
});
test("client keeps compatibility protocol by default and pins opt-in snapshots to Orbital rules", () => {
  assert.equal(sectorClientProtocolVersion({}), 1);
  assert.equal(sectorClientProtocolVersion({ VITE_WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED: "TRUE" }), 1);
  assert.equal(
    sectorClientProtocolVersion({ VITE_WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED: "true" }),
    SECTOR_ORBITAL_PROTOCOL_VERSION,
  );
  const snapshot = {
    type: "sector_snapshot", version: SECTOR_ORBITAL_PROTOCOL_VERSION,
    simulation: ORBITAL_SECTOR_SIMULATION_CONTRACT,
  };
  assert.equal(parseSectorSnapshot(snapshot), null, "a v2 packet is not accepted by a compatibility client");
  assert.equal(parseSectorSnapshot(snapshot, SECTOR_ORBITAL_PROTOCOL_VERSION), null, "incomplete snapshots remain invalid");
});

test("room codes are 6-24 alnum/hyphen and generated codes are valid", () => {
  assert.ok(isValidRoomCode("SEC-ABC123"));
  assert.ok(!isValidRoomCode("abc"));
  assert.ok(!isValidRoomCode("bad code!"));
  assert.ok(isValidRoomCode(generateRoomCode(n => new Uint8Array(n).fill(7))));
});

test("socket url carries sector and room only, never auth material", () => {
  const url = sectorSocketUrl(new URL("wss://example.test/ws"), "mars-approach", "SEC-ABC123");
  assert.equal(url.searchParams.get("sector"), "mars-approach");
  assert.equal(url.searchParams.get("room"), "SEC-ABC123");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["room", "sector"]);
  assert.throws(() => sectorSocketUrl(new URL("wss://example.test/ws"), "rust-disc", "x"));
});

test("mission locks follow persisted prerequisites", () => {
  const [a, b, c] = SECTOR_MISSIONS;
  const progress = { completed: ["rust-disc" as const], persistenceAvailable: true };
  assert.equal(missionLockState(a!, progress), "complete");
  assert.equal(missionLockState(b!, progress), "open");
  assert.equal(missionLockState(c!, progress), "locked");
  assert.equal(missionLockState(c!, null), "unknown");
});

test("snapshot parser accepts typed snapshot and rejects others", () => {
  const snap = {
    type: "sector_snapshot", version: 1, roomCode: "SEC-ABC123", missionId: "rust-disc", phase: "lobby", tick: 3,
    ownSlot: 0, hostSlot: 0, pilots: [{ slot: 0, shipId: "glide", connected: true, ready: false, flight: createFlight("glide") }],
    progress: { completed: [], persistenceAvailable: true }, settlement: { status: "not_started", reason: "" },
  };
  assert.ok(parseSectorSnapshot(snap));
  const orbitalSnapshot = {
    ...snap, version: SECTOR_ORBITAL_PROTOCOL_VERSION, simulation: ORBITAL_SECTOR_SIMULATION_CONTRACT,
  };
  assert.ok(parseSectorSnapshot(orbitalSnapshot, SECTOR_ORBITAL_PROTOCOL_VERSION));
  assert.equal(parseSectorSnapshot({
    ...orbitalSnapshot,
    simulation: { ...ORBITAL_SECTOR_SIMULATION_CONTRACT, runtimeId: "other-runtime" },
  }, SECTOR_ORBITAL_PROTOCOL_VERSION), null);
  assert.equal(parseSectorSnapshot({
    ...orbitalSnapshot,
    simulation: { ...ORBITAL_SECTOR_SIMULATION_CONTRACT, extra: true },
  }, SECTOR_ORBITAL_PROTOCOL_VERSION), null);
  const factionContact = {
    actorFaction: "accord", stage: "investigating", action: "scan", reason: "passive_contact",
    territory: "contested", transponder: "broadcast", distanceMeters: 1500, sensorRangeMeters: 2100,
    speedMetersPerSecond: 0, lineOfSight: true, weaponsHot: false, targeting: false, enteredAtTick: 3,
  };
  const evidence = [
    { id: "pale-beacon-record", title: "PALE BEACON RECEIVER HISTORY", position: { x: 620, y: 210, z: -740 }, state: "available" },
    { id: "earth-first-response", title: "EARTH RELAY PACKET", position: { x: 1260, y: 390, z: -1510 }, state: "available" },
  ];
  const paleBeaconsSnapshot = {
    ...orbitalSnapshot, missionId: "pale-beacons", phase: "active", factionContact, evidence,
  };
  assert.ok(parseSectorSnapshot(paleBeaconsSnapshot, SECTOR_ORBITAL_PROTOCOL_VERSION));
  assert.equal(parseSectorSnapshot({
    ...paleBeaconsSnapshot,
    evidence: [{ ...evidence[0]!, id: "first-witness-trace" }, evidence[1]],
  }, SECTOR_ORBITAL_PROTOCOL_VERSION), null, "the server only exposes the two Pale Beacons recovery sites");
  assert.equal(parseSectorSnapshot({
    ...orbitalSnapshot, missionId: "rust-disc", evidence,
  }, SECTOR_ORBITAL_PROTOCOL_VERSION), null, "evidence contacts cannot be injected into another mission");
  assert.equal(parseSectorSnapshot({ ...snap, missionId: "pale-beacons", evidence }, 1), null,
    "compatibility snapshots cannot inject Orbital evidence sites");
  assert.equal(parseSectorSnapshot({
    ...paleBeaconsSnapshot, factionContact: { ...factionContact, actorFaction: "ussf" },
  }, SECTOR_ORBITAL_PROTOCOL_VERSION), null, "the opposing contact cannot claim the player's faction");
  assert.equal(parseSectorSnapshot({
    ...paleBeaconsSnapshot, factionContact: { ...factionContact, enteredAtTick: 4 },
  }, SECTOR_ORBITAL_PROTOCOL_VERSION), null, "contact state cannot claim a future server tick");
  assert.equal(parseSectorSnapshot({ ...snap, factionContact }, 1), null,
    "compatibility snapshots cannot inject Orbital faction decisions");
  assert.ok(parseSectorSnapshot({ ...snap, capabilities: { vectorDrift: true, tacticalCommands: true } }));
  assert.equal(parseSectorSnapshot({ ...snap, capabilities: { vectorDrift: "yes" } }), null);
  const command = {
    order: "escort", target: "pilot", targetSlot: 1, issuedBySlot: 0, issuedAtTick: 3,
  };
  const withCommand = { ...snap, hostSlot: 0, pilots: [...snap.pilots, { ...snap.pilots[0], slot: 1 }], command };
  assert.ok(parseSectorSnapshot(withCommand));
  assert.equal(parseSectorSnapshot({ ...withCommand, command: { ...command, issuedBySlot: 1 } }), null);
  assert.equal(parseSectorSnapshot({ ...snap, version: 2 }), null);
  assert.equal(parseSectorSnapshot({ ...snap, missionId: "nope" }), null);
});

test("Iron Eclipse snapshots require complete bounded server state and matching capability", () => {
  const op = {
    phase: "engage", target: "point-defense", order: "regroup",
    capitalPosition: { x: 0, y: 70, z: -460 },
    subsystems: [
      { id: "point-defense", label: "POINT DEFENSE", position: { x: -26, y: 79, z: -448 }, hull: 120, maxHull: 120, disabled: false },
      { id: "shield-array", label: "SHIELD ARRAY", position: { x: 20, y: 83, z: -464 }, hull: 140, maxHull: 140, disabled: false },
      { id: "reactor", label: "REACTOR", position: { x: 0, y: 62, z: -475 }, hull: 180, maxHull: 180, disabled: false },
    ],
    wing: ["sable-one", "sable-two", "sable-three"].map((id, slot) => ({
      id, shipId: (["glide", "shakuna", "sentinel"] as const)[slot],
      position: { x: slot * 20, y: 30, z: 145 }, hull: 100, maxHull: 100, connected: true,
    })),
    objectives: { primary: "pending", shieldArray: "pending", wingSurvival: "pending" },
  };
  const iron = {
    type: "sector_snapshot", version: 1, roomCode: "SEC-ABC123", missionId: "iron-eclipse", phase: "active", tick: 3,
    ownSlot: 0, hostSlot: 0, pilots: [{ slot: 0, shipId: "glide", connected: true, ready: false, flight: createFlight("glide") }],
    progress: { completed: [], persistenceAvailable: true }, settlement: { status: "not_started", reason: "" },
    capabilities: { vectorDrift: true, tacticalCommands: true, ironEclipse: true }, operation: op,
  };
  assert.ok(parseSectorSnapshot(iron));
  assert.equal(parseSectorSnapshot({ ...iron, operation: undefined }), null);
  assert.equal(parseSectorSnapshot({ ...iron, capabilities: { ...iron.capabilities, ironEclipse: false } }), null);
  assert.equal(parseSectorSnapshot({ ...iron, operation: { ...op, subsystems: op.subsystems.map((item, index) => index ? item : { ...item, hull: -1 }) } }), null);
  assert.equal(parseSectorSnapshot({ ...iron, operation: { ...op, capitalPosition: { x: 10_001, y: 0, z: 0 } } }), null);
  assert.equal(parseSectorSnapshot({ ...iron, operation: { ...op, subsystems: [op.subsystems[0], op.subsystems[0], op.subsystems[2]] } }), null);
  assert.equal(parseSectorSnapshot({ ...iron, operation: { ...op, phase: "complete", objectives: { ...op.objectives, primary: "pending" } } }), null);
  assert.equal(parseSectorSnapshot({ ...iron, operation: { ...op, wing: op.wing.map((unit, index) => index ? unit : { ...unit, connected: false }) } }), null);
  assert.equal(parseSectorSnapshot({ ...iron, missionId: "rust-disc" }), null);
});

test("hold input is neutral with zero throttle and brake; sanitize clamps", () => {
  assert.deepEqual(holdInput(), { ...NEUTRAL_FLIGHT_INPUT, throttle: 0, brake: true });
  assert.equal(sanitizeInput({ ...NEUTRAL_FLIGHT_INPUT, throttle: 3, yaw: Number.NaN }).throttle, 1);
  assert.equal(sanitizeInput({ ...NEUTRAL_FLIGHT_INPUT, strafe: 2, vertical: -2 }).strafe, 1);
  assert.equal(sanitizeInput({ ...NEUTRAL_FLIGHT_INPUT, strafe: 2, vertical: -2 }).vertical, -1);
  assert.equal("drift" in sanitizeInput(NEUTRAL_FLIGHT_INPUT), false);
  assert.equal(sanitizeInput({ ...NEUTRAL_FLIGHT_INPUT, drift: true }).drift, true);
});

test("seq restarts per socket and terminal closes stop reconnect", () => {
  const s = createSeqCounter();
  assert.equal(s.next(), 1); assert.equal(s.next(), 2); s.reset(); assert.equal(s.next(), 1);
  assert.ok(isTerminalClose(1008)); assert.ok(isTerminalClose(4001)); assert.ok(!isTerminalClose(1006));
});
