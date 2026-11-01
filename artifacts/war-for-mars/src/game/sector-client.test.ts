import assert from "node:assert/strict";
import test from "node:test";
import {
  expeditionFeatureEnabled, generateRoomCode, holdInput, isTerminalClose, isValidRoomCode,
  missionLockState, parseSectorSnapshot, sanitizeInput, sectorSocketUrl, createSeqCounter,
} from "./sector-client";
import { SECTOR_MISSIONS } from "./sector-missions";
import { NEUTRAL_FLIGHT_INPUT, createFlight } from "./flight-sector";

test("feature is off in production unless explicitly enabled, on in development", () => {
  assert.equal(expeditionFeatureEnabled({ DEV: false }), false);
  assert.equal(expeditionFeatureEnabled({ DEV: true }), true);
  assert.equal(expeditionFeatureEnabled({ DEV: false, VITE_WFM_SECTOR_EXPEDITION_ENABLED: "true" }), true);
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
  assert.equal(parseSectorSnapshot({ ...snap, version: 2 }), null);
  assert.equal(parseSectorSnapshot({ ...snap, missionId: "nope" }), null);
});

test("hold input is neutral with zero throttle and brake; sanitize clamps", () => {
  assert.deepEqual(holdInput(), { ...NEUTRAL_FLIGHT_INPUT, throttle: 0, brake: true });
  assert.equal(sanitizeInput({ ...NEUTRAL_FLIGHT_INPUT, throttle: 3, yaw: Number.NaN }).throttle, 1);
});

test("seq restarts per socket and terminal closes stop reconnect", () => {
  const s = createSeqCounter();
  assert.equal(s.next(), 1); assert.equal(s.next(), 2); s.reset(); assert.equal(s.next(), 1);
  assert.ok(isTerminalClose(1008)); assert.ok(isTerminalClose(4001)); assert.ok(!isTerminalClose(1006));
});
