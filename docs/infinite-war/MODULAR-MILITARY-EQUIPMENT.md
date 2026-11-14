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

A fitted primary or secondary without its issued resource state fails closed.
Only an actually empty mount uses the original integral weapon's rules.
Blocked shot consumption is a no-op: empty/reloading/overheated, unpowered,
rooted or destroyed craft cannot spend another round or drive counts negative.
Admission/checkpoint validation remains the first boundary; these guards also
protect the weapon adapter if called with incomplete state.

The focused armament regression also fires an actually fitted railgun through
accepted shared-flight input at a selected hostile pilot. It requires a matching
launch/contact identity, identical authoritative hull damage on both pilot
connections, one consumed magazine round, and unchanged reserve ammunition.
This is an isolated admitted-runtime fixture, not a two-phone visual claim.

## Server-issued visible fittings in the main Three.js universe

The [weapon acquisition and exploration directive](WEAPON-ACQUISITION-AND-EXPLORATION-DIRECTIVE.md)
records the full creator reference, exact-enemy provenance requirement and
acceptance gates for acquisition beyond combat-only drops.

Shared flight advertises an optional armament-presentation capability. New
clients explicitly subscribe; legacy clients receive no added appearance stream.
The server derives the appearance directly from issued craft equipment,
including checkpoint-restored fits when persistence is configured, not the
account's current Armory draft.

Each complete appearance snapshot uses exactly the same nearby/authorized actor
selection as the flight pose snapshot, at most 32 actors with 8 compatible
hardpoints each. Updates occur no more often than every 15 simulation ticks
(about twice per second at 30 Hz). Repeated subscriptions send no extra snapshots.
Only actor ID, hull ID, hardpoint ID and equipment definition ID are public.
Inventory instance IDs, cargo, module condition and account identity are excluded.

The main Three.js renderer attaches original, low-poly military equipment to
the hull's existing weapon/launcher attachment positions and auxiliary points.
Railgun rails, rotary barrels, cannon barrels, rocket pods, guided ordnance,
defensive cassettes and special/utility packages represent their actual fitted
classes. Replaced integral gun/round models are hidden while the fit is known;
empty/legacy/unavailable manifests retain the ordinary integral hull models.
These are equipment-class models, not unique cosmetic skins per inventory item.

Fits follow the ship's existing position, orientation and scale, including the
shared floating-origin frame. No camera, flight controls, hitboxes, ammunition,
target locks or damage values are changed. Empty fits allocate no attachment
meshes. Near-neighbor detail is limited to 250 metres and at most 24 added meshes
per hull; repeated identical snapshots reuse geometry. Actor removal, hull
replacement and scene disposal release attachment resources. Session changes,
reconnects, stale telemetry and invalid/incompatible packets clear appearance.

Native WebGL2 companion ships still use their integral hull fittings. These
appearance changes do not yet establish an enemy equipment manifest that drives
its combat and its exact surviving recoverable loot. Physical-phone appearance,
explosion pixels and frame timing also remain separate, unproved acceptance gates.

### Verification of this increment

- Workspace typecheck passed.
- Frontend: 509 passing tests, including compatible/incompatible attachment
  models, real hull-transform inheritance, geometry reuse and resource disposal.
- Backend: 345 passing tests with one existing explicit skip. The new fixture
  verifies matching issued-railgun appearance for two viewers after checkpoint
  restoration despite a changed account draft; nearby/session privacy, opt-in
  cadence, duplicate-subscription protection and transient-state stripping.
- Scripts: 61 passing tests. All package builds and four static-preview checks
  passed. Main initial JavaScript remained 106,802 bytes gzip; Three.js remained
  lazy and outside the initial graph. Audit limits were not relaxed.
- The combined shell command timed out after tests during build. The remaining
  package-build stage passed separately; tests were not repeated to fill that gap.
- No authenticated physical-phone battle, GPU frame-time measurement, staging
  sign-in, migration, staging deployment or Production change was performed.

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

## Mounted launch feedback

Main Three.js shared flight maps server-confirmed launches to the source actor's
actual issued weapon. Muzzle flashes follow authored barrel tips and moving
barrels recoil independently of the stationary mount. The same controller serves
the player and nearby human/AI ships, with bounded launch deduplication and no
per-shot geometry allocation. Visibility/session changes clear old feedback;
recovered projectile snapshots never replay firing animations.

