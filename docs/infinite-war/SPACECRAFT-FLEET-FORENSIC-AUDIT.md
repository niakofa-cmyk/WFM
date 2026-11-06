# Orbital Combat Lab — Spacecraft and Fleet Forensic Audit

**Audit baseline:** repository commit `b765a85`  
**Source directive:** `attached_assets/Pasted--WAR-FOR-MARS-INFINITE-WAR-ORBITAL-COMBAT-LAB-MASTER-SP_1793924339098.txt`  
**Phase:** A — forensic ship and weapon audit

## Executive finding

Orbital already has a playable, deterministic spatial combat foundation, all
sixteen selectable fighter hulls, and sixteen distinct ability dispatches.
Client and API-server ship definitions and Orbital adapters currently match;
the shared `@workspace/orbital-sim` package supplies the common flight and
weapon primitives.

That is not yet a complete military fleet or weapon architecture. The named
primary and missile fits are catalog metadata, not interchangeable weapon
implementations. Missile families share one guidance model; there is no
configurable weapon loadout, general fleet director, capital-vessel class
hierarchy, or live 5v5 Orbital Wing path. Iron Eclipse has a real server-owned
capital-subsystem operation and commanded three-ship wing, but that is a
mission-specific system, not a general fleet-warfare runtime.

## Evidence and limits

- `artifacts/war-for-mars/src/game/ships.ts` and
  `artifacts/api-server/src/game/ships.ts` are byte-identical at this audit
  baseline. `orbital-shared.test.ts` also deep-compares their `SHIPS` records.
- The client and server copies of `sim.ts`, `orbital-sim.ts`,
  `orbital-weapons.ts`, and `orbital-abilities.ts` are currently identical.
  Orbital flight and weapon primitives are imported from
  `lib/orbital-sim/src/`.
- The latest recorded War for Mars test run passed **228/228 tests**; the
  workspace build/typecheck also passed. These are automated results, not
  human gameplay or physical-device certification.
- The supplied 60-second Android frame sample in the conversation was for
  Rust Disc local flight, not Orbital. This audit has no signed-in Orbital
  browser-play result, live ten-human network result, or Orbital Android
  device capture.
- `ship-certification.test.ts` runs one seed with short scripted diagnostics.
  Its own report calls 1v1 outcomes diagnostics; it is not human 5v5 balance
  certification.

## Current 16-hull definition matrix

Values below are internal simulation values, not real-world units. Flight
order is **handling / maximum speed / acceleration / turn rate / collision
radius**. Primary order is **fit label / interval in seconds / damage per
projectile / projectile speed**. Missile order is **fit label / player
ammunition / player damage**. Cooldowns are seconds.

