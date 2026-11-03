import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { createClerkSocketVerifier } from "./auth";
import { TEST_ORIGIN, testJoin, testToken, testVerifier } from "./auth.test-fixtures";
import { startWingSocketServer } from "./server";

type Packet = { type?: string; reason?: string; [key: string]: unknown };
function next(socket: WebSocket, type: string) {
  return new Promise<Packet>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off("message", receive); reject(new Error(`Timed out waiting for ${type}`)); }, 3000);
    function receive(data: Buffer) {
      const packet = JSON.parse(data.toString()) as Packet;
      if (packet.type !== type) return;
      clearTimeout(timer); socket.off("message", receive); resolve(packet);
    }
    socket.on("message", receive);
  });
}
async function connect(port: number, origin = TEST_ORIGIN) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=mars-auth`, { origin });
  await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  return socket;
}
async function finish(runtime: Awaited<ReturnType<typeof startWingSocketServer>>, sockets: WebSocket[]) {
  await Promise.all(sockets.map((socket) => new Promise<void>((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) return resolve();
    socket.once("close", () => resolve()); socket.terminate();
  })));
  await runtime.close();
}

test("Clerk verifier requires explicit credentials and exact origins", () => {
  assert.throws(() => createClerkSocketVerifier({ authorizedParties: [] }));
  assert.throws(() => createClerkSocketVerifier({ jwtKey: "unused", authorizedParties: [] }));
  assert.throws(() => createClerkSocketVerifier({ jwtKey: "unused", authorizedParties: ["https://wfm.test/path"] }));
});

test("real Clerk signature verification accepts synthetic session, rejects forged and invalid claims", async () => {
  assert.ok((await testVerifier(testToken("Pilot"), TEST_ORIGIN))?.playerId.startsWith("user_"));
  const valid = testToken("Pilot");
  const [header, body, signature] = valid.split(".");
  const forged = `${header}.${Buffer.from(JSON.stringify({ sub: "user_attacker" })).toString("base64url")}.${signature}`;
  assert.equal(await testVerifier(forged, TEST_ORIGIN), null);
  assert.equal(await testVerifier(`${header}.${body}.invalid`, TEST_ORIGIN), null);
  for (const claims of [
    { exp: 1 }, { nbf: Math.floor(Date.now() / 1000) + 600 }, { azp: "https://attacker.test" },
    { sid: "machine_id" }, { sub: "machine_id" }, { sts: "pending" },
  ]) assert.equal(await testVerifier(testToken("Pilot", claims), TEST_ORIGIN), null);
  assert.equal(await testVerifier(valid, undefined), null);
  assert.equal(await testVerifier(valid, "https://attacker.test"), null);
});

test("join fails closed before room allocation for credentials, protocol and origin failures", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", { verifySession: testVerifier });
  const sockets: WebSocket[] = [];
  try {
    for (const [packet, reason, origin] of [
      [{ type: "join", name: "Pilot" }, "authentication_required", TEST_ORIGIN],
      [{ ...testJoin("Pilot"), protocol: 99 }, "protocol_mismatch", TEST_ORIGIN],
      [{ ...testJoin("Pilot"), sessionToken: "forged" }, "authentication_failed", TEST_ORIGIN],
      [testJoin("Pilot"), "authentication_failed", "https://attacker.test"],
    ] as const) {
      const socket = await connect(runtime.port, origin); sockets.push(socket);
      const response = next(socket, "error"); socket.send(JSON.stringify(packet));
      assert.equal((await response).reason, reason); assert.equal(runtime.roomCount, 0);
    }
  } finally { await finish(runtime, sockets); }
});

test("missing verifier and unauthenticated commands never allocate a room", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1");
  const sockets: WebSocket[] = [];
  try {
    const socket = await connect(runtime.port); sockets.push(socket);
    const denied = next(socket, "error"); socket.send(JSON.stringify(testJoin("Pilot")));
    assert.equal((await denied).reason, "authentication_failed");
    const second = await connect(runtime.port); sockets.push(second);
    const rejected = next(second, "error"); second.send(JSON.stringify({ type: "ready", ready: true }));
    assert.equal((await rejected).reason, "authentication_required");
    assert.equal(runtime.roomCount, 0);
  } finally { await finish(runtime, sockets); }
});

test("slow authentication cannot allocate a room after connection deadline", async () => {
  let release: ((value: { playerId: string; expiresAt: number }) => void) | undefined;
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    authTimeoutMs: 80, verifySession: () => new Promise((resolve) => { release = resolve; }),
  });
  const socket = await connect(runtime.port);
  try {
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    socket.send(JSON.stringify(testJoin("Pilot"))); await closed;
    assert.ok(release); release({ playerId: "user_synthetic", expiresAt: Date.now() + 60000 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(runtime.roomCount, 0);
  } finally { await finish(runtime, [socket]); }
});


async function request(socket: WebSocket, packet: object, type = "joined") {
  const response = next(socket, type); socket.send(JSON.stringify(packet)); return response;
}

test("verified accounts cannot steal seats, duplicate seats or reuse rotated capabilities", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", { verifySession: testVerifier });
  const sockets: WebSocket[] = [];
  const open = async () => { const socket = await connect(runtime.port); sockets.push(socket); return socket; };
  try {
    const owner = await open();
    const seat = await request(owner, testJoin("Owner"));
    assert.equal(seat.protocol, 1);
    const serialized = JSON.stringify(seat.snapshot);
    assert.equal(serialized.includes("sessionToken"), false);
    assert.equal(serialized.includes("reconnectToken"), false);
    assert.equal(serialized.includes("user_"), false);
    const thief = await open();
    assert.equal((await request(thief, { ...testJoin("Attacker", String(seat.reconnectToken)), playerId: "Owner", slotId: seat.slotId }, "error")).reason, "session_lost");
    const duplicate = await open();
    assert.equal((await request(duplicate, testJoin("Owner"), "error")).reason, "already_joined");
    await request(owner, { type: "ready", ready: true }, "lobby");
    await request(owner, { type: "start" }, "started");
    const replaced = new Promise<number>((resolve) => owner.once("close", (code) => resolve(code)));
    const replacement = await open();
    const reclaimed = await request(replacement, testJoin("Owner", String(seat.reconnectToken)));
    assert.equal(reclaimed.phase, "active");
    assert.equal(reclaimed.slotId, seat.slotId);
    assert.notEqual(reclaimed.reconnectToken, seat.reconnectToken);
    assert.equal(await replaced, 4001);
    const stale = await open();
    assert.equal((await request(stale, testJoin("Owner", String(seat.reconnectToken)), "error")).reason, "session_lost");
    const snapshot = reclaimed.snapshot as { players: Array<{ connected: boolean }> };
    assert.equal(snapshot.players.filter((player) => player.connected).length, 1);
  } finally { await finish(runtime, sockets); }
});

test("expired signed session loses its transport and fresh same-account session recovers the seat", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", { verifySession: testVerifier });
  const sockets: WebSocket[] = [];
  try {
    const owner = await connect(runtime.port); sockets.push(owner);
    const seat = await request(owner, { ...testJoin("Expiry"), sessionToken: testToken("Expiry", { exp: Math.floor(Date.now() / 1000) + 2 }) });
    const closed = new Promise<number>((resolve) => owner.once("close", (code) => resolve(code)));
    assert.equal((await next(owner, "error")).reason, "session_expired");
    assert.equal(await closed, 4003);
    const replacement = await connect(runtime.port); sockets.push(replacement);
    const recovered = await request(replacement, testJoin("Expiry", String(seat.reconnectToken)));
    assert.equal(recovered.slotId, seat.slotId);
    assert.notEqual(recovered.reconnectToken, seat.reconnectToken);
  } finally { await finish(runtime, sockets); }
});

test("pipelined pre-auth commands cannot launch a match or allocate extra seats", async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySession: async (token, origin) => { await gate; return testVerifier(token, origin); },
  });
  const socket = await connect(runtime.port);
  try {
    const joined = next(socket, "joined");
    socket.send(JSON.stringify(testJoin("Pipeline")));
    socket.send(JSON.stringify(testJoin("Other")));
    socket.send(JSON.stringify({ type: "ready", ready: true }));
    socket.send(JSON.stringify({ type: "start" }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(runtime.roomCount, 0); assert.ok(release); release();
    const packet = await joined;
    assert.equal(packet.phase, "lobby");
    const snapshot = packet.snapshot as { tick: number; players: Array<{ connected: boolean }> };
    assert.equal(snapshot.tick, 0);
    assert.equal(snapshot.players.filter((player) => player.connected).length, 1);
  } finally { await finish(runtime, [socket]); }
});
