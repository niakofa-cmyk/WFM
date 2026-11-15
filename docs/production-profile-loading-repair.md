# Production profile-loading incident and repair boundary

## Confirmed evidence — 2026-11-15

- Railway project `hopeful-radiance`, environment `production`, service
  `@workspace/api-server` reported missing `player_progress` in runtime logs at
  12:32:25 and 12:33:46 UTC.
- The live successful API deployment inspected was created 2026-10-25;
  a newer deployment entry was **skipped**, not a deployed API update.
- The frontend's latest successful deployment was created 2026-11-15.
- A public API readiness request returned HTTP 200 with
  `{"status":"ready","database":true}` despite those profile errors.
- The old readiness route runs only `SELECT 1`. That cannot distinguish a
  reachable empty/wrong database from an initialized WFM database.
- The workspace Railway CLI rejected authentication. The working connector can
  inspect deployments/logs but provides no direct SQL executor. No production
  database change or new sign-in challenge was performed.

This is not fixed by changing Clerk keys, rendering, browser cache, or returning a
fabricated successful profile. The initial profile insert/read needs its actual
persistent table. Do not certify website sign-in/profile loading until a real
authenticated production profile request succeeds and remains valid on reload.

## Authorized read-only catalog inspection — 2026-11-15

After explicit authorization to use the saved account credential, service-scoped
SSH succeeded. The account-profile CLI command's failure did not establish that
service access was unavailable.

- The running API's project, environment and service identifiers matched the
  intended production targets.
- Its configured database host was `postgres.railway.internal`, database
  `railway`. The production Postgres service's private endpoint was `postgres`.
- The active schema was `public`, with search path `"$user", public`.
- The API database role was a superuser; this was not a catalog-visibility or
  missing SELECT grant problem.
- Neither unqualified nor `public.player_progress` resolved. Catalog queries
  found no matching relation, columns, indexes or constraints.
- The connected `railway` database contained **no application tables**. The only
  other non-template database, `postgres`, also contained no application tables.
- The requested zero-row profile query failed with SQLSTATE `42P01`.
- Catalog queries ran inside read-only transactions and were rolled back.
  No player records were read; no production writes, migrations, connection
  changes or deployments were performed.

This confirms the immediate cause but does not establish whether this cluster
was intended to be fresh or whether previous saves exist in another cluster or
backup. Do not create only a replacement profile table: the rest of the game
schema is absent too. Resolve the saved-data history first, then propose either
a recovery/reconnection plan or a reviewed fresh-database migration. Obtain
explicit approval before applying either production repair.

## Proposed fresh-production initialization

The user confirmed that production is fresh and has no previous saved pilot
progress. This permits preparing initialization instead of a save-recovery plan;
it does **not** by itself approve executing production SQL.

The manual candidate is `lib/db/repairs/initialize-fresh-production.sql`:

- Creates the current Drizzle schema: 22 tables, seven enum types, indexes,
  checks, primary keys and campaign foreign keys.
- Covers profiles, equipment, inventory/economy, world state, patrols, presence,
  checkpoints and shared campaign storage, not just the first failing table.
- Inserts no pilot profiles, rewards, balances, campaign progress or market rows.
  Existing application initialization remains responsible for initial records.
- Contains no drops, deletes, updates, grants or replacement tables.
- Runs atomically with local lock/statement timeouts and an advisory lock.
- Refuses a database other than `railway`, or one containing application
  relations or user enum/domain types. Repeat application fails closed.
- Must be invoked only through the already verified production API service;
  the database name alone is not sufficient target verification.
- Is not registered in startup, build, publishing or automatic migrations.

`node --test scripts/fresh-production-schema.test.mjs` checks exact equivalence
to a fresh Drizzle export, the refusal guard, and schema/profile initialization
in an isolated Development transaction that is always rolled back. It is not a
production sign-in certification. Review and obtain explicit production write
approval before applying the candidate; recheck target identity and emptiness
immediately before execution. Afterward verify columns/permissions and then
authenticated profile loading and website reload. Do not silently promote a
new API build as part of the database-only repair.

## Approved production initialization applied — 2026-11-15

