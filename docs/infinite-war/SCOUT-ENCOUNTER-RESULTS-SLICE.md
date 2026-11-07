# Pale Beacons server-run scout result slice

## What is connected

The Pale Beacons cooperative flight now treats its existing Orbital-sector
hostile drone as the first faction-opposed scout encounter. The authenticated
room roster and selected hull definitions determine the player faction; the
server assigns the scout to the opposing faction and rejects mixed-faction
rooms. This path requires the existing paired Orbital sector protocol V2
handshake. The selector keeps the mission unavailable when the client is on
the compatibility protocol.

The existing server simulation remains the authority for hull damage. After
each physics step, the sector runtime records only damage actually applied to
the shared scout hull. The exploration contract attributes the final hostile
hull transition as a kill, records prior contributors as assists, and binds
the result to the server roster, runtime, policy and event fingerprint.
Client packets cannot submit damage, kill counts, result objects or credits.

After a verified extraction, the server settles a 12-credit bounty for each
confirmed eligible NPC kill, capped at 24 credits per encounter. There is no
completion bonus, and assists do not yet receive a currency share. Credits,
account revision, reward ledger, and each pilot's private result row are written
in one transaction. A graceful shutdown or timed interruption stores the
server-confirmed partial tally without credits. An authenticated read-only
endpoint returns at most ten results for the signed-in pilot only; the selector
shows recovered kills, assists, and settled credits, and the debrief shows the
server-confirmed award.

## Explicit boundaries

- The current policy is `pale-beacon-npc-bounty-v1`: 12 credits per confirmed
  hostile NPC kill, capped at 24 per completed encounter; completion and assist
  bonuses are zero.
- Settlement is connected only to the existing V2 Orbital sector path. This
  code-level implementation has not been deployed or verified on staging or
  Production.
- Result history survives page reloads and graceful server shutdown once its
  ledger write succeeds. An active flight is **not** resumed after an abrupt
  process crash; its live movement, projectiles and inputs are not checkpointed.
- Existing five-second socket reconnect behavior is unchanged. This is not
  proof of multi-pilot staging recovery or a production-safe V2 rollout.
- The scout is the first bounded encounter, not a complete faction director.
  Sensor investigation, transponder decisions, reputation, territory,
  reinforcement, retreat, PvP awards and active-event spectating remain future
  work.
- This change adds no database schema and no client write endpoint. Existing
  campaign claims, Wing rewards, private rooms, AI-fill matches, and local
  no-reward flight remain separate.

## Verification to require before widening

The unit suite must exercise the Orbital V2 handshake, opposing-faction room
admission, kill/assist attribution from server physics, atomic bounded credit
settlement, aborted-run zero payout, idempotent result storage, and authenticated
owner-only reads. Before enabling V2 for players, deploy matching
client/API/socket revisions to isolated staging and verify two authenticated
devices through damage, extraction, reward settlement, reconnect, results
recovery and PostgreSQL persistence. Do not infer Production readiness from
local tests.
