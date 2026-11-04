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
not connect orbital combat to competitive Wing or live socket rooms.
