# WFM Combat Lab — repository integration state

Latest continuation: see `socket-identity.md` for verified socket identity, account-owned recovery, current checks and staging gates; `orbital-authority.md` describes the prior shared-rule foundation. Historical sections below describe the original lab and Preview repair. Current Preview remains offline; real external Clerk accounts and deployed multiplayer have not been certified.

Source baseline: `niakofa-cmyk/WFM`, commit `3ecff67`, local review branch `seele/combat-foundation`. The user subsequently authorized pushing the improvements to a review branch; see `socket-identity.md` for current delivery status. No production merge, Railway deployment or database migration is authorized.

## Scope
Use the existing React/Vite/Three.js game. Extend existing Arena, simulation, input, roster and audio. Keep a separately built, visibly experimental Combat Lab entry using those same modules. The current authoritative API simulation, WebSocket protocol, Clerk authentication, replay verification, progression and PostgreSQL integrations remain unchanged. Lab results never call the reward/persistence APIs. 3D flight is opt-in and is not sent to existing live servers. This is a contained review prototype, not the completed Infinite War roadmap.

## Baseline findings (before this change)
- Flight is currently x/z planar; pitch affects model pose only. Guns and collisions ignore altitude.
- Target cycling is instant; only Sundara primary has homing. No separate guided missile acquisition system.
- Shields directly spill into hull; no armor layer.
- Client/server sims are separate files and already differ (AI player-seat behavior, clock tolerance, certification settings). Do not replace the authoritative sim with the client sim.
- App requires Clerk and profile backend. The lab needs an explicit unauthenticated, no-reward entry, not fabricated sessions or a bypass for the production application.

## UI fingerprint and 3D direction
Preserve WFM solar #e0a15a, bone #e6e1d6, alert #c45c48, void #07080d and condensed field-label typography. Lab briefing actions on right, live scene center-left, bottom control strip. Square 2px printed borders, hard 4px shadows for primary action, stable offset title accents. Gameplay HUD keeps normal Arena layout; add telemetry, missile acquisition, flight assist and controls with readable touch buttons. No unrelated menu redesign.

Visual benchmark: the inspected existing `public/mars-front.jpg` provides WFM's warm rust/cold charcoal palette, detailed hard-surface material contrast and depth; it is not a spherical map and will not be wrapped on Mars. Authored orbital target uses detailed smooth metallic fighters, panel seams, propulsion cores, cratered Mars/atmosphere, distant moon and star fields, irregular smooth asteroids. Gameplay camera, not only briefing, must pass visual inspection.

## Asset Preparation — complete; runtime integration verified
| Required resource | Local setup/source | Preparation evidence |
| --- | --- | --- |
| Faction vehicles | `src/game/orbital-visuals.ts:buildOrbitalShip` | Smooth 32-segment lathed fuselage, beveled wings, canopy, engine collars, inset channels; 42–45 meshes per representative vehicle; measured bounds ~3.5 x .7 x 3.6 simulation units; +Z nose matches existing Arena convention. Vehicle geometry needs no skeleton. |
| Mars, atmosphere, moon, station, star field | `orbital-visuals.ts:addOrbitalEnvironment` | Deterministic 1024x512 local Canvas map (sRGB color, linear bump sampling), separate atmosphere shader, curved station rings and authored lighting setup. GPU texture disposal required at teardown. |
| Asteroids | `orbital-visuals.ts:orbitalRock` | Displaced 48x32 UV spheres with smooth indexed normals; refined after gameplay screenshot inspection. Collision retains conservative simulation spheres. |
| Audio and VFX | Existing `audio.ts` and `juice.ts` | Synthesized shot/hit/boom/ability audio and bounded spark pool reused; no remote media or new dependencies. |
| UI/fonts | Existing styles; lab uses system fonts | Existing solar/bone/alert palette; no runtime font downloads. |

