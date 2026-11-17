# WFM Engine Selection and Benchmark Guide

## Source and current recommendation

The owner's four complete engine assessments are preserved unchanged:

- `attached_assets/Pasted-Worked-for-27s-WAR-FOR-MARS-Choosing-the-Right-Engine-f_1793711493465.txt`
- `attached_assets/Pasted-My-recommendation-for-WAR-FOR-MARS-Choose-a-custom-Thre_1793712532053.txt`
- `attached_assets/Pasted-I-wouldn-t-rule-out-Needle-Engine-for-WAR-FOR-MARS-In-f_1793712547422.txt`
- `attached_assets/Pasted-My-pick-for-WAR-FOR-MARS-Needle-Engine-Between-Needle-E_1793712560372.txt`

This guide reconciles their recommendations with the current WFM repository; it
does not claim that a Needle prototype or physical-device certification has
happened.

**Current direction, clarified 2026-11-08:** Three.js remains the main shipped
3D rendering and scene-runtime foundation for the Orbital open universe and
Combat Lab. Orbital owns the shared gameplay/simulation rules, world state, and
authority contracts integrated with that renderer. Native Orbital WebGL2 remains
a supported companion renderer; it is not a separate game or simulation.
Three.js must not be removed or treated as techniques-only. The current owner
decision and boundaries are maintained in
`docs/infinite-war/RENDERING-STRATEGY-AND-UNIVERSE-OWNER.md`.

The older Orbital-only renderer directive remains historical evidence, not an
active removal plan. Do not add another renderer/runtime as a competing game.
Keep the Three.js code-splitting and bundle audits: deferring the 3D library
until a flight scene is needed is a performance strategy, not retirement.

Do not add Rogue Engine, Hology, X3JS, React Three Fiber, Rapier, or a second
engine framework to Production code just because a document mentions it. Test
Rapier only if collision/debris requirements show the existing custom simulation
needs it; WFM's custom flight model must retain control of spacecraft handling.
Do not migrate or select a renderer based solely on one bundle warning, and do
not infer that a renderer change fixes networking or authoritative gameplay.

## Architecture invariant

Keep the renderer replaceable:

1. **Client presentation:** rendering, input, prediction, animation, sound.
2. **Combat simulation:** flight, targeting, weapons, damage, AI and objectives.
3. **Multiplayer services:** identity, matchmaking, rooms, reconnection and
   validated results.
4. **Persistent universe:** locations, factions, missions, discoveries,
   economy and warfront state.

Stable, versioned contracts connect these layers. Server-owned systems validate
competitive movement, weapons, damage, objectives, outcomes, rewards and
persistent consequences. A future client-engine change must not require
rewriting identity, persistence, faction ownership or settlement.

## Current code and measured build

The web client uses Three.js with Vite; the existing flight and arena renderers
are WebGL. The game and combat entry points are dynamically imported. Three.js
is the primary 3D rendering foundation even though it is kept out of the initial
menu graph.

Run `pnpm --filter @workspace/war-for-mars run bundle:audit` to produce the
ignored local report `generated-artifacts/wfm-bundle-audit.json`. It records
chunk raw/gzip sizes, static and dynamic import edges, the initial static-load
closure, and each chunk's contributing modules and rendered/original byte
counts. The report is a local diagnostic; it is not included in the deployed
static site. Re-run it after significant client dependency or import changes.

The fresh production bundle audit on 2026-11-08 reported:

| Output | Raw | Gzip |
| --- | ---: | ---: |
| Initial static JavaScript graph | 413.74 kB | 125.71 kB |
| Three.js engine chunk | 536.91 kB | 137.08 kB |

The audit confirms that the Three.js chunk is absent from the initial static
load graph and remains within the configured gzip budget. The standalone Combat
Lab graph audit also passed 4/4 checks in the workspace quality run. These are
build/load-graph results, not runtime frame-rate or physical-device performance
claims.

The module-level audit found the Three.js chunk contains the core
`three.core.js` and `three.module.js` distributions, with no separately bundled
loader or post-processing modules. That indicates the large chunk is largely
the engine core, not an obvious stray asset/loader import. Its import graph is
reachable through deferred game screens but absent from the initial static
entry graph. The audit command fails if that lazy-load property regresses.

## Renderer-independent simulation boundary

Keep the deterministic simulation modules shared byte-for-byte between browser
and server and free of renderer/UI dependencies. The server validates competitive
movement, weapons, damage, objectives, outcomes, rewards and persistent
consequences. Keep visual prediction and presentation on the client. Changes to
the renderer must not silently alter authoritative simulation rules.

The game should grow toward versioned, centrally owned gameplay configuration
for flight, weapons, ships, multiplayer, universe and anomalies. Development
tuning tools must stay separate from production competitive configuration;
clients cannot set server-owned damage, weapon performance, or match rules.
Build this as bounded, versioned pieces rather than one unrestricted settings
surface.

## Performance plan and acceptance evidence

Continue building the main open-universe experience on Three.js. Measure
representative content on supported devices before adding another renderer or
runtime for a concrete specialized need. Use equivalent ship behavior/assets
and the same formally supported devices:

- one controllable fighter with six-degree-of-freedom movement, boost and brake,
  plus one opposing fighter;
- primary fire, target acquisition/lock, missiles, shield/hull damage and
  destruction, visible hit feedback and mobile controls;
- a small planetary/asteroid environment that exercises the visual authoring
  workflow without expanding into a full universe.

Measure cold start, time to playable combat, combat startup, frame-time
consistency, peak memory, thermal behavior, effects load, AI load, network
handling, installed/download size, and implementation effort. Run sustained
combat for at least six minutes on actual supported devices; a brief
empty-scene FPS reading is not certification. Also measure time to author and
iterate on a representative scene, React/Vite integration cost, and whether
assets can be loaded without increasing startup work unacceptably. Target stable
60 FPS only on explicitly defined supported hardware and report results per
device.

The decision gate is measured evidence for any additional renderer or authoring
runtime; it must not replace the selected Three.js foundation by assumption.
Keep simulation, persistence, and server authority renderer-independent so the
same Orbital-owned state can feed the primary Three.js renderer and supported
native WebGL2 companion path.

## Non-goals

- Do not claim a Needle, Unity, or Unreal prototype exists unless built and
  measured.
- Do not claim 60 FPS, memory, heat or six-minute stability from bundle data.
- Do not add a general-purpose physics engine before a representative collision
  benchmark shows a concrete benefit.
- Do not switch to WebGPU as a bundle-size shortcut; test it separately because
  compatibility and performance depend on devices and scene workload.
- Do not turn off Vite's chunk warning to make the build appear healthy.
