# Mars Live Planetary Routes and Adventure Network
## Reframing Rust Disc, Mars Approach, Pale Beacons, Night-side, Dust Lane, and Iron Eclipse

**Purpose:** Convert legacy route and mission concepts into a connected, navigable, multiplayer Mars world hosted by the Orbital Combat Lab-derived WFM runtime.

**Baseline reviewed:** staging 3663e144938ba931cccaa624004814ab0fd65ff1 (2026-11-04). Recheck before implementation.

## 1. Core design decision

A route is no longer simply a menu link between two named locations or a bounded training level. It is a **playable geographic journey and adventure corridor** through the canonical Mars world.

A route definition describes:
- a start region and destination/goal region;
- one or more suggested navigation corridors and alternate approaches;
- physical coordinates, altitude bands, orbital tracks, and safe/unsafe envelopes;
- expected travel time ranges, ship capability requirements, and environmental conditions;
- points of interest and optional discoveries;
- dynamic encounter and anomaly rules;
- mission/event hooks, faction interests, and operation eligibility;
- multiplayer presence and join/spectator/instancing rules;
- server authority, persistence effects, rewards, and rollback/idempotency policy.

The navigation route is guidance, not a rail. Players may deviate, take alternate approaches, discover hidden places, intercept activity, or simply fly around Mars. Avoid invisible walls or forcing every player through a scripted sequence. Story gates can protect dangerous content, technology, and mission rewards without artificially preventing ordinary geographic exploration.

## 2. What staging actually has

The reviewed staging branch contains:
- Rust Disc local trainer in a bounded 460-unit sector with XYZ flight, quaternion orientation, momentum, boost/brake, obstacles, relay, drone, extraction, and no online rewards.
- Server-run Sector Expedition with authenticated pilots, server-owned flight state, 3D snapshots, reconnect handling, shared mission progress, and a bounded 3,000-unit flight volume.
- Four sector mission definitions: Rust Disc, Mars Approach, Pale Beacons, and Iron Eclipse. The cooperative mission definitions place a Mars sphere at a fixed sector-local position; Mars Approach explicitly says surface landing is not part of that flight.
- A sequential story route Rust Disc → Mars Approach → Pale Beacons, selected through server-recorded flight discoveries.
- A persistent Galaxy/world system with eight named locations, directed travel connections, player location/discoveries, quests, activities, station services, economy, faction standing, and event state. GalaxyScreen polls the world API every 15 seconds and supports server-acknowledged travel/exploration/actions.
- An existing Three.js rendering foundation and separate Orbital Lab deterministic simulation.

These are valuable systems but not yet a continuous, shared, real-time 3D Mars. The strategic location graph, bounded mission sectors, local trainer, and 3D rendering must be connected through one canonical world/sector model.

## 3. New world hierarchy and coordinate contracts

Use a versioned hierarchy:

Mars planetary body
→ surface/atmospheric region
→ local flight sector / streamed cell
→ point of interest / operation instance

Mars orbital theater
→ orbital band / station / moon / debris region
→ local flight sector / streamed cell
→ point of interest / operation instance

Keep the wider universe hierarchy compatible:
Universe → dimension/reality → galaxy → star system → celestial body → region/orbit → sector/instance → local coordinates.

Every physical location needs a stable canonical ID and coordinate frame. Use a planet-fixed frame for authored geography and a Mars-centered inertial/orbital frame for spaceflight. Define explicit transforms between:
- planet-fixed coordinates (latitude, longitude, altitude);
- body-centered local Cartesian coordinates;
- body-centered inertial/orbital coordinates;
- sector-local coordinates;
- ship-local orientation/quaternion.

Use a documented Mars body model (radius/ellipsoid, rotation period, axial tilt/season model as needed, gravity profile, atmosphere envelope, terrain datum). Define coordinate units, handedness, axis conventions, altitude datum, precision, origin rebasing, and frame-transition tests. Do not assume the existing illustrative sphere coordinates are a real planet-scale coordinate system.

The renderer may use Three.js floating-origin/origin rebasing around the active pilot. The authoritative simulation and server protocol must use stable canonical coordinates and deterministic transforms. Avoid giant world coordinates in low-precision GPU floats. Use high-precision body/system coordinates for identity and local rebased coordinates for rendering and near-field physics.

