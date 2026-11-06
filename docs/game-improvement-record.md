# WAR FOR MARS — Game improvement record

## 2026-11-03 — First campaign-to-orbital combat slice

Migrated capable **Contact** campaign sorties into the existing canonical
orbital simulation. The client advertises `supportsOrbitalReplay`; the server
selects and stores `flightModel: orbital-v1` for Contact, and the client uses
that response to configure the shared Arena. The authenticated Strike-claim
path replays the same orbital simulation before applying the existing
transactional, idempotent progression. The server validates all spatial input
fields and one-shot control release frames. The API contract was extended and
regenerated from OpenAPI.

Compatibility is per-run: older clients that omit the capability, older stored
runs without a flight-model version, and other campaign sorties keep the
original surface replay. Contact now presents the orbital-compatible “break the
defending wing” objective. Its relay-capture alternative is not part of this
initial orbital slice. Standalone Combat Lab remains offline and no-reward;
competitive Wing, co-op sectors, Iron Eclipse, and the socket protocol were not
changed.

On the first verified Contact win, the existing campaign-clear counter unlocks
Pale Beacons in the player's persistent galaxy. The debrief names the route via
Rust Disc, and the server integration test checks a fresh world snapshot after
the claim. No duplicate world-state table or schema migration was added.

Verification: workspace typechecks passed; all 347 workspace tests passed
(scripts 53, API 147, WFM 147); production builds passed, including both
standalone Combat Lab static-publication checks. The database-backed campaign
test exercised Contact issue, deterministic orbital replay, reward settlement,
and duplicate-claim behavior using a temporary test account and removed its
records afterward. Client/server orbital replay parity passed. No staging or
Production deployment, phone test, or release claim was made.

## 2026-11-03 — Stage B saved-hull hangar foundation

Read the attached Stage B repository review in full and preserved its original
text unchanged at `docs/references/wfm-stage-b-hangar-review.txt`. The owner
provided two sets of four screenshots: cinematic hangar/ship-selection
references, followed by aircraft selection, stats, debrief, and multiplayer-home
references. They inform original WFM art and information hierarchy; the
screenshots are not shipped as runtime assets. The aircraft-detail references
informed a more legible, data-backed stat panel and clearer saved hull / unsaved
preview states.

The proposed ChatGPT reference links were attempted but both returned HTTP 402.
Their contents were not reviewed or treated as requirements; the attached
repository review and the current source were the available references.

The command screen now opens as a hangar-first experience with an original
CSS-authored bay scene and the current account-saved hull rendered from the
existing Three.js orbital ship builder.
The hangar model supports pointer/touch drag and keyboard rotation, and it
retains a responsive fallback when WebGL is unavailable. The Armory's selected
hull now uses that same 3D model; unsaved draft selections are explicitly
labeled as previews, while the home hangar reflects only the saved profile.
The saved-hull and Armory panels expose shield, hull, speed, thrust, pulse
damage, and shot rate from WFM's canonical ship definitions, plus the selected
ship's actual special system and cycle time. Hull editing and persistence
continue through the existing Armory save flow. Launching Rust Disc from the
Hangar preselects the account's saved hull in the local flight briefing; that
offline selection is a local preset and cannot overwrite the server-saved
loadout. The briefing shows actual ship telemetry, while the local debrief states
the objective outcome and returns to WFM.
The campaign briefing, Rust Disc flight, Combat Lab, optional co-op expedition,
galaxy, Online Wing, Armory, settings, and opt-in leaderboard remain reachable.

This is a front-end journey and presentation slice. It does not connect
competitive Wing to 3D sector simulation, change auth/progression/reward
authority, or certify mobile GPU performance or physical-device behavior.
Production and Railway were untouched.

Verification: the `workspace-quality` workflow finished successfully with
typechecks, 335 tests (scripts 53, API 143, WFM 139), production builds, and the
two Combat Lab static-publication checks passing. `git diff --check` passed. The
preview screenshot confirmed the public WFM entry page loads, but the capture
browser cannot sign in, so the authenticated Hangar and Armory were not visually
captured; no physical-phone test was performed. Vite still reports the existing
greater-than-500-kB Three.js chunk advisory; this presentation change does not
claim that the game's overall mobile frame pacing has been optimized.

## 2026-11-04 — Hangar-to-Rust Disc local sortie continuity

Completed three connected improvements:

1. Replaced references to untracked screenshot attachments with an original
   CSS-authored hangar backdrop, keeping the production build self-contained.
2. The Hangar's saved hull now preselects the hull in Rust Disc through a
   validated URL preset. An authoritative expedition snapshot still takes
   precedence; the offline preset cannot update the account loadout.
3. The Rust Disc briefing displays canonical shield, hull, thrust, pulse damage,
   shot rate, ultimate cooldown, and special-system values. It explains that
   briefing selections are local-only. The debrief reports whether extraction
   completed and returns to WFM.

Verification: the `workspace-quality` workflow finished successfully with
typechecks, 339 tests (scripts 53, API 143, WFM 143), production builds, and both
Combat Lab static-publication checks passing. The Rust Disc briefing rendered at
390 × 844 CSS pixels with `?ship=shakuna`; browser logs showed no app errors.
The authenticated Hangar itself was not visually captured. The existing large
Three.js chunk advisory remains; no device-performance claim or phone test was
made. Railway and Production were untouched.

