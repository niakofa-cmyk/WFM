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
| Visible physical mounts | Main Three.js shared flight now renders compatible issued-fit classes on the own ship and nearby equipped actors. Geometry follows the existing hull transform; the stream excludes private inventory IDs. | Native companion still uses integral fittings. Per-hardpoint recoil, reload animation, muzzle/emitter agreement, hangar detach/attach animation and physical-phone appearance are not certified. |
| Enemy loadout provenance | Issued player fits survive configured checkpoint restoration. AI ships have combat capabilities and integral hull models. | AI stock weapons are not yet one modular enemy manifest driving firing, presentation and exact recoverable equipment. Empty AI manifests must not be advertised as completed modular enemy loadouts. |
| Destruction-based salvage | Authorized kill-ledger recovery, physical crates, owned equipment and duplicate-claim protections exist. | The legacy package chooses from a deterministic catalog pool. That is not proof the victim carried the result. Survival must use the original issued enemy equipment and validated destruction state. |
| Distinct weapon behavior | Existing cannons, rotary guns, railguns, guided/unguided ordnance and equipment effects have resource/combat rules. | A model or catalog description does not establish a sustained beam, charged mode, independent turret or every proposed armor interaction. |
| Discoveries and resources | Scenery, wreck recovery, stations, energy mechanics and world infrastructure provide foundations. | The six-category discovery economy, persistent deposits, resource cargo, research and manufacturing loop are proposals, not enabled features. |
| Repairs and upgrades | Compatible fitting and ownership are established boundaries. | A complete condition repair, material consumption and manufacturing service still needs implementation and verification. Do not equate a displayed condition value with working repairs. |
| Shared persistence | Runtime checkpoint tests establish specific configured recovery behaviors. | These tests and the appearance stream do not certify a deployed multi-instance universe or physical-device performance. |

## Next prerequisite: one real enemy equipment manifest

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
