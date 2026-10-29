# WAR FOR MARS staging verification report

- **Status:** PENDING
- **Latest physical profile-sync source commit:** `1cf6e5ff1c58833992b9b782ef90d437b4e4cc43` (owner-reported paired-device check; overall staging verification remains pending)
- **Staging Repl:** owner-confirmed separate Repl
- **Deployment visibility:** protected Railway staging gateway; private API/socket have no public domains. Replit invite-only deployment is not a WFM launch requirement per the owner's 2026-10-28 decision; staging access controls remain in place.
- **Production readiness:** NOT CLAIMED

## Current local workspace verification — 2026-10-28

The last full workspace-quality run covered the application/test source committed as
`f576883983ff7e3a659c94fee307c120ab5910a1`. `pnpm install --frozen-lockfile`,
workspace typecheck, all 191 workspace tests (49 scripts, 88 API, 54 game),
and workspace production builds passed. The scripts suite includes three
promotion-policy unit tests and eleven CLI regression tests that run the actual
verifier against synthetic temporary repositories. They cover complete and
evidence-only updates, every required and omitted release status, environment
assertions, branch and commit provenance, safe evidence paths, rejection of
later application changes, and missing, malformed, or non-object result files.
The configured `workspace-quality` workflow finished successfully. The
workflow does not run the public Playwright suite; its previous recorded 6/6
browser result is kept separately and is supplemental only.

This is local workspace evidence, not a Railway deployment or live staging
certification. The physical profile-sync check used the staging runtime source
`1cf6e5ff1c58833992b9b782ef90d437b4e4cc43`; its three current successful
deployments and device details are recorded below. The workspace-quality test
source was `f576883983ff7e3a659c94fee307c120ab5910a1`; at the time of the
read-only staging metadata check, `origin/staging` pointed to that source.
Subsequent staging-branch updates were evidence-only; no runtime files changed
after the deployed runtime source. Other live staging checks retain their
individual source identifiers. The owner-confirmed Replit invite-only policy
change does not alter the protected Railway staging gateway or any other
release criterion. The exact local result is recorded in
`STAGING-TEST-RESULTS.json` under `latestLocalWorkspaceCheck`; the promotion
gate remains **PENDING**.

## Earlier promotion-gate recheck — 2026-10-28, before paired-device sync

The owner confirmed Replit invite-only deployment is not required for launch.
The verifier checked only the four explicit environment assertions; all four
remain confirmed. At that checkpoint it exited 1 and kept promotion blocked
because the overall evidence was pending and sign-up/sign-in, physical
cross-device profile sync, account progress/inventory/history isolation,
server-owned reward and duplicate-claim coverage, restart notification/lifecycle,
and live interrupted-reward denial were incomplete. The paired physical sync
was subsequently reported as passed; the latest gate result is recorded below.
The separate staging access gateway remains in place. No setting was changed
and no deployment was triggered by this policy update.

## Owner-approved Android-only device scope — 2026-10-28

The owner confirmed that iPhone/Safari must not be required. Android Chrome on
a physical phone is the required device scope. The REVVL 8 / Android 16 /
Chrome 156 staging endurance sample reached 360 active seconds and passed the
recorded duration and frame-pacing targets. Its memory-stability result remains
**INCONCLUSIVE**. The owner's touch-control, layout/scroll, sign-in/out, and
lifecycle reports are supplemental; they do not establish physical
cross-device profile sync or reward-ledger behavior.

The Android device evidence remains **PARTIAL**. iPhone/Safari is
**NOT_REQUIRED**. The separate physical cross-device profile-sync check is now
**PASS** based on the owner-reported paired-device test below. Live
interrupted/expired reward denial remains **PENDING**. The gate was not weakened
by changing the device platform scope.

## Owner-reported staging phone session retest — 2026-10-28

The owner confirmed the phone was on the Railway staging host. They reported
that sign-in loaded the profile, refresh preserved it, and sign-out followed
by re-sign-in worked. The phone was previously identified as a REVVL 8
(TMRV085G) running Android 16; the Chrome version was not supplied for this
retest.

This is owner-reported UI evidence only. No HTTP status, screenshot or network
capture, or deployment identifier was supplied for this retest, so it is not
bound to a verified running source revision. The check covered authentication
and session persistence only; it supplies no cross-device, account-isolation,
multiplayer-restart, or reward-ledger evidence. No match or reward result was
part of the reported check.

Accordingly, `signupAndSignin` remains **PARTIAL**, physical Android
certification remains **PARTIAL**, cross-device sync is **PASS** on owner-
reported evidence, and overall staging remains **PENDING**. Production readiness
remains **NOT CLAIMED**.

## Owner-reported physical Android profile sync — 2026-10-28

Read-only Railway deployment metadata showed the latest frontend, API, and
socket deployments all succeeded on branch `wfm-staging-socket-auth` at source
`1cf6e5ff1c58833992b9b782ef90d437b4e4cc43`:

| Service | Deployment | Status |
| --- | --- | --- |
| `wfm-app-staging` | `b11963fe-9de0-429c-a8d6-dcc27e3811d1` | SUCCESS |
| `wfm-api-staging` | `fbf44a4a-6e0b-4924-a26e-5a1b1fcbdb32` | SUCCESS |
| `wfm-socket-staging` | `1aef0a09-4ee3-4868-a4ed-6957d10f89da` | SUCCESS |

The owner reported using the same approved staging account on both physical
Android phones. The Samsung showed the `ARC` to `STRAFE` preference change and
the restoration to `ARC` without a manual refresh; neither phone showed a
profile error. The owner then signed out on both devices.

| Device | Reported details |
| --- | --- |
| REVVL 8 | TMRV085G, Android 16; Chrome version not supplied |
| Samsung Galaxy A42 5G | SM-A426U, Android 13; Chrome version not supplied |

This satisfies the documented paired physical-device sync behavior and is
recorded as **owner-reported PASS**, not agent-observed browser evidence.
Network type, exact test time, screenshots, and request/response traces were
not supplied. The reversible preference was restored. Possible unclaimed
staging sortie records were not inspected or deleted; no match or reward result
was part of this test. This does not pass account isolation, reward integrity,
multiplayer restart, or the overall staging gate.

## Owner-reported two-account profile refresh check — 2026-10-28

The owner used separate approved staging accounts on the REVVL 8 (Account A)
and Samsung Galaxy A42 5G (Account B). They reported that each phone retained
its own profile after refresh, neither showed a profile error, and both were
signed out afterward.

This confirms separate account sessions and profile refresh behavior at the
owner-reported UI level. At that earlier check, specific saved progression,
inventory, history, or balance markers were not recorded, and no cross-account
write attempt was made.
Therefore the broader account progress/inventory/history isolation gate remains
**PARTIAL**. No match, reward claim, purchase, or profile-setting write was part
of that check.

## Owner-reported two-pilot staging match — 2026-10-28

In a later private Railway staging room, the owner used separate approved
accounts on the REVVL 8 (Account A) and Samsung Galaxy A42 5G (Account B). Both
pilots appeared in the room, fought on opposing teams, and the match reached
debrief. The owner reported that movement and weapon controls worked on both
phones. Each account received a different credit award; after returning to the
Hangar and refreshing, the owner confirmed that the two balances remained
separate.

