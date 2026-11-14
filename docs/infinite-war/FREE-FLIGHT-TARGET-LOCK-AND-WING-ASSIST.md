# Free-flight target lock and wing assistance

## Direction

Selected targets must be identifiable at their actual projected 3D location,
not only in a status card. Keep the authoritative hostile actor selection from
the shared-flight server and render a high-contrast reticle that follows that
actor's server snapshot. When the target leaves the viewport, show a bearing
marker at the nearest screen edge. Include callsign, range, missile-lock
progress, and a distinct ready cue without implying that a missile may fire
before the server's native range, aim, line-of-sight, cooldown, and ammo rules
allow it.

Pilots already engaged in a live patrol encounter may send a wing-support
signal to nearby authenticated pilots of the same faction in the same spatial
session. A signal is an invitation, not forced matchmaking: eligible pilots
receive a short-lived prompt and choose to respond or dismiss. The server
revalidates session, faction, active encounter, invitation, distance, capacity,
and participant state before adding a responder to that same encounter.

## Authority and limits

- The client sends a call intent without selecting recipients, a patrol, or an
  encounter ID. The server chooses the active battle and eligible recipients.
- Calls are rate-limited and expire. An acceptance cannot start a new patrol,
  create a second reservation, teleport a pilot, or revive a completed fight.
- Only nearby authenticated human pilots currently in the same spatial session
  are signaled. This does not claim that NPC escorts answer the call.
- Participation, damage, kills, assists, and settlement continue through the
  existing server-owned encounter contract. A signal alone grants no credit.
- Reticles, edge bearings, and labels are presentation of authenticated
  snapshots; they cannot authorize damage or settlement.

## Verification

Automated coverage should prove target projection and off-screen bearing,
server selection and lock persistence, and missile readiness gating. The
assistance integration test must show that a nearby same-faction pilot receives
an optional call, joins the original encounter after accepting, and does not
create another patrol reservation. Protected staging cockpit and paired-device
verification remain separate gates; do not claim them from local tests.

## Nearby-hostile priority

The cockpit now offers a **NEAR** action to select the closest eligible enemy
directly. The existing target-switch action cycles from near to far and wraps.
Distances use authoritative three-dimensional pilot and enemy positions, not
screen size, actor identifiers, or client-supplied coordinates. Equal distances
use actor identity only as a stable tie-breaker.

Selection stays on that enemy as the pilot moves; proximity changes do not
silently redirect a charged missile. Choosing a different enemy clears the old
lock charge. Re-selecting the same nearest enemy does not reset it.

Both actions retain the same server eligibility, engagement membership,
sequence-replay protection and rate limit. Dead ships, friendly ships and
unreserved encounters cannot become authorized missile targets. Primary fire
and encounter initiation keep their existing rules. The NEAR capability is
advertised separately so older servers never receive unsupported intents.

Local tests cover 3D ordering, position changes, wraparound, deterministic ties,
nearest reacquisition, hostile selection, replay rejection and missile-lock
handoff. Authenticated staging verification remains a separate requirement.
