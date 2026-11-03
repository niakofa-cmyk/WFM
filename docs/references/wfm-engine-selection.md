# WFM Engine Selection and Benchmark Guide

## Source and decision

The owner's complete 416-line engine assessment is preserved at
`attached_assets/Pasted-Worked-for-27s-WAR-FOR-MARS-Choosing-the-Right-Engine-f_1793711493465.txt`.
This guide applies it to the current repository; it does not claim that the
proposed Unity comparison or physical-device certification has happened.

**Decision:** keep the current Three.js/Vite client operational. Evaluate Unity
as the leading native-mobile candidate with a small, equivalent combat
prototype. Consider Unreal only if the same measured requirements show a
meaningful visual or technical advantage on supported devices. Do not migrate
because of one chunk-size warning, nor infer that a different renderer fixes
network latency or gameplay authority.

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

## Benchmark plan and acceptance evidence

Compare the same small playable encounter in Three.js and Unity, using
equivalent ship behavior/assets and the same formally supported devices:

- one controllable fighter and one opposing fighter;
- primary fire, target acquisition/lock, missiles, shield/hull damage and
  destruction;
- basic enemy behavior, visible hit feedback and mobile controls.

Measure cold start, time to playable combat, combat startup, frame-time
consistency, peak memory, thermal behavior, effects load, AI load, network
handling, installed/download size, and implementation effort. Run sustained
combat for at least six minutes; a brief empty-scene FPS reading is not
certification. Target stable 60 FPS only on explicitly defined supported
hardware and report results per device.

The decision gate is comparative evidence: migrate only if the prototype
demonstrates a material benefit for WFM's native mobile delivery and total
development cost that justifies the porting and retest burden. Until then,
continue bounded, testable slices in the existing client and keep simulation
and persistence renderer-independent.

## Non-goals

- Do not claim a Unity or Unreal prototype exists unless built and measured.
- Do not claim 60 FPS, memory, heat or six-minute stability from bundle data.
- Do not switch to WebGPU as a bundle-size shortcut; test it separately because
  compatibility and performance depend on devices and scene workload.
- Do not turn off Vite's chunk warning to make the build appear healthy.