This is **owner-reported PASS for the narrow live two-pilot gameplay and
balance-persistence check**. Exact credit amounts, pre-match balances, reward
event IDs, and server ledger records were not supplied or inspected. Duplicate
or replayed claims, interrupted/expired reward denial, and cross-account access
or write attempts were not part of this match. Therefore
`accountProgressInventoryAndHistoryAreIsolated` and
`serverOwnedRewardsAndDuplicateClaims` remain **PARTIAL**. The normal match
created staging match/reward records and changed staging balances. No
Production data, settings, or deployment were changed.

## Owner-reported cross-device account-swap check — 2026-10-28

After the match, the owner signed out and swapped the two accounts between the
phones: Account B on the REVVL 8 and Account A on the Samsung Galaxy A42 5G.
They signed in on both phones, checked the profiles, refreshed, and reported
that each account still showed its own correct, different credit balance. The
owner also reported signing out on both phones afterward.

This is **owner-reported PASS for the narrow cross-device profile and balance
continuity check**. Exact balances, screenshots, and network traces were not
supplied. No match, reward claim, purchase, or profile write was performed in
this check. This balance-only check did not test whether one account can access
or change the other's inventory, history, or world state; the subsequent
inventory check is recorded below and still does not test unauthorized access.
The broader
`accountProgressInventoryAndHistoryAreIsolated` gate remains **PARTIAL**.

## Owner-reported cross-device inventory check — 2026-10-28

The owner then used both approved staging accounts on both phones. They
reported that each account continued to show its own inventory after the
accounts were switched between the REVVL 8 and Samsung Galaxy A42 5G. This was
a read-only profile check; no flight, reward claim, purchase, or inventory
change was reported.

This is **owner-reported PASS for inventory continuity across the two accounts
and two phones**. The response did not confirm whether mission history was
checked, and no direct attempt to open or change the other account's data was
made. Therefore mission-history isolation and broader cross-account access
protection remain unverified, and
`accountProgressInventoryAndHistoryAreIsolated` remains **PARTIAL**.

## Latest staging promotion-gate recheck — 2026-10-28

The verifier was rerun after the owner-reported cross-device inventory check
with `PR_HEAD_REF=staging` and local HEAD
`45d9538c9f6991096ed64467205c96f7bf513c1a`; the tested application source was
`f576883983ff7e3a659c94fee307c120ab5910a1`. Required environment assertions
passed. The command exited 1 as expected. Paired-device sync, the two-pilot
match, account swap, and inventory check add owner-reported evidence but do not
clear mission-history isolation, duplicate/interrupted reward, or restart
gates. The exact remaining conditions are:

- Overall staging evidence must reach `PASS`.
- Sign-up/sign-in must reach `PASS`.
- Account progress, inventory, and history isolation must reach `PASS`.
- Server-owned rewards and duplicate-claim checks must reach `PASS`.
- Restart notification/lifecycle must reach `PASS`.
- Live interrupted/expired reward denial must reach `PASS`.

No interrupted/expired reward-claim request was submitted in this gate check.
The later ordinary match and credit awards are recorded above; they do not
certify interrupted/expired or duplicate-claim denial. No Production settings
or deployment were changed. The gate remains intact and
`productionReadiness` remains `NOT_CLAIMED`.

## Staging profile refresh on the aligned auth-bridge revision — 2026-10-28

Read-only Railway metadata confirmed the staging frontend, API, and socket are
all live on branch `wfm-staging-socket-auth`, source commit
`1cf6e5ff1c58833992b9b782ef90d437b4e4cc43`, with successful deployments and no
staged changes. Inspection of that deployed source confirmed the frontend auth
bridge and API client bearer-header transport are present. The focused local API
auth-configuration test passed 1/1; it is not a live credential test.

After unlocking the private staging access gate, the owner reported that the
profile loaded normally after refresh. This is owner-reported UI evidence only:
no HTTP status, browser network record, or device details were captured for
this confirmation. No fresh sign-in challenge was sent by the agent and no
saved verification code was used. The `signupAndSignin` certification remains
**PARTIAL**, overall staging remains **PENDING**, and cross-device sync,
reward-integrity, and Production checks remain separate. No staging settings,
player data, or Production configuration/deployment were changed.

## Live profile-session synchronization — 2026-10-26, 14:29 UTC

The approved staging push reached Railway `SUCCESS` at deployment
`c5bbc4ec-5ea1-4677-8b37-dcfa0e491d4f`, serving the tested source above.
The deployed API/shared source was checked unchanged from that source.
CI's **Verify workspace** job passed; **Verify staging evidence** remains blocked.

Three independent browser contexts completed Development sign-in using existing
approved accounts and fresh private client-trust codes. Writer and reader
identities were compared in memory and confirmed equal; the isolation account
was confirmed distinct. No identifiers or credentials were recorded.

- The first pilot loaded 130 credits, revision 6, ARC in both fresh sessions.
- A server-accepted temporary STRAFE selection returned HTTP 201. The idle
  reader's visible Settings selection changed automatically after **26,779 ms**,
  without reload, a manual profile request, or a synthetic refresh event.
- Restoring ARC returned HTTP 201 and also appeared automatically in the reader.
  All original returned profile fields were restored except revision, which
  advanced to 8. Credits remained 130.
- The second pilot's entire returned profile stayed unchanged at revision 0
  with 90 credits and ARC.
- There were zero reward requests and zero uncaught page errors. Two unclaimed
  staging sortie records were created by the selection writes; no flights or
  reward claims were submitted.
- Each session returned profile HTTP 401 after sign-out. All browsers were closed.
- Private staging API/socket services still have zero public domains. No
  Production changes were performed.

This is **PASS for same-account cross-session UI sync and restoration**, not a
claim of two physical devices, inventory/history endpoint isolation, rejected
cross-account writes, or complete release readiness. The physical-device gate
and broader account isolation checks remain pending. Sanitized machine-readable
details are in `STAGING-TEST-RESULTS.json` under `latestLiveProfileSync`.

## Current-source staging deploy and mobile smoke — 2026-10-26, 16:47 UTC

The verified `staging` branch update reached Railway `SUCCESS` on source
`4e8ab0a1306f0b120c0169bb9c71a561d57b898f`; the private gateway started
successfully. The unauthenticated `/` and `/play` routes returned the private
access page with HTTP 401, while the deliberately public gateway health endpoint
returned HTTP 200. The approved staging access code unlocked the browser session;
its value was not recorded.

The current deployment loaded Solo Flight, initialized WebGL, and placed all
four flight-control bounds inside both simulated mobile viewports (390×844 and
844×390). Exiting returned to the solo setup panel. There were zero uncaught
page errors. This used a browser viewport and software graphics, not physical
phones. Clerk sign-in and persistent progression/reward behavior were not tested.

This smoke verifies only basic private access and current-source gameplay
availability. It does **not** change `testedSourceCommit` or any required
release-test status; the full gate remains **PENDING**.

## Live protected-staging WebSocket room smoke — 2026-10-26, 17:17 UTC

Ten temporary clients joined a unique room through the protected staging
gateway and received ten distinct seats split 5v5. The server rejected an
eleventh join, a non-host start, a host start before all pilots were ready, and
a late join after launch. Once all ten pilots were ready, the host start reached
all clients. One disconnected pilot reconnected with its seat token, reclaimed
the same seat and team, and received an acknowledgement for active-match input.

All temporary sockets were closed and the staging access session was logged
out. No account sign-in, reward request, or persistent player-data write was
made. The match was started but not run to completion. This is live
protocol-level staging evidence, not browser invite-UI, physical-device, or
ten-client final-result evidence. The release gate remains **PENDING**.

## Live protected-staging ten-client match — 2026-10-26, 17:23 UTC

