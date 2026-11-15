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
  There is no production repair SQL approved or applied at this point.

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
