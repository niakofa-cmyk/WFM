# WFM Production Clerk preflight

## Purpose and safety

This is an offline, read-only structural preflight for the existing external
Clerk Production instance. It does not call Clerk or Railway, modify variables,
enable authentication, deploy services, print key values, compare key values,
or claim that the frontend and API keys belong to the same Clerk instance.

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

Run separately in the owner-authorized Railway Production app and API service
contexts. Do not run from the Replit Development environment and mistake its
managed Development keys for Production configuration. The app and API have
different service-scoped variables, so one invocation must not be expected to
see both sets of keys.

```sh
WFM_CLERK_PREFLIGHT_TARGET=railway-production \
WFM_PROD_CLERK_ISSUER=https://clerk.niakofa.com \
WFM_PROD_CLERK_JWKS_URL=https://clerk.niakofa.com/.well-known/jwks.json \
pnpm --filter @workspace/scripts run preflight:clerk:production -- --service frontend

WFM_CLERK_PREFLIGHT_TARGET=railway-production \
WFM_PROD_CLERK_ISSUER=https://clerk.niakofa.com \
WFM_PROD_CLERK_JWKS_URL=https://clerk.niakofa.com/.well-known/jwks.json \
pnpm --filter @workspace/scripts run preflight:clerk:production -- --service api
```

The frontend invocation checks presence only for:

- `VITE_CLERK_PUBLISHABLE_KEY`

The API invocation checks presence only for:

- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

The API invocation also checks `API_ALLOWED_ORIGINS` for the exact production
origin. Both invocations check the public `WFM_PROD_CLERK_ISSUER` and
`WFM_PROD_CLERK_JWKS_URL` metadata against the documented target. These public
metadata values are command-scoped inputs, not new Railway variables; do not
persist them in Railway. Each invocation emits variable names, presence states,
and match/mismatch results only; it does not echo configured values. Both
structural reports must pass before the manual checks below.

`WFM_CLERK_PREFLIGHT_TARGET=railway-production` is an operator assertion, not
proof of which environment supplied the process variables. An explicit
`--service frontend` or `--service api` argument is required so the script does
not read variables outside that service's scope. Exit code `1` means the target
or service was not asserted, or a structural check is missing/mismatched. Exit
code `2` means structural checks passed, but manual authorization and account
verification still block Production enablement. The script never reports
Production authentication as ready.

## Manual authorization and controlled smoke test

The automated preflight cannot prove publishable/secret-key instance pairing.
That requires an authorized connection to the already-selected external
Production Clerk instance and verification that the frontend and API use that
same instance. Variable names, key presence, an issuer URL, and public JWKS
material alone do not prove pairing. Do not copy Replit-managed keys, create a
new Clerk application, or paste credentials into chat, source code, logs, or
Git.

Before any live Production check:

1. Obtain explicit owner authorization to inspect the existing external Clerk
   Production instance and the Railway Production auth configuration. Do not
   change Railway variables or deploy as part of the preflight.
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
