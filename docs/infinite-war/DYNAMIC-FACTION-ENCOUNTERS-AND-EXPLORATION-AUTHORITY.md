# Dynamic faction encounters and multiplayer exploration authority

## Foundational direction

**Authenticated exploration in the Infinite War universe is multiplayer
gameplay—not a no-reward sightseeing mode.** It must support server-authoritative
faction encounters, validated enemy-hull destruction tallies, and eligible
exploration/combat rewards. A server-confirmed roaming encounter can affect the
pilot's account and the shared world under explicit rules.

This does **not** give the client authority to create a match, decide a kill,
award itself credits, or write faction state. “Multiplayer-authoritative”
describes the server's ownership of the live universe and its outcomes.

Keep the existing offline local Orbital sandbox as a separate development and
flight-practice profile: it remains session-only and no-reward. That boundary
must not be generalized to authenticated universe exploration. Private Wing
rooms and casual AI-fill Wing matches also retain their distinct no-reward rules;
those rules do not prohibit server-authoritative PvE or open-universe faction
encounters.

## Faction encounter experience

A pilot chooses USSF or Accord and launches from an appropriate installation.
As the pilot travels, the universe can contain actors with their own routes and
objectives—not only enemies waiting to attack. The same logic is mirrored for
either faction.

The encounter director should support a graduated scale:

1. A lone opposing reconnaissance craft.
2. A pair of fighters or scouts traveling together.
3. A patrol squadron on a route.
4. A moving fleet with escorts.
5. A capital ship and fighter wing.
6. A hostile fleet attacking a neutral station.
7. A multi-squadron player engagement.

Detection should not mean immediate combat. Use a bounded state progression:

`unaware → detected → investigate → identify/challenge → warn or intercept → combat/reinforce → resolve, retreat, or disengage`

An encounter can start at an intermediate state if the server's world context
justifies it. Reaching combat depends on the actor's orders, territory, faction
rules, reputation, and player behavior.

The server-side director evaluates at least:

- Sector control, restricted status, active operations, and world-event state.
- Distance, line of sight, sensor range/capability, and signal quality.
- Player speed, direction, identification/transponder state, and faction.
- Reputation/threat level, weapons state, lock/targeting behavior, and recent
  hostile actions.
- Existing encounter occupancy, fleet orders, and whether the actor is already
  committed to another operation.

Reconnaissance may investigate; a patrol may issue a warning; an intercept group
may pursue; a capital ship may launch escorts or request reinforcements. Actors
can continue, disengage, withdraw, surrender, or complete another objective.
Equivalent rules apply in reverse for Accord pilots.

## Multiplayer event discovery and access

Universe travel should reveal real activities at their physical destinations.
A pilot approaching an asteroid installation may discover a currently active
5v5 match, inspect a safe event summary, enter an authorized read-only spectator
view, or enter the existing queue for a future match. A distress call, station
attack, patrol interception, or co-op operation can similarly be offered as a
server-registered operation.

Discovery, spectating, and joining are separate:

- The directory advertises only an actual server-created active instance.
- Public summaries expose only approved activity, phase, and aggregate
  occupancy; never room codes, private participants, credentials, or hidden
  tactical state.
- Spectators are authenticated where required, read-only, capacity-limited, and
  excluded from pilot seats.
- Matchmaking and operation admission still validate account, location,
  faction/team, capacity, and mode eligibility on the server.
- Private rooms remain invite-only and absent from public discovery.

The existing Cinder Ring directory and Wing spectator path are reusable
foundations for this pattern. They do not yet provide shared free-flight battles
or dynamic NPC encounter simulation.

## Rewards, kill tally, and world consequences

The flight HUD may show a provisional encounter tally, but persistent statistics
and rewards must derive from server-confirmed entity destruction and validated
operation results. A server result needs a stable encounter/operation identity,
pinned runtime/rules version, objective state, participation and contribution
data, and an idempotent settlement key. Reconnects, replayed inputs, client
retries, disconnects, and simultaneous damage must not duplicate a kill or
reward.

The future design should support:

- An encounter-scoped tally of opposing ships/hulls destroyed, with attribution
  and assists determined by server rules.
- Account-backed exploration discoveries and eligible encounter rewards.
- Server-owned reputation, faction response, and persistent world consequences
  where the operation explicitly allows them.
- Clear debrief feedback explaining confirmed kills and awards.

Do not invent reward amounts in the encounter director. Reuse the account and
idempotent reward infrastructure; define a separate explicit policy for roaming
PvE/exploration. Existing Wing payout amounts and gates, the current zero-credit
co-op discovery policy, and no-reward private/AI-fill rooms do not change
implicitly.

