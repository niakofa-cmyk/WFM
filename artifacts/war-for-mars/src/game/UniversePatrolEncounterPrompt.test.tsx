import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UniversePatrolEncounterPrompt } from "./UniversePatrolEncounterPrompt";

const contact = { callsign: "ACCORD-0101", faction: "accord" as const, shipCount: 3, distanceMeters: 120 };

test("in-flight patrol prompt requests the server approach operation in range", () => {
  const html = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact, enabled: true, onIntercept: () => {},
  }));
  assert.match(html, /ACCORD-0101/);
  assert.match(html, /3 SHIPS/);
  assert.match(html, /button-intercept-in-flight-patrol/);
  assert.match(html, /REQUEST SERVER APPROACH/);
});

test("shared-flight contacts identify their distance as server-snapshot state", () => {
  const html = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact: { ...contact, source: "server-snapshot" },
    enabled: true,
    onIntercept: () => {},
  }));
  assert.match(html, /LIVE SERVER PATROL CONTACT/);
  assert.match(html, /SERVER POSITION/);
});

test("patrol prompt stays advisory while distant or when the combat rollout is disabled", () => {
  const distant = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact: { ...contact, distanceMeters: 400 }, enabled: true, onIntercept: () => {},
  }));
  assert.match(distant, /status-patrol-approach/);
  assert.doesNotMatch(distant, /button-intercept-in-flight-patrol/);

  const disabled = renderToStaticMarkup(createElement(UniversePatrolEncounterPrompt, {
    contact, enabled: false, onIntercept: () => {},
  }));
  assert.match(disabled, /status-patrol-intercept-disabled/);
  assert.doesNotMatch(disabled, /button-intercept-in-flight-patrol/);
});