No retrieved assets from the abandoned standalone setup are integrated. Provenance of existing imagery is inherited, not newly certified for commercial release; unused production imagery is excluded from the isolated lab build. Runtime material, lighting, texture and representative desktop/portrait visual checks passed during validation. GPU textures, geometry and materials are disposed at teardown.

## Verification
Preserve existing tests. Add flight quaternion/inertia/boost/braking, target cone/range/lock/missile, armor overflow, 3D projectile collision and unchanged-default-mode regressions. Run relevant tests, full typecheck where dependencies permit, normal production build and separate lab build. Test representative acquisition/fire/missile/damage/destruction in actual browser. Verify local resource origin and non-root asset paths. Publish only the isolated static lab preview for review; it does not replace Railway deployment.

## Implemented review slice
- Quaternion six-axis flight with body-space thrust, reverse/slide/lift, boost energy, space brake, assisted stabilization and inertial toggle. Hull condition reduces thrust; this is not a separate engine-subsystem model.
- Existing roster acceleration, handling, shot speed/interval/damage retained as identity inputs. Offline pilot damage tuning is intentionally stronger than AI and must never be used as ranked balance.
- Cycle enemy selection, aim assistance/manual toggle, 65-unit/0.3-radian missile cone, 1.25-second uninterrupted acquisition, eight missiles and 3.5-second cooldown. Assisted pulse lead respects cloak/sensor restrictions.
- 3D swept projectile collisions; shield -> expendable armor -> hull damage; existing hit/kill events reused. Spatial impact rings, sparks, explosion audio, 24 bounded debris fragments with a 12-second life. Small debris is visual only, not server gameplay.
- Chase camera follows spatial orientation; desktop and touch controls; target distance/faction/shield/hull/lock, speed/altitude/energy/armor telemetry. Offline labels, real destruction tally, loss/time-limit/debrief/relaunch flow.
- Separate `combat-lab` Vite mode with relative URLs and only required build resources. The standard entry, authentication, WebSocket service and reward calls were not replaced.

## Exact source change inventory
Modified:
1. `artifacts/war-for-mars/src/game/Arena.tsx` — opt-in lab initialization, spatial renderer/camera/effects, telemetry and touch controls; rejects lab + online together.
2. `artifacts/war-for-mars/src/game/input.ts` — optional orbital axes and edge-triggered lab inputs; existing input shape retained by default.
3. `artifacts/war-for-mars/src/game/sim.ts` — optional spatial types and opt-in dispatcher; shield overflow adapter is unchanged without spatial state.
4. `artifacts/war-for-mars/vite.config.ts` — separate build mode/output and relative resource base; normal build output preserved.
New:
5. `artifacts/war-for-mars/combat-lab.html` — independent HTML entry, no remote fonts.
6. `artifacts/war-for-mars/src/combat-lab.tsx` — faction/ship briefing and offline operation lifecycle.
7. `artifacts/war-for-mars/src/game/combat-lab.css` — scoped briefing and portrait HUD styles.
8. `artifacts/war-for-mars/src/game/orbital-flight.ts` — rendering-independent flight integration.
9. `artifacts/war-for-mars/src/game/orbital-weapons.ts` — targeting, locks, missiles, assisted/manual pulse fire, swept collision.
10. `artifacts/war-for-mars/src/game/orbital-damage.ts` — armor spill adapter.
11. `artifacts/war-for-mars/src/game/orbital-sim.ts` — isolated combat orchestration and AI training setup.
12. `artifacts/war-for-mars/src/game/orbital-visuals.ts` — procedural vehicle/environment/material resources.
13. `artifacts/war-for-mars/src/game/orbital-combat.test.ts` — nine focused regressions.
14. `docs/combat-lab.md` — this inventory, verification and integration handoff.
No API-server, authentication, database schema, dependency manifest or lockfile changes. No remote Git writes. Build directories and local preview tooling are not source changes.

