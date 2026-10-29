# WAR FOR MARS — Game improvement record

This is the dated project record for material game improvements and verification
milestones. It complements source history and the detailed staging evidence;
it does not replace either one. Keep secret values, account identifiers, and
unverified claims out of this document.

## 2026-10-29 — Session verification and promotion automation review

Reviewed the supplied in-memory session-cache, traffic-based TTL optimizer, and
staging-to-main shell script proposals against the current WFM architecture.
No custom bearer-token cache or load-adaptive verification window was added.
The API continues to use Clerk Express middleware with its explicitly configured
publishable key; socket handshakes continue to use Clerk Backend `verifyToken`
with the configured issuer, audience, and authorized-party policy. Authentication
remains based on SDK cryptographic validation, not cached user-ID claims.

The proposed cache would retain raw JWTs and verified subjects outside Clerk's
verification path and could continue accepting a token after its claims or
session status should be rechecked. Raising its TTL under load makes that window
longer, not safer. The installed Clerk backend already maintains its own
instance-scoped remote JWKS cache; no WFM-level per-token cache is justified
without measured latency or rate-limit evidence.

The proposed `promote-to-main.sh` is also not adopted: it checks out `main`,
pulls, merges `staging`, and leaves promotion state in the local checkout rather
than using the repository's pull-request evidence gate. The existing
`.github/workflows/staging-promotion.yml` remains the controlled path and
requires the current staging evidence verifier to pass before a promotion PR
can proceed.

Added synthetic API middleware regressions for expired JWTs and client-supplied
`x-clerk-user-id` spoofing. These supplement the existing valid-signature,
invalid-signature, host-independence, and anonymous request checks. No live Clerk
credentials or user accounts are involved.

No production or staging settings, secrets, database records, deployments, or
branches were changed. The separate live interrupted/expired reward-denial gate
remains pending.

Verification for this update: the workspace-quality workflow passed typechecks,
all 195 workspace tests, and production builds. Focused API/Socket auth tests
passed 13/13; API typecheck and build passed; staging-promotion verifier tests
passed 11/11; `git diff --check` passed. No dependency files changed, so a
frozen-lockfile install was not rerun.

## 2026-10-29 — Reward-claim proposal review

Reviewed the proposed second reward gate and periodic stale-run cleanup worker
against WFM's existing progression flow. Neither was added. Authenticated routes
derive the player ID from Clerk's verified request context; `claimPlayerStrike`
loads and locks a server-issued run scoped to that player, checks its status,
expiry and profile revision, validates the replay, computes rewards on the
server, and commits profile, event, and run updates in one transaction.

WFM's run states are `open`, `claimed`, and `expired`; online room interruption
is a separate socket lifecycle and cannot be converted into a Strike reward
claim. Expiration is enforced when a claim is attempted, so a periodic worker
would add database writes and per-replica scheduling without closing a reward
authorization gap. The proposed gate instead trusts a client-settable identity
header and client-supplied loot, duplicates the existing routes, assumes a
different schema/status model, and does not make its separate writes atomic.

Added a route regression that also supplies a forged `x-verified-player-id`
header and still expects unauthenticated reward access to be rejected. Existing
tests already cover expired-run denial with no profile or reward-event change,
duplicate and altered replay claims, and an interrupted online room remaining
separate from Strike claims. These are local test results only. No live claim
was sent; the staging interrupted/expired reward-denial evidence gate remains
**PENDING**.

Verification for this addition: the unauthenticated progression/Strike route
tests passed 2/2 and the API typecheck passed. The database-backed progression
suite was not run in this check: removing `DATABASE_URL` causes the shared DB
module to fail at import before tests start. No database request or mutation
occurred. `git diff --check` passed.

## 2026-10-28 — End-to-end readiness and Android-only scope reconciliation

### Workspace verification

On local `staging` source commit
`f60a00c5efb0b2a9fa1fec8d90d048f0453fda3d`, the following passed:

- `pnpm install --frozen-lockfile`
- Workspace typecheck
- All workspace tests: 33 scripts, 88 API, and 50 game tests (171 total)
- Workspace production builds