Ten scripted protocol clients completed a live staging match with a 5v5 seat
assignment. Two clients were disconnected and reconnected during the match;
both reclaimed their original seat and team. All ten clients received input
acknowledgements, remained connected at the finish, and observed the same final
outcome and result fields. The match ended in a loss at 229.63 game seconds;
that is a completed game result, not a test failure.

No account sign-in, reward request, or Production modification was involved.
This passes the staging server-level match-completion and ordinary
disconnect/reconnect checks. It does not verify browser invite UI, human
gameplay, physical-device or packet-loss behavior, or reward persistence; those
remain separate checks. The overall release gate remains **PENDING**.

## Authorized Railway staging socket restart — 2026-10-26, 17:34 UTC

An active two-client match was running when the existing Railway staging socket
deployment was restarted in place. Neither client received the `interrupted`
notice; both connections ended with WebSocket close code `1006`. Railway logs
showed the old command terminated by `SIGTERM`, followed by the socket service
listening again, and the service health check returned healthy. The deployed
restart-notification requirement therefore **FAILS**, despite the separate
local direct-`SIGTERM` check passing.

After recovery, the old room's reconnect token was rejected as
`session_lost`, and two clients successfully joined, readied, and started a
fresh room. This passes fresh-room recovery and partially verifies old-room
rejection. No reward claim was attempted, so interrupted-match reward
protection remains unverified. No Railway configuration was changed during
this first test; the overall staging release gate remained **PENDING**.

### Local signal-forwarding isolation

On an isolated local port, the configured `pnpm --filter
@workspace/api-server start:socket` command did not deliver a shutdown notice
or close its active clients within ten seconds after SIGTERM was sent to the
pnpm process. Starting the compiled socket directly with Node delivered the
notice to both clients and closed both with code `4002`. Together with the live
Railway result, this points to command-level signal forwarding as the likely
boundary rather than the socket's direct-Node shutdown handler.

The Railway start command was inspected read-only at this point. The user later
authorized a staging-only start-command change; the live retest below records
its result. Production settings remain untouched.

## Staging restart retest after direct-Node start command — 2026-10-26, 17:56 UTC

With explicit user authorization, the staging socket start command was changed
to `exec node --enable-source-maps artifacts/api-server/dist/socket.mjs`. The
staging deployment completed and the socket service returned healthy. An active
two-client match was then interrupted by an in-place Railway restart. Neither
client received the `interrupted` notice; both closed with code `1006`.

After the service recovered, two clients joined, readied, and started a fresh
room. Fresh-room recovery **PASS**; deployed restart notification remains
**FAIL**. A separate local integration test using the staging gateway and a
direct Node socket process delivered the notice to both clients and closed
cleanly with code `4002`. This narrows the difference to the live Railway
restart path, but does not prove which platform layer prevents graceful
delivery. No account sign-in, reward request, or Production modification was
involved.

## Authenticated staging browser restart check — 2026-10-26, 18:56 UTC

An existing approved staging account signed in and loaded its profile
successfully. One browser pilot created and started a room with the remaining
seats filled by AI. After the staging socket restart, the game left the active
match and displayed the server-restart message, including that no match rewards
were issued. The `session_lost` fallback was not shown because the browser
received the server-restart reason. The browser test did not capture a WebSocket
close code.

The browser UI check **PASS**es for this one pilot: no reward-claim request was
made, no page errors were recorded, and the staging service recovered. The
all-player restart criterion remains **PARTIAL**: the prior two-client protocol
test closed both clients with `1006` and received no notice, so this single
browser result does not establish consistent notification to every pilot.
Production was not modified.

## Browser recovery to a fresh room — 2026-10-26, 19:27 UTC

A second authenticated staging browser run started an online room and active
match, then the staging socket was restarted. The browser displayed the
server-restart/no-rewards message, returned to the menu, and created a distinct
new room from that screen. The pilot readied and started the new match
successfully; three canvases were present, with zero page errors and zero
strike-claim requests. The browser close code was not captured.

Fresh-room browser recovery **PASS** for one pilot. The all-player notification
criterion remains **PARTIAL** because the earlier two-client raw protocol run
closed both clients with `1006` and no notice.

### Reward-claim scope

The staging browser made zero strike-claim requests during either online-room
restart check. Code inspection confirms online matches take a separate
`onlineSession` completion/interruption path and do not call the server-owned
Strike claim endpoint; that endpoint requires a separate server-authorized
single-player run ID and replay. Sending a valid Strike claim here would test a
different run and could award credits, so no synthetic claim was sent. The
online browser no-claim check **PASS**es; the broader server-side interrupted
claim gate remains **PARTIAL** rather than being inferred from that check.

## Earlier scoped reward evidence — 2026-10-26, 12:58 UTC

### Subsequent runtime and session audit

See `docs/game-runtime-forensic-report.md` for the development audit and fixes.
Both existing staging accounts subsequently completed sign-in: the first
retained 130 credits across a fresh sign-in and reload, while the second
retained 90 credits across sign-in and reload. Each returned HTTP 401 after
sign-out. This establishes observed balance separation, not full account-data
isolation or physical-device synchronization. The live section above supersedes
the earlier audit's deployment limitation for profile-session sync only; the
release gate remains **PENDING** and Production was not changed.

An explicitly authorized normal staging skirmish completed with an accepted
server reward: 90 → 130 credits. Its one identical duplicate returned
`replayed: true` and added no credits; an authenticated reload still showed 130.
Sign-out returned the profile to HTTP 401 and the browser was closed.
See `docs/staging-deterministic-reward-flight-evidence.json` and
`docs/staging-reward-parity-flight-report.md`.

This supersedes the reward-flight blocker only. The historical table and
overall release status remain pending: physical-device synchronization, full
account isolation, campaign, and deployed multiplayer checks are not established
by one skirmish or the scoped profile-session test. Production was not changed.

Keep this report free of secret values, player identifiers, private deployment URLs, and personal data. Put sanitized evidence in this repository and list its paths in `STAGING-TEST-RESULTS.json`.

