import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { createSectorRuntime, parseSectorInput } from "./sector-runtime";
import { sectorFlightEnabled } from "./sector-feature";
import { NEUTRAL_FLIGHT_INPUT, type FlightState } from "../game/flight-sector";
import type { CompletedSectorMission } from "../game/sector-completion";
import { validSectorCompletion } from "../game/sector-completion";
import type { SectorSnapshot } from "../game/sector-missions";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

function socket() {
  const packets: any[] = [];
  const fake = {
    readyState: WebSocket.OPEN as number, bufferedAmount: 0,
    send: (data: string) => packets.push(JSON.parse(data)),
    close: () => { fake.readyState = WebSocket.CLOSED; },
  };
  return { ws: fake as unknown as WebSocket, packets, latest: () => packets.filter(p => p.type === "sector_snapshot").at(-1) as SectorSnapshot };
}
test("new sector feature fails closed in Production and rejects ambiguous declarations", () => {
  assert.equal(sectorFlightEnabled({ NODE_ENV: "production" }), false);
  assert.equal(sectorFlightEnabled({ NODE_ENV: "production", WFM_SECTOR_FLIGHT_ENABLED: "TRUE" }), false);
  assert.equal(sectorFlightEnabled({ NODE_ENV: "production", WFM_SECTOR_FLIGHT_ENABLED: "true" }), true);
  assert.equal(sectorFlightEnabled({ NODE_ENV: "development" }), true);
  assert.equal(sectorFlightEnabled({ NODE_ENV: "development", WFM_SECTOR_FLIGHT_ENABLED: "false" }), false);
});
test("3D inputs exclude forged coordinates, results, identities, unknown buttons and non-finite axes", () => {
  assert.ok(parseSectorInput(NEUTRAL_FLIGHT_INPUT));
  for (const value of [
    {}, { ...NEUTRAL_FLIGHT_INPUT, position: { x: 1000 } }, { ...NEUTRAL_FLIGHT_INPUT, credits: 10000 },
    { ...NEUTRAL_FLIGHT_INPUT, throttle: 2 }, { ...NEUTRAL_FLIGHT_INPUT, yaw: NaN },
    { ...NEUTRAL_FLIGHT_INPUT, pitch: Infinity }, { ...NEUTRAL_FLIGHT_INPUT, fire: "true" },
    { ...NEUTRAL_FLIGHT_INPUT, userId: "other" },
  ]) assert.equal(parseSectorInput(value), null);
});
test("server and browser 3D physics/catalog are byte-identical and use deterministic transcendental math", () => {
  for (const file of ["flight-sector.ts", "sector-missions.ts"]) {
    const source = readFileSync(new URL(`../game/${file}`, import.meta.url), "utf8");
    const client = readFileSync(new URL(`../../../war-for-mars/src/game/${file}`, import.meta.url), "utf8");
    assert.equal(source, client);
    if (file === "flight-sector.ts") assert.doesNotMatch(source, /Math\.(sin|cos|exp|atan2)\(/);
  }
});
test("two pilots ready/launch into identical authoritative XYZ room state; host and version enforced", async () => {
  const runtime = createSectorRuntime({});
  const a = socket(), b = socket(), late = socket();
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_join", version: 1, shipId: "glide" }, 0);
  await runtime.handle(b.ws, "synthetic-b", "rust-disc", "flight-room", { type: "sector_join", version: 1, shipId: "mandjet" }, 0);
  await runtime.handle(b.ws, "synthetic-b", "rust-disc", "flight-room", { type: "sector_launch" }, 0);
  assert.equal(b.packets.at(-1).reason, "sector_host_required");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_launch" }, 0);
  assert.equal(a.packets.at(-1).reason, "sector_all_pilots_ready_required");
  for (const [s, id] of [[a, "synthetic-a"], [b, "synthetic-b"]] as const) {
    await runtime.handle(s.ws, id, "rust-disc", "flight-room", { type: "sector_ready", ready: true }, 0);
  }
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_launch" }, 0);
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_input", seq: 1, input: { ...NEUTRAL_FLIGHT_INPUT, throttle: 1, pitch: 1 } }, 0);
  runtime.advance(0);
  for (let t = 17; t <= 300; t += 17) runtime.advance(t);
  assert.deepEqual(a.latest().pilots, b.latest().pilots);
  assert.equal(a.latest().tick, b.latest().tick);
  assert.ok(a.latest().pilots[0]!.flight.position.y > 0);
  assert.ok(a.latest().pilots[0]!.flight.position.z < 70);
  assert.doesNotMatch(JSON.stringify(a.latest()), /synthetic-a|synthetic-b/);
  await runtime.handle(late.ws, "synthetic-c", "rust-disc", "flight-room", { type: "sector_join", version: 1, shipId: "glide" }, 300);
  assert.equal(late.packets.at(-1).reason, "sector_match_in_progress");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_input", seq: 1, input: NEUTRAL_FLIGHT_INPUT }, 300);
  assert.equal(a.packets.at(-1).reason, "invalid_sector_input");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_complete", credits: 100 }, 300);
  assert.equal(a.packets.at(-1).reason, "unknown_sector_message");
  runtime.detach(a.ws, 300); a.ws.close();
  const restored = socket();
  await runtime.handle(restored.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_join", version: 1, shipId: "sentinel" }, 1000);
  assert.equal(restored.latest().pilots[0]!.shipId, "glide");
  assert.equal(restored.latest().ownSlot, 0);
  runtime.detach(restored.ws, 1000); restored.ws.close();
  const expired = socket();
  await runtime.handle(expired.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_join", version: 1, shipId: "glide" }, 7000);
  assert.equal(expired.packets.at(-1).reason, "sector_reconnect_expired");
  await runtime.close();
});
test("mission unlocks and private progress come from the authenticated account; lobby slot reuse stays unique", async () => {
  const runtime = createSectorRuntime({
    loadProgress: async id => ({ completed: id === "pilot-a" ? ["rust-disc"] : [], persistenceAvailable: true }),
  });
  const a = socket(), b = socket(), c = socket();
  await runtime.handle(a.ws, "pilot-a", "mars-approach", "orbit-room", { type: "sector_join", version: 1, shipId: "glide" }, 0);
  await runtime.handle(b.ws, "pilot-b", "mars-approach", "orbit-room", { type: "sector_join", version: 1, shipId: "glide" }, 0);
  assert.equal(b.packets.at(-1).reason, "sector_mission_locked");
  await runtime.handle(b.ws, "pilot-b", "rust-disc", "rust-room", { type: "sector_join", version: 1, shipId: "glide" }, 0);
  await runtime.handle(c.ws, "pilot-c", "rust-disc", "rust-room", { type: "sector_join", version: 1, shipId: "glide" }, 0);
  runtime.detach(b.ws, 100);
  const d = socket();
  await runtime.handle(d.ws, "pilot-d", "rust-disc", "rust-room", { type: "sector_join", version: 1, shipId: "glide" }, 100);
  assert.equal(new Set(d.latest().pilots.map(p => p.slot)).size, 2);
  assert.deepEqual(d.latest().progress.completed, []);
  assert.deepEqual(a.latest().progress.completed, ["rust-disc"]);
  await runtime.close();
});
test("only complete server simulation with participation can settle; retries use the same frozen proof", async () => {
  const saved: CompletedSectorMission[] = [];
  let attempts = 0;
  const runtime = createSectorRuntime({
    loadProgress: async () => ({ completed: [], persistenceAvailable: true }),
    physics: (state: FlightState, _input, seconds) => {
      state.elapsed += seconds;
      if (state.elapsed >= 6) { state.stage = "complete"; state.discoveries = 1; state.drone.hull = 0; }
    },
    settle: async proof => {
      assert.ok(Object.isFrozen(proof)); assert.ok(validSectorCompletion(proof));
      saved.push(proof);
      if (++attempts === 1) throw new Error("synthetic temporary store failure");
      return { progress: { completed: ["rust-disc"], persistenceAvailable: true }, replayed: false };
    },
  });
  const a = socket();
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "settle-room", { type: "sector_join", version: 1, shipId: "glide" }, 0);
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "settle-room", { type: "sector_ready", ready: true }, 0);
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "settle-room", { type: "sector_launch" }, 0);
  runtime.advance(0);
  for (let t = 17, seq = 0; t < 6400; t += 17) {
    if (t % 51 === 0) await runtime.handle(a.ws, "pilot-a", "rust-disc", "settle-room",
      { type: "sector_input", seq: seq++, input: { ...NEUTRAL_FLIGHT_INPUT, throttle: 1 } }, t);
    runtime.advance(t);
  }
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.length, 1);
  assert.equal(a.latest().settlement.status, "unavailable");
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "settle-room", { type: "sector_retry" }, 10000);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.length, 2); assert.equal(saved[0], saved[1]);
  assert.equal(a.latest().settlement.status, "recorded");
  assert.deepEqual(a.latest().progress.completed, ["rust-disc"]);
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "settle-room", { type: "sector_retry" }, 12000);
  assert.equal(saved.length, 2);
  await runtime.close();
});
test("shutdown interruption and malformed completion never create settlement", async () => {
  let writes = 0;
  const runtime = createSectorRuntime({ settle: async () => { writes++; throw new Error("unexpected"); } });
  const a = socket();
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "stop-room", { type: "sector_join", version: 1, shipId: "glide" });
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "stop-room", { type: "sector_ready", ready: true });
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "stop-room", { type: "sector_launch" });
  await runtime.close();
  assert.equal(writes, 0);
  assert.equal(a.packets.at(-1).type, "interrupted");
  assert.equal(a.latest().phase, "interrupted");
  const proof = {
    matchId: randomUUID(), userId: "synthetic", missionId: "rust-disc" as const, rulesVersion: 1 as const,
    status: "completed" as const, elapsed: 50, activeTicks: 200, acceptedInputs: 100,
    discoveries: 1, droneHull: 0, stage: "complete" as const, connectedAtEnd: true,
  };
  assert.ok(validSectorCompletion(proof));
  for (const invalid of [{ ...proof, elapsed: NaN }, { ...proof, discoveries: 0 }, { ...proof, activeTicks: 0 },
    { ...proof, connectedAtEnd: false }, { ...proof, stage: "relay" }]) assert.equal(validSectorCompletion(invalid as CompletedSectorMission), false);
});