## Reproducible checks and results
Run from repository root using Node 24 and pnpm 10.26.1:
```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @workspace/war-for-mars test
pnpm run typecheck
pnpm --filter @workspace/api-server exec tsx --test src/game/sim.test.ts
pnpm --filter @workspace/war-for-mars exec vite build --mode combat-lab
pnpm --filter @workspace/war-for-mars build
git diff --check
```
Actual execution used `npx --yes pnpm@10.26.1` because pnpm is not globally installed. The workspace currently excludes Windows native optional packages. For this Windows review machine only (no manifest/lockfile changes), install the three native tool packages into an ignored tooling directory, then configure Node's module lookup before builds:
```powershell
npm install --prefix .preview/native --no-save --no-package-lock --ignore-scripts lightningcss-win32-x64-msvc@1.32.0 @tailwindcss/oxide-win32-x64-msvc@4.3.3 @rollup/rollup-win32-x64-msvc@4.63.1
$env:NODE_PATH=(Resolve-Path .preview/native/node_modules).Path
```
Results: client tests **15/15 passed** (six existing + nine new); authoritative server simulation tests **11/11 passed**; complete monorepo typecheck passed; normal and lab builds passed; whitespace diff check passed. The first damage assertion exposed shield regeneration in the fixture; initializing the fixture's hit timer isolated armor spill and fixed the test without changing regeneration behavior.

Browser evidence: actual production lab build served from a non-root subdirectory, launch -> target -> 100% lock -> guided missile (8 to 7 ammunition) -> sustained pulses -> 1/3 confirmed defender destroyed. Vertical thrust changed altitude from zero; portrait 390x844 had no horizontal overflow and usable, non-overlapping action controls. Desktop and portrait screenshots inspected; smooth asteroid normals and displaced silhouette replaced the initial faceted appearance. Runtime diagnostics were empty during these checks. Resource timing showed only same-origin local JS/CSS/favicon; no external media, authentication calls, reward API or WebSocket requests. This is representative browser verification, not a frame-rate/device certification or complete campaign playthrough.

Build warning: Three.js engine chunk ~516 KB minified / ~131 KB gzip exceeds Vite's default 500 KB warning. It is separately chunked and lazy-loaded with Arena; no dependencies were added. Avoid masking the warning; profile real mobile devices before deciding whether further renderer splitting or quality presets are needed.

## Known limitations and production gates
- This is an offline training prototype with AI, **not a 5v5 multiplayer delivery**. Existing authenticated multiplayer remains unchanged and was not externally deployed or certified here.
- No persistent territory, sector travel, black hole/wormhole, squadron comms, tournaments, anti-cheat certification, synchronized anomalies or settlement changes are implemented.
- Only cycle-enemy targeting is exposed, not the entire requested target command matrix. Radar/contact arrows are still the existing planar tactical projection and do not convey full altitude; target bracket and actual weapons are spatial. There is no occlusion-aware lock rejection against asteroids yet.
- No full subsystem, reactor, structural-breakup, per-weapon faction technology, or simulated salvage model. Armor is a finite damage layer; hull degradation affects thrust. Roster values vary but guided missiles are shared lab equipment, not final ship-specific loadouts.
- The first defender deliberately holds position to teach acquisition. Other AI maneuver; AI accuracy/output and collision spheres are training approximations, not competitive balance. The bounded debris pool is reused at each destruction.
- The lab is a bounded combat sector, not an open universe. The spherical boundary stops outward velocity without an explicit proximity indicator.
- Desktop Chromium and viewport emulation were tested. No physical iOS/Android gyro, multitouch, mobile thermal/GPU/memory, poor-network or ten-human testing was performed. Synth audio was triggered, but perceived audio quality was not independently audited.
- Repository client/server simulations are separate. Enabling orbital rules in the current live protocol would diverge from authority/replay validation; the explicit offline gate must remain until the server work below is reviewed.

