# Orbital scale, multiplayer protocol, and recovery redesign

This is the durable WFM rebuild review for the five owner-supplied references
received November 7, 2026. Verbatim copies are stored under
[`references/redesign/`](references/redesign/); the original attachments also
remain in the workspace. This tracked file records the project decisions and
implementation derived from them. The sample code in the uploads is not copied
into production without review.

## Source references

1. [Orbital scale and chunking source](references/redesign/Pasted-To-scale-your-React-Orbital-Infinite-Extended-Open-Univ_1794047288316.txt)
   — deterministic simulation boundaries, large-world chunks, render-loop
   isolation, local validation.
2. [Forensic architecture source](references/redesign/Pasted--Forensic-Evaluation-Architectural-Breakdown-Based-on-y_1794047320045.txt)
   — architecture assessment, reconciliation, sector generation and React
   lifecycle separation.
3. [Multiplayer binary protocol source](references/redesign/Pasted--Multiplayer-Binary-Protocol-Sub-System-Refactor-To-fin_1794047378978.txt)
   — binary WebSocket snapshots, projectile collision, and orbital anchors.
4. [Validation and recovery source](references/redesign/Pasted--Local-Validation-Testing-Failure-Recovery-Suite-To-com_1794047463795.txt)
   — mock socket validation and proposed local match recovery.
5. [Three-dimensional rendering pipeline source](references/redesign/Pasted-To-port-the-technical-features-and-visual-capabilities-_1794048558104.txt)
   — simulation/presentation separation, instanced rendering, camera and
   resource lifecycle.

## Decisions for the WFM rebuild

### 1. Determinism: use the already shared simulation contract

The project already has Orbital's fixed 30 Hz simulation, versioned input
validation, deterministic math and server-owned combat, plus Node/browser
replay checks. `Math.fround` alone does **not** guarantee Node/Chromium parity:
different transcendental implementations can still diverge. Keep the existing
shared deterministic math and pinned replay gates. Do not introduce a second
`lib/engine.ts`, a second 60 Hz loop, or a client-created combat authority.

React should own presentation and lifecycle only. Any gameplay loop added to
Orbital must use the existing simulation tick and versioned inputs; rendering
must not advance authoritative world time.

### 2. Large-world coordinates: integer chunks plus bounded local offsets

The useful spatial insight is to avoid indefinitely increasing absolute
floating-point positions. The shared Orbital simulation now provides
`OrbitalWorldPosition`: safe-integer chunk coordinates and local meter offsets
normalized to `[0, 4096)`. It also provides deterministic movement,
stable chunk keys, and bounded nearby-relative offsets. Mars surface positions
can be converted to this representation.

This is a coordinate foundation, not a claim that universe streaming,
procedural sector generation, persistence, or multiplayer location sync is
complete. Do not use client-generated procedural content as evidence of
server-owned locations, encounters, or rewards. Shared sector generation must
be seeded, versioned, bounded, and tested in both runtimes before rollout.

### 3. Multiplayer wire format: keep current protocols; measure before binary

The current Wing and co-op WebSocket contracts are established JSON protocols
with authentication, rate/sequence checks, reconnect and version gates. Replacing
them in place with an unversioned `ArrayBuffer` would break clients and discard
important validation. The proposed sample serializer also lacks a complete
handshake, strict size/range checks, room identity, authenticated entity
ownership, replay handling and compatibility negotiation.

Keep existing protocols unchanged. A future binary transport must be a new
explicit version behind a capability/feature gate and must encode only
server-owned snapshot data. Before adopting it, compare real JSON and binary
payload size, CPU cost, allocations, p95/p99 frame and network behavior under
representative impairment. Preserve JSON fallback and prove version mismatch
fails closed. Never accept client-computed hits, destruction, inventory,
progression, or rewards.

### 4. Combat and construction authority

Continuous collision checks can help prevent fast projectiles from tunneling,
but hit adjudication belongs in the authoritative simulation, not a client-side
collision helper. Any collision change must preserve the pinned simulation and
replay contract.

The proposed orbital base/anchor system is not implemented. Player-placed
harvesters, turrets, shields, credits, and ownership require an explicit
server-authorized gameplay and persistence design. No client-generated ID,
`performance.now()`, or local grid may grant ownership or consume resources.

### 5. Failure recovery and local validation

The proposed browser download/Node writer to `.agents/memory/` is rejected.
That directory is project-agent memory, not player storage; saving match
telemetry there risks privacy exposure and cannot restore authoritative state.
No local replay or cached result can turn an interrupted or rejected match into
a reward claim. Follow each mode's existing reconnect/interruption policy and
recover from a fresh authenticated server snapshot.

Use the existing deterministic replay, authoritative input-contract tests,
WebSocket impairment proxy, reconnect tests, and staged rollout gates as the
validation base. Add deterministic failure cases alongside the actual contract
they exercise. Keep test artifacts in generated output, not memory or player
progression.

### 6. Port useful 3D presentation techniques into Orbital

The fifth source proposes a second Three.js runtime. That conflicts with the
owner's Orbital-only engine decision. Its transferable ideas are now applied
inside the existing native WebGL2 proof: the presentation loop reads the Mars
time model without writing gameplay state; a seeded, local-only debris field is
submitted as one instanced draw; asteroid geometry is deliberately low
resolution; and all added GPU buffers are disposed with the renderer.

This remains a bounded renderer proof. It does not replace Arena, read an
authoritative flight snapshot, add a controllable ship, or establish streaming
and culling budgets. Those are separate engine integration gates.

## Implemented from this review

- Added shared 3D chunk-addressed coordinates in `lib/orbital-sim`, including
  normalization, movement across chunk boundaries, stable keys, bounded
  relative offsets and safe-range rejection.
- Added conversion from Mars surface points to chunk-addressed Orbital
  positions.
- Extended the Orbital-native renderer proof with deterministic low-poly
  asteroid instances in one draw call and explicit instance-resource teardown.
- Added API-server tests for positive/negative boundary crossings, large chunk
  indices, nearby precision, Mars conversion, invalid inputs and seeded
  repeatability.
- Kept the existing Wing/co-op wire formats, server reward boundaries, and
  persistent data contracts unchanged.

## Deferred gates

- Do not claim infinite procedural streaming or continuous global multiplayer
  flight from chunk coordinates alone.
- Do not switch JSON multiplayer packets to binary until benchmark, protocol
  versioning, fallback, security and staging parity criteria pass.
- Do not add persistent structures, client-side combat adjudication, or local
  reward recovery without a separately reviewed server-owned design.
- Keep the Three.js removal gate separate: Orbital-native renderer, runtime,
  operation parity, mobile performance, accessibility and rollback checks must
  pass before removing the current compatibility renderer.
