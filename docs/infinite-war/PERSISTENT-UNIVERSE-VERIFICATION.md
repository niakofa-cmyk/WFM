# Persistent Universe Verification

## Settled-recovery checkpoint compatibility

Staging admission diagnostics identified `checkpoint-encounter` while restoring
a session. A local lifecycle reproduction demonstrated the same failure:
ordinary disabled-pilot recovery retires the old actor, but retains its
completed encounter and settlement receipt. The previous restore guard rejected
that legitimate historical reference.

The compatibility change permits absent historical participants only for a
completed encounter with a validated finalized receipt and already-applied
results. Unresolved encounters still require all live participant records.
Recovery does not recreate the retired ship, reset another pilot, delete the
checkpoint, alter attribution, or repeat settlement.

Regression verification uses an actual checkpoint emitted after simulated
combat, settled defeat and normal server recovery, then restarts the runtime.
It verifies unchanged contract history and receipt fingerprint, no resurrected
actor and no repeated settlement. Pending, active, unapplied, missing-receipt,
duplicate-participant and invalid-fingerprint fixture variants fail closed.

This lifecycle test is local compatibility evidence. The authenticated staging
pass below additionally verifies shared combat and post-battle flight, but does
not independently establish the retired-actor checkpoint edge case or the
entire staging restart sequence.

### Authenticated combat follow-up — November 10, 2026

Both existing staging pilots completed fresh sign-in with active sessions and
authenticated profile HTTP 200. Using their retained browser owners, observers
were attached before concurrent entry from the normal hangar. Both received
fresh authoritative snapshots, were alive, shared the same session fingerprint,
and received reciprocal nearby pilot actor data. Their ingress instance
fingerprints differed while their authoritative owner and fencing token matched.
The previous encounter-unavailable admission failure did not recur in this pass.

Both pilots used bounded, concurrent firing and evasive movement. Authoritative
evidence recorded primary and missile projectiles, shield/hull impacts and enemy
destruction. Incremental settled receipts and the final complete settled result
matched the authenticated balance changes:

| Pilot slot | Confirmed kills | Assists | Settled credits | Balance before → after | Post-battle movement |
| --- | --- | --- | --- | --- | --- |
| 1 | 2 | 2 | 12 + 12 = 24 CR | 330 → 354 CR | 5.49 m, alive |
| 2 | 5 | 2 | 36 + 24 = 60 CR | 162 → 222 CR | 7.8 m, alive |

Assists do not have a configured cash bonus; unequal awards are expected. Final
observed hull was 33.6/125 and 125/125 respectively. Both retained one live
socket with zero observed socket errors/closes and no captured boot errors.
The test browsers were stopped after evidence collection. No live checkpoint,
balance, ship-health, position or reward state was manually rewritten.

**Limits:** This verifies shared-session combat, attribution, settled reward
balance changes and immediate continued free flight, not a second-fleet victory,
restart during active combat or cross-location travel. The starting state did
not expose a disabled-pilot recovery panel or independently establish the exact
completed-encounter/retired-actor history, so that compatibility edge remains
locally verified rather than live-certified. Nearest-target buttons were
exercised, but authoritative lock identity/progress was not established in this
pass; maintained missile lock and two pilots locking the same target remain
unproved. Reciprocal snapshots prove shared pilot presence, not visible teammate
ship pixels. Gameplay captures show each own 3D ship, but do not establish a
visually identifiable teammate or enemy ship at battle range.

The private observer's `rejectedSnapshots` counter also increments when an
accepted snapshot intentionally returns no separate event summary. It matched
the valid snapshot count here and is not evidence of server admission rejection.
Do not use that counter alone to diagnose unavailable saved encounters.

## Current result

**Two-pilot shared flight and controlled idle-flight restart recovery have
passed on Railway staging.** Two existing staging accounts authenticated with
active sessions and profile HTTP 200, joined the same canonical session as
distinct actors, and received reciprocal nearby pilot ship data.

The socket service has two configured replicas, Redis-fenced routing, and a
PostgreSQL checkpoint store. A controlled restart of the staging socket
deployment caused both retained clients to rejoin automatically with their
session/actor identities, health, tallies, and balances preserved. This is not
yet certification of active-combat recovery, cross-location travel, or reward
settlement across owners. Production remains untouched.

The reviewed safety build and the subsequent routing-evidence build deployed
successfully. All 260 API tests, the API typecheck, and backend build passed.

## What the implementation establishes

- Authenticated admission reads the pilot's saved world location and derives a
  location-specific session key (`mars:<location>`). The client cannot choose
  that key.
