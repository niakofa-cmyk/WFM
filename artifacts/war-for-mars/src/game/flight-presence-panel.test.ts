import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { FlightPresencePanel, type FlightPresenceEntry } from "./FlightPresencePanel";

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
