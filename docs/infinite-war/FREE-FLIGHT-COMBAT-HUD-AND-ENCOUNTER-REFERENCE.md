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

- The Combat Lab remains a local compatibility trainer and fallback. Its control
  feel is carried into shared flight through the Orbital simulation contract,
  not by moving pilots into a second training universe. The shared server uses
  `integrateSpatialFlight`, the Orbital primary/missile projectile functions,
  server-side missile guidance, swept collision, and shield/hull damage from
  `@workspace/orbital-sim`.
- `Arena` renders actors from a fresh authenticated shared-flight snapshot as
  individual Three.js ship models. Opposing patrols also receive a small
  faction-colored world-space designation. REST/local patrol projections stay
  visual-only and never authorize engagement or rewards.
- The server resolves every persistent patrol at the authenticated saved
  location. Closing to 180 m starts a server-reserved encounter in the current
  flight scene; it does not teleport the pilot or redirect the camera. The live
  flight step has no combat arena boundary.
- While an encounter is active, a second persistent opposing patrol within the
  520 m sensor range can detect weapons fire or damage and join as a separately
  reserved encounter. Up to three patrol encounters may be live at once. Each
  patrol keeps its own idempotent casualty/reward settlement contract; results
  for one fleet do not stop controls against another fleet.
- This is the first bounded escalation rule, not the full faction-intelligence
  model. Reputation, transponder choice, territory ownership, sensor occlusion,
  fleet-wide command tactics, and spatial-shard handoff are not yet simulated.
- The client samples movement controls at 20 Hz, below the server's 35-message
  per-second limit, and preserves short primary-fire and missile taps between
  samples. A rate-limit transport error is not presented as a combat state.
- Active flight keeps the target designation, range, conditional in-range
  integrity bars, and a gated engage action. Empty station/event cards and
  extended docking telemetry are hidden from the sightline; full station,
  training, and debrief controls remain available when appropriate.

### Review hardening

- A never-damaged patrol's sentinel timestamp is not a hostile signal.
- Projectile collision and damage both require the shooter and victim to share
  the same active reserved encounter. Bystanders and unrelated patrol contracts
  cannot take damage or supply unattributed kills.
- Settlement sends combat state only to the affected participants, computed per
  pilot. Finishing one patrol must not stop another pilot's unrelated fight.
- After an asynchronous reservation, the server rechecks the seat, connection,
  live actors, session and approach range. Interrupted reservations are released
  without starting a battle or paying rewards.
- A changed reserved fleet roster fails closed and releases the reservation.
  Automatically refreshing those stale visible actors remains follow-up work.
- Regression checks cover these damage permissions, an untouched reinforcement,
  disconnect during reservation, and accepted weapons input after the first
  fleet settles while another fleet remains active.

This describes implemented local source behavior, not a staging or Production
verification. The existing test exercises persistent reservations, real
server-fired projectiles, hull impacts, kill attribution, settlement, and a
reinforcement joining the same shared flight. That test does not prove that
Railway's staging feature gates, Clerk sessions, or two physical devices work.
The server still shards by a coarse saved destination; it does not yet stream
actors across a continuous spatial-cell network.

## Remaining verification gates

1. On staging, prove that an authenticated session receives multiple persistent
   opposing patrols and that they move as 3D actors in successive snapshots.
2. Verify automatic close-range engagement and a weapons-triggered second-fleet
   response, including kill/assist attribution and idempotent settlement.
3. Repeat as USSF and Accord with two devices, disconnect/rejoin, and the local
   no-reward trainer; verify that a result for one patrol does not interrupt the
   remaining battle.
4. Profile both supported renderers and supported physical mobile devices before
   making performance or device-compatibility claims.

See also:
[live patrols and pilot presence](LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md)
and [the server encounter contract](PRIMARY-ORBITAL-BOOT-AND-ENCOUNTER-CONTRACT.md).