## 2026-11-04 — Structural rebuild roadmap and Galaxy operation routing

Read all 883 lines of the owner-supplied structural rebuild strategy. The exact
source is preserved at `docs/infinite-war/STRUCTURAL-REBUILD-STRATEGY.txt`; its
maintained implementation summary and staged acceptance criteria are in
`docs/infinite-war/STRUCTURAL-REBUILD-ROADMAP.md` and the project memory index.

The roadmap confirms the current architecture decision: evolve the custom
Three.js runtime into the canonical combat foundation while retaining the
existing campaign, account, co-op, Wing, economy, and progression safeguards.
The player journey is not considered complete until mission results return
through the existing server-authoritative progression path.

This change fixes a concrete Galaxy-to-operation mismatch: recorded discoveries
now determine the next incomplete story-sector mission, and the Galaxy link
carries that mission ID into the Expedition selector. The client accepts only
known IDs for navigation; account progression, prerequisites, and mission
authorization remain server-validated. No progression or reward logic changed.

## 2026-11-04 — Unified mobile command hierarchy

Read the complete repository-specific implementation request and reviewed its
Android screenshots. The original text is preserved at
`docs/infinite-war/REPO-UNIFICATION-REQUEST.txt`; its findings are added to the
structural rebuild roadmap and existing project-memory entry.

The public landing emphasizes account entry or local solo flight and places
Rust Disc, offline Orbital Combat Lab, and co-op in an expandable operations
group. The signed-in command screen makes the next campaign sortie primary,
keeps server-run co-op as a distinct operation path, and groups local Rust Disc,
offline Combat Lab, and Arcade Skirmish inside expandable Flight & Combat
Systems. This reduces the mobile command-card wall without removing legacy
access or misrepresenting their runtimes as already unified.

This is the navigation stage of the rebuild. It does not yet run every mode on
the Orbital Combat Lab simulation or connect all outcomes to one progression
system. Existing campaign, Wing, and co-op authorization and reward contracts
remain intact until an end-to-end replacement is tested.

Verification: workspace typecheck, all 342 package tests, and production builds
passed; all 10 public Playwright tests passed, including the new expandable-menu
check and small-phone scrolling. The preview rendered at 390 × 844 CSS pixels
on the logged-out landing page. The browser reported the existing development
Clerk-key warning and a WebGPU context-creation warning; the authenticated
command screen was not visually captured. No physical-device, staging, or
Production verification was performed.

## 2026-11-03 — Master Infinite War directive and Stage A audit

Read the full owner-supplied 653-line master development directive and retained
the original file unchanged under `attached_assets/`. Made it the leading
execution reference through `docs/infinite-war/MASTER-DEVELOPMENT-DIRECTIVE.md`
and a durable project-memory pointer.

Completed the directive's first required delivery stage as a repository-grounded
source/test audit: `FORENSIC-INVENTORY.md` classifies current systems;
`ARCHITECTURE-ASSESSMENT.md` records current authority boundaries and a target
integration sequence; `FEATURE-INTEGRATION-MATRIX.md` maps each retained system
to its destination and first acceptance proof. The audit confirms that account,
progression, world, cooperative sectors, Iron Eclipse, and Wing services exist,
but the 5v5 Wing simulation is not yet integrated into the 3D sector combat
protocol. The Combat Lab remains offline/no-reward. No duplicate auth, profile,
inventory, or reward system was introduced; no existing feature was deleted.

The audit used the current local refs, not live GitHub PR status or Railway
deployment metadata. At the time checked, the working tree was on
`integration/infinite-war-orbital-combat`; local `staging` was `f1c8b62`,
`origin/staging` was `6671d36`, local `main` was `4b31352`, and `origin/main`
was `3ecff67`. These are repository refs only and must not be represented as
deployed revisions.

This is Stage A documentation and planning evidence, not a completed unified
player journey, ten-human 3D warfront, Production release, or physical-device
verification. The next implementation slice must use these audited contracts
and keep any client/API/socket migration coordinated and reversible.

## 2026-11-02 — Staging rollout for cooperative squad orders

Fast-forwarded the Railway `staging` branch from `50f9ab1` to
`341af7f8d468ee4247cee36033c5f15d98951df4`. This rollout contains the full
tested feature-branch delta (30 commits, 91 files), including the cooperative
3D sector foundation, Android staging launcher, visual updates, and host-issued
squad orders.

Railway reports the app, API, and socket deployments successful on that exact
SHA. All four staging services, including PostgreSQL, are online with no pending
work or reported failures. The read-only staging gateway health endpoint returned
HTTP 200. No database migration or query, Production change, sign-in, match, or
physical-phone test was performed. A two-pilot order test and cooperative
discovery acceptance check remain pending.

## 2026-11-02 — Server-validated cooperative squad orders

Added a capability-gated, in-flight command palette for cooperative sector
hosts. Attack targets the shared hostile drone; Defend and Escort target a
connected non-host pilot; Regroup targets the host. The server derives issuer
identity from the authenticated socket seat, requires active phase and host
authority, rejects unknown/self/offline/out-of-room targets, rate-limits
commands, and publishes the result to all pilots without pausing the match.

