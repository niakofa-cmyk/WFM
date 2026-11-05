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

- Only the offline unified Orbital right aim stick enables this gesture.
- Ordinary aiming begins immediately when the player starts dragging.
- A stationary hold of about 180 ms arms a temporary circle-capture mode.
- A smooth 300–360 degree circle issues one typed, versioned barrel-roll intent;
  clockwise requests a right roll and counterclockwise a left roll.
- The simulation rotates the ship's quaternion over time and applies a brief
  lateral thrust phase. This is movement, not a camera/model-only animation.
- The roll costs 18 energy, has a 2.8-second cooldown, is rejected when energy
  is insufficient or the craft is disrupted, and grants no invulnerability.
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
- Physical Android gesture feel and frame pacing: not yet verified on-device.

## Next stages

1. Verify the hold-circle gesture, simultaneous left-stick flight and fire, and
   abort behavior on an Android phone in landscape.
2. Add a right-stick directional evasive gesture only after testing that it does
   not interfere with ordinary aiming.
3. Add additional maneuvers and any online support only through a new,
   versioned contract with server-side cost, cooldown, eligibility, and replay
   validation. Never infer missile immunity from a roll.
