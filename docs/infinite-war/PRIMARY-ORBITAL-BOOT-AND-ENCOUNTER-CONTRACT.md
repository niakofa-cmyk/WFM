# Primary Orbital boot and server exploration contract

## Delivered slice

The main `/` application now starts through Orbital. Guests see the shared
`OrbitalBoot` navigation/loadout/launch component; authenticated pilots load their
existing account profile before entering the existing Orbital universe flight
adapter with their saved hull and controls. Account services remain embedded
behind the station's operations action. Starting an actual online operation
still uses the existing account, queue, lobby, run and socket paths.

The standalone `combat-lab.html` no longer owns a duplicate launch component.
It is an offline wrapper around that same boot, without Clerk. This is a boot
consolidation, **not a claim that all campaign, Rust Disc and Wing simulations
have migrated**. Those versioned runtimes and result/replay authorities remain
unchanged.

### Compatibility and rollback

- `/command`: existing account command/hangar/campaign/Wing shell.
- `/?boot=compatibility`: same previous root experience.
- Build-time `VITE_WFM_ORBITAL_BOOT_ENABLED=false`: selects the previous root
  presentation. No environment value was changed as part of this slice.
- `combat-lab.html`, `/play`, `/flight`, `/universe`, and the co-op entry remain.
- Room invitations bypass automatic local flight and keep the existing lobby.
- The Orbital entry never overrides a server-issued campaign/runtime version,
  network protocol, competitive eligibility, or reward policy.

The current free-flight profile remains a local sandbox. Authenticated account
ownership does not turn that local simulation into shared or reward-bearing
exploration. The intended multiplayer exploration is reward-capable, but must
run through the authoritative encounter integration below.

## Server-internal exploration contract

`artifacts/api-server/src/game/exploration-encounter.ts` defines
`orbital-exploration-v1`, pinned to the current Orbital runtime.

The future authoritative runtime supplies:

1. A server-issued encounter/sector identity and authenticated actor roster.
2. An immutable faction/hull snapshot and explicit rewardable NPC targets.
3. A versioned server-selected reward policy (no production amounts chosen here).
4. Server-adjudicated hull-damage events after validating weapons, collision,
   range, timing and player input in the actual simulation.
5. A completion tick, outcome and server-verified objective result.

The contract attributes the final hostile hull transition to one pilot, records
other contributing pilots as assists, excludes friendly-fire tallies, rejects
unknown actors, already-dead targets and stale/conflicting events, and deduplicates exact event
retries. An upstream-validated projectile may hit after its firing hull is
destroyed, without losing its pilot attribution. Opposing player kills may be tallied but do not receive NPC kill
payouts. Objective rewards and kill rewards are bounded by the supplied policy.

Finalization issues an immutable process-local receipt. JSON, spread copies and
client-authored result shapes cannot produce a valid receipt. A deterministic
fingerprint binds the roster, policy, event history and finalized result.

This contract **does not simulate weapons or detect hits by itself**. It must
never be called with unverified client damage, kill counts or currency amounts.
There is deliberately no HTTP endpoint to create, finalize or settle encounters;
therefore no public OpenAPI write contract was added.

## Settlement and persistence

`exploration-settlement.ts` defines the transactional store boundary.
`exploration-rewards.ts` supplies the existing PostgreSQL account/ledger adapter.

- Settlement is disabled by default and requires an explicit trusted-server
  boolean gate. The authenticated Orbital V2 `pale-beacons` and
  `universe-patrol` sector operations call it when the server feature gates and
  callbacks are enabled; local free flight does not.
- Only completed server-issued receipts can settle.
- Existing participant profiles are locked in sorted order; missing profiles
  fail closed rather than creating account identities.
- All participants' credits, revisions, destruction tallies and result records
  settle in a single transaction.
- A namespaced encounter key uses the existing `world_exploration` ledger kind;
  no schema migration, new database, or parallel economy is required.
- Exact retries return the original result. A conflicting fingerprint or partial
  prior settlement fails explicitly. Existing Wing settlement is untouched.
- An aborted result, default-disabled gate, copied receipt or failed transaction
  cannot award credits.

Receipts are not a durable encounter coordinator. After a process restart the
authoritative encounter/replay owner must reconstruct the same pinned spec and
event history before reissuing a receipt. The ledger prevents re-awarding an
already committed result; arbitrary JSON deserialization must remain rejected.

## Remaining activation gates

Before extending rewards from the bounded server operations into continuous
shared free flight:

1. Connect the local free-flight contact to a server-owned continuous Orbital
   session; do not treat local position or the current approach prompt as
   authoritative.
2. Preserve the server-issued encounter identity, ordered simulation events,
   reconnect recovery, and completion across the shared flight.
3. Define any new exploration/NPC reward policy, participation, and anti-farm
   limits; keep PvP policy separate.
4. Keep owner-scoped results/debrief reads and account freshness correct when a
   pilot returns to free flight.
5. Prove multi-pilot movement, damage, disconnect/reconnect, replay, settlement
   atomicity, patrol casualty persistence, and privacy against staging and the
   actual PostgreSQL adapter.

Unit tests exercise authority rejection, kill/assist attribution, event retries,
aborts, exact replay fingerprints, concurrent settlement, missing profiles,
conflicts and transaction rollback. They do not certify continuous shared
free-flight combat, physical-phone controls, or live PostgreSQL contention.

### Local verification evidence

- Workspace and changed-package TypeScript checks passed.
- Full frontend tests: 318 passed; full API/socket tests: 174 passed.
- Subsequent focused contract checks also cover recovered JSON property ordering,
  partial/corrupt prior records, currency overflow and delayed-projectile credit.
- Main and offline production bundles passed their four static/deferred-engine
  build assertions.
- A signed-out browser pass verified the primary root, both compatibility
  entries, standalone offline boot, local launch/exit and signed-out account gate.
- The browser could not create WebGL, so genuine canvas flight was not verified.
  Signed-in browser checks were not attempted because the configured account's
  intended Development-instance membership was not independently confirmed.
- No staging/Production rollout, live reward activation or physical-device
  certification was performed.

## First connected scout result slice

Pale Beacons now adapts its existing server-run Orbital target into the first
faction-opposed scout encounter. V2-only admission pins this work to Orbital;
mixed-faction parties are rejected. The server derives kill/assist events from
actual shared-target hull deltas after authoritative physics. A private,
owner-scoped results endpoint and selector history recover each pilot's
server-recorded result. Completed results and graceful-shutdown partial tallies
use the existing progression ledger without changing credits or profile
revision. See `SCOUT-ENCOUNTER-RESULTS-SLICE.md`.

This remains a result-only rollout: the scout policy awards zero credits and
the previously built settlement adapter stays disabled. A graceful shutdown
can save an aborted tally, but a sudden process crash does not resume an active
flight or recover movement/projectile state. V2 remains behind its existing
paired-deployment opt-in; no staging or Production configuration was changed.
