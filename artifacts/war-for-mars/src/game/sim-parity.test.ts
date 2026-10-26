import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Every module the reward server uses to adjudicate a replay must be identical
// in the browser. Source equality is necessary but not sufficient: the
// cross-runtime gate (pnpm run test:determinism) proves the runtimes agree.
const SHARED_SIMULATION_MODULES = ["sim.ts", "detmath.ts", "sim-trace.ts", "ships.ts"];

for (const file of SHARED_SIMULATION_MODULES) {
  test(`browser and server ${file} stay byte-identical`, async () => {
    const [browserSource, serverSource] = await Promise.all([
      readFile(new URL(`./${file}`, import.meta.url), "utf8"),
      readFile(new URL(`../../../api-server/src/game/${file}`, import.meta.url), "utf8"),
    ]);
    assert.equal(
      browserSource,
      serverSource,
      "The browser can display a terminal result that the reward server cannot reproduce when the simulation sources drift.",
    );
  });
}

test("the shared simulation never calls implementation-approximated Math functions", async () => {
  const source = await readFile(new URL("./sim.ts", import.meta.url), "utf8");
  const banned = source.match(/Math\.(sin|cos|tan|asin|acos|atan|atan2|exp|expm1|log|log1p|log2|log10|pow|hypot|cbrt|sinh|cosh|tanh|random)\b/g);
  assert.equal(banned, null, `Use the deterministic helpers in detmath.ts instead of ${banned?.join(", ")}.`);
  assert.doesNotMatch(source, /\*\*/, "The exponent operator is implementation-approximated; use explicit multiplication.");
});
