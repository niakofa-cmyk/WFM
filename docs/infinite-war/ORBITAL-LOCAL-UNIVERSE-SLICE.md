# First playable local Orbital universe slice

## Scope

The first runtime rebuild increment executes exploration, docking, training and
return inside the existing Orbital `Arena` instance. It is not another
Three.js universe application or a link-only chart redesign.

This is a **bounded, offline, no-reward, session-only sector**, not persistent
or shared multiplayer space. Current Wing/co-op services and saved locations
remain unchanged. It does not complete all-mode migration.

## Player path

1. Main landing/Home: **FLY THE MARS SECTOR · LOCAL**, or open
   `/combat-lab.html?universe=1`.
2. Fly forward toward the physical Cinder ring, initially 118 m ahead.
   The entry chart also offers **FLY LOCAL MARS SECTOR** with its selected
   local faction and hull. Direct entry uses the local default hull; it does
   not read or overwrite the account loadout.
3. Enter the 8 m local gate, slow to at most 3.5 m/s and align within 35°.
   **DOCK** additionally requires a functioning renderer.
4. From the station, launch the existing three-defender combat training.
5. Finish or abort; the local debrief returns to Cinder.
6. Undock from the retained universe position, orientation and velocity.

Account services are clearly marked **external**. Following that link leaves
the local session. Docking does not grant server location, eligibility, a room
seat, currency or rewards. Closing/reloading the page loses this unsaved session.

## Runtime ownership and isolation

| Responsibility | Actual owner |
|---|---|
| Mode/authority contract | `orbital-universe-local` in shared `GameModeDefinition` |
| Active scene, renderer, input bus, camera, fixed-step animation driver | Existing `Arena` |
| Exploration flight | Shared `normalizeFlightControls` / `integrateSpatialFlight` |
| Exploration bounds | Explicit 200 m local radius and Mars collision sphere |
| Station gate and retained pose | Pure `orbital-universe-session.ts` helpers |
| Training | Existing prepared Orbital match and normal `step` rules |
| Panels | `UniverseStationOverlay`, no simulation or renderer |
| Return | Reset activity match in place and restore a deep-copied flight pose |

Training is a subordinate activity. Enter/exit transitions neither remount the
Arena nor create another renderer. Dock and debrief freeze simulation; input
and direct-roll state clear at transitions. Local exploration suppresses
training AI, timer, weapon controls, enemy indicators and training rock meshes.
Boost/brake, signed left-thumb throttle, right-thumb aim/direct roll and the
movement-dependent throttle display remain available.

The local universe rejects live-room/campaign/endurance combinations. Existing
non-universe callers, combat replays, network protocols and reward gates retain
their previous paths. Training consumes its isolated match resources; returning
restores the retained exploration flight state rather than copying combat
damage or ammunition into a saved account.

## Verification

### Runtime integration follow-through

`orbital-universe-runtime.ts` now owns the activity transition side effects
that Arena actually calls. It does not create a renderer, network connection or
animation driver. The dock command recomputes eligibility from the current
simulation instead of accepting a caller-supplied pose or stale eligibility.
The completion command requires a genuinely ended training match and derives
the debrief from its actual outcome and kill count.

Eight additional integration regressions exercise that production code:

- Remote, stale-speed and renderer-unavailable docking rejection.
- Canonical exploration flight without clock, AI or weapon side effects.
- Frozen station/debrief flight and resource state.
- Rejection of completion before the match ends.
- A real primary-projectile win against stationary low-integrity fixtures.
- An actual normal-rule timeout and a damage-produced destroyed-hull loss.
- Exact exploration resource/velocity restoration and subsequent undock motion.
- Twelve repeated training/abort cycles retaining match identity and a pristine
  training template.

All **300 game/auth tests** and WFM type checking pass. These are simulation
integration tests, not browser or live-multiplayer evidence.

One targeted follow-up browser attempt used genuine Chromium software-WebGL
flags, without mocking the renderer or injecting game state. That browser still
reported its graphics renderer disabled and failed context creation. It stopped
without flight input. No complete interactive loop, renderer-resource retention,
API-write audit, physical Android or multiplayer certification is established.

### Initial slice checks

- Shared library build and WFM type check passed.
- 292 game/auth tests passed, including ten new local-universe regressions:
  contract ownership, physical gate, invalid telemetry, renderer prerequisite,
  independent pose copies, repeated transitions, invalid phase rejection,
  actual signed translation/direct roll and source-level single-renderer wiring.
- Main and standalone Lab production builds passed; all four static/lazy-load
  build checks passed.
- Development workflow restarted cleanly.
- A landscape 803×360 screenshot rendered the actual Mars/Cinder scene and
  controls. Software-WebGL warnings were present; this is not performance proof.
- A focused automated browser journey could not create a WebGL context in its
  separate browser and stopped on the explicit **RENDERER UNAVAILABLE** screen.
  It did not exercise docking, training, return, undock or resource identity.
  Full interactive end-to-end certification is therefore **not established**.

Repeated transition unit tests and a source-level renderer check do not prove
browser frame-loop/resource behavior. Physical Android flight, interactive
finish/abort/return, full docking usability and runtime leak checks remain
verification gaps. No staging/Production rollout or multiplayer parity is claimed.

## Next boundary

Validate the physical approach and repeated activity-return loop on a
WebGL-capable browser/device before promoting this slice as the primary,
account-connected game. Then integrate the existing authoritative discovery,
travel and operation admission contracts through explicit adapters. Streaming,
shared flight, anomalies and live competition observation require separate
implementation and evidence.
