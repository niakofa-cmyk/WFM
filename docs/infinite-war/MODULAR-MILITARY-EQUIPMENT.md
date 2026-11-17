# Modular military equipment ecosystem

## Creator direction

War for Mars equipment is a military ecosystem, not a succession of generic
weapon replacements. Each hull has primary, secondary, special, defensive and
utility mounts. Physical mount size, mass, reactor capacity and serviceability
must constrain fitting. A reconnaissance fighter cannot carry a capital cannon;
heavy platforms have larger mounts and additional utility capacity.

Creator reference: the aircraft equipment spread supplied as
`attached_assets/MMRqMZfNTnOFMNyK8s1NWl0WMI6eGhPwoxLc4JMeSf1AfSHwBt6IoMdaOHUty_1794598348514.jpeg`.
This is a reference for military modularity, not licensed WFM aircraft artwork.

## Implemented equipment contract

The shared catalog records damage, ammunition, magazine capacity, cadence,
nominal range, projectile velocity, tracking turn rate, acquisition time, reload
duration, heat, durability, per-shot energy, size, mass and power draw.

- Primary: autocannon, rotary gun, railgun; capital cannon is catalogued but no
  current fighter hull supports its size-4 mount.
- Secondary: active seeker, unguided rocket and heavy torpedo.
- Special: plasma feed, EMP contact injector and reinforced-warhead adapter.
  These are weapon adapters, not separate additional fire buttons. Plasma/EMP
  need a modular primary; warheads need a modular secondary.
- Defensive: flare and hardened-countermeasure packages.
- Utility: targeting sensor, electronic warfare filter, shield generator,
  armor, auxiliary power and fleet communications.

Weapon modules use finite sortie ammunition, automatic magazine reloads,
heat lockout/cooling and reactor energy. Recovered weapon condition scales damage
between 75% and 100% of catalog output. Condition is durable inventory metadata;
this package does **not** introduce accumulating combat wear, field repair,
weapon trading or an ammunition purchasing economy.

Primary range is nominal, not a new immunity gate: existing selected-target
projectile lifetime extension remains. Direct physical projectile hits retain
the authoritative swept-contact damage path. Unguided rockets need no lock.
Guided missiles retain lock/cone/cover checks and actual steering limits.

## Military ownership and fitting

One inventory row represents one physical module, including recovered condition.
A module must be explicitly removed from its previous mount before mounting it
elsewhere. Unique database indexes prevent simultaneous duplicated assignments.
Server transactions lock the account's equipment locker and reject stale
revisions, incompatible mounts, unserviceable equipment, duplicate utility
effects and mass/power overloads. Disallowed changes roll back entirely.

New lockers receive six issued basic modules. They are not automatically fitted.
An empty primary/secondary mount retains the hull's original integral backup
weapon. Optional mounts are inactive when empty.

The existing hangar Armory → Loadout & Systems contains the equipment bay,
compatibility previews, complete module statistics, fitting/unfitting, condition
and verified salvage recovery. A successful response replaces the account-scoped
cache; refresh-on-mount and finite freshness cover other sessions.

## Kill-to-recovery boundary

Recovery reads existing server-settled patrol exploration ledger records. A
package requires a credited, rewardable destroyed NPC owned by that pilot's
award. Client-reported kills, PvP, local training, assist-only records and another
account's ledger cannot issue equipment.

Each event/target pair deterministically selects one package and condition.
The database source key is permanently unique per account, making retries and
simultaneous recovery requests idempotent. Recovery does not equip the item or
charge credits. The bay lists opportunities from the newest 30 relevant ledger
records; the recovery service still checks the actual owned record.

This is hangar recovery from verified combat records, not a new rendered,
shared-space wreck-pickup system.

## Shared-universe runtime and recovery

An authenticated new flight captures its server-loaded fit. Reconnect and owner
restart preserve the checkpoint's issued modules, ammunition, reload and heat;
they do not import a newer account fit or reapply shield capacity. Existing
checkpoints without modules remain supported.

Fitting does not mutate a live craft. Freshly issued flights resupply their
modules; reconnect does not. Original replay configurations and normalized
competitive arena loadouts are unchanged. No alternate universe or launch
entry point was added.

New optional `freeflight_equipment_state` telemetry exposes primary/secondary
magazine, reserve, reload and heat. The existing missile control accepts
unguided rockets, and the compact contextual weapon status reports resource
limits. Fitted defense uses the existing countermeasure action.

## Rollout and verification boundary

Migration: `lib/db/migrations/0009_modular_equipment.sql`. It only adds equipment
tables/indexes. Apply explicitly to each authorized database before deploying
the new socket admission path; never force-push unrelated schema differences.
There is no startup-time DDL or production database conversion.

The initial implementation applies the migration to Development only. Staging
and Production require their own reviewed migration and deployment, followed
by `WFM_MODULAR_EQUIPMENT_ENABLED=1`. External environments default to stock
flight and disabled equipment endpoints until explicitly enabled, so deploying
code before a database migration does not remove existing universe access.
Development enables equipment by default (explicit `0` disables it).
Rolling socket owners must be upgraded together before enabling newly issued
module-equipped flights; mixed-version ownership is not certified.

Staging's API pre-deploy command uses
`node scripts/migrate-modular-equipment.mjs` instead of broad Drizzle schema
sync for this rollout. The helper requires the exact authorized Railway
project, environment and API service identities, uses the service's existing
database configuration internally, acquires a transaction lock, applies only
the additive equipment SQL, and verifies the unique indexes. It never prints
credentials or touches existing player records. It intentionally refuses
Production. Other schema changes need their own reviewed migration.

Unit,
database-concurrency and in-process flight/restart evidence are not a claim of
authenticated two-phone staging certification.

### Development evidence, 2026-11-13

- 38 focused server checks passed, including real database concurrency,
  cross-account denial, idempotent salvage, actual emitted gun/rocket
  projectiles, checkpointed ammunition and unchanged issued fits after restart.
- Seven final equipment UI-contract/viewport regression checks passed.
- Workspace typecheck, WFM build/bundle audits and API/socket startup passed.
  Protected equipment routes return 401 without authentication; health returns 200.
- The signed-in equipment bay and physical-phone equipped combat have not yet
  been browser-certified. The public landing capture is not flight evidence.
