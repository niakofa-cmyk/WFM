# Shared-flight wire protocol and weapon telemetry

## Purpose and source references

This document adapts the November 8 owner-supplied proposals for server-owned
movement, WebSocket sharding, delta compression, targeting, and 3D weapon
tracers to the existing Orbital Combat Lab foundation:

- [Server-owned shared-flight movement source](references/redesign/SERVER-OWNED-SHARED-FLIGHT-MOVEMENT-SOURCE-2026-11-08.txt)
- [Binary WebSocket sharding and targeting source](references/redesign/BINARY-WEBSOCKET-SHARDING-AND-TARGETING-SOURCE-2026-11-08.txt)
- [Bitfield delta-compression source](references/redesign/BITFIELD-DELTA-COMPRESSION-SOURCE-2026-11-08.txt)
- [3D laser-tracer source](references/redesign/3D-LASER-TRACER-SOURCE-2026-11-08.txt)

The original files are retained verbatim. Their architecture goals are useful;
their illustrative code is not production-ready and must not be copied directly.

## Current repository foundation

- `artifacts/api-server/src/socket/server.ts` already provides the authenticated
  WFM WebSocket, origin checks, connection/message limits, and server-derived
  account identity. It currently accepts text messages only.
- `artifacts/api-server/src/socket/sector-runtime.ts` runs authenticated Orbital
  flight sessions with server-owned ticks, validated controls, combat, and
  existing result/settlement hooks. Preserve this authority and rollback path.
- `lib/orbital-sim/src/universe-sync-contract.ts` defines the bounded universe
  frame shape; `free-flight-contract.ts` validates the prototype's versioned
  free-flight snapshots before rendering.
- `artifacts/api-server/src/socket/free-flight-runtime.ts` and the paired
  frontend client now provide an opt-in JSON stream in coarse destination
  sessions. This is not yet spatially sharded, persistent, or movement-
  reconciled.
- `lib/orbital-sim/src/spatial-world.ts` provides integer-addressed chunks and
  bounded local offsets. Use this coordinate model for spatial sharding rather
  than unbounded absolute floats.
- The destination-presence service stores server-derived location and exposes
  anonymous counts. It is not a high-frequency pose feed.
- `Arena` is the main Three.js renderer; native Orbital WebGL2 is a supported
  companion renderer. Both must consume the same canonical Orbital snapshots.

The audit, current implementation limits, feature gates, and next steps are
documented in [Free-flight roaming runtime audit and implementation](FREE-FLIGHT-ROAMING-RUNTIME-AUDIT-AND-IMPLEMENTATION.md)
and [Live 3D patrols and pilot presence](LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md).

## Adopted design requirements

1. **Server-owned shared movement:** authenticate through the existing WFM
   session. Load player identity, faction, hull, and initial world location from
   server-owned account/world state. Accept bounded input intent only; never
   accept client-authored identity, faction, position, velocity, hull, kills, or
   rewards as truth.
2. **Orbital simulation parity:** step the same versioned Orbital movement and
   combat rules used by the supported runtime. Keep fixed ticks, sequence/replay
   validation, bounded catch-up, reconnect recovery, and server-side
   interest-management. Do not substitute the sample's two-dimensional
   acceleration/drag loop or assume `Math.fround` alone guarantees
   cross-runtime determinism.
3. **Live actors:** combine authenticated nearby pilots and persistent AI patrol
   members in the same bounded spatial shard. Snapshot actor IDs are ephemeral,
   collision-safe within the shard, and do not reveal account IDs. Renderers
   interpolate these server snapshots; they do not simulate or invent remote
   poses.
4. **Versioned transport:** first establish correctness and bandwidth baselines
   using the existing authenticated transport. Add binary WebSocket frames only
   as a separately versioned, capability-gated protocol with strict packet
   length, version, actor-count, tick, sequence, finite-value, and range checks.
   Preserve text/V1 compatibility and a rollback path.
5. **Reliable snapshot recovery:** any delta format needs an acknowledged
   baseline, full keyframes, spawn/update/despawn records, stale-baseline
   detection, bounded caches, and a resync path. Measure actual payloads and
   CPU cost before adding a more complex compressor.
6. **Server-authorized lock-on:** the server determines eligible target,
   faction relationship, range, line of sight, lock progress, and weapon
   authorization from authoritative state. Clients may request a target but
   cannot report a successful lock, hit, or kill. The HUD displays the
   server-confirmed lock state.
7. **Validated weapon tracers:** emit a short-lived visual event only from a
   server-validated weapon/projectile event. The client must not choose an
   arbitrary impact point and broadcast it. Bound tracer count/lifetime,
   reuse renderer buffers, support device fallback, and dispose GPU resources.
   Three.js and native WebGL2 render the same event contract.

## Unsafe or inaccurate parts of the supplied examples

- The sample HTTP endpoint embeds a purported secret in source and trusts
  client-provided pilot ID, faction, and current coordinates. Do not add this
  endpoint or any equivalent trust path.
- The sample opens a second raw WebSocket listener, accepts client identity and
  faction in the first frame, and broadcasts to all connected sockets. It
  bypasses existing WFM authentication, room/region isolation, origin checks,
  rate limits, and privacy boundaries.
- The proposed movement code is two-dimensional and not the Orbital 6DoF
  simulation. Client ticks are not adequately bounded or deduplicated.
- The “Huffman-style” codec is a bitmask with quantized absolute coordinates,
  not Huffman coding or a complete delta protocol. It lacks safe packet sizing,
  actor removal/tombstones, baseline acknowledgements, keyframes, and resync.
  Its fixed 4 KB buffer can overflow for large actor sets, and its cache has no
  demonstrated expiry policy.
- The lock-on sample contains non-existent `Math.fusing` usage and performs
  important target/lock decisions locally.
- Standard WebGL `LineBasicMaterial.linewidth` is not portable above one pixel.
  Tracer endpoints and weapon events must come from authoritative simulation,
  not raw client coordinates.

## Implementation status and remaining order

1. **Prototype completed, feature-gated:** the authenticated WFM socket now
   supports server movement, nearby pilot/patrol JSON snapshots, client
   snapshot validation, and rendering in the existing Three.js Orbital scene.
   The browser pilot is still predicted locally, while the server runs its own
   movement copy. Current sessions are destination-scoped, not 3D spatial cells.
2. **Next:** reconcile local flight controls and pose with server snapshots,
   connect persistent patrol routes, and validate the shared world through
   reconnects and paired staging clients. Keep both feature flags off by default.
3. Add a bounded versioned binary keyframe/delta protocol behind a paired
   frontend/socket opt-in. Profile under realistic actor counts, latency,
   packet loss, reconnect, and mobile CPU limits.
4. Add server-confirmed target acquisition and lock feedback, then verified
   weapon-event replication and reusable tracer rendering.
5. Keep each stage disabled in Production until multi-device staging proves
   movement authority, faction/identity isolation, resync, combat attribution,
   settlement idempotency, renderer parity, and rollback.

This work is a prerequisite for true shared free-flight. A codec, targeting HUD,
or tracer visual by itself does not make local flight server-owned or multiplayer.