Orders are human coordination calls only. They do not pilot teammates, modify
damage or rewards, or affect competitive Wing. Older sector clients remain
compatible because the new controls are shown only when the server advertises
the capability. Automated verification: API and game typechecks passed; focused
API runtime tests passed (including host, phase, exact payload, target,
broadcast and rate-limit cases); focused client snapshot tests passed. Full
workspace typecheck passed; all 277 tests passed (API 127, game 97, scripts 53);
the full build and `git diff --check` passed. The existing Three.js chunk-size
warning remains. When this implementation entry was written, no staging or
Production deployment had yet been made; see the rollout record above.

## 2026-11-02 — Combat evolution reference and vector drift

Read both supplied combat-evolution documents in full and retained them as
workspace references in `attached_assets/`. Added
`docs/combat-evolution-roadmap.md` and a linked memory note to preserve their
19-part analysis, staged roadmap, and implementation boundaries.

Implemented the first contained combat slice in the existing 3D Rust Disc
sector: a hold-to-drift control preserves the ship's current velocity while the
pilot changes orientation. Braking overrides drift. The authoritative sector
server accepts and simulates the input, advertises support in its snapshot, and
keeps old clients valid; new clients expose the control only after capability
advertisement. Competitive Wing simulation, rewards, ship statistics, auth,
schema and persistence are unchanged.

Verification: `pnpm run typecheck` passed; `pnpm test` passed all 276 tests
(API 126, WFM 97, scripts 53); `pnpm run build` passed; `git diff --check`
passed. The build reports the existing Three.js chunk-size advisory (the engine
chunk is over 500 kB), but completes successfully. This first slice does not
mean the broader tactical-command, capital-ship, campaign, procedural-mission
or persistent-war roadmap is complete. No staging or Production deployment
was made.

## 2026-11-02 — Cooperative sector session identity guard

Prevented one authenticated account from claiming multiple cooperative-sector
seats through disconnected or concurrent sockets. The socket runtime now reserves
the authenticated account while loading progression and rejects joins to another
room while a pilot seat for that account remains. The existing same-room
reconnect path is preserved. Reservations are released on disconnect, load
failure, and shutdown; a late progress response from a disconnected socket
cannot create a seat.

This change uses the existing authenticated identity and in-memory room state.
It adds no identity headers, tables, migrations, reward paths, or client-trusted
claims. No Railway resources, database data, Production settings, or deployments
were changed.

Focused verification: sector runtime tests passed 10/10 and API typecheck passed.
Full workspace typecheck and build passed; all 275 workspace tests passed
(scripts 53, API 126, game 96). The game build retains its non-blocking
Three.js chunk-size warning. This local code change has not been deployed to
staging; staging evidence must be collected against the exact revision before
promotion.

## 2026-11-01 — Cooperative sectors

Added the first server-authoritative cooperative expedition chain: Rust Disc
relay recovery → Mars orbital approach → Pale Beacons. Kept local `/flight`
offline and unauthenticated. Reused the existing authenticated WebSocket
service, deterministic 3D flight kernel, schema, discoveries table, player
locks, and progression-event ledger. Discovery rewards are zero-credit,
account-owned and idempotent; existing Wing payouts and original campaign
clear tracking are unchanged. Mars is a physical flyable globe in an
orbital-survey mission; landing is not implemented. Production defaults off
and neither Production settings nor deployments were changed.
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

## 2026-10-29 — Fail-closed Online Wing reward eligibility

The owner-supplied staging deployment report records a successful staging
deployment at `970f35daa255f0c21ba5e850d5eba90f56ecb2b7`. A read-only Railway
metadata check independently confirmed that frontend, API, and socket currently
have successful deployments from that staging commit, with Postgres online and
no pending environment changes. Railway also reported five recent historical
deployment failures across three app services; their causes were not inspected.

The report's statement that a missing `WFM_WING_REWARDS_ENABLED` variable proved
rewards were disabled is not supported by the local socket bootstrap inspected
for this update: it previously loaded settlement whenever `DATABASE_URL` was
present and did not check that flag. At the initial inspection, the deployed
commit was not yet available in the local Git object database, so the running
socket source could not be compared directly. It was later fetched and merged
as documented below; live reward enablement remains unverified.

The local safety change adds a server-owned match mode, defaults client-created
room-code rooms to `private`, ignores client-supplied mode fields, rejects
private/Practice/test rooms before any reward transaction, and requires both
the exact enable flag and a database before importing reward persistence. A
trusted server-side competitive-queue resolver is additionally required; the
current bootstrap provides none. The code therefore does not enable rewards.
The attachment is preserved in
[`staging-deployment-report-2026-10-29.md`](staging-deployment-report-2026-10-29.md).

The safety patch is merged in `a318979` and pushed to staging as commit
`5bb105b`, integrating the confirmed staging reward-ledger revision `970f35d`.
Railway reports the staging frontend, API, and socket all online and successful
on `5bb105b`, with no pending work or current failures. The change does not
enable rewards: the socket bootstrap has no trusted competitive-room resolver,
so room-code matches remain private and no-reward. Schema/ledger readback and
live reward/duplicate evidence remain pending because the available Railway
connection has no SQL-query operation. Production settings, data, and
deployments remain untouched.

