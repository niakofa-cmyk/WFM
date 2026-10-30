# WFM external Clerk migration and recovery plan

## Decision and status

**Status: planning only. No migration, authorization, configuration change, or
deployment has been performed.**

Preserve the existing Replit-managed Clerk app and its Development
authentication. Do not enable the Railway Production authentication path while
the external Production Clerk instance is not independently authorized and
verified.

The current Clerk integration is connected, but its authenticated instance
metadata identifies it as `development`; it does not identify the external
Production instance at `clerk.niakofa.com`. A connected Railway integration
does not authorize a Clerk instance.

Replit's current documentation says switching from Replit-managed Clerk to an
external Clerk app requires deleting the managed Clerk app first. Replit
documents that deletion as destructive: the tenant is removed, and user
accounts, credentials, and sessions are not automatically migrated. Replit
provides no automated migration path. Therefore, this documented replacement
path does **not** satisfy the current decision to preserve managed Development
auth. No delete or replacement action is approved by this plan.

## Provider documentation findings

Sources were checked on **2026-10-27**:

1. [Clerk: Migrating your data](https://clerk.com/docs/guides/development/migrating/overview)
   (page marked last updated 2026-10-26).
2. [Clerk Backend API: Create a user](https://clerk.com/docs/reference/backend-api/2026-08-20/tag/users/POST/users)
   (versioned Backend API reference).
3. [Clerk: createUser()](https://clerk.com/docs/references/backend/user/create-user)
   (password digest formats, external IDs, and import guidance).
4. [Replit: Clerk Auth](https://docs.replit.com/features/auth-and-identity/clerk-auth)
   (Replit documentation search result).

**Verified by Clerk documentation**

- The migration overview explicitly says users cannot be migrated from a
  Clerk Development instance to its Production instance. The WFM source
  connection currently identifies as Development, so a direct import of that
  user store into Production is a **no-go unless Clerk/Replit confirms a
  supported exception or alternate path for this exact configuration**.
- Clerk documents basic export/import through its Backend API `CreateUser`
  endpoint. That endpoint accepts `password_digest` and `password_hasher`;
  the current API reference lists supported hashers including bcrypt,
  bcrypt_sha256_django, PBKDF2 variants, phpass, Firebase/Werkzeug scrypt,
  SHA-256, LDAP SSHA, Argon2i/Argon2id, and AWS Cognito. Digest encoding is
  hasher-specific and must match the documented format. The overview says
  Clerk may transparently upgrade supported imported hashes to bcrypt.
- The `CreateUser` request accepts a unique `external_id` for an ID from a
  previous system. It does not expose a caller-specified native Clerk `id`
  field in the create request. Assume the destination assigns a different
  native user ID unless the provider documents another supported mechanism. The migration guide
  describes using `external_id` in a customized JWT claim; WFM currently reads
  `getAuth(req).userId`, so that custom-claim strategy is not automatically
  applied by the current API.
- The `CreateUser` reference says email addresses created by this endpoint are
  verified by default unless `email_address_identification_status` marks them
  reserved. Any future import must deliberately preserve the source
  verification state; importing must not silently assert that an inbox was
  verified.
- Clerk's migration overview warns that changing session-management systems
  affects existing sessions. Replit's Clerk guidance separately states that
  deleting the managed tenant does not migrate sessions.

**Still unknown for WFM**

- Whether the source users in this Replit-managed Development tenant can be
  exported and imported to the separate external Production instance at all.
  Clerk explicitly disallows migrating users from a Development instance to
  its Production instance; whether a separate external instance is treated
  differently is not established by the published guide.
- Whether the source password digests are available to this owner, which
  hasher and encoding each uses, and whether Clerk accepts those exact digests
  in the intended destination. API support for named hashers does not prove
  source-hash portability or override the Development-to-Production restriction.
- Whether account IDs can be retained by any supported operation. Current
  `CreateUser` documentation supports a unique `external_id`, not setting the
  destination's native Clerk ID.
- Whether a supported non-destructive path exists to keep this managed
  Development app while authorizing the separate external Production app.
- Whether any external Production origins, redirects, email delivery, account
  settings, or keys currently match the WFM requirements. No Production
  values or user data were inspected.

**Go/no-go**

- **GO:** Continue code/schema inventory and synthetic unit tests; continue
  non-production planning.
- **NO-GO:** Import real managed Development accounts into Production, change
  identity claims, remap any real game rows, delete the managed tenant, or
  enable Production until the owner obtains an authoritative answer for the
  Development-to-Production restriction, a supported export/import procedure,
  a verified identity mapping, and a tested restore/recovery route.
- **NO-GO:** Assume `external_id` preserves the native Clerk subject or that
  imported credentials/sessions will work without an isolated provider-backed
  test.

## Verified application dependencies

- The game frontend mounts `ClerkProvider` with the explicitly configured
  `VITE_CLERK_PUBLISHABLE_KEY`. The code does not derive or rewrite the key from
  a hostname. Sign-in and sign-up routes are Clerk-backed.
- The frontend obtains a Clerk session token and forwards it to the configured
  API. Signed-in account/progression UI is mounted only after Clerk reports a
  loaded signed-in session.
- The API configures `clerkMiddleware` with the explicitly configured
  `CLERK_PUBLISHABLE_KEY`. Protected game routes reject requests without a
  Clerk user identity with HTTP 401 and `authentication_required`.
- API browser access is constrained by the exact `API_ALLOWED_ORIGINS`
  allowlist. API CORS is separate from Clerk allowed origins and redirect URLs.
- Persistent game data is keyed by Clerk subject/user IDs. For example,
  `player_progress.user_id` and `player_world_state.user_id` are primary keys;
  the current schema also stores player IDs in:
  `strike_runs`, `progression_events`, `player_inventory`,
  `market_transactions`, `world_discoveries`, `player_quests`, and
  `economy_rejections`. An identity change can make existing records appear
  disconnected unless a verified ID-preserving import or an explicit,
  complete old-ID-to-new-ID mapping is applied across all nine tables.
- The `/play` local Solo Flight path is distinct from authenticated,
  server-backed progression. It is not proof of account migration or
  authenticated API readiness.

These are source-code observations, not proof that current Railway variables
are correct. Secret values were not inspected or recorded.

## Migration prerequisites

Do not schedule a cutover until every applicable item below is resolved:

1. **Architecture decision:** Confirm whether the requirement is to preserve
   Replit-managed Development while using an independent external Production
   instance. The current documented Replit flow does not provide that as a
   parallel connection; it requires replacing the managed app. If preservation
   remains required, obtain an officially supported non-destructive path before
   proceeding.
2. **External-instance authorization:** The owner confirms access to the
   existing `clerk.niakofa.com` Production instance through an approved secure
   authorization path. Verify safe instance metadata, including environment
   and public domain. Do not infer instance identity from variable names or
   connector labels.
3. **Account/data migration design:** Consult Clerk's current user-import
   documentation and determine which account fields and credential material
   are portable. Confirm whether user IDs can be preserved. Replit explicitly
   states it does not migrate users, credentials, or sessions when deleting the
   managed tenant. Clerk's current migration overview also prohibits migrating
   users from a Development instance to Production. Obtain provider confirmation
   of an allowed path before planning any real-user import. Do not promise
   password continuity or session continuity.
4. **Identity mapping:** If user IDs change, define a privacy-safe,
   access-controlled mapping from each old Clerk subject to the imported
   external subject. Do not infer mappings from email alone. Keep the mapping
   outside source control, chat, and ordinary logs.
5. **Game data migration:** Inventory every user-keyed table and validate a
   migration that preserves profile revisions, credits, progression,
   idempotency/reward events, inventory, world state, quests, and run ownership.
   Validate foreign-key/reference consistency and row counts on an isolated
   staging database first. No Production database write is authorized by this
   plan.
6. **Authentication configuration:** Privately verify the frontend
   publishable key and API publishable/secret pair belong to the same
   external Production instance. Check the issuer/JWKS, the exact WFM
   Production origin, Clerk allowed origins and redirect URLs, and actual
   email delivery. Never place key values in source, logs, reports, or chat.
7. **Test resources:** Have an approved dedicated Production test account and
   confirmed email delivery. Do not create accounts or use real player
   accounts for a smoke test without separate approval.
8. **Recovery readiness:** Take owner-approved backups of applicable game data,
   verify a restore in an isolated environment, and document expected
   authentication outage, user re-verification/password-reset requirements,
   support messaging, and decision owners.
9. **Change authorization:** Obtain separate explicit approval for any Clerk
   app deletion/replacement, secret updates, Railway variable changes, database
   writes, or deployment. This planning document does not grant those
   permissions.

## Preparation status

| Preparation item | Status |
| --- | --- |
| Frontend/API Clerk dependencies and the nine player-ID tables inventoried | **COMPLETE from repository source** |
| Current connected Clerk instance classified | **COMPLETE: Development, not external Production** |
| Non-destructive separate external-instance path | **NOT FOUND in current Replit guidance; owner/platform confirmation still needed** |
| Clerk `CreateUser` digest-import capability | **VERIFIED in docs for supported hasher formats; WFM source digest compatibility is unknown** |
| Replit-managed Development users to separate external Production instance | **NO-GO under the published Development-to-Production restriction; provider confirmation required for this topology** |
| Production publishable/secret-key pairing, origins, redirects, and email | **NOT VERIFIED; no Production values inspected** |
| Representative isolated data backup and restore | **NOT RUN**; no approved migration fixture or restore rehearsal was available |
| Staging identity-import and game-data remap rehearsal | **NOT RUN**; requires a supported external-instance path and approved isolated test data |
| Production account/session smoke test | **NOT RUN** |

No Production database was queried or changed. No live account, key value, or
email was accessed during this preparation.

## Staging validation before any Production cutover

Use a disposable staging identity and isolated staging database only:

1. Import a small, approved test cohort or synthetic accounts through the
   provider-confirmed, allowed **staging-to-staging** migration route, if one is
   available. Keep a reversible mapping record in an approved private system.
   Do not import a managed Development account into Production unless Clerk
   confirms in writing that the restriction does not prohibit this topology.
2. Verify the expected account identifiers and profile ownership on both sides
   without logging credentials, email contents, or profile data.
3. Confirm email verification actually arrives in the test inbox; a successful
   challenge-preparation response is insufficient. Confirm imported email
   verification state is intentionally set and not inferred from the create
   endpoint's default.
4. Exercise sign-in, protected API access, profile load, refresh/session
   behavior, sign-out, and unauthenticated API rejection.
5. Confirm game progress remains attached to the intended imported identity:
   credits, revision, owned items, progression/reward events, world state,
   quests, and open/expired run behavior.
6. Test old or wrong-instance tokens are rejected and cannot read or mutate
   another player's profile.
7. Rehearse restoring the staging database backup and rolling application
   configuration back without connecting to Production.
8. Record only sanitized outcomes, environment, commit, and timestamps.

Do not treat successful staging tests as Production authorization or as proof
of Production email delivery.

The repository's `scripts/player-id-remap-contract.test.mjs` uses only
synthetic IDs and synthetic rows to check mapping invariants against the
current schema. It is a contract test, not a migration fixture, export, import
tool, database script, or evidence that any real WFM data has been migrated.

## Controlled Production cutover, only after separate approval

This is a future procedure, not authorization to execute it:

1. Freeze the migration manifest and confirm the final backup restore test.
2. Announce a maintenance window and define a sign-in/progression freeze so
   data cannot diverge while identities are being mapped.
3. Import users and apply the validated ID mapping to a Production database
   only after explicit approval for those writes. Reconcile row counts and
   integrity checks before opening traffic.
4. Update the frontend and API to the explicitly configured external
   Production instance through approved secret-management interfaces. Preserve
   direct configured-key behavior; never derive keys from request or app
   hostnames.
5. Configure exact API CORS origin and Clerk allowed origins/redirects; verify
   actual email delivery with the dedicated test account.
6. Deploy only after a separate deployment approval. Run the controlled
   Production smoke sequence: sign in, protected API, profile load,
   refresh/session, sign out, then unauthenticated API rejection.
7. Keep public rollout closed until all checks pass and the owner separately
   approves release.

## Rollback and recovery boundary

Deleting the Replit-managed Clerk app is not a reversible toggle. Replit
documents that the managed tenant is removed and that accounts, credentials,
and sessions are not automatically transferred to an external instance.
Restoring the game database alone cannot restore Clerk accounts or sessions.

Before deletion or cutover, obtain and test a provider-supported user export /
import strategy and document how users regain access if credential migration
is unsupported. If no safe identity restoration path exists, stop; do not
delete the managed tenant. After a future cutover, rollback must include a
tested identity-and-database recovery plan, not merely reverting code or
Railway variables.

Recovery sequence if a future approved staging rehearsal fails:

1. Stop before any Production change; keep the managed Development tenant
   intact.
2. Restore the isolated staging database snapshot and old staging auth
   configuration.
3. Reconcile all nine user-ID tables against pre-test counts/checksums and
   verify test identities cannot access another account's rows.
4. Revoke or remove only the explicitly approved disposable staging identities
   through the provider's supported process; do not infer or delete other
   accounts.
5. Record the failure and leave the Production enablement gate blocked.

If the managed tenant is ever deleted after a separately approved migration,
do not describe reverting application keys as a full rollback: the original
tenant's users and sessions will not return from a database restore. Recovery
would require the provider-supported export/import path, validated identity
mapping, and account recovery/re-verification for affected users.

## Current release blockers

| Gate | Status |
| --- | --- |
| Existing managed Development Clerk | Preserve; verified as managed |
| Connected Clerk API instance | Development; not the named external Production instance |
| Separate external Production authorization | **BLOCKED / NOT VERIFIED** |
| Frontend/API key-instance pairing | **BLOCKED / NOT VERIFIED** |
| Clerk Production allowed origins and redirects | **NOT VERIFIED** |
| Production email delivery | **NOT VERIFIED** |
| Dedicated Production test account | **NOT VERIFIED** |
| Protected API/session/profile Production smoke tests | **NOT RUN** |
| Production configuration changes or deployment | None performed |

The current value-safe preflight can check variable presence and public
metadata, but cannot prove external authorization, key-instance pairing, email
delivery, or account/session continuity. Its Production enablement result must
remain `BLOCKED` until the corresponding independent evidence exists.