The later owner upload proposing faction-population balancing and friendly AI
escorts is evaluated in
[Faction population and AI escort direction](FACTION-POPULATION-AND-AI-ESCORT-DIRECTION.md).
That document records the requested 6-of-10 to 80/20 target and its
unimplemented status; it does not supersede these settlement or reward
constraints.

## Reference imagery

The supplied images are retained in `attached_assets/` and are visual direction,
not evidence of shipped geometry or multiplayer:

- `_Qk3Kb5C9n9pz7Nzz-_OlPeH4pfDzWzi_x1VYQwr5cFh9ycl43enpSLzDu9Yq_1794015877760.jpeg` — close mixed-faction capital-ship/fighter encounter framed by asteroid terrain.
- `dQ1yZRPqUIJ-FGb-GvoI9724apR1f3e7CCzEbdEdIztwxXGilLCJe842lhDpv_1794015877823.jpeg` — fleet-scale battle with layered ship formations and clear scale.
- `3phGzFVnPCCC5UoAaZsXtkUxzigAPvI0qdNYs0lLlpwlSNEpSXNROfuexSOfP_1794015877841.jpeg` — asteroid dogfight, readable craft silhouettes, weapons and escorts.
- `zLAGlazZZl0f2su6_do9rOJpfHKukaPbVCNQqZWVN_VPDLGeTkRx-rDEfqaS4_1794015877876.jpeg` — planetary theater with opposing fleets, stations, and long-distance spatial scale.
- `e_yl8Z3KSs2cM6wlFwExtXV_7PfPJH126_vh2DvhFgTFhH8KYIYY5VhZeOpfJ_1794015877902.jpeg` — layered asteroid installation as a physical operation gateway.
- `b6x_mzOGs37FsoE9v9GQ9VPkxiqFRaklqab66zL-gitvyUqVHNobIme7YJVnI_1794015877922.jpeg` — industrial station traffic and asteroid-field flight.
- `5_IkenqNqeWFY96s6C4KKYw2IHEUbbMvj_68BFDttK3inHtqI_0JN9eHF1rkb_1794015877941.jpeg` — ring structure, station, and nearby fleet activity.

Use them to guide encounter composition, faction silhouette/color language,
capital-ship scale, asteroid staging, station visibility, and phone-readable
combat views. They are references, not permission to ship copied assets.

## Current repository status

The full owner source is preserved at
`docs/infinite-war/references/redesign/INFINITE-OPEN-UNIVERSE-SOURCE.txt`.
That source's dynamic encounter director and embedded multiplayer discovery
sections are controlling product direction.

The two additional owner references from November 7 are preserved verbatim at
[`references/redesign/MASTER-AI-GAME-DEVELOPMENT-DIRECTIVE-2026-11-07-SOURCE.txt`](references/redesign/MASTER-AI-GAME-DEVELOPMENT-DIRECTIVE-2026-11-07-SOURCE.txt)
and
[`references/redesign/INFINITE-OPEN-UNIVERSE-2026-11-07-SOURCE.txt`](references/redesign/INFINITE-OPEN-UNIVERSE-2026-11-07-SOURCE.txt).

The primary Orbital boot and initial server-internal encounter/result contract
are implemented; see
[Primary boot and encounter contract](PRIMARY-ORBITAL-BOOT-AND-ENCOUNTER-CONTRACT.md)
for the exact scope, rollback entries and remaining activation gates.

## First roaming patrol and evidence-recovery slice

Pale Beacons now runs one bounded opposing patrol lead inside its existing
Orbital V2 sector room. The server moves the actor along a deterministic
waypoint loop and publishes its current position through the authenticated
flight snapshot. This is a single moving NPC contact in one co-op sector, not a
multi-ship fleet or a persistent, sector-spanning patrol director.

The same route exposes two physical evidence sites: the Pale Beacon receiver
history and the Earth relay packet. The HUD and tactical map show their
server-provided positions and per-pilot recovery state. The recovery request
contains no evidence ID or coordinates. The server selects the nearest
unrecovered site, verifies active V2 Pale Beacons flight, a 55-meter range and
line of sight, then writes the stable narrative discovery through an
idempotent account-scoped database transaction. A pickup is private to that
pilot and awards no credits. Existing campaign evidence claims remain
compatible and may already have recorded the same stable discovery.

The existing contact director remains active: the server derives range and
asteroid/planet line of sight from flight state, uses the assigned opposing
faction and contested-frontier classification, calculates speed against the
server-owned hull limit, reads validated lock/weapon inputs, and stores the
pilot's transponder mode on the authenticated seat. Clients cannot submit
contact stages, outcomes, territory, threat values, pickup IDs or pickup
positions.