Verification: focused reward/config/socket tests passed 16/16. Full workspace
typecheck passed; all tests passed 204/204 (scripts 49, API 97, game 58); all
workspace builds passed. The frozen-lockfile install was not rerun because no
dependency or lockfile changed. The staging promotion evidence remains
**PENDING**; deployment health does not replace reward-ledger, interrupted-run,
or physical-device evidence.

## 2026-10-29 — Server-seeded aerial battlefield rotation

Reviewed the five supplied competitive-map, geospatial-matchmaking, cache,
cleanup-worker, HUD, and webhook proposals against the actual WFM architecture.
The goals of distinct battlefields, a pre-launch map briefing, and a consistent
in-flight field identity fit the existing 5v5 journey. The example implementations
do not: they assume nonexistent competitive-room/inventory tables and a custom
database driver, trust client-supplied identity and loot fields, fabricate GPS
coordinates, delete from a nonexistent room schema, and use lifecycle statuses
not present in the WFM Strike model. These assumptions were not copied.

New 5v5 rooms now use the server-created seed to rotate across the existing Rust,
Beacon, Night, and Dust simulation layouts. The authoritative lobby packet
includes the actual relay and obstacle geometry; the lobby renders a compact
tactical map and field briefing, and the live Wing indicator names the same
field. This remains private room-code play: no public matchmaking, real-world
GPS collection, new database schema, or Wing reward eligibility was added.

Focused tests passed for deterministic field selection, battlefield metadata/map
bounds, and socket lobby map consistency with the authoritative snapshot. The
full workspace typecheck, all 208 tests, and workspace builds passed. Commit
`0468654f52c6aa193a35f95edf28daba0492f093` was pushed to `staging`; Railway
reported the app, API, and socket deployments successful on that same commit,
with all staging services online and no pending work.

The owner reports that two physical Android phones showed the same field in the
first lobby and active match; a fresh lobby showed a different field on both
phones, and the tactical map matched the arena terrain. This is owner-reported
staging evidence for those two rooms, not map-balance certification or
Production evidence. No Production settings, secrets, player data, or
deployments were changed. The independent reward and Production-auth gates
remain in force.

## 2026-10-29 — Opt-in public Wing leaderboard

Added a signed-out public leaderboard limited to an opted-in pilot's chosen
callsign and the all-time sum of server-recorded 5v5 Online Wing reward credits.
The endpoint omits account IDs, email, private Activity Ledger entries, match
history, and live-online status. Signed-in pilots can opt in or out from Settings;
opting out clears the stored public callsign. Practice and private-room rewards
do not contribute to the score.

The database change is additive: the `wing_reward` enum value, two
leaderboard-preference columns, and indexes for opted-in profiles and eligible
Wing reward events. On 2026-10-30, after owner approval, the corrected SQL in
`docs/migrations/20261029_public_wing_leaderboard.sql` was applied to the
Replit Development database only. Read-only schema checks confirmed the enum,
both columns, and both indexes after the migration. Railway staging and
Production databases were not modified.

Verification after that Development-only migration: scripts tests passed
49/49, API tests passed 110/110, WFM tests passed 60/60, workspace typecheck
passed, and workspace builds passed. Before the migration, 15 API tests failed
because the Development schema lacked the leaderboard columns; all passed
afterward. `git diff --check` passed. No dependencies or lockfile changed.

This is local/test evidence, not a staging deployment or live leaderboard,
reward-ledger, authentication, physical-device, or Production-readiness
certification. Staging and Production release gates remain separate.

## Casual AI-fill Quick Match

Implemented an optional casual queue separate from the ten-human competitive
queue and private rooms. The socket owns a 30-second window, resets it after
each newly accepted authenticated pilot, then starts with AI-controlled open
seats; ten connected pilots start immediately. Casual matches are explicitly
unranked and no-reward. Both app and socket require their own casual-queue
feature flags. Focused socket/reward tests passed 22/22, WFM tests passed 60/60,
and the workspace build passed.

## 2026-10-30 — Casual AI-fill Quick Match staging verification

The casual queue source is deployed to Railway staging at commit `354912a`.
Staging-only feature flags are enabled on the app
(`VITE_WFM_CASUAL_AI_QUEUE_ENABLED`) and socket
(`WFM_CASUAL_AI_QUEUE_ENABLED`). The app deployment
`6b07f54e-2132-4aed-85ad-5414878ca717` and socket deployment
`ae9c1156-304b-46b0-8e89-3414495399ee` succeeded. The API deployment for this
source revision had already succeeded. No Production services or settings were
changed.

The owner reports a two-phone staging check with separate pilots: the second
pilot reset the countdown to 30 seconds; the match auto-started with AI-filled
seats at timeout; both phones showed the same field; and neither account's
credits changed. This is owner-reported functional evidence, not a captured
socket trace or reward-ledger inspection. It verifies the intended quick-match
flow on staging but does not replace the live interrupted/expired reward-denial
gate, database ledger verification, or the separate Production Clerk checks.
Production readiness remains **NOT CLAIMED**.

## 2026-10-31 — Staging Online Wing reward-ledger readback