## 4. Mars must be a world, not a single globe mesh

A true Mars implementation requires layered content:
1. planetary globe and limb;
2. correct day/night terminator driven by a shared simulation clock and Mars rotation;
3. high-level terrain/biome regions;
4. streamed local terrain or surface proxy with collision/flight hazards where gameplay requires it;
5. atmospheric layer, dust/weather effects, density/flight profiles, and transition envelope;
6. orbit bands, satellites/moons, stations, relays, defense systems, wrecks and orbital traffic;
7. authored POIs and dynamic world activity;
8. server-owned presence, ownership, encounter and event state.

Do not attempt to load a whole high-resolution planet and all entities at once. Use level of detail, tiled terrain, deterministic procedural detail, streaming, interest management, and local physics sectors. Visual globe detail is not equivalent to navigable/collidable surface detail. State explicitly which surface regions are playable, flyover-only, landing-enabled, or not yet implemented.

### Dark-side requirement

A pilot must be able to fly around the body from the illuminated hemisphere into the night hemisphere and continue back into daylight without changing maps or losing world continuity.

Implement:
- Mars rotation and sun direction from one authoritative world-time model;
- physically consistent lighting/terminator in Three.js, with a controlled artistic readability layer;
- planet curvature and limb occlusion;
- orbital/surface route geometry around the planet;
- night-side visibility through ship lighting, sensors, beacon lights, station illumination, and optional night-vision/thermal equipment;
- distinct shadow-side encounters, comms conditions, power systems, and anomaly hooks;
- route continuity and sector handoff across the terminator and across longitude wrap;
- client/server tests that prove the same position, time, lighting phase and encounter window are agreed.

Do not fake the dark side with a separate black texture or static night map. The night side is a location on the same rotating Mars.

## 5. Route designer: separate geography, route logic, and adventure content

Build a data-driven route authoring pipeline, not a collection of hard-coded mission coordinates.

Each route schema should contain:
- id, version, title, narrative purpose, faction context;
- origin/destination canonical location IDs;
- body/system coordinate frame and waypoint/corridor geometry;
- minimum/maximum altitude, orbital band, recommended speed and travel profile;
- route branches, alternate approaches, emergency exits and return routes;
- hazards, POIs, scan volumes, landing/approach volumes and collision proxies;
- weather/lighting/time windows and anomaly slots;
- event spawn rules and deterministic seeds;
- mission objective graph, optional objectives, fail/abort/recovery conditions;
- operation policy: solo, AI wing, co-op, public, private, competitive, spectator;
- player limits, server authority, reward eligibility, persistence and idempotency keys;
- unlocks and ship/equipment capability requirements;
- content budget: entities, effects, terrain tiles, network update rate, memory/CPU.

Route authoring must support visual spline/corridor editing in the existing Three.js tools or an internal developer tool, but exported route definitions must be versioned, reviewable data. Do not store mission truth only in scene objects or editor-only state.

### Route experience modes

One route can support multiple experiences:
- free exploration: no mandatory objective, optional discoveries;
- campaign journey: authored objective sequence and story beats;
- live dynamic operation: server-issued activity with changing world conditions;
- co-op expedition: shared goals and AI wing support;
- competitive interception: only where balanced and isolated from exploration rewards;
- emergency/rescue: distress calls, escort, extraction, recovery;
- anomaly research: scan, sample, stabilize, defend or escape;
- logistics/supply: move cargo and change station/faction supply;
- fleet battle: large operation instance with capital ships and sub-objectives.

A route is not inherently a reward-bearing mission. The server decides eligibility and settlement from operation type, identity, validated participation and outcome.

## 6. Reimagine each existing Mars route

### A. Rust Disc — frontier debris corridor and relay wilderness

Keep the relay recovery and sentinel as its recognizable story seed, but turn the region into a large, explorable debris corridor near Mars's outer traffic approaches.

Live activities:
- inspect damaged convoy transponders and reconstruct the original convoy's route;
- navigate asteroid clusters, debris wakes, wreckage and unstable fragments;
- recover black boxes, salvage, ship components and encrypted flight logs;
- repair, align or defend relays that restore communications;
- respond to distress beacons and escort salvage craft;
- encounter AI patrols, scavengers, USSF/Accord scouts, and player expeditions;
- discover optional routes and hidden wrecks;
- trigger a relay-defense event or sentinel encounter as an operation, not the only thing the map contains.

