import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch as createServerMatch,
  step as stepServer,
  type StepInput as ServerInput,
} from "../../../api-server/src/game/sim";
import {
  createMatch as createClientMatch,
  step as stepClient,
  type StepInput as ClientInput,
} from "./sim";
import { prepareOrbital as prepareServerOrbital } from "../../../api-server/src/game/orbital-sim";
import { prepareOrbital as prepareClientOrbital } from "./orbital-sim";
import { PRACTICE_STEP_LIMIT } from "../../../api-server/src/game/rewards";

const idle = {
  throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false,
  evade: 0, preset: null, vertical: 0, roll: 0, boost: false, brake: false,
  inertial: false, missile: false, aimAssist: false,
} satisfies ServerInput & ClientInput;

test("v5 Contact practice resolves its timeout inside the existing replay cap on client and server", () => {
  const options = {
    seed: 2, goal: "disc" as const, disc: "rust" as const,
    allyCount: 4, foeCount: 4, tech: null, orbitalRulesVersion: 5 as const,
  };
  const server = createServerMatch("mandjet", "accord", 1, "practice", options);
  const client = createClientMatch("mandjet", "accord", 1, "practice", options);
  prepareServerOrbital(server, 5);
  prepareClientOrbital(client, 5);
  for (let frame = 0; frame < PRACTICE_STEP_LIMIT; frame += 1) {
    if (server.over && client.over) break;
    stepServer(server, idle as ServerInput, 1 / 60);
    stepClient(client, idle as ClientInput, 1 / 60);
  }
  assert.equal(server.over, "loss");
  assert.equal(client.over, server.over);
  assert.ok(Math.abs(server.time - 120) < 1e-9);
  assert.equal(client.time, server.time);
});