Using the confirmed staging PostgreSQL service, read-only queries verified that
the `wing_reward` enum value exists. The queried `online-wing` ledger contained
zero reward events and no latest-event timestamp. The duplicate reward-key
group count was zero, and the arithmetic query reported zero events and zero
balance-delta mismatches.

The zero duplicate and arithmetic counts are vacuous because there were no
matching reward events. This confirms neither a successful award nor correct
duplicate prevention under real settlement. It also does not establish whether
the reported match was eligible, whether settlement was attempted, or why no
ledger rows were written. A controlled eligible staging settlement and its
read-only ledger evidence remain required; interrupted/expired denial remains
unverified. These checks were SELECT-only; no claim was submitted and no
database or Railway configuration was changed. Production remains untouched
and readiness remains **NOT CLAIMED**.

The follow-up source and staging-metadata audit found the reason this result is
expected under the current configuration: the socket service has `DATABASE_URL`
and the Casual AI-fill flag, but neither `WFM_WING_REWARDS_ENABLED` nor
`WFM_COMPETITIVE_QUEUE_ENABLED` is configured on the service or as a shared
staging variable. The app has only the Casual AI-fill flag; its competitive
queue button is also gated by the absent `VITE_WFM_COMPETITIVE_QUEUE_ENABLED`
flag. The socket starts competitive matchmaking and reward settlement only
when their respective exact `"true"` flags are enabled; private room-code and
Casual AI-fill matches remain no-reward. The existing debrief already tells
pilots that private, Practice, and test rooms are ineligible and that disabled
rewards do not add credits.
The latest 201 socket runtime log entries contained no reward text or
`wing_reward_settlement_failed` event; because the missing gates prevent
settlement from running, this is consistent but not independent proof of
successful reward behavior.

Added a sanitized socket startup event, `socket_feature_readiness`, containing
only boolean values for competitive queue, casual AI-fill, reward flag,
database presence, and effective reward readiness. Focused API socket tests
passed 18/18; API typecheck and build passed. The local socket workflow rebuilt
and emitted the readiness event but could not bind because port 8099 was already
in use; the existing local `/healthz` responded 200. No process was stopped,
and this code change has not been deployed. Enabling the staging competitive
queue or rewards remained a separate operator decision at the time of this
audit. Production settings were not changed.

## 2026-10-31 — Staging competitive queue and Wing rewards enabled

After explicit owner approval, the staging app was enabled to show the
competitive-queue button, and the staging socket was enabled to accept the
ten-human queue and settle eligible Wing rewards. The exact three additions
were `VITE_WFM_COMPETITIVE_QUEUE_ENABLED` on `wfm-app-staging`, plus
`WFM_COMPETITIVE_QUEUE_ENABLED` and `WFM_WING_REWARDS_ENABLED` on
`wfm-socket-staging`. No shared variables or other resources were changed.
The staged patch was non-destructive and was committed only to the `staging`
environment.

Railway reports the app and socket deployments successful; all four staging
services are online with zero recent failures and no pending work. The
unauthenticated staging homepage returned HTTP 401, so this check did not verify
the signed-in game screen or its competitive-queue button. The local
`socket_feature_readiness` source change is not included in the Railway source
revision because it has not been pushed.

The newly enabled gate is not yet a reward certification: no match or reward
claim was run after activation, and no post-activation ledger query was made.
Only a match formed by ten distinct authenticated human pilots can enter this
reward-eligible queue; Casual AI-fill and private rooms remain no-reward.
Participants must be connected at completion, play at least 60 active seconds,
and submit at least 120 accepted inputs; the daily limit is five awards per
pilot. Existing policy amounts remain 30 credits for a win, 15 for a draw, and
10 for a loss. Production settings, data, and deployments remain untouched.

The remaining policy and socket checks do not require a live ten-pilot match.
The in-memory reward-policy and socket tests passed 25/25, including private
and Casual AI no-reward behavior, competitive ten-human queue gating, identity
uniqueness, eligibility thresholds, outcomes, idempotency, and the daily limit.
The full `workspace-quality` workflow also finished: typecheck/build completed,
with 112 script tests and 60 WFM tests passing. These tests do not write to or
inspect the Railway staging ledger.

No synthetic award button was added. The existing staging reward diagnostic
captures a Solo Strike claim through the real claim endpoint; it is not an
Online Wing dry-run and could affect progression. A fake button would either
write a real credit event or test only a simulated path, so neither would
replace ledger evidence from a real competitive settlement. A two-phone check
of queue visibility, waiting, cancellation, and unchanged balances can still
be completed with fewer than ten pilots. The staging homepage's unauthenticated
HTTP 401 means the signed-in queue UI must be checked on an authenticated phone.

## Android-first application preparation

The owner selected Android first, with the existing shared game and Railway
services retained. Added a staging-only Trusted Web Activity Android project,
an APK-building GitHub Actions workflow, a public-certificate association
generator and focused configuration/security tests. See `docs/android-app.md`
for build instructions, domain-association requirements and phone acceptance.

The launcher targets only the existing Railway staging game. It does not create
a database, change authentication, add a native reward endpoint, modify origins,
deploy Railway or publish to a store. The first APK is debug-signed; Production
signing and verified domain association remain separate steps. The Shell lacks
Java/Android tooling, so native compilation is delegated to the repository's
GitHub Actions build rather than claimed from the passing Node checks.

