# Shared orbital authority foundation

Latest continuation: `socket-identity.md` secures the existing planar socket identity/recovery boundary and records current tests, Preview and deployment gates. This document remains the historical shared-rule/harness report; the orbital harness is still not a live endpoint.

The campaign Contact operation separately uses the shared orbital simulation
through the existing authenticated Strike replay/claim endpoint. That migration
does not expose this synthetic-seat harness as a socket service or make it a
ten-human competitive mode.

## Review boundary
Continue the working Combat Lab on `seele/combat-foundation`. Introduce a dependency-free, versioned shared rule package and an isolated server authority harness. This is a testable integration foundation, not a new live multiplayer endpoint. Existing planar simulation, socket rooms, Clerk, database, reward/replay settlement and Railway configuration remain unchanged. No remote Git writes or production release.

The existing socket service assigns a random connection identity in `socket/server.ts`; this is not evidence of Clerk-authenticated ten-player play. Authentication binding and deployment topology require a separate reviewed integration before orbital rules can enter a live room. Do not substitute client-hosted authority or a new persistence provider.

## Current implementation scope
Shared rules cover quaternion flight, targeting geometry, rock occlusion, target-specific acquisition, guided missile constraints, pulse direction, swept collisions and finite armor absorption. The lab consumes these rules through thin adapters. Server simulation owns state, fixed time, fire cooldowns, lock progress, ammunition, projectile spawning, collision and damage. Incoming versioned packets contain only bounded controls, target selection and sequence; unknown fields including positions, damage, health, rewards and client time are rejected.

The server harness stays unreachable from existing HTTP/WebSocket routes. It has no authentication facade, matchmaking, persistence, reconnect tokens, rewards or AI pretending to be humans. Synthetic seats are explicitly test fixtures.

## Asset Preparation — complete assessment
No new media, UI, ships or scene changes are required. Inspected existing local procedural `orbital-visuals.ts`, `orbital-flight.ts`, `orbital-weapons.ts`, `orbital-damage.ts` and the current inventory in `combat-lab.md`. Existing smooth fighter meshes, deterministic planet/asteroid materials, same-origin synthesized audio and scoped HUD remain sufficient. Collision shapes remain the existing rock spheres, now also used for acquisition occlusion. No external assets, dependencies on new media, license changes, or pending art resources. Runtime presentation and local resource paths will be rechecked after the code integration.

## Verification plan
Focused rule/input/authority tests, client/server flight parity, fixed-tick replay determinism, malformed/forged/stale/overflow packets, lock and ammunition enforcement, actual projectile damage/destruction, unchanged legacy tests, monorepo typecheck, server build and both client builds. Actual browser launch/acquire/missile/pulse/destruction smoke check on nested build; inspect one gameplay screenshot and local resources. Republish isolated Preview, not Railway. Record exact changed files and remaining integration gates after checks finish.

## Implemented behavior and compatibility
- `@workspace/orbital-sim` version 0.1.0 exports rules/protocol version 1, with no new third-party dependencies. Fixed server timestep is 1/30 second. Units and tuning remain the lab's existing simulation units; HUD meter labels are inherited, not physical-scale certification.
- Client flight/weapons/damage adapters now call the same pure rules as the authority harness. Default planar gameplay still never initializes spatial state. Existing online protocol and existing client/server planar rules are untouched.
- Acquisition is tied to a specific target ID. Previously `lockProgress` alone could be reused if another caller changed the target without the lab's UI reset. Launch now validates the acquired identity too; tests cover direct target change and clear.
- Existing targeting geometry did not consider rocks. The shared solution now rejects occluded acquisition/aim-assist, using the same local sphere obstacles as collision. It is conservative sphere occlusion, not visual mesh raycasting.
- Server owns ten **synthetic** seats (five faction craft each), finite queue (eight packets/seat), monotonically increasing safe sequences, fixed ticks, detached snapshots, cooldowns/ammunition, projectiles, layered damage and one destruction event per ship. Invalid fields are rejected rather than silently clamped. Intake cannot advance time. No packet is reused when its queue empties: held controls require fresh inputs; current target remains selected.
- Harness primary damage uses existing server roster values with no lab human/AI multipliers. Shared missiles are provisional 58-damage test equipment, not final faction balance. Rules do not claim competitive fairness or all ship abilities.

