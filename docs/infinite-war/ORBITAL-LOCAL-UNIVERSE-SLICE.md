# First playable local Orbital universe slice

## Scope

The first runtime rebuild increment executes exploration, docking, training and
return inside the existing Orbital `Arena` instance. It is not another
Three.js universe application or a link-only chart redesign.

This is a **bounded, offline, no-reward, session-only sector**, not persistent
or shared multiplayer space. Current Wing/co-op services and saved locations
remain unchanged. It does not complete all-mode migration.

## Player path

1. A signed-in pilot starts **FLY THE MARS SECTOR · LOCAL** from the existing
   Home screen. This enters the same `WarApp`/`Arena` tree and uses the saved
   faction, hull, control scheme, gyro preference and refit level.
2. A public/standalone pilot can still open `/combat-lab.html?universe=1`;
   that route remains an offline fallback and does not read or overwrite the
   account loadout.
3. Fly forward toward the physical Cinder ring, initially 118 m ahead.
4. Enter the 8 m local gate, slow to at most 3.5 m/s and align within 35°.
   **DOCK** additionally requires a functioning renderer.
5. From the station, launch the existing three-defender combat training.
6. Finish or abort; the local debrief returns to Cinder.
7. Undock from the retained universe position, orientation and velocity.

The signed-in dock opens the existing account universe/operation screen above
the local flight and pauses that flight. Closing the account screen returns to
the same local position without publishing a presence heartbeat for that local
position. Operation entry leaves the local scene only after its existing server
registration authorizes an assignment. The standalone route remains an external
handoff. Docking itself never changes server location, eligibility, room seat,
currency or rewards.

Exiting the signed-in local flight returns to Home/Hangar; the account's saved
profile is neither modified nor awarded progress. Closing or reloading the page
loses the local session.

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
| Nearby competition signal | `CinderRingOperationPreview`, public directory + SSE only |
| Account operations | Existing `GalaxyScreen` and server registration authorization |
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

Near Cinder, the preview shows only server-reported active public instances
whose event and operation locations resolve to the Cinder asteroid. Snapshots
older than two minutes are not presented as live. The preview shows no player
identities and cannot create, join or reward a match.

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
- Project-side Playwright Chromium with software WebGL loaded the actual
  universe scene and accepted a physical pointer drag on the left flight stick;
  simulation position advanced. The focused browser check is scoped to local
  launch and stick movement, not the signed-in `WarApp` screen.
- A longer approach experiment moved toward Cinder but did **not** satisfy the
  full docking gate (8 m and at most 3.5 m/s). Therefore browser-certified
  docking, training, return, undock and resource identity are **not established**.
- The live-event selector has regression coverage for Cinder locality, active
  phase, public visibility and snapshot freshness. This does not prove a live
  production event is currently present.
- No live API requests were made during the isolated public local-flight check.

Repeated transition unit tests and a short pointer-driven browser check do not
prove full browser frame-loop/resource behavior. Signed-in entry and the
overlaid server operation flow were not tested through an authenticated
session. Physical Android flight, interactive
finish/abort/return, full docking usability and runtime leak checks remain
verification gaps. No staging/Production rollout or multiplayer parity is
claimed.

## Next boundary

Validate docking and the repeated activity-return loop on a real phone, including
saved-profile entry and return. Then integrate the existing authoritative
discovery, travel and operation-admission contracts through explicit adapters.
Streaming, shared flight, anomalies and live competition observation require
separate implementation and evidence.