Verified build: https://github.com/niakofa-cmyk/WFM/actions/runs/41274527388
tested source `cf10f64800d1791aeac8d316399ddc5f78e3de3f`. Android configuration
checks, JUnit task, lint, debug APK assembly, signature verification and artifact
upload all succeeded. The local repository script suite passed 53/53; Android
XML parsed and `git diff --check` passed. The shared Solo Flight setup also
rendered in a 360×803 preview; this is not a native phone rendering test.

Initial APK download (superseded by the startup fix below; do not reinstall):
https://github.com/niakofa-cmyk/WFM/actions/runs/41274527388/artifacts/13070946519

The artifact contains a debug-signed staging APK and its public-certificate
association candidate. It expires under the workflow's seven-day retention.
The initial build compiled and passed native tests/lint but failed association
packaging; the passing build pins the project's signing-verification tools and
retains the APK if a later packaging step fails. No association file was
published to a website, no device installation was performed, and Railway
configuration, databases and Production remain unchanged by this work.

### 2026-11-01 — Android immediate-startup crash reproduced and fixed

The owner reported that the installed staging app stopped immediately on opening.
An installed-APK Android 13 / Chrome emulator test reproduced a fatal startup
exception: Browser Helper tried to toggle its undeclared
`ManageDataLauncherActivity` component. The previous compile/lint/JUnit checks
had passed; Robolectric's package-manager shadow did not enforce that Android
registration requirement.

Version `0.1.1-staging` / code `2` adds the required component, application
manage-space declaration and matching staging URL, without changing the browser
authentication flow, Railway services or any player data.

Verified replacement build:
https://github.com/niakofa-cmyk/WFM/actions/runs/41276369322
at source `20868a1ebd5341a74130bb3d11dc1776530c72cc`.
Results: Node Android checks 4/4; Android JUnit 5/5; lint, compilation,
APK assembly/signature verification and packaging passed. Installed-APK cold
start and relaunch passed with empty native crash logs. The emulator used
Android 13 and its bundled Chrome 109; its screenshot shows Chrome's first-run
screen. This proves native startup/browser handoff, not sign-in or gameplay.

Replacement APK download (GitHub sign-in may be required):
https://github.com/niakofa-cmyk/WFM/actions/runs/41276369322/artifacts/13071453431

The same run retains clean-emulator startup logs/screenshot and test reports.
Artifacts expire after seven days. Initial physical-phone checks are now
owner-confirmed below; multiplayer and other untested paths remain separate.
Debug certificates may differ across CI runs: uninstall only the old
WFM Staging app if Android rejects replacement; do not clear Chrome storage.

Railway's staging-only status check reported all four services online, no recent
failures and no pending changes. The public app address and `/healthz` return
the expected private-staging HTTP 401 access page. No live sign-in, database
query, reward request, Railway deployment/configuration change or Production
action was performed.

#### Owner-reported installed-app phone checks

After installing the replacement, the owner confirmed:

- The app opens to Railway staging instead of stopping immediately.
- Armory displays credits and inventory correctly.
- After closing the app from Android's recent-apps screen without signing out,
  reopening it shows the same balance and inventory.
- Steering and firing work before and after switching to another Android app
  and returning during the requested local, no-reward Solo Flight check.
- During flight, rotating the screen to landscape leaves the controllers
  functioning correctly, as subsequently confirmed by the owner.

These are physical-phone observations, not an instrumented network trace.
The phone/browser versions were not reconfirmed during this sequence. They do
not certify rotation back to portrait, every device/orientation combination,
competitive reward settlement or Production readiness.
Earlier browser-only multiplayer evidence is not automatically installed-app
evidence; the additional installed-app procedure is recorded below.

#### Owner-reported two-phone private-match check

The initial lobby attempt was inconclusive: the owner reported separate rooms
and different menu options. Read-only Railway metadata confirmed the staging
frontend and socket service shared a deployed revision and each had one replica.
No deployment, settings change or data clearing was performed.

The owner then followed the single-creator/second-pilot-Join procedure using the
exact staging address, and confirmed both pilots appeared in one private lobby.
After launching, the owner reported:

- Both phones were on the same battlefield.
- The match ran without observed issues; steering and firing worked.
- The match completed and returned to Hangar.
- Neither balance received additional credits or other adjustments.

This passes the observed two-phone private-match flow for the installed-app
verification sequence and is consistent with private matches remaining
no-reward. The procedure used the installed app on the first phone and directed
the second phone to staging in Chrome; it does not establish two installed-APK
clients or record a new per-device browser/version inventory.

This is owner-reported phone evidence, not a reward-ledger audit or a test of
ten-human competitive settlement, duplicate claims, all orientation transitions, disconnect
recovery or Production. Existing earlier staging evidence remains valid within
its original scope.

## 2026-11-01 — Lovart-based graphics and command presentation

Reviewed the owner's public Lovart canvas, its complete 67-entry message history
and 24 image references. Preserved the source/revision audit in
`docs/lovart-visual-audit.md`; extracted reference material is retained under the
ignored `generated-artifacts/lovart-reference/` directory. Excluded the explicitly
superseded campaign artwork and old Accord emblem.

