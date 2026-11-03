import assert from "node:assert/strict";
import test from "node:test";
import { resolveArenaTech } from "./arena-config";

test("server-owned null technology is not replaced by a saved client preference", () => {
  assert.equal(resolveArenaTech({ tech: null }, "barrels"), null);
});

test("server-owned technology is used for an authorized strike", () => {
  assert.equal(resolveArenaTech({ tech: "stick" }, "barrels"), "stick");
});

test("offline practice keeps the saved technology preference", () => {
  assert.equal(resolveArenaTech(undefined, "mark"), "mark");
  assert.equal(resolveArenaTech(null, null), null);
});
