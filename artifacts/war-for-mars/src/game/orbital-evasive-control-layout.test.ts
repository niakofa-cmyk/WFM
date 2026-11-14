import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("./free-flight-client.ts", import.meta.url), "utf8");
const stick = readFileSync(new URL("./PilotFlightStick.tsx", import.meta.url), "utf8");
const controlsCss = readFileSync(new URL("./combat-lab.css", import.meta.url), "utf8");

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

test("live barrel rolls isolate hull rotation and never show false full-turn completion", () => {
  assert.match(stick, /if \(touch\.circularMode\) sendAxis\(0, 0\);/);
  assert.match(stick, /ROLL LEFT.*LIVE/);
  assert.doesNotMatch(stick, /strokeDashoffset=\{100 - feedback\.progress/);
  assert.match(controlsCss, /max-height:380px.*orientation:landscape/);
  assert.match(controlsCss, /pilot-flight-stick-visual:not\(\.pilot-flight-stick-visual-static\)\{width:64px;height:64px\}/);
  const desktopStickRule = controlsCss.indexOf("@media(min-width:640px){.lab-flight .pilot-rust-disc-stick{width:8rem");
  const compactOverride = controlsCss.lastIndexOf("@media(max-height:380px) and (orientation:landscape)");
  assert.ok(compactOverride > desktopStickRule, "short landscape overrides must win over wide-screen stick sizing");
  assert.match(controlsCss.slice(compactOverride), /\.lab-flight \.pilot-rust-disc-stick\{width:4\.35rem;height:4\.35rem\}/);
  assert.match(controlsCss, /bottom:calc\(env\(safe-area-inset-bottom,0px\) \+ \.3rem\)!important/);
  assert.doesNotMatch(controlsCss, /bottom:max\(calc\(env\(safe-area-inset-bottom,0px\) \+ \.65rem\),2\.25rem\)!important/);
});