| Check | Result | Evidence |
| --- | --- | --- |
| Staging Repl, database, and Clerk environment are isolated from production | PASS — owner-confirmed; protected Railway staging is separate | `STAGING-TEST-RESULTS.json` environment evidence |
| Railway staging deployment revisions vs. tested source | PASS for the socket service — staging is pinned to tested source `896c490` (`81498a06` SUCCESS; `/healthz` PASS). Railway deployment metadata names branch head `bc87f40`, while the socket’s explicit source pin remains `896c490`. The app branch deployment is also successful; no other Railway settings or Production configuration changed. This does not clear the separate promotion gate | `STAGING-TEST-RESULTS.json` `latestStagingSocketDeployment`; `latestStagingPostRestartHealth` |
| Reproducible workspace typecheck, tests, and builds | PASS — frozen-lockfile install, typecheck, 72 API tests, 35 game tests, workspace production builds, and six public Playwright tests passed for local commit `896c490` | `STAGING-TEST-RESULTS.json` `latestLocalWorkspaceCheck` |
| Replit invite-only deployment configuration | NOT REQUIRED — owner confirmed this is not a launch requirement on 2026-10-28. The protected Railway staging gateway remains in place | Owner policy decision; staging access is separately controlled |
| Development landing page loads | PASS — Replit preview checked; sign-in not exercised | |
| Solo Practice gameplay lifecycle | PASS — preview-only WebGL2 run completed the 120-second match, showed a draw reason and debrief, and returned to setup and home; no sign-in or reward persistence was used | `STAGING-TEST-RESULTS.json` previewGameplay |
| Sign-up/sign-in and profile loading | PARTIAL — three fresh staging contexts signed in and loaded profiles; sign-out returned 401. The local public E2E test renders the Clerk sign-up form with Development keys; no Production sign-in or new-account creation was tested | Live profile-session section; `latestLocalWorkspaceCheck.clerkConfigurationCheck` |
| Profile persistence across fresh sessions | PASS — both first-pilot contexts loaded the saved 130-credit profile and restored selection | Live profile-session section |
| Automatic same-account sync across independent browser contexts | PASS — visible selection changed after 26.8 seconds without reload and restored automatically | Live profile-session section |
| Synchronization across distinct physical devices | PENDING — independent browser contexts are not physical-device evidence | |
| Two-account isolation for progression, credits, inventory, and history | PARTIAL — earlier reversible profile-sync writes left the second account's returned profile unchanged. The latest two-account probe confirmed a foreign-user profile query returns the caller's profile and a write carrying a foreign user ID is rejected with HTTP 400; a repeat before/after check was stable. World-state cross-account mutation and any distinct history/inventory surface remain unverified | `latestLiveProfileSync`; `latestStagingAccountAndRoomUiCheck` |
| Staging economy uses staging data | PASS — one accepted salt buy and sell-back succeeded in staging. The second account observed shared stock decrease and restoration; buyer inventory/cargo returned to baseline, observer inventory stayed unchanged, and no credits were created | `latestStagingSharedMarketTradeCheck` |
| Server-owned rewards and duplicate-claim protection | PARTIAL — one authenticated staging skirmish received a server-accepted reward; its identical duplicate added no credits, and the balance survived reload. Broader replay, interruption, and campaign coverage remains pending | `latestAuthenticatedRewardFlight` |
| Restart interrupts active match and notifies players | PASS for the two-client protocol check — both active pilots received `server_restart`, wrote acknowledgements, and closed with the existing 4002 code. Railway logged `acknowledged=2`, `timedOut=0`, and `sendErrors=0`; the service then logged that it was listening on port 8099. This is not a browser or physical-device check | `latestLocalWorkspaceCheck.socketLifecycleRegression`; `latestStagingSocketDeployment`; `latestStagingSocketRestartCheck` |
| Interrupted match cannot award rewards; old room is rejected | PARTIAL — after restart, the old reconnect token was rejected with `session_lost`; no reward claim was attempted, so live claim-ineligibility evidence remains pending. The local regression expired a genuine server-issued run before claim and confirmed unchanged credits/progress/profile revision and zero reward events | `latestStagingSocketRestartCheck`; `latestLocalExpiredRunRewardCheck`; `artifacts/war-for-mars/src/game/WarApp.tsx`; `artifacts/api-server/src/game/progression.test.ts`; `artifacts/api-server/src/routes/strikes.ts` |
| New room works after restart | PASS — after service recovery, two protocol clients joined and started a distinct fresh room; this is not a browser or physical-device check | `latestStagingSocketRestartCheck`; `latestStagingPostRestartHealth` |
| Temporary disconnect reconnects while server remains running | PASS — two clients reclaimed their same seats and teams during a live staging match; browser-client and physical-device behavior remain unverified | `latestLiveTenClientMatch` |
| Room creation, invite, ready-up, team assignment, and late-join handling | PASS — two existing staging accounts joined the same room by code, received separate team assignments, and started only after both were ready; protocol checks also verified ten 5v5 seats and late-join rejection | `latestStagingAccountAndRoomUiCheck`; `latestLiveMultiplayerRoomSmoke` |
| Ten clients complete a match with consistent final results | PASS — all ten clients received the same completed result after two controlled reconnects; scripted protocol clients, not human gameplay | `latestLiveTenClientMatch` |
| Automated network impairment harness | PASS — latest suite used ten simulated clients with 35 ms latency, 20 ms jitter, 12% frame loss, and two reconnects; that run ended at 180.7 simulated seconds. Synthetic only, not deployed or real-network verification | `STAGING-TEST-RESULTS.json` latestNetworkHarness |
| Current Railway staging service health | PASS for current availability — app, API, socket, and database are all live with successful latest deployments and no pending changes; socket source pin is `896c490`. Railway still records five failed deployments in the 24-hour window: earlier healthcheck/config failures for the gateway access-code format, API database URL, and socket origin allowlist; each affected service later deployed successfully. These are not current workspace build failures and do not complete the release gate | `STAGING-TEST-RESULTS.json` `latestStagingPostRestartHealth`; historical window in `currentStagingRailwayHealth` |
| Current-source private staging/mobile smoke | PASS for limited smoke only — anonymous root and play routes are gated; approved access reached Solo Flight with WebGL, four controls in bounds across portrait/landscape, and clean exit. No sign-in or persistent progression test; not physical-device evidence | `STAGING-TEST-RESULTS.json` `latestStagingMobileSmoke` |
| Railway Production Clerk release | NOT CERTIFIED — current Railway API, frontend, and socket services are online and required Clerk variable names are present; no secret values were read. Clerk instance pairing and Production sign-in remain unverified because the connected Clerk API is Development. Public issuer/JWKS availability does not prove Railway Production connectivity | `STAGING-TEST-RESULTS.json` `railwayBackend.currentReadOnlyInventory`; `docs/game-runtime-forensic-report.md` |

## Local development socket checks

These checks ran in the staging Repl's development workspace. They do not establish deployed behavior or production readiness.

- **Authentication gate: PARTIAL.** The unauthenticated browser preview shows the Clerk create-account/sign-in screen, and an unauthenticated profile request returned `401`. No login or account creation was exercised in this check. Replit invite-only deployment is not a launch requirement by owner decision.
- **Room-code access: PASS locally.** A malformed short code was rejected. Two clients using the same generated code joined one lobby; a different valid code created an isolated room. The room code is a bearer invite, not account authentication; anyone who knows it can join an open lobby. Late join after match start was rejected. No generated code was retained in this report.
- **Live local 5v5: PASS for a 30-second smoke test.** Two WebSocket clients started a ten-seat match with eight AI seats, exchanged sequenced inputs through `lastSeq` 299, and each received 491 snapshots with 491 identical snapshot samples in common. This was not a six-minute match, ten human clients, or a real-network test.
- **Live socket smoke: PASS.** A client joined, readied, started, received an input acknowledgment in a snapshot (`lastSeq`), disconnected and reclaimed the same active seat. A second room had independent state. Empty seats were AI-controlled; this was not a ten-human match.
- **Direct Node `SIGTERM`: PASS.** An active match received input, then the compiled socket process received `SIGTERM`. The client received `interrupted` before close code `4002`.
- **Managed workflow restart: FAIL.** Restarting the Replit-managed Wing Socket workflow closed the active client with code `1006` and no `interrupted` notice, including after the shutdown send was changed to wait for its callback. This development workflow result is not interchangeable with direct Node `SIGTERM` or a deployed restart.

Passing these staging checks does not establish production readiness.

## Two-account staging API and browser room check — 2026-10-26, 19:54 UTC

Two existing approved staging accounts signed in successfully, loaded profiles,
and were signed out to HTTP 401. Authenticated `/api/world` and `/api/market`
reads returned HTTP 200 with data for both. A profile request from the first
account carrying the second account's user ID still returned the caller's
profile; a profile action with that foreign ID was rejected with HTTP 400.
The first full-profile comparison was not stable, so it was not counted as
isolation evidence; a subsequent stability check and a second before/after
comparison around the rejected write were stable. No account was created and no
market trade or reward claim was made.

