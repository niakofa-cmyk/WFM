# Server route and space-distribution implementation

## Source

The owner-provided source is preserved verbatim at
[`references/redesign/SERVER-ROUTE-SPACE-DISTRIBUTION-SOURCE.txt`](references/redesign/SERVER-ROUTE-SPACE-DISTRIBUTION-SOURCE.txt).

## Adopted implementation

- Patrol operation combat now uses the existing authenticated Orbital V2
  WebSocket simulation as its authority path. The server computes player-to-
  patrol distance from its own simulation state; it does not accept a client
  position, initial-state claim, kill total, reward amount, or replay log.
- A patrol is not weapon-authorized until the server-computed distance is at or
  below 180 m. The server suppresses pilot fire, missile, and lock inputs outside
  that volume, and keeps hostile patrol fire disabled until both faction
  response and the server range gate permit engagement.
- The server snapshot includes a bounded, validated patrol-approach status for
  the flight HUD. The client treats it as display state only; it cannot change
  the server gate. Kill attribution, shared fleet losses, and rewards continue
  through the existing server-issued encounter receipt and settlement path.
- Coordinate-keyed asteroid, debris, and anomaly seeding now lives in
  `@workspace/orbital-sim`, so the browser and server can call the same pure
  deterministic generator from canonical sector keys. The existing universe
  address/rebasing layer remains the source of sector identity.

## Security and architecture decisions

The sample HTTP route is not copied as written. An endpoint that accepts the
client's `initialState`, `inputFrames`, `pilotId`, or patrol coordinates cannot
prove that a pilot flew the claimed path. Replaying a client-authored trace
does not make that trace trustworthy. The current implementation instead uses
the already authenticated socket session and runs the movement and proximity
decision on the server.

The suggested HMAC design is also not used: a key embedded in a browser client
cannot be kept secret, and a shared signing key would not prove valid movement.
Clerk identity, WebSocket session verification, validated bounded input packets,
server simulation, server-issued results, and idempotent settlement remain the
authority chain.

The sample's fixed 90-to-135 credit balance and arbitrary +45 award are not
introduced. Existing reward policy and account transactions remain server
owned. The local no-reward universe trainer is unchanged.

The mining-console example is deferred. It computes harvest eligibility and
yield in the browser and calls a local callback, so it is not safe to award
persistent materials. Mining requires a server-owned resource ledger, location
and tool checks, depletion/idempotency rules, and transaction-backed inventory
settlement before it can grant anything.

The Three.js lazy-loading example is not applied. It conflicts with the
owner's Orbital-only renderer direction and would preserve a second renderer
instead of completing that migration.

## Scope boundary

The local free-flight scene still supplies only an advisory approach prompt.
The current server-authoritative patrol operation then runs its own server
simulation and independently enforces the 180 m combat gate. This prevents
client-reported proximity from authorizing damage or rewards, but it does not
claim that the current offline free-flight pose has already been transferred
into a shared online flight session. Seamless server-owned travel from that
free-flight session into combat remains a separate migration milestone.

The deterministic generator is shared code, not a claim that all streamed
asteroids are already server-collision-authoritative. Server collision
integration, persistent resource extraction, and a two-device staging
verification remain separate gates.

## Rollout and rollback

The approach field and engagement gate are available only on the existing
Orbital V2 sector protocol. The web client and Wing Socket must be promoted as a
matched revision with the V2 rollout flag enabled. The compatibility protocol
and offline local trainer remain unchanged. Rolling back the V2 runtime removes
the new approach gate from the active session; it does not delete patrol or
player-world records.
