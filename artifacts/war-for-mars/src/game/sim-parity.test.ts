import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("browser and server reward-adjudication simulations stay byte-identical", async () => {
  const [browserSimulation, serverSimulation] = await Promise.all([
    readFile(new URL("./sim.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../api-server/src/game/sim.ts", import.meta.url), "utf8"),
  ]);

  assert.equal(
    browserSimulation,
    serverSimulation,
    "The browser can display a terminal result that the reward server cannot reproduce when the simulation sources drift.",
  );
});
