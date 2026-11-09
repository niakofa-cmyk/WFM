# Combat Lab archive → continuous playable universe

## Governing direction

The Combat Lab is the gameplay reference, not a disconnected replacement for
the actual game. Carry its flight, aim, firing, hit feedback, readable opponents,
camera framing and battle controls into the continuous Orbital universe.
Pilots enter from the hangar, fight the opening encounter in that universe,
then keep flying to discover patrols, other pilots, stations and operations.
Do not swap scenes or launch a separate training match to represent a live
fleet battle.

Three.js remains the primary rendering foundation under Orbital. Shared flight
uses server-owned movement, encounters, damage, attribution and settlement.
Local training remains no-reward. Reusing training mechanics does not authorize
client-reported hits, kills, repairs or rewards.

## Uploaded source and preservation

Original retained upload:
`attached_assets/wfm_infinite_war_(1)_1794193260922.zip`

SHA-256:
`1401af9f8cbe15dc6ea1ac7c31c474d13d9e828f96c1786be64c38a44cb44b22`

This is an older snapshot containing a nested WFM source checkout, training
documentation, generated bundles, preview images, a video and migration
backups (57,515,616 uncompressed bytes). It is not a newer authoritative
multiplayer implementation. Do not extract it over the current repository,
execute included preview scripts, or add its generated bundles/backups to Git.
The archive is retained as the supplied attachment; this tracked reference and
the companion verbatim PROJECT reference preserve its provenance and intent.
The PROJECT reference preserves all wording with CRLF normalized to LF.
The archive's `docs/combat-lab.md` is already present in this repository with
identical normalized text; no duplicate copy or historical override is needed.

Relevant source members reviewed:

- `workspace/PROJECT.md`
- `workspace/wfm_repo/docs/combat-lab.md`
- `workspace/wfm_repo/lib/orbital-sim/src/flight.ts`
- Current equivalents of the archived Arena, flight, weapon and simulation
  modules, compared by source inventory and content identity.

The archived flight source predates the current deterministic math adapters,
versioned weapon/fleet rules, shared-flight protocol and recovery safeguards.
Its one-mode release limitations are historical, not instructions to remove
the current authenticated universe.

## What is already reused, and what is not equivalent

| System | Current relationship |
| --- | --- |
| Rendering and framing | Training and live universe use the same Three.js Arena and `orbitalCameraPose` chase/cockpit calculation. |
| Flight dynamics | Both use `integrateSpatialFlight` and ship tuning at the Orbital fixed step; live flight deliberately has no local arena boundary and receives authoritative correction. |
| Primary fire | Both use `spawnPrimaryVolley`, the weapon catalog and ship damage/cadence; living shared-flight pilots can fire before an encounter. |
| Missiles | Shared catalog, lock acquisition, volley and guidance primitives; live launch still requires authoritative encounter permission. |
| Impacts | Shared collision/damage building blocks; live server emits impacts, health, kills/assists and settlement. |
| Enemy pursuit | Now one `orbitalCombatPursuit` helper used by training, its server replay, and live patrol combat. |
| Enemy acquisition | Live patrol detection, search memory, warning/interception and encounter permission remain server policy, not training spawn logic. |
| Special abilities, tactical maneuvers, countermeasures | Not full live parity. Some training controls are not applied by the live authority; do not advertise complete migration. |
| Environment collisions | Live integration still lacks the full training collision environment. |
| Story progression | Preserve the established Dusk capture chronology and verified world operations; do not replace them with the archive's finite training objective. |

## Implemented slice

Extracted the training ship-local yaw/pitch gains, role-specific stand-off
distances, reverse thrust when too close, and alternating light-ship strafing
into the shared simulation library. Both training copies consume that same
helper, preserving their existing versioned formation/fire/ability policies.
Live enemy pursuit now uses it instead of always advancing through the target
with a separate steering gain and distance rule.

Live sensor range, aim-before-fire checks, encounter ownership, unlimited local
world boundary, account identity, recovery and reward validation are unchanged.
The server's current 170-metre AI firing policy and training's 60-metre firing
policy remain different: sharing pursuit is **not** a claim of identical battle
specifications. Player primary fire retains its existing streamed-target
projectile behavior; this change does not create universe-wide hit authority.

Regression checks cover role stand-off/reverse thrust, alternating strafe,
legacy training behavior, ship-local vertical steering and translation to a
distant universe origin. Run existing browser/server replay parity and live
socket tests as well as these checks.

## Verification and rollout

Local checks and authenticated staging evidence must be recorded separately.
For this slice, `pnpm run typecheck && pnpm test && pnpm run build` completed
successfully. This includes the new pursuit regressions, browser/server
simulation tests, live socket tests, both game builds and the unchanged Combat
Lab static-graph audit. Development app/API/socket workflows restarted and
served; the public entry screenshot loaded. These checks do not establish
authenticated combat, GPU performance or physical-device behavior.

The staging source pin is not changed just by committing this work.
Verify both pilots' active sessions and profile HTTP 200 before universe entry,
attach observers before launch, and then establish actual player/enemy
projectiles, impacts, destruction, assists, settlement and continued flight.
Do not declare full combat parity, completed multiplayer settlement, physical
phone verification or Production readiness from source reuse alone.

### Live combat balance and maneuvering verification

Training currently applies a 2.2× player primary-damage multiplier and a 0.28×
AI multiplier. Shared flight uses base ship damage on both sides. This is a
material difference, not evidence that guns cannot hit. Do not silently copy
training's player advantage into multiplayer or buy/grant upgrades just to
make a verification pass. No ship, weapon, shield or reward values were changed
for the pursuit rollout.

The bounded staging driver sustains normal firing, follows one target in
ship-local 3D axes, uses the actual aim stick for pitch, requests missiles only
when aligned, and advances, reverses and evades laterally/vertically rather than remaining parked. Authority
still grants locks, ammo use, hits, kills and settlement. Track enemy destruction
events separately from shield impacts and test actual movement after a settled
surviving battle. A test driver is not a player-facing autopilot or an upgrade.

The authenticated staging pass now proves enemy destruction and a surviving
encounter: one server-settled kill awarded 12 credits, the profile balance
increased by exactly 12, and normal input moved the living ship 9.86 m after
settlement in the same universe. Earlier passes confirmed kills on both pilots
but ended in zero-credit defeats. This does not certify two-pilot assists,
duplicate settlement, all ship abilities or per-ship upgrades. See
`STAGING-TEST-REPORT.md` for the scoped evidence and remaining gaps.
