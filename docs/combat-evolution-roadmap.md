# WFM combat evolution roadmap

## Source references

WFM's primary long-term product direction is the Infinite War blueprint:
`docs/references/wfm-infinite-war-blueprint.md`. Its complete owner-supplied
source remains unchanged at
`attached_assets/Pasted-WAR-FOR-MARS-The-Infinite-War-Open-Universe-Multiplayer_1793690415379.txt`.
The central goal is to make competitive engagements operations inside a
connected universe whose validated outcomes can affect the larger war. The
blueprint is a staged north-star, not a statement that all proposed systems
already exist.

The complete owner-supplied references remain unchanged in `attached_assets/`:

- `Pasted-Build-the-WFM-Combat-Evolution-If-I-were-directing-WFM-_1793630574307.txt`
- `Pasted-Worked-for-1m-33s-WAR-FOR-MARS-HOUSE-OF-THE-DYING-SUN-A_1793630625490.txt`

The second document is a 19-section design study. It is a roadmap, not proof
that its proposed systems already exist. House of the Dying Sun is a design
reference only; do not copy its code, art, story, maps, names, or other protected
creative material into WFM.

## Product direction

WFM's combat identity should combine momentum-based dogfighting, readable
military science-fiction presentation, tactical squad command, and battles
whose objectives change as ships are damaged. Campaign operations should connect
individual sorties to faction stories and carefully controlled persistent war
state. Mobile readability, fair competitive play, and server authority are
requirements, not later polish.

## Verified repository starting point

- The main Wing combat/replay simulation in `artifacts/war-for-mars/src/game/sim.ts`
  remains planar and reward-eligible through existing validated flows.
- The Rust Disc sector uses a separate deterministic XYZ/quaternion flight
  kernel shared byte-for-byte between browser and server.
- Cooperative sector inputs are validated by the socket runtime; the server
  advances the simulation and owns mission completion and settlement.
- Sector progression reuses authenticated player records and idempotent
  progression events. It is distinct from competitive Wing credits.
- The existing mission chain is Rust Disc → Mars Approach → Pale Beacons.
- A server-validated host order palette coordinates connected human pilots in
  the original sector route.
- Operation Iron Eclipse adds a separate server-simulated three-ship AI wing,
  capital subsystem combat, and extraction objectives without changing the
  original route or competitive Wing.
- Player transfer, a broad capital-ship subsystem suite, branching persistent
  campaign, and procedural operation generation remain unimplemented.

## First implemented slice — vector drift

The cooperative 3D sector now supports a hold-to-drift input. It preserves the
current travel vector while the ship changes orientation, with a reduced drag
rate; active braking takes priority. The WebSocket server accepts the optional
boolean, applies the same deterministic physics and advertises support in its
snapshot. Older clients remain valid; the new touch/key control is shown only
when the server advertises the capability. This control changes handling only:
it does not add damage, speed limits, rewards or competitive advantages.

This is a cooperative-sector flight feature, not a change to the competitive
Wing simulation and not evidence of a Production release. Server and client
physics sources must remain byte-identical, and cross-runtime determinism tests
must pass before promotion.

## Second implemented slice — cooperative squad orders

The active co-op sector exposes four host-issued calls: Attack the shared hostile
drone, Defend a connected wingmate, Escort a connected wingmate, and Regroup on
the host. The server derives the issuer from the authenticated socket seat,
requires the host role and active match phase, validates targets against
connected room members, limits command frequency, and broadcasts the accepted
order in each authoritative snapshot. Orders are cleared when their issuer or
human target disconnects. The command palette is capability-gated and does not
pause flight.

This first pass is a tactical coordination tool for human pilots. It does not
claim to steer friendly AI, apply combat bonuses, alter damage, create rewards,
or transfer control of a player's ship. Those effects require a separate
server-owned unit simulation and fairness review. Competitive Wing and reward
contracts remain untouched.

## Third implemented slice — Operation Iron Eclipse

Iron Eclipse is an independent, repeatable cooperative operation in the existing
3D Mars flight environment. It pairs one player-controlled interceptor with
three server-owned AI wing fighters and one capital ship with three functional
subsystems: point defense, shield array, and reactor. The point-defense network
fires hostile guided weapons until disabled; the shield array reduces reactor
damage and is an optional objective; destroying the reactor transitions the
mission into extraction. The primary objective is complete only when the pilot
returns to the extraction zone. The debrief reports success, failure, and
whether each optional objective was complete or missed.

The host can issue exactly four non-pausing orders to the AI wing: Attack,
Defend, Escort, and Regroup. The server checks authenticated room-seat ownership,
host authority, active phase, bounded packet shape, target availability, and
command rate. The client renders the server snapshots as a capital silhouette,
subsystem markers and health, AI ship models and health, objectives, target, and
orders. Client-side host gating is presentation only; authorization remains on
the socket server.

Server simulation owns AI movement and attacks, target/subsystem health,
point-defense shutdown, shield mitigation, extraction state, objective results,
and mission outcome. Existing bounded 3D inputs and shared browser/server flight
physics remain the player flight and weapon authority. Commands do not pause
flight. Reactor targeting stays unavailable until point defense is disabled.