The first browser room attempt was inconclusive because the test helper did not
identify the failing wait. On retry with a corrected page-readiness wait, both
accounts joined the same room by code, appeared on separate teams, and the host
could not start until both pilots readied. The match then started in both
browsers with three canvases each and zero page errors or claim requests. This
completes the browser invite/readiness portion alongside the existing protocol
late-join checks. It does not establish market transaction sharing, world-state
cross-account writes, physical-device synchronization, or Production readiness.
Production was not modified.

## Fresh workspace-quality run — 2026-10-26, 19:58 UTC

`pnpm install --frozen-lockfile`, typecheck, all 70 API tests, all 32 game
tests, and workspace builds passed. Public Playwright E2E was not rerun in this
check; the earlier local suite remains recorded separately. This was a
workspace-only check and does not clear any live staging or Production gate.

## Staging market trade attempt — 2026-10-26, 20:11 UTC

Two fresh email-code submissions were attempted in separate existing staging
account contexts. Both remained at Clerk's `needs_client_trust` state and
neither had an authenticated profile. The market endpoint was not called, and
no trade or account/market data was changed. This leaves the shared transaction
check PARTIAL; it is an authentication-evidence blocker, not a reproduced game
or market defect. Production was not accessed or modified.

## Staging sign-in diagnosis and market trade — 2026-10-26, 20:23 UTC

The staging challenge displayed one six-digit code field and a visible
Continue button, with no visible error or Turnstile frame. Codes from the
earlier attempt left both contexts at `needs_client_trust`. Fresh codes for the
currently open challenges authenticated both existing accounts; both profile
requests returned HTTP 200. No sign-in code or email value was recorded.

The writer bought one unit of salt with a buy limit of 41 credits; the trade
and one-unit sell-back both returned HTTP 200. The second account observed
shared stock drop by one and return to its starting value, while its own
inventory stayed unchanged. The buyer's inventory and cargo returned to their
starting values. The buyer's balance ended two credits lower due to the market
spread/price impact, and the shared market revision advanced twice. No reward
claim requests or page errors occurred. Both accounts signed out to HTTP 401.
Production was not accessed or modified.

## Interrupted-reward and physical-device evidence attempt — 2026-10-27, 01:06 UTC

The live check used an existing approved staging account. The current
verification challenge did not establish an authenticated Clerk session, so the
attempt stopped without retrying. No profile request, Strike run, or claim
request was sent, and no player profile or reward state was changed. This is a
blocked sign-in attempt, not a pass or failure of the claim validator.

For this 01:06 UTC evidence attempt, physical-device testing was not performed:
no actual phone or tablet was connected to the environment at that time. The
later owner-reported Samsung Android checks are documented separately below.
Existing mobile viewport checks remain browser emulation only and do not satisfy
the physical-device evidence requirement.
The interrupted-reward claim and physical-device gates remain pending;
Production and the separate staging promotion gate were not changed.

## Interrupted-reward audit and physical-device preparation — 2026-10-27

### Reward-flow audit and deterministic regression

The online multiplayer and single-player Strike reward flows remain separate:

- On a socket `interrupted` packet, the browser acknowledges the notice, exits
  the active online match, clears its room token, and displays that no match
  rewards were issued. It does not call the Strike claim flow.
- Strike claims require a UUID run ID with a server-issued run belonging to the
  authenticated player. Online room codes are not Strike run IDs.
- At the time of the earlier live attempt, the approved staging profiles already
  contained progression and were not identified as disposable accounts. A live
  interrupted-room claim was not sent; this was deliberately **NOT RUN**, not a
  pass. A disposable account was added to Replit Secrets later, but the latest
  preflight still stopped because no safe read-only run/event inspection path
  was available.

The local deterministic integration test starts an active room, restarts the
socket server, receives `interrupted: server_restart`, acknowledges it, and
observes close code `4002`. After the restart, the former reconnect token is
rejected as `session_lost`. The room-code value fails the Strike UUID path
schema; a separate synthetic unknown UUID claim reaches the reward service and
is rejected with status `404`, `Sortie not found for this player.` The player
profile's credits, campaign clears, and revision remain unchanged; no Strike
run or progression-reward event is created.

The expired server-issued run test now repeats the same expired claim: both
service results are `{ "error": "expired" }`, with no profile or reward-event
change. The existing valid-claim regression also remains in the full suite:
concurrent identical requests award once, an identical retry is marked
`replayed`, and a changed replay is rejected with status `409` without another
profile or ledger write. This is deterministic local evidence. Separately, the
prior live staging record remains the evidence for one accepted reward
(90 → 130 credits), an identical duplicate adding zero credits, and persistence
after reload. That prior run was not an interrupted online room.

### Latest live interrupted/expired-run preflight

On 2026-10-27 at `2026-10-27T12:02:15Z`, the staging host returned HTTP `401`
for `GET /` with the expected private staging access-code page. No access code
was submitted. The approved disposable-account credentials are stored through
Replit Secrets; their values were not read or displayed. No Clerk sign-in,
profile request, or claim request was attempted.

At this preflight, all four Railway staging services were online with zero
reported failures or pending work. The app deployment was
`2bdf9127-6020-4d5f-9cc2-7063372f1fda` on commit
`a26cfa26dd6b45ccefc8dc26b78febf6d15c4da8`; the API deployment was
`3eb13bfb-7b48-4bfe-a7dd-b527df9d88d5` on source pin
`179064a436360a07357adf16174bb6d0f90bccd8`; and the socket deployment was
`81498a06-c441-4571-9790-f60bba00d4d1` on source pin
`896c4904e2c60623f93005a75a86c7b5487a3cdc`.

The deployed route surface and repository expose Strike start and claim POST
routes, but no read-only run inventory or run-status route. The connected
Railway management interface also has no read-only SQL query operation. There
is therefore no safe way to identify a genuine already-expired/interrupted run
and verify reward-event rows before and after its claim. No run was created,
no claim was sent, no state changed, and no cleanup was needed. This preflight
is **BLOCKED**, not reward-verification evidence; the release gate remains
`PENDING`.

### Live staging browser smoke (supplemental)

On 2026-10-27 from `12:21:48.829Z` to `12:21:51.819Z`, Playwright Chromium
using a Pixel 7 mobile emulation exercised the live staging host and unlocked
the staging page through its access form. HTTP results were `401` for the
initial access page, `303` for the access-form POST, and `200` for the unlocked
landing page. The no-reward solo flight setup launched and exited with a visible
canvas and WebGL2 available. At the emulated `412x915` viewport, the landing,
setup, and flight pages had no horizontal overflow; there were zero page errors
and zero reward-claim requests.

The staging gateway logout returned `303` and cleared the gateway cookie.
The browser context was closed; no Clerk sign-in, profile request, run, or
reward claim occurred. This is live website browser evidence only, **not**
physical Android evidence. It does not clear the interrupted-reward or physical
device release gates.

### Tester-reported physical Android observation before the scroll fix

On 2026-10-27, the staging owner confirmed the Railway staging host and reported
that sign-in reached a loaded profile on a physical Samsung Android phone. The tester's
notes described the portrait logo as centered with the visible interface fitting,
but the background shifted right; after rotating to landscape, the background
appeared fully visible. The tester also reported that vertical touch scrolling
did not work on the screen they were viewing, and confirmed they had not entered
a flight.

