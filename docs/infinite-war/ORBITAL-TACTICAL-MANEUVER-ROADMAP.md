# Orbital Tactical Maneuver Roadmap

## Direction

Keep the existing two-thumb HUD. The left stick remains the Orbital flight and
vector-thrust surface. The right stick remains the aim surface and gains an
intentional circular gesture for a real evasive barrel roll. This should add
meaningful control without adding a permanent row of maneuver buttons or
changing the aim stick into an unpredictable gesture pad.

The user's full source documents and supplied roll illustration are retained at:

- [`references/ORBITAL-TACTICAL-FLIGHT-SYSTEM-SOURCE.txt`](references/ORBITAL-TACTICAL-FLIGHT-SYSTEM-SOURCE.txt)
- [`references/MOBILE-TACTICAL-CONTROLS-SOURCE.txt`](references/MOBILE-TACTICAL-CONTROLS-SOURCE.txt)
- [`references/barrel-roll-reference.jpeg`](references/barrel-roll-reference.jpeg)

## First implemented slice

Current status and the re-supplied owner directive are reviewed in
[ADVANCED-TACTICAL-CONTROLS-REVIEW.md](ADVANCED-TACTICAL-CONTROLS-REVIEW.md).
The direct live-arc behavior below supersedes the original queued full-loop
prototype; the verification history further below is historical, not a new
device certification.

- Only the offline unified Orbital right aim stick enables this gesture.
- Ordinary aiming begins immediately when the player starts dragging.
- A deliberate arc around the visible stick center arms direct roll after
  60 degrees plus sample/time gates. The tracing window is ten seconds from
  the first valid circular sample, not initial touch-down.
- Aim remains active while signed thumb motion controls roll immediately;
  clockwise rolls right and counterclockwise rolls left. Reversal changes
  direction and release stops control instead of queuing a later animation.
- The simulation rotates the ship's quaternion over time and applies a brief
  lateral thrust phase. This is movement, not a camera/model-only animation.
- Direct roll charges 18 energy per full turn, respects the existing energy and
  disruption rules, and adds bounded lateral thrust. The older queued intent
  retains an 18-energy upfront cost and 2.8-second cooldown; it is not the
  active circular-thumb default. Neither grants invulnerability.
- Opposite deliberate roll input can interrupt the active rotation.
- Gesture cancellation, focus loss, orientation change, and release neutralize
  touch input. The stick shows a compact progress ring and direction feedback.
- Sector and competitive adapters do not forward this local maneuver intent;
  co-op and live Wing retain their current authority and input contracts.

## Verification status

- Gesture recognition: unit-tested for both directions, incomplete/undersized/
  oversized circles, reversals, discontinuous samples, timeouts, and non-finite
  samples.
- Simulation: unit-tested for quaternion rotation, changed trajectory, energy
  cost, cooldown, insufficient energy, and ignoring a second command while active.
- Input boundary: unit-tested for one-shot offline consumption and omission from
  the server-authoritative sector adapter.
- On 2026-11-05, the user supplied a 60-second development-preview frame sample
  at 803×360 CSS pixels and DPR 3: 76 average FPS, 17 ms p95 and 25 ms p99
  intervals, 2 of 4,552 frames over 50 ms, and no gaps over 250 ms. This is
  requestAnimationFrame cadence, not GPU timing or Production evidence.
- The user reported that the first hold-then-circle implementation did not
  trigger. Browser testing found the direct-circle recognizer was centered on
  the initial touch point, which did not match a thumb circling the stick. It is
  now anchored to the visible stick center with a slower three-second gesture
  window. A landscape browser interaction test then recognized a clockwise loop,
  displayed “ROLL RIGHT,” and recentered aim on release. This is browser input
  emulation, not physical Android certification; retest the revised gesture on
  the phone.

## Next stages

1. Verify the direct-circle gesture, simultaneous left-stick flight and fire, and
   abort behavior on Android in landscape.
2. Add a right-stick directional evasive gesture only after testing that it does
   not interfere with ordinary aiming.
3. Add additional maneuvers and any online support only through a new,
   versioned contract with server-side cost, cooldown, eligibility, and replay
   validation. Never infer missile immunity from a roll.
