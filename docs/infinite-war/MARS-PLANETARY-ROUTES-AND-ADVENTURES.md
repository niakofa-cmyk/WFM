# Mars planetary routes and live adventures — rebuild direction

## Governing decision

WAR FOR MARS: INFINITE WAR is being rebuilt through the Orbital Engine runtime
as one navigable game. Orbital owns gameplay state, rendering, spatial
simulation, flight, combat rules, world transitions, and multiplayer authority
boundaries. Three.js is the main 3D renderer and scene-runtime foundation for
this Orbital universe. Orbital simulation and server-owned world state integrate
with it; native Orbital WebGL2 remains a supported companion path.

Do not remove Three.js or treat it as a techniques-only source. Keep it
code-split so the initial hangar/menu graph does not download the 3D runtime
until a flight scene needs it. This lazy-loading boundary is a performance
measure, not a separate universe or a renderer migration. See the
[current rendering strategy](RENDERING-STRATEGY-AND-UNIVERSE-OWNER.md).

## Preserved owner references

The two full owner-supplied references remain unchanged in `attached_assets/`:

- [`Pasted-You-re-right-I-had-the-rendering-engine-relationship-wr_1794030477073.txt`](../../attached_assets/Pasted-You-re-right-I-had-the-rendering-engine-relationship-wr_1794030477073.txt)
- [`Pasted--Reimagining-Mars-as-a-living-explorable-multiplayer-wo_1794030515698.txt`](../../attached_assets/Pasted--Reimagining-Mars-as-a-living-explorable-multiplayer-wo_1794030515698.txt)

The first corrects engine/rendering ownership. The second reframes Rust Disc,
Mars Approach, Pale Beacons, and future locations as regions and adventures in
one connected Mars world. This maintained document turns those ideas into a
source-backed build direction without treating proposed capabilities as
already shipped.

## Product model: locations, routes, adventures

- **Location** is a stable physical place in the world: a station, orbital
  corridor, surface region, wreck, asteroid field, or anomaly.
- **Route** is a traversable suggestion between locations. It guides
  navigation; it is not a level boundary, teleport, or mandatory rail.
- **Adventure** is an actionable, versioned activity with triggers, objectives,
  faction response, participating actors, completion rules, and an authority
  owner. A marker or narrative label alone is not an adventure.

An adventure may span multiple routes and locations. Players can deviate,
discover alternatives, engage or evade, and return without loading a separate
level. Campaign order remains available as an authored thread, not the only way
to explore.

## Mars route atlas and honest implementation states

| Route/adventure | Reimagined role | Current integration state |
|---|---|---|
| Mars Orbit | Departure/orbital navigation and the first planetary theatre | Bounded Orbital local sandbox; not yet a rotating planetary world |
| Cinder Ring | Physical station approach, services, and competitive-operation gateway | Local flightable approach exists; docking does not authorize account travel or match entry |
| Rust Disc | Frontier region with relay recovery, patrol contact, salvage, and extraction | Existing compatibility operation; not yet a continuous Orbital-world adventure |
| Mars Approach | Arrival corridor, orbital survey, and eventual atmosphere-access route | Existing mission source; not yet a planetary transition in the Orbital universe |
| Pale Beacons | Signal triangulation, anomaly investigation, and discovery chain | Existing server-run operation source; not yet open-ended shared planetary exploration |
| Iron Eclipse | Discoverable large fleet operation with objectives and extraction | Existing server-run operation source; not yet a roaming event in the Orbital world |
| Night-side Station | Dark-side navigation, hidden installation, restoration, and rescue | Planned; no working night-side planetary traversal |
| Dust Lane | Moving debris corridor, convoy interception, stealth, and salvage | Planned; no live convoy or encounter director |
| Below the Signal | Deep anomaly/research expedition | Planned; no validated anomaly-world operation |
| Phobos Yard | Persistent multiplayer shipyard, refit, dispatch, and social hub | Planned as an in-world Orbital location; existing account services remain authoritative elsewhere |
| Outer Fringe | Remote exploration and faction contact beyond Mars | Planned; not a currently streamed or persistent destination |

