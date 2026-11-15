# WFM Production Clerk preflight

## Purpose and safety

This is an offline, read-only structural preflight for the existing external
Clerk Production instance. It does not call Clerk or Railway, modify variables,
enable authentication, deploy services, print key values, compare key values,
or claim that the frontend and API keys belong to the same Clerk instance. The
Railway preflight remains specific to an external Clerk configuration.

## Current authorization snapshot

The Replit workspace check on 2026-10-27 reported Clerk as `managed`, with
dashboard access `requires_personal_pro`. A read-only request through the
connected Clerk integration returned instance metadata identifying a
Development instance, not the external Production instance at
`clerk.niakofa.com`. No independently authorized connection to that external
Production instance was confirmed.

This is workspace-level integration metadata, not a Railway service result. The
Railway preflight cannot query Replit connection authorization and reports
`replitManagedClerkAvailability: NOT_CHECKED_FROM_RAILWAY_SERVICE_CONTEXT`.
Neither a working Replit-managed connection nor its Production environment
authorizes use of the separate external Clerk instance.

## Latest owner-reported Production inputs

On 2026-10-28, the owner reported that the Production frontend API URL is
present, the frontend/API Clerk keys are paired to one instance, allowed
origins/redirects are verified, and email delivery is verified. These are
owner-reported confirmations, not independently verified Railway service-scope
results or an authorized external Clerk connection. No credential values were
read. Keep Production blocked until the authorized connection and controlled
smoke-test evidence are independently established.

Replit's current documentation says switching from a Replit-managed Clerk app
to an external Clerk app requires deleting the managed app first. That deletion
removes the managed tenant; accounts, credentials, and sessions are not
automatically migrated, and Replit has no automated migration path. Therefore,
there is no verified non-destructive second-connection path in this workspace.
The Replit-hosted path below uses the existing managed tenant and does not delete
or replace it. See
[`external-clerk-migration-and-recovery-plan.md`](./external-clerk-migration-and-recovery-plan.md)
for prerequisites and recovery planning.

## Supported Replit-managed Production path

Replit's [Clerk Auth documentation](https://docs.replit.com/features/auth-and-identity/clerk-auth)
supports managed authentication for apps hosted on Replit, not Railway-hosted
backends. Replit also documents that artifacts in one project share the
deployment origin. WFM can therefore keep its existing Clerk SDK, API, and
WebSocket identity checks while publishing the web, `/api`, and `/ws` artifacts
together on Replit. This is the non-destructive path; player data or the managed
Clerk tenant does not need to be deleted.

The current workspace has **no Replit Production deployment**. The current
preview is Development and uses Development Clerk keys. The workspace
configuration now targets the same-origin Replit API/socket path for a future
Production publish; this does not change Railway or publish the app.

For the intended Production origin `https://niakofa.com`, the Replit API and
socket deployment configuration uses exact origin allowlists. If the published
app instead uses Replit's generated domain, the owner must set that exact origin
in both allowlists before opening traffic; wildcard origins are not permitted.
The owner must also attach the intended custom domain to the Replit deployment
if `niakofa.com` is to remain the player-facing URL.

On Replit publish, managed Clerk supplies the Production key set to the
Replit-hosted frontend and services. The frontend continues to pass its
explicitly configured `VITE_CLERK_PUBLISHABLE_KEY` directly. Same-origin API
requests use the Clerk session cookie; the WebSocket still verifies the session
token signature, expiry, and authorized party using the platform-injected
`CLERK_SECRET_KEY`. A separate issuer is enforced for external Clerk and other
production deployments. It is optional only when the socket process explicitly
declares both `WFM_CLERK_AUTH_PROVIDER=replit-managed` and
`WFM_CLERK_BACKEND_HOSTING=replit`; an unrelated Railway process cannot use
that mode to bypass the existing Railway preflight boundary.

Replit publication and owner-side domain assignment are still required. After
publishing, verify the exact published origin, email verification delivery,
sign-in, protected API access, profile load, refresh/session continuity,
sign-out, unauthenticated API rejection, and authenticated socket joining.
Until those checks pass, Production remains unverified and must not be described
as enabled. The separate game staging promotion gate remains independent.

The intended public target is:

| Setting                     | Expected value                                    |
| --------------------------- | ------------------------------------------------- |
| WFM production origin       | `https://niakofa.com`                             |
| WFM route                   | `https://niakofa.com/kids/wfm/`                   |
| Clerk issuer / Frontend API | `https://clerk.niakofa.com`                       |
| Clerk JWKS URL              | `https://clerk.niakofa.com/.well-known/jwks.json` |

The route path is not part of an HTTP origin. The Production API CORS allowlist
must contain exactly the canonical HTTPS origin `https://niakofa.com`, without a
path, credentials, or extra origins.

