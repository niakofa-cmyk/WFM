---
name: Staging and promotion policy
description: Environment separation and promotion requirements for WAR FOR MARS.
---

Use a separate Repl, database, and authentication environment for staging. Never reuse production data or secrets in staging. Promote changes only after staging checks pass; staging success alone does not establish production readiness.

**Why:** the user explicitly requested isolated staging data and a test-gated promotion process.

**How to apply:** when preparing staging, configuring authentication or databases, or promoting changes, preserve isolation and require evidence of passing staging checks. Review production schema, auth, recovery, and rollback separately.

## Pinned Railway service sources

Check each service's deployed commit, not just its configured branch, before a
cross-service staging test. A service pinned to a commit does not deploy branch
pushes.

**Why:** the deterministic simulation fix reached the frontend while the reward
API stayed pinned to old code, despite both services displaying `staging`.
Separately deployed game clients and sockets can also become protocol-incompatible:
an older client sent `join` before `authenticate`, while the updated socket
required authentication first and the client surfaced only a generic room error.

**How to apply:** compare frontend/API/socket deployed revisions and their shared
protocol or simulation contracts before claiming parity or starting a flight.
Change a staging pin only with explicit deployment approval; never update
production implicitly.

The owner approved a staging-only access gate for Railway browser testing.
It must protect game, API, and socket access without replacing Clerk sign-in
or changing production authentication.

**Why:** the owner authorized restricted staging access, not an unrestricted
public playtest or an authentication migration.

**How to apply:** keep direct backend endpoints private; do not expose the
previous ungated frontend while a protected replacement is still deploying.

## Hosting direction

Keep the game frontend, API, and Wing Socket services on Railway, using the owner's existing external Clerk application. The intended public game host is NiaKofa's `/kids/wfm/` route. Keep Replit for development and preserve isolated staging and the repository's promotion gate.

**Why:** the user superseded the earlier backend-only arrangement by explicitly choosing Railway for all three services and the existing external Clerk Production instance for live authentication.

**How to apply:** do not create another Clerk application or migrate back to managed Replit authentication. Validate staging with separate authentication and data before promotion. Review instance pairing, exact origin allowlists, schema, and endpoint routing without revealing credentials.

## Distribution goals

Single-player and real-time multiplayer are two modes of the same game. Use the browser version for discovery and try-now access; downloadable Android and iOS applications are the long-term product. Share gameplay and multiplayer infrastructure where practical rather than maintaining three games.

**Why:** the user selected browser play plus mobile applications and asked to preserve one game ecosystem.

**How to apply:** progress from development and private staging through browser launch, mobile beta and public mobile release. Adapt platform controls/features without assuming the browser build or a website wrapper is already suitable for app-store release.
