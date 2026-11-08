# Infinite Universe Systems Expansion

## Purpose

This is the maintained implementation direction for the four owner-provided
universe-expansion references stored verbatim beside this document:

- `references/UNIVERSE-BUNDLE-AUDIT-ROOT-CAUSE.txt`
- `references/HYPERSPACE-AND-PROCEDURAL-STARFIELD-DIRECTION.txt`
- `references/GRAVITY-WELLS-AND-STATION-TRADING-DIRECTION.txt`
- `references/SPACETIME-DISTORTION-AND-FACTION-CARGO-DIRECTION.txt`

The uploads are design inputs, not proof that their sample code is production
ready or that any described feature is already deployed.

## Architecture rules

1. Keep one Orbital-owned universe, simulation, and multiplayer authority.
   Three.js is the main universe renderer; native Orbital WebGL2 remains a
   supported companion renderer. Both present the same world state.
2. Keep Three.js out of initial menu and navigation payloads. Load it only
   through the existing gameplay route chunks. Preserve both raw and gzip
   budgets and fail the build if any Three.js module enters the initial static
   graph.
3. Reuse the existing deterministic, arbitrary-precision sector-address
   system. Sector coordinates are integer strings/BigInt addresses, while
   flight physics remains in a bounded local floating-point frame. Do not
   introduce a second procedural galaxy or a competing position store.
4. Any anomaly that changes movement, damage, or survival must be computed by
   the canonical deterministic simulation and enforced by the live server.
   Renderers may visualize the result but cannot author it.
5. Station trading and faction cargo contracts must use authenticated,
   persistent server-owned inventory, reputation, idempotency, and reward
   ledgers. Do not ship the uploads' client-held balances, mocked cargo,
   hard-coded payout contracts, browser alerts, or local credit deductions.
6. Space-time visuals must be added to the existing renderer pipeline. Do not
   create a second `WebGLRenderer` per overlay or screen effect.
7. Long-range travel must preserve saved world location and server validation.
   A local animation or client-entered BigInt coordinate is not a travel
   authorization, fuel charge, or persisted location change.

## Bundle-audit resolution

The standalone build was placing Three.js in the static import graph even
though the menu source did not statically import the renderer. The cause was
the global Rollup manual vendor chunk shared by the standalone menu and lazy
flight routes. Manual extraction is retained for the main app but disabled for
the separate Combat Lab compilation, allowing Rollup to preserve its deferred
flight chunks.

The build audit now finds all output chunks containing Three.js modules and
checks their combined raw/gzip budget and whether any are in the initial static
graph. It no longer assumes the engine always appears in one chunk named
`three-engine`.

## Existing reusable systems

The current code already has deterministic nearby-sector seeding, address
rebasing, and arbitrary-precision sector coordinates. These are the foundation
for large-coordinate exploration. The uploads' proposed separate sector table,
second deterministic seeder, and local-coordinate warp panel would duplicate
or bypass that foundation; they are not adopted as-is.

The existing universe also already uses one Three.js renderer for its
starfield, scenery, ships, and atmosphere. The background-star field has now
been changed to deterministic per-sector samples with GPU twinkle in that same
renderer. Sector changes reseed the visual field from the canonical sector
content; no extra renderer or simulation state is created.

## Safe implementation sequence

1. **Complete:** Keep the bundle gate passing for both builds, including the standalone
   Combat Lab entry. Treat the generated report, not a visual estimate, as the
   evidence.
2. Add black-hole/anomaly forces only as a versioned deterministic rule shared
   by the client simulation and the authoritative multiplayer server. Add
   boundary, determinism, collision, and renderer-parity tests before enabling
   a live route.
3. Add anomaly lensing to the existing Three.js render pipeline and a
   corresponding supported native-WebGL2 treatment where the view is used.
   Keep the effect local, bounded, and optional on mobile.
4. Extend the existing world service and progression ledger for cargo
   commodities and faction contracts. Review an additive database migration,
   use server-calculated prices/rewards and idempotent settlement, and keep
   local training no-reward.
5. Add long-range travel only after a server-owned destination/cost contract,
   persistence, cancellation/recovery behavior, and coordinate-version
   compatibility are defined. Then connect the existing sector map and
   seeded starfield to the transition.

The generated 64-bit jump UI, client-side credit balance, placeholder
contracts, mock inventory, and standalone renderer examples in the uploads
are intentionally not treated as live features. Generic server-owned markets
and faction services already exist; Iridium-specific stock, cargo contracts,
and payouts are not yet implemented. Their direction is retained here, with
the trust boundaries required by the current game architecture.
