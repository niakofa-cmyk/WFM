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

At terminal completion, the server records each pilot's own result in the
existing `progression_events` ledger. A graceful server shutdown or a timed
operation interruption stores an aborted partial tally. Result rows are
idempotent and write no currency or account revision. An authenticated
read-only endpoint returns at most ten results for the signed-in pilot only;
the expedition selector shows this recovered history, and the debrief displays
the server-confirmed kills and assists.

## Explicit boundaries

- The current scout policy is `scout-result-only-v1`; credits per kill and
  completion are zero. The settlement capability remains disabled. No live
  exploration payout was activated.
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
  progression, Wing rewards, private rooms and local no-reward flight remain
  separate.

## Verification to require before widening

The unit suite must exercise the Orbital V2 handshake, opposing-faction room
admission, kill/assist attribution from server physics, idempotent result
storage, authenticated owner-only reads, and zero wallet changes. Before
enabling V2 for players, deploy matching client/API/socket revisions to
isolated staging and verify two authenticated devices through damage,
reconnect, results recovery and PostgreSQL persistence. Do not infer Production
readiness from local tests.