- Redis assigns one fenced owner to each location session. Other socket
  instances relay authenticated commands and snapshots to that owner rather
  than simulating a duplicate copy.
- A Redis-backed per-pilot seat prevents one account from occupying two
  location sessions at once. A replacement owner can take over the same shard
  only with a newer fencing token.
- A local lease deadline stops simulation even if a Redis renewal promise is
  still pending. Reading a lease does not renew it; a late renewal response or
  checkpoint load cannot revive the expired owner's runtime. Redis's offline
  command queue is disabled and its pending command queue is bounded.
- Authenticated joins emit versioned, server-owned routing evidence with
  ephemeral ingress/owner process identities and the fencing token. Two
  connections to one public hostname are not enough to prove separate ingress
  replicas. Test reports retain only hashes or equality checks.
- Nearby actor snapshots are scoped to one session and its bounded spatial
  interest radius. Pilots admitted to different location keys do not share
  exact actor snapshots or live encounters; each remains a spatial shard of the
  same WFM world, not a separate universe.
- PostgreSQL stores versioned session checkpoints, including pilot pose,
  projectiles, target state, patrol actors, and encounter attribution. Writes
  are guarded by the Redis fencing token and a monotonic checkpoint sequence.
  Active-session checkpoints run once per second; disconnect and shutdown flush
  the latest state. Stored snapshots are limited to 4 MiB.
- The checkpoint table is created and checked only when the shared runtime is
  explicitly enabled with the staging environment marker. Production does not
  enable this path.
- Player location/progression, persistent patrol routes, encounter reservations,
  and settled outcomes continue to use the existing PostgreSQL-backed records.

## Verification matrix

| Requirement | Current status | Evidence needed for a pass |
| --- | --- | --- |
| Redis/checkpoint startup | **Staging passes** | Healthy deployment; structured startup attributes confirm Redis-fenced mode and a checkpoint store. |
| Shared location session | **Two-pilot staging passes** | Both authenticated pilots share a session, have distinct own actors, and receive reciprocal nearby ship data. |
| Travel across locations in one universe | **Partial** | Different canonical locations remain isolated shards and the same account cannot hold two seats; seamless coordinate/world-state travel still needs staging verification. |
| Multiple socket processes | **Local adapter test passes; live cross-replica routing unproved** | Railway reports 2/2 online. Both live pilots received valid routing evidence, but their ingress hashes were equal after bounded reconnect attempts. A common owner/fence was confirmed; distinct ingress participation was not. |
| Process restart | **Idle-flight staging recovery passes** | Both retained clients automatically rejoined after the real socket deployment restart, preserving session/actor identity, health, tallies, and balance. Active-combat recovery is still pending. |
| Durable world consequences | **Partial** | Verify persisted patrol movement, casualties, player location, and settlement from a fresh staging process and database query. |

## Checks run

The focused free-flight and encounter suite now contains **25 tests**. The full
API suite, including these tests, passed **260/260**, alongside the API typecheck
and backend build. The focused suite can be run with:

```sh
pnpm --filter @workspace/api-server exec tsx --test \
  src/socket/free-flight-shared-runtime.test.ts \
  src/socket/free-flight-continuity.test.ts \
  src/game/exploration-encounter.test.ts
```

These tests use independent runtime instances and a shared in-memory test
transport/checkpoint store. They verify shared shard snapshots, isolated
locations, single-flight initialization, one active account seat, and state
restoration after the owner is replaced. Routing tests assert distinct ingress
identities, a common owner/fence, and a newer owner/fence after takeover.
Lease-expiry tests cover recent lease
reads, pending renewals, late successful responses, and checkpoint loads that
finish after ownership is lost. They do not connect to actual Railway services
or authenticate browser pilots.

### Staging rollout

A dedicated private Railway Redis service is provisioned in WFM staging in the
socket service's `us-east4-eqdc4a` region. The socket service source points to
the updated branch, and the Redis-backed shared-runtime variables are scoped to
the staging environment only. Railway reports the reviewed runtime and
routing-evidence deployments successful, with two socket replicas configured.
Its structured log attributes confirm Redis-fenced routing and a checkpoint
store. Remaining proof must distinguish configured topology from actual
cross-replica gameplay.

### Live staging evidence, 2026-11-10

- Both existing browser owners completed their matching fresh verification
  challenges once and confirmed authenticated profiles with HTTP 200.
- Observers were attached before universe entry. Session fingerprints matched,
  own-actor fingerprints differed, and each feed contained the other pilot.
