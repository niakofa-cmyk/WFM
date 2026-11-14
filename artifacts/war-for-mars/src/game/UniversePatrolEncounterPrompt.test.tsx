import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UniversePatrolEncounterPrompt } from "./UniversePatrolEncounterPrompt";
import { displayedPatrolContact } from "./shared-flight-patrol-contact";
import { encounterCompositionView } from "./encounter-composition";
import { FREE_FLIGHT_TACTICS_PROTOCOL_V1, type FreeFlightTacticalSnapshotV1 } from "@workspace/orbital-sim";

const contact = { callsign: "ACCORD-0101", faction: "accord" as const, shipCount: 3, distanceMeters: 120 };

test("an empty authoritative roster removes the entire stale local battle notice", () => {
  const html = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact: displayedPatrolContact(true, null, contact),
    enabled: true,
    notice: "HOSTILE INTERCEPT · Live fleet battle engaged.",
  }));
  assert.equal(html, "");
});

test("local patrol traffic is a read-only preview and cannot launch a separate combat runtime", () => {
  const html = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact, enabled: false,
  }));
  assert.match(html, /ACCORD-0101/);
  assert.match(html, /3 SHIPS/);
  assert.match(html, /LOCAL PATROL CONTACT/);
  assert.doesNotMatch(html, /LOCAL PREVIEW · NO SERVER COMBAT/);
  assert.doesNotMatch(html, /button-intercept-in-flight-patrol/);
  assert.doesNotMatch(html, /REQUEST PATROL INTERCEPT/);
});

test("a nearby engageable server patrol exposes an in-scene free-flight engagement", () => {
  const html = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact: { ...contact, source: "server-snapshot", engageable: true },
    enabled: true,
    onEngage: () => {},
  }));
  assert.match(html, /LIVE FLEET CONTACT/);
  assert.match(html, /button-intercept-in-flight-patrol/);
  assert.match(html, /ENGAGE/);
  assert.match(html, /aria-label="Engage patrol in server-authoritative free flight"/);
  assert.doesNotMatch(html, /patrol-integrity-from-server/);
  assert.doesNotMatch(html, /INTERCEPT ENVELOPE/);
});

test("live encounter UI presents the observed battle arc and keeps a settled conclusion after contact clears", () => {
  const tactical: FreeFlightTacticalSnapshotV1 = {
    protocol: FREE_FLIGHT_TACTICS_PROTOCOL_V1,
    sessionInstanceId: "6b1be53f-7775-4c91-8d4e-317b3a2e2207",
    tick: 12,
    incomingHostileMissileCount: 1,
    fleets: [{
      fleetId: "patrol:accord:frontier", faction: "accord", callsign: "ACCORD FRONTIER",
      formation: "pursuit", mission: "intercept", detectionState: "contact",
      combatState: "engaged", encounterPhase: "active", threatLevel: .8,
      commandActorId: "patrol-ship:leader",
      units: [{ actorId: "patrol-ship:leader", shipId: "sekhmet", role: "command", alive: true,
        hull: 20, hullMax: 124, shield: 0, shieldMax: 150, distanceMeters: 140 }],
      alliedPilotCount: 1, alliedAiCount: 1,
    }],
  };
  const contact = { ...contactBase(), actorId: "patrol-ship:leader", source: "server-snapshot" as const };
  const liveView = encounterCompositionView(tactical, contact)!;
  const live = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact, composition: liveView, enabled: true,
  }));
  assert.match(live, /BATTLE ARC · LIVE FLEET ENGAGEMENT/);
  assert.match(live, /HEAVY HULL/);
  assert.match(live, /MISSILE TRACK ×1/);
  assert.match(live, /HUMAN WING ×1/);
  assert.match(live, /AI SUPPORT ×1/);
  assert.match(live, /COMMAND VESSEL · DAMAGED/);

  tactical.fleets[0]!.combatState = "destroyed";
  tactical.fleets[0]!.encounterPhase = "complete";
  tactical.fleets[0]!.units[0]!.alive = false;
  const conclusion = encounterCompositionView(tactical, null, tactical.fleets[0]!.fleetId)!;
  const settled = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact: null, composition: conclusion, enabled: true,
  }));
  assert.match(settled, /BATTLE ARC · FLEET DESTROYED/);
  assert.match(settled, /aria-label="Fleet battle conclusion"/);
});

function contactBase() {
  return {
    actorId: "patrol-ship:leader",
    engageable: true,
    callsign: "ACCORD FRONTIER",
    faction: "accord" as const,
    shipId: "sekhmet" as const,
    shipCount: 1,
    distanceMeters: 140,
  };
}

test("patrol prompt stays compact and non-actionable when distant or the shared link is unavailable", () => {
  const distant = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact: { ...contact, distanceMeters: 400, source: "server-snapshot", engageable: true },
    enabled: true,
    onEngage: () => {},
  }));
  assert.doesNotMatch(distant, /button-intercept-in-flight-patrol/);

  const disabled = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact: { ...contact, source: "server-snapshot", engageable: true },
    enabled: false,
    onEngage: () => {},
  }));
  assert.match(disabled, /SHARED COMBAT LINK UNAVAILABLE/);
  assert.doesNotMatch(disabled, /button-intercept-in-flight-patrol/);
});
