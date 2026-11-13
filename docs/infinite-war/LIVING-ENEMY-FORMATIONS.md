# Living enemy formations

Persistent roaming patrols in Orbital are server-owned fleet entities, not a
one-stage spawn list. This first operational layer builds on the existing
PostgreSQL patrol roster, route, encounter lease, shared-flight actors, and
fenced checkpoints. It does not introduce a second simulation or client-owned
fleet state.

## Current behavior

- A persistent fleet has a stable identity, faction, territory/location,
  patrol route, ship-role assignments, command vessel, commander, mission,
  formation posture, observed-contact state, threat level, combat posture,
  reinforcement request, and retreat thresholds.
- Roles are assigned deterministically from the actual saved roster: command,
  escort, interceptor, missile platform, and reconnaissance. Missing hulls are
  never invented to fill a role.
- The most durable eligible hull starts as command vessel. If it is destroyed
  or loses its bridge, a surviving bridge-capable ship takes command; identities,
  hull health, and losses remain unchanged.
- Communications-enabled ships share recent sensor observations from the
  existing bounded scout memory. A contact record contains the last observed
  position, not a hidden live target pose. It expires after the existing
  45-second memory window.
- Non-command ships fly physical, quaternion-relative formation offsets around
  their command vessel. Reconnaissance units screen farther ahead; missile
  platforms hold farther back. The patrol route still advances when there is
  no contact. Combat uses the existing authoritative flight, projectile,
  damage, encounter, and reward paths.
- Casualties reduce operational strength. Severe roster attrition, critical
  remaining hull condition, or loss of all propulsion produces a dispersed
  physical withdrawal rather than a respawn, heal, teleport, or reward.
- Existing nearby allied patrol response remains responsible for actual AI
  assistance. A high-threat fleet may request reinforcements, but the request
  is not presented as a dispatched unit: committed remains zero until the
  simulation explicitly routes an existing persistent fleet. No replacement
  roster is created.
- Operational state is included in the existing versioned Orbital checkpoint
  and validated on recovery. Older patrol records without this optional state
  are initialized deterministically from their existing ships. Refreshes and
  encounter reservations retain in-memory operational state rather than reset
  the fleet's command, mission, or contact.

## Deliberate limits

This does not yet claim authored named commanders, fleet-specific strategic
territory ownership, spawned reinforcements, surrender, boarding, capture,
emergency jumps, or multi-fleet strategic campaign movement. A database-backed
campaign territory/mission authority and explicit safe reinforcement dispatch
are required before those behaviors should appear. The operational state here
is single-runtime checkpoint state; it does not by itself prove that every
socket replica shares one authoritative persistent patrol simulation.

## Verification boundary

Automated tests establish deterministic role/command succession, observed
contact expiry semantics, threat/retreat transitions, validation, and the
existing fleet combat simulation checks. They do not certify staging, two
physical devices, cross-replica fleet ownership, or Production.