| Ship | Faction and role | Flight | Shield / hull | Primary definition | Missile definition | Ability / cooldown |
|---|---|---:|---:|---|---|---|
| Mandjet | Accord — Vanguard | .55 / 18 / 26 / 2.15 / 1.75 | 160 / 110 | `heavy-beam` / .18 / 3.6 / 74 | `heavy-seeker` / 8 / 58 | Solar Flare / 8s |
| Shakuna | Accord — Hunter | 1.35 / 36 / 52 / 2.15 / 1.20 | 70 / 52 | `twin-pulse` / .11 / 2.2 / 64 | `interceptor` / 8 / 58 | Wing Dive / 7s |
| Sundara | Accord — Striker | .85 / 24 / 34 / 2.15 / 1.25 | 84 / 64 | `torpedo-cannon` / 1.15 / 22 / 30 | `torpedo` / 8 / 58 | Vortex Camouflage / 10s |
| Tripura | Accord — Support | .75 / 20 / 30 / 2.15 / 1.60 | 120 / 86 | `support-pulse` / .25 / 4.2 / 52 | `defense-seeker` / 8 / 58 | Trinity Shift / 11s |
| Duskbreaker | USSF — Striker | .95 / 26 / 40 / 2.15 / 1.40 | 100 / 78 | `precision-cannon` / .21 / 4.4 / 60 | `precision-seeker` / 8 / 58 | Quantum Lock / 11s |
| Sentinel-G (`sentinel`) | USSF — Support | .70 / 17 / 24 / 2.15 / 1.55 | 150 / 90 | `escort-array` / .29 / 4.8 / 48 | `escort-seeker` / 8 / 58 | Proximity Ward / 12s |
| Splitter Ring (`splitter`) | USSF — Hunter | 1.00 / 25 / 38 / 2.15 / 1.45 | 92 / 68 | `disruption-pulse` / .18 / 3.6 / 58 | `tracking-disruptor` / 8 / 58 | Ring Split / 9s |
| Glide Knife (`glide`) | USSF — Raider | 1.15 / 34 / 46 / 2.15 / 1.15 | 62 / 48 | `raider-pulse` / .20 / 3.6 / 66 | `light-seeker` / 8 / 58 | Skip Reentry / 12s |
| Wasp | USSF — Advanced Interceptor | 1.38 / 37 / 53 / 2.25 / 1.18 | 82 / 60 | `interceptor-pulse` / .115 / 2.2 / 66 | `short-range-interceptor` / 10 / 30 | Vector Pursuit / 9s |
| Valiant | USSF — Multirole Fighter | .98 / 27 / 40 / 2.15 / 1.36 | 102 / 80 | `multirole-cannon` / .20 / 3.8 / 62 | `multirole-seeker` / 8 / 50 | Adaptive Fire Control / 11s |
| Aegis | USSF — Missile-Defense Escort | .72 / 19 / 27 / 2.15 / 1.62 | 150 / 98 | `point-defense-array` / .24 / 4 / 50 | `point-defense-interceptor` / 10 / 32 | Aegis Intercept Grid / 14s |
| Bastion | USSF — Heavy Assault Gunship | .54 / 17 / 24 / 2.05 / 1.86 | 145 / 125 | `assault-cannon` / .58 / 9.5 / 48 | `anti-capital-torpedo` / 6 / 74 | Siege Configuration / 14s |
| Apep | Accord — Stealth Hunter | 1.12 / 31 / 46 / 2.15 / 1.20 | 70 / 56 | `stealth-cannon` / .23 / 4.2 / 70 | `stealth-precision` / 6 / 56 | Void Veil / 12s |
| Sekhmet | Accord — Heavy Siege Gunship | .50 / 16 / 22 / 2.05 / 1.88 | 150 / 124 | `siege-lance` / .64 / 11 / 54 | `siege-missile` / 4 / 76 | Solar Cataclysm / 16s |
| Garuda | Accord — Swarm Interceptor | 1.40 / 36 / 53 / 2.20 / 1.16 | 72 / 55 | `swarm-pulse` / .13 / 2.4 / 70 | `swarm-pod` / 12 / 28 | Phantom Swarm / 14s |
| Vajra | Accord — Tactical Warfare Support | .82 / 21 / 31 / 2.15 / 1.58 | 132 / 98 | `electronic-pulse` / .24 / 4.1 / 56 | `ew-seeker` / 8 / 44 | Thunder Veil / 14s |

`role` is a free-form string in `ShipDef`; there is not yet a typed ship-class
or weapon-compatibility model. Orbital flight computes rotational response
from `turnRate × handling`; the basic six-axis movement and collision rules are
shared across these hulls, while the values above differentiate their tuning.

## Ability behavior audit

All sixteen abilities have actual Orbital dispatch code. Their costs, cooldowns,
eligibility checks, effects, and feedback are in `orbital-abilities.ts`, and
the test suite covers activation for all sixteen plus representative effects
and all eight original abilities through `step()`.

| Ship | Energy cost | Actual Orbital effect |
|---|---:|---|
| Mandjet | 28 | Forward-cone flare; deals 26 damage to eligible targets within 34 units. |
| Shakuna | 24 | Starts a 1.7-second boost with 28 contact/ram damage. |
| Sundara | 22 | Cloaks for 4 seconds and arms one critical follow-up shot. |
| Tripura | 28 | Mutes nearby hostile thrust for up to 1.55 seconds; does not disable steering or weapons. |
| Duskbreaker | 18 | Acquires/marks a valid forward target and increases damage by 1.5× for 3.2 seconds. |
| Sentinel-G | 24 | Restores 30% of its own shield maximum and 16% for each nearby ally within 22 units. |
| Splitter Ring | 24 | Within 42 units, jams targets for 2 seconds and clears their current lock. |
| Glide Knife | 30 | Becomes untargetable for .95 seconds, boosts, and can deal 38 contact damage. |
| Wasp | 22 | For 3.2 seconds, increases yaw/pitch response and couples yaw to lateral thrust. |
| Valiant | 20 | Arms 7 shots for 4.2 seconds with a shorter interval and reduced per-shot damage. |
| Aegis | 30 | For 5 seconds, has 3 missile intercepts; protects allies within 28 units and intercepts a threatening guided missile within 15 units. Also regenerates a small shield amount while active. |
| Bastion | 30 | For 4.5 seconds, reduces movement response and increases primary damage by 1.75× while lengthening the firing interval. |
| Apep | 25 | Cloaks for 2.7 seconds; can jam a valid forward hostile contact and clear its lock. |
| Sekhmet | 40 | After a .45-second charge, fires a 42-damage, large-radius projectile. |
| Garuda | 34 | Launches up to 3 guided projectile actors, each with 9 damage, toward valid forward targets. These are not persistent drone entities. |
| Vajra | 30 | Within 26 units, jams for 2.4 seconds, delays firing, clears lock state, and drains 8 energy. |

