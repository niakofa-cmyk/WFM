# Railway deployment evaluation

## Observed state

The supplied Railway project has one environment named `production`. Its eight services all follow `niakofa-cmyk/WFM` on `main`, at commit `4b31352deef271c4c91a83d58d0932489c546cf2`. All eight initial deployments failed during the 2026-10-21 00:33–00:36 UTC build window. None has a successful running deployment.

No staged Railway changes, volumes, buckets, shared variable names, or real database service were present. The inspected game and API services had no configured variable names or public domains. Variable values were not requested.

## Confirmed common build blocker

Railpack 0.43.0 inferred **pnpm 9.15.9** from the version-9 lockfile. It then ran:

```text
pnpm install --frozen-lockfile --prefer-offline
ERR_PNPM_LOCKFILE_CONFIG_MISMATCH
The current "overrides" configuration doesn't match the value found in the lockfile
```

The repository stores overrides in `pnpm-workspace.yaml`; the CI workflow and working development toolchain use **pnpm 10.26.1**. The manifest did not declare its package-manager version. Both game and API deployment diagnoses and build logs confirm this failure before the application build starts.

### Source correction prepared

The root manifest now declares `"packageManager": "pnpm@10.26.1"`, matching the existing CI pin. The frozen lockfile is retained, not regenerated or weakened.

Local verification:

- `pnpm install --frozen-lockfile`: PASS using 10.26.1.
- `pnpm --filter @workspace/api-server run build`: PASS, including API and socket bundles.
- `pnpm --filter @workspace/war-for-mars run build`: PASS.
- `pnpm-lock.yaml`: unchanged.
- No new full-match, authentication, production-database, or real-device certification is claimed by these build checks.

The correction is prepared on the local `staging` branch. Railway still follows `main`; this local edit has not changed or redeployed Railway. The protected promotion gate must not be bypassed to move unverified staging application changes into production.

## Additional deployment gaps

| Service or concern | Observation / required correction |
| --- | --- |
| `@workspace/war-for-mars` | Custom start command runs `pnpm --filter @workspace/war-for-mars dev`. Use a production static server/gateway, not Vite's development server. Preserve SPA routing and same-origin API/socket access. |
| `@workspace/api-server` | Builds the API/socket bundles but starts only the API process. It needs the correct environment-specific database and Clerk configuration, health/readiness checks, and networking. |
| Match socket | No independently running socket service was imported. Configure an actual runtime for the existing socket process; do not assume building its bundle starts it. |
| `@workspace/db` | This is the TypeScript database-access/schema package, **not** a PostgreSQL database. Provision or explicitly connect an environment-appropriate real database before applying schema. Do not copy production data/credentials into a test deployment. |
| `@workspace/api-client-react`, `@workspace/api-zod`, `@workspace/api-spec` | Shared build-time libraries, not independently running network services. Their Railway service definitions should be removed only after owner approval; keep all repository packages. |
| Launch film and mockup sandbox | Separate presentation/design artifacts, not dependencies required to run the game. Retain or deploy them according to the owner's intended scope; do not delete them as part of an automatic cleanup. |
| Public routing | No domains are configured for game/API. Railway does not use Replit's artifact path router. A working game needs explicit routing for `/api` and `/ws`, not just an online static landing page. |
| Build watch paths | Inspected services watch only their artifact directories. Include root package/lock/workspace files and relevant shared libraries so dependency fixes and contract changes trigger builds. A root-only fix may otherwise require an explicit new deployment. |
| Source policy | All Railway sources currently follow `main`; current development improvements are on `staging`. Confirm whether this new Railway project is an isolated test environment or intended production before changing source branches or accepting deployments. |
| Access controls | Railway project/dashboard access is not evidence that the deployed game is Invite-only. Verify the intended application access restriction before creating public domains. |

## Safety and remaining work

No Railway service was deleted, no source branch was switched, no credentials were copied, no domain was exposed, no database was provisioned or migrated, and no deployment was accepted during this evaluation.

Next actions depend on the owner's environment decision: correct the runtime topology, configure environment-owned database/auth resources, expose only the intended access surface, deploy the selected source, and then verify HTTP readiness, authenticated persistence, same-origin API calls, socket joins/reconnects, and interrupted-match behavior. These checks remain incomplete; successful local builds do not make the Railway game live or certify production readiness.