## Exact files changed in this continuation
New:
1. `lib/orbital-sim/package.json`
2. `lib/orbital-sim/tsconfig.json`
3. `lib/orbital-sim/src/index.ts`
4. `lib/orbital-sim/src/flight.ts`
5. `lib/orbital-sim/src/weapons.ts`
6. `lib/orbital-sim/src/protocol.ts`
7. `artifacts/api-server/src/game/orbital-authority.ts`
8. `artifacts/api-server/src/game/orbital-authority.test.ts`
9. `artifacts/war-for-mars/src/game/orbital-shared.test.ts`
10. `docs/orbital-authority.md`
Modified:
11. `artifacts/api-server/package.json` — local workspace dependency only.
12. `artifacts/api-server/tsconfig.json` — shared declaration reference.
13. `artifacts/war-for-mars/package.json` — local workspace dependency only.
14. `artifacts/war-for-mars/tsconfig.json` — shared declaration reference.
15. `artifacts/war-for-mars/src/game/orbital-flight.ts` — thin shared flight adapter.
16. `artifacts/war-for-mars/src/game/orbital-weapons.ts` — shared rules and legacy effect/roster adapters.
17. `artifacts/war-for-mars/src/game/orbital-damage.ts` — shared armor absorption.
18. `artifacts/war-for-mars/src/game/orbital-sim.ts` — AI/threat acquisition uses obstacle-aware rules.
19. `artifacts/war-for-mars/src/game/Arena.tsx` — shared target solution includes current rock obstacles.
20. `tsconfig.json` — shared package build graph.
21. `pnpm-lock.yaml` — two local workspace links and empty importer only; no third-party version changes.
22. `docs/combat-lab.md` — continuation pointer and latest Preview delivery.
Prior unfinished branch work is preserved. Build output, publisher manifest and isolated validation artifacts are generated delivery evidence, not additional repository source changes. No active live socket, server sim, database, auth, persistence, production settings or deployment source was edited.

## Reproducible checks — passed
Run at repository root (actual execution used `npx --yes pnpm@10.26.1`):
```sh
pnpm install --frozen-lockfile --ignore-scripts --offline --child-concurrency=1 --network-concurrency=4
pnpm --filter @workspace/war-for-mars test
pnpm --filter @workspace/api-server exec tsx --test src/game/orbital-authority.test.ts src/game/sim.test.ts src/game/wing.test.ts
pnpm run typecheck
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/war-for-mars exec vite build --mode combat-lab
node --test artifacts/war-for-mars/scripts/preview-build.test.mjs
pnpm --filter @workspace/war-for-mars build
git diff --check
```
Windows builds used the previously documented ignored native tooling directory and `NODE_PATH` configuration in `combat-lab.md`. Lockfile was regenerated for the local package and inspected: only eight added workspace-link lines. Client **18/18**, server **24/24** (eight new authority + eleven legacy sim + five legacy wing), Preview build regressions **2/2**: **44 checks passed**. Full monorepo typecheck, server build, lab build, standard client build and diff whitespace checks passed. The unchanged Three.js chunk ~516 KB minified / ~131 KB gzip warning remains.

Browser acceptance passed on the actual nested production build and again on the new public default entry: launch -> target -> 100% lock -> missile ammo 8 to 7 -> sustained pulse fire -> one of three defenders destroyed. Both browser diagnostic channels were empty. One gameplay screenshot was inspected: existing detailed vehicles, Mars, station, smooth asteroids, effects and HUD remain rendered. Nested build loaded only local assets. Public game JS/CSS/favicon all returned HTTP 200 under the same versioned prefix; CDN-injected analytics are not game asset references. No auth, reward, persistence or live multiplayer calls were added.

Published seven-file static lab and synchronized frontend Preview:
https://static.seeles.ai/media/3js/6fd5345e-793e-4bc7-a8a4-8ef7f7f2173d/index.html

## Remaining integration gates and risks
1. This is **not live orbital multiplayer**. Harness is deliberately not reachable by a route, not present in the shipped legacy socket bundle, and not connected to the Preview. Ten deterministic synthetic seats are not ten authenticated human clients.
2. Bind verified existing Clerk identity to the socket upgrade/session, authorization and reconnect ownership using the existing backend topology; never trust seat IDs supplied by clients. Add protocol negotiation, transport rate limits, expiration and room lifecycle before exposing this harness. The current queue bounds are not a full anti-cheat or denial-of-service certification.
3. Implement snapshot interpolation, predicted input replay/reconciliation, safe resynchronization, spectator/reconnect behavior, dropped-input policy and staged impairment testing. Snapshot cloning and full pilot objects are test-harness conveniences, not a bandwidth-optimized production schema.
4. Unify orchestration/damage modifiers, ship abilities and configuration before live enablement. Shared flight/weapon geometry is parity-tested; full offline AI/training simulation and authority harness deliberately differ. Roster is still duplicated but a parity regression detects drift.
5. Harness seats have no respawn, AI, team communication, matchmaking, persistent rewards or campaign effects. Its time-limit integrity result is local server state only, not validated account settlement. Balanced ability/loadout/regen behavior needs product review.
6. Existing planar WebSocket external deployment, reward settlement, physical devices, impaired orbital networking and real ten-human matches were not tested in this turn. No claim of native mobile performance, competitive certification, commercial asset rights or production readiness.
7. Keep branch isolated; review source and gates before any approved staging deployment, PR or Railway integration. No push, PR, database migration or production release was performed.