The old local 460-unit trainer remains a safe no-reward practice scenario until its flight feel is migrated and certified. The old 3,000-unit co-op mission becomes one authored operation instance in this wider region, not the entire Rust Disc world.

### B. Mars Approach — live orbital arrival and planetary access network

Turn this into a genuine approach corridor from deep space through Mars orbital traffic into the planet's near-space.

Live activities:
- long-range scan and navigation beacon calibration;
- approach through orbital debris, satellites, defense grids and traffic lanes;
- identify and evade/engage patrols;
- escort transports and damaged ships;
- choose high orbit, low orbit, moon transfer, station docking or approved atmospheric entry;
- map safe corridors and hazards;
- support orbital rescue, defense, reconnaissance and blockade-breaking operations.

The route must have actual approach/orbit transition volumes and body-relative navigation. A sphere that can be scanned is not enough. Surface landing is a separate feature with its own terrain, collision, atmospheric and server tests; do not claim it exists until it is playable.

### C. Pale Beacons — signal chain and anomaly investigation

Transform the beacon chain into an exploratory signal network that can lead to optional and emergent missions.

Live activities:
- triangulate signals from multiple positions;
- synchronize or repair beacon arrays;
- follow signal echoes that change with time, weather, faction activity or anomaly state;
- defend research teams or escort survey drones;
- decode a signal to reveal a hidden location or alternate corridor;
- encounter false signals, decoys, hostile interference and sensor shadows;
- enter a bounded anomaly volume and complete research/containment objectives.

The old guardian fight becomes one possible consequence of investigation. A signal should not always resolve to a combat drone.

### D. Night-side Station — planetary shadow exploration

Make the dark-side station a major demonstration of planetary continuity.

Live activities:
- fly from day-side into night-side while Mars rotates;
- locate an unlit station using passive sensors, beacon pings and thermal signatures;
- restore power to station sectors;
- recover the warm black box and determine who recently occupied the station;
- rescue missing technicians or search abandoned habitation modules;
- navigate dust storms, low-visibility approaches, orbital shadow and comms blackouts;
- discover hidden hangars, buried relay links, and underground/surface access where terrain supports it.

The station is a physical POI with a transform, collision/approach envelope, ownership and server state—not merely a strategic map coordinate.

### E. Dust Lane — moving debris and stealth corridor

Reimagine the debris field as a moving, hazardous route with changing safe passages.

Live activities:
- thread a ship through moving debris and wreckage;
- use stealth or emissions discipline to avoid patrol detection;
- escort mining/salvage convoys;
- intercept or protect cargo;
- track ships that travel without detectable drive signatures;
- scan rogue objects and anomalous mass signatures;
- exploit cover for combat or missile evasion;
- create emergent rescue and salvage opportunities from collisions and distress events.

The field needs deterministic or server-owned movement seeds and collision proxies. Clients must not independently invent hazard positions.

### F. Below the Signal / Mars Signal — deep planetary mystery

Turn the campaign endpoint into a larger discovery arc, not simply another map marker.

Live activities:
- correlate discoveries from Rust Disc, Pale Beacons, Night-side and Dust Lane;
- locate the signal source through multi-stage navigation;
- explore an orbital structure, surface installation or subterranean site only after that content is actually built;
- uncover USSF/Accord competing interpretations and faction decisions;
- trigger a multi-stage research, defense, recovery or containment operation;
- let validated player discoveries unlock new routes and future content.

Keep the story's core authored truth consistent, while allowing encounter order and optional discoveries to vary.

### G. Phobos Yard — logistics and social hub

Make Phobos Yard an actual 3D station/moon destination and multiplayer rendezvous:
- docking and ship refit;
- market, refinery, cargo and supply contracts;
- squad formation and operation dispatch;
- shipyard defense and emergency repair;
- player-to-player social presence where safe;
- faction supply and strategic consequences.

Existing persistent economy and account services remain authoritative. The 3D hub is a new presentation/interaction layer over those services, not a second wallet.

### H. Outer Fringe Anchorage and Deep Nebula Observatory — frontier expansion

