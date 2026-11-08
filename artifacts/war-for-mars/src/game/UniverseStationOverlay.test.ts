import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { createUniverseSession } from "./orbital-universe-session";
import { UniverseStationOverlay } from "./UniverseStationOverlay";

const baseProps = {
  dock: null,
  anomalyScan: null,
  relayInteraction: null,
  onScanAnomaly: () => undefined,
  onScanRelay: () => undefined,
  onRecoverRelay: () => undefined,
  rendererReady: true,
  graphicsError: null,
  servicesHref: "/services",
  onDock: () => undefined,
  onUndock: () => undefined,
  onLaunchTraining: () => undefined,
  onAbortTraining: () => undefined,
  onReturn: () => undefined,
  onExit: () => undefined,
};

test("relay recovery requires a separate scan and makes its local-only status visible", () => {
  const session = createUniverseSession();
  const scanned = renderToStaticMarkup(createElement(UniverseStationOverlay, {
    ...baseProps,
    session,
    relayInteraction: {
      id: "rust-disc-relay-record",
      label: "RUST DISC · RECOVERED TRANSMISSION",
      distance: 12,
      speed: 0.2,
      scanned: true,
      recovered: false,
      ready: true,
      canScan: false,
      canRecover: true,
    },
  }));
  assert.match(scanned, /SIGNAL DECODED · RECOVERY WINDOW OPEN/);
  assert.match(scanned, /button-universe-recover-rust-relay/);
  assert.match(scanned, /LOCAL ONLY · NO REWARDS OR ACCOUNT EVIDENCE/);

  const recovered = renderToStaticMarkup(createElement(UniverseStationOverlay, {
    ...baseProps,
    session: { ...session, rustRelayScanned: true, rustRelayRecovered: true },
    relayInteraction: {
      id: "rust-disc-relay-record",
      label: "RUST DISC · RECOVERED TRANSMISSION",
      distance: 12,
      speed: 0.2,
      scanned: true,
      recovered: true,
      ready: true,
      canScan: false,
      canRecover: false,
    },
  }));
  assert.match(recovered, /status-rust-relay-recovered/);
  assert.match(recovered, /NOT SYNCED/);
  assert.doesNotMatch(recovered, /button-universe-recover-rust-relay/);
});

test("night-side docking gets its own local station panel without Cinder-only operations", () => {
  const session = {
    ...createUniverseSession(),
    phase: "docked" as const,
    dockedAt: "mars-night-side-station" as const,
  };
  const html = renderToStaticMarkup(createElement(UniverseStationOverlay, {
    ...baseProps,
    session,
  }));
  assert.match(html, /DOCKED · MARS NIGHT-SIDE STATION/);
  assert.match(html, /button-universe-undock/);
  assert.match(html, /does not update account location/);
  assert.doesNotMatch(html, /button-universe-launch-training/);
  assert.doesNotMatch(html, /OPEN ACCOUNT OPERATIONS/);
});

test("open flight hides empty station and event panels to keep the sightline clear", () => {
  const html = renderToStaticMarkup(createElement(UniverseStationOverlay, {
    ...baseProps,
    session: createUniverseSession(),
  }));
  assert.match(html, /universe-exploration-hud/);
  assert.doesNotMatch(html, /FRONTIER SECTOR|text-universe-scope|button-universe-dock/);
  assert.doesNotMatch(html, /No active public matches reported here/);
});
