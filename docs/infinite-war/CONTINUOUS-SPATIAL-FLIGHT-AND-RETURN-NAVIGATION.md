# Continuous spatial flight and return navigation

## Owner direction · 2026-11-08

Continuous exploration must not redirect the ship or swing/reframe the camera at
sector edges. Keep the camera anchored to the pilot in a relative local frame,
preserve world position while local coordinates are rebased, and let pilots
physically fly back toward their deployment point. Provide lightweight distance,
direction, and sector awareness without restoring the large information panels
removed from the flight view.

The two source documents are retained verbatim:

- [`wfm-continuous-space-flight-direction.txt`](../references/wfm-continuous-space-flight-direction.txt)
- [`wfm-deep-space-radiation-waypoint-compass.txt`](../references/wfm-deep-space-radiation-waypoint-compass.txt)

## Repository findings

- The active streamed universe already uses arbitrary-precision sector
  addresses serialized as decimal strings, bounded local coordinates, and
  deterministic sector contents. The active sector edge is 512 m. Crossing a
  boundary changes the local coordinates and sector address while preserving
  the same world position.
- The generic `OrbitalWorldPosition` helper in `lib/orbital-sim` uses 4,096 m
  chunks and safe-integer numeric chunk coordinates. It is a separate primitive
  and is not the active local-universe coordinate owner.
- Before this change, the local ship was rebased but the camera remained in its
  previous local frame. The smoothed follow camera could therefore travel
  across the frame shift and appear to swing at a sector crossing. There is no
  intentional edge-of-screen redirect or world-loop handler.
- The renderer uses the camera's ship-relative pose for ordinary flight and
  maneuvers. Keep that natural tracking; the continuity fix applies to
  coordinate-frame changes, not to input-driven turns or rolls.
- The shared free-flight wire contract does not yet carry persistent sector
  addresses. The client-side deployment anchor therefore improves navigation
  in the mounted Orbital universe session; it does not create account-persistent
  or server-authoritative long-range location.

## Implemented slice

1. **Keep camera and pilot in the same local frame.** On a sector transition,
   translate the existing camera by the same local-frame offset as the pilot
   before the ordinary smooth follow step. Do not teleport the camera to a
   home point or recenter the journey.
2. **Retain a deployment anchor for the mounted universe session.** Compute the
   vector from the pilot's current sector/local coordinates to the saved
   deployment sector/local coordinates using the integer sector delta before
   converting the practical-range distance to meters.
3. **Show compact return guidance only when useful.** After the pilot is more
   than two sectors from the deployment point, show one unboxed line with a
   ship-relative arrow, straight-line range, vertical cue, and current sector.
   The cue is hidden near the starting point so it does not clutter ordinary
   flight.
4. **Keep rendering on one adapter path.** Production flight and visual modules
   import named Three.js APIs through `three-flight-runtime`; the renderer
   remains deferred from the entry page.

The distance display is straight-line range to the deployment anchor, not the
length of the path already flown. It provides a valid return vector and range;
the pilot still steers and flies the return. Sector addresses stay exact as
decimal integer strings. Converting them to floating-point meters is intended
for local navigation readouts, not for authoritative persistence at extreme
astronomical magnitudes.

## Source-code proposals not copied as-is

The uploaded snippets are directional examples, not production-ready code. In
particular, converting unbounded `BigInt` sector values directly to `Number`
eventually loses precision; per-frame `Math.fround` does not make a simulation
deterministic across runtimes; and the sample input listeners use anonymous
callbacks that cannot be removed during teardown. The implementation reuses
the repository's existing deterministic flight step and sector-address model
instead of adding a second renderer or motion loop.

The proposed radiation damage multiplier is **not enabled**. Client-side
exposure or hull damage would be forgeable and could conflict with server
authority. A future radiation mechanic requires a versioned server-owned
environment rule, bounded mitigation/return behavior, and staged settlement
tests. The current return cue has no damage or reward effect.

## Verification and limits

- WFM source tests and bundle checks pass: 394 game-package tests and 4 build
  audit tests.
- Both main and standalone Combat Lab builds place Three.js in one lazy
  `three-engine` chunk: 544,382 B raw / 138,931 B gzip. The initial static
  graph excludes Three.js. Existing limits were unchanged.
- Sector crossing and a 50 km return vector are unit-tested. A signed-in
  staging session, physical-device continuity test, account-persistent travel,
  and an infinite multiplayer sector protocol are not certified by this slice.
- The current deployment anchor lasts for the mounted local Orbital universe
  session. Persisting it across reconnects or sharing long-range positions
  requires server-owned, versioned sector coordinates and recovery rules.
