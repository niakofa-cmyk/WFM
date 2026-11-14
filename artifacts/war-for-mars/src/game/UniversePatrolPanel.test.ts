import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import type { WorldPatrolDirectory, WorldLocation } from "@workspace/api-client-react";
import { UniversePatrolPanel } from "./UniversePatrolPanel";

const locations = [
  { id: "phobos-yard", name: "Phobos Yard" },
  { id: "rust-disc", name: "Rust Disc" },
] as WorldLocation[];

const directory: WorldPatrolDirectory = {
  generatedAt: new Date("2026-11-07T12:00:00.000Z"),
  currentLocationId: "phobos-yard",
  simulationLayer: "strategic",
  traffic: [{
    contactId: "patrol-contact-1",
    faction: "ussf",
    hullId: "glide",
    locationId: "phobos-yard",
    position: { x: 1, y: 2, z: -3 },
    velocity: { x: 0.1, y: 0, z: 0 },
    yaw: 0.2,
  }],
  patrols: [{
    id: "strategic-patrol-v1:phobos-yard:ussf:0",
    callsign: "USSF-3F21",
    faction: "ussf",
    objective: "route-security",
    locationId: "phobos-yard",
    route: ["phobos-yard", "rust-disc"],
    ships: [
      { id: "u-1", hullId: "duskbreaker", name: "Duskbreaker", callsign: "U-101" },
      { id: "u-2", hullId: "sentinel", name: "Sentinel-G", callsign: "U-102" },
    ],
    lastMovedAt: new Date("2026-11-07T11:58:00.000Z"),
  }],
};

test("patrol panel presents a server-reported fleet route without claiming live combat", () => {
  const html = renderToStaticMarkup(createElement(UniversePatrolPanel, {
    directory,
    currentLocationId: "phobos-yard",
    currentLocationName: "Phobos Yard",
    nearbyPilotCount: 2,
    pilotFaction: "accord",
    shipId: "mandjet",
    canLaunchEncounter: true,
    locations,
    loading: false,
    unavailable: false,
    onRetry: () => undefined,
  }));
  assert.match(html, /Patrol formations/);
  assert.match(html, /USSF-3F21/);
  assert.match(html, /Duskbreaker/);
  assert.match(html, /Phobos Yard → Rust Disc/);
  assert.match(html, /not live human matches/);
  assert.match(html, /button-intercept-universe-patrol/);
  assert.match(html, /mission=universe-patrol/);
  assert.match(html, /ORBITAL REGION TRAFFIC/);
  assert.match(html, /2 PILOTS IN REGION · ANONYMOUS COUNT/);
});

test("patrol panel does not show a stale region snapshot as current", () => {
  const html = renderToStaticMarkup(createElement(UniversePatrolPanel, {
    directory,
    currentLocationId: "rust-disc",
    currentLocationName: "Rust Disc",
    pilotFaction: "accord",
    shipId: "mandjet",
    canLaunchEncounter: true,
    locations,
    loading: false,
    unavailable: false,
    onRetry: () => undefined,
  }));
  assert.match(html, /Reacquiring the server-confirmed patrol picture/);
  assert.doesNotMatch(html, /USSF-3F21/);
});