Treat these as later outward expansion anchors. Their current persistent service/location data is not proof of fully rendered, navigable 3D regions. Build their actual world spaces only after Mars and its orbital network work end to end.

Outer Fringe should focus on frontier salvage, logistics, contested supply and fleet assembly. Deep Nebula should focus on research, sensor uncertainty, anomalous space, restricted services and high-risk expeditions.

### I. Operation Iron Eclipse — roaming/locatable fleet operation

Iron Eclipse should become a live operation that can be discovered in Mars orbit or launched from a briefing/dispatch board:
- capital ship with world-space transform and visible approach geometry;
- server-owned point-defense, shield-array and reactor subsystems;
- AI wing with attack/defend/escort/regroup orders;
- optional allied human pilots;
- fleet perimeter, hazards, support assets, extraction corridors and changing objectives;
- public/private operation admission and late-join rules;
- visible strategic consequences after server-validated completion.

The existing bounded mission implementation can be reused as the first operation instance. Do not assume its capital ship is already a persistent roaming world entity.

## 7. Live multiplayer world behavior

The world should feel shared without requiring every client to simulate every player and AI.

- Use authoritative sector/instance simulation for near-field ships, collisions, combat, anomaly effects, objectives and operation results.
- Use spatial interest management so each pilot receives relevant nearby entities only.
- Use stable entity IDs and canonical coordinates across sector transitions.
- Define presence tiers: same local sector (full pose/interaction), nearby region (coarse presence/operation markers), distant system (strategic status), offline/unknown (last known state, explicitly marked).
- Use client prediction/interpolation for responsiveness; server owns outcomes.
- Use deterministic seeds and server scheduling for dynamic events and moving hazards.
- Use handoff tickets or equivalent validated transfer when crossing streamed sector boundaries; never duplicate control authority.
- Define late join, spectator, party, public/private and reconnect rules per operation type.
- Persist discoveries, contracts, faction consequences and rewards through existing authenticated services with idempotent settlement.
- Keep local trainer and non-reward modes isolated from online reward settlement.

“Live route” means the route is active and can host synchronized events and players while the authoritative service is running. Do not label a cached strategic snapshot as live. Show freshness/connection state clearly.

## 8. The Three.js universe prototype: extraction and retirement policy

Do not delete Three.js from WFM. It is the current 3D rendering foundation and is appropriate for planetary scenes, camera, lighting, atmosphere, ship models, VFX and streamed presentation.

If a separate Three.js universe prototype exists outside the canonical WFM runtime, audit it as a source of capabilities:
- scene graph and renderer lifecycle;
- Mars sphere/terrain construction and level of detail;
- atmosphere, day/night lighting and terminator;
- orbital and surface camera behavior;
- navigation visualization, waypoint/spline tools;
- procedural stars, debris, stations and POIs;
- streaming, origin rebasing, culling, material and texture budgets;
- transitions, loading, disposal and memory cleanup.

For each capability, classify KEEP / EXTRACT / ADAPT / REWRITE / REJECT, with exact source path, license/asset provenance, dependencies, runtime cost, tests and parity criteria. Rebuild it against canonical WFM world IDs, coordinates, simulation state, multiplayer presence and server-authoritative event contracts.

Only retire the prototype as a playable runtime after:
1. all required capabilities are integrated into WFM;
2. visual and gameplay parity checks pass;
3. performance/memory targets pass on supported Android devices and desktop;
4. route, camera, day/night, sector transition, multiplayer and reconnect tests pass;
5. resource disposal and repeated travel do not leak GPU/CPU memory;
6. the replacement has a tested rollback path.

Keep reusable code or reference material if licensing and architecture permit. Retire duplicate app entry points, duplicate simulation ownership, and duplicate state stores—not useful Three.js knowledge or the renderer itself.

## 9. Route and world tests

Required automated and staging tests:
- coordinate conversion round trips across planet-fixed, inertial, sector-local and render-local frames;
- route continuity across longitude wrap and sector/origin-rebase boundaries;
- day/night terminator progression against authoritative world time;
- full Mars circumnavigation with no map reload, coordinate jump, or lost player state;
- day-side → night-side → day-side flight with synchronized lighting and POI availability;
- atmosphere/orbit transition envelopes and failure/recovery paths;
- route branch/alternate corridor and off-route exploration;
- server/client hazard seed and collision agreement;
- multiplayer pilots in the same region see consistent positions, POIs, events and encounter state;
- sector handoff with no duplicated entity, lost inventory, reward duplication or stale authority;
- disconnect/reconnect during travel and active operation;
- event start/end and late join behavior;
- account-isolated discoveries, idempotent reward settlement and no-reward local trainer;
- mobile sustained flight, memory, thermal and frame-time tests;
- renderer teardown/re-entry and repeated route travel with GPU resource leak checks.