The application continues to use the explicitly configured
`VITE_CLERK_PUBLISHABLE_KEY` and API `CLERK_PUBLISHABLE_KEY` directly. The
issuer/JWKS inputs below are public preflight metadata; they do not replace
runtime Clerk configuration and are not used to derive or rewrite a key.

## Structural preflight

Run separately in the owner-authorized Railway Production frontend, API, and
socket service contexts. Do not run from the Replit Development environment and
mistake its managed Development keys for Production configuration. These
services have different service-scoped variables, so one invocation must not
be expected to see the variables from another service.

```sh
WFM_CLERK_PREFLIGHT_TARGET=railway-production \
WFM_CLERK_AUTH_PROVIDER=external-clerk \
WFM_CLERK_BACKEND_HOSTING=railway \
WFM_PROD_CLERK_ISSUER=https://clerk.niakofa.com \
WFM_PROD_CLERK_JWKS_URL=https://clerk.niakofa.com/.well-known/jwks.json \
pnpm --filter @workspace/scripts run preflight:clerk:production -- --service frontend

WFM_CLERK_PREFLIGHT_TARGET=railway-production \
WFM_CLERK_AUTH_PROVIDER=external-clerk \
WFM_CLERK_BACKEND_HOSTING=railway \
WFM_PROD_CLERK_ISSUER=https://clerk.niakofa.com \
WFM_PROD_CLERK_JWKS_URL=https://clerk.niakofa.com/.well-known/jwks.json \
pnpm --filter @workspace/scripts run preflight:clerk:production -- --service api

WFM_CLERK_PREFLIGHT_TARGET=railway-production \
WFM_CLERK_AUTH_PROVIDER=external-clerk \
WFM_CLERK_BACKEND_HOSTING=railway \
WFM_PROD_CLERK_ISSUER=https://clerk.niakofa.com \
WFM_PROD_CLERK_JWKS_URL=https://clerk.niakofa.com/.well-known/jwks.json \
pnpm --filter @workspace/scripts run preflight:clerk:production -- --service socket
```

