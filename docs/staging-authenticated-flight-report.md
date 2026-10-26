# WFM authenticated staging flight — BLOCKED

Date: October 25, 2026 (America/Chicago).

## Tested deployment

- Target: `https://wfm-app-staging-staging.up.railway.app/`
- Branch: `staging`
- Frontend/gateway source: `454bd3acf3e33e7770cee766f73927fc8a8bfe6c`
- Railway deployment: `5a1d3b09-82eb-43bd-bb2b-61004a7d8d85`
- API/socket source remains `b9be83a62de348293157a8e63f02a65988506649`.
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
| Gateway tests | 7 passed, including retained null-Origin rejection |
| Frontend tests | 21 passed: 3 auth configuration and 18 existing game tests |
| API and frontend typechecks/builds | Passed |
| GitHub push Workspace quality, tested source above | Passed |
| Local frontend restart/public landing screenshot | Passed |
| Railway frontend/gateway deployment | Successful |
| Browser access gate after repairs | 303 redirect after normal form submission |
| Clerk script host after frontend repair | `clerk.niakofa.com`, not the invented Railway-derived host |
| Sign-in form | No email field; Clerk reports a Production-key/domain restriction |
| Public Clerk instance/environment metadata | Not returned; exact instance and frontend/API key pairing unverified |
| Authenticated profile request | Not reached |
| Six-minute Strike, server replay claim, reward | Not run |
| Reload/sign-out persistence and duplicate claim | Not run |
| Four campaign sorties | Not run |

The approved test account is Development-only. Its email and password were
not submitted to the Production Clerk host. No Clerk users were created, no
authenticated profile/gameplay writes occurred, and no credentials, tokens,
cookies, traces, or stored login-state files were published.

The existing testing agent evaluated the supplied results and returned
**unable**, not a successful flight. The machine-readable summary is
[`staging-authenticated-flight-evidence.json`](staging-authenticated-flight-evidence.json).

## Required owner action

Use **Railway → `wfm-staging` → `staging`**, not the Production environment:

1. On `wfm-app-staging`, configure `VITE_CLERK_PUBLISHABLE_KEY` from the
   **Development instance of the existing external Clerk application that
   owns the approved test account**.
2. On `wfm-api-staging`, confirm `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
   belong to that same Development instance. Preserve them if already correct.
3. Deploy the changed staging configuration. The frontend key is a build-time
   setting, so changing it requires a frontend rebuild.
4. Confirm that the staging sign-in form renders without a Production-key
   domain restriction. The securely stored test account can then be used to
   resume the uncompleted flight.

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