USSF contacts investigate and challenge first, then issue a warning before
intercepting persistent threats. Accord contacts investigate, shadow silent
contacts at range and intercept close, fast, targeted or weapons-hot approaches.
Actual server-applied damage escalates either side to a reinforcement request.
The existing NPC missile behavior stays suppressed until a server-classified
intercept or reinforcement request; a warning is not an attack. Contact state is
returned only to that pilot in the sector socket snapshot. It is deliberately
absent from the public world-operation directory and event stream.

The V2 Pale Beacons patrol remains a single moving actor in one contested
co-op sector. Separately, a new strategic patrol director now persists
deterministically seeded, two-to-four-ship USSF and Accord formations across
the current named world route graph. It stores their roster and route position
in `universe_patrols`, advances waypoints from saved timestamps with a
revision-checked database update, and exposes only the authenticated pilot's
server-recorded current region through `GET /world/patrols`. The Galaxy panel
shows these strategic AI contacts and their routes; they are not live human
matches or flight-level combat actors. See
[Persistent multi-ship universe patrols](PERSISTENT-MULTI-SHIP-UNIVERSE-PATROLS.md)
for schema, scope, and acceptance boundaries.

The strategic patrol directory itself does not apply hull damage or grant
rewards. A separate, bounded authenticated Orbital V2 `universe-patrol`
operation now reserves a persistent opposing patrol and runs its ships in a
server-owned sector session. Pilots explicitly request that operation from the
free-flight contact panel; the current local free-flight position is not handed
off as authoritative state. In the server session, weapons are disabled until
the server-computed patrol distance is at most 180 meters. Confirmed kills and
assists are written to the pilot's private result history; successful completion
settles the configured bounty and removes destroyed ships from the persisted
patrol roster in the same transaction. Aborted operations do not receive credits.

The bounded policies currently award 12 credits per eligible NPC ship, capped
at 24 for Pale Beacons and 48 for a universe-patrol encounter. Evidence recovery
itself has no credit reward. The patrol operation does not yet change
faction-wide reputation, knowledge, or territory. Private, AI-fill, Wing and
local-training reward rules are unchanged. Orbital V2 remains opt-in and the V1
rollback path is intact.

Current code has an offline streamed-sector flight sandbox, authenticated world
travel/discovery, a public operation directory, server-owned Wing/co-op
operations, a read-only Wing spectator path, the bounded Pale Beacons patrol
and evidence slice, and a persistent strategic multi-ship patrol directory.
Authenticated Orbital free flight also streams live nearby pilots and persistent
patrol actors in the same server-owned spatial session. Opposing human pilots
are labeled by faction and as human pilots, are selectable with the existing
nearest-hostile targeting control, can maintain the normal server-reported
target lock, and can damage one another through the ordinary authoritative
projectile collision and shield/hull path. Firing or launching at a selected
opponent opens a server-validated pairwise PvP engagement; same-faction damage
remains rejected. Server-confirmed pilot kills and damage assists update the
in-session tally. This PvP path does not award credits or campaign/world/faction
progression. Pairwise PvP engagements are transient runtime state, not durable
encounter receipts; after a socket-runtime restart, retained ship condition can
remain but the live duel is not restored. The feature is implemented and
automated-test verified in one authoritative runtime, not yet certified across
multiple socket instances or on staging devices.

The bounded `universe-patrol` operation and its strategic directory remain
distinct from seamless live flight; use the authenticated shared-flight
runtime's own server-owned patrol and encounter path for visible patrol
combat. A complete spatially authoritative encounter director and world-wide
faction consequence simulation remain future work. Do not use local procedural
scenery or client-side scan records as a substitute for those capabilities.

## Implementation order

1. **Implemented for one path:** versioned Orbital V2 Pale Beacons encounter,
   moving NPC position, private snapshots, result settlement and account-scoped
   evidence recovery.
2. **Implemented strategic foundation:** persistent multi-ship formations,
   route movement, authenticated region reads, and Galaxy visibility. The
   implementation and current limits are recorded in
   `PERSISTENT-MULTI-SHIP-UNIVERSE-PATROLS.md`.
3. **Implemented as a bounded operation:** selected patrols can be reserved,
   fought, tallied, settled, and have confirmed casualties removed from their
   persistent roster.
4. **Implemented for current same-session scope:** authenticated Orbital free
   flight presents persistent patrols and opposing pilots in one spatial scene;
   the server validates patrol encounters and hostile-human damage.
5. **Partially implemented:** human-vs-human kill and assist tallies are
   server-derived, but PvP has no currency/long-term settlement and its active
   duel is not restored after a socket-runtime restart. Multi-instance and
   physical-device verification remain separate gates.
6. Add validated faction consequences only after ownership and isolation rules
   are defined; preserve existing reward gates.
7. Surface active events at physical destinations, add safe spectator/admission
   paths, and prove both factions and multiple devices on staging before rollout.
8. Validate mobile frame cost, reconnect behavior, privacy, anti-replay, and
   production safety before widening encounter scale.
