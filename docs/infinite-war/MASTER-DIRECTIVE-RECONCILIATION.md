# Orbital master directives — source reconciliation and next verified slice

## Latest owner clarification

The [Orbital universe rebuild contract](ORBITAL-UNIVERSE-REBUILD-CONTRACT.md)
controls the execution target: the new universe/game lives inside the rebuilt
Orbital runtime. Orbital is not a permanently separate offline training module.
The account-world link, separate approach scene and shared chart described
below are interim bridges, not the completed main game. Preserve specialist
operation adapters and server authority without using them as a reason to
build the main universe in a separate engine.

The five new owner documents were read **in full** and copied byte-for-byte.
One multiplayer-architecture document is a resend of the already saved source;
the recommendation includes the engine-consolidation directive verbatim, with
additional commentary. None is evidence that described features already run.

The later five storyline/route sources were also read in full and copied
byte-for-byte into `references/`. Their current-code reconciliation is now
maintained in the [connected-storyline and adventure rebuild](CONNECTED-STORYLINE-AND-ADVENTURE-REBUILD.md).
They reinforce the same Orbital/server-authority boundaries while adding the
requirement that narrative progression be a thread through locations and
events, not a stack of disconnected mission selections.

| Supplied source | Role in the redesign |
|---|---|
| [Engine consolidation directive](references/redesign/MASTER-ENGINE-CONSOLIDATION-DIRECTIVE-SOURCE.txt) | Primary Orbital flight/combat foundation; extract verified legacy capabilities, no broad rewrite |
| [Engine milestone recommendation](references/redesign/MASTER-ENGINE-VERTICAL-SLICE-RECOMMENDATION-SOURCE.txt) | Same directive with playable asteroid-operation acceptance, one slice at a time |
| [Asteroid competition hub](references/redesign/ASTEROID-COMPETITION-HUB-SOURCE.txt) | Physical competition destination, not a decorative map or its own match authority |
| [Multiplayer universe architecture resend](references/redesign/MULTIPLAYER-UNIVERSE-ARCHITECTURE-RESUBMITTED-SOURCE.txt) | Byte-identical to the [existing archive](references/redesign/MULTIPLAYER-UNIVERSE-ARCHITECTURE-SOURCE.txt); preserves source provenance, not a second network implementation |
| [Orbital Operations Network directive](references/redesign/ORBITAL-OPERATIONS-NETWORK-DIRECTIVE-SOURCE.txt) | Universe locations, authorized operation lifecycles and observer-safe discovery; not permission to invent live opponents |

## Storyline and route reconciliation

Current client code still has distinct catalogs: `campaign.ts` owns Contact →
Beacon → Warden → Cage and recovered intel; `sector-missions.ts` owns Rust Disc
→ Mars Approach → Pale Beacons plus independent Iron Eclipse; and
`sector-navigation.ts` advances only its recorded sector-discovery chain. The
route atlas is informational and separately marks local, compatibility, and
planned locations. These are useful foundations, not a unified story graph.

The new connected-storyline slice links those existing identities to Mars
locations for navigation context. Mars Approach is a travel bridge, not a new
campaign gate. Iron Eclipse keeps its operation identity while its narrative
chronology is reconciled. The atlas adds no launch, event, unlock, multiplayer,
reward, or persistence authority.

**Next architecture gate:** resolve story chronology and stable route/operation
identities before consolidating catalogs. Then migrate one bounded operation
through the shared contract. Operation NIGHTFALL is the first complete
continuous-Mars journey acceptance target in the source documents; it is not
implemented by the atlas/thread display.

## Reconcile the engine terminology

Orbital is the **primary, evolving flight and combat foundation** of Infinite
War. One universe and shared account/operation contracts do not mean forcing
every existing experience into one giant server process or identical physics.
Different modes keep their objectives and specialized adapters; existing
Rust Disc, sector, campaign and Wing runtimes stay playable while a versioned
Orbital replacement is proven. A specialized side experience may continue when
consolidation would destroy its mechanics or break authority. It must not
become a *new*, incompatible universe, identity, progression or reward owner.
No legacy deletion or network protocol switch is authorized by saving these
documents alone.

The preserved sources describe a future live observer watching actual matches.
Today's local docking scene, public directory marker and two-device private
room test are distinct evidence. Never render fixtures/AI as live humans. A
public marker cannot authorize a match seat, and a local docking animation
cannot change account location or grant rewards.

## Actual foundation and gaps

| Contract | Verified implementation owner | Boundary not yet proven |
|---|---|---|
| Flight and weapons | Shared `@workspace/orbital-sim` and local `Arena`; retained specialized mode adapters | All-mode parity, continuous sector flight and one renderer lifecycle |
| Controls | Orbital offline `PilotFlightStick` → `input` → shared pilot adapter → spatial rules | Cinder approach still used a separate stick/throttle mapping before this slice; physical-device parity not proven |
| World/identity | Existing authenticated `world`, `/universe` navigation and account-scoped travel | Chart movement is not free continuous flight or a multiplayer seat |
| Operations | Existing public operation directory, event stream and independently owned rooms | Server-owned nearby ship/combat proxies and authorized spectator snapshots do not exist as proven live features |
| Competitive Wing | Existing socket, matchmaking, authority, eligibility and reward ledger | Orbital competitive protocol and ten-human staged evidence not established |
| Co-op | Retained server-owned sector paths and gated Orbital co-op candidate | Full paired-play acceptance, interruption and payout parity not certified |

The complete mode/import inventory and rollback gates remain in
[the Orbital runtime direction](INFINITE-UNIVERSE-ORBITAL-RUNTIME-DIRECTION.md)
and [the engine migration matrix](engine/GAME-MODE-MIGRATION-MATRIX.md).
The ten requested architecture documents already exist under
[`engine/`](engine/MASTER-ENGINE-ARCHITECTURE.md) — they are working assessments,
not certificates of a completed multiplayer universe.

## Implementation order and evidence gates

1. **This reviewable slice:** reuse the canonical two-thumb offline Orbital
   pilot input in the existing Cinder Ring local approach. Preserve its actual
   3D docking gate, no-reward/no-seat return and existing scene/physics
   boundaries. Regression-test motion, neutralization and control compatibility.
   This is a real control migration, **not** a complete runtime or rendering
   migration.
2. **Next engine consolidation:** one versioned operation adapter and repeated
   client/server rules, recorded for each mode; do not retire legacy mode
   until equal mission/physics/replay/progression behavior passes parity.
3. **Next multiplayer foundation:** real authenticated operation-instance
   lifecycle and public status projection from the authoritative server.
   Keep room codes, hidden positions and private/AI-fill sessions out of the
   directory. Any nearby read-only events must be derived from actual server
   state and bounded by visibility/expiry policy.
4. **Only then:** separately authorize read-only spectators, demonstrate
   real multi-pilot orbital combat and reconnect, prove two independent
   operations and physical Android performance. Competitive rewards stay
   disabled until the ten-authenticated-human and economy gates pass.

Evidence for the current slice belongs in
[the redesign implementation report](REDESIGN-IMPLEMENTATION-REPORT.md).
Neither the five documents nor automated synthetic seats are staging or
Production certification. No Production deployment or data migration is part
of this slice.
