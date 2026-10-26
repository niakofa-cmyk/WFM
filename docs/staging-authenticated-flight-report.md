# WFM authenticated staging flight — BLOCKED

Date: October 25, 2026 (America/Chicago).
Latest live evidence recorded: `2026-10-26T04:43:56Z`.

**Authentication now passes, but the rewarded-flight journey remains blocked.**
The approved existing Development account signed in, loaded its server profile,
and completed a normal Strike. Its replay claim returned HTTP 400:
`The replay contains control frames after the match ended.`
Credits remained unchanged. This is not a successful reward/persistence test.

## Tested deployment

- Target: `https://wfm-app-staging-staging.up.railway.app/`
- Branch: `staging`
- Frontend/gateway and API source: `09628b2c6721b722984651757800d45f5909e8fe`
- Frontend/gateway deployment: `96fda5a5-22d3-4b0b-9e61-3b05e520790d` — `SUCCESS`
- API deployment: `f2bda8ae-f639-4b41-8911-5efe9f948f5c` — `SUCCESS`
- Socket source remains `b9be83a62de348293157a8e63f02a65988506649`.
- Railway's read-only deployment inventory and commit metadata were rechecked
  during this run; frontend, API, and socket deployments remain successful.
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
| Previously recorded API and frontend typechecks/builds | Passed; not rerun for this browser-and-documentation-only verification |
| Previously recorded GitHub push Workspace quality | Passed for the frontend repair source `454bd3a`; not a live-authentication certification |
| Previously recorded local frontend restart/public landing screenshot | Passed |
| Railway frontend/gateway deployment | Successful |
| Browser access gate after repairs | 303 redirect after normal form submission |
| Active Clerk Frontend API host | `precious-kangaroo-7682.clerk.accounts.dev` |
| Sign-in form | Renders email-identifier and password fields with a Development-mode indicator |
| Frontend/API Clerk instance pairing | Verified: frontend and API return the same one-key JWKS set; compared in memory without printing key material |
| Selected Clerk application ID association | Not directly verified |
| Staging secret presence | `WFM_STAGING_ACCESS_CODE`, `WFM_STAGING_TEST_EMAIL`, and `WFM_STAGING_TEST_PASSWORD` are set in Development; consumed only in the local driver, never displayed |
| Connected Clerk API integration | Ready; read-only `GET /v1/instance` returned Development |
| Connected API instance correlation | Verified by matching the public JWKS sets; its instance metadata reports Development. Its allowed origins and subdomains are empty |
| Replit-managed Clerk dashboard access | `requires_personal_pro`; no dashboard action was performed |
| Existing-user lookup | One exact existing user matched; current address is verified. Email and user ID were not returned or recorded |
| Test alias | Not attached; it is not already present on the matched user |
| Clerk write authorization | Owner reported the Development connection update; `CLERK_BAPI_SCOPES` remains unset and the connector exposes no permission metadata |
| Alias write | Not attempted because write authorization could not be verified |
| Browser-driver syntax check | Passed after correcting session wait and normal two-step password handling |
| Sign-in diagnostics | Earlier diagnostics plus an authorized existing-account retry; correcting the combined email/password form and Continue button reached the verification challenge |
| Latest Clerk state | Active authenticated Development session after the approved email-verification challenge |
| Staging email test-alias check | Not a `+clerk_test` alias; only a yes/no match was evaluated, and the address was not printed |
| Clerk test-code applicability | Clerk's fixed-code test flow applies to `+clerk_test` addresses, not this current address |
| Verification code | Supplied through a temporary Replit Secret and submitted to the original waiting browser; value not printed or persisted to workspace files |
| Latest browser handoff | Passed: the private Unix socket delivered the code to the original browser-owning process |
| Replacement handoff self-test | Passed using synthetic input, a private Unix socket, and the original browser-owning process; no real credentials or public listener |
| Authenticated profile request | HTTP 200 with Bearer authorization; no profile-unavailable screen; online-play button visible |
| Server-issued Strike | HTTP 201; `skirmish`, `strike`, Mandjet, refit 0, no shield upgrade |
| Graphics | Actual rendered 3D battle inspected; active WebGL2 context, not lost; canvas 1280 × 800 |
| Normal match progression | Clock advanced from 5:59 to 5:54 and through 4:16, 3:15, 2:15, 1:14, and 0:15; no clock manipulation |
| Flight completion | Strike ended through enemy-wing depletion, before its six-minute timer limit; “Disc held” debrief showed 5 kills and 2 relays |
| Recorded replay | 20,743 input frames; normal UI recording, not modified or truncated |
| Server replay claim | HTTP 400: `The replay contains control frames after the match ended.` |
| Rejected-claim safety | Two exact diagnostic retries also returned HTTP 400; fresh authenticated profile read returned HTTP 200 and unchanged 90 credits |
| Accepted reward / accepted-claim idempotency | Not verified; no claim was accepted and no reward was granted |
| Local engine-parity diagnostic | No result: an EPIPE error terminated the temporary browser driver during diagnostic handoff |
| Subsequent synthetic driver checks | Guarded child-process helper survived an early exit; the ES-module parity harness passed a 12-frame synthetic smoke test, not the live replay |
| Reload/sign-out persistence | Not run after the driver failure |
| Four campaign sorties | Not run |

