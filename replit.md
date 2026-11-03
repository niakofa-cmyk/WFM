# WAR FOR MARS

Combat-first 5v5 space-combat game with a single-player campaign and a persistent-universe direction.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

WFM's primary product blueprint is `docs/references/wfm-infinite-war-blueprint.md`, with the owner's complete source preserved in `attached_assets/Pasted-WAR-FOR-MARS-The-Infinite-War-Open-Universe-Multiplayer_1793690415379.txt`. Its central principle is: “The universe is the battlefield. Every competitive engagement is an operation within the larger war. Every operation can have consequences for the universe.”

Use the blueprint as the product north-star: connect exploration, combat, competitive and cooperative operations, and persistent faction conflict through staged, playable releases. Its future capacity and feature proposals are goals, not claims about current behavior. Distinguish implemented and verified features from future work. Keep movement, weapons, damage, objectives, competitive results, rewards, and war consequences authoritative on trusted servers; use bounded sectors, feature flags, and Development/Staging/Production gates. `docs/player-journey-direction.md`, `docs/combat-evolution-roadmap.md`, `docs/open-universe-flight-foundation.md`, and `docs/competitive-battlefield.md` remain supporting implementation references.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
