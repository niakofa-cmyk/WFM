import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { WebSocket } from "ws";
import { startWingSocketServer } from "./server";
import { createSocketTestAuth, authenticateTestSocket, waitForPacket } from "./test-session-auth";
import { NEUTRAL_FLIGHT_INPUT } from "../game/flight-sector";
import type { SectorSnapshot } from "../game/sector-missions";

async function rejected(url: string, headers: Record<string, string> = {}) {
  const ws = new WebSocket(url, { headers });
  const result = await new Promise<number>((resolve, reject) => {
    ws.once("unexpected-response", (_request, response) => { response.resume(); ws.terminate(); resolve(response.statusCode!); });
    ws.once("open", () => { ws.close(); reject(new Error("Expected rejected upgrade")); });
    ws.on("error", () => undefined);
  });
  return result;
}
test("sector upgrade preserves fail-closed feature, CORS, query-token and authentication boundaries", async () => {
  const auth = createSocketTestAuth();
  const disabled = await startWingSocketServer(0, "127.0.0.1", { verifySessionToken: auth.verifySessionToken });
  try {
    assert.equal(await rejected(`ws://127.0.0.1:${disabled.port}/ws?room=secure-room&sector=rust-disc`), 503);
  } finally { await disabled.close(); }
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: auth.verifySessionToken, enableSectorFlight: true,
    allowedOrigins: new Set(["https://pilots.example.test"]),
  });
  const base = `ws://127.0.0.1:${runtime.port}/ws?room=secure-room&sector=rust-disc`;
  try {
    assert.equal(await rejected(base, { Origin: "https://attacker.example.test" }), 403);
    assert.equal(await rejected(`${base}&token=synthetic-not-a-credential`, { Origin: "https://pilots.example.test" }), 400);
    const ws = new WebSocket(base, { headers: { Origin: "https://pilots.example.test", "x-clerk-user-id": "spoofed-user" } });
    await once(ws, "open");
    const denied = waitForPacket(ws, p => p.type === "error");
    const closed = once(ws, "close");
    ws.send(JSON.stringify({ type: "sector_join", version: 1, shipId: "glide" }));
    assert.equal((await denied).reason, "authentication_required");
    assert.equal((await closed)[0], 1008);
    const invalid = new WebSocket(base, { headers: { Origin: "https://pilots.example.test" } });
    await once(invalid, "open");
    const invalidDenied = waitForPacket(invalid, p => p.type === "error");
    const invalidClosed = once(invalid, "close");
    invalid.send(JSON.stringify({ type: "authenticate", token: "clerk_test_not_a_valid_session" }));
    assert.equal((await invalidDenied).reason, "authentication_required");
    assert.equal((await invalidClosed)[0], 1008);
  } finally { await runtime.close(); }
});
test("two authenticated real WebSocket clients see the same moving XYZ scene and restart interruption", async () => {
  const auth = createSocketTestAuth();
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: auth.verifySessionToken, enableSectorFlight: true,
  });
  const url = `ws://127.0.0.1:${runtime.port}/ws?room=paired-room&sector=rust-disc`;
  const a = new WebSocket(url), b = new WebSocket(url);
  try {
    await Promise.all([once(a, "open"), once(b, "open")]);
    await authenticateTestSocket(a, auth, "synthetic-sector-a");
    await authenticateTestSocket(b, auth, "synthetic-sector-b");
    const first = waitForPacket(a, p => p.type === "sector_snapshot");
    a.send(JSON.stringify({ type: "sector_join", version: 1, shipId: "glide" }));
    await first;
    const joined = waitForPacket(b, p => p.type === "sector_snapshot");
    b.send(JSON.stringify({ type: "sector_join", version: 1, shipId: "mandjet" }));
    await joined;
    const bothReady = waitForPacket(a, p => p.type === "sector_snapshot" && (p.pilots as any[])?.every(pilot => pilot.ready));
    for (const ws of [a, b]) ws.send(JSON.stringify({ type: "sector_ready", ready: true }));
    await bothReady;
    const active = waitForPacket(a, p => p.type === "sector_snapshot" && p.phase === "active");
    a.send(JSON.stringify({ type: "sector_launch" }));
    await active;
    const nonHostRejected = waitForPacket(b, p => p.type === "error" && p.reason === "sector_command_host_required");
    b.send(JSON.stringify({ type: "sector_command", order: "attack" }));
    await nonHostRejected;
    const orderA = waitForPacket(a, p => p.type === "sector_snapshot" && (p.command as any)?.order === "escort");
    const orderB = waitForPacket(b, p => p.type === "sector_snapshot" && (p.command as any)?.order === "escort");
    a.send(JSON.stringify({ type: "sector_command", order: "escort", targetSlot: 1 }));
    const [orderedA, orderedB] = await Promise.all([orderA, orderB]);
    assert.deepEqual(orderedA.command, orderedB.command);
    assert.equal((orderedA.command as any).issuedBySlot, orderedA.hostSlot);
    const movingA = waitForPacket(a, p => p.type === "sector_snapshot" && (p.tick as number) >= 12);
    const movingB = waitForPacket(b, p => p.type === "sector_snapshot" && (p.tick as number) >= 12);
    a.send(JSON.stringify({ type: "sector_input", seq: 0, input: { ...NEUTRAL_FLIGHT_INPUT, throttle: 1, pitch: 1 } }));
    const [sceneA, sceneB] = await Promise.all([movingA, movingB]) as unknown as [SectorSnapshot, SectorSnapshot];
    assert.equal(sceneA.tick, sceneB.tick);
    assert.deepEqual(sceneA.pilots, sceneB.pilots);
    assert.ok(sceneA.pilots[0]!.flight.position.y > 0);
    assert.notEqual(sceneA.ownSlot, sceneB.ownSlot);
    const interrupted = [a, b].map(ws => waitForPacket(ws, p => p.type === "interrupted"));
    await runtime.close();
    for (const packet of await Promise.all(interrupted)) assert.equal(packet.reason, "server_restart");
  } finally { a.terminate(); b.terminate(); await runtime.close(); }
});