## Method and scope

The approved account is Development-only. One fresh sign-in used the existing
securely stored credentials and a newly supplied verification code. The private
in-process handoff succeeded; the earlier cross-client handoff failure is
historical, not the current authentication blocker. No alias change or new
Clerk user/application was needed.

The driver entered Arcade Skirmish, selected STRIKE 6:00, and used ordinary
keyboard movement, firing, targeting, evade, and ability inputs. The automated
control segment ran for 316 wall-clock seconds across 31 control cycles, after
the match had already started. The battle ran at its normal pace and ended
through its combat objective; this was not a claim that the clock reached 0:00.
The driver clicked Debrief and let the app submit its normal recorded replay.

The server and client disagree about the replay's terminal frame. The exact
root cause is **not established**. Do not infer a missing credential, truncate
the replay to force acceptance, or weaken terminal-state validation. The
read-only local parity diagnostic produced no comparison because its temporary
driver failed with EPIPE. The browser session ended before reload/sign-out
verification. No further sign-in or reward retries were started.

Afterward, a guarded helper survived a synthetic child-process early exit, and
the parity harness ran successfully in ES-module form with 12 synthetic idle
frames. Those checks did not use the lost in-memory live replay and do not
establish its root cause or repair the application's reward path.

The server issued a normal staging run, which saves the selected configuration.
No reward credit or campaign completion was granted. No Production data was
written. No credentials, tokens, cookies, traces, or stored login-state files
were published. The owner should remove the temporary
`WFM_STAGING_VERIFICATION_CODE` Secret.

The earlier testing-agent evaluation returned **unable**. This report's new
authentication and combat evidence comes from the project-side browser, not a
second testing-agent pass. The machine-readable summary is
[`staging-authenticated-flight-evidence.json`](staging-authenticated-flight-evidence.json).

## Remaining verification work

1. Use the synthetically checked failure-isolated helper for the next
   diagnostic. Apply the same protection to the private browser IPC listener;
   helper-process/IPC errors must not terminate the browser owner.
2. Diagnose the client-recording/server-adjudication terminal-frame disagreement
   against the pinned deployed source, retaining only non-sensitive simulation
   configuration and replay inputs in memory. Capture the original claim error
   on its first response rather than requiring diagnostic retries.
3. Add a focused regression before any application fix. Preserve server-owned
   adjudication, input validation, frame limits, and reward protections.
4. After a tested fix reaches isolated staging with authorization, complete a
   normal Strike with an accepted claim; freeze its initial accepted balance,
   verify an exact duplicate does not add credits, then verify reload and sign-out.
5. Keep four campaign sorties, account isolation/cross-device persistence,
   real-network multiplayer, physical phones, and Production sign-in explicitly
   separate from this one-account staging result.

Do not create another Clerk application, copy managed Replit keys from a
different tenant, enable a proxy, weaken origin validation, or change
Production keys. Existing staging access/API/socket routing remains unchanged.

## Release boundary

No application code, environment variables, or deployments were changed in this
run. No separate Replit deployment was published. No Production service, key, or
database was changed. The existing broader release gates were not modified:

- Staging promotion gate: `Verify staging evidence and tested source`.
- PR Workspace quality: `Verify live staging evidence`.

GitHub gate statuses were not freshly queried in this run. No gate was bypassed.
Task completion remains blocked by replay rejection; accepted reward,
idempotency, and reload/sign-out evidence are still missing. Production
authentication and release readiness remain unverified.
