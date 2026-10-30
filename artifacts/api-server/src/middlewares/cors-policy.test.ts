import assert from "node:assert/strict";
import test from "node:test";
import {
  createApiCorsOrigin,
  isApiOriginAllowed,
  parseApiAllowedOrigins,
} from "./cors-policy";

test("API origin allowlist accepts exact HTTP and HTTPS origins", () => {
  const origins = parseApiAllowedOrigins(
    "https://game.example, http://localhost:5173",
  );
  assert.deepEqual([...origins!], [
    "https://game.example",
    "http://localhost:5173",
  ]);
});

test("API origin allowlist rejects paths, credentials, and non-HTTP schemes", () => {
  for (const value of [
    "https://game.example/path",
    "https://pilot:secret@game.example",
    "wss://game.example",
  ]) {
    assert.throws(() => parseApiAllowedOrigins(value), /API_ALLOWED_ORIGINS/);
  }
});

test("production requires a non-empty API origin allowlist", () => {
  assert.throws(
    () => createApiCorsOrigin("production", undefined),
    /must be configured/,
  );
  assert.throws(
    () => createApiCorsOrigin("production", " "),
    /must be configured/,
  );
});

test("production blocks unlisted browser origins and permits non-browser calls", () => {
  const origins = parseApiAllowedOrigins("https://game.example");
  assert.equal(isApiOriginAllowed("https://game.example", origins, true), true);
  assert.equal(isApiOriginAllowed("https://other.example", origins, true), false);
  assert.equal(isApiOriginAllowed(undefined, origins, true), true);
});

test("development retains same-origin and local cross-origin behavior", () => {
  assert.equal(isApiOriginAllowed(undefined, undefined, false), true);
  assert.equal(
    isApiOriginAllowed("http://localhost:5173", undefined, false),
    true,
  );
});