The route atlas in the primary boot must expose these distinctions. Only
capabilities that really run in the active Orbital session may launch from it.
Compatibility activities can be entered only through their existing supported
flows until their Orbital adapters and rollback gates pass. Planned adventures
must not be presented as live events or joinable operations.

## Route and adventure contract

The implementation should grow toward data-driven, versioned definitions:

- Stable route, location, and adventure IDs.
- Origin/destination references and spatial coordinate frame.
- Optional waypoints, alternate corridors, approach envelopes, and discovery
  conditions.
- Adventure definition/runtime versions and an explicit adapter.
- Faction ownership, reputation/sensor rules, territory, and encounter policy.
- Actor/encounter lifecycle, objectives, abort/escape paths, and completion
  criteria.
- Server authority, persistence, reward eligibility, and idempotent result
  settlement.
- Provenance and readiness state so authored proposals cannot be mistaken for
  active server state.

The client may render navigation, predict local flight, and present a
server-approved operation. The server owns shared presence, encounter state,
combat outcomes, discoveries, persistent locations, and rewards. Offline
exploration remains a separate no-reward profile.

## Mars circumnavigation proof gate

The first planetary milestone is not “add more route cards.” It is one
continuous, testable Mars world:

1. Establish planetary-fixed and inertial coordinates, latitude, longitude,
   altitude, and explicit frame conversions.
2. Add a shared planetary clock and rotation; derive day/night from the same
   authoritative world time.
3. Connect orbit and atmospheric/surface navigation without teleport or
   session reset; stream bounded terrain/region cells around the pilot.
4. Make routes, physical points of interest, collisions, and navigation use the
   same spatial frame.
5. Add server-owned player presence and dynamic adventure instances only after
   shared-sector authority and reconnect behavior are versioned and tested.
6. Certify a complete daylight → night-side → daylight circuit, then repeat
   with at least two authenticated pilots sharing the same authoritative
   region, event lifecycle, and result state.

Acceptance includes coordinate/rotation tests, day/night boundary tests,
continuous traversal, streaming/precision and collision tests, fixed-step
flight/input regression, memory/resource disposal, reconnect and server
authority checks, and Android performance/thermal measurements. Browser
screenshots and local-sector tests are not substitutes for this evidence.

## Current repository boundary

The existing Orbital local universe already has one Arena-owned renderer and
fixed-step loop, a flightable Cinder station, and deterministic address-based
nearby sectors. The sector address can grow, but the flight frame is local and
the displayed Mars is not a rotating, traversable planet. Local sector
generation does not create persistent geography, faction actors, live
multiplayer, or rewards.

The rebuild now has a tested pure-math Mars rotation/coordinate/solar-exposure
module and an opt-in WebGL2 globe preview. They demonstrate the planetary frame
and day/night calculation only; the preview clock is local and accelerated.
They do not add planet traversal, terrain streaming, persistent location, live
encounters, or multiplayer authority. Night-side Station remains planned.

The current primary boot therefore provides an honest starting point, not the
finished world. The next implementation increments should be:

1. Make the route/adventure catalog explicit and visible in the Orbital entry,
   with separate local, compatibility, and planned states.
2. Add typed route and location data without changing existing activity
   authority or pretending legacy missions have migrated.
3. Design and test the planetary coordinate/clock/frame contract before
   attaching Mars surface routes or claiming circumnavigation.
4. Connect one migrated, server-authoritative adventure end to end; preserve
   the legacy operation as rollback until parity is demonstrated.

Related implementation and evidence:

- [Orbital primary runtime contract](ORBITAL-UNIVERSE-REBUILD-CONTRACT.md)
- [Local universe slice and its limitations](ORBITAL-LOCAL-UNIVERSE-SLICE.md)
- [Phase 0 source audit](ORBITAL-LAB-PHASE-0-FORENSIC-EXTRACTION-AUDIT.md)
- [Server-owned encounter/result contract](DYNAMIC-FACTION-ENCOUNTERS-AND-EXPLORATION-AUTHORITY.md)
