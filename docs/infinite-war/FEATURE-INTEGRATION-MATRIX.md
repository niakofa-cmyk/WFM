# Infinite War feature integration matrix

| Existing feature | Decision | Destination in the unified game | Preserve unchanged until | First integration proof |
|---|---|---|---|---|
| Orbital Combat Lab | **Evolve** | Canonical runtime for every operation; offline/no-reward training harness | Deterministic parity, mission ownership, offline/no-reward boundary | Repeatable end-to-end combat objective and result |
| Rust Disc | **Extract and migrate** | Canonical orbital runtime with a Rust Disc flight/mission configuration; keep the current experience available as a rollback path during migration | Existing flight feel, server-owned sector protocol, no local reward or persistence | Shared movement/control adapter passes parity; a versioned Rust Disc operation launches in Orbital, validates its objective, and retains the existing entry until rollback is no longer needed |
| Iron Eclipse | **Retain and integrate** | Major cooperative campaign/universe operation | Server AI wing, subsystem damage, extraction, and zero-credit discovery remain intact | Full order → subsystem → extraction → idempotent debrief |
| 5v5 Online Wing | **Migrate incrementally** | Competitive warfront in a connected universe sector using canonical orbital combat | Ten-human auth, balanced teams, reconnect, server-owned results, reward ledger, feature flags | Ten distinct humans share canonical 3D state on a coordinated staging build |
| Campaign / Strike | **Migrate every sortie** | Narrative operation chain through the shared mission framework and canonical engine | Existing server-issued runs, replay checks, claim transaction, and story progress | Every sortie launches its configured canonical runtime and settles one validated clear |
| Armory / Market | **Consolidate** | Unified Hangar and station services | Account ownership, transactional balance/inventory, saved loadout, competitive normalization | Loadout persists through navigation/reload and is used by launch config |
| Persistent Galaxy / World | **Evolve** | Connected sector navigation and strategic operations map whose operations all launch the canonical engine | Server-owned travel, unlocks, discoveries, contracts, and offline-snapshot labeling | Authenticated travel opens a canonical-runtime operation and refreshes world state |
| Public Wing leaderboard | **Retain** | Competitive standing/warfront overview | Opt-in callsign, aggregate public score, and private-account exclusions | Server-derived eligible results update standings with privacy tests |
| Local trainer / Combat Lab | **Retain as training** | Training and flight-certification destination | No live socket, progression write, or reward claim | Remains usable signed out and is proven to send no settlement request |
| Old menu commands | **Replace gradually** | Contextual Campaign, Hangar, Operations, and Universe destinations | Every existing action remains reachable until its replacement passes | Player can identify location, next operation, and account state in one journey |
| Duplicate simulations/frameworks | **Retire only after proof** | One versioned simulation contract, one production renderer | Callers, saved data, tests, feature gates, and rollback are accounted for | Parity suite and migration acceptance pass before removal |
| Needle Engine | **Research only** | Possible authoring workflow; not production runtime | A benchmark demonstrates a material benefit without duplicating runtime | Separate measured experiment; no production dependency until approved |
| Persistent faction territory | **Future extension** | Server-authoritative strategic universe layer | Result authenticity, faction rules, transaction/idempotency, and rollback are designed | Replayed/invalid operations cannot change territory; valid result applies once |
| Space anomalies | **Future extension** | Versioned sector hazards affecting flight/navigation | Bounded deterministic force and synchronized server snapshot exist | Client/server replay agrees and reconnecting pilots see the same hazard state |

## Mobile flight-control migration slice

Orbital Lab and the already-authorized Orbital Contact sortie share the same
Arena input path. That path now exposes a compact third touch stick for lateral
and vertical vector thrust, alongside steering and aiming. It maps to the
existing Orbital `strafe` and `vertical` controls, starts neutral, and clears
when focus is lost. Legacy surface modes do not receive those axes.

The local Rust Disc entry now also opts into `orbital-motion-v1` for six-axis
movement through a cached adapter around `integrateSpatialFlight`. The existing
operation wrapper still owns relay/drone/extraction objectives, collision
damage, and projectiles. Networked expeditions remain on `sector-motion-v1`;
their socket contract, rewards, and progression were not changed. This is a
movement slice, not a completed Orbital Rust Disc operation.

The next mode-runtime sequence remains:

1. Finish Rust Disc weapons and mission/objective behavior on the canonical
   runtime; preserve the current network operation as a rollback path.
2. Migrate remaining Arcade and campaign sorties one objective/replay contract
   at a time; retain old issued runs and server settlement rules.
3. Migrate Iron Eclipse co-op and competitive Wing only after their server-owned
   movement, matchmaking, reconnect, and reward boundaries pass parity tests.

Do not count a shared touch control or an Orbital Lab demonstration as proof that
those complete mode migrations have shipped.

## Connected-universe implementation note — 2026-11-04

The first Orbital Operations Network slice adds a public operation directory,
read-only SSE snapshots, and the Cinder Ring world destination. The only catalog
entry is local Rust Disc flight training on `flight-sector-v1`. Authenticated
players can register an expiring single seat at the server-verified location;
public status is opt-in and anonymous. This is still solo local training, not a
multiplayer match. The additive PostgreSQL schema must be applied to staging
before the DB-backed lifecycle is available there.

The owner's latest engine directive makes this an integration bridge, not a
permanent separate gameplay engine. See
[`MASTER-ENGINE-FEATURE-EXTRACTION.md`](./MASTER-ENGINE-FEATURE-EXTRACTION.md)
for the current source-backed inventory and staged Orbital migration gates.

## Migration rule

“Retain” means keep functioning behavior and data while integration is built;
it does not mean the current UI or runtime is the final design. “Evolve” means
move responsibility through compatibility adapters and tests, not replace it
in place. No legacy mode or schema may be removed until its users, records,
tests, migration, and rollback are all accounted for.
