import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the fixed account control cannot cover the live arena menu", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
  assert.match(app, /data-testid="account-control" className="wfm-account-control /);
  assert.match(css, /body:has\(\[data-testid="arena-stage"\]\) \.wfm-account-control\s*\{\s*display: none;/);
});
