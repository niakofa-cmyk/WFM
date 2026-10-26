# WFM authenticated staging flight — BLOCKED

Date: October 25, 2026 (America/Chicago).
Latest browser attempt ended: `2026-10-26T03:36:17.876Z`.

## Tested deployment

- Target: `https://wfm-app-staging-staging.up.railway.app/`
- Branch: `staging`
- Frontend/gateway and API source: `09628b2c6721b722984651757800d45f5909e8fe`
- Frontend/gateway deployment: `96fda5a5-22d3-4b0b-9e61-3b05e520790d` — `SUCCESS`
- API deployment: `f2bda8ae-f639-4b41-8911-5efe9f948f5c` — `SUCCESS`
- Socket source remains `b9be83a62de348293157a8e63f02a65988506649`.
- Driver: project-side Playwright with headless Chromium. This is not a
  physical-phone, real-player multiplayer, or Production certification.

## Repairs completed

1. Real browser gate submission initially sent `Origin: null` because the
   access page used `Referrer-Policy: no-referrer`. Only access-form pages now
   use `same-origin`; untrusted/null origins remain rejected. The corrected
   browser form returns the expected 303.
2. The frontend's internal hostname-derived key helper selected
   `clerk.wfm-app-staging-staging.up.railway.app` instead of the configured
   instance, causing TLS failure and a blank sign-in page. The frontend now
   uses the configured key directly, without changing its value.

## Verification

| Check | Observed result |
| --- | --- |
| Previously recorded gateway tests | 7 passed, including retained null-Origin rejection |
| Previously recorded frontend tests | 21 passed: 3 auth configuration and 18 existing game tests |
| Previously recorded API and frontend typechecks/builds | Passed; not rerun for this configuration-only browser diagnostic |
| Previously recorded GitHub push Workspace quality | Passed for the frontend repair source `454bd3a`; not a live-authentication certification |
| Local frontend restart/public landing screenshot | Passed |
| Railway frontend/gateway deployment | Successful |
| Browser access gate after repairs | 303 redirect after normal form submission |
| Active Clerk Frontend API host | `precious-kangaroo-7682.clerk.accounts.dev` |
| Sign-in form | Renders email-identifier and password fields with a Development-mode indicator |
| Frontend/API Clerk instance pairing | Verified: frontend and API return the same one-key JWKS set; compared in memory without printing key material |
| Selected Clerk application ID association | Not directly verified |
| Staging secret presence | `WFM_STAGING_ACCESS_CODE`, `WFM_STAGING_TEST_EMAIL`, and `WFM_STAGING_TEST_PASSWORD` are set in Development; values were not read |
| Connected Clerk API integration | Ready; read-only `GET /v1/instance` returned Development |
| Connected API instance correlation | Verified by matching the public JWKS sets; its instance metadata reports Development. Its allowed origins and subdomains are empty |
| Replit-managed Clerk dashboard access | `requires_personal_pro`; no dashboard action was performed |
| Existing-user lookup | One exact existing user matched; current address is verified. Email and user ID were not returned or recorded |
| Test alias | Not attached; it is not already present on the matched user |
| Clerk write authorization | `CLERK_SECRET_KEY` is present (value not read); `CLERK_BAPI_SCOPES` is unset, so write permission is not established |
| Alias write | Not attempted because write authorization could not be verified |
| Browser-driver syntax check | Passed after correcting session wait and normal two-step password handling |
| Sign-in diagnostics | Six form-start diagnostic runs; the latest stopped at Clerk's new-device email verification screen |
| Latest Clerk state | “Check your email to continue to WFM”; a verification code is required |
| Staging email test-alias check | Not a `+clerk_test` alias; only a yes/no match was evaluated, and the address was not printed |
| Clerk test-code applicability | Clerk's fixed-code test flow applies to `+clerk_test` addresses, not this current address |
| Verification code | Not accessed or submitted |
| Authenticated profile request | No request to `/api/game/profile` was observed; the latest browser stopped at the email-verification challenge |
| Six-minute Strike, server replay claim, reward | Not run |
| Reload/sign-out persistence and duplicate claim | Not run |
| Four campaign sorties | Not run |

The approved test account is Development-only. Credentials were submitted only
after the staging form displayed Development mode. The owner confirmed that the
saved account belongs to the active staging Development instance. The latest
run stopped on a new-device email-verification challenge. The code was not
accessed or submitted. No Clerk users were created, no authenticated
profile/gameplay writes were observed, and no credentials, tokens, cookies,
traces, or stored login-state files were published.

The earlier `profile_200_bearer_not_observed` results were inconclusive. The
temporary browser driver was corrected to require an active Clerk session before
navigating away and to handle the separate “Enter your password” screen. After
the secure password form was confirmed, Clerk presented the email challenge.
This does not establish an authenticated session, API key mismatch, or API token
rejection. Further automated password attempts are stopped.

The saved staging email is not a `+clerk_test` alias. Clerk documents that its
fixed-code verification path is for that test-email pattern:
[Clerk test emails and phones](https://clerk.com/docs/guides/development/testing/test-emails-and-phones).
The code shown in the separate Production settings was not used for this
Development sign-in. The connected Clerk API's one-key JWKS set exactly matched
the WFM staging frontend's public JWKS set, confirming that both use the same
Development instance; no key material was logged. A targeted read-only lookup
found one existing user for the supplied account address, and that address is
verified. The test alias is not attached. No email or user ID was returned or
recorded.

No alias write was attempted: `CLERK_BAPI_SCOPES` is unset, so this workflow
cannot verify that the API connection is authorized to modify user email
addresses. `CLERK_SECRET_KEY` is present, but its value was not read. The
Replit-managed Clerk dashboard still reports `requires_personal_pro`.

The earlier testing-agent evaluation returned **unable**, not a successful
flight. The latest project-side browser attempts also did not complete the
journey. The machine-readable summary is
[`staging-authenticated-flight-evidence.json`](staging-authenticated-flight-evidence.json).

## Remaining verification work

1. Establish an authorized write path for adding an email address to the
   existing user on the verified Development instance. The current
   `CLERK_BAPI_SCOPES` is unset, so the required write permission has not been
   established. Do not bypass this check or share secret values in chat.
2. Once write authorization is established, attach the `+clerk_test` alias to
   the same existing user without marking it verified administratively; use
   Clerk's documented test verification flow.
3. Update `WFM_STAGING_TEST_EMAIL` in the staging environment through the
   secure configuration flow after the alias is verified.
4. Resume the staging sign-in with the test address and complete the
   authenticated profile check. Do not ask the owner to reconfirm the account
   association already confirmed above.
5. Once sign-in is genuinely active, verify that the app sends a Bearer-authenticated
   profile request and receives HTTP 200. Only then can frontend/API instance
   compatibility be exercised, rather than inferred from variable presence.
6. Complete the normal six-minute Strike, server-owned claim, and persistence
   checks without manipulating game time, replay data, or progression.

Do not create another Clerk application, copy managed Replit keys from a
different tenant, enable a proxy, weaken origin validation, or change
Production keys. Existing staging access/API/socket routing remains unchanged.

## Release boundary

No Production service, key, database, or deployment was changed. No separate
Replit deployment was published. The PR remains blocked:

- Staging promotion gate: `Verify staging evidence and tested source`.
- PR Workspace quality: `Verify live staging evidence`.

These failures were not bypassed. Task completion and release readiness remain
pending genuine sign-in, profile, flight, reward, and persistence evidence.