The effects are Orbital mechanics, not just labels or VFX. Their full behavior is
not proven in the current live 5v5 Wing because that mode still selects the
surface runtime. Some legacy non-Orbital `triggerUlt()` branches cover the
original ships only; the specialist abilities are not a parity-complete
cross-mode feature.

## Weapon, missile, armor, and targeting findings

### Primary weapons

- `primaryFit` is currently read by the 3D hangar model only as
  `userData.primaryWeaponFit`; it does not select a projectile implementation.
- Orbital `spawnPrimary()` emits the same projectile shape for all ships:
  radius `.3`, lifetime `1.6s`, with speed supplied from `shotSpeed`. Orbital
  may apply aim correction inside a `.22`-radian target angle.
- Ship values do change interval, base damage, and speed. Orbital training then
  multiplies player damage by `2.2` and AI damage by `.28`. The isolated
  server-authority harness currently uses the unscaled `shotDmg`.
- The legacy surface path has a special larger, longer-lived, homing primary
  projectile for Sundara. That special case is not present in the generic
  Orbital primary-spawn path.
- Heat, ammunition, energy use, armor class, shield interaction, weapon
  families, hardpoint compatibility, and player-selectable weapon slots are
  not part of a reusable primary-weapon definition/execution contract.

### Missiles

- `missileAmmo` and `missileDamage` are consumed for the player's Orbital
  loadout; AI launches are assigned a fixed damage of `16`.
- `missileFit` itself does not select a unique runtime. All standard missiles
  require a valid target, completed `1.25s` lock, range/cone/line-of-sight
  validation, and ammunition; they launch at speed `38`, have lifetime `4s`,
  and use a shared turn-rate default of `2.5` radians/second with a `3.5s`
  launch cooldown.
- Targeting rejects dead, cloaked, untargetable, jammed, out-of-range,
  off-cone, or rock-occluded contacts. The shared target cone is based on a
  `.3`-radian limit.
- Heat-seeking, active/semi-active sensor, dumbfire, torpedo, EMP, swarm,
  interceptor, and stealth missile behaviors are not separate runtime
  implementations. Garuda’s ability creates three guided projectile records,
  not a general drone/swarm entity system.

### Damage and countermeasures

- Orbital initializes each craft with a fixed `40` armor pool; this is not
  ship-specific armor configuration.
- Damage resolves shield first, then armor, then hull. Armor consumes up to
  60% of remaining incoming damage until its pool is exhausted; there are no
  typed armor sections or subsystem multipliers for fighter hulls.
- The countermeasure input removes all opposing guided missiles from the
  current match and emits a flare visual. It does not spawn a heat decoy that
  missile guidance can select, and there is no chaff or sensor-decoy model.
- Aegis Intercept Grid provides a bounded server-simulation missile interception
  effect, but there is not a general interceptor-missile or point-defense
  architecture for all ships.

## 3D construction and presentation

`orbital-visuals.ts` contains sixteen distinct `HullBlueprint` entries with
different longitudinal profiles, wing outlines, engine mounts, guns, missile
rails, armor panels, and sensor/ring arrangements. The geometry test verifies
that all sixteen models have populated, distinct geometry and remain within
mobile-oriented mesh/draw-object/triangle budgets.

The models are made by one shared low-poly procedural builder. Faction material
language is blue/gray for USSF and bronze/amber for Accord. This is a credible
prototype foundation and is materially better than one shared named mesh, but
it is not yet the full high-detail fleet art in the directive: no separate
authored mesh assets, LOD system, animated gun mechanisms, operational
missile bays, ship-specific damage map, docking/landing animation, or
capital-scale model hierarchy is verified.

The recent hangar supports hull, engine, and weapon views, plus intact/field/
critical presentation states. The effects are explicitly presentation-only,
reversible, and separate from gameplay state. Damage currently affects the
same first engine, weapon, missile, and port armor groups on every hull; it is
not ship-specific damage simulation. Engine exhaust pulses and simple muzzle
flashes are preview animations, not proof of live weapon firing effects.

`ShipIllustration.tsx` is a separate static 2D silhouette illustration for
selection and lists. It is not gameplay geometry. `Arena.tsx` owns the Orbital
renderer and uses the procedural 3D hulls in the combat scene.

## Consumers and runtime boundaries