This is presentation alignment, not a change to authoritative projectile origins,
collision, damage, controls or camera. Native companion effects remain unchanged.
Physical-phone rendering and shared server/renderer launch-origin agreement are
still separate verification requirements. See the
[acquisition directive](WEAPON-ACQUISITION-AND-EXPLORATION-DIRECTIVE.md#mounted-firing-presentation--2026-11-14).

## Kill-to-recovery boundary

Recovery reads existing server-settled patrol exploration ledger records. A
package requires a credited, rewardable destroyed NPC owned by that pilot's
award. Client-reported kills, PvP, local training, assist-only records and another
account's ledger cannot issue equipment.

Historical event/target pairs retain their original deterministic catalog package.
New version-2 physical-equipment outcomes allocate one surviving weapon from the
actual issued enemy manifest, retaining its subsystem-derived condition. No
surviving weapon means no equipment claim; malformed new records never fall
back to the old catalog pool. See the
[acquisition directive](WEAPON-ACQUISITION-AND-EXPLORATION-DIRECTIVE.md#connected-implementation-increment--2026-11-14)
for source identities, survival rules and remaining scope.
The database source key is permanently unique per account, making retries and
simultaneous recovery requests idempotent. Recovery does not equip the item or
charge credits. The bay lists opportunities from the newest 30 relevant ledger
records; the recovery service still checks the actual owned record.

### Physical recovery in the shared universe

Continuous-flight NPC destruction now leaves a server-owned equipment crate at
the destroyed ship's absolute celestial coordinates. The crate is a wireframe
military package in the existing Three.js scene, not a new salvage runtime or
launch route. It shares the ships' floating-origin transform and streams through
the existing single-owner/Redis ingress routing.

Crates are pending until the encounter's reward ledger is settled. Only the
pilot credited with that specific rewardable NPC kill can recover it; assists,
friendly casualties, AI-only kills, PvP and training cannot issue a package.
Nearby pilots can see the physical crate but do not receive another account's
identity or inventory data. Within 60 metres a living eligible pilot gets the
contextual **Recover wreck package** action. A successful recovery removes the
crate and invalidates the account's equipment-bay cache. The item goes to the
locker, not onto a live hardpoint; the issued-flight boundary is unchanged.

The client sends only the package identifier and protocol version. The socket
owner first saves a fresh fenced checkpoint. The equipment transaction locks
that checkpoint, verifies the fencing token, ship life, absolute position and
package ownership, then resolves the existing owned combat ledger. Both hangar
and spatial recovery insert through the same event/target source key and locker
transaction. Simultaneous or repeated requests therefore issue one physical
item, not one per recovery surface.

The package state and item commit in the same transaction. Checkpoint writes
preserve already-recovered package tombstones so a queued pre-claim write cannot
resurrect a crate. The session checkpoint includes pending, available and
recovered packages; old checkpoints with no packages remain supported.
At most 128 crates are retained per spatial session. Recovered records are
reclaimed first; the oldest settled crate can then leave the spatial display to
make room for new destruction. Its permanent ledger recovery remains available
through the equipment bay's existing recovery rules.

The existing equipment rollout gate and a configured durable checkpoint store
are required. Isolated process-local Development without that store does not
advertise physical pickup actions; hangar-ledger recovery remains available.
This does not silently enable a second persistence mode or change environment
configuration. No new database table, migration,
startup DDL, production deployment or public recovery endpoint is introduced.
Older already-settled historical kills are not retroactively fabricated into
world-space wrecks without a trustworthy destruction position.

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

### Physical-salvage verification

Regression coverage exercises real two-pilot combat destruction, crate location,
kill-versus-assist ownership, continued flight, replacement-owner streaming,
cross-ingress recovery, and recovered crates remaining absent after restart.
Database tests race hangar and spatial recovery, reject foreign pilots, distant
or disabled ships and stale fencing tokens, and verify a queued checkpoint write
cannot resurrect a recovered package. Rendering tests verify rebasing, crate
updates and geometry/material disposal. These are automated Development checks,
not authenticated staging or physical-device certification.

### Development evidence, 2026-11-13

- 38 focused server checks passed, including real database concurrency,
  cross-account denial, idempotent salvage, actual emitted gun/rocket
  projectiles, checkpointed ammunition and unchanged issued fits after restart.
- Seven final equipment UI-contract/viewport regression checks passed.
- Workspace typecheck, WFM build/bundle audits and API/socket startup passed.
  Protected equipment routes return 401 without authentication; health returns 200.
- The signed-in equipment bay and physical-phone equipped combat have not yet
  been browser-certified. The public landing capture is not flight evidence.
