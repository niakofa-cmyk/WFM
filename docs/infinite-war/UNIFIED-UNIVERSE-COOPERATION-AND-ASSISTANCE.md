# Shared-universe cooperation and fleet assistance

## Foundational direction

Cooperation belongs inside the continuous Orbital universe. Pilots use the
hangar's Enter Universe gateway, fly in the same admitted server location,
discover real roaming ships, and help nearby allies in an ongoing fleet battle.
Co-op is a grouping/activity capability, not a requirement to launch a second
world. Three.js remains the primary presentation foundation under Orbital's
server-owned flight and combat.

Retain the legacy sector runtime, protocol negotiation, saved discoveries and
rollback paths until their replacements are verified. Do not delete data,
competitive Wing, or training as a supposed bundle-size repair. Public shared-play
entry goes through the hangar; legacy sector access is labelled compatibility.
This slice does not migrate all legacy sector objectives into continuous flight.

## Preserved source references

Both uploads were read in full and copied byte-for-byte:

- [Unified cooperation and encounter triggers](references/fleet/UNIFIED-UNIVERSE-COOP-AND-ENCOUNTER-TRIGGERS-SOURCE.txt)
- [Multi-pilot tactical systems](references/fleet/UNIFIED-MULTI-PILOT-TACTICAL-SYSTEMS-SOURCE.txt)

These are design proposals, not verified implementation reports. Their claimed
74–75 KB bundles, completed rollout and two-human payouts are not repository
evidence. Their sample imports do not match this repository. Do not deploy their
hardcoded authentication placeholder, unthrottled per-frame HTTP route, 2D-only
distance checks, in-memory wallet, or random fabricated pilot messages.

## Implemented in the local candidate

1. Preserve the server's **180 m** three-dimensional close-approach threshold.
   Automatic proximity checks can now admit a later nearby ally to an existing
   active encounter, even when the active-encounter capacity is full. No new
   patrol reservation, scene swap, pose change or battle restart is involved.
2. Recheck the assisting pilot's authenticated admission, location/session,
   faction, selected hull, connected seat, life, distance and eight-pilot cap.
   Recheck again after asynchronous admission lookup, including that the battle
   and target are still active. Record the new pilot in the existing
   server-only result contract before permitting that pilot's damage.
3. Present actual encounter/support events as compact radio/status messages.
   The small contact indicator pulses inside intercept range, respects reduced
   motion, and displays the approach envelope without adding another HUD box.
   Public cooperation entry points toward the hangar instead of a separate
   expedition. Existing compatibility routes remain.

Assisting pilots receive no retroactive kills or contributions. Actual damage
after admission establishes assists; a destruction is credited once to its
actual responsible pilot. Existing server-owned, capped NPC bounties and
idempotent settlement remain. Observers receive neither free kills nor credits.
Participation, accepted firing input, emitted weapons, damage, and settled
rewards remain separate facts.

## Recommendations deliberately not enabled yet

- Fleet-size-dependent combat thresholds need calibrated spawn/visibility/weapon
  ranges and a versioned client/server presentation contract. Do not silently
  replace 180 m with the proposal's 800–1600 m automatic aggression.
- A 15% team bonus or equal credit split needs a versioned, capped database
  settlement policy and concurrency tests. The proposal's map allocator would
  fabricate balances and give everyone a kill; it is not used.
- The compact warning pulse is not a full 3D radar-ring overlay. A world-space
  sweep remains a rendering enhancement, not a source of authority.
- Random chatter claiming fictitious human pilots fired or took damage is not
  used. Future radio events should reflect real server events.

## Verification and rollout boundary — 2026-11-08

Local candidate: 22 server encounter/free-flight tests and 7 frontend
combat-state/control-sampling tests passed. Coverage includes late automatic
assistance, real server weapon emission by the ally, one reservation only,
idempotent rejoin, changed-location rejection, subsequent kill/assist accounting,
and no observer credit. API/game typechecks and both production builds passed;
4 static-build checks passed.

Initial JavaScript gzip: main **125,768 B**, standalone Combat Lab **126,488 B**.
The Lab limit remains **143,360 B**; Three.js stays lazy, not in either initial
static graph. No schema, feature-flag or deployment-network change was needed.

The prior firing-state candidate `5599bb1` reached SUCCESS on staging app, API
and socket services. Its fresh authenticated firing/settlement check remains
incomplete. With subsequent explicit approval, cooperation candidate `61fd952`
reached SUCCESS on staging app, API and socket services at the same revision.
Socket startup reported database-backed free flight and combat enabled.
Unauthenticated gateway root/profile/WebSocket requests all returned 401.
The Railway Lab audit passed at 127,135 B gzip with Three.js still lazy.
No schema or feature-flag changes were applied.

These checks are not authenticated two-human, two-physical-device, Android,
kill/assist settlement, or production proof. Those remain outstanding; the
overall promotion status remains PENDING. Production is unchanged.