- Both pilots were neutralized through normal controls and recovery baselines
  were frozen in browser-owner memory before a staging-only socket restart.
- Both rejoined automatically within the bounded 90-second check, without a
  page reload or new sign-in. Socket observations increased from one to three
  for each client, and comparisons used fresh post-restart snapshots.
- Identity, health, tallies, and balances matched; ticks were monotonic. Both
  ships remained alive and reciprocal presence resumed.
- Baseline-to-current displacement measured 113.168 m and 14.881 m, including
  accumulated movement/drift. These figures are **not** a claim of zero drift
  or an isolated measurement of restart error.
- The first combat attempt was not started: the pilots were Accord and the
  current directory contained no USSF patrol. No targets, damage, victory, or
  reward claims were fabricated to bypass that condition.
- The routing-evidence deployment was then confirmed healthy and Railway
  reported **2/2 Online**. Valid protocol-1 routing summaries from both clients
  had a common owner and equal fence. Their ingress hashes remained equal after
  three additional normal reloads of one pilot; the test did not establish
  actual cross-replica participation.
- Normal reloads retained authenticated sessions. No replacement sign-ins,
  login-state exports, account creation, or authentication bypass were used.
- A bounded attempt to return to the hangar and choose USSF did not complete,
  even after correcting a test-driver menu selector. Both pilots remained
  alive in shared flight and their saved faction/hull did not change. Read-only
  diagnostics showed an enabled visible pause button, no pause backdrop, and
  no visible exit/resume buttons. The cause of the action timeout remains
  unresolved; the test does not establish an application bug versus a driver
  interaction issue.
- No genuine combat result was produced. Shared enemy targeting, assists,
  credited destruction, reward idempotency, active-combat failover, and
  post-battle flight therefore remain unverified on this staging pass.

### Remaining blockers

1. Establish deterministic, authenticated participation through two different
   socket ingress instances. Healthy replicas or a shared owner alone are not
   enough; do not add a public debug bypass to force a passing result.
2. Diagnose the normal flight-menu/hangar return action with step-specific
   interaction evidence, then reach an actual hostile patrol through ordinary
   faction selection or validated travel. Do not reset persistent casualties
   or insert enemies solely to manufacture a test victory.
3. Repeat only the blocked combat/reward/recovery checks once those prerequisites
   are available. Preserve the passed shared-state and idle-restart evidence.

### Remediation prepared after the first live pass

- The fixed account avatar used the same top-right hit area as the flight-menu
  button, at a higher stacking level. Account controls are now hidden while an
  arena is mounted and remain available outside flight. This removes the
  overlap rather than forcing a test click through another element.
- The gateway now rotates the configured private socket service's DNS addresses
  when opening upstream connections. The ordinary staging access/origin checks
  and Clerk socket authentication remain in place. No caller-supplied instance,
  hostname, credential bypass, or public test endpoint was introduced.
- A real local integration test connects through the gated gateway to two
  distinct WebSocket servers and verifies alternating delivery. DNS rotation,
  fresh resolution, and resolution failures have focused regression coverage.
- The complete workspace typecheck, test, and build workflow passed, including
  both main-game and standalone Combat Lab bundle audits.
- These are **implemented and locally checked remediations**, not replacement
  evidence for the outstanding authenticated Railway combat/cross-instance
  checks. Fresh retained staging sign-ins are required because the earlier
  browser owners were deliberately stopped after their bounded test.

## Authenticated staging follow-up — November 10, 2026

The frontend/protected gateway, API and two-replica socket service were aligned
to the reviewed `a386e8d` source before this run. Production was not changed.

- **Proved across replicas:** two authenticated USSF pilots reached distinct
  socket ingress instances, shared one canonical session and authoritative owner,
  received the same fencing token, had distinct own actors, and received each
  other's nearby actor data. Raw instance, actor and account identifiers were not
  exported. This is shared-state evidence, not a separate pixel-level ship-model
  certification.
- **Proved normal controls:** the flight-menu hit test reached the intended
  pause button, the account avatar was hidden in flight, and normal exit to the
  hangar worked.
- **Proved validated travel debits:** each account used the enabled 8-credit
  Operations route from Phobos to Rust Disc. The server returned the destination
  and deducted exactly the displayed fare. Account travel alone does not prove
  cross-location physical-flight continuity.
- **Proved enemy offense and zero-contribution settlement:** a real patrol
  arrived and inflicted shield/hull damage, disabling the pilots. The observed
  result settled with zero kills, assists and credits. Accepted primary and
  missile input counts were zero in that attempt; it cannot certify player
  weapon effectiveness, victory, assists or positive rewards.
