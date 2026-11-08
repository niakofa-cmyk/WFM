# Authoritative free-flight and universe-sync foundation

## Owner references

The two source documents are preserved verbatim:

- [Authoritative free-flight multi-ship encounter lifecycle](references/redesign/AUTHORITATIVE-FREE-FLIGHT-MULTI-SHIP-ENCOUNTER-SOURCE.txt)
- [Protocol Buffers and engine-trail infrastructure](references/redesign/PROTOBUF-ENGINE-TRAIL-INFRASTRUCTURE-SOURCE.txt)

This review builds on the existing [Orbital scale and protocol recovery direction](ORBITAL-SCALE-PROTOCOL-RECOVERY-REDESIGN.md), [persistent patrol implementation](PERSISTENT-MULTI-SHIP-UNIVERSE-PATROLS.md), and [server route-space implementation](SERVER-ROUTE-SPACE-DISTRIBUTION-IMPLEMENTATION.md).

## Architectural direction

The intended result remains one connected universe, with Orbital as the
canonical flight/combat simulation and renderer. Server-owned patrols and
operations are real world activity; local renderers may interpolate received
positions but cannot decide hits, kills, faction losses, progress, or rewards.
Separate battle instances may scale independently while sharing player identity,
universe state, and server settlement.

## What the repository supports now

- Persistent multi-ship patrol routes are stored and advanced from server-owned
  route state. The world patrol directory projects nearby strategic traffic;
  that directory is not a continuous per-tick free-flight session.
- The authenticated Orbital V2 patrol operation owns pilot and patrol poses,
  enforces the server-side 180 m weapons gate, attributes casualties, and uses
  the existing result/settlement path.
- A browser may show patrol traffic through the native WebGL2 Orbital spectator
  renderer. These contacts are presentation proxies, not control authority.
- A native, bounded engine-exhaust line now uses those received contact poses
  and velocities. It writes into a reusable fixed-size buffer, caps cues at 64
  ships, and remains visual-only. It does not add Three.js or change simulation
  state.

The persistent universe has not yet become one continuous server-authoritative
flight session. The offline universe pose is not transferred as trusted state
when a patrol operation starts; the server operation begins from its own
server-created pose and performs its own approach check. Individual human-pilot
positions are not currently streamed through the public patrol directory.

## Protocol Buffers groundwork

`lib/orbital-sim/proto/universe_sync.proto` defines a versioned, server-to-client
snapshot shape with an integer sector anchor, bounded local position, velocity,
faction, ship identity, traffic kind, heading, and hull fraction. The paired
shared TypeScript contract rejects unknown fields, oversized contact lists,
duplicate actor IDs, unsafe coordinates, and invalid values. Actor IDs are
ephemeral identifiers, not account IDs.

This is a schema and validation foundation, not an active binary transport.
Existing authenticated JSON socket protocols remain unchanged. No WebSocket
accepts this schema yet, no code generator or protobuf runtime has been added,
and server/client version negotiation for binary frames is not complete. Before
activating it, benchmark actual encoded JSON and Protobuf sizes, CPU, memory,
and p95/p99 behavior; add a feature-gated protocol version, strict byte limits,
JSON fallback, reconnect behavior, and staged mixed-version tests. Human pilot
presence must additionally follow visibility, privacy, and region-interest
rules.

## Sample-code review

The source is directional reference, not production-ready implementation:

- Do not use `Math.random()` for server fleet retargeting. Persistent movement
  must remain seeded, time-based, and concurrency-safe.
- Do not accept client initial states, coordinates, replay frames, kill totals,
  or reward amounts through a settlement route. The authenticated socket
  simulation and its server-issued result receipt remain authoritative.
- Do not embed a signing secret in a browser or use an HMAC to imply that
  client-reported flight telemetry is true.
- Do not hard-code pilot IDs, balances, kills, or fixed awards; account identity
  and reward policy belong to existing server-owned profile and transaction
  paths.
- Do not copy the sample's Three.js renderer or particle system. It conflicts
  with the Orbital-only direction and uses nondeterministic particle velocity.
- Do not treat a two-browser smoke test or a claimed 34-byte packet as proof.
  Measure the built protocol and verify both connected clients against the
  exact server revision.

## Remaining gates

1. Move persistent free-flight movement into a server-owned Orbital session that
   can preserve trusted sector position across navigation and encounter entry.
2. Add region-scoped human presence with privacy-safe actor IDs, interpolation,
   bounded interest management, reconnect recovery, and multi-client authority
   tests.
3. Generate and benchmark the Protobuf schema beside the unchanged JSON
   protocol; enable binary snapshots only after compatibility and staging gates.
4. Extend the native Orbital renderer and verify exhaust cues, ship meshes,
   camera, mobile performance, and WebGL resource cleanup on supported devices.
5. Continue the separate legacy-renderer removal only after each Orbital
   replacement passes parity, accessibility, performance, and rollback checks.

No production rollout or two-device verification is claimed by this foundation.
