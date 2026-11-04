# Infinite War feature integration matrix

| Existing feature | Decision | Destination in the unified game | Preserve unchanged until | First integration proof |
|---|---|---|---|---|
| Orbital Combat Lab | **Evolve** | Canonical combat foundation and training harness | Deterministic parity, mission ownership, offline/no-reward boundary | Repeatable end-to-end combat objective and result |
| Rust Disc | **Retain and consolidate** | First explorable 3D sector and flight certification | Existing sector protocol and client/server parity are protected | Travel/briefing into Rust Disc, cooperative objective, recorded discovery |
| Iron Eclipse | **Retain and integrate** | Major cooperative campaign/universe operation | Server AI wing, subsystem damage, extraction, and zero-credit discovery remain intact | Full order → subsystem → extraction → idempotent debrief |
| 5v5 Online Wing | **Retain; migrate incrementally** | Competitive warfront in a connected universe sector | Ten-human auth, balanced teams, reconnect, server-owned results, reward ledger, feature flags | Ten distinct humans share 3D state on a coordinated staging build |
| Campaign / Strike | **Retain and connect** | Narrative operation chain through the shared mission framework | Existing server-issued runs, replay checks, claim transaction, and story progress | Mission brief/loadout → canonical combat → validated debrief → one persisted clear |
| Armory / Market | **Consolidate** | Unified Hangar and station services | Account ownership, transactional balance/inventory, saved loadout, competitive normalization | Loadout persists through navigation/reload and is used by launch config |
| Persistent Galaxy / World | **Evolve** | Connected sector navigation and strategic operations map | Server-owned travel, unlocks, discoveries, contracts, and offline-snapshot labeling | Authenticated travel opens a real linked destination and refreshes world state |
| Public Wing leaderboard | **Retain** | Competitive standing/warfront overview | Opt-in callsign, aggregate public score, and private-account exclusions | Server-derived eligible results update standings with privacy tests |
| Local trainer / Combat Lab | **Retain as training** | Training and flight-certification destination | No live socket, progression write, or reward claim | Remains usable signed out and is proven to send no settlement request |
| Old menu commands | **Replace gradually** | Contextual Campaign, Hangar, Operations, and Universe destinations | Every existing action remains reachable until its replacement passes | Player can identify location, next operation, and account state in one journey |
| Duplicate simulations/frameworks | **Retire only after proof** | One versioned simulation contract, one production renderer | Callers, saved data, tests, feature gates, and rollback are accounted for | Parity suite and migration acceptance pass before removal |
| Needle Engine | **Research only** | Possible authoring workflow; not production runtime | A benchmark demonstrates a material benefit without duplicating runtime | Separate measured experiment; no production dependency until approved |
| Persistent faction territory | **Future extension** | Server-authoritative strategic universe layer | Result authenticity, faction rules, transaction/idempotency, and rollback are designed | Replayed/invalid operations cannot change territory; valid result applies once |
| Space anomalies | **Future extension** | Versioned sector hazards affecting flight/navigation | Bounded deterministic force and synchronized server snapshot exist | Client/server replay agrees and reconnecting pilots see the same hazard state |

## Migration rule

“Retain” means keep functioning behavior and data while integration is built;
it does not mean the current UI or runtime is the final design. “Evolve” means
move responsibility through compatibility adapters and tests, not replace it
in place. No legacy mode or schema may be removed until its users, records,
tests, migration, and rollback are all accounted for.
