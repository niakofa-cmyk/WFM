# Advanced tactical controls — redesign source and implementation review

## Source preservation and precedence

Both owner uploads were read and compared. They are byte-identical to each
other and to the previously archived tactical-flight directive. Preserve their
originals without creating a second control implementation:

- [First new upload](references/redesign/ADVANCED-TACTICAL-FLIGHT-DIRECTIVE-SOURCE.txt)
- [Second new upload](references/redesign/ADVANCED-TACTICAL-FLIGHT-DIRECTIVE-DUPLICATE-SOURCE.txt)
- [Previously saved source](references/ORBITAL-TACTICAL-FLIGHT-SYSTEM-SOURCE.txt)

Apply this directive to the connected-universe redesign: two thumbs, actual
simulation response, compact feedback, bounded input, accessible defaults and
separately certified multiplayer authority. It does not replace the saved
Infinite Open Universe architecture or authorize a separate flight loop.

The source proposes evaluating a completed 300–360-degree gesture. The owner's
subsequent hands-on corrections established direct, immediate roll while tracing
an arc, reversible with the thumb and stopped on release. Preserve that working
default and established left-stick forward/reverse throttle. A configurable,
completed-circle profile and left-pitch alternative require separate deliberate
design/validation; this repeated source is not evidence that either is already
implemented or authorization to silently revert working controls.

## Focused source inventory

Audit base: `06c4e21`, branch `design/orbital-universe-entry`. This is a focused
control-path review, not a claim that all modes or every renderer were
re-audited end to end.

| Surface/system | Actual current path and behavior |
|---|---|
| Left thumb in offline Orbital | `PilotFlightStick.tsx` → `input.ts`: signed throttle from vertical drag, yaw and coordinated bank from horizontal drag; same-edge double taps produce vertical/lateral vector pulses |
| Right thumb in offline Orbital | `PilotFlightStick.tsx` → `pilot-circular-gesture.ts` → `setCircularRollControl` → shared pilot adapter: ordinary yaw/pitch plus deliberate signed circular roll |
| Gesture recognition | Stick-center-relative radius limits, accumulated angular samples, direction/reversal, duration limits and coalesced pointer samples; direct roll arms after 60 degrees and minimum sample/time gates |
| Pointer lifecycle | Pointer capture, release, cancel, lost capture, blur, orientation and visibility reset paths in `PilotFlightStick.tsx`; cancellation must clear both control and displayed feedback |
| Intent and physics | `flight-control.ts` reexports `lib/orbital-sim/src/pilot-controls.ts`; `flight.ts` accepts typed version-1 queued/direct roll intents, rotates the quaternion and applies energy/trajectory changes |
| Ship handling | Shared flight rate derives from ship turn rate/handling; thrust uses acceleration, hull condition and boost. This is not a full separate mass/inertia/heat maneuver-profile library |
| Combat controls | `Arena.tsx` wires right-side missiles, fire, boost, tactical drawer and separate training flare; only target lock remains by the left stick |
| Countermeasure path | Input pulse → existing simulation/missile rules → hull-positioned flare event/effect; a roll does not grant invulnerability or replace a countermeasure |
| Settings | Existing scheme/gyro/assist paths are not the requested complete tactical sensitivity, capture, tolerance, placement, feedback and camera preference system |

### Mode/authority inventory

| Mode | Current ownership and migration boundary |
|---|---|
| Orbital Combat Lab | Local, no rewards; `Arena` selects canonical Orbital rules and enables the direct circular input |
| Solo Flight | Local no-reward Orbital rules via `SoloFlight`/`Arena`; not a second newly added maneuver engine |
| Contact campaign | Versioned Orbital campaign/replay path; training-only countermeasures are omitted. No campaign reward or replay contract changed here |
| Rust Disc / Iron Eclipse presentation | `RustDiscFlight` retains its separate presentation/sector input mapping, including separate throttle. Do not claim left-stick mapping is identical to Orbital |
| Sector co-op | Server-owned sector contracts/adapters and guarded Orbital rollout remain; local maneuver intent is not silently forwarded |
| Live Wing / competitive / private / AI-fill | Existing room/socket authority and mappings remain; this patch does not enable gesture maneuvers online or change reward eligibility |
| Other campaigns/arcade/universe destinations | Follow the existing mode inventory and migration gates in `INFINITE-UNIVERSE-ORBITAL-RUNTIME-DIRECTION.md`; no blanket parity certification from this input patch |

No permanent maneuver-button row or third joystick is added. Existing drawer
actions are wired through input; the proposed Split-S/Immelmann/combined maneuver
library is not secretly represented by new decorative icons.

## Safety implementation in this change

1. Keep continuous roll on a finite 120 ms renewable input lease. Reject
   non-finite/negative clocks, non-finite/non-positive holds and non-finite
   magnitude. Clamp oversized finite holds; a caller cannot create an infinite
   roll by passing an infinite duration.
2. Clear prior roll state when the mode no longer supports it. Drop malformed
   bus deadlines and backward-clock samples instead of reviving stale input.