Implemented responsive orbital hangar scenery, the supplied wordmark and
current faction insignia in command/Armory/Settings presentation and the galaxy
header, with readable amber controls and reduced-motion support. Five optimized
local WebPs total 221,302 bytes; the game does not fetch Lovart during play.

Flight rendering now includes a small procedural Mars texture, atmospheric limb,
basalt surface detail and faction-specific metal/ceramic ship materials. These
are render-only changes: no simulation geometry, hitboxes, balance, input,
network, authentication, reward or progression rules changed. GPU texture
resources are released on teardown; source RGBA data is capped at 144 KiB before
mipmaps. No background blur or new shadow/postprocessing pass was introduced.

Validation:

- WFM unit suite **65/65 passed**, including five new surface/resource tests.
- Full workspace typecheck passed; WFM Vite build passed in **5.60 seconds**.
- Local web workflow restarted cleanly; preview `/play` loaded.
- Actual command component checked with synthetic, no-account props at
  **360×803**, **803×385** and **1280×900**: art loaded, page width matched the
  viewport, visible menu buttons met the 44px height threshold, and no page
  exceptions occurred. Portrait Armory was visually inspected. This did not
  exercise authenticated galaxy requests or real account state.
- A real local no-reward flight rendered in Chromium software WebGL at
  **803×385** with an advancing timer and no browser/shader errors.

Earlier physical-phone results remain recorded for their original revision.
New art still needs physical Android performance/endurance verification after
a separately authorized staging release. Existing ship meshes remain stylized;
reference artwork is not a replacement 3D model. No Railway settings, database,
secrets, Production release or publishing changes were made for this visual pass.

## 2026-11-01 — Forensic-audit opening rebuild

Read the owner's full 782-line audit and preserved its original text verbatim
in `docs/references/wfm-forensic-design-audit.md`. The source describes some
older UI; reconciled it against the current code and retained the previous
Lovart artwork rather than discarding that work.

Implemented the audit's recommended first three screens: a branded public
landing, cinematic title arrival and reorganized command center. Added shared
panels, button treatments, intrinsic image dimensions, faction accents,
safe-area spacing, visible focus and reduced-motion behavior. Command briefing
uses actual selected-ship definitions, credits, campaign completion and sorties.
The ship illustration is labelled schematic, not a replacement flight model.
All room/queue actions and existing feature gates are preserved.

Verification: **70/70 unit tests passed**, full workspace typecheck passed,
game build passed in **5.29 seconds** on the final run. Local portrait, landscape and desktop
checks showed no horizontal overflow, loaded artwork and command targets at
least 44px high. Isolated synthetic command callbacks, queue-disabled states,
title transition, reduced motion and blocked-artwork fallback were checked.
Queue cancellation remains accessible when availability flags are withdrawn
during a search; nested-router link generation was also checked.
No authenticated account or multiplayer match was needed for these checks.

See `docs/opening-experience-rebuild.md` for exact coverage and limitations.
This record is not evidence of a Production deployment, new trailer,
new native APK, physical-phone performance or competitive settlement.
The owner declined an additional two-phone graphics test; none was requested.

## 2026-11-01 — Illustrated hull selection

Added distinct, labelled selection illustrations for all eight ships, an
illustrated Armory card roster and larger selected-hull preview. The command
briefing now shows the chosen hull instead of a shared faction outline.
**Change Ship / Faction** opens the existing Armory. Faction names/emblems,
selected borders, ACTIVE labels and accessible pressed states distinguish
selection without relying on color alone.

Preserved existing callbacks, ship IDs, faction assignments, upgrades and stats.
These lightweight static SVGs interpret the retained concept roster and hull
archetypes; they do not replace gameplay meshes or hitboxes.

Verification: **74/74 tests passed**, WFM typecheck passed, build passed
in **5.45 seconds**. Synthetic component checks covered all eight selections,
faction switching, Back/reopen and command-preview updates at phone portrait,
landscape and desktop sizes. No horizontal overflow, undersized ship-card
targets, browser exceptions or POST requests occurred in that fixture.
See `docs/opening-experience-rebuild.md` for boundaries and retained evidence.
No Production, staging deployment, Git push or physical-phone retest occurred.

## 2026-11-01 — Hull preference persistence

Fixed the owner's report that selected hulls reverted to the default after
leaving Armory. The profile refresh was overwriting a local-only choice.
Armory now keeps a draft, exposes Save Hull with pending/saved/error states,
and saves on Back before navigating. A failed request retains the draft for
retry. The selected command hull updates only after server acknowledgment.

Added a strict authenticated loadout preference operation using the existing
player table and transaction/ownership checks. Faction/hull pairing is validated;
credits, progression revision and issued flight configuration are unchanged.
No schema migration or authentication configuration changes were needed.

Validation passed: 74 frontend tests, 9 focused backend tests (no skips),
workspace typecheck and both frontend/API builds. Disposable-player database
checks confirmed subsequent profile reads retain the choice and another
player remains unchanged. Synthetic browser checks covered save-on-Back,
explicit save, failure/retry, profile-refresh drafts and responsive selection.
Local app/API restarted successfully. Changes are local; frontend and API need
coordinated release before this applies to Railway.

## 2026-11-01 — Open-universe flight foundation and faction correction