The user explicitly approved **Apply schema and verify** after reviewing the
fresh-production scope. The approved file committed at
**2026-11-15T21:28:30.883Z**, through the verified production API service.
Its SHA-256 was
`e67c850a6e9445d259e4e24c4652305ae32ec1e8c8d2ac9db7f6fd4669992de0`.
Target identifiers, private database host, database name and the file hash were
checked before execution; the transaction's empty-database guard also passed.

Post-commit verification through the running API's own database role confirmed:

- All 22 expected tables existed, with an exact table-name-set match.
- Seven enum types existed.
- All 22 profile columns resolved with `LIMIT 0`.
- Schema USAGE, per-column SELECT and per-column INSERT privileges passed.
- Public API liveness and readiness returned HTTP 200.
- The production website returned HTML with its app root, and its entry bundle
  referenced the verified production API host.
- An unauthenticated API profile request returned HTTP 401, not a fabricated
  profile or a server error.

The profile-table schema blocker is repaired. These checks do **not** certify an
authenticated production profile request or browser reload/hangar entry. No
sign-in challenge, test pilot record, reward claim, authentication configuration
change, application deployment or service restart was performed by this repair.
The live API still serves its older connectivity-only readiness response; the
new detailed readiness code requires a separately reviewed release.

## Production browser verification — initial challenge

The approved existing-account browser check found a separate direct-host issue:
the deployed Railway-address frontend requested Clerk from
`clerk.workspacewar-for-mars-production.up.railway.app`, which failed browser
TLS with `ERR_CERT_COMMON_NAME_INVALID`. No credentials were submitted there.
The certificate check was not bypassed. A reachable fallback Clerk endpoint
in a static bundle did not prove which host the browser actually selected.

The canonical `https://niakofa.com/kids/wfm/sign-in` loaded Clerk without browser
errors. The existing production test account advanced to `needs_client_trust`;
Clerk accepted second-factor preparation with HTTP 200 and displayed a fresh
code challenge. That does not prove email delivery, an active session or profile
success. No old code was submitted or automatically reused.

The browser owner blocks non-GET game API requests. Authenticated profile HTTP
200, session retention on reload and hangar visibility remain pending the fresh
secure code handoff. The direct Railway-host issue remains unresolved in the
deployed frontend and must not be described as fixed by the database migration.

### Code handoff result and local redirect fix

The user supplied a fresh production code securely. It was submitted exactly
once to the waiting browser. Clerk returned HTTP 200 for the second-factor
attempt and client update; the browser then navigated to the host site's
`/login` page. At that page the game Clerk runtime was not loaded. No successful
authenticated game profile request, session-retaining reload, or hangar entry
was observed. An accepted factor HTTP response is not certification of those
remaining steps.

The browser owner was closed without code retries, gameplay or reward requests.
The local game now explicitly sets both sign-in and registration return
destinations to its own mounted game entry. This avoids relying on host-site
authentication return defaults. Six focused auth configuration/redirect tests,
the frontend type check, both WFM build modes and four build-resource checks
passed. The Development workflow restarted cleanly and the public landing page
rendered correctly.

This redirect change is **not deployed to production**. The existing explicit
Clerk-instance selection also needs to be included in a reviewed frontend
release before claiming the direct Railway host is repaired. Release through
staging review first; repeat only the failed authenticated return/profile/reload
flow after the corrected build is actually serving. Do not request another code
for the unchanged production build or describe website sign-in as certified.

## Focused staging release — 2026-11-15

The owner approved deploying and verifying the sign-in fixes in staging. Live
metadata showed the protected staging frontend pinned to
`f6783de197e2e9a032223feac0fabbea9bead8cd`, rather than the broader Development
branch. A separate hotfix was therefore based on that exact deployed source.
It preserves the private gateway, API session bridge, dependency lockfile and all
gameplay code.

- Repository branch: `fix/wfm-staging-signin-return`.
- Hotfix revision: `84706e6c91ec9e4c0490033fc357d263ad6061a3`.
- Changes: only the frontend auth wiring and a configuration helper with six
  passing regression tests.
- Staging deployment: `70afe82b-ffa9-4858-a0dd-8942acb9c25c`.
- Target: the existing `wfm-app-staging` service in `wfm-staging` / `staging`.
- Reviewed Railway patch: only the frontend source branch and commit pin changed;
  no shared variables, destructive changes, or other service changes.
