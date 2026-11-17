# Free-flight roaming runtime audit and implementation

## Source and scope

The owner-supplied runtime audit is retained verbatim at
[`references/redesign/RUNTIME-AUDIT-SHARED-FREE-FLIGHT-SOURCE-2026-11-08.txt`](references/redesign/RUNTIME-AUDIT-SHARED-FREE-FLIGHT-SOURCE-2026-11-08.txt).
It describes an early server movement prototype and correctly identifies the
next visible-gameplay gap: connect authenticated pilot and patrol snapshots to
the active free-flight renderer. Its reported branch and pull-request state are
historical; they are not proof that the separate draft was merged, deployed, or
tested on devices.

The current workspace now contains an adapted, feature-gated prototype in the
existing WFM authenticated WebSocket and Orbital free-flight scene. The separate
draft was inspected but not merged. This document distinguishes that prototype
from the complete shared universe the game is intended to become.

## Audit evaluation

| Audit claim or design point | Evaluation |
| --- | --- |
| Reuse the existing authenticated socket and derive identity from its verified session | Adopted. No client-supplied account ID, faction, ship ownership, or location is accepted as admission truth. |
| Run movement with the Orbital flight rules on a server tick | Adopted for the prototype. Inputs are bounded, sequenced, and stepped by the server runtime. |
| Render live pilots and patrols inside the active universe | Implemented as an opt-in authenticated snapshot stream and Three.js ship projection in the existing Orbital free-flight scene. It does not create a second universe or renderer. |
| Use 30 Hz movement and 10 Hz JSON snapshots | Implemented in this prototype; these are implementation targets, not measured production capacity. |
| Use bounded session and actor counts | Implemented for this prototype. The limits do not constitute a capacity or load-test result. |
| Treat this as infinite spatial sharding | Not yet implemented. The current session key is a coarse, server-derived destination (`mars:<anchor>`), not a 3D spatial cell or continuous route-space partition. |
| Treat visible patrols as the persistent universe fleet system | Implemented for the authenticated pilot's saved location: the directory supplies persistent patrol records and the socket materializes bounded 3D actors. Global spatial-cell streaming and cross-location continuity remain separate work. |
| Enable server-authoritative battles and rewards from visible proximity | Implemented in the current source slice. Closing to the server-defined approach range starts a persistent-patrol encounter; primary fire, missiles, damage, attribution, and reward settlement remain server-owned. |
| Claim verified staging or multi-device readiness | Not verified. A later protected staging rollout reached the sign-in page, but did not confirm an authenticated profile; see the staging report below. |

## What is implemented

- `artifacts/api-server/src/socket/free-flight-runtime.ts` runs bounded
  server-owned pilot movement and patrol movement on the existing authenticated
  socket. The runtime accepts control intent only; server admission resolves
  faction, owned hull, and a supported world location from account/world state.
- `artifacts/api-server/src/socket/index.ts` enables the server feature in
  development when the database is configured. An explicit `false` disables it;
  production still requires `ORBITAL_FREE_FLIGHT_ENABLED=true`. In the
  2026-11-08 isolated staging rollout, the client and socket feature flags were
  enabled only in staging; Production was not changed.
- `lib/orbital-sim/src/free-flight-contract.ts` strictly validates the
  versioned snapshot before client rendering.
- `artifacts/war-for-mars/src/game/free-flight-client.ts` authenticates using
  the existing session token, sends only normalized movement controls, handles
  reconnect sequence handoff, and rejects malformed snapshots.
- `Arena.tsx` projects server-snapshot pilots and patrols as ship meshes into the
  already-running Orbital free-flight scene. It interpolates bounded snapshots
  and falls back to existing local traffic when the feature is absent or stale.
- Shared free flight now loads the persistent patrol directory rather than only
  one selected contact. A close approach starts a reserved patrol encounter in
  the same unbounded flight scene. During an active fight, a second opposing
  patrol inside sensor range joins after weapons fire or damage signals the
  battle; the runtime bounds simultaneous patrol encounters and actor capacity.
- Each joined patrol receives its own server-issued exploration contract and
  settlement receipt. A fleet's result updates the cumulative pilot tally but
  does not disable flight controls while another joined fleet remains active.
- This reuses Orbital spatial flight, weapon spawn/guidance, swept collision,
  shield/hull damage, and the existing reward ledger. It is not a copy of the
  local trainer's match loop or a transition to another rendered universe.
- The authenticated frontend connects automatically in development; production
  remains opt-in through `VITE_WFM_ORBITAL_FREE_FLIGHT_ENABLED=true`. Pilots see
  the current opposing patrol count after the server snapshot arrives.
- Runtime tests cover authenticated admission, same-location pilot visibility,
  location isolation, validated snapshots, server movement, moving patrols,
  reconnect sequence continuity, automatic close engagement, a reinforcement
  patrol joining after weapons fire, server projectile impacts, kill attribution,
  and bounded reward settlement.

The browser's own ship still uses the existing local free-flight prediction.
The server currently maintains and broadcasts its authoritative movement copy,
but the client does not yet reconcile its local position to the server pose.
Therefore the pilot's presented ship remains locally predicted while the server
simulates its own admitted movement copy. This is not proof that the player pose
is fully reconciled or that a battle remains continuous across spatial shards.

## Rollout and rollback

Keep both feature flags off in Production until the remaining acceptance gates
pass. The protected staging environment was temporarily enabled for the
verification attempt documented in
[`Staging free-flight rollout and paired verification`](../staging-free-flight-paired-verification-2026-11-08.md).
To disable this slice, turn off `ORBITAL_FREE_FLIGHT_ENABLED` on the API and
`VITE_WFM_ORBITAL_FREE_FLIGHT_ENABLED` in the frontend build. Existing local
flight and separate authenticated combat operations remain intact.

Do not call it production-ready based on a passing local socket test. Staging
must verify two authenticated devices, both factions, movement reconciliation,
disconnect/rejoin, privacy between locations, and safe fallback after the
feature is disabled. The latest staging attempt did not pass authentication and
therefore provides no evidence for those gates.

## Next three implementation slices

1. **Make free-flight traffic spatially continuous.** Replace the coarse
   destination session with bounded Orbital spatial cells and interest groups;
   preserve patrol routes across cell handoff without resetting camera or pose.
2. **Complete player movement authority.** Reconcile local prediction with
   server snapshots, add bounded interpolation/extrapolation and recovery, then
   verify both renderers and supported mobile devices.
3. **Expand faction response safely.** Add the remaining server-owned sensor,
   transponder, territory, reputation, and escalation rules; verify multiple
   humans, both factions, reconnect, duplicate settlement, and the reward
   boundary on staging before broader rollout.
