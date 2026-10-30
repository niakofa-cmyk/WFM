# Railway deployment evaluation

## Observed state

Initial inspection found one environment named `production`, with eight services following `niakofa-cmyk/WFM` on `main`, at commit `4b31352deef271c4c91a83d58d0932489c546cf2`. All eight initial deployments failed during the 2026-10-21 00:33–00:36 UTC build window. None had a successful running deployment.

At the initial inspection, no staged Railway changes, volumes, buckets, shared variable names, or real database service were present. The inspected game and API services had no configured variable names or public domains. Variable values were not requested.

## Current production snapshot — 2026-10-25

Railway's production patch has since been applied. The latest environment inventory shows six services:

| Service | Current state | Verified detail |
| --- | --- | --- |
| `Postgres` | Online | Railway deployment succeeded and a persistent volume is attached. The application schema has not been applied. |
| `@workspace/api-server` | Offline | Its latest deployment fails at runtime with `Missing Clerk Secret Key`. The service has only `DATABASE_URL` and `NODE_ENV` variable names; both Clerk keys and `API_ALLOWED_ORIGINS` are absent. It has no public domain. |
| `@workspace/wing-socket` | Online | The initial deployment called the missing `start:socket` script on `main`. The service now starts the built socket bundle directly; a fresh deployment passed Railway's `/healthz` check. It has no public domain or origin allowlist yet. |
| `@workspace/war-for-mars` | Offline | Its Railway build failed during frozen install with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. This service is out of the selected hosting scope: the game frontend remains on Replit. |
| Launch video and mockup sandbox | Offline | Unrelated artifact services; neither is required for the API/socket backend. |

All Railway GitHub services still follow `niakofa-cmyk/WFM@main`, currently commit `3ecff671fdadaa041599d3c3b475b83bc810ec36`. PR #1 remains unmerged; no Railway service was switched to the unmerged staging branch. No public domains are configured, and authenticated gameplay or multiplayer has not been tested against Railway.

## Historical common build blocker

Railpack 0.43.0 inferred **pnpm 9.15.9** from the version-9 lockfile. It then ran:

```text
pnpm install --frozen-lockfile --prefer-offline
ERR_PNPM_LOCKFILE_CONFIG_MISMATCH
The current "overrides" configuration doesn't match the value found in the lockfile
```

The repository stores overrides in `pnpm-workspace.yaml`; the CI workflow and working development toolchain use **pnpm 10.26.1**. At the time, the manifest did not declare its package-manager version. The initial game and API diagnoses confirmed this install failure before application builds started.

### Source correction prepared

The root manifest now declares `"packageManager": "pnpm@10.26.1"`, matching the existing CI pin. The frozen lockfile is retained, not regenerated or weakened.

Local verification:

- `pnpm install --frozen-lockfile`: PASS using 10.26.1.
- `pnpm --filter @workspace/api-server run build`: PASS, including API and socket bundles.
- `pnpm --filter @workspace/war-for-mars run build`: PASS.
- `pnpm-lock.yaml`: unchanged.
- No new full-match, authentication, production-database, or real-device certification is claimed by these build checks.

The pnpm correction was merged to `main` at `3ecff671fdadaa041599d3c3b475b83bc810ec36`. The socket build log confirms pnpm 10.26.1 and completes successfully; the API deployment also reaches runtime before failing on its missing Clerk secret. The frontend Railway build still reports a lockfile configuration mismatch, but that service is not the selected frontend host. The staging promotion gate must not be bypassed to deploy unmerged application changes.

## Owner-approved cleanup

The owner explicitly approved removing these four library-only Railway services:

- `@workspace/api-client-react`
- `@workspace/api-zod`
- `@workspace/api-spec`
- `@workspace/db`

Each was rechecked before deletion: failed deployment, expected repository source, no variables, no domains, and no volumes. All four were removed from the supplied Railway environment; every delete returned an empty detached-volume list. A subsequent inventory confirmed exactly four remaining services and no pending changes:

- `@workspace/api-server`
- `@workspace/war-for-mars`
- `@workspace/war-for-mars-launch-video`
- `@workspace/mockup-sandbox`

At the time of that inventory, all four remaining deployments were failed. No repository packages or real database were deleted.

## Hosting direction