- Production and both databases were untouched by this staging release.

Deployment was triggered after reviewing the pending patch. Completion and
authenticated browser results must be recorded separately below; merely pushing
the branch or starting its build does not certify sign-in or profile loading.

### Staging deployment and verification result

Railway reported deployment `70afe82b-ffa9-4858-a0dd-8942acb9c25c` successful
at revision `84706e6c91ec9e4c0490033fc357d263ad6061a3`. Its private-gateway
health check succeeded at `2026-11-15T21:49:28.965759630Z`.

Post-deployment checks:

- Health endpoint: HTTP 200.
- Unauthenticated root, sign-in and game profile requests: HTTP 401.
- Unauthenticated WebSocket upgrade: HTTP 401.
- Normal browser submission of the existing private staging access form worked.
- The configured Clerk Development instance loaded, without the previous
  hostname-derived certificate failure.
- The approved existing staging account reached `needs_client_trust`.
- Clerk's email-challenge preparation returned HTTP 400 with the machine error
  `dev_monthly_email_limit_exceeded`. A diagnostic retry confirmed the same
  provider limit. This is not evidence that a fresh email was sent.

No verification code was requested through the secure handoff or submitted.
Both browser owners were closed; their observers recorded zero attempted game
API writes. After identifying the limit, no further sign-in/email retries,
authentication bypass, account/security-setting changes, production deployment
or database migration were performed.

At the end of the automated run, a completed fresh challenge, authenticated
profile HTTP 200, post-auth return, reload retention and production sign-in
were not certified. The owner then selected the trusted-device path below.
Never substitute a historical challenge record or an unrelated account for
either result.

### Trusted-phone follow-up — 2026-11-15

The owner used the normal trusted staging browser and reported: **“Game loads
and survives reload”** in response to the instructed sign-in/game return,
saved-profile and reload check.

Railway's staging gateway HTTP logs for the deployed hotfix independently
recorded successful `/api/game/profile` responses:

| UTC timestamp | HTTP status |
| --- | --- |
| 2026-11-15T21:58:16.126443358Z | 200 |
| 2026-11-15T21:58:55.502460174Z | 200 |
| 2026-11-15T21:58:58.670468339Z | 200 |

These are current staging responses, not the earlier unauthenticated HTTP 401
or historical challenge records. They corroborate the reported working profile
and reload behavior. No per-device/account identifiers were inspected or
retained, so the log entries are not independently tied to a particular phone.

**Verified scope:** owner-confirmed trusted-device game/profile loading and
reload retention, with corroborating staging profile HTTP 200 responses.
**Still not certified:** a fresh email-code challenge and production
authentication after a frontend release. The provider email limit remains;
no production frontend was deployed during this check.

## Production frontend hotfix prepared for review

Draft pull request: https://github.com/niakofa-cmyk/WFM/pull/22

The hotfix is based on the actual production revision
`05e17d8040856336904178e115425d6e56e2d9f4`, with proposed head
`3ade9ec51a8eb896f264c0c836c1635fcef22559`. It contains only the three
frontend auth files, frontend test-command wiring, and a release-review document.
The auth source files are byte-identical to the deployed staging hotfix; no
staging gateway, gameplay change, migration or backend change is included.

All 25 frontend tests, library/frontend type checks, and a build mounted at
`/kids/wfm/` passed. GitHub's full **Verify workspace** job also passed.

The separate **Verify staging evidence** promotion check failed: non-staging
branches must satisfy a restricted exception, and the existing auth-recovery
exception is pinned to an earlier approved production base. That guard was
not changed or bypassed. The failure and evidence limits are recorded on the
draft PR. A separately approved, narrowly scoped release path is needed before
merging or deploying. Production remains unchanged by this preparation.

## Read-only check before any repair

An authorized operator must select this exact production API service's database,
not the staging or Replit database, and run:

