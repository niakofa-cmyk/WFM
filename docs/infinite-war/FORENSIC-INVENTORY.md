# Infinite War forensic inventory

> Historical inventory snapshot. Use the current
> [Orbital Lab Phase 0 extraction audit](ORBITAL-LAB-PHASE-0-FORENSIC-EXTRACTION-AUDIT.md)
> for the latest source-level mode/runtime map. This file's branch and release
> context below are not the current checkout or deployment identity.

**Scope:** code currently checked out on
`integration/infinite-war-orbital-combat`. This is a source/test audit, not a
live Railway, Production, or physical-device audit. Classification describes
the current code, not the intended final game.

| System | Classification | Current implementation and authority | Persistence / evidence | Integration destination |
|---|---|---|---|---|
| App entry and player journey | **Implemented but fragmented** | `artifacts/war-for-mars/src/App.tsx` routes the public landing, authenticated `WarApp`, `/flight`, `/play`, `/expedition`, and sign-in. `HomeScreen.tsx` still exposes several destinations and queue controls. Clerk identity gates account-backed play. | Frontend and route tests; no acceptance proof that one integrated journey connects every mode. | Make contextual operations/hangar/world navigation the shared entry; keep direct routes during migration. |
| Account profile and loadout | **Implemented and connected** | Authenticated `/game/profile` and profile preference routes use Clerk-derived player identity. Loadout and control preferences are stored through existing progression logic. | `player_progress`; progression and profile-sync tests. | Preserve one identity/profile contract and clear state on account changes. |
| Campaign / Strike | **Implemented, distinct simulation** | `game/campaign.ts`, `sim.ts`, `WarApp.tsx`; server routes validate strike-run claims and progression. The campaign's default combat remains planar; orbital behavior is an optional Arena path. | Existing authenticated profile, strike-run, and progression-event data; API progression tests. | Map campaign operations into the shared mission model without changing claim/replay safeguards. |
| Orbital Combat Lab | **Implemented but isolated** | `combat-lab.tsx` launches `Arena` in local offline practice with orbital 3D flight, target acquisition, guns, lock, missiles, and local AI. `orbital-sim.ts` documents it as experimental and outside current network/reward flow. | Combat and shared deterministic math tests; no account writes or competitive settlement by design. | Evolve simulation rules into the canonical combat contract; keep the Lab as a no-reward harness, not a second service. |
| Shared orbital simulation package | **Implemented, adoption partial** | `lib/orbital-sim` provides deterministic flight/weapons math used by orbital client/API simulation modules. The Wing socket rooms and co-op sector runtime remain distinct contracts; shared math primitives do not make them one protocol. | Shared math, combat, authority, and Node/Chromium determinism tests. | Version its protocol and migrate one live-compatible path at a time. |
| Rust Disc local trainer | **Implemented but isolated from persistence** | `/flight` uses `RustDiscFlight.tsx` and the local `flight-sector.ts` simulation; its route is deliberately unauthenticated/no-reward. | Flight, input, collision, lock, and mobile-control tests; browser smoke evidence is distinct from physical-device evidence. | Retain as local training; consolidate overlapping spatial rules with the canonical kernel after parity tests. |
| Co-op sector expedition | **Implemented and server-authoritative** | `/expedition` uses authenticated socket sessions. `sector-runtime.ts` owns bounded flight inputs, snapshots, room state, and completion; Rust Disc → Mars Approach → Pale Beacons are prerequisite-linked. | Existing discoveries and `progression_events`; completion proof, idempotent settlement, socket, and client parser tests. Current sector discovery reward is zero credits. | Keep the live socket/auth contract; feed co-op operation definitions into a shared mission framework. |
| Operation Iron Eclipse | **Implemented as a co-op operation** | Sector runtime owns a three-ship AI wing, host orders, point-defense/shield/reactor state, objectives, extraction, and outcome. Commands do not pause flight. | Server snapshot and subsystem tests; validated success reuses sector discovery settlement. | Retain as the capital-ship operation foundation; do not conflate its zero-credit discovery with Wing rewards. |
| 5v5 Online Wing | **Implemented, combat model separate** | `socket/server.ts` authenticates seats, owns queues/rooms, enforces ten distinct humans for competitive starts, and publishes server snapshots. Casual AI-fill and private-room flows have separate rules. | Socket tests cover ten-client queue, duplicate identity, cancellation, room separation, AI-fill countdown, reconnect/restart, and network impairment. | Preserve its identity, queue, reconnect, and reward contracts while migrating match combat under protocol/version gates. |
| Wing reward settlement | **Implemented with explicit gates** | `wing-rewards.ts` locks account profiles, applies server policy in a transaction, records a unique idempotency key and balance transition. Socket only invokes settlement for eligible server-resolved competitive rooms when enabled. | Shared `progression_events` ledger; policy/API tests. Live ledger and release evidence are separate from local test results. | Reuse existing ledger and transaction; never create an orbital-specific wallet or client-authored reward path. |
| Persistent universe / Galaxy | **Implemented but not a navigable 3D galaxy** | Authenticated `/world` API exposes locations/routes/events/contracts; `GalaxyScreen.tsx` presents current location, travel, exploration, services, quests, market, reputation, and discoveries. | Existing world-state, discovery, quest, inventory, market, and progression tables; API world tests. | Grow into connected sector selection/navigation while keeping all mutations server validated. |
| Armory / Market / inventory | **Implemented and account-backed** | `HomeScreen.tsx`, `WarApp.tsx`, `MarketPanel.tsx`, profile/loadout routes, and world services use existing profile and economy systems. Competitive normalization exists for some upgrades. | Existing profile/inventory/market transaction/event records and economy tests. | Consolidate into unified hangar and mission preparation; preserve ownership, transaction, and balance rules. |
| Public Wing leaderboard | **Implemented, opt-in** | Public route returns opted-in callsign and aggregate server-verified Wing credits only. | Existing player profile and Wing ledger; API and UI tests. | Keep privacy minimization; add ranking/tournament surfaces only after trusted competitive data and rules exist. |
| Competitive 3D warfront in the universe | **Not implemented** | No verified connection from the ten-human Wing queue into the shared XYZ/co-op combat sector; the current Wing contract remains separate. | No end-to-end acceptance evidence for a 10-human shared 3D match. | Coordinated, versioned client/API/socket migration with ten-human, reconnect, damage, objective, and reward tests. |
| Unified campaign/co-op/competitive mission framework | **Partially implemented** | Campaign sorties, world quests, sector missions, Iron Eclipse, and Wing rooms have separate contracts and progression paths. | Their existing stores and tests remain authoritative for current modes. | Define shared mission metadata/state/result adapters; migrate incrementally, not by duplicating persistence. |
| Persistent faction war consequences | **Documented / not implemented as a cross-mode feature** | World reputation/events exist, but no verified validated match outcome updates persistent territory or shared faction control. | No accepted cross-player persistent-war settlement contract. | Add only after authoritative match outcomes, scope, idempotency, and conflict rules are explicit. |
| Synchronized gameplay anomalies | **Not implemented** | No shared authoritative gravity-well, wormhole, or hazard simulation found in current sector contracts. | No synchronized anomaly tests. | Bounded deterministic environmental modifier in a dedicated sector version before broader rollout. |
| Needle Engine | **Research candidate only** | No Needle runtime dependency or production scene integration found in the current package/import scan. | No WFM benchmark or migration evidence. | Keep custom Three.js/Vite as production runtime; evaluate Needle only as an authoring candidate with a measured proof. |

## Repository and release context

At audit time, the working tree was clean on
`integration/infinite-war-orbital-combat`, at `bebb860`. The local `staging`
ref was `f1c8b62`, while `origin/staging` was `6671d36`; local `main` was
`4b31352`, while `origin/main` was `3ecff67`. These are repository refs, not
live deployment identities. The integration branch contains the local staging
ancestor and additional commits. Do not treat stale remote-tracking refs as the
currently deployed release.

No current GitHub pull-request status was queried as part of this code audit.
Previous PR notes are retained in
[`../references/wfm-infinite-war-build-evaluation.md`](../references/wfm-infinite-war-build-evaluation.md);
verify live PR state through GitHub before merging or reporting it.