`WFM_CLERK_AUTH_PROVIDER` and `WFM_CLERK_BACKEND_HOSTING` are explicit,
non-secret operator declarations for that process invocation. Accepted provider
values are `external-clerk` and `replit-managed`; the hosting declaration must
be `railway` for these targets. Do not store these declarations as Railway
application variables merely to make the preflight pass. Missing or ambiguous
declarations fail closed before the script inspects authentication-variable
presence. `replit-managed` with `railway` is explicitly reported as
unsupported: Replit-managed Clerk Auth is intended for Replit-hosted apps, not
Railway-hosted backends. This boundary follows Replit's
[Clerk Auth documentation](https://docs.replit.com/features/auth-and-identity/clerk-auth.md);
do not treat managed Development or Production keys as Railway credentials.

An `external-clerk` declaration only allows structural checks to run. It is
still reported as `EXTERNAL_CLERK_DECLARED_NOT_VERIFIED`; it does not prove
external connection authorization, key-instance pairing, session validity, or
Production readiness. Do not infer the provider from key prefixes, issuer
strings, or variable presence. Keep `productionEnablement` blocked.

The frontend invocation checks presence only for:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL` (Production frontend only)

For the Production frontend, the preflight also checks that `VITE_API_BASE_URL`
has an absolute HTTPS URL shape without embedded credentials, query, or
fragment. It reports only `VALID_HTTPS_URL`, `MISSING`, or `INVALID_URL_SHAPE`;
it never emits the URL itself. This does not establish that the endpoint is the
intended service, reachable, or correctly paired with the Production API.
Neither the API service scope nor the staging frontend scope reads this variable.

The API invocation checks presence only for:

- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

The API invocation also checks `API_ALLOWED_ORIGINS` for the exact production
origin. The socket invocation checks presence of `CLERK_SECRET_KEY`,
`CLERK_ISSUER`, and `WING_ALLOWED_ORIGINS`, and checks that the runtime issuer
and allowed origin exactly match the Production target. Its Clerk backend SDK
verifier validates the token signature, expiry, configured issuer, optional
audience, and authorized-party allowlist. All three invocations check the public `WFM_PROD_CLERK_ISSUER` and
`WFM_PROD_CLERK_JWKS_URL` metadata against the documented target. These public
metadata values are command-scoped inputs, not new Railway variables; do not
persist them in Railway. Each invocation emits variable names, presence states,
and match/mismatch results only; it does not echo configured values.

`configurationStatus: PASS` means only that this service's structural checks
passed. Review `overallStatus`, `operatorAction`, and `productionEnablement`
too. The expected
result remains `STRUCTURAL_PASS_MANUAL_GATES_BLOCKED` and `BLOCKED` until
external authorization, key-instance pairing, Clerk allowed origins/redirects,
email delivery, and the controlled smoke test are verified. The report
separately identifies:

- Replit-managed Clerk availability as not observable from Railway.
- Replit-managed Clerk Auth as unsupported for Railway-hosted backends, per
  Replit's documented hosting boundary. A declaration cannot override this.
- The external Production connection as unverified from Railway. Replit's
  documented external-app flow requires deleting the managed app and does not
  migrate accounts, credentials, or sessions; do not use that replacement flow
  while the owner decision is to preserve managed Development.
- Frontend/API key-instance pairing as blocked pending safe metadata
  verification against the authorized external instance.
- Socket issuer/origin checks are structural only and do not prove that the
  configured secret key belongs to the authorized external Clerk instance.
- API CORS origin status separately from Clerk allowed origins and redirects,
  which this Railway process cannot inspect. Email delivery remains a manual
  check.

The script does not accept an environment-variable assertion that can clear
these gates. It cannot authenticate the Replit integration or enable Production.
The provider/hosting declarations are classification inputs only; they never
change the external-connection, pairing, email, account, or smoke-test gates.

`WFM_CLERK_PREFLIGHT_TARGET=railway-production` is an operator assertion, not
proof of which environment supplied the process variables. An explicit
`--service frontend` or `--service api` argument is required so the script does
not read variables outside that service's scope. Exit code `1` means the target
or service was not asserted, or a structural check is missing/mismatched. Exit
code `2` means structural checks passed, but manual authorization and account
verification still block Production enablement. Even with exit code `2`, the
overall status is blocked; the script never reports Production authentication
as ready.

## Manual authorization and controlled smoke test

1. Do not treat the current ready Clerk integration as the external Production
   instance; its authenticated metadata identifies Development. Do not try to
   add credentials by chat or replace this connection.
2. The owner must first obtain an officially supported authorization path that
   preserves the managed Development instance, or explicitly approve the
   destructive managed-to-external replacement only after the separate
   migration/recovery plan is verified. Replit's documented replacement flow
   is in `Users & Auth` → `Configure` → `Advanced` → `Delete Clerk app`; it is
   not a second-connection flow. Do not perform this deletion under the current
   preserve-Development decision.
3. If a supported external Production connection later becomes available,
   verify its safe instance metadata, then rerun the frontend and API
   preflights separately in their Railway Production service contexts. The
   script cannot read Replit integration state, so its external-connection
   gate remains manual. Record owner verification separately using safe
   instance metadata and outcomes.

The automated preflight cannot prove publishable/secret-key instance pairing.
That requires an authorized connection to the already-selected external
Production Clerk instance and verification that the frontend and API use that
same instance. Variable names, key presence, an issuer URL, and public JWKS
material alone do not prove pairing. Do not copy Replit-managed keys, create a
new Clerk application, or paste credentials into chat, source code, logs, or
Git.

Before any live Production check:

1. Obtain explicit owner authorization to inspect the Railway Production auth
   configuration. Do not change Railway variables or deploy as part of the
   preflight.
2. Confirm privately that the frontend publishable key and the API
   publishable/secret pair belong to the intended Production Clerk instance.
   Keep all values inside the approved secret manager or authorized dashboard.
3. Confirm the issuer and JWKS correspond to that instance, and verify the
   exact production origin, redirect origins, and API CORS allowlist.
4. Confirm that an approved, dedicated Production test account already exists.
   Do not create an account or use a real player's account for the check.
5. Confirm actual email verification delivery in the test inbox or Clerk
   delivery logs. A successful challenge-preparation response is not proof that
   an email arrived.
6. Only after the preceding checks and a separately approved test window, run a
   controlled smoke test:
   - sign in through the WFM Production sign-in page;
   - call a protected API endpoint with that session and confirm the expected
     authenticated response;
   - load the test account's profile;
   - refresh/reload and confirm the session and profile behavior;
   - sign out and confirm the session is cleared;
   - make an unauthenticated request to the protected API and confirm rejection.
7. Record only outcomes, timestamps, environment, and safe response statuses.
   Never record tokens, cookies, key values, verification codes, or profile
   contents. Do not enable public Production access or deploy without separate
   authorization.

## Independent game release gate

Passing this Clerk preflight does not clear the WAR FOR MARS staging promotion
gate. Live interrupted-reward claim evidence and physical-device evidence remain
independent requirements; neither is checked or changed by this workflow.

For the review of owner-supplied implementation and promotion proposals, see
[`external-clerk-production-reference-review.md`](./external-clerk-production-reference-review.md).
