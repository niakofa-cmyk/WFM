---
name: Infinite War combat integration
description: Product and safety boundaries for integrating orbital combat into WFM.
---

Keep WFM's Three.js combat work incremental and server-authoritative. The
standalone Combat Lab remains a no-reward training mode: it must not authenticate
a live socket, write progression, or settle rewards. Campaign Contact is the
first versioned orbital campaign replay; capable clients receive server-selected
`orbital-v1`, while older clients and unversioned/open runs retain `surface-v1`.
Do not silently reinterpret an issued run. Keep squad orders and capital-ship
objectives in validated co-op operations.

For continuous shared free flight, keep primary guns ready for every living
pilot, including before an encounter begins. A real collision with a
server-owned target determines damage; clients cannot choose targets or submit
damage, kills, or rewards. Keep missiles separately governed by their lock and
encounter rules.

**Why:** The user wants the Combat Lab's ready-to-fire, hit-based combat feel
carried into the playable universe instead of isolated behind a training link.

**How to apply:** Preserve the distinction between no-reward local Combat Lab
training and server-settled open-universe combat. Do not reintroduce an
encounter-only gate for primary guns or trust client-reported outcomes.

A verified first Contact win advances the existing campaign-clear counter,
which unlocks Pale Beacons in the saved galaxy. Reuse this server-owned
progression-to-map bridge instead of adding a parallel world-event store.

**Why:** campaign progression and galaxy unlocks are already durable; duplicate
state would create competing sources of truth.

**How to apply:** attach future Contact consequences atomically to the validated
claim and derive map unlocks from saved progression, never client-submitted
outcomes.

**Why:** The combat-foundation pull request starts from older `main` and replaces
socket/auth behavior that is already integrated with newer staging queues,
rewards, and sector missions. Combining the protocols or deploying only one
service can break live sessions or misrepresent reward safety.

**How to apply:** Integrate isolated simulation/UI work on top of current
staging. Preserve existing live contracts unless a coordinated frontend/API/
socket migration passes staging. See
`docs/references/wfm-infinite-war-build-evaluation.md` for the current feature
and pull-request review boundary. Migrate later campaign sorties only as
versioned, client/server-parity-tested vertical slices; this first slice does
not connect Contact/campaign sorties to competitive Wing or sector-room
protocols. Continuous open-flight combat remains a separate
server-authoritative runtime.
