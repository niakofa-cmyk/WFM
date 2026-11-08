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

## Current repository state after authorized retirement

The owner explicitly chose immediate Three.js removal and accepted retiring
unmigrated modes. This is not a claim of feature parity: the current playable
Orbital-native scope is a local Cinder Ring flight slice.

| Area | Current implementation | Consequence |
|---|---|---|
| Shared Orbital package | `lib/orbital-sim` supplies deterministic math, flight, weapons, input/rules, runtime IDs, and mode contracts | It remains the simulation foundation; it does not by itself implement the entire persistent online game |
| Active local flight | `OrbitalFlightPreview.tsx` and `orbital-native-flight-renderer.ts` own the WebGL2 loop, Cinder approach, docking, and local skirmish | This is the only currently playable flight slice; it does not grant shared combat authority or rewards |
| Hangar | `HangarShip.tsx` and `orbital-native-hangar-renderer.ts` use the Orbital-owned renderer | Hangar inspection remains available without Three.js |
| Legacy Arena and sector routes | `Arena.tsx` and `RustDiscFlight.tsx` are explicit retired-route notices; `/expedition` is retired | Existing campaign, competitive, co-op, and sector simulations are not migrated to the native renderer and are not launchable through these routes |
| Cinder approach route | `CinderRingDockingApproach.tsx` is a redirect to the native Cinder flight scene | No separate approach renderer remains |
| Build output | The WFM package no longer declares `three` or `@types/three`; Vite rejects any Three.js module in either production bundle | Three.js is removed rather than deferred in compatibility chunks |

The checked-in Orbital code includes an owned WebGL2 renderer and a connected
local flight loop. The open-universe multiplayer, server-authoritative
encounter/reward flow, campaign scenes, and co-op operation presentation are
not thereby complete. Historical bundle measurements are not current device
performance evidence.

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

## Immediate retirement decision and follow-up engine gates

The owner approved removing Three.js now and retiring modes that had no
Orbital-native presentation. Their previous renderers were not silently
replaced or declared equivalent. The active routes are limited to the native
Cinder Ring slice and account-facing screens. Rebuild each retired mode as an
Orbital-owned experience before restoring its entry point.

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
4. **Rebuild retired modes individually.** Migrate campaign, Rust Disc,
   cooperative sectors, and multiplayer presentation into Orbital only when
   their simulation, authority, replay, and UI contracts are connected and
   verified. Retired renderers are not rollback paths.
5. **Measure supported devices.** Capture bundle transfer/parse, startup, p95/p99
   frame time, memory/GPU resource trends, draw calls, battery/thermal behavior,
   and network load on real target phones and desktop. Compare the same scene,
   quality, hardware, and asset set before and after. Do not assume an engine
   rewrite inherently improves performance.
6. **Keep the dependency absent.** Both production builds fail if a Three.js
   module is present. Do not add a second renderer or a compatibility chunk;
   prove new Orbital renderers through bundle, route, replay, and device checks.

## Acceptance criteria

- Every currently playable WFM flight route uses one Orbital-owned rendering
  and simulation lifecycle; unported modes are clearly retired.
- No production WFM game path imports or executes Three.js; neither production
  bundle contains Three.js modules or chunks.
- Render lifecycle, graphics resources, camera, and input are owned and
  disposed by Orbital, with no duplicate loops across transitions.
- The Cinder Ring slice retains its verified local flight and docking behavior.
  Server authority remains server-owned; no retired route claims match, campaign,
  or reward parity.
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
  simulation. Entering the universe through `/universe`, `/flight`, `/play`, or
  the standalone Combat Lab auto-starts this scene in an immersive viewport.
  It is explicitly local and no-reward.
- `orbital-native-flight-renderer.ts` draws the resulting ship pose, target,
  projectiles, and the same Cinder-sector rock coordinates used by collision,
  with rocks batched as instances. Camera pose follows the simulated craft.
- `orbital-flight-preview-input.ts` adapts the existing pilot bus to local
  sector input, including continuous thumb-circle roll. It does not change a
  network input or reward contract.
- The native renderer owns its WebGL2 resources and resize lifecycle; the
  preview fixed-steps the shared simulation and clears held input on blur and
  app backgrounding.

This is the current playable flight slice. It includes a visual Cinder Ring
station and local approach/dock/undock gate at the established 22 m range, 4 m/s
closure-speed limit, and 35-degree heading tolerance. The native renderer builds
distinct lightweight silhouettes for the selectable ship IDs. These are
presentation-only; they do not change collision or combat authority. Docking
exposes a station activity console with a bounded native Orbital skirmish
against one training drone. It exercises lock, primary fire, guided missiles,
hostile guided fire, countermeasures, extraction, and local debrief through the
shared sector simulation. The server-services link remains server-owned and
does not treat local docking as an authenticated location.

The user chose to retire the separate Arena and legacy sector renderers
immediately. The previous snapshot handoff and compatibility UI are removed;
campaign, co-op, competitive, and older sector experiences have not been
migrated and must not be described as playable through Orbital until rebuilt.
Server authority and settlement services remain in place, but no retired UI
route can start a match or claim rewards.

The Night-side Station, Mars surface traversal, persistent shared free flight,
and live Orbital multiplayer combat remain not implemented. No parity gate
blocks removal of the retired renderer; future mode launches require their own
Orbital-native and server-authority verification.

Related maintained references:

- [Mars planetary routes and adventures](MARS-PLANETARY-ROUTES-AND-ADVENTURES.md)
- [Current engine architecture and mode inventory](engine/MASTER-ENGINE-ARCHITECTURE.md)
- [Performance and physical-device proof requirements](engine/PERFORMANCE-AND-DEVICE-VALIDATION.md)
- [Orbital runtime rebuild contract](ORBITAL-UNIVERSE-REBUILD-CONTRACT.md)