This is local workspace evidence. It does not say those changes were deployed to
Railway staging or Production. The detailed release status remains in
`STAGING-TEST-REPORT.md` and `STAGING-TEST-RESULTS.json`.

### Established staging behavior

The existing staging record establishes a normal accepted reward, idempotent
duplicate-claim handling, and profile persistence after reload. It also records
same-account profile synchronization across independent browser contexts,
multi-client room completion and reconnect, and a two-pilot socket restart with
restart notices and fresh-room recovery. These are scoped passes; they do not
substitute for the still-pending interrupted/expired claim-denial test or the
physical cross-device profile-sync evidence that was pending at the original
audit checkpoint. Later owner-reported two-phone evidence is recorded below.

### Physical-device scope and evidence

The owner approved **Android Chrome only** as the required physical-device
scope; iPhone/Safari is not a release requirement. The REVVL 8 / Android 16 /
Chrome 156 staging report reached 360 active seconds and met the recorded
duration and frame-pacing targets; memory stability remains inconclusive.
The owner-reported Android sign-in/out, layout/scroll, local no-reward flight,
and listed touch-control checks are supplemental evidence; they are not an
independently captured reward-ledger test. A later physical two-phone staging
match and profile-sync retest is recorded below.

Cross-device profile synchronization is a separate release check. It was
pending at the original audit checkpoint and later received an owner-reported
physical-device PASS; broader account-isolation checks remain separate.

### Remaining release and Production blockers

- A live staging interrupted/expired reward claim has not been submitted or
  verified. Local expiry-denial tests pass, and the valid duplicate-claim test
  is separate evidence.
- Android physical certification remains partial: the owner-reported two-pilot
  controls and listed local-flight control/lifecycle checks pass, but memory
  stability is inconclusive and thermal status was not supplied.
- Production Clerk key-instance pairing, email delivery, an approved dedicated
  Production test account, and protected API/session smoke tests remain
  unverified. Production readiness remains **NOT CLAIMED**.
- The top-level staging release gate remains **PENDING**. Historical live
  staging checks span multiple deployed source revisions; current local
  workspace validation is not a substitute for deployment-specific evidence.

No Production settings, secrets, player data, or deployments were changed for
this record.

### Release-policy decision

On 2026-10-28, the owner confirmed that Replit invite-only deployment is not a
WFM launch requirement. The promotion check will stop treating that legacy
property as a required environment assertion. This does not change the
protected Railway staging gateway, the private API/socket boundary, or any
other pending release gate.

## 2026-10-28 — Production profile authentication diagnosis

The owner reported that the Niakofa Production site accepted sign-in and the
email verification code, then showed `PLAYER PROFILE UNAVAILABLE` with HTTP
`401 authentication_required`. No password or verification code was used by the
agent.

Read-only Railway deployment metadata showed both the Production frontend and
API running successfully from `main` at commit
`3ecff671fdadaa041599d3c3b475b83bc810ec36`. The frontend deployment completed
at 2026-10-25 22:15 UTC; the API deployment completed at 20:18 UTC. The exact
Production source revision is therefore known.

The live frontend JavaScript bundle does not contain the bearer authorization
transport present in the current staging source/build. The Production `main`
source at the deployed commit lacks the frontend `ApiAuthBridge`; the staging
branch contains it. This is the leading explanation for the profile API's
`authentication_required` response because the API is cross-origin. It is not
proof of the only cause: Production frontend/API Clerk key-instance pairing
remains unverified. The passing local auth test uses a synthetic token and does
not verify Production credentials.

The owner then confirmed that opening the direct Production URL in Chrome still
shows `PLAYER PROFILE UNAVAILABLE` with HTTP `401 authentication_required`.
A fresh unauthenticated fetch of both `/kids/wfm` and `/kids/wfm/` returned
HTTP 200, resolving to `/kids/wfm/`; the WAR FOR MARS HTML shell and its current
JavaScript asset also returned HTTP 200. The public bundle contains Clerk's
`getToken` code but no case-insensitive `Authorization` or `Bearer` literal.
This confirms that static delivery works and further supports the missing
frontend bridge as the leading cause; it does not establish a visual render or
prove Production key-instance pairing. `origin/main` has the shared bearer
transport helper but does not mount `ApiAuthBridge`; current local staging does.