```sql
BEGIN READ ONLY;
SELECT current_schema() AS active_schema,
       current_setting('search_path') AS search_path,
       to_regclass('player_progress') IS NOT NULL AS profile_resolves,
       to_regclass('public.player_progress') IS NOT NULL AS public_profile_exists;
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name IN (
  'player_progress', 'progression_events', 'strike_runs', 'player_world_state'
)
ORDER BY table_schema, table_name;
SELECT table_schema, column_name, data_type, is_nullable, column_default,
       has_schema_privilege(table_schema, 'USAGE') AS schema_usage,
       has_column_privilege(
         format('%I.%I', table_schema, table_name), column_name, 'SELECT'
       ) AS can_select,
       has_column_privilege(
         format('%I.%I', table_schema, table_name), column_name, 'INSERT'
       ) AS can_insert
FROM information_schema.columns
WHERE table_name = 'player_progress'
ORDER BY table_schema, ordinal_position;
COMMIT;
```

Do not share connection strings, passwords, tokens, user records or verification
codes. Schema names and the query's booleans are sufficient for diagnosis.

- If the table exists in another schema, inspect the search path; do not create a
  competing progress table.
- If this is the wrong database, correct the connection only after checking the
  intended existing data and obtaining approval.
- If historical progress is expected, stop and investigate the original database
  and provider restore options. Initializing a new table does not recover saves.
- Compare the actual catalog (including columns, types, defaults, keys, indexes
  and grants) to the repository's Drizzle schema before drafting any migration.
  Metadata hidden from a restricted role is not proof that a table is absent.
- Generate the proposed repair only from that inspected difference. Obtain
  explicit approval before any production write, migration, connection change or
  deployment. Never initialize an empty replacement merely to remove an error.
- The initial speculative table-creation candidate was removed before execution.
  At that initial inspection, no production repair SQL was approved or applied.
  The later explicit fresh-production approval and result are recorded above.

## Prevention and release order

The updated checks are independent facts:

- `/api/healthz`: process liveness only; remains HTTP 200 during database/schema
  failures, makes no database queries and never exits/restarts the process.
- `/api/readyz` connectivity: `SELECT 1` tests whether PostgreSQL accepts a query.
  The existing `database` field reports only this fact.
- `/api/readyz` profile schema: verifies that the resolved relation is the
  intended Drizzle schema/table, then resolves **every current profile column
  with LIMIT 0** inside a read-only transaction. A shadow table cannot pass.
- `/api/readyz` initialization privileges: checks schema USAGE and INSERT grants
  on every column named by the ORM's initial profile insert. SELECT access is
  already tested by the zero-row query. No test player is inserted.

The additive OpenAPI `checks` object reports `databaseConnectivity`,
`profileSchema` and `profileInitializationPrivileges`. `true` passed, `false`
failed, and `null` was not attempted after a prerequisite failure. Overall status
is 503 unless all checks pass. A connected database with a missing profile thus
reports `database: true`, `profileSchema: false`, and
`profileInitializationPrivileges: null`, not a misleading healthy profile.
Older response bodies remain parseable, but absent diagnostics are not invented
evidence of profile readiness.

Use liveness, not profile readiness, for any restart watchdog. Keep readiness for
traffic/release gating. No restart policies were changed by this work.

Catalog grants do not prove that an authenticated insert/read will succeed under
RLS, triggers, default-expression dependencies or account-specific policies.
Readiness checks do not certify a completed sign-in flow or every game table.
Public probes expose no row data, connection details or raw database errors.

Development verification passed eight focused tests, including stage-specific
HTTP failures with healthy liveness, missing tables/columns, complete read-only
schema/grants, shadow-schema rejection, denied/unknown grant handling, older
response compatibility, and rejection of unauthenticated/forged profile requests.
All workspace type checks passed. These are not repaired-production evidence.

1. Confirm database identity, search path, existing progress and repair approval.
2. Draft a catalog-derived migration, review its data-preservation behavior, and
   obtain explicit production approval. Apply only that approved fix.
3. Verify schema access with the deployed API database role.
4. Review the API release revision and validate it in isolated staging before
   production promotion. Applying a schema file alone does not deploy source.
5. Verify a real authenticated `/api/game/profile` returns the expected account's
   saved state; reload the website and confirm hangar entry. Check other game
   tables independently: this narrowly scoped repair does not install the entire
   universe/economy schema or certify combat/reward persistence.

Never wire the manual SQL into startup/build or run a force schema push against
production. The external Railway database is not migrated by Replit Publish.