This is a partial user-reported observation, not a captured or complete device
certification. The exact Samsung model, Android and Chrome versions, viewport, network,
exact observation time, and screenshots were not supplied; other screens and
devices were not checked. No reward activity or preference change was reported.
The physical-device gate remains **PENDING**.

### Mobile scrolling fix and local verification

Commit `72e3c7a47d5509f89d88efac738787f9d9055972` restores natural vertical page
scrolling on content screens and removes fixed-height clipping from the landing,
home, lobby, profile/error, debrief, and hangar layouts. The active Arena remains
full-screen and touch-locked so page scrolling cannot interfere with flight
controls.

The frozen-lockfile install, workspace typecheck, all workspace tests, and
workspace builds passed. Results: scripts `17/17`, API `73/73`, game `35/35`;
Playwright public E2E `7/7`, including touch-scroll checks at `320x568` for the
landing and solo setup and an assertion that the Arena stays touch-locked.
These are local/browser checks only. The code was subsequently pushed to
`staging` and deployed successfully as Railway app deployment
`083ab007-cf97-49d5-a49c-92a631f96fae`, built from branch commit
`56c4fc7a435368055c99b4da8a93a844c4b38ebf` (which includes fix commit
`72e3c7a47d5509f89d88efac738787f9d9055972`). At verification, all four staging
services were online with zero issues and no pending work. A fresh `GET /`
returned the expected `401` private staging access-code gate; no code was
submitted. No Production setting or deployment changed.

### Post-fix physical Android scroll retest

After the updated staging app was deployed, the owner replied **“Works now”**
when asked whether vertical touch scrolling worked on the phone. This is a
partial user-reported pass for the sampled content screen(s); the exact screen
was not named. The phone model, Android/Chrome versions, viewport, network,
observation time, and screenshots remain unavailable. Other screens, devices,
orientations, and active-flight controls were not verified. No flight or reward
claim result was reported during this scroll retest.

This confirms the reported scroll issue is resolved on the sampled physical
Android screen, but it does not certify all phones or clear the full
physical-device gate. The interrupted-reward and physical-device release gates
remain **PENDING**.

### Tester-reported authenticated Practice result

The owner then reported using **Practice** and being at **Debrief**. They said
the ship returned with six kills and two relays, the hangar logged `172` credits,
there was no crate, and the displayed balance was `300 CR`. The user also
reported that the touch controls worked, but did not identify each control
tested or confirm the normal exit from Debrief.

Source review confirms the signed-in WarApp flow starts a server-authorized run
and submits its replay when the run ends. The reported credit gain therefore
strongly indicates a successful reward response, but no HTTP response or
read-only reward-ledger record was captured. This is **not** a no-reward
Practice test and does not test interrupted/expired reward denial. The owner
was advised to use the Hangar navigation only, not Fly Again or Retry
Verification, and not to spend the displayed credits. The owner then confirmed
the game was at Hangar. The Hangar navigation only changes the local game
screen; no claim request is made by that action. No follow-up claim, flight, or
account change was performed by the agent.

The previous device instructions incorrectly treated signed-in Practice as
no-reward. They are corrected to use the local `/play` Solo Flight route for
no-reward touch-control checks. This completed Practice result remains a
user-reported staging observation only; the live interrupted-reward and full
physical-device release gates remain **PENDING**.

### Tester-reported physical Android staging Solo Flight check

The owner then opened the staging `/play` route on a physical Samsung Android phone and
reported that the local no-reward notice was visible. After proceeding with the
local flight, they reported **“All tested controls worked.”** The specific
controls, flight statistics, post-flight balance, final screen, exact Samsung
model, Android/Chrome versions, viewport, network, and observation time were not
supplied. The owner stated screenshots and iPhone Safari were not required for
this Android-only verification.

This is partial user-reported physical staging evidence for the local flight
controls. The `/play` Solo Flight is separate from signed-in WarApp Practice and
does not use the server reward-claim flow. No direct network trace or reward
ledger was captured, and no staging balance change is claimed. This does not
verify interrupted/expired reward denial, profile sync, or the complete
physical-device matrix. Android device evidence remains **PARTIAL** and the
interrupted-reward gate remains **PENDING**. iPhone/Safari is not required under
the owner-approved Android-only scope; physical cross-device profile sync is a
separate pending feature gate.

### Latest tester-reported Android follow-up

After reloading staging, the owner reported that layout and scrolling “Works as
expected” on the same physical Samsung Android phone. They also reported that
profile sign-in/sign-out work and local Solo Flight runs without credits. Exact
phone model, Android/Chrome versions, screen size, network, tested screen names,
orientations, observation time, and screenshots were not supplied. This remains
partial user-reported evidence; no network-level reward-claim evidence was
captured. The Android physical-device evidence remains **PARTIAL** and the
interrupted-reward gate remains **PENDING**. iPhone/Safari is not required;
At this checkpoint, physical cross-device profile sync remained pending; the
later paired-phone result is recorded in the current evidence section above.

In a subsequent follow-up, the owner confirmed that all listed local phone
checks passed: both sticks together, fire while moving or aiming, ability,
touch release/cancel, rotate and background/restore, and exit Solo Flight. These
results are user-reported; exact device/browser metadata and independent
network-level evidence remain unavailable.

### Read-only staging inventory

Railway confirmed the separate `wfm-staging` project and `staging` environment
were healthy, with four services online, zero reported issues/failures, and no
pending work. No staging service was restarted, redeployed, or reconfigured for
this audit.

| Service | Configured source / revision | Current successful deployment |
| --- | --- | --- |
| App | `staging` branch; Railway deployment metadata commit `bc87f40aa17d27973c0aa799b86ecd412f8be71d` | `e53e8af8-0ed8-48f4-acf2-457eb7ed1d01` — `SUCCESS` |
| API | Pinned source `179064a436360a07357adf16174bb6d0f90bccd8` | `3eb13bfb-7b48-4bfe-a7dd-b527df9d88d5` — `SUCCESS` |
| Socket | Configured source pin `896c4904e2c60623f93005a75a86c7b5487a3cdc`; deployment metadata separately reports branch head `bc87f40aa17d27973c0aa799b86ecd412f8be71d` | `81498a06-c441-4571-9790-f60bba00d4d1` — `SUCCESS` |
| Staging Postgres | Isolated staging database service | `6922606e-d6f1-4665-94bc-227174685123` — `SUCCESS` |

These are inventory/deployment identifiers, not a claim that the interrupted
reward blocker passed live. Production was not queried or modified.

### Workspace and supplemental browser verification

Local commit `d764623471cb4abcc3d1e970e656a797bac9ad26` passed:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| Typecheck | PASS |
| Workspace tests | PASS — 17 scripts, 73 API, and 35 game tests |
| Workspace builds | PASS |
| Public Playwright browser suite | PASS — 6 tests, including portrait/landscape responsive controls and safe graphics-loss exit |

The Playwright viewport checks are supplemental browser automation, not physical
device evidence. At that checkpoint, the promotion statuses
`interruptedMatchCannotClaimRewards: PARTIAL` and
`profileSyncsAcrossDevices: PENDING` remained unchanged; the later physical
profile-sync result is recorded above.

### Physical-device evidence — owner-approved Android-only scope

