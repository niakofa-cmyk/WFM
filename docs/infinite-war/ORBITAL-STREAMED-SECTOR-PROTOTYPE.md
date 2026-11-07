# Orbital streamed-sector prototype

## What is implemented

The existing local `Arena` runtime now carries an integer sector address beside
small local flight coordinates. Crossing a 512 m cell rebases only position;
velocity, orientation, input, camera and renderer remain continuous. Sector
indices are arbitrary-precision decimal strings, while the physics integrator
continues to operate near the origin.

For the current sector, Orbital builds a deterministic nearby 3×3×3
neighborhood. Seeded asteroid placement is shared by the renderer and collision
query; some sectors contain a visible anomaly front. The scene is replaced only
on sector changes, within the existing Arena scene and renderer. The Mars/Cinder
system is held at its stable origin frame and remains visible from adjacent
cells.

Pilots can approach a generated anomaly, scan it at 24 m or less and 4 m/s or
less, and record its stable sector ID in a bounded 128-entry local session log.
This is discovery practice only: it grants no progression, credits or server
state. Cinder docking remains at its fixed sector address and uses its current
22 m / 4 m/s / 35° gate.

## Authority and scope

- Local sector addresses and anomaly scans disappear when the local session ends.
- No sector position or scan is written to the account or server.
- This does not publish shared nearby ships, faction patrols, scheduled cosmic
  events, live battle geometry, or persistent anomaly outcomes.
- Existing operation directories, match admission, co-op authority and Wing
  reward contracts are unchanged.
- The local stream is one spatial sector field. It is not yet a Mars surface /
  atmosphere / orbit reference-frame system or a light-year star-system router.
- The present scene tests use low-poly procedural placeholders; these are not
  final fleet, asteroid or anomaly art.

## Proof gates

- Unit/integration tests cover positive and negative rebasing, multi-cell jumps,
  huge stable sector addresses, deterministic content, collision reuse, retained
  flight velocity/orientation and safe anomaly scanning.
- Build and browser visual checks are required for the streamed scenery.
- Physical Android tests still need to verify touch controls and frame pacing
  while crossing sector boundaries and scanning an anomaly.
- Server-backed saved sector identity, presence and shared discoveries require a
  later versioned API/socket contract and multi-pilot staging proof; do not
  derive them from the local address.

## Next implementation sequence

1. Add an explicit planetary reference-frame contract and test Mars-relative
   altitude, orbital capture, departure and return without discontinuous velocity.
2. Connect server-approved account travel and stable universe locations to the
   Orbital session without turning local flight into location authority.
3. Add shared nearby presence and scheduled anomaly/operation events through
   existing authenticated services, then verify two-pilot staging behavior.
