---
name: Replay runtime determinism
description: Same-source simulations diverge across browser and server runtimes unless transcendental Math is replaced; how the gate works.
---

Native `Math.sin/cos/atan2/exp` are implementation-approximated: Node 24 and
Chromium 156 disagreed on tens of thousands of ordinary inputs (hypot happened
to match). JIT tier did not matter inside one Chromium. The reward-adjudicated
simulation must use the pure-JS fdlibm ports in the shared `detmath` module, never
native transcendental Math or `**`; a parity test enforces this.

**Why:** a staging replay resolved as a win in Node, unresolved in Chromium, and
a loss in the live Arena; state diverged after one tick (~1e-18). With the ports,
six pinned replays are bit-identical every frame in Node 24, Chromium 152, and 156;
the old simulation failed all six at frame 1.

**How to apply:** keep sim/detmath/sim-trace/ships byte-identical in browser and
API. Run the Chromium gate (`test:determinism`, also in CI) after any sim change or
runtime upgrade. Pinned checksum tests change whenever gameplay changes — re-pin
only after the gate passes. Do not use `Math.fround` or LUTs built from native
Math (both rejected). Staging diagnostics record per-frame live Arena checksums
for `--replay` triage; the old live-Arena vs standalone gap stayed unexplained
because that capture was not retained. Keep strict adjudication; never
truncate/pad replays or trust client outcomes.
