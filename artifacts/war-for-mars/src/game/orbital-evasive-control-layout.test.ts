import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("./free-flight-client.ts", import.meta.url), "utf8");

test("Orbital flight control panel replaces brake with a real vector evade request", () => {
  assert.doesNotMatch(arena, /testId="button-brake"/);
  assert.match(arena, /testId="button-vector-evade"/);
  assert.match(arena, /freeFlightClientRef\.current\?\.requestVectorBoost\(direction\)/);
  assert.match(arena, /requestRightVectorBoost\(flightBus, direction/);
  assert.match(arena, /orbital && rightThumbProfile\.mode !== "aim"/);
});

test("vector evade follows live right-thumb direction or alternates safe lateral fallback", () => {
  assert.match(arena, /boostDirectionAt\(flightBus\.rightX, flightBus\.rightY\)/);
  assert.match(arena, /fallbackEvasiveSideRef\.current \? "left" : "right"/);
  assert.ok(arena.includes("maneuver-right-thumb-profile-${mode}"));
});

test("the right-thumb circular roll is enabled in shared flight only after server negotiation", () => {
  assert.match(arena, /freeFlightClientRef\.current\?\.canControlBarrelRoll/);
  assert.match(client, /BARREL_ROLL_CONTROL_PROTOCOL_V1/);
  assert.match(client, /canControlBarrelRoll/);
  assert.match(arena, /controls\.maneuver\.kind !== "barrel-roll-control"/);
  assert.match(arena, /onCircularRollInput=\{bus\?\.orbital && bus\.leftStickFlight/);
});