## Recommended integration plan
1. Review this local branch and the default-mode compatibility tests; do not merge generated changes directly into production. Keep the separate lab entry for design feedback.
2. Extract shared deterministic flight/weapon/damage rules into a versioned pure simulation package only after agreeing on authoritative units, tick rate and balance. Add server-owned spatial position/quaternion/velocity, lock timer, ammo and armor; reject client damage and outcomes.
3. Version WebSocket input/snapshot/replay schemas. Add server-side bounded-input/sequence/lock/ammo validation, prediction/reconciliation, altitude interpolation, reconnect recovery and parity/replay tests. Keep result settlement idempotent and authenticated using existing services.
4. Stage a real ten-authenticated-player 5v5 operation with synthetic impairment tests and verified rewards. Only then attach campaign/sector consequences; do not represent AI seats as human players.
5. Benchmark physical mobile devices, profile draw calls/material counts, add instancing/quality tiers as measurements justify, then obtain approval for a reviewed PR and existing Railway release pipeline.

Needle/Unity evaluation remains separate and was not required to implement this Three.js review slice.

## Preview entry repair — current review
Asset Preparation: complete assessment. No art, audio, model, texture or font changes are required for this delivery repair. Inspected the existing HTML entry and its five built resources; all are local, present, and returned HTTP 200 in the published combat page. Existing procedural vehicles/environment and synthesized audio remain sufficient; the affected dependency is the HTML entry path, not a missing visual asset.

Reproduction: the previous published `combat-lab.html` loaded and launched in desktop Chromium and a sandboxed iframe. Its corresponding `index.html` returned HTTP 403 because the isolated build did not produce a default entry. This is a confirmed default-route defect; it does not prove the exact embedding configuration of the user's frontend, which is not accessible here. The repair now publishes canonical `index.html` while retaining `combat-lab.html` as a compatible alternate entry.

This repair changes exactly:
- `artifacts/war-for-mars/vite.config.ts`: lab-only post-build HTML alias emitted from Vite's generated entry; fails the build if the source entry is absent. Normal production entry is unchanged.
- `artifacts/war-for-mars/scripts/preview-build.test.mjs`: two post-build regressions for both entries being identical and all entry resources resolving locally inside the published directory.
- `docs/combat-lab.md`: reproduction, verification and delivery evidence.

Verification commands run successfully: `node --test artifacts/war-for-mars/scripts/preview-build.test.mjs` (2/2; failed with missing index before the fix), client `test` (15/15), client `typecheck`, Vite `--mode combat-lab`, normal client `build`, and `git diff --check`. The existing Three.js chunk-size warning remains; no dependency or gameplay change was made for this repair.

Actual browser acceptance: rebuilt default entry served below `/combat-lab/` -> launch -> 100% target lock -> missile ammo 8 to 7 -> sustained pulse fire -> 1/3 enemies destroyed. Repeated the same loop on the new public `index.html`; vertical input changed altitude 0 to 7.5 and speed 0 to 16.8. Inspected a screenshot of the published gameplay scene. Also launched the new canonical entry inside an iframe sandboxed with `allow-scripts allow-pointer-lock` (without same-origin permission); the combat HUD and controls appeared. Browser errors and console diagnostics were empty after these actions. Published JS/CSS/favicon and entry returned 200. The actual user's frontend shell and physical mobile devices were not available for direct testing.

## Preview delivery
Published the repaired seven-file isolated lab build and synchronized the frontend Preview to its canonical entry:
https://static.seeles.ai/media/3js/6fd5345e-793e-4bc7-a8a4-8ef7f7f2173d/index.html

Published entry and referenced favicon/JS/CSS returned HTTP 200 with correct resource MIME types. Entry uses `no-cache, no-store, must-revalidate`. The Preview does not connect to the existing live backend. Source, inventory, tests and this integration report remain in the local review branch for developer review; no push/PR or Railway release was performed.
