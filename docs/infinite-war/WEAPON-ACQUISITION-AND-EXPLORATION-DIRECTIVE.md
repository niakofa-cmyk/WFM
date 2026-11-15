# WFM physical weapons, salvage and exploration directive

## References reviewed in full

Reviewed on 2026-11-14:

- [Unaltered creator attachment](references/WEAPON-ACQUISITION-AND-EXPLORATION-CREATOR-REFERENCE.txt):
  463 lines, 27,342 bytes; SHA-256
  `bbddcf0d5d3b16cbf21e5ab3678c2d622a95b0a605f37ce83522561fd6a6689c`.
- [Public shared discussion](https://chatgpt.com/s/t_6af8bb17a37081918f924756a20d01ca)
  and [captured article body](references/WEAPON-ACQUISITION-PUBLIC-DISCUSSION.md).
  The article was accessible without sign-in; retrieval was not truncated.
- [Existing equipment architecture and verification](MODULAR-MILITARY-EQUIPMENT.md)
  and [Einhänder-to-Orbital translation](EINHANDER-ORBITAL-DESIGN-TRANSLATION.md).

The sources are design proposals, not evidence that all their systems exist.
The supplied illustrations and commercial-game examples are visual research,
not permission to import third-party models, textures or sounds.

## Adopted direction

Weapons are physical military equipment. Their compatible installation,
authoritative firing, condition, visible presentation and recorded origin must
agree. The intended loop is:

**Discover → engage or investigate → disable → salvage → recover → fit at a
service boundary → customize → return to the same living universe.**

Acquisition is not limited to kills:

1. **Enemy salvage:** recover surviving equipment actually issued to that enemy.
2. **Exploration:** discover caches, deposits and technology through scanning and
   navigation; not every asteroid contains loot.
3. **Derelicts and installations:** investigate wrecks, stations, research sites,
   ancient installations and supply depots.

Mission/commander rewards, faction research and manufacturing are additional
progression paths, not reasons to create another gameplay runtime.

This extends the first phase of the existing six-phase military development
order. It does not authorize implementing the whole economy, destruction
system and presentation overhaul simultaneously.

## Preserve the universe and authority

- Keep the hangar as the continuous-universe entrance. Keep Three.js as the
  primary Orbital presentation and the native WebGL2 companion supported.
  The source's conditional wording about a “legacy scene” does not change this
  engine decision or authorize replacing Three.js.
- Keep flight, encounters, weapon contacts, rewards and inventory server-owned.
  Renderers and menus cannot grant equipment or report authoritative survivors.
- Keep the shared campaign timeline, celestial coordinates, authenticated pilot
  presence, ownership leases and checkpoint fencing. A source must not reset
  independently for each arriving player or each socket instance.
- Keep existing fitting compatibility, ledger identities, finite ammunition,
  issued-flight immutability and no-reward compatibility boundaries.
- Do not transfer or destroy a human player's owned equipment on a PvP kill
  without an explicit loss/transfer policy. Start exact-provenance salvage with
  server-owned AI equipment; never duplicate the victim's private locker item.

## Current implementation versus remaining work

| Source recommendation | Current evidence | Remaining requirement |
| --- | --- | --- |
| Weapon catalog and hull compatibility | Catalog, hardpoint kind/size, mass/power restrictions, condition and issued weapon resources are implemented and tested. | More hull-authored geometry, firing arcs and shared mount/emitter definitions require separate validation. |
| Visible physical mounts | Main Three.js shared flight renders compatible issued-fit classes and confirmed-shot muzzle flashes/recoil on the own ship and nearby equipped actors. Geometry follows the hull transform; the stream excludes private inventory IDs. | Native companion still uses integral fittings. Shared authoritative launch origins, reload animation, hangar detach/attach animation and physical-phone appearance remain separate requirements. |
| Enemy loadout provenance | Newly created persistent AI ships use versioned issued primary/secondary fittings when modular equipment is enabled. The same fit drives real weapon resources, nearby appearance and destruction evidence; configured checkpoints retain it. | Native companion geometry, richer fleet-role loadouts, non-weapon NPC modules and physical-phone appearance still need separate work. Older actors are not retroactively refitted. |
| Destruction-based salvage | New receipts freeze actual fitted equipment and aggregate subsystem survival. Versioned recovery preserves source/condition and the existing one-package claim identity. | Historical catalog packages remain historical. Individual turret hit geometry, volatile ordnance rules, multiple packages per wreck and deployed cross-instance certification are not established by these checks. |
| Distinct weapon behavior | Existing cannons, rotary guns, railguns, guided/unguided ordnance and equipment effects have resource/combat rules. | A model or catalog description does not establish a sustained beam, charged mode, independent turret or every proposed armor interaction. |
| Discoveries and resources | Scenery, wreck recovery, stations, energy mechanics and world infrastructure provide foundations. | The six-category discovery economy, persistent deposits, resource cargo, research and manufacturing loop are proposals, not enabled features. |
| Repairs and upgrades | Compatible fitting and ownership are established boundaries. | A complete condition repair, material consumption and manufacturing service still needs implementation and verification. Do not equate a displayed condition value with working repairs. |
| Shared persistence | Runtime checkpoint tests establish specific configured recovery behaviors. | These tests and the appearance stream do not certify a deployed multi-instance universe or physical-device performance. |

## Issued enemy equipment foundation

Before a new enemy enters service, issue a validated, versioned equipment
manifest owned by the authoritative fleet/ship identity:

- Canonical campaign/universe, fleet and ship identities.
- Hull, hardpoint identity, equipment definition and private physical item
  identity; condition and source metadata.
- The actual issued ammunition/power/heat rules and immutable loadout version.
- A mapping between installed equipment and relevant subsystem damage.

The **same** manifest must drive combat adapters, public visible classes and
the destruction evaluator. Generate once and persist; a reconnect, owner change
or restart must not reroll equipment, erase casualties or refill magazines.
Do not add a disconnected generator which is never used by live enemy firing.

Only the public class/slot subset belongs in nearby appearance packets.
Ownership, private physical item identity, unrevealed caches and cargo remain
server-side. Interest filtering must match authorized spatial visibility.

## Destruction and recovery rules

Freeze authoritative destruction evidence against that issued manifest:

| Outcome | Intended consequence |
| --- | --- |
| Intact | A surviving installed item may become recoverable, subject to eligibility and compatibility. |
| Damaged | Preserve its condition; require a supported repair path before a broken item is serviceable. |
| Destroyed | Never award the destroyed weapon. Materials require an implemented resource ledger, not a silent weapon replacement. |
| Volatile | Dangerous cargo requires a real server-owned hazard and readable warning; a cosmetic glow is not a damaging simulation. |

Current subsystem regions are not exact per-turret collision geometry. Do not
claim a particular individual launcher survived solely from an aggregate hull
health value. Define and test the subsystem-to-item survival rule explicitly.

Create a versioned, durable salvage result from the original manifest and the
frozen damage evidence. The claim transaction must validate the server-owned
kill/outcome, claimant eligibility, current pilot state, physical proximity and
source availability. Claiming through the hangar, live flight, two devices or
two owners must resolve against the same source identity and at most one
authorized equipment allocation.

Do not reinterpret old catalog-based claims as exact-provenance claims. Keep
their historical source identities and compatibility, while new provenance
records use an explicit version and migration path. Repeated settlement,
reconnect and checkpoint replay cannot generate additional copies.

## Exploration and resource economy

Use the source's six categories with meaningful differences:

| Site | Potential yield | Required boundary |
| --- | --- | --- |
| Asteroid deposit | Minerals, alloys, rare crystals | Server-defined deposits; empty/common sites remain normal. |
| Abandoned wreck | Equipment, ammunition, components | Stable provenance and the existing recovery/ownership boundary. |
| Research station | Blueprints, experimental technology | Authorized discovery/objective completion, not merely viewing a marker. |
| Energy anomaly | Specialized energy or materials | Negotiated server hazard rules and explicitly defined resource types. |
| Ancient installation | Rare technology | Shared campaign/story gates and server-owned investigation state. |
| Supply depot | Ammunition, cells, military stores | Finite server inventory, faction/mission eligibility and durable claims. |

Discoveries need canonical site IDs, authoritative scan/range/equipment checks,
claim/depletion state and bounded synchronization. Cosmetic seeded scenery
must not automatically become a reward source. Per-pilot discovery credit, if
desired, is different from duplicating a unique physical weapon for each visitor.

Separate durable equipment items from consumable energy cells, ammunition,
alloys, crystals and crafting parts. Existing flight energy regeneration or
kill recovery does not create inventory energy cells. Avoid many interchangeable
currencies. Repair/manufacture transactions must consume real costs atomically,
preserve source history, reject insufficient resources and never make balances
negative.

The public discussion illustrates a **40% salvage / 30% exploration / 20%
missions / 10% crafting** acquisition mix. The attachment does not include this
chart's numbers. They are proposed progression targets, not measured WFM data,
drop probabilities, an implemented tuning choice or the enemy/friendly fleet
population ratio.

## Integration locations and acceptance gates

| Existing location | Responsibility in the next increment |
| --- | --- |
| `lib/orbital-sim/src/equipment.ts` | Reuse catalog, compatible fitting and resource definitions; avoid a second weapon catalog. |
| `lib/orbital-sim/src/ship-subsystems.ts` | Define validated subsystem-to-installed-item consequences without inventing exact geometry. |
| `artifacts/api-server/src/socket/free-flight-runtime.ts` | Issue/checkpoint actual enemy fits, use them in firing and freeze destruction evidence. Preserve leases and authority. |
| `artifacts/api-server/src/game/equipment.ts` | Version exact-source salvage alongside legacy packages; preserve eligibility and duplicate-claim transactions. |
| `lib/db/src/schema/equipment.ts` and `artifacts/api-server/src/routes/equipment.ts` | Extend durable provenance and recovery only through reviewed additive migration and authenticated service boundaries. |
| `lib/orbital-sim/src/free-flight-armament.ts` and `artifacts/war-for-mars/src/game/mounted-armament-visuals.ts` | Keep public appearance derived from the issued manifest; add shared authored mount/emitter agreement without revealing inventory. |

Required proof for the next vertical slice:

1. A compatible AI enemy is issued a known weapon. Its real combat output and
   both viewers' visible fittings use that definition; unknown/incompatible
   equipment fails closed.
2. A server-confirmed destruction evaluates those actual items. A destroyed
   launcher cannot turn into an unrelated intact railgun; surviving equipment
   keeps origin and condition.
3. An eligible pilot recovers it once at a valid source. Simultaneous hangar,
   spatial, reconnect and multi-instance attempts cannot duplicate the item.
4. The item persists in the locker, can only be fitted to a compatible hull at
   the service boundary, and only the next issued flight changes its live fit.
5. The new fitting visibly appears to nearby authorized pilots, fires from a
   verified mount/emitter, consumes its issued resources and deals validated
   damage. Unsaved drafts never affect those results.
6. Restart restores the manifest, survivors, claim state and ammunition
   consistently. Physical-device recordings and frame timings verify visual
   readability separately from Node/scene-graph assertions.

Then expand through discovery sources, resource cargo, repair/manufacture and
progression. Preserve multiplayer/persistence throughout; their position near
the end of the source's feature list is not permission to defer synchronization
until after shipping an exploitable client-side economy.

**Not performed by this document review:** new inventory grants, live loot
changes, player item losses, migrations, account creation, sign-in challenges,
staging deployment or Production changes.

## Connected implementation increment — 2026-11-14

The creator reattached this directive unchanged. Its directions remain the
foundation; this implementation adds a bounded first equipment-provenance slice,
not the entire exploration economy.

- The existing modular-equipment rollout now also controls newly issued
  persistent AI fittings. The initial conservative fit is an autocannon and
  seeker launcher on compatible primary/secondary hardpoints. Physical source
  identities derive from the persistent ship and slot. Existing actors and
  legacy receipts keep their original behavior; restoration does not reroll them.
- AI firing uses those actual catalog definitions, finite ammunition, reload,
  heat and power checks. Authorized nearby appearance publishes only slot/class
  information through the existing interest-filtered stream.
- On an authoritative NPC death, its server-issued encounter roster freezes
  the original manifest and subsystem state into a version-2 equipment outcome.
  Primary condition follows the weapons subsystem; secondary condition follows
  missile launchers. Remaining condition is rounded down. Zero is destroyed,
  1–79 damaged, and 80–100 intact. These are aggregate rules, not individual
  barrel collision claims. Non-weapon AI modules and volatile explosion outcomes
  require explicit future rules and are not issued by this version.
- Preserve the established **one kill-owned package per event/actor**. Allocate
  the first surviving issued mount in manifest order, not unrelated catalog
  gear. Do not claim every remaining weapon was recovered. An all-destroyed
  manifest produces no recoverable crate or inventory opportunity. Human PvP
  ownership and assist-only equipment allocations are unchanged.
- Store provenance in the existing immutable progression-event JSON and retain
  its permanent event/actor item-source key. No database columns or schema
  migration are required for this increment. Unknown/malformed new metadata
  fails closed instead of silently using the historical generator.
- Spatial and hangar recovery share the same owned outcome and transactional
  source. Recovery remains locker-only; fitting requires a compatible hull and
  a new issued flight. Live combat cannot replace its immutable equipment.
- New encounter rosters start with actual remaining ship hull, not maximum hull.
  A previously wounded target can therefore die and settle against its real
  remaining health. Existing saved encounter rosters are not rewritten.

Verification separates deterministic/server proof from visual/device proof:
the regression fixtures exercise real AI firing and projectile destruction,
matching two-viewer fitting/contact data, source restoration and continued flight.
SQL-backed tests exercise concurrent hangar/spatial recovery, an all-destroyed
manifest, condition retention, compatible fitting and permanent retry denial.
The complete workspace regression run passed **920 tests**, with one existing
explicit skip; all type checks, package builds, bundle audits and four static
preview checks also passed. Three.js remained outside the initial static graph
(main initial JavaScript 106,802 B gzip; lazy Three.js 138,117 B gzip).
These are isolated automated fixtures, not authenticated physical-phone footage,
live multi-owner certification or proof of authored muzzle/recoil alignment.
The running Development socket reports process-local transport and no configured
checkpoint store. Runtime recovery was exercised with test checkpoint adapters;
the separate recovery-transaction tests used SQL-backed records. Neither
establishes durable multi-instance behavior for this running Development service.

Still next: authoritative launch-origin agreement and physical-device appearance/performance,
then bounded exploration/derelict acquisition and real consumable-resource cargo.
No staging/Production deployment or human inventory transfer was performed here.

## Mounted firing presentation — 2026-11-14

Confirmed `freeflight_weapon_fired` events now drive the equipped Three.js
primary/secondary mount belonging to that source actor. The own ship, nearby
human pilots and equipped AI use the same controller. A weapon that does not
match the issued visible fitting cannot animate another mount.

Model-local emitters sit just beyond the authored barrel/launcher nose.
Recoil affects the moving weapon assembly, not its hardpoint base, ship pose,
flight controls or camera. Rotary/rocket multi-tube appearances alternate tips.
Muzzles inherit hull rotation, scale and floating-origin movement directly.

Flashes and materials are reused instead of allocating a new object per shot.
Detail visibility, fit replacement, actor removal, disposal and session changes
cancel old feedback. A bounded, short-lived launch queue tolerates a briefly
late fitting snapshot, suppresses recent duplicate launches and never invents
launches from recovered projectile-motion or fitting snapshots.

**Authority boundary:** this aligns visible flashes/recoil with visible geometry.
It deliberately does not move server projectiles, aim rays, damage contacts or
hit/explosion effects onto a client-selected muzzle. A future change to actual
launch origins requires a shared, versioned simulation contract and compatibility
proof across renderers and replay. Native companion weapon effects are unchanged.

Verification: all **516 frontend tests** passed, including own/nearby source
matching, every compatible cannon/launcher template, hull transform/origin
inheritance, expiry/reset, bounded queues, resource disposal and sustained firing
without geometry growth. Workspace type checks, package builds, bundle audits
and four static-preview checks passed. These are scene-graph/automated checks,
not physical-phone battle footage or GPU frame-time certification.