The staging source now has focused regression coverage for bridge mounting,
Bearer token transport, signed-out requests, and explicit authorization-header
preservation. Full local workspace typecheck and builds passed; all 189 tests
passed (47 scripts, 88 API, 54 game), including the four new auth-bridge tests.
No dependency changed, so a frozen-lockfile install was not rerun. These are
local staging-worktree checks, not a Production deployment or proof of live
Clerk key pairing.

No secret values were read, no Production setting or player data was changed,
and no Production deployment was made. Production readiness remains
**NOT CLAIMED**; the staging promotion gate remains **PENDING**. Do not promote
the staging auth bridge until the documented staging gate passes and each
Production rollout is explicitly authorized. After a permitted rollout,
recheck profile loading; if it still returns 401, verify key-instance pairing
through an authorized Clerk connection without exposing key values.

## 2026-10-28 — Production frontend API URL preflight

The Production frontend preflight now requires `VITE_API_BASE_URL` and checks
only its HTTPS URL shape. It reports presence and structural status without
emitting the configured URL. API and staging frontend scopes do not inspect
this frontend-only setting. Tests also cover missing values, non-HTTPS and
credential-bearing URLs, and fail-closed Production status.

The owner reports the frontend API URL is present and confirms the frontend/API
key pairing, origins/redirects, and email delivery. These are not independently
verified from a Railway service context. They do not prove external Clerk
connection authorization or Production sign-in. Production remains blocked.

## 2026-10-28 — Owner-reported two-phone controls and reward credit

The owner reports that two approved staging accounts on two physical Android
phones completed an opposing-team private match. Movement and weapon controls
worked on both phones, both players reached debrief, each received a different
credit award, and the separate balances persisted after returning to Hangar and
refreshing. The owner also reports ARC/STRAFE preferences persisted through
sign-out/sign-in, synchronized across the phones, and remained separate for
Account B. The owner confirmed gyro should remain device-local.

These are owner-reported staging passes for successful reward issuance,
end-to-end match controls, and cross-device profile preferences. Exact credit
amounts, network traces, and reward-ledger rows were not captured. The
`serverOwnedRewardsAndDuplicateClaims` gate remains **PARTIAL**; this match did
not test a duplicate or replayed claim. A successful credit award does **not**
prove an interrupted or expired run is denied a reward. That live denial check
remains **PENDING**; no such claim was submitted or verified. Mission-history
comparison and direct cross-account read/write attempts also remain
unverified, so broad account isolation is still **PARTIAL**.

The physical controls and profile-sync evidence do not complete the broader
Android device gate: the six-minute frame-pacing sample passed, but memory
stability remains inconclusive and thermal status was not supplied. iPhone/
Safari remains **NOT_REQUIRED** under the owner-approved Android-only scope.
Production Clerk readiness remains **NOT_CLAIMED**, and no Production settings,
player data, or deployments were changed.

## 2026-10-28 — Read-only signed-in phone profile check

The signed-in game Settings screen now has an explicit read-only profile check
for phone testing. It requests only `GET /api/game/profile`, reports success or
the safe HTTP status on failure, records response time and device/viewport
metadata, and compares selected visible profile fields with the current game
view. Its copyable JSON omits account identifiers, credentials, tokens, balance
values, query strings, and unneeded environment metadata.

The report states that this check itself sent no write or reward-claim request
and did not inspect the reward ledger. It cannot establish that an interrupted
claim was denied or that no ledger row was written; those remain server/database
evidence gates and are not replaced by a phone report. The standalone `/play`
local no-reward test remains separate from authenticated game Settings.

Verification: the WFM package test suite passed 58/58, TypeScript typecheck
passed, and Vite production build passed. No dependencies, Railway settings,
player data, or deployments were changed; the work remains local and uncommitted.