3. On pointer cancellation/lost capture, stop roll/aim, clear pending gesture,
   progress/“LIVE” feedback and vector marker immediately, preserving the
   existing short double-tap cooldown.

These are input/lifecycle protections, not new physics or an online protocol.
No renderer, simulation rule, cooldown/energy equation, auth, economy, replay
version, room admission or deployment is changed.

## Requirement and phase status

These statuses separate existing source-backed capability from the full
directive's remaining scope. No new physical-device demonstration is claimed.

| Source section / phase | Status and evidence/remaining scope |
|---|---|
| 1 / A — Audit foundation | PARTIALLY IMPLEMENTED: focused inventory above; existing full-game migration inventory retained, not re-certified |
| 2 — Two-thumb philosophy | IMPLEMENTED AND VERIFIED at mapping/unit-test level; preserved working left throttle/right aim and distinct mode adapters |
| 3 / B — Circular recognizer | PARTIALLY IMPLEMENTED: tested direct-arc recognizer exists; selectable full-circle completion/capture/tolerance profile is NOT IMPLEMENTED |
| C — Stick integration | IMPLEMENTED BUT NOT VERIFIED on a physical device for this revision; current UI wiring and lifecycle fix source-inspected |
| 4 / D — Roll execution | PARTIALLY IMPLEMENTED: quaternion roll, ship-scaled rates and energy exist; full independent angular-velocity/acceleration/recovery controller is not established |
| 5 / F — Maneuver library | PARTIALLY IMPLEMENTED: two typed roll intents and existing vector pulses, not the complete rotational/evasive/advanced registry; Split-S, Immelmann and configurable compound profiles NOT IMPLEMENTED |
| 6 — Reusable execution contract | PARTIALLY IMPLEMENTED: shared typed intent pipeline exists; complete maneuver definitions with heat, equipment, compatibility and competitive policy are NOT IMPLEMENTED |
| 7 / E — Real evasive trajectory | PARTIALLY IMPLEMENTED: existing lateral roll thrust and vertical/lateral pulses; obstacle/projectile-aware full combat demonstrations remain unverified |
| 8 / G — Countermeasures | PARTIALLY IMPLEMENTED: existing separate local-training flare/missile path; comprehensive inventory/chaff/decoy/ECM library and competitive validation are NOT IMPLEMENTED |
| 9 / H — Ship differences | PARTIALLY IMPLEMENTED: rate/acceleration/condition/energy affect flight; full maneuver-specific mass/inertia/heat/equipment profiles remain missing |
| 10 — Compact feedback | PARTIALLY IMPLEMENTED: existing progress/direction/release, threat and energy cues; cancellation feedback corrected, new DOM-interaction/device evidence not captured here |
| 11 / H — Tactical settings | PARTIALLY IMPLEMENTED: existing general controls/gyro/assists; unified advanced tactical preferences and persistence contract are NOT IMPLEMENTED |
| 12 / I — Typed shared input | PARTIALLY IMPLEMENTED: shared normalization/adapters and bounded roll lease; complete library, sequencing and online validation remain absent |
| 13 / K — Multiplayer safeguards | IMPLEMENTED AND VERIFIED for preserving omission/authority boundaries in existing tests; new online maneuver eligibility, duplicate/reconnect/parity acceptance BLOCKED until versioned server contract and staging evidence |
| 14 / J — Mobile lifecycle | PARTIALLY IMPLEMENTED: reset handlers and new safety guards; real landscape interruption/background/orientation demonstration remains BLOCKED on device evidence |
| 15 — Automated tests | PARTIALLY IMPLEMENTED: gesture/input/shared flight/combat coverage exists and lease regressions added; this is not the complete listed combined-combat/multiplayer matrix |
| 16 — Staged rollout | PARTIALLY IMPLEMENTED: source audit plus bounded safety changes; remaining phases are not marked complete |
| 17 — Twelve playable demonstrations | BLOCKED as a complete acceptance set: no new physical-device gameplay capture or full combined-combat demonstration in this change |
| 18 — Overall acceptance | PARTIALLY IMPLEMENTED; complete tactical system, full mobile demonstration and multiplayer migration are not certified |

## Verification and next implementation order

- Run WFM typecheck, game/auth tests and both builds/static checks for this change.
  Record final results in `REDESIGN-IMPLEMENTATION-REPORT.md`.
- Input regressions exercise invalid numbers, oversized holds, exact expiry,
  malformed bus state, backward clocks and mode changes.
- Existing gesture tests cover clockwise/counterclockwise live arcs, ordinary
  aim rejection, radius tolerance, reversals and timeouts; existing combat tests
  cover roll execution and missile/flare behavior. Passing them is not visual,
  collision-avoidance, networking or physical-device proof.
- Next establish opt-in tactical preference semantics and a shared typed
  maneuver-definition/controller contract. Validate each compound profile
  against real spatial collision/combat rules before exposing it.
- Add no live Wing capability until bounded intent, sequencing, energy/cooldown,
  ship limits, reconnect and deterministic server parity are proven separately.
