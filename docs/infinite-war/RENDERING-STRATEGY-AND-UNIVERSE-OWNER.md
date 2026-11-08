# Rendering strategy and single-universe owner

**Status:** Current owner direction, clarified 2026-11-08.

## Decision

WAR FOR MARS: INFINITE WAR remains one Orbital Combat Lab universe and one
shared gameplay/simulation foundation. Keep and use both the Three.js renderer
and the native Orbital WebGL2 renderer. Three.js is the main 3D rendering and
scene-runtime foundation for the infinite open universe and Combat Lab build.
Orbital's shared simulation, world state, controls, and server authority are
integrated with that Three.js foundation; Three.js is not merely a source of
techniques or a temporary dependency to remove. Use native WebGL2 as an
additional renderer for supported previews, specialized views, or measured
fallback needs. Other render helpers may be considered when they serve this same
universe and pass compatibility and performance checks.

The renderer choice does **not** create a second game, universe, physics model,
identity system, progression owner, or multiplayer authority. Renderers are
presentation backends for the same Orbital-owned world and simulation state.
Earlier documents that prohibited shipping Three.js are historical on that
point; their evidence about current code, performance testing, and staged
changes remains useful.

Code-splitting Three.js out of the initial menu download is a loading/performance
boundary, not an engine-retirement plan. Keep the library in the playable game,
load it when the 3D experience needs it, and retain bundle audits rather than
weakening their limits. Engine choice alone does not fix authentication,
networking, server authority, or deployment readiness.

## Current code relationship

| Surface | Current role | Direction |
|---|---|---|
| `@workspace/orbital-sim` | Shared flight/combat simulation and runtime rules | Remains the canonical gameplay foundation |
| `Arena.tsx` | Main Orbital universe presentation; currently uses Three.js | Keep and continue building the main universe here |
| `RustDiscFlight.tsx` | Three.js presentation and operation/HUD flow over shared sector simulation | Preserve its mechanics; connect its route and operations to the main universe lifecycle |
| Native Orbital WebGL2 flight renderer | Companion presentation path | Keep for supported previews/specialized use and feed it the same canonical state |
| React controls/HUD | Input and interface layer | Keep shared input normalization; do not let presentation own authority |
| API/socket services | Authenticated world, multiplayer authority, settlement | Continue to own identity, live outcomes, and rewards |

This is a target relationship, not a claim that every path is already unified.
The Rust Disc experience and main Arena can still have separate rendering
lifecycles; separate routes do not establish a second universe or simulation.

## Route and gameplay integration

Mars Approach, Rust Disc, night-side travel, and future routes should become
physical, actionable activities in the primary Orbital universe. Their route
identities, locations, objectives, patrols, squad orders, evidence, and
extractions should be represented in the common world lifecycle. A mission may
use an isolated server-authoritative operation instance for scale, but it must
be entered from and return to the same universe; it must not create a parallel
universe or duplicate account/reward authority.

Preserve the flight controls, camera behavior, HUD telemetry, route markers,
mission phases, squad orders, and Orbital simulation rules while integrating
routes. Do not silently change control signs, physics, server packets, or reward
authority.

## Rendering acceptance

1. Both renderer backends consume the same versioned Orbital pose/world state;
   neither advances an independent authoritative simulation.
2. Three.js remains the primary main-universe render path. Native WebGL2 remains
   available for its defined preview/specialized/fallback use.
3. A route can be entered, explored, and returned from without duplicating the
   universe or losing verified position.
4. Mission scenery, ships, HUD, route markers, and squad state remain coherent
   across render paths.
5. Server-side encounters, kill attribution, faction consequences, persistence,
   and rewards remain authoritative regardless of renderer.
6. Validate performance, memory, context recovery, mobile touch input, and
   controls on representative hardware before claiming parity or fallback
   readiness.

Verbatim owner uploads and historical renderer recommendations remain unchanged.
This file records the current correction and governs their interpretation.
