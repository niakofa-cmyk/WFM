# WFM isolated Railway staging backend repair

## Scope and status

- **Backend deployment status: PASS.**
- **Authenticated flight / release certification: BLOCKED.**
- Applied on 2026-10-25 UTC to Railway project `wfm-staging`, environment `staging`.
- Application source pinned to `add033ab9c1bd88d4d6306e89b04aee06eee0dd1`.
- Production configuration and deployments were not changed by this repair.

## Failure diagnosis

The staging frontend deployment had succeeded. The backend failures were
startup configuration failures, not TypeScript compilation failures:

- API: `DATABASE_URL must be set. Did you forget to provision a database?`
- Socket: `WING_ALLOWED_ORIGINS must be configured before running the socket server in production.`

The expected frontend and API Clerk variable names were present. Credential
values were not read, copied, printed, or changed. Variable presence alone does
not prove that the credentials belong to the same Development instance.

## Applied staging-only repairs

- Provisioned a new PostgreSQL service and persistent volume using Railway's
  PostgreSQL template and generated database credentials.
- Connected the API to that staging database through a Railway variable
  reference, without retrieving the connection string.
- Added the non-forced schema setup command:
  `pnpm --filter @workspace/db push`.
- Set production-mode runtime validation for the staging backends.
- Restricted API and socket browser origins to the staging frontend's private
  Railway hostname pending a protected public endpoint.
- Set the staging API port to 8080 and socket port to 8099.
- Preserved the owner-supplied Clerk variables and the fixed-instance API
  authentication implementation from the tested application commit.

## Verification evidence

| Component | Result | Evidence |
| --- | --- | --- |
| Source quality | PASS | GitHub Workspace quality run `40242836139` passed clean dependency installation, clean database schema setup, workspace typecheck, tests, and all builds for the pinned commit. |
| Staging database | PASS | Deployment `6922606e-d6f1-4665-94bc-227174685123` reached `SUCCESS`; runtime logs reported the database ready to accept connections. |
| Staging API | PASS | Deployment `612462cf-9a51-4e68-a8a9-272515b75755` reached `SUCCESS`; runtime logs reported `[✓] Changes applied` and `Server listening`. Its configured Railway health check is `/api/readyz`. |
| Staging socket | PASS | Deployment `f954a03e-8515-480d-9587-a692e01dd153` reached `SUCCESS`; runtime logs reported the socket server listening. Its configured health check is `/healthz`. |
| Database networking | PRIVATE | Service metadata showed zero public domains and zero TCP proxies. |
| Frontend | PREVIOUS DEPLOYMENT SUCCESS | Existing deployment `16aa73a0-6a3e-47ca-97b2-d9559ab21d78` had succeeded; no new browser gameplay verification was performed in this repair. |

These observations are Railway deployment and runtime evidence, not independent
public HTTP requests or a browser sign-in test.

## Remaining gate

No public staging game/API/socket domain was created by this repair. The private
origin allowlists must be updated to an approved protected browser origin when
one is established; they are not ready for arbitrary public-browser traffic.

Before promotion, complete:

1. Protected staging browser access and frontend API/socket endpoint wiring.
2. Authentication with an approved account in the staging Clerk instance.
3. Verification that the frontend and API accept that same account's session.
4. Profile loading, a complete sortie, debrief, server-owned reward, and
   persisted progression verification.
5. The remaining account-isolation, reconnect, restart, and reward-integrity
   checks required by the repository's staging promotion gate.

No test user was created and no authenticated flight, reward claim, or player
progression write was performed during this repair. The database schema was
initialized, but gameplay certification remains incomplete. This report does
not change `STAGING-TEST-RESULTS.json` to PASS or authorize a production merge.
