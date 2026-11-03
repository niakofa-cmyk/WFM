import assert from "node:assert/strict";
import test from "node:test";
import { roomSessionKey, sendAuthenticatedJoin, terminalSocketError } from "./wing-session";

function transport() {
  const sent: string[] = [];
  return { sent, readyState: 1, send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => { sent.push(String(data)); } };
}
test("each transport obtains a fresh session and sends only a versioned join frame", async () => {
  let calls = 0;
  const get = async () => `synthetic-${++calls}`;
  const first = transport(), second = transport();
  await sendAuthenticatedJoin(first, get, "Pilot", "seat-capability");
  await sendAuthenticatedJoin(second, get, "Pilot", "rotated-capability");
  assert.equal(calls, 2);
  assert.deepEqual(JSON.parse(first.sent[0]), { type: "join", protocol: 1, name: "Pilot", sessionToken: "synthetic-1", reconnectToken: "seat-capability" });
  assert.equal(JSON.parse(second.sent[0]).sessionToken, "synthetic-2");
});
test("no token or a rejected token provider cannot fabricate a joined session", async () => {
  const socket = transport();
  await assert.rejects(sendAuthenticatedJoin(socket, async () => null, "Pilot"));
  await assert.rejects(sendAuthenticatedJoin(socket, async () => { throw new Error("unavailable"); }, "Pilot"));
  assert.equal(socket.sent.length, 0);
});
test("late token resolution cannot authenticate a closed or replaced transport", async () => {
  const socket = transport();
  let current = true;
  let release: ((token: string) => void) | undefined;
  const pending = sendAuthenticatedJoin(socket, () => new Promise((resolve) => { release = resolve; }), "Pilot", undefined, () => current);
  current = false; assert.ok(release); release("synthetic"); await pending;
  assert.equal(socket.sent.length, 0);
  socket.readyState = 3;
  await sendAuthenticatedJoin(socket, async () => { throw new Error("must not request"); }, "Pilot");
});
test("seat storage is scoped to account and room; expiry remains retryable", () => {
  assert.equal(roomSessionKey("mars-alpha", "user_a"), roomSessionKey("MARS-ALPHA", "user_a"));
  assert.notEqual(roomSessionKey("mars-alpha", "user_a"), roomSessionKey("mars-alpha", "user_b"));
  assert.notEqual(roomSessionKey("mars-alpha", "user_a"), roomSessionKey("mars-beta", "user_a"));
  assert.equal(terminalSocketError("session_expired"), false);
  assert.equal(terminalSocketError("authentication_failed"), true);
  assert.equal(terminalSocketError("protocol_mismatch"), true);
});