- **Found a recovery presentation defect:** after a disabled pilot traveled
  through Operations, joining a different flight region was correctly refused
  with `freeflight_recovery_required`. Because no new own-ship snapshot arrived,
  the recovery panel disappeared. Reconnect callbacks also replaced the business
  rejection with a generic unavailable state.

The follow-up UI fix retains the server's recovery-required state through
reconnect callbacks and renders an explicit return-to-command path even without
ship vitals. It explains that recovery must be requested at the disabled ship's
previous flight location. Actual recovery remains disabled without an admitted,
server-confirmed disabled pilot; no hull, settlement or location safeguard was
relaxed. Focused regression tests, frontend typecheck, both production bundle
builds and both bundle audits pass. Deployment and authenticated verification of
this additional UI fix must be recorded separately from the `a386e8d` run.

Active encounter failover, player-caused enemy destruction, shared kills/assists,
positive reward settlement and continued post-victory flight remain uncertified
until genuine active combat produces those outcomes.

### Recovery and active-fire continuation

Both pilots used normal Operations travel back to Phobos, rejoined their retained
disabled ships and successfully requested server-authorized recovery. Recovery
returned them to the hangar and charged zero credits. They then paid the normal
8-credit route back to Rust Disc. Across the three validated travel legs each
account paid 24 credits; no positive combat reward was observed.

A bounded 15-second real-control segment for one pilot produced **57 accepted
primary projectiles and 11 impacts**, applying **48.4 shield damage**. No hull
damage or enemy destruction was confirmed. The other pilot was already disabled
before its firing segment could start. Both subsequent results settled with zero
kills, assists and credits. Both then completed a second normal recovery.
This verifies player firing and shield contact, not a victorious fleet battle,
shared credit attribution or positive reward settlement.

The retained browser owners reached their configured 30-minute limit during
the next normal re-entry attempt and were stopped. No authenticated context was
exported, no replacement sign-in was opened and no old code was reused. Final
post-recovery re-entry and active-battle restart behavior remain unknown.

## Required architecture before claiming success

1. Keep one WFM world identity and canonical spatial addresses; location IDs
   are regions/shards, not separate universes. A shard's `sessionInstanceId`
   must not be mistaken for a global universe identifier.
2. Assign one authoritative writer per spatial shard with a renewable,
   fenced lease. A stale process must not continue simulating or settling after
   losing ownership.
3. Keep Redis as the real-time transport for inputs, snapshots, and ownership
   changes between socket processes; do not substitute unbenchmarked per-tick
   PostgreSQL polling.
4. Persist durable world events and periodic versioned checkpoints in the
   existing database workflow. Keep high-frequency simulation in memory on the
   current shard owner; checkpoint cadence and replay bounds must be measured.
5. Define restart behavior for active encounters: restore all authoritative
   state from a compatible checkpoint, or settle/release the encounter as an
   idempotent no-reward interruption. Never infer a kill, reward, or pilot pose
   from client state.
6. Gate rollout on isolated tests with two independent runtime processes and a
   staging restart. Keep Production disabled until the same tests pass against
   the intended staging topology and database.

## Required proof sequence

1. Join two authenticated pilots on separate runtime instances in the same
   region; compare server-issued universe, shard, session, actor, and tick
   identities.
2. Move one pilot through a validated location transition. Confirm canonical
   coordinates and server-owned world state remain continuous while nearby
   interest sets change correctly.
3. Move a patrol and settle a controlled encounter; query the authoritative
   records from a fresh application process and verify the same revision,
   casualties, and idempotent result.
4. Restart the active shard owner during a controlled encounter. Confirm the
   replacement owner acquires a newer fenced lease and either restores the
   exact checkpoint or applies the documented interruption policy once.
5. Attempt to submit the same result from both the old and new owners. Confirm
   only one settlement/reward is committed.
6. Repeat with the clients connected to different socket processes and with
   pilots in different regions. Verify that only intended nearby actors are
   disclosed and that distant locations remain part of the same durable
   universe without being incorrectly placed in one local combat session.

The live evidence above establishes same-location cross-instance shared flight
and idle-flight restart recovery, not the entire proof sequence. Active combat,
cross-location physical-flight continuity and duplicate settlement still
require explicit staging evidence. The source proposal and its safe adaptation are recorded
in [`DISTRIBUTED-MULTIPLAYER-MESH-REFERENCE.md`](DISTRIBUTED-MULTIPLAYER-MESH-REFERENCE.md).
