import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { FlightPresencePanel, SharedFlightReferenceReadout, type FlightPresenceEntry } from "./FlightPresencePanel";

const other: FlightPresenceEntry = {
  actorId: "pilot:other-human", callsign: "Wing Pilot", faction: "ussf",
  kind: "pilot", friendly: true, alive: true, distanceMeters: 40,
};

test("the phone comparison counter includes self and the other human, not friendly AI", () => {
  const html = renderToStaticMarkup(createElement(FlightPresencePanel, {
    entries: [other, { ...other, actorId: "patrol:escort:ussf:1", kind: "patrol" }],
    connected: true, region: "mars-orbit", status: "LIVE",
    sessionInstanceId: "one-server-universe-session",
  }));
  assert.match(html, /2 HUMAN · 1 AI/);
  assert.match(html, /data-session-instance="one-server-universe-session"/);
});

test("a disconnected phone never presents a retained roster or session as live", () => {
  const html = renderToStaticMarkup(createElement(FlightPresencePanel, {
    entries: [other], connected: false, region: "mars-orbit", status: "RECONNECTING",
    sessionInstanceId: "stale-session",
  }));
  assert.doesNotMatch(html, /2 HUMAN|stale-session|Wing Pilot/);
});

test("the expanded pilot panel displays precise sector-local coordinates and one shared Moon reference", () => {
  const html = renderToStaticMarkup(createElement(SharedFlightReferenceReadout, {
    reference: {
      frameId: "mars-orbital-fixed-v1", position: { x: 260, y: 0, z: 0 },
      sector: { x: "1", y: "0", z: "0" }, local: { x: -252, y: 0, z: 0 },
      moonOffset: { x: -160, y: 49.1, z: -210 }, moonRange: 268.55,
    },
  }));
  assert.match(html, /text-flight-reference/);
  assert.match(html, /mars-orbital-fixed-v1/);
  assert.match(html, /SECTOR · 1 \/ 0 \/ 0/);
  assert.match(html, /LOCAL XYZ · -252.0 \/ 0.0 \/ 0.0/);
  assert.match(html, /MOON RANGE · 268.6 m/);
  assert.match(html, /MOON ΔXYZ · -160.0 \/ 49.1 \/ -210.0/);
});
