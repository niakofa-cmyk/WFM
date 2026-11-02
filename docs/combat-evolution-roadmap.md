# WFM combat evolution roadmap

## Source references

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
- A server-validated host order palette now coordinates connected human pilots.
  It is not autonomous AI squad control.
- Player transfer, capital-ship subsystem combat, branching persistent campaign
  and procedural operation generation remain unimplemented.

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

## Staged implementation and acceptance gates

1. **Flight foundation:** vector drift, accessible control assistance, boost,
   targeting and combat feedback. Validate bounded speed/energy, collision,
   deterministic browser/server replay and representative mobile performance.
2. **Tactical squad command:** human-pilot coordination v1 is implemented.
   Next, consider autonomous friendly AI only after defining server-owned units,
   targeting behavior, damage effects and abuse/fairness limits. Multiplayer
   never pauses; rejected commands explain why.
3. **Pilot transfer:** later, in eligible cooperative modes only; never take
   over another human's ship without explicit consent. Competitive use requires
   a separate fairness decision.
4. **Capital-ship encounters:** implement health-bearing shields, weapons,
   engines and point defense whose destruction changes actual behavior before
   adding hangars, communications or more elaborate effects.
5. **Objective-driven missions:** typed definitions for primary/optional goals,
   dependencies, success/failure, difficulty modifiers and validated result
   persistence.
6. **Replayable operations:** authored variants first, then constrained,
   server-selected procedural challenges. Reject impossible or incompatible
   combinations before launch.
7. **Campaign and warfront persistence:** use existing progression and
   transactional idempotent settlement; only designated cooperative operations
   may affect strategic locations. Competitive matches remain self-contained.
8. **Mobile presentation and performance:** prioritize silhouette and combat
   information; profile real Android devices before increasing actor, particle,
   bandwidth or simulation budgets.
9. **Controlled release:** narrow feature branches, automated regression tests
   and evidence from the exact staging revision. Do not treat design documents,
   local tests or successful profile reads as Production certification.

These stages intentionally do not bundle all 19 sections into one release.
Each system should be implemented and validated in a narrow vertical slice,
preserving current authentication, multiplayer, reward, progression and release
boundaries.
