# Free-flight combat HUD and encounter reference

## Saved visual reference

The user-provided screenshot is preserved at
[`references/free-flight-combat-hud-reference-2026-11-08.jpg`](references/free-flight-combat-hud-reference-2026-11-08.jpg).
It shows a landscape Orbital flight combat view with:

- a live enemy contact card naming faction and ship, showing range, shield and
  hull integrity;
- a centered flight reticle, visible 3D spacecraft, Mars and asteroid traffic;
- two-thumb flight controls, combat actions, camera and pause controls; and
- compact high-contrast HUD placement that keeps the flight view primary.

Use this as a functional layout reference, not as evidence that the pictured
screen is currently the shared-universe runtime.

## Direction

Combat training is a source of proven HUD and control behavior, not a separate
universe entry point. Patrol detection and battle discovery belong inside
Orbital free flight. Keep the local compatibility trainer available for
regression and fallback checks, but do not route a pilot through it to reach the
persistent universe.

Values shown for a live patrol must come from the authenticated, server-owned
free-flight snapshot. Client estimates may guide presentation but cannot
authorize damage, kill credit, faction outcomes, or rewards. The current patrol
intercept request remains subject to the server's approach and combat gates.

## Current implementation and limits — 2026-11-08

- The shared-flight server runtime contains the authoritative patrol-engagement,
  projectile, collision, shield/hull damage, kill/assist attribution, and result
  settlement path. Persistent-patrol reservations and settlement adapters must
  be present for a patrol result to be eligible; source code alone does not
  prove that the deployed environment has those adapters or feature gates.
- `Arena` renders actors from a fresh authenticated shared-flight snapshot as
  individual Three.js ship models. Opposing patrols also receive a small
  faction-colored world-space designation. REST/local patrol projections stay
  visual-only and never authorize engagement or rewards.
- A patrol can be engaged from the active flight scene only when the pilot is
  joined to the shared socket and the current server snapshot marks the patrol
  engageable. The flight HUD does not send the pilot into the separate
  `universe-patrol` sector runtime.
- The client samples movement controls at 20 Hz, below the server's 35-message
  per-second limit, and preserves short primary-fire and missile taps between
  samples. A rate-limit transport error is not presented as a combat state.
- Active flight keeps the target designation, range, conditional in-range
  integrity bars, and a gated engage action. Empty station/event cards and
  extended docking telemetry are hidden from the sightline; full station,
  training, and debrief controls remain available when appropriate.

This describes implemented source behavior, not a staging or Production
verification. The attached screenshot showed the earlier oversized local/offline
cards and a `FREEFLIGHT_RATE_LIMITED` status, so it did not prove live fleet
combat. A signed-in shared session, persistent patrol reservation, server
settlement configuration, and a multi-device check are still required before
claiming that a deployed encounter has been verified.

## Remaining verification gates

1. On staging, confirm the authenticated shared socket returns actual opposing
   patrol actors and that their 3D models move with successive server snapshots.
2. Engage a persistent patrol from the same flight scene; verify server-owned
   impacts, shield/hull changes, kill/assist attribution, and eligible reward
   settlement without leaving the universe.
3. Repeat as USSF and Accord, then test two devices, reconnect, duplicate
   settlement, and a local no-reward preview.
4. Verify both supported renderers and supported physical mobile devices before
   making performance or device-compatibility claims.

See also:
[live patrols and pilot presence](LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md)
and [the server encounter contract](PRIMARY-ORBITAL-BOOT-AND-ENCOUNTER-CONTRACT.md).
