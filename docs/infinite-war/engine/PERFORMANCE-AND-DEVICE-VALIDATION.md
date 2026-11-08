# Performance and device validation

## Evidence boundaries

This extraction adds no renderer, asset, particle workload or physics tuning.
It moves pilot intent into the existing shared package and removes a duplicated
axis conversion. No FPS, thermal, battery, latency, memory or scalability gain
is claimed without measurement.

The owner previously supplied a Rust Disc local Android landscape callback
sample (60 game seconds, approximately 76 average callback FPS, p95 17 ms,
p99 25 ms). It is historical evidence for that trainer/revision and browser
cadence, not GPU timing, current Orbital performance or live multiplayer proof.
Do not reuse it as certification for this change.

## Existing instruments

`flight-performance.ts`, local performance reporting, adaptive resolution and
the deterministic replay checks are available. Headless graphics may not
represent an actual device; a HUD screenshot alone does not prove WebGL motion.

## Required matrix before promotion

| Area | Required measurement / check |
|---|---|
| Input | Touch-to-frame trace, no overlap, simultaneous aim/fire, cancel/reset |
| Flight | Same input trace, same rules/ship/world; position/quaternion/energy parity |
| Rendering | Active-game p95/p99 cadence, long frames, draw calls/effects/quality |
| Memory | Heap/GPU/resource trend across repeated sorties and region transitions |
| Device | Actual Android landscape startup, rotation, background/restore, thermal notes |
| Network | Tick/backlog, bandwidth, latency/jitter, reconnect and snapshot interpolation |
| Server | Independent instance budgets, queue/seat ownership, CPU/memory under bounded load |
| Persistence | Retry, interruption, stale/invalid result and exactly-once settlement |

Budget targets must be selected from measured supported devices rather than
invented numbers. Keep quality adaptation separate from deterministic simulation.
Changes to time budgets must not fast-forward combat or authorize client results.

No new phone, ten-human, staging gameplay or Production-readiness certificate
is provided by this document.
