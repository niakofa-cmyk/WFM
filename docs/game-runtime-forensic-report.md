# Game runtime and synchronization audit

Date: 2026-10-26 UTC. Scope: the development working tree, public browser
journey, simulation parity, and previously observed protected-staging accounts.
**This is not Production readiness or a completed staging promotion gate.**

## Findings and fixes

| Area | Finding | Outcome |
| --- | --- | --- |
| Profile freshness | Account profiles refreshed after local events only; another session's writes could remain invisible indefinitely. | Added visible-page polling every 30 seconds, focus/visibility/connectivity revalidation, serialized requests, superseded-response rejection, and disposal protection. Refreshing is suspended during flights and account mutations. |
| Account switching | A direct switch between signed-in users could reuse the mounted game component. | Account entry is now keyed by Clerk user identity, remounting game state and clearing its query cache on departure. Full live inventory/history isolation remains unverified. |
| Graphics context loss | A lost WebGL context had no explicit flight failure path. | Stop animation and engine sound, show an actionable failure, return to setup, and allow relaunch without submitting a reward. Account flights also leave their socket/run view safely. |
| Graphics cleanup | Flight teardown did not explicitly silence engine sound. | Cleanup now silences the engine and removes the context-loss listener. |
| Production Clerk | Earlier live inspection found a generated Clerk hostname failing TLS certificate validation; the explicit configured-key fix exists in staging source. | Production was not changed. This audit does not certify Production login. |

## Verification

- Baseline full-workspace typecheck, test suite and builds: PASS (70 API tests,
  29 game tests).
- After the fixes: frontend typecheck/build PASS; 32 game tests PASS, including
  refresh burst coalescing, rejecting stale responses, disposal/account-view
  boundaries, and offline recovery.
- Six Node/Chromium simulation scenarios: every recorded frame identical
  (61,679 frame states total). This is replay consistency, not network certification.
- Public browser tests with packaged Chromium and explicit software WebGL:
  landing, rendered sign-up form, actual running controls, exit, forced context
  loss, zero reward requests during context loss, and relaunch PASS.
- Full rendered Practice lifecycle: PASS in 56.4 seconds to a real outcome,
  acknowledgement through the Debrief button, displayed result, and released
  controls. No uncaught page exceptions occurred. Together with the four public
  checks above, all five targeted browser checks passed.
- The first full-flight test incorrectly waited for the result panel without
  acknowledging Arena's Debrief button. Its failure snapshot already showed a
  finished match, not a frozen simulation. Correcting that test interaction
  produced the passing lifecycle result without another application change.
- The remote testing browser had its GPU disabled. It verified the actionable
  WebGL2 error, exit/relaunch, and phone-sized layout without horizontal
  overflow. It saw no uncaught page exceptions or failed first-party responses.
  That environment could not certify scene rendering or controls.
- A first attempt using the downloaded bare Chromium executable failed before
  application launch because `libcups.so.2` was missing. Reusing the packaged
  system Chromium resolved this test-environment issue without changing app
  dependencies.

Software rendering proves functional execution only, not physical-device frame
rate, GPU driver compatibility, thermals, or mobile playability.

## Previously observed live staging account checks

Two existing approved Development accounts were used; no account was created.
Fresh client-trust codes were supplied privately and submitted once.

| Check | First account | Second account |
| --- | --- | --- |
| Authenticated profile | HTTP 200, 130 credits | HTTP 200, 90 credits |
| Reload | HTTP 200, 130 credits | HTTP 200, 90 credits |
| After sign-out | HTTP 401 | HTTP 401 |

The first account's 130-credit balance survived a fresh browser sign-in after
its earlier accepted staging reward. The second account retained its distinct
90-credit balance. No flights, purchases or progression writes were performed
during those session checks, and both browsers were closed.

These observations establish distinct observed credit balances and persistence
across a fresh sign-in. They do **not** establish simultaneous same-account
cross-device sync, campaign/inventory/history isolation, or the behavior of the
new working-tree refresh changes on a deployed staging revision.

## Remaining release restrictions

- Deploy and verify the changed frontend on protected staging before promotion.
- Verify a live write becomes visible in another independent signed-in session.
- Complete account isolation across progression, inventory, history and rejected
  cross-account writes; the balance comparison alone is insufficient.
- Complete deployed multiplayer interruption/reconnect/restart and ten-client
  evidence. Synthetic impairment tests are not equivalent.
- Reconcile the report's old Replit invite-only deployment requirement with the
  existing protected Railway gateway; do not silently change a false flag.
- Sign-up form rendering is tested; creating and verifying a new account is not.
- Do not promote to Production or mark the overall staging gate PASS from this audit.

The local staging histories were merged without resetting either branch.
No Production deploy, key change, account creation, or Production data mutation
was performed.