The ship definitions are consumed by the Home/Armory selection flow, saved
profile hull selection, mission/sector launch data, both legacy and Orbital
simulation paths, Orbital ability/weapon code, the hangar 3D models,
2D illustrations, server progression/reward validation, and the ship
certification harness. The saved loadout currently stores faction and hull ID;
it does not store selectable primary/secondary weapon equipment.

`lib/orbital-sim/src/game-mode.ts` is the source-backed mode inventory:

| Mode group | Current simulation / presentation status |
|---|---|
| Orbital Combat Lab, Local Arena practice, Contact campaign | Canonical Orbital simulation; Arena owns current Three.js presentation. |
| Rust Disc local, Rust Disc co-op, Iron Eclipse | Orbital simulation/authority adapters are declared, but presentation remains `RustDiscFlight` compatibility renderer. |
| Arcade Skirmish, legacy campaign sortie, Solo Flight | `surface-v1` compatibility simulation. |
| Competitive/live/private/AI-fill Wing | `surface-v1` socket and simulation path; not live 5v5 Orbital combat. |
| Universe navigation | Navigation UI/directory only; not an active universe combat simulation. |
| Fleet Warfare | Planned, with no gameplay renderer. |

The server Orbital authority has strict typed input, fixed-tick simulation,
server-owned target/ammunition/damage, and automated tests, but its module says
it is not registered with the existing socket service. Its test harness is not
evidence of a live ten-human Orbital match.

Iron Eclipse is a meaningful partial capital/fleet feature: the server owns a
capital position and point-defense, shield-array, and reactor subsystems; the
reactor is gated by point-defense destruction, and a three-ship wing responds
to attack/defend/escort/regroup orders. The wing follows fixed offsets and the
encounter is mission-specific. It is not a reusable fleet director with
adaptive formations, persistent autonomous fleets, multi-class capital ships,
or a complete capital-vessel simulation.

## Phase status against the directive

| Phase | Status | Evidence-based summary |
|---|---|---|
| A — forensic ship/weapon audit | **IMPLEMENTED AND VERIFIED** | This report records the current definitions, actual behavior, consumers, and gaps. |
| B — existing eight in Orbital | **IMPLEMENTED AND VERIFIED in Orbital modes; PARTIAL across all modes** | Original eight are playable through Orbital. Arcade, Solo Flight, legacy campaign, and Wing still include surface compatibility paths. |
| C — original eight abilities | **IMPLEMENTED AND VERIFIED in Orbital** | All eight have actual state effects and deterministic `step()` tests. Legacy mode parity is incomplete. |
| D — weapon and missile architecture | **PARTIALLY IMPLEMENTED** | Basic projectiles and guided missiles work; fit IDs do not select weapon families and missile families are generic. |
| E — countermeasures and missile defense | **PARTIALLY IMPLEMENTED** | Guided-missile removal, flare feedback, and Aegis interception exist; decoy guidance and general defensive systems do not. |
| F — distinct 3D reconstruction | **PARTIALLY IMPLEMENTED** | Sixteen unique procedural fighter blueprints and hangar inspection exist; detailed authored fleet models and ship-specific damage are not verified. |
| G/H — eight additional fighters | **PARTIALLY IMPLEMENTED** | Eight specialist IDs, definitions, abilities, and procedural hulls are present; normal AI rosters still use only the original four per faction. |
| I — fleet AI/formations | **PARTIALLY IMPLEMENTED** | Generic Orbital AI pursues the nearest opponent; Iron Eclipse has one fixed three-ship mission wing, not a fleet director. |
| J — capital ship/subsystem combat | **PARTIALLY IMPLEMENTED** | Iron Eclipse has server-owned subsystems, not a general, first-class capital-ship fleet system. |
| K — multiplayer authority/balance | **PARTIALLY IMPLEMENTED** | Server-authoritative test/replay foundations exist; the Orbital 5v5 socket migration and human balance certification are not established. |
| L — mobile performance/certification | **PARTIALLY IMPLEMENTED** | Automated geometry/render budgets exist; no Orbital physical-device certification is evidenced. |

## Recommended next implementation slice

The highest-impact next slice is Phase D: replace descriptive weapon-fit names
with a typed, shared, server-authoritative weapon catalog and execution rules.
Start with the existing sixteen hulls and preserve current values as a baseline.
For each fit, specify projectile/missile behavior, compatible classes/hardpoints,
damage and timing, ammunition/energy, collision, countermeasure interaction,
and visual feedback. Keep browser and server using the same canonical source,
add a migration/version test, and demonstrate real in-runtime firing before
adding more ship names or capital classes.

Do not present the current certification smoke test, hangar preview, Rust Disc
Android sample, or unregistered Orbital authority harness as proof of live 5v5
balance, Orbital mobile performance, or multiplayer fleet combat.
