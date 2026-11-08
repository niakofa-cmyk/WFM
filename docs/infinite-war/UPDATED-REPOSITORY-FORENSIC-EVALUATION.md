# Updated Repository Forensic Evaluation

> **Renderer decision superseded 2026-11-08:** Three.js is the primary 3D
> renderer and scene-runtime foundation for the Orbital open universe; native
> Orbital WebGL2 remains a companion path. The renderer-removal conclusions
> below are historical and no longer control implementation. See
> [Rendering Strategy and Universe Owner](RENDERING-STRATEGY-AND-UNIVERSE-OWNER.md).

## Governing references

This source-backed audit follows the owner's latest reconstruction references:

- `attached_assets/Pasted-War-for-Mars-Infinite-War-Updated-Repository-Forensic-E_1793842864923.txt`
- `attached_assets/Pasted--WAR-FOR-MARS-INFINITE-WAR-MASTER-AI-GAME-DEVELOPMENT-P_1793842908766.txt`

The attachments are retained unchanged. The current direction is one game and
one shared Orbital gameplay/simulation foundation, rendered primarily with
Three.js. Native Orbital WebGL2 is a supported companion path, not a separate
universe. Preserve useful Rust Disc controls, missions, and environments while
connecting their route-specific presentation and operations to the shared
universe; do not duplicate simulation or authority.

## What this checkout proves

| Area | Source evidence | Verified current state |
|---|---|---|
| Shared gameplay rules | `lib/orbital-sim/src/flight.ts`, `sector-flight.ts`, `weapons.ts`, `game-mode.ts` | Shared deterministic simulation and a fail-closed `createOrbitalRuntime` bootstrap exist. The package is renderer-independent. |
| Orbital Combat Lab | `artifacts/war-for-mars/src/game/Arena.tsx`; `src/game/combat-lab.tsx` | Offline combat training uses the Orbital simulation through `Arena`. `Arena` itself still creates the WebGL renderer, scene, camera and render loop; these are not yet owned by a separate Orbital presentation module. Training is no-reward. |
| Rust Disc local flight | `src/App.tsx` `/flight` route; `src/game/RustDiscFlight.tsx`; `src/game/three-flight-runtime.ts` | The local route loads a separate Three.js renderer, scene, camera and loop. The component now calls Orbital fixed-step flight/combat rules, but still owns Rust Disc presentation, controls/UI, sector setup and operation flow. This is partial extraction, not complete engine migration. |
| Rust Disc co-op and related sector operations | `src/game/RustDiscFlight.tsx`; API/socket `sector-runtime` | Authenticated clients send flight input; the server owns accepted movement, snapshots, operation lifecycle and settlement validation. The client presentation still uses the Rust Disc scene. Do not move authority or rewards into the browser. |
| Iron Eclipse | Sector runtime and mission adapters | Squadron orders, capital-ship subsystems, objective progression and results depend on server-side rules. Preserve these while migrating the simulation and presentation together. |
| Arcade, Solo Flight, and campaign | `Arena.tsx`, `SoloFlight.tsx`, `WarApp.tsx`, game-mode catalog, progression routes | Offline Arcade and Solo Flight use canonical `orbital-v5` with no reward settlement; Contact uses versioned server replay. Other campaign runs remain pinned to compatibility rules. Keep replay/runtime pins and server validation intact. |
| Wing multiplayer | Wing socket, matchmaking and reward modules; `Arena.tsx` | The existing authenticated multiplayer and reward safeguards remain separate from Orbital combat. Live rooms are not yet an Orbital session; retain ten-human competitive gates and private/AI no-reward rules. |
| Universe | Galaxy/navigation and world-operation directory | Current universe features provide discovery/navigation and operation status; they do not prove continuous Mars-atmosphere → orbit → interstellar flight or persistent shared open-space simulation. |

The public landing and hangar no longer expose a separate **Rust Disc** local
flight command. The `/flight` route remains an internal compatibility path for
the Three.js scene and server-run sector operations; it is not evidence that the
scene has been retired or that those operations already share the main
universe's route and world lifecycle.

## Renderer and legacy-scene boundary

Three.js is the primary 3D renderer and scene-runtime foundation for the main
Orbital universe; native WebGL2 remains a supported companion renderer. Keep
Three.js as a shipped dependency rather than reducing it to a low-level library
or techniques-only source. Orbital owns the shared simulation and world-state
contracts integrated with those renderer backends. Code-splitting Three.js is a
loading optimization, not a removal plan.

Three.js remains the primary 3D renderer and scene-runtime foundation; Orbital
supplies shared simulation and world-state contracts integrated with it. The
renderer is not temporary, and there is no active plan to remove it. The
historical renderer-rebuild document remains useful for code audit, resource
lifecycle, performance, and rollback evidence, not as a replacement/removal
directive.

The game-mode registry now tracks `simulation` and `presentation` separately.
In particular, `rust-disc-local` is simulation-canonical but still reports
`rust-disc-three-v1` presentation compatibility. The Combat Lab reports the
current `Arena` renderer explicitly. This prevents an Orbital simulation call
from being mistaken for a fully unified game engine.

## Safe migration direction

1. **Engine boundary:** keep one shared Orbital simulation/world-state contract,
   Three.js as the primary renderer, and an explicit mode launch contract.
   Native WebGL2 remains a companion; deterministic simulation stays independent
   from WebGL and UI frameworks.
2. **Pilot behavior:** preserve Rust Disc's tested left-stick steering, pitch,
   coordinated bank, aiming, vector-thrust gestures, pause/release neutralizing,
   combat feedback, map, and performance instrumentation. Port behaviors, not
   the old flight scene.
3. **Local operations:** migrate Rust Disc objectives and authored sectors into
   Orbital operation definitions; verify flight, lock, fire, missiles, damage,
   collisions, objective transitions, debrief and no-reward behavior before
   removing the old local launch.
4. **Arcade and campaign:** migrate objective adapters while preserving pinned
   issued runs, deterministic replay and server-validated claims.
5. **Co-op and Iron Eclipse:** migrate client, API and socket contracts together.
   Preserve authenticated room ownership, server movement, reconnects, squadron
   permissions, operation state and idempotent outcomes.
6. **Wing last:** migrate input/replay/networking only after staging parity and
   live-human evidence. Preserve ten-human competitive eligibility and the
   no-reward behavior of private and AI-fill rooms.
7. **Universe expansion:** establish stable hierarchical coordinates, local
   physics frames, floating-origin rendering, seeded sector streaming and
   server-owned shared locations before claiming continuous interplanetary or
   extrasolar travel.

## Removal and release gates

Do not remove the `/flight` route, Rust Disc renderer, co-op adapters, campaign
compatibility, or Wing systems as a documentation-only action. Retire an old
path only after:

- all callers and issued run data are mapped;
- feature and control parity tests pass on the Orbital path;
- authority and reward boundaries remain unchanged;
- mobile touch, rotation, performance, and pause/resume are checked on real
  target devices;
- end-to-end operation completion and rollback are verified.

Automated checks prove code paths, not physical phone behavior, staging
authority, live ten-player competition, or an unbounded persistent universe.
Report those evidence categories separately.
