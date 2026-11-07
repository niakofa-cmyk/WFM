# Orbital Engine-only renderer — rebuild directive

## Controlling owner decision

WAR FOR MARS: INFINITE WAR will use Orbital Engine as its sole game engine and
rendering foundation. Do not build the universe around a separate Three.js game
or keep Three.js as a direct runtime dependency in the finished game. Study
Three.js-based work only for useful techniques and capabilities, then implement
those capabilities in Orbital Engine.

One engine does not mean one monolithic system. Rendering, simulation, flight,
combat, world streaming, fleet logic, multiplayer authority, persistence, and
React application UI can remain modular, provided the game has one owned engine
runtime and no competing renderer/game runtime.

This directive supersedes earlier wording that Three.js may remain as the
Orbital renderer. The earlier recommendation remains useful only as historical
context; it is not the target architecture.

## Preserved source

The full owner-supplied comparison and recommendation is retained unchanged at
[`attached_assets/Pasted--War-for-Mars-Orbital-Engine-vs-Three-js-Yes-My-recomme_1794031481638.txt`](../../attached_assets/Pasted--War-for-Mars-Orbital-Engine-vs-Three-js-Yes-My-recomme_1794031481638.txt).
The later visual-pipeline proposal is preserved verbatim at
[`references/redesign/Pasted-To-port-the-technical-features-and-visual-capabilities-_1794048558104.txt`](references/redesign/Pasted-To-port-the-technical-features-and-visual-capabilities-_1794048558104.txt).
Its Three.js implementation is not adopted; its read-only rendering,
instancing, local-coordinate and resource-lifecycle techniques are being ported
into the Orbital-owned WebGL2 proof.
The source explicitly distinguishes “large” from “too heavy”: its historical
bundle numbers do not establish a current performance failure. The reason to
move is one coherent, owned engine architecture, with performance decisions
validated by current measurements.

## Current repository audit — checked-out branch

The repository does **not yet** contain the Orbital-native renderer described
by the target. Current source evidence:

| Area | Current implementation | Consequence |
|---|---|---|
| Shared Orbital package | `lib/orbital-sim` supplies deterministic math, flight, weapons, input/rules, runtime IDs, and mode contracts | It is a simulation/runtime-rules library, not a complete renderer/game engine |
| Main Orbital Arena | `artifacts/war-for-mars/src/game/Arena.tsx` directly imports Three.js and creates `WebGLRenderer`, `Scene`, camera, geometry, material, lighting, effects, and teardown | Removing Three.js now removes the only working Arena renderer and breaks playable Orbital modes |
| Rust Disc flight | `RustDiscFlight.tsx` and `three-flight-runtime.ts` directly create Three.js presentation/rendering | Legacy flight presentation remains a separate migration path |
| Hangar and visuals | `HangarShip.tsx`, `orbital-visuals.ts`, `theater-surfaces.ts`, and sector visuals use Three.js objects and GPU resources | Ship inspection, damage/weapon presentation, planetary limb, and streamed-sector visuals depend on it |
| Cinder approach | `CinderRingDockingApproach.tsx` dynamically imports Three.js for its local scene | The approach is also not yet Orbital-native rendering |
| Build output | `vite.config.ts` explicitly names a `three-engine` chunk; the WFM package declares Three.js | The dependency is intentionally deferred, not absent |

The checked-in Orbital package already provides a meaningful simulation
foundation, but there is no complete Orbital-owned renderer or renderer adapter
in the inspected source. Three.js is not automatically too heavy: the supplied
historical mobile report says the combat bundle was deferred. Those October
measurements must be refreshed before drawing current performance conclusions.

## Required target boundary

```text
React application shell
  account, hangar/menu, accessible HUD, settings, social UI
             |
Orbital Engine runtime
  renderer + scene/resource lifecycle + camera + world streaming
  simulation clock + flight + collision + combat + fleet/AI
  mode adapters + network synchronization + operation transitions
             |
Existing server-owned identity, matchmaking, world, progression and rewards
```

Orbital Engine is the game and renderer owner. The UI can request commands and
render engine-provided state; it must not create a second gameplay scene,
simulation tick, or renderer. Existing authority services remain authoritative.
The offline sandbox remains no-reward.

## Migration and removal gates

Do not uninstall Three.js or delete its renderer code before a working
replacement exists. Removing the current library at this point would break
Arena, Hangar, Cinder approach, Rust Disc presentation, and visual helpers
without providing an Orbital renderer in their place.

1. **Specify the engine API.** Define engine start/stop, render surface, scene
   resources, camera, resize/device-loss, input, fixed-step simulation,
   deterministic presentation updates, asset loading, diagnostics, and teardown.
   Define coordinate, unit, precision, and ownership rules.
