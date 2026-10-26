# WFM authenticated staging flight — BLOCKED

Date: October 25, 2026 (America/Chicago).
Latest browser attempt ended: `2026-10-26T03:13:43.104Z`.

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
| Clerk application association and frontend/API key pairing | Not independently verified; variable names are present, but credential values were not inspected |
| Approved sign-in attempts | Two attempts reached form submission; neither established a verified authenticated game session |
| Authenticated profile request | No request to `/api/game/profile` was observed; the browser ended on the public landing page |
| Six-minute Strike, server replay claim, reward | Not run |
| Reload/sign-out persistence and duplicate claim | Not run |
| Four campaign sorties | Not run |

The approved test account is Development-only. Credentials were submitted only
after the staging form displayed Development mode. After the first attempt, the
owner confirmed that the saved account belongs to the active staging Development
instance; one controlled retry produced the same stopping condition. No further
password attempts were made. No Clerk users were created, no authenticated
profile/gameplay writes were observed, and no credentials, tokens, cookies,
traces, or stored login-state files were published.

The driver logged `profile_200_bearer_not_observed`. This is not evidence that the
password was rejected, that the API rejected a token, or that the key pair is
mismatched: no authenticated profile request reached that part of the test. The
driver currently navigates to the root after a fixed post-submit delay without
first confirming an active Clerk session. That diagnostic limitation must be
removed before another credentialed run, so a redirect/session-completion race
can be distinguished from a Clerk challenge or rejection.

The earlier testing-agent evaluation returned **unable**, not a successful
flight. The latest project-side browser attempts also did not complete the
journey. The machine-readable summary is
[`staging-authenticated-flight-evidence.json`](staging-authenticated-flight-evidence.json).

## Remaining verification work

1. Change the browser driver to wait for a confirmed active Clerk session or a
   specific, safely classified sign-in error/challenge before navigating away
   from the form. Do not log response bodies, credentials, or tokens.
2. Obtain approval before making another password submission. Do not ask the
   owner to reconfirm the account association already confirmed above.
3. Once sign-in is genuinely active, verify that the app sends a Bearer-authenticated
   profile request and receives HTTP 200. Only then can frontend/API instance
   compatibility be exercised, rather than inferred from variable presence.
4. Complete the normal six-minute Strike, server-owned claim, and persistence
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
