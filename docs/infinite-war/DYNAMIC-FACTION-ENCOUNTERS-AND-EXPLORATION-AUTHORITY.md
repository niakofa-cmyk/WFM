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

The primary Orbital boot and initial server-internal encounter/result contract
are implemented; see
[Primary boot and encounter contract](PRIMARY-ORBITAL-BOOT-AND-ENCOUNTER-CONTRACT.md)
for the exact scope, rollback entries and remaining activation gates.

Current code has an offline streamed-sector flight sandbox, authenticated world
travel/discovery, a public operation directory, server-owned Wing/co-op
operations, and a read-only Wing spectator path. It does not yet implement a
server-authoritative roaming encounter director, shared nearby NPC fleets, a
persistent faction encounter world, or live reward settlement for open-world PvE
encounters. The new transactional settlement adapter is disabled and is not yet
connected to a roaming authoritative runtime. Do not use local procedural scenery or local scan records as a
substitute for those capabilities.

## Implementation order

1. Define versioned server encounter, actor, visibility, join/spectate, and result
   contracts on top of the existing account/world/operation systems.
2. Build a deterministic faction/territory director with bounded encounter
   states, predictable resource limits, and server-owned actor orders.
3. Add authenticated multiplayer exploration instances and reconcile the local
   Orbital flight adapter with server snapshots.
4. Add idempotent encounter kill attribution, exploration rewards, and validated
   world consequences without changing existing Wing/private/AI-fill policies.
5. Surface actual event discovery at stations and sectors; add safe spectator and
   admission paths; prove both factions and multiple players on staging.
6. Validate mobile frame cost, reconnect behavior, privacy, anti-replay, and
   production safety before widening encounter scale.
