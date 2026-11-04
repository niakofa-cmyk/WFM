import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_RECONNECT_WINDOW_MS,
  SOCKET_HANDSHAKE_TIMEOUT_MS,
  nextReconnectDelayMs,
  reconnectDelayMs,
} from "./reconnect-policy";

test("reconnect backoff is bounded and deterministic for a given jitter value", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 20].map((attempt) => reconnectDelayMs(attempt, 0.5)),
    [250, 500, 1_000, 1_000, 1_000, 1_000],
  );
  assert.equal(reconnectDelayMs(0, 0), 225);
  assert.equal(reconnectDelayMs(0, 1), 275);
});

test("retry delay preserves enough time for a handshake inside the seat-hold window", () => {
  const now = 1_000;
  const deadline = now + CLIENT_RECONNECT_WINDOW_MS;
  const delay = nextReconnectDelayMs(0, deadline, now, 0.5);

  assert.equal(delay, 250);
  assert.ok(deadline - (now + delay) > SOCKET_HANDSHAKE_TIMEOUT_MS);
});

test("retry stops when there is not enough time to complete another handshake", () => {
  const now = 4_000;
  const deadline = now + SOCKET_HANDSHAKE_TIMEOUT_MS + 100;
  assert.equal(nextReconnectDelayMs(0, deadline, now, 0.5), null);
  assert.equal(nextReconnectDelayMs(0, now - 1, now, 0.5), null);
});
