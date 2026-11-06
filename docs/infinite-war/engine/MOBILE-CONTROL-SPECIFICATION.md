# Mobile control consolidation specification

## Product requirements

Phone-first, landscape gameplay; two thumb sticks, not three. Keep stick sides
and sizes stable. Lock/target selection stays near the left thumb; missiles and
fire stay on the right; boost sits above fire. Keep settings and operation prose
outside the active sightline. Touch zones must not overlap or cause accidental
fire during maneuvering. Release, pointer cancellation, lost focus and
backgrounding must clear transient input.

The left stick is the primary signed-throttle/steering control in the new
Orbital pilot layout. Vertical translation is distinct from ordinary forward
thrust. The right stick combines aim and bounded live circular-roll intent.
Energy-limited boost is not a universe warp feature. Tactical roll must not
grant invulnerability or guaranteed missile escape.

## Source-backed current state

- `PilotFlightStick.tsx` is reused by Arena and Rust Disc.
- `pilot-stick-gestures.ts` and `pilot-circular-gesture.ts` recognize bounded
  gestures; `input.ts` maps Arena device state to shared pilot intent.
- `RustDiscFlight.tsx` still owns its `TouchControls` wrapper and throttle/aim
  composition. This is not identical to Arena's signed left-stick throttle.
- Both now consume the engine-owned frame/adapters. Sharing the data contract
  is **not** a claim of identical interaction behavior.
- Sector adapters intentionally strip local tactical maneuver intents. Live Wing
  retains its established input contract.
- Throttle feedback, lock, weapons, countermeasures, camera, map and pause
  controls exist, but complete cross-mode placement/gesture parity remains open.

## Configuration target, not completion claim

One device-local layout/sensitivity/dead-zone layer should generate the same
engine frame for keyboard, controller, touch and optional gyro. Account-scoped
control scheme and device-local gyro must keep their existing persistence
boundary. Do not invent a second preferences store.

Before changing feel, record per-axis sign, range, dead zone, sensitivity,
release behavior, aim/flight composition and interruption behavior for both
source experiences. Then approve explicit differences rather than silently
overwriting the source trainer.

## Required device acceptance

Test forward/reverse, diagonal thrust/turning, vertical pulse, sustained edge
input, live partial/full circular roll, simultaneous fire/aim, lock/missile,
boost exhaustion, brake/drift override and pointer cancellation. Repeat in
landscape after rotation and app restore. Capture input traces and actual ship
responses; a visible thumb indicator is insufficient. No new Android acceptance
is claimed in this slice.