The Playwright viewport checks did not exercise a physical device. The owner
approved Android Chrome as the required physical-device scope; iPhone/Safari is
not a release requirement. Later owner-reported REVVL 8 (TMRV085G), Android 16,
Chrome 156 checks are recorded above and in the mobile certification. The
Railway staging endurance sample reached 360 active seconds and met duration
and frame-pacing targets; memory stability is inconclusive. Touch controls,
scrolling, sign-in/out, and lifecycle checks are owner-reported. The exact
staging procedure and evidence template are in
`artifacts/war-for-mars/PHYSICAL-DEVICE-SMOKE-TEST.md`; the broader tactile
playtest remains in `PHONE-PLAYTEST-CHECKLIST.md`. Android physical-device
certification is **PARTIAL** pending the remaining Android checks and memory
repeat. At that earlier checkpoint physical cross-device profile sync remained
**PENDING**; it is now **PASS** on the owner-reported paired-phone evidence
above. Independent browser contexts are not physical-device evidence.

## Review of supplied implementation proposals — 2026-10-27

The two supplied code proposals were reviewed against the existing WFM
architecture. Their concerns about identity, duplicate claims, network changes,
and cross-device state are valid review areas, but their proposed
implementations are not safe to use as written:

- **Reward claims:** the examples trust `x-clerk-user-id`, accept
  client-calculated loot, use an in-memory run registry, and finalize state
  outside the existing database transaction. None of these were added. The
  current claim path derives identity from Clerk middleware, requires a
  server-issued run owned by that user, validates the replay, locks the run in
  a database transaction, and stores an idempotent replay result. Online room
  IDs and Strike run IDs are separate.
- **Regression coverage:** tests now send a forged `x-clerk-user-id` without a
  Clerk session and confirm the profile and claim routes return `401`. The
  strict claim-body schema also rejects the proposed `strikeRunId`,
  `reconnectToken`, and client-loot fields. Existing restart, expiry, replay,
  and reward idempotency tests remain in place.
- **Profile synchronization:** WFM uses the authenticated server profile route,
  coalesces refreshes, discards superseded responses, stops refreshes while a
  flight or account mutation is active, and remounts the game when the Clerk
  user changes. Local storage holds device preferences, per-user read-only
  snapshots, and durable pending-action intents; none is a source of awarded
  credits or campaign progress. The proposed `/api/profile/sync` route and
  local-progress overwrite were not added.
- **Evidence generation:** neither proposed report generator was added or run.
  They hard-code PASS-like values and overwrite the evidence record without
  observed requests, responses, accounts, or devices. The staging verifier
  continues to require exact `PASS` values, a tested source commit, and the
  listed evidence files.
- **Device coverage:** browser viewport tests remain supplemental only. No
  user-agent spoofing or browser emulation is represented as real Safari or
  Android device evidence; the physical-device gate remains pending.

No Production database or external Clerk sign-in was accessed, and no Railway
setting or deployment was changed. A later read-only Railway CLI preflight
checked Production service-variable presence and configuration status only; it
did not verify external Clerk key-instance pairing or perform sign-in.

Follow-up local verification on commit
`8cabc49fed9e6a1aafff73832411ed82b28d496a` passed frozen-lockfile install,
typecheck, all workspace tests (17 script, 73 API, 35 game), and workspace
builds. The staging promotion verifier was also run and correctly remained
blocked because `overallStatus` is `PENDING` and multiple live evidence fields
are not `PASS`.

The owner-reported Android checks are supplemental evidence, not an automatic
certification pass. The owner approved Android-only scope, so iPhone Safari is
not required. Memory stability remains inconclusive; at that time physical
cross-device profile sync and live disposable-account reward-denial were
pending. The subsequent paired sync is recorded above; reward denial remains
pending.

## Reward-integrity and Clerk preflight update — 2026-10-27, 17:37 UTC

### Safe local certification checks

The following local checks passed: **31 tests total**. No live staging or
Production claim was submitted, and no credits were awarded.

| Check | Command | Result |
| --- | --- | --- |
| Scripts and preflight/gate tests | `env -u DATABASE_URL pnpm --filter @workspace/scripts test` | PASS — 17/17 |
| Pure reward adjudication | `env -u DATABASE_URL pnpm --filter @workspace/api-server exec tsx --test src/game/rewards.test.ts` | PASS — 3/3 |
| Local unauthenticated progression/claim routes | `DATABASE_URL='postgresql://localtest:localtest@127.0.0.1:1/wfm-test-only' pnpm --filter @workspace/api-server exec tsx --test --test-concurrency=1 src/routes/progression.test.ts src/routes/strikes.test.ts` | PASS — 2/2; only local unauthenticated requests, HTTP 401; the loopback database target is deliberately unreachable |
| Server simulation determinism | `env -u DATABASE_URL pnpm --filter @workspace/api-server exec tsx --test src/game/sim-determinism.test.ts` | PASS — 4/4 |
| Browser/server simulation parity | `env -u DATABASE_URL pnpm --filter @workspace/war-for-mars exec tsx --test src/game/sim-parity.test.ts` | PASS — 5/5 |

The local route checks did not reach a database or submit an authenticated
claim. No live interrupted/expired reward-denial request was made.

### Production Clerk structural preflights

Using Railway CLI variable injection for the selected Production frontend and
API services, both value-safe structural preflights passed their structural
checks and exited `2` because manual enablement requirements remain blocked.
The frontend publishable-key variable was present; the production origin was
not checked in frontend scope. The API publishable- and secret-key variables
were present, and its exact production origin check matched. The public
issuer/JWKS inputs matched the configured preflight inputs; this does not prove
that the key pair belongs to the external Production Clerk instance.

External Clerk key-instance pairing, email delivery, an approved dedicated
Production test account, and protected API/session smoke tests remain
unverified. No Production sign-in was attempted, and no Production Clerk or
Railway setting or deployment was changed. No secret values were printed.

### Live reward-denial blocker

Live interrupted/expired reward-denial remains **PENDING**. Disposable-account
verification could not be established, the current staging API-to-isolated
database binding could not be verified, and no read-only run-status/reward-event
inspection path was available. No live claim was submitted and no credits were
awarded. This does not change the separate staging promotion requirements.

### Read-only Railway environment status

At `2026-10-27T17:37:14Z`, a read-only Railway status inspection checked the
staging and Production environments over the preceding 24 hours. All listed
services were online, with zero reported service issues, zero recent failed
deployments, and no pending work:

| Environment | Online services |
| --- | --- |
| Staging (4) | `wfm-app-staging`, `wfm-socket-staging`, `wfm-api-staging`, `Postgres` |
| Production (6) | `@workspace/war-for-mars`, `@workspace/api-server`, `@workspace/wing-socket`, `@workspace/mockup-sandbox`, `@workspace/war-for-mars-launch-video`, `Postgres` |

This is service-health evidence only; it does not establish Production Clerk
readiness or clear any release gate. No service was changed or deployed.

### Physical-device evidence reconciliation and token cleanup

The owner's Android sign-in/sign-out, local Solo Flight, controls, and
layout/scroll observations are **supplemental user-reported staging evidence**.
The owner identified the phone as a REVVL 8, model TMRV085G, on T-Mobile, and
confirmed Android 16 and that `1.15.12` is the phone model-build string. The
staging endurance report records Chrome 156.0.0.0 and 360 active seconds; the
owner confirmed it came from Railway staging. Duration and frame-pacing targets
passed, but memory stability remains inconclusive. Two portrait screenshots
show the staging landing page and local Solo Flight setup with its no-reward
notice; they do not show active-flight controls or paired profile
synchronization. iPhone/Safari is **NOT REQUIRED** under the owner's approved
Android-only scope. Android certification remains **PARTIAL**. At this earlier
reconciliation checkpoint, physical cross-device sync and live
interrupted-reward were pending; the paired sync is now recorded as owner-
reported PASS above, while interrupted-reward remains pending.

