import assert from "node:assert/strict";
import test from "node:test";
import {
  FREE_FLIGHT_TACTICS_PROTOCOL_V1,
  type FreeFlightTacticalSnapshotV1,
} from "@workspace/orbital-sim";
import {
  encounterCompositionView,
  readFreeFlightTacticalSnapshot,
} from "./encounter-composition";

const report: FreeFlightTacticalSnapshotV1 = {
  protocol: FREE_FLIGHT_TACTICS_PROTOCOL_V1,
  sessionInstanceId: "6b1be53f-7775-4c91-8d4e-317b3a2e2207",
  tick: 100,
  incomingHostileMissileCount: 2,
  fleets: [{
    fleetId: "patrol:accord:frontier",
    faction: "accord",
    callsign: "ACCORD FRONTIER",
    formation: "pursuit",
    mission: "intercept",
    detectionState: "contact",
    combatState: "engaged",
    encounterPhase: "active",
    threatLevel: 0.7,
    commandActorId: "patrol-ship:command",
    units: [
      { actorId: "patrol-ship:command", shipId: "sekhmet", role: "command", alive: true,
        hull: 40, hullMax: 124, shield: 0, shieldMax: 150, distanceMeters: 160 },
      { actorId: "patrol-ship:scout", shipId: "apep", role: "recon", alive: true,
        hull: 56, hullMax: 56, shield: 70, shieldMax: 70, distanceMeters: 190 },
      { actorId: "patrol-ship:escort", shipId: "shakuna", role: "escort", alive: true,
        hull: 52, hullMax: 52, shield: 70, shieldMax: 70, distanceMeters: 200 },
    ],
    alliedPilotCount: 1,
    alliedAiCount: 2,
  }],
};

const contact = {
  actorId: "patrol-ship:scout",
  engageable: true,
  callsign: "ACCORD FRONTIER - PURSUIT",
  faction: "accord" as const,
  shipId: "apep" as const,
  shipCount: 3,
  distanceMeters: 160,
  source: "server-snapshot" as const,
};

test("encounter composition reflects server-reported formations, incoming fire, support and command damage", () => {
  assert.deepEqual(readFreeFlightTacticalSnapshot(report), report);
  const view = encounterCompositionView(report, contact)!;
  assert.equal(view.beat, "LIVE FLEET ENGAGEMENT");
  assert.deepEqual(view.elements, [
    "RECON ELEMENT", "PURSUIT SCREEN", "HEAVY HULL", "MISSILE TRACK ×2",
    "HUMAN WING ×1", "AI SUPPORT ×2",
  ]);
  assert.equal(view.commandStatus, "damaged");
  assert.deepEqual(view.steps.map((step) => step.state), [
    "complete", "complete", "complete", "current",
  ]);
});

test("composition distinguishes actual withdrawal and settlement from a live battle", () => {
  const retreating = structuredClone(report);
  retreating.fleets[0]!.combatState = "retreating";
  retreating.fleets[0]!.mission = "withdraw";
  assert.equal(encounterCompositionView(retreating, contact)?.beat, "FLEET WITHDRAWING");

  const settled = structuredClone(report);
  settled.fleets[0]!.encounterPhase = "complete";
  settled.fleets[0]!.combatState = "destroyed";
  assert.equal(encounterCompositionView(settled, contact)?.beat, "FLEET DESTROYED");
  assert.equal(encounterCompositionView(settled, null, "patrol:accord:frontier")?.beat, "FLEET DESTROYED");
});

test("untrusted or local-only tactical data cannot produce a live encounter card", () => {
  const malformed = structuredClone(report) as unknown as Record<string, unknown>;
  malformed.incomingHostileMissileCount = Number.MAX_SAFE_INTEGER;
  assert.equal(readFreeFlightTacticalSnapshot(malformed), null);
  assert.equal(encounterCompositionView(report, { ...contact, source: undefined }), null);
  assert.equal(encounterCompositionView(null, contact), null);
  assert.equal(encounterCompositionView(report, null), null);
});
