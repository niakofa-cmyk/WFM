# One celestial coordinate frame for shared Orbital flight

## Owner observation and direction

On 2026-11-11 the owner reported that two phones now enter the same universe,
but ships appear at different positions relative to the Moon. The Moon should
provide a common navigation landmark and a way to compare spatial alignment.
This is not evidence that all shared position/rendering behavior already works.

## Source finding

Own-seat reconciliation corrected orientation and velocity but deliberately
left predicted client position unchanged. Remote actor and projectile rendering
used the difference between that local pilot position and its server position.
Mars, the Moon and streamed sectors did not receive that same per-viewer offset.
That can put the same remote ship at different celestial coordinates for each
viewer even when both snapshots refer to one server session.

## Contract

- One fixed, versioned simulation frame: **mars-orbital-fixed-v1**.
- Metres, XYZ axes, and 512 m sector cells. Local positions remain in the
  half-open interval **[-256, 256)** on each axis.
- Mars and the existing orbital Moon use shared library definitions for their
  centres and radii. The existing world coordinates are preserved.
- The Moon is a common landmark, not a camera-following origin or a reason
  to teleport pilots together. Its range/vector must derive from server pose.
- Initial insertion and restored flight adopt the server's actual position.
  Subsequent prediction error is reconciled, including position.
- Sector rebasing translates the camera and scenery together without changing
  orientation, velocity, health, authority or distance travelled.
- Shared actor meshes, projectile effects, gravity centres, lock brackets and
  screen-space target markers use the same server-to-local frame.
- The renderer's +0.9 m Y lift is presentation only, including streamed rocks.
- No new client position submission, alternate world, admission bypass,
  payout rule or persisted pilot-state migration is introduced.

## Spatial boundaries versus another universe

Render cells are precision/streaming boundaries, not walls or new worlds.
Server location admission and nearby interest filtering remain enforced.
This fix does not merge distinct authorized location sessions, add inter-region
handoff, move distant pilots together, or certify Redis failover.

Ships can legitimately be different distances from the Moon: the server uses
separate spawn positions to prevent overlapping pilots, and each pilot moves
independently. Alignment means every viewer agrees on the Moon's physical
position and the ships' physical positions—not identical screenshots or ranges.

## Verification

Regression cases cover exact authoritative insertion, positional convergence,
two viewers on opposite sides of a sector boundary, six sector-face crossings,
distant restoration/return distance, consistent celestial colliders and render
centres, and rejection of another actor as the local authority.

For phone acceptance, open **PILOTS** and compare session/location and **FRAME**.
The panel also shows **SECTOR**, **LOCAL XYZ**, **MOON RANGE**, and **MOON ΔXYZ**.
From two nearby pilots, their Moon-vector difference must match their relative
ship offset. Fly toward one another and confirm the visible ships meet at the
same location relative to the Moon. Do not report this physical-device check
as passed until observed on both phones.
