---
name: Staging and promotion policy
description: Environment separation and promotion requirements for WAR FOR MARS.
---

Use a separate Repl, database, and authentication environment for staging. Never reuse production data or secrets in staging. Promote changes only after staging checks pass; staging success alone does not establish production readiness.

**Why:** the user explicitly requested isolated staging data and a test-gated promotion process.

**How to apply:** when preparing staging, configuring authentication or databases, or promoting changes, preserve isolation and require evidence of passing staging checks. Review production schema, auth, recovery, and rollback separately.

## Hosting direction

Keep the game frontend on Replit and use the existing Railway production environment for the API, WebSocket service, and a separate PostgreSQL database. This does not move the frontend or bypass the repository's staging promotion gate.

**Why:** the user selected the backend-only Railway setup after reviewing the current production environment gaps.

**How to apply:** keep the frontend on Replit. Do not deploy the Railway resources until the source passes the existing gate and the production Clerk keys, exact frontend origin allowlists, database schema, and public endpoint plan are reviewed. Never copy credentials into chat or commit them.

## Distribution goals

Single-player and real-time multiplayer are two modes of the same game. Use the browser version for discovery and try-now access; downloadable Android and iOS applications are the long-term product. Share gameplay and multiplayer infrastructure where practical rather than maintaining three games.

**Why:** the user selected browser play plus mobile applications and asked to preserve one game ecosystem.

**How to apply:** progress from development and private staging through browser launch, mobile beta and public mobile release. Adapt platform controls/features without assuming the browser build or a website wrapper is already suitable for app-store release.