Read the complete owner-supplied open-universe vision and preserved its original
text at `docs/references/wfm-open-universe-flight-vision.md` (byte-identical).
The implementation/evidence boundary is documented in
`docs/open-universe-flight-foundation.md`.

Corrected faction colors throughout hull selection, schematics, command
accents and combat ship materials: **blue USSF, warm amber Accord**. Ship roles,
assignments, balance, saved-loadout behavior and competitive simulation remain
unchanged.

Added a public, lazy-loaded Rust Disc local trainer at `/flight`, linked from
arrival and command. It includes XYZ/quaternion flight, acceleration/momentum,
braking/boost, a versioned obstacle field, discovery/encounter/extraction,
projectiles, line-of-sight locks, guided missiles and countermeasures. The
renderer adds original 3D hulls, Mars, debris, mission markers, camera options,
mobile controls, pause/orientation recovery, quality tiers and GPU teardown.

Verification: **89 frontend tests passed (0 skipped)**, workspace and final
frontend typechecks passed, production build passed, and local software-WebGL
smoke checks passed with **0 page exceptions / 0 trainer API calls or writes**.
This is not physical Android or online-sector evidence. No reward, campaign,
auth, database, server simulation, Railway configuration, push or deployment
changes were made. The new trainer is deliberately ineligible for progression.

## 2026-11-06 — Offline Arcade enters the canonical Orbital runtime

The local Offline Strike / Arcade Skirmish launch now resolves to the
`arcade-skirmish` GameModeDefinition and `orbital-v5`, rather than being
misidentified as generic Arena practice. The mode contract records the actual
`@workspace/orbital-sim` and `Arena` sources, local authority, and no reward
eligibility. Generic local practice remains a separate mode. Server-issued
Contact still selects its pinned Orbital mode; legacy campaign runs retain
their issued surface runtime, and private/live Wing authority, controls, and
reward gates were not changed.

The mode-routing tests cover offline Arcade, generic local practice, Orbital
Contact, legacy-pinned sorties, and live Wing. The canonical offline runtime
test verifies no reward eligibility. The first full workspace-quality run had
an intermittent Contact progression assertion and cancelled frontend tests;
the affected API test file passed in isolation, and the subsequent full
workspace-quality run passed: scripts **53/53**, API **162/162**, and WFM
**245/245**, with workspace typechecks and builds passing. After tightening the
mode source-package assertion, the shared-library and WFM typechecks and all
WFM tests passed again (**245/245**). The staging-results JSON parsed and
`git diff --check` passed.

The local preview rendered the WFM landing page after restart. The screenshot
did not enter a signed-in game session, so the Offline Strike screen itself was
not visually exercised; the mode launch mapping is covered by tests. No new
staging deployment or Production change was made.

Separately, the owner reported that two devices joined the same private room
and controls/firing worked. The screenshot shows a two-human lobby; no room
code is retained. This is owner-reported private-room smoke evidence only, not
an Orbital v5 campaign test, ten-human competitive test, sector co-op proof, or
reward-settlement verification. See `STAGING-TEST-REPORT.md`.

## 2026-11-06 — Standalone Solo Flight enters Orbital v5

The public `/play` Solo Flight now launches the canonical `orbital-v5`
simulation through `Arena`. Its mode contract records the actual Orbital package,
mission AI, local authority, fixed-step rules, and no reward eligibility. The
offline boundary is unchanged: this route does not issue a server run or settle
campaign progress.

The runtime element now exposes mode/runtime identifiers for end-to-end checks.
Playwright verified renderer initialization and forward-input movement on the
desktop browser route, then repeated the runtime, WebGL, analog-stick movement,
and recenter checks in an 844×390 landscape touch viewport. The focused browser
suite passed **3/3** tests, including the existing Orbital Combat Lab control
check. Shared-library and WFM typechecks passed; all **246** WFM tests passed.
This is browser evidence, not physical Android device certification. Legacy
campaign missions and live Wing were not changed; staging and Production were
not updated.

## 2026-11-06 — Cinder Ring becomes the multiplayer station entry

The home-screen multiplayer shortcut now opens the universe instead of creating
a room immediately. At Cinder Ring, the asteroid hub presents two distinct
lanes: the existing server-authoritative ten-human 5v5 Wing Relay queue and a
private-room dock that reuses the existing invite-code lobby. The private dock
is shown only when the universe state places the pilot at Cinder Ring; invite
rooms remain no-reward and are not added to the public match feed or spectator
directory. The hub itself stays visible when the live directory is unavailable
and reports that state instead of hiding the station.

Verification: WFM typecheck passed, **248/248** WFM tests passed, the WFM build
and its four preview-build checks passed, and `git diff --check` passed. The
private-dock location/code rules have dedicated unit tests. The screenshot
verified the public landing page only; the signed-in universe station UI was
not visually captured. The owner separately confirmed that two devices joined
a private room and controls/firing worked, but that test did not exercise the
new Cinder Ring entry flow or a ten-human competitive match.

This hub is still a universe-screen station entry with authored artwork, not a
flightable 3D approach or docking scene. The actual competitive match continues
to use the existing Wing runtime. No API/socket authority, rewards, staging, or
Production deployment changed. A direct full-workspace test run during this
session hit an unrelated API progression assertion (`match.over`); that
progression test passed in isolation, and no API code was changed here.