Measure performance on target devices. Set explicit budgets for frame time, memory, terrain tiles, draw calls, network messages, entity count, server tick cost and bandwidth. Use adaptive LOD and quality tiers; do not make simulation outcomes depend on visual quality.

## 10. Phased delivery

**Phase A — Route and prototype forensic inventory**
- Refresh current staging tip.
- Inventory all route, world, mission, Galaxy, Lab, Rust Disc, Three.js prototype and server files.
- Produce exact route geometry/data maps, runtime boundaries, dependencies, and capability extraction matrix.
- Confirm what the Three.js prototype actually contains; do not infer capabilities from screenshots or visual similarity.

**Phase B — Mars coordinate and time foundation**
- Define Mars body model, coordinate frames, time/rotation, route schema and stable POI IDs.
- Add unit/integration tests before large content production.

**Phase C — One complete playable circumnavigation slice**
- Build one low-altitude or orbital route segment that crosses the terminator.
- Stream sectors, maintain player pose and time, show synchronized day/night, include one physical POI and one dynamic event.
- Test full route loop and mobile performance.

**Phase D — Recast legacy routes as world regions**
- Rust Disc, Mars Approach, Pale Beacons, Night-side, Dust Lane, Mars Signal, Phobos Yard.
- Keep original mission objective chains as operations embedded in those spaces.
- Preserve progression and reward contracts through server-side validation.

**Phase E — Multiplayer shared exploration**
- Presence, parties, operation discovery/join, event synchronization, sector handoff, reconnect, discovery settlement.
- Begin with a small capacity target and measure before scaling.

**Phase F — Fleet operations and dynamic Mars**
- Iron Eclipse, capital ship encounters, AI wing, faction patrols, convoy/rescue, live events and world consequences.

**Phase G — Expansion beyond Mars**
- Phobos/Deimos and local system first, then other planets, star systems, galaxies and dimensional spaces using the same body/route/sector abstractions.

Each phase is a complete playable slice with feature flags, automated tests, server evidence, performance measurements, mobile validation and rollback.

## 11. Expert AI developer deliverables

Before coding:
1. current commit and branch proof;
2. source map for every route and every 3D universe capability;
3. current-vs-target route and world architecture;
4. Mars coordinate/time/lighting specification;
5. route schema and sample definitions;
6. prototype extraction matrix (KEEP/EXTRACT/ADAPT/REWRITE/REJECT);
7. multiplayer presence, handoff and operation contracts;
8. first circumnavigation slice plan, files, tests, budgets and rollback.

Then implement only the first complete circumnavigation slice. Do not redesign all route content and multiplayer infrastructure in one untestable rewrite. Show a player flying from day-side to night-side and back in one continuous Mars world, with a real POI, synchronized time, one live event, and at least two authenticated pilots sharing the same authoritative sector. If multiplayer proof is not ready, label the first deliverable honestly as a single-player/staging simulation and do not call it a live multiplayer world.

## 12. Non-negotiable rules

- One canonical WFM game runtime; no second universe app embedded or linked as the game.
- Three.js remains the renderer unless measured evidence justifies a separate migration.
- No route is a physical wall; routes are guidance and adventure frameworks.
- A visible planet is not proof of terrain collision, landing, orbit, or circumnavigation.
- A persistent strategic location is not proof of a playable 3D space.
- A local trainer is not authoritative multiplayer.
- No client-trusted combat, location, discoveries, faction state, economy or rewards.
- No duplicate identity, wallet, inventory, progression or event authority.
- Do not delete legacy code or data before parity, migration, tests and rollback.
- Staging-first. No Production deploy, schema migration, main merge or destructive cleanup without explicit owner approval.

**The player should not choose a Mars level. The player should enter Mars, fly it, explore it, and encounter a living war unfolding across it.**
