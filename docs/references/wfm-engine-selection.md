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

**Current owner direction, clarified 2026-11-08:** Three.js remains the primary
3D renderer and scene-runtime foundation for the Orbital open universe and
Combat Lab. Orbital owns the shared gameplay/simulation and world-state
contracts; native Orbital WebGL2 is a supported companion renderer. Do not
remove Three.js or treat it as temporary migration infrastructure. The
authoritative decision is maintained in
`docs/infinite-war/RENDERING-STRATEGY-AND-UNIVERSE-OWNER.md`.

The current code uses the custom Three.js + React/Vite client and WFM TypeScript
simulation. React Three Fiber remains optional only if a measured, isolated need
justifies it. Custom six-degree-of-freedom flight and combat remain WFM-owned;
the backend remains authoritative for multiplayer and progression.

**Leading visual-authoring experiment:** Needle Engine is the first candidate to
prototype because the documents identify its Unity/Blender workflows, Three.js
foundation, and scene-authoring potential. Treat it as an optional renderer and
content-pipeline experiment—not as the combat simulation, multiplayer authority,
or an approved full migration. The earlier Unity recommendation remains relevant
if native iOS/Android distribution becomes the dominant requirement; evaluate
that against the same benchmark rather than starting multiple migrations.

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
are WebGL. The game and combat entry points are dynamically imported. The
current build should still be checked because a separate Three.js chunk can
remain a substantial deferred download.

Run `pnpm --filter @workspace/war-for-mars run bundle:audit` to produce the
ignored local report `generated-artifacts/wfm-bundle-audit.json`. It records
chunk raw/gzip sizes, static and dynamic import edges, the initial static-load
closure, and each chunk's contributing modules and rendered/original byte
counts. The report is a local diagnostic; it is not included in the deployed
static site. Re-run it after significant client dependency or import changes.

The captured build on 2026-11-03, before adding this audit tool, reported:

| Output | Raw | Gzip |
| --- | ---: | ---: |
| Initial entry chunk | 370.00 kB | 113.16 kB |
| Three.js engine chunk | 518.89 kB | 131.06 kB |
| Rust Disc flight chunk | 59.08 kB | 19.74 kB |
| Arena chunk | 62.93 kB | 22.12 kB |

Vite emitted its >500 kB warning for the engine chunk. This is a build-size
signal, not proof of poor runtime frame rate or proof that Three.js is unsuitable.
These figures are a fresh local production build, not production-server or
physical-device measurements. The earlier October bundle profile is historical
and must not be substituted for this current measurement.

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

## Benchmark plan and acceptance evidence

Compare the same small playable encounter in the current Three.js stack and
Needle. If native distribution becomes the deciding product requirement, include
Unity as a candidate rather than starting a separate migration prematurely. Use
equivalent ship behavior/assets and the same formally supported devices:

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

The decision gate is comparative evidence: adopt Needle only if it materially
improves scene authoring/content iteration while meeting integration, mobile
performance, bundle, and asset-loading requirements. Migrate the runtime only
when that benefit justifies the porting and retest burden. Until then, continue
bounded, testable slices in the existing client and keep simulation and
persistence renderer-independent.

## Non-goals

- Do not claim a Needle, Unity, or Unreal prototype exists unless built and
  measured.
- Do not claim 60 FPS, memory, heat or six-minute stability from bundle data.
- Do not add a general-purpose physics engine before a representative collision
  benchmark shows a concrete benefit.
- Do not switch to WebGPU as a bundle-size shortcut; test it separately because
  compatibility and performance depend on devices and scene workload.
- Do not turn off Vite's chunk warning to make the build appear healthy.