Keep the game frontend on Replit. The owner selected the existing Railway `production` environment for the API and dedicated WebSocket backend, including a separate Railway PostgreSQL database. This does not move the frontend or authorize merging around the repository's promotion gate.

Railway sources remain on `main`; PR #1 is not merged. No source branch was switched and no public domain was added. The PostgreSQL/API/socket backend resources have since been provisioned in production.

## Applied Railway backend setup

The production environment now has a Railway PostgreSQL service (`Postgres`) with a persistent volume, the existing API service, and a separate `@workspace/wing-socket` service. The API's `DATABASE_URL` references the Railway database. The socket's start command is `node --enable-source-maps artifacts/api-server/dist/socket.mjs`; its current `main` build is healthy and passed Railway's `/healthz` check.

The API remains offline until the owner adds valid Clerk variables directly in Railway. Its latest deployment log explicitly reports `Missing Clerk Secret Key`; the API service's configured variable names confirm both `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` are absent. Do not create placeholder values or copy Replit development credentials into Railway.

### Variables and connectivity still required

- API service: add production `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, plus the exact stable Replit frontend origin as `API_ALLOWED_ORIGINS`, through Railway's Variables UI.
- Socket service: add the same exact frontend origin as `WING_ALLOWED_ORIGINS` before creating a public domain.
- Replit frontend: after the API and socket domains exist, set `VITE_API_BASE_URL` and `VITE_WING_SOCKET_URL` in the Replit environment. The frontend obtains Clerk bearer tokens for cross-origin API requests.

Use credentials for the same Clerk instance on the Replit frontend and Railway API. Never commit or paste secret values into chat or repository files. The current preview host is not a stable production frontend origin, so it has not been added to the production allowlists.

## Additional deployment gaps

| Service or concern | Observation / required correction |
| --- | --- |
| `@workspace/war-for-mars` | Its Railway install fails on a lockfile configuration mismatch. This service is not being used: the selected game frontend host is Replit. Do not expose or promote the Railway frontend as a workaround. |
| `@workspace/api-server` | The PostgreSQL reference exists, but the service is offline because the Clerk secret key is absent. Add the correct production Clerk keys and exact `API_ALLOWED_ORIGINS`, then redeploy and verify `/api/readyz`. |
| Match socket | Railway `/healthz` now passes with the direct built-bundle start command. A public Replit browser connection still requires `WING_ALLOWED_ORIGINS` and an approved public domain. |
| Database | The mistaken Railway `@workspace/db` service was removed with approval; the TypeScript package remains. PostgreSQL is now provisioned with a volume, but no application schema or player data has been applied. |
| `@workspace/api-client-react`, `@workspace/api-zod`, `@workspace/api-spec` | Mistaken Railway services removed with approval; all shared build-time packages remain in the repository. |
| Launch film and mockup sandbox | Separate presentation/design artifacts, not dependencies required to run the game. Retain or deploy them according to the owner's intended scope; do not delete them as part of an automatic cleanup. |
| Public routing | No domains are configured. A Replit browser needs public API and WebSocket endpoints; do not expose them until CORS/socket origin allowlists and authentication are configured. |
| Build watch paths | Root and shared-library watch patterns are configured for the API and socket services so lockfile and package-manager changes trigger builds. |
| Source policy | Services follow `main`; backend integration changes are being prepared on `staging` and must pass the existing PR promotion gate before Railway deploys them. |
| Access controls | The socket's origin allowlist is a browser-origin control, not player authentication or anti-cheat. Public exposure remains blocked until the intended access and invite policy is configured. |

## Safety and remaining work

The four approved library-service removals remain applied. PostgreSQL and the socket service are now provisioned; no application schema, player data, or credentials were copied. The API remains offline, no public domain is exposed, and the Railway frontend remains outside the chosen scope. No source branch was switched.

Next, the owner must add matching production Clerk keys and identify the stable Replit frontend origin in Railway's Variables UI. After that, configure the origin allowlists, create API/socket domains, apply the database schema through the approved migration flow, and set the Replit frontend URLs. PR #1 must still pass its repository promotion gate before its unmerged application changes reach Railway. Authenticated persistence, socket joins/reconnects, and live match behavior remain unverified; the current deployment is not production-ready.
