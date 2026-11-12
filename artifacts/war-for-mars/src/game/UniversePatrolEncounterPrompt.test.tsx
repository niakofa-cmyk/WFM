import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UniversePatrolEncounterPrompt } from "./UniversePatrolEncounterPrompt";
import { displayedPatrolContact } from "./shared-flight-patrol-contact";

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
