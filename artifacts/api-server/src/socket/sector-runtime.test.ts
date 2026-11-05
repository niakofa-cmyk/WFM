import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { createSectorRuntime, parseIronEclipseCommand, parseSectorCommand, parseSectorInput } from "./sector-runtime";
import { sectorFlightEnabled, sectorProtocolVersion } from "./sector-feature";
import {
  ORBITAL_RUNTIME_ID, ORBITAL_SECTOR_SIMULATION_CONTRACT, SECTOR_ORBITAL_PROTOCOL_VERSION,
} from "@workspace/orbital-sim";
import { NEUTRAL_FLIGHT_INPUT, RUST_DISC_SECTOR, createFlight, stepFlight, type FlightInput, type FlightState } from "../game/flight-sector";
import type { CompletedSectorMission } from "../game/sector-completion";
import { validSectorCompletion } from "../game/sector-completion";
import type { SectorProgress, SectorSnapshot } from "../game/sector-missions";
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
test("Orbital sector protocol requires an explicit paired deployment opt-in", () => {
  assert.equal(sectorProtocolVersion({ NODE_ENV: "development" }), 1);
  assert.equal(sectorProtocolVersion({
    NODE_ENV: "development", WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED: "true",
  }), 2);
  assert.equal(sectorProtocolVersion({
    NODE_ENV: "production", WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED: "true",
  }), 1, "the new protocol cannot bypass the production sector feature gate");
  assert.equal(sectorProtocolVersion({
    NODE_ENV: "production", WFM_SECTOR_FLIGHT_ENABLED: "true",
    WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED: "TRUE",
  }), 1, "ambiguous opt-in values remain on the compatibility contract");
});
test("3D inputs exclude forged coordinates, results, identities, unknown buttons and non-finite axes", () => {
  assert.ok(parseSectorInput(NEUTRAL_FLIGHT_INPUT));
  assert.ok(parseSectorInput({ ...NEUTRAL_FLIGHT_INPUT, drift: true }));
  assert.ok(parseSectorInput({ ...NEUTRAL_FLIGHT_INPUT, strafe: 0.5, vertical: -0.25 }));
  const legacyClient = { ...NEUTRAL_FLIGHT_INPUT };
  delete (legacyClient as Partial<typeof legacyClient>).strafe;
  delete (legacyClient as Partial<typeof legacyClient>).vertical;
  assert.equal(parseSectorInput(legacyClient)?.strafe, 0);
  assert.equal(parseSectorInput(legacyClient)?.vertical, 0);
  for (const value of [
    {}, { ...NEUTRAL_FLIGHT_INPUT, position: { x: 1000 } }, { ...NEUTRAL_FLIGHT_INPUT, credits: 10000 },
    { ...NEUTRAL_FLIGHT_INPUT, throttle: 2 }, { ...NEUTRAL_FLIGHT_INPUT, yaw: NaN },
    { ...NEUTRAL_FLIGHT_INPUT, pitch: Infinity }, { ...NEUTRAL_FLIGHT_INPUT, fire: "true" },
    { ...NEUTRAL_FLIGHT_INPUT, userId: "other" },
    { ...NEUTRAL_FLIGHT_INPUT, drift: "true" },
    { ...NEUTRAL_FLIGHT_INPUT, strafe: 2 },
    { ...NEUTRAL_FLIGHT_INPUT, vertical: Number.NaN },
  ]) assert.equal(parseSectorInput(value), null);
});
test("server sector wrapper defaults to the same deterministic Orbital flight used by local Rust Disc", () => {
  const serverDefault = createFlight("glide");
  const canonical = createFlight("glide");
  const explicitLegacy = createFlight("glide");
  const input = { ...NEUTRAL_FLIGHT_INPUT, throttle: 0.45, yaw: 0.2, pitch: 0.15, strafe: 0.35, vertical: 0.25 };
  for (let i = 0; i < 90; i++) {
    stepFlight(serverDefault, input, 1 / 60);
    stepFlight(canonical, input, 1 / 60, RUST_DISC_SECTOR, ORBITAL_RUNTIME_ID);
    stepFlight(explicitLegacy, input, 1 / 60, RUST_DISC_SECTOR, "sector-motion-v1");
  }
  assert.deepEqual(serverDefault, canonical);
  assert.notDeepEqual(serverDefault.position, explicitLegacy.position);
});
test("Orbital protocol handshake pins the server session to the canonical simulation contract", async () => {
  const runtime = createSectorRuntime({ protocolVersion: SECTOR_ORBITAL_PROTOCOL_VERSION });
  const client = socket(), wing = socket();
  await runtime.handle(client.ws, "pilot-v2", "rust-disc", "orbital-v2-room",
    { type: "sector_join", version: 1, shipId: "glide" }, 0);
  assert.equal(client.packets.at(-1).reason, "sector_version_mismatch");
  await runtime.handle(client.ws, "pilot-v2", "rust-disc", "orbital-v2-room",
    { type: "sector_join", version: 2, shipId: "glide" }, 1);
  assert.equal(client.packets.at(-1).reason, "sector_simulation_mismatch");
  await runtime.handle(client.ws, "pilot-v2", "rust-disc", "orbital-v2-room",
    {
      type: "sector_join", version: 2, shipId: "glide",
      simulation: { ...ORBITAL_SECTOR_SIMULATION_CONTRACT, rulesVersion: 99 },
    }, 2);
  assert.equal(client.packets.at(-1).reason, "sector_simulation_mismatch");
  await runtime.handle(client.ws, "pilot-v2", "rust-disc", "orbital-v2-room",
    {
      type: "sector_join", version: 2, shipId: "glide",
      simulation: ORBITAL_SECTOR_SIMULATION_CONTRACT,
    }, 3);
  assert.equal(client.latest().version, 2);
  assert.deepEqual(client.latest().simulation, ORBITAL_SECTOR_SIMULATION_CONTRACT);
  assert.equal(client.latest().pilots.length, 1);
  await runtime.handle(wing.ws, "pilot-v2-wing", "rust-disc", "orbital-v2-room",
    {
      type: "sector_join", version: 2, shipId: "mandjet",
      simulation: ORBITAL_SECTOR_SIMULATION_CONTRACT,
    }, 4);
  for (const [pilot, user, time] of [[client, "pilot-v2", 5], [wing, "pilot-v2-wing", 6]] as const) {
    await runtime.handle(pilot.ws, user, "rust-disc", "orbital-v2-room",
      { type: "sector_ready", ready: true }, time);
  }
  await runtime.handle(client.ws, "pilot-v2", "rust-disc", "orbital-v2-room",
    { type: "sector_launch" }, 7);
  const startingPositions = new Map(client.latest().pilots.map(pilot => [pilot.slot, { ...pilot.flight.position }]));
  await runtime.handle(client.ws, "pilot-v2", "rust-disc", "orbital-v2-room", {
    type: "sector_input", seq: 0, input: { ...NEUTRAL_FLIGHT_INPUT, strafe: 0.8, vertical: 0.7 },
  }, 8);
  await runtime.handle(wing.ws, "pilot-v2-wing", "rust-disc", "orbital-v2-room", {
    type: "sector_input", seq: 0, input: { ...NEUTRAL_FLIGHT_INPUT, strafe: -0.7, vertical: -0.6 },
  }, 8);
  runtime.advance(8);
  for (let time = 25; time <= 178; time += 17) runtime.advance(time);
  const final = client.latest();
  const hostState = final.pilots.find(pilot => pilot.slot === 0)!;
  const wingState = final.pilots.find(pilot => pilot.slot === 1)!;
  assert.ok(hostState.flight.position.x > startingPositions.get(0)!.x);
  assert.ok(hostState.flight.position.y > startingPositions.get(0)!.y);
  assert.ok(wingState.flight.position.x < startingPositions.get(1)!.x);
  assert.ok(wingState.flight.position.y < startingPositions.get(1)!.y);
  assert.deepEqual(final.pilots, wing.latest().pilots, "the host and wing receive identical server-owned state");
  assert.equal(final.version, SECTOR_ORBITAL_PROTOCOL_VERSION);
  assert.deepEqual(final.simulation, ORBITAL_SECTOR_SIMULATION_CONTRACT);
  await runtime.close();
});
test("latency probes require a joined seat, echo only valid nonces, and are throttled per socket", async () => {
  const runtime = createSectorRuntime({});
  const pilot = socket();
  await runtime.handle(pilot.ws, "synthetic-pilot", "rust-disc", "latency-room", { type: "sector_ping", nonce: 1 }, 0);
  assert.equal(pilot.packets.at(-1).reason, "sector_join_required");

  await runtime.handle(pilot.ws, "synthetic-pilot", "rust-disc", "latency-room",
    { type: "sector_join", version: 1, shipId: "glide" }, 10);
  await runtime.handle(pilot.ws, "synthetic-pilot", "rust-disc", "latency-room",
    { type: "sector_ping", nonce: 1 }, 1000);
  assert.deepEqual(pilot.packets.at(-1), { type: "sector_pong", nonce: 1 });
  const packetCount = pilot.packets.length;
  await runtime.handle(pilot.ws, "synthetic-pilot", "rust-disc", "latency-room",
    { type: "sector_ping", nonce: 2 }, 1500);
  assert.equal(pilot.packets.length, packetCount, "sub-second probes are silently rate-limited");
  await runtime.handle(pilot.ws, "synthetic-pilot", "rust-disc", "latency-room",
    { type: "sector_ping", nonce: 2, userId: "forged" }, 2000);
  assert.equal(pilot.packets.at(-1).reason, "invalid_sector_ping");
  await runtime.handle(pilot.ws, "synthetic-pilot", "rust-disc", "latency-room",
    { type: "sector_ping", nonce: 2 }, 2000);
  assert.deepEqual(pilot.packets.at(-1), { type: "sector_pong", nonce: 2 });
});
test("public Rust Disc operation presence is opt-in, location-gated, anonymous, and follows room lifecycle", async () => {
  const presence: Array<Record<string, unknown>> = [];
  const atCinder = new Set(["pilot-a", "pilot-b"]);
  const runtime = createSectorRuntime({
    isAtCinderRing: async userId => atCinder.has(userId),
    publishOperation: async state => { presence.push(state); },
  });
  const outside = socket();
  await runtime.handle(outside.ws, "pilot-outside", "rust-disc", "cinder-room",
    { type: "sector_join", version: 1, shipId: "glide", publicListing: true }, 0);
  assert.equal(outside.packets.at(-1).reason, "operation_not_at_location");
  assert.equal(presence.length, 0);

  const a = socket(), b = socket();
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "cinder-room",
    { type: "sector_join", version: 1, shipId: "glide", publicListing: true }, 1);
  await runtime.handle(b.ws, "pilot-b", "rust-disc", "cinder-room",
    { type: "sector_join", version: 1, shipId: "mandjet" }, 2);
  await runtime.flushOperationUpdates();
  assert.equal(presence.at(-1)?.visibility, "public");
  assert.equal(presence.at(-1)?.phase, "assembling");
  assert.equal(presence.at(-1)?.currentPlayers, 2);
  assert.equal(presence.at(-1)?.ownerUserId, "pilot-a");
  assert.equal("roomCode" in presence.at(-1)!, false);

  await runtime.handle(a.ws, "pilot-a", "rust-disc", "cinder-room", { type: "sector_ready", ready: true }, 3);
  await runtime.handle(b.ws, "pilot-b", "rust-disc", "cinder-room", { type: "sector_ready", ready: true }, 4);
  await runtime.handle(a.ws, "pilot-a", "rust-disc", "cinder-room", { type: "sector_launch" }, 5);
  await runtime.flushOperationUpdates();
  assert.equal(presence.at(-1)?.phase, "active");
  assert.equal(presence.at(-1)?.currentPlayers, 2);

  runtime.detach(b.ws, 6);
  await runtime.flushOperationUpdates();
  assert.equal(presence.at(-1)?.currentPlayers, 1);
  runtime.detach(a.ws, 7);
  await runtime.flushOperationUpdates();
  assert.equal(presence.at(-1)?.phase, "closed");
  assert.equal(presence.at(-1)?.currentPlayers, 0);
  await runtime.close();
});
test("tactical command packets accept only the four exact, bounded order shapes", () => {
  assert.deepEqual(parseSectorCommand({ type: "sector_command", order: "attack" }), { type: "sector_command", order: "attack" });
  assert.deepEqual(parseSectorCommand({ type: "sector_command", order: "regroup" }), { type: "sector_command", order: "regroup" });
  assert.deepEqual(parseSectorCommand({ type: "sector_command", order: "defend", targetSlot: 2 }), { type: "sector_command", order: "defend", targetSlot: 2 });
  assert.deepEqual(parseSectorCommand({ type: "sector_command", order: "escort", targetSlot: 2 }), { type: "sector_command", order: "escort", targetSlot: 2 });
  for (const packet of [
    {}, { type: "sector_command", order: "teleport" }, { type: "sector_command", order: "attack", targetSlot: 2 },
    { type: "sector_command", order: "escort" }, { type: "sector_command", order: "defend", targetSlot: -1 },
    { type: "sector_command", order: "escort", targetSlot: 8 }, { type: "sector_command", order: "regroup", userId: "forged" },
  ]) assert.equal(parseSectorCommand(packet), null);
});
test("Iron Eclipse command packets accept only host order and enumerated subsystem target shapes", () => {
  assert.deepEqual(parseIronEclipseCommand({ type: "iron_eclipse_order", order: "attack" }), { type: "iron_eclipse_order", order: "attack" });
  assert.deepEqual(parseIronEclipseCommand({ type: "iron_eclipse_order", order: "regroup" }), { type: "iron_eclipse_order", order: "regroup" });
  assert.deepEqual(parseIronEclipseCommand({ type: "iron_eclipse_target", target: "point-defense" }), { type: "iron_eclipse_target", target: "point-defense" });
  assert.deepEqual(parseIronEclipseCommand({ type: "iron_eclipse_target", target: "shield-array" }), { type: "iron_eclipse_target", target: "shield-array" });
  for (const packet of [
    {}, { type: "iron_eclipse_order", order: "pause" }, { type: "iron_eclipse_order", order: "attack", userId: "spoof" },
    { type: "iron_eclipse_target", target: "reactor", position: { x: 1000, y: 0, z: 0 } },
    { type: "iron_eclipse_target", target: "not-a-subsystem" },
  ]) assert.equal(parseIronEclipseCommand(packet), null);
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
  assert.equal(a.latest().capabilities?.vectorDrift, true);
  assert.equal(a.latest().capabilities?.tacticalCommands, true);
  await runtime.handle(b.ws, "synthetic-b", "rust-disc", "flight-room", { type: "sector_join", version: 1, shipId: "mandjet" }, 0);
  await runtime.handle(b.ws, "synthetic-b", "rust-disc", "flight-room", { type: "sector_launch" }, 0);
  assert.equal(b.packets.at(-1).reason, "sector_host_required");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_launch" }, 0);
  assert.equal(a.packets.at(-1).reason, "sector_all_pilots_ready_required");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "attack" }, 0);
  assert.equal(a.packets.at(-1).reason, "sector_command_active_match_required");
  for (const [s, id] of [[a, "synthetic-a"], [b, "synthetic-b"]] as const) {
    await runtime.handle(s.ws, id, "rust-disc", "flight-room", { type: "sector_ready", ready: true }, 0);
  }
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_launch" }, 0);
  await runtime.handle(b.ws, "synthetic-b", "rust-disc", "flight-room", { type: "sector_command", order: "attack" }, 0);
  assert.equal(b.packets.at(-1).reason, "sector_command_host_required");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "escort", targetSlot: 8 }, 0);
  assert.equal(a.packets.at(-1).reason, "invalid_sector_command");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "defend", targetSlot: 0 }, 0);
  assert.equal(a.packets.at(-1).reason, "sector_command_target_unavailable");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "escort", targetSlot: 7 }, 0);
  assert.equal(a.packets.at(-1).reason, "sector_command_target_unavailable");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "attack" }, 0);
  assert.deepEqual(a.latest().command, {
    order: "attack", target: "drone", targetSlot: null, issuedBySlot: 0, issuedAtTick: 0,
  });
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "regroup" }, 500);
  assert.equal(a.packets.at(-1).reason, "sector_command_rate_limited");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "defend", targetSlot: 1 }, 800);
  assert.equal(a.latest().command?.order, "defend");
  assert.deepEqual(a.latest().command, b.latest().command);
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "escort", targetSlot: 1 }, 1600);
  assert.equal(a.latest().command?.order, "escort");
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "regroup" }, 2400);
  assert.deepEqual(a.latest().command, {
    order: "regroup", target: "pilot", targetSlot: 0, issuedBySlot: 0, issuedAtTick: 0,
  });
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
  await runtime.handle(a.ws, "synthetic-a", "rust-disc", "flight-room", { type: "sector_command", order: "escort", targetSlot: 1 }, 3200);
  assert.equal(a.latest().command?.targetSlot, 1);
  runtime.detach(b.ws, 3300);
  assert.equal(a.latest().command, null);
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
test("co-op sector vector-thrust pulses move both pilots authoritatively and clear on neutral input", async () => {
  const sampled: Array<Pick<FlightInput, "strafe" | "vertical">> = [];
  let settlements = 0;
  const runtime = createSectorRuntime({
    physics: (state, input, seconds, sector) => {
      sampled.push({ strafe: input.strafe ?? 0, vertical: input.vertical ?? 0 });
      stepFlight(state, input, seconds, sector);
    },
    settle: async () => {
      settlements++;
      return { progress: { completed: [], persistenceAvailable: true }, replayed: false };
    },
  });
  const host = socket(), wing = socket(), room = "vector-thrust-coop";
  for (const [client, user] of [[host, "vector-host"], [wing, "vector-wing"]] as const) {
    await runtime.handle(client.ws, user, "rust-disc", room,
      { type: "sector_join", version: 1, shipId: "glide" }, 0);
    await runtime.handle(client.ws, user, "rust-disc", room, { type: "sector_ready", ready: true }, 1);
  }
  await runtime.handle(host.ws, "vector-host", "rust-disc", room, { type: "sector_launch" }, 2);

  const start = new Map(host.latest().pilots.map(pilot => [pilot.slot, { ...pilot.flight.position }]));
  await runtime.handle(host.ws, "vector-host", "rust-disc", room, {
    type: "sector_input", seq: 0,
    input: { ...NEUTRAL_FLIGHT_INPUT, strafe: 0.8, vertical: 0.7 },
  }, 3);
  await runtime.handle(wing.ws, "vector-wing", "rust-disc", room, {
    type: "sector_input", seq: 0,
    input: { ...NEUTRAL_FLIGHT_INPUT, strafe: -0.7, vertical: -0.6 },
  }, 3);

  runtime.advance(0);
  for (let time = 17; time <= 170; time += 17) runtime.advance(time);
  await runtime.handle(host.ws, "vector-host", "rust-disc", room, {
    type: "sector_input", seq: 1, input: NEUTRAL_FLIGHT_INPUT,
  }, 180);
  await runtime.handle(wing.ws, "vector-wing", "rust-disc", room, {
    type: "sector_input", seq: 1, input: NEUTRAL_FLIGHT_INPUT,
  }, 180);
  runtime.advance(180);
  for (let time = 197; time <= 323; time += 17) runtime.advance(time);

  const hostState = host.latest().pilots.find(pilot => pilot.slot === 0)!;
  const wingState = host.latest().pilots.find(pilot => pilot.slot === 1)!;
  const hostStart = start.get(0)!, wingStart = start.get(1)!;
  assert.ok(hostState.flight.position.x > hostStart.x + 0.001, "positive lateral thrust moves the host right");
  assert.ok(hostState.flight.position.y > hostStart.y + 0.001, "positive vertical thrust climbs");
  assert.ok(wingState.flight.position.x < wingStart.x - 0.001, "negative lateral thrust moves the wing pilot left");
  assert.ok(wingState.flight.position.y < wingStart.y - 0.001, "negative vertical thrust descends");
  assert.deepEqual(host.latest().pilots, wing.latest().pilots, "both pilots receive the same authoritative room state");
  assert.ok(sampled.some(input => input.strafe! > 0 && input.vertical! > 0));
  assert.ok(sampled.some(input => input.strafe! < 0 && input.vertical! < 0));
  const lastPulse = sampled.reduce((last, input, index) =>
    input.strafe !== 0 || input.vertical !== 0 ? index : last, -1);
  assert.ok(lastPulse >= 0 && lastPulse < sampled.length - 1, "the server observed pulse frames followed by release frames");
  assert.ok(sampled.slice(lastPulse + 1).every(input => (input.strafe ?? 0) === 0 && (input.vertical ?? 0) === 0));
  assert.equal(settlements, 0, "movement alone cannot complete or settle a mission");
  await runtime.close();
});
test("Iron Eclipse snapshots share server state and only the host can issue an available target/order", async () => {
  const runtime = createSectorRuntime({ loadProgress: async () => ({ completed: [], persistenceAvailable: true }) });
  const host = socket(), wing = socket();
  const room = "iron-eclipse-room";
  for (const [client, user, shipId] of [[host, "synthetic-host", "glide"], [wing, "synthetic-wing", "sentinel"]] as const) {
    await runtime.handle(client.ws, user, "iron-eclipse", room, { type: "sector_join", version: 1, shipId }, 0);
  }
  assert.equal(host.latest().capabilities?.ironEclipse, true);
  assert.equal(host.latest().operation?.wing.length, 3);
  for (const [client, user] of [[host, "synthetic-host"], [wing, "synthetic-wing"]] as const) {
    await runtime.handle(client.ws, user, "iron-eclipse", room, { type: "sector_ready", ready: true }, 1);
  }
  await runtime.handle(host.ws, "synthetic-host", "iron-eclipse", room, { type: "sector_launch" }, 2);
  await runtime.handle(wing.ws, "synthetic-wing", "iron-eclipse", room, { type: "iron_eclipse_order", order: "attack" }, 3);
  assert.equal(wing.packets.at(-1).reason, "iron_eclipse_host_required");
  await runtime.handle(host.ws, "synthetic-host", "iron-eclipse", room, { type: "iron_eclipse_target", target: "reactor" }, 4);
  assert.equal(host.packets.at(-1).reason, "iron_eclipse_target_unavailable");
  await runtime.handle(host.ws, "synthetic-host", "iron-eclipse", room, { type: "iron_eclipse_order", order: "attack" }, 600);
  assert.equal(host.latest().operation?.order, "attack");
  assert.deepEqual(host.latest().operation, wing.latest().operation);
  await runtime.handle(host.ws, "synthetic-host", "iron-eclipse", room, { type: "sector_command", order: "attack" }, 1200);
  assert.equal(host.packets.at(-1).reason, "iron_eclipse_command_required");
  runtime.advance(1200);
  runtime.advance(1300);
  assert.deepEqual(host.latest().operation, wing.latest().operation);
  assert.doesNotMatch(JSON.stringify(host.latest()), /synthetic-host|synthetic-wing/);
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
test("a disconnected pilot cannot join a second sector room but can reconnect to the held seat", async () => {
  const runtime = createSectorRuntime({});
  const original = socket();
  const join = { type: "sector_join", version: 1, shipId: "glide" };
  await runtime.handle(original.ws, "pilot-a", "rust-disc", "first-room", join, 0);
  await runtime.handle(original.ws, "pilot-a", "rust-disc", "first-room", { type: "sector_ready", ready: true }, 1);
  await runtime.handle(original.ws, "pilot-a", "rust-disc", "first-room", { type: "sector_launch" }, 2);
  runtime.detach(original.ws, 100);
  original.ws.close();

  const secondRoom = socket();
  await runtime.handle(secondRoom.ws, "pilot-a", "rust-disc", "second-room", join, 200);
  assert.equal(secondRoom.packets.at(-1).reason, "sector_session_exists");
  assert.equal(runtime.roomCount, 1);

  const reconnect = socket();
  await runtime.handle(reconnect.ws, "pilot-a", "rust-disc", "first-room", join, 300);
  assert.equal(reconnect.latest().roomCode, "first-room");
  assert.equal(reconnect.latest().pilots.length, 1);
  await runtime.close();
});
test("concurrent sockets cannot load progress and claim rooms for the same account", async () => {
  let finishLoad!: (progress: SectorProgress) => void;
  const pendingProgress = new Promise<SectorProgress>(resolve => { finishLoad = resolve; });
  let loadCount = 0;
  const runtime = createSectorRuntime({
    loadProgress: async () => { loadCount++; return pendingProgress; },
  });
  const first = socket(), second = socket();
  const join = { type: "sector_join", version: 1, shipId: "glide" };
  const firstJoin = runtime.handle(first.ws, "pilot-a", "rust-disc", "first-room", join, 0);
  assert.equal(loadCount, 1);

  await runtime.handle(second.ws, "pilot-a", "rust-disc", "second-room", join, 0);
  assert.equal(second.packets.at(-1).reason, "sector_session_exists");
  finishLoad({ completed: [], persistenceAvailable: true });
  await firstJoin;

  assert.equal(loadCount, 1);
  assert.equal(runtime.roomCount, 1);
  assert.equal(first.latest().pilots.length, 1);
  await runtime.close();
});
test("disconnect and progress-load failure release account join reservations", async () => {
  const progressLoads: ((progress: SectorProgress) => void)[] = [];
  let failNextLoad = false;
  const runtime = createSectorRuntime({
    loadProgress: async () => {
      if (failNextLoad) {
        failNextLoad = false;
        throw new Error("synthetic progress store failure");
      }
      return new Promise<SectorProgress>(resolve => progressLoads.push(resolve));
    },
  });
  const join = { type: "sector_join", version: 1, shipId: "glide" };
  const disconnected = socket();
  const disconnectedJoin = runtime.handle(disconnected.ws, "pilot-a", "rust-disc", "stale-room", join, 0);
  runtime.detach(disconnected.ws, 1);
  disconnected.ws.close();

  const retry = socket();
  const retryJoin = runtime.handle(retry.ws, "pilot-a", "rust-disc", "retry-room", join, 2);
  assert.equal(progressLoads.length, 2);
  progressLoads[0]!({ completed: [], persistenceAvailable: true });
  await disconnectedJoin;
  assert.equal(runtime.roomCount, 0);
  progressLoads[1]!({ completed: [], persistenceAvailable: true });
  await retryJoin;
  assert.equal(runtime.roomCount, 1);

  failNextLoad = true;
  const failed = socket();
  await runtime.handle(failed.ws, "pilot-b", "rust-disc", "failed-room", join, 3);
  assert.equal(failed.packets.at(-1).reason, "discovery_database_unavailable");
  const afterFailure = socket();
  const successfulRetry = runtime.handle(afterFailure.ws, "pilot-b", "rust-disc", "recovered-room", join, 4);
  assert.equal(progressLoads.length, 3);
  progressLoads[2]!({ completed: [], persistenceAvailable: true });
  await successfulRetry;
  assert.equal(afterFailure.latest().roomCode, "recovered-room");
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
