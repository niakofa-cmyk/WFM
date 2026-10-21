---
name: Staging and promotion policy
description: Environment separation and promotion requirements for WAR FOR MARS.
---

Use a separate Repl, database, and authentication environment for staging. Never reuse production data or secrets in staging. Promote changes only after staging checks pass; staging success alone does not establish production readiness.

**Why:** the user explicitly requested isolated staging data and a test-gated promotion process.

**How to apply:** when preparing staging, configuring authentication or databases, or promoting changes, preserve isolation and require evidence of passing staging checks. Review production schema, auth, recovery, and rollback separately.

## Hosting direction

Keep Replit for development and private staging. Evaluate Railway as a candidate for a dedicated multiplayer/API/database backend rather than automatically moving the whole game or treating staging as production.

**Why:** the user wants to preserve the existing Replit development and staging work and choose production hosting based on measured connection stability, capacity, resource needs, cost, and recovery behavior.

**How to apply:** prepare isolated backend trials before choosing production hosting. A cleanup approval is not permission to switch a production environment to unverified staging code, migrate the frontend, or reuse production credentials.

## Distribution goals

Single-player and real-time multiplayer are two modes of the same game. Use the browser version for discovery and try-now access; downloadable Android and iOS applications are the long-term product. Share gameplay and multiplayer infrastructure where practical rather than maintaining three games.

**Why:** the user selected browser play plus mobile applications and asked to preserve one game ecosystem.

**How to apply:** progress from development and private staging through browser launch, mobile beta and public mobile release. Adapt platform controls/features without assuming the browser build or a website wrapper is already suitable for app-store release.