On successful extraction, Iron Eclipse uses the existing authenticated,
idempotent sector-discovery settlement. It records an account-scoped discovery
and a zero-credit ledger event; it adds no reward credits, tables, migrations,
or alternate identity/session system. It does not settle the competitive Wing
reward ledger and does not alter that mode's rules.

Automated coverage exercises subsystem gating and damage effects, all four wing
orders, server-owned snapshot agreement and host-only command enforcement,
fail-closed target packets, hostile-fire suppression after point-defense
shutdown, objective success/failure, parser bounds, and zero-credit persistence
for the standalone mission. This verifies local implementation contracts only:
the phone experience, network interruptions, staging behavior, balance, and
Production release still require their own verification. The existing
Production-default feature gate remains in force.

## Combat visibility increment

The first Infinite War combat-foundation increment makes the existing Rust Disc
and cooperative-sector combat loop easier to read without changing simulation
or server authority. The flight HUD identifies the active hostile drone or
selected Iron Eclipse subsystem, shows its distance and hull, counts confirmed
hits, and explains whether lock is unavailable, acquiring, or complete. The
mobile missile control is enabled only when a target is active, a full lock is
reported, and ammunition remains; primary guns stay independently available.
Briefing copy now explains the reticle → guns/lock → missile sequence.

This does not add free target cycling, assisted aim, new weapon types,
ship-specific loadouts, broader player-vs-player target selection, or new
damage rules. Those remain follow-on work. The 5v5 Wing arena is still separate
from open-universe/co-op sectors; this HUD is not evidence that the two modes
have been connected.

## First campaign migration — Contact

Newly issued campaign Contact runs now use the shared orbital flight/combat
simulation inside the existing campaign Arena. The client advertises support
for orbital replay; the API then selects and stores the `flightModel` for the
issued run. Capable Contact clients receive `orbital-v1`; older clients that do
not advertise the capability and all other campaign sorties continue to use
`surface-v1`. The client selects its runtime from the server response and cannot
choose or change the model in the claim.

The authenticated Strike claim replays the same deterministic orbital
simulation on the server, validates the complete bounded spatial-control frame,
and then uses the existing transactional, idempotent progression settlement.
Runs issued before this version field existed default to the original surface
model, so an open claim is not silently reinterpreted after deployment. The
capability negotiation also lets an older deployed client finish Contact on its
original surface rules while a newer client uses the orbital version. The first
orbital Contact objective is the authored “break the defending wing” branch;
relay capture is not currently part of this orbital variant.

A verified first Contact win advances the existing campaign-clear count. The
persistent galaxy derives the Pale Beacons unlock from that server-owned
progression, and the Contact debrief explains that the route is charted through
Rust Disc. This reuses the existing progression contract rather than creating a
parallel world-event store.

This migrates one campaign operation only. The standalone Combat Lab remains
offline and no-reward; the remaining campaign sorties, competitive Wing, live
socket rooms, co-op sectors, and Iron Eclipse retain their existing contracts.
Client/server Contact replay parity and strict input validation are automated
checks, not evidence of staging or physical-device acceptance.

## Staged implementation and acceptance gates

1. **Flight foundation:** vector drift, accessible control assistance, boost,
   targeting and combat feedback. Validate bounded speed/energy, collision,
   deterministic browser/server replay and representative mobile performance.
2. **Tactical squad command:** human-pilot coordination v1 is implemented.
   Iron Eclipse adds a separate server-owned AI wing and host orders; expand
   behavior only with bounded server simulation and clear command authority.
   Multiplayer never pauses; rejected commands explain why.
3. **Pilot transfer:** later, in eligible cooperative modes only; never take
   over another human's ship without explicit consent. Competitive use requires
   a separate fairness decision.
4. **Capital-ship encounters:** Iron Eclipse establishes point defense, a
   damage-mitigating shield array, and a reactor whose destruction changes the
   encounter into extraction. Expand to additional systems only after validating
   these effects and mobile performance.
5. **Objective-driven missions:** Iron Eclipse establishes one server-validated
   primary objective, two optional outcomes, explicit failure, and reuse of
   existing result persistence. Add authored mission variants before procedural
   generation.
6. **Replayable operations:** authored variants first, then constrained,
   server-selected procedural challenges. Reject impossible or incompatible
   combinations before launch.
7. **Campaign and warfront persistence:** use existing progression and
   transactional idempotent settlement; only designated cooperative operations
   may affect strategic locations. Competitive matches remain self-contained.
8. **Mobile presentation and performance:** prioritize silhouette and combat
   information; profile real Android devices before increasing actor, particle,
   bandwidth or simulation budgets. The current performance pass removes
   per-collision temporary vectors, per-tick projectile-array replacement, and
   per-frame multiplayer render collections; it also reuses a room's flight
   sector and avoids unnecessary camera projection updates. Mobile LOW quality
   now caps render pixel ratio at 1.0. These changes reduce CPU allocation and
   GPU fill pressure, but do not establish a measured device frame-rate result.
   Record frame-interval evidence on representative Android hardware before
   claiming the live multiplayer hitch is resolved or raising visual budgets.
9. **Controlled release:** narrow feature branches, automated regression tests
   and evidence from the exact staging revision. Do not treat design documents,
   local tests or successful profile reads as Production certification.

These stages intentionally do not bundle all 19 sections into one release.
Each system should be implemented and validated in a narrow vertical slice,
preserving current authentication, multiplayer, reward, progression and release
boundaries.
