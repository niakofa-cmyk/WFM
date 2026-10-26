---
name: Replay runtime determinism
description: Same-source simulations can still diverge across actual browser and server runtimes.
---

Certify replay determinism across the actual browser and deployed server
runtimes, not merely by matching source files or running two imports in Node.

**Why:** a captured staging replay produced different outcomes under local Node
and standalone Chromium despite identical canonical simulation source and
configuration. Their initial compared states matched, but numerical state
already differed after one tick by about 1e-18. The original live Arena also
differed from standalone Chromium; numerical drift is a demonstrated risk, not
a complete explanation of every live rejection.

**How to apply:** retain strict server reward adjudication and input limits.
Capture the first claim response and compare exact configuration, applied input,
recorded input, initial states, and first divergence in memory. Keep source-parity
tests, but add cross-runtime reproducibility evidence before declaring rewards
fixed. Do not truncate/pad replays or trust a client outcome to bypass a mismatch.
