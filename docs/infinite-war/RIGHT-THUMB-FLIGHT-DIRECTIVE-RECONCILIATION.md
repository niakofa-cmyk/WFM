# Advanced right-thumb flight directive — current implementation

The complete owner-supplied document is retained verbatim in
`references/ADVANCED-RIGHT-THUMB-FLIGHT-2026-11-11.source.txt`.
It combines a flight-control proposal with historical infrastructure and combat
reviews, and ends partway through a proposed kill-energy table. Repository and
deployment claims in that upload are historical assertions, not current proof.

## Direction preserved

- One continuous Orbital universe with Three.js as the primary renderer.
- Left thumb: propulsion and coordinated steering. Right thumb: configurable
  Hybrid attitude-plus-translation, Vector heading-stable translation, or Aim only.
- Cardinal and normalized diagonal hull movement; dedicated firing and targeting
  remain independent of right-thumb movement.
- Deliberate eight-direction bursts use existing energy, duration and recovery
  limits. No teleporting, hit immunity or client-owned online maneuver timing.
- Retain direct circular roll where supported; do not silently forward local roll
  into Wing or other protocols that do not negotiate that capability.

## Improvements from this review

The shared movement, profiles, eight-way bursts and server capability path already
exist. This update strengthens their touch-input boundary rather than introducing
another movement engine:

1. Complete taps and flicks use the same pointer-event clock as touch-down.
   Wall-clock adjustments cannot turn a held aiming drag into a quick gesture.
2. A flick qualifies only when release remains at least 80% of its peak outward
   displacement and crosses the directional threshold. Dragging out and returning
   toward center clears pending boost pairing instead of triggering an accident.
3. Release direction determines a flick's eight-way intent; ordinary edge taps
   remain available. Two matching gestures are still necessary.
4. Blur, hidden-page, rotation, disable/profile changes and unmount neutralize
   input and release captured pointers. Simulation energy/cooldown enforcement
   remains unchanged.

## Verification and remaining boundaries

Deterministic tests cover eight-way movement, held fire, diagonal strength,
energy/cooldown, physical displacement, profile compatibility and gesture rejection.
These checks do not establish missile-avoidance percentages or physical-device
comfort. Android landscape simultaneous-touch, interruption and reconnect checks
remain necessary. Existing headless browser WebGL limitations are not device
certification.

Do not adopt the upload's old rules-version suggestion mechanically: historical
replays and live network compatibility must be preserved. Do not provision Redis,
alter production, change reward amounts or create a separate training universe
as a side effect of a flight-control review.