`RAILWAY_TOKEN` was present and used only to inject Production service variables
for the read-only preflights. It has **not** been revoked or deleted: no safe
token-revocation operation or Replit-secret deletion operation is available to
this workspace. Owner-side token revocation and secret removal remain
outstanding. No token value was recorded.

Overall staging status remains **PENDING** and Production readiness remains
**NOT CLAIMED**. The current local workspace verification and exact source
commit are recorded in the current-workspace section at the top of this report;
it does not replace live staging evidence tied to the individual deployed
revisions above.

## Additional safe staging-gate checks — 2026-10-28, 17:33 UTC

On staging source commit
`f3fd084269a419f33e643c25f007bd08787779fb`, the following additional local
checks passed: **62 tests total**. These are code-level checks, not live
staging claims or Production verification.

| Check | Result |
| --- | --- |
| Scripts, Clerk preflight, and promotion-gate tests | PASS — 47/47 |
| Synthetic Clerk API auth-options regression | PASS — 1/1 |
| Pure reward adjudication | PASS — 3/3 |
| Unauthenticated progression and claim routes | PASS — 2/2; requests returned 401, with a deliberately unreachable loopback database URL |
| Server simulation determinism | PASS — 4/4 |
| Browser/server simulation parity | PASS — 5/5 |

No authenticated reward claim was sent, no credits were awarded, and no
Production settings or deployments were changed.

This 17:33 gate result predates the paired physical sync reported above. Its
`profileSyncsAcrossDevices: PENDING` result is historical; the latest recheck
above no longer lists profile sync as a blocker.

The promotion verifier was run with `PR_HEAD_REF=staging` and the current
source commit as `PR_HEAD_SHA`. It exited 1 and correctly remained **BLOCKED**:
`overallStatus` is `PENDING`, and these required live checks are not `PASS`:

- `signupAndSignin` — `PARTIAL`
- `profileSyncsAcrossDevices` — `PENDING`
- `accountProgressInventoryAndHistoryAreIsolated` — `PARTIAL`
- `serverOwnedRewardsAndDuplicateClaims` — `PARTIAL`
- `restartEndsMatchAndNotifiesPlayers` — `PARTIAL`
- `interruptedMatchCannotClaimRewards` — `PARTIAL`

As of this 17:33 check, the interrupted/expired reward-denial test remained
blocked because disposable account verification, staging database isolation,
and a read-only run/event inspection path were not established. At that time,
physical Android evidence was `PARTIAL`, memory stability was inconclusive, and
paired-device profile sync had not yet been run. Later owner-reported paired
sync and a two-pilot staging match are recorded in the newer sections above;
they do not change the still-pending reward-denial, broader account-isolation,
restart, or full physical-performance criteria.

## Control-scheme persistence issue and local fix — 2026-10-28

After the cross-device inventory check, the owner reported that credits and
inventory remained associated with their accounts, but the ARC/STRAFE control
choice did not persist when signing out and switching accounts. Mission history
was not confirmed, and no direct cross-account read or write was attempted.

Code inspection confirmed the control scheme was changed only in client state;
the server profile was updated only when a server Strike started. The fix adds
an authenticated profile update using the existing account-owned scheme field.
It does not change credits, inventory, history, database schema, or progression
revision, and it rejects stale UI responses after an account switch.

The fix was committed as `8417c48645e83f1cc9b0a3c936a33e86cc866628` and pushed
to `origin/staging`. A read-only Railway check immediately after the push, but
before source alignment, showed all four staging services online with no
pending work. At that point the frontend, API, and socket still ran source
`1cf6e5ff1c58833992b9b782ef90d437b4e4cc43`:

| Service | Pre-alignment deployment | Status | Running source |
| --- | --- | --- | --- |
| `wfm-app-staging` | `b11963fe-9de0-429c-a8d6-dcc27e3811d1` | SUCCESS | `1cf6e5ff1c58833992b9b782ef90d437b4e4cc43` |
| `wfm-api-staging` | `fbf44a4a-6e0b-4924-a26e-5a1b1fcbdb32` | SUCCESS | `1cf6e5ff1c58833992b9b782ef90d437b4e4cc43` |
| `wfm-socket-staging` | `1aef0a09-4ee3-4868-a4ed-6957d10f89da` | SUCCESS | `1cf6e5ff1c58833992b9b782ef90d437b4e4cc43` |

The pre-deployment observation above was resolved by the approved source
alignment and deployment recorded below.

Local verification for this change: frozen-lockfile install **PASS**;
typecheck **PASS**; workspace build **PASS**; game tests **54/54 PASS**;
scripts tests **49/49 PASS**; focused control-scheme schema test **1/1 PASS**;
focused unauthenticated/forged-identity route test **1/1 PASS**. The full API
test suite could not be safely completed: the configured database target was
not verified as an isolated test database, so database-writing tests were not
run. With `DATABASE_URL` unset, six API test files failed during import because
the database client requires that variable; 66 API tests in that run passed.
The profile mutation persistence test is present but remains **NOT RUN**.
No database test writes occurred. Production settings, data, and deployments
remain untouched.

## Approved Railway staging deployment — 2026-10-28

After the owner approved deploying all three staging services, their Railway
source branch was aligned from `wfm-staging-socket-auth` to `staging`. The
staging frontend, API, and socket then deployed commit
`525519822c07dc19cb4c60d21e7ea62ccb91214d` successfully:

| Service | Deployment | Status | Source commit |
| --- | --- | --- | --- |
| `wfm-app-staging` | `43ab9af0-22dc-4e65-97d0-ece864165a62` | SUCCESS | `525519822c07dc19cb4c60d21e7ea62ccb91214d` |
| `wfm-api-staging` | `452c32de-9e24-496d-977a-5727931911c7` | SUCCESS | `525519822c07dc19cb4c60d21e7ea62ccb91214d` |
| `wfm-socket-staging` | `f2d6750a-40ff-4508-9cfc-38781944ed8b` | SUCCESS | `525519822c07dc19cb4c60d21e7ea62ccb91214d` |

The read-only environment check showed all four services online, zero recent
failures, and zero pending work. The owner reports the targeted physical-phone
retest passed: ARC/STRAFE survived sign-out/sign-in, the same account showed its
scheme on both phones, and Account B retained its separate scheme. This is
owner-reported staging evidence, not an automated device run. The owner also
reported that gyro did not sync across devices. Code inspection confirms this
is expected: gyro is read from the browser-local preference store, while
ARC/STRAFE is saved in the authenticated player profile. The drilled flag has a
profile value with a device-local fallback; it was not part of this phone
retest. The broader
physical-device certification, mission-history comparison, direct
cross-account access attempts, and live reward-denial proof remain pending.
Production was not changed or deployed.
The owner confirmed gyro should remain device-local; no account-level gyro sync
was requested.

## Owner-reported staging account/profile refresh — 2026-10-28

The owner supplied Android Chrome screenshots from the Railway staging host.
The Clerk account menu showed **Development mode**, and the owner returned to
the WFM start screen without signing out. The owner then reported that Armory
inventory and balance loaded and that the same profile data remained after a
browser refresh.

This is owner-reported UI evidence; no credential values were accessed, and no
live HTTP trace was captured. No room, match, or claim was reported during this
profile-only check, and the agent submitted no reward claim. It confirms the
staging account/profile UI path at the reported level only. It does not verify
Production Clerk or server-side reward-event state. The interrupted/expired
reward-denial gate remains pending, and `productionReadiness` remains
`NOT_CLAIMED`.
