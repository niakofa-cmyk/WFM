// Cross-runtime determinism gate for the reward-adjudicated simulation.
//
// Runs the same replays through the simulation in Node (the reward server's
// runtime) and in Chromium (the player's runtime), then compares the bit-exact
// state checksum after every frame. Any difference fails the gate and reports
// the first divergent frame.
//
//   pnpm --filter @workspace/war-for-mars run test:determinism
//   pnpm --filter @workspace/war-for-mars run test:determinism -- --replay /tmp/capture.json
//
// A replay capture is JSON: { config: TraceConfig, inputs: StepInput[], liveChecksums?: number[] }.
// Keep captures outside the repository; they contain a player's raw controls.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "vite";
import { firstDivergence, syntheticInputs, traceReplay, type ReplayTrace, type TraceConfig } from "../src/game/sim-trace";
import type { StepInput } from "../src/game/sim";

type Case = { name: string; config: TraceConfig; inputs: StepInput[]; liveChecksums?: number[] };

const STRIKE_FRAMES = 360 * 60;
const PRACTICE_FRAMES = 120 * 60;

function syntheticCases(): Case[] {
  const scenarios: Array<[string, TraceConfig, number]> = [
    ["mandjet strike relays", { shipId: "mandjet", faction: "accord", refit: 0, pace: "strike", setup: { seed: 101, goal: "disc", disc: "rust" } }, STRIKE_FRAMES],
    ["glide strike beacons", { shipId: "glide", faction: "ussf", refit: 1, pace: "strike", setup: { seed: 202, goal: "beacons", disc: "beacon" } }, STRIKE_FRAMES],
    ["sundara practice ace", { shipId: "sundara", faction: "accord", refit: 2, pace: "practice", setup: { seed: 303, goal: "ace", disc: "night", shieldMk2: true } }, PRACTICE_FRAMES],
    ["duskbreaker strike extract", { shipId: "duskbreaker", faction: "ussf", refit: 0, pace: "strike", setup: { seed: 404, goal: "extract", disc: "dust", tech: "mark" } }, STRIKE_FRAMES],
    ["tripura strike small wing", { shipId: "tripura", faction: "accord", refit: 3, pace: "strike", setup: { seed: 505, goal: "disc", disc: "dust", allyCount: 2, foeCount: 3, tech: "stick" } }, STRIKE_FRAMES],
    ["splitter practice barrels", { shipId: "splitter", faction: "ussf", refit: 1, pace: "practice", setup: { seed: 606, goal: "disc", disc: "rust", tech: "barrels" } }, PRACTICE_FRAMES],
  ];
  return scenarios.map(([name, config, frames], i) => ({ name, config, inputs: syntheticInputs(9001 + i, frames) }));
}

function captureCase(path: string): Case {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<Case> & { config?: Partial<TraceConfig> & Record<string, unknown> };
  if (!raw.config || !Array.isArray(raw.inputs)) throw new Error(`${path} must contain "config" and "inputs".`);
  const c = raw.config;
  // Accept either a TraceConfig or a server-issued strike run config.
  const config: TraceConfig = c.setup
    ? (c as TraceConfig)
    : {
        shipId: c.shipId as TraceConfig["shipId"],
        faction: c.faction as TraceConfig["faction"],
        refit: Number(c.refit ?? 0),
        pace: c.pace as TraceConfig["pace"],
        setup: {
          seed: c.seed as number,
          goal: c.goal as never,
          disc: c.disc as never,
          allyCount: c.allyCount as number,
          foeCount: c.foeCount as number,
          tech: (c.tech ?? null) as never,
          shieldMk2: Boolean(c.shieldMk2),
        },
      };
  return { name: `capture ${path}`, config, inputs: raw.inputs, liveChecksums: raw.liveChecksums };
}

async function browserBundle() {
  const entry = fileURLToPath(new URL("../src/game/sim-trace.ts", import.meta.url));
  const output = await build({
    configFile: false,
    logLevel: "silent",
    publicDir: false,
    build: {
      write: false,
      minify: false,
      lib: { entry, name: "WfmSimTrace", formats: ["iife"], fileName: () => "sim-trace.js" },
    },
  });
  const results = Array.isArray(output) ? output : [output];
  for (const result of results) {
    if ("output" in result) {
      const chunk = result.output.find((item) => item.type === "chunk");
      if (chunk && chunk.type === "chunk") return chunk.code;
    }
  }
  throw new Error("Could not bundle the simulation for Chromium.");
}

function chromiumExecutable() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? process.env.CHROME_BIN;
  if (configured) return configured;
  return existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined;
}

function describe(trace: Pick<ReplayTrace, "framesApplied" | "outcome" | "kills" | "relays">) {
  return `${trace.framesApplied} frames, ${trace.outcome ?? "unresolved"}, ${trace.kills} kills, ${trace.relays} relays`;
}

async function main() {
  const replayFlag = process.argv.indexOf("--replay");
  const cases = replayFlag >= 0 ? [captureCase(process.argv[replayFlag + 1])] : syntheticCases();

  const code = await browserBundle();
  const executablePath = chromiumExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  let failures = 0;
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: code });
    console.log(`Node ${process.version} vs Chromium ${browser.version()}`);
    for (const testCase of cases) {
      const node = traceReplay(testCase.config, testCase.inputs);
      const web = (await page.evaluate(
        ({ config, inputs }) => (window as unknown as { WfmSimTrace: { traceReplay: typeof traceReplay } }).WfmSimTrace.traceReplay(config, inputs),
        { config: testCase.config, inputs: testCase.inputs },
      )) as ReplayTrace;
      const diverged = firstDivergence(node.checksums, web.checksums);
      if (diverged >= 0) {
        failures += 1;
        console.error(`FAIL ${testCase.name}: Node and Chromium state first differs after frame ${diverged}.`);
        console.error(`     Node: ${describe(node)}\n     Chromium: ${describe(web)}`);
      } else {
        console.log(`ok   ${testCase.name}: ${node.checksums.length} identical frame states (${describe(node)})`);
      }
      if (testCase.liveChecksums) {
        const live = firstDivergence(testCase.liveChecksums, node.checksums.slice(0, testCase.liveChecksums.length));
        if (live >= 0) {
          failures += 1;
          console.error(`FAIL ${testCase.name}: the live Arena first differs from the replay after frame ${live}.`);
        } else {
          console.log(`ok   ${testCase.name}: live Arena checksums match all ${testCase.liveChecksums.length} recorded states`);
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (failures > 0) {
    console.error(`${failures} determinism check(s) failed.`);
    process.exit(1);
  }
}

await main();