2. **Build Orbital renderer proof.** Implement a minimal standalone Orbital-owned
   render loop and scene with a test craft, camera, lighting, Mars surface/limb,
   input-driven spatial flight, and deterministic resource disposal. No Three.js
   imports in this proof.
3. **Prove behavior parity.** Compare identical flight/input traces, transforms,
   hit/damage/weapon outcomes, station approach, camera behavior, and replay
   determinism. Keep simulation rules independent of renderer APIs.
4. **Migrate one visual surface at a time.** Begin with a bounded local Orbital
   universe slice, then Hangar/ship visuals and mode presentation. Keep
   Rust Disc, Cinder approach, and other existing paths available as rollback
   until their own acceptance gates pass.
5. **Measure supported devices.** Capture bundle transfer/parse, startup, p95/p99
   frame time, memory/GPU resource trends, draw calls, battery/thermal behavior,
   and network load on real target phones and desktop. Compare the same scene,
   quality, hardware, and asset set before and after. Do not assume an engine
   rewrite inherently improves performance.
6. **Remove the dependency.** Only after all production paths are migrated,
   delete direct Three.js usage and its package/build chunk, confirm no transitive
   runtime dependency is introduced by Orbital, and verify both production
   builds, route contracts, replays, and rollback strategy.

## Acceptance criteria

- The main game and all promoted modes use one Orbital-owned rendering and
  simulation lifecycle.
- No production WFM game path imports or executes Three.js after the removal
  gate; the final bundle has no Three.js engine chunk.
- Render lifecycle, graphics resources, camera, and input are owned and
  disposed by Orbital, with no duplicate loops across transitions.
- Existing ship identities, flight controls, combat, damage, effects, account
  flows, multiplayer authority, and mode-specific behavior pass agreed parity
  tests before each old path is retired.
- Android/iOS and desktop performance claims come from the same measured
  scenarios on target hardware. The source's 60 FPS and 1.5 GB values are
  targets to evaluate, not proof or universal acceptance budgets.
- Online movement, encounters, combat outcomes, exploration discoveries, and
  rewards remain server-owned where their existing contracts require it.

## First build slice

The route/adventure atlas and bounded local universe are still useful product
work, but they do not complete the renderer migration. A first connected
Orbital-native flight slice now runs against the existing simulation package.
The next engine slice should bring station approach and docking into that native
scene before porting the entire Arena. In parallel, keep the Mars route atlas honest about
which routes are local, compatibility-only, or planned; do not claim a
circumnavigating or shared planetary world until its coordinate, streaming, and
authority gates pass.

### Connected local flight slice delivered

The current branch now contains these bounded foundations:

- `lib/orbital-sim/src/planetary-world.ts` defines deterministic Mars rotation,
  planet-fixed/inertial coordinate conversions, and direct day/night exposure.
  It is pure math; callers in a shared universe must still use server-owned
  world time and Sun direction.
- `OrbitalFlightPreview.tsx` uses the existing two-stick pilot UI and keyboard
  actions to drive `createFlight` / `stepFlight` in the shared Orbital sector
  simulation. It is explicitly local and no-reward.
- `orbital-native-flight-renderer.ts` draws the resulting ship pose, target,
  projectiles, and the same Cinder-sector rock coordinates used by collision,
  with rocks batched as instances. Camera pose follows the simulated craft.
- `orbital-flight-preview-input.ts` adapts the existing pilot bus to local
  sector input, including continuous thumb-circle roll. It does not change a
  network input or reward contract.
- The native renderer owns its WebGL2 resources and resize lifecycle; the
  preview fixed-steps the shared simulation and clears held input on blur and
  app backgrounding.

This is the first connected flight-renderer migration slice, **not** a
replacement for the primary Arena. It now includes a visual Cinder Ring station
and local approach/dock/undock gate at the established 22 m range, 4 m/s
closure-speed limit, and 35-degree heading tolerance. The native renderer also
builds distinct lightweight silhouettes for all sixteen selectable ship IDs.
These are presentation-only; they do not change collision or combat authority.
It does not yet migrate the full combat scene, streamed planetary travel,
authenticated multiplayer, or persistent universe state. The primary Arena,
server authority, and existing Three.js compatibility renderer remain intact as
rollback paths. The Night-side Station remains planned/not-live.

The main-renderer retirement checklist and current evidence status are tracked
in [Orbital native renderer parity gate](ORBITAL-NATIVE-RENDERER-PARITY-GATE.md).

Related maintained references:

- [Mars planetary routes and adventures](MARS-PLANETARY-ROUTES-AND-ADVENTURES.md)
- [Current engine architecture and mode inventory](engine/MASTER-ENGINE-ARCHITECTURE.md)
- [Performance and physical-device proof requirements](engine/PERFORMANCE-AND-DEVICE-VALIDATION.md)
- [Orbital runtime rebuild contract](ORBITAL-UNIVERSE-REBUILD-CONTRACT.md)
