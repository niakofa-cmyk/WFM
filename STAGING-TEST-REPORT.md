# WAR FOR MARS staging verification report

- **Status:** PENDING
- **Tested source commit:** `7b3127b87099f68ed9408e5b0b9d4b2f09a0dda8` (workspace quality and live scoped profile sync pass; full staging verification remains pending)
- **Staging Repl:** owner-confirmed separate Repl
- **Deployment visibility:** protected Railway staging gateway; private API/socket have no public domains. The legacy Replit invite-only release flag remains false pending explicit policy review.
- **Production readiness:** NOT CLAIMED

## Local workspace verification after the staged source snapshot

The current workspace source is `5fdb65618c4eed5a26808d6b89cc0a7373405bc2`.
Local typecheck, all 70 API tests, all 32 game tests, workspace production
builds, and all 6 public Playwright E2E tests passed. This check is recorded
separately in `latestLocalWorkspaceCheck`; it is **not** evidence that this
source was deployed to staging or that the remaining live release checks passed.
The latest full/authenticated staging evidence below still tests
`7b3127b87099f68ed9408e5b0b9d4b2f09a0dda8`. A limited no-account smoke on the
new current-source deployment is recorded separately; it does not replace the
required release checks. The promotion gate correctly remains blocked.

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
availability. It does **not** change `testedSourceCommit`, the false legacy
invite-only flag, or any required release-test status; the full gate remains
**PENDING**.

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
| Railway staging deployment revisions vs. tested source | PARTIAL — at 21:46 UTC, the frontend deployment for `4a150fd` was SUCCESS, while API (`179064a`) and socket (`acf080c`) remained on earlier successful deployments. The socket lifecycle fix is not live and no live restart was run. This does not clear the promotion gate | `STAGING-TEST-RESULTS.json` `latestPostPushRailwayStatus`; historical `latestStagingServiceRevisionAudit` |
| Reproducible workspace typecheck, tests, and builds | PASS — frozen-lockfile install passed in the earlier check; the latest source-only check passed typecheck, 71 API tests, 32 game tests, and workspace production builds. The frozen install was not repeated because no dependency or lockfile changed | `STAGING-TEST-RESULTS.json` `latestFrozenWorkspaceQualityCheck`; `latestLocalWorkspaceCheck` |
| Invite-only Reserved VM deployment configuration | PENDING — legacy Replit requirement is not met by the deployed Railway gateway; false flag preserved for explicit policy review | |
| Development landing page loads | PASS — Replit preview checked; sign-in not exercised | |
| Solo Practice gameplay lifecycle | PASS — preview-only WebGL2 run completed the 120-second match, showed a draw reason and debrief, and returned to setup and home; no sign-in or reward persistence was used | `STAGING-TEST-RESULTS.json` previewGameplay |
| Sign-up/sign-in and profile loading | PARTIAL — three fresh staging contexts signed in and loaded profiles; sign-out returned 401. New-account creation not tested | Live profile-session section |
| Profile persistence across fresh sessions | PASS — both first-pilot contexts loaded the saved 130-credit profile and restored selection | Live profile-session section |
| Automatic same-account sync across independent browser contexts | PASS — visible selection changed after 26.8 seconds without reload and restored automatically | Live profile-session section |
| Synchronization across distinct physical devices | PENDING — independent browser contexts are not physical-device evidence | |
| Two-account isolation for progression, credits, inventory, and history | PARTIAL — earlier reversible profile-sync writes left the second account's returned profile unchanged. The latest two-account probe confirmed a foreign-user profile query returns the caller's profile and a write carrying a foreign user ID is rejected with HTTP 400; a repeat before/after check was stable. World-state cross-account mutation and any distinct history/inventory surface remain unverified | `latestLiveProfileSync`; `latestStagingAccountAndRoomUiCheck` |
| Staging economy uses staging data | PASS — one accepted salt buy and sell-back succeeded in staging. The second account observed shared stock decrease and restoration; buyer inventory/cargo returned to baseline, observer inventory stayed unchanged, and no credits were created | `latestStagingSharedMarketTradeCheck` |
| Server-owned rewards and duplicate-claim protection | PARTIAL — one authenticated staging skirmish received a server-accepted reward; its identical duplicate added no credits, and the balance survived reload. Broader replay, interruption, and campaign coverage remains pending | `latestAuthenticatedRewardFlight` |
| Restart interrupts active match and notifies players | PARTIAL — local tests now confirm both pilots receive the restart notice, new upgrades are rejected during shutdown, and repeated shutdown calls are safe. The latest available live Railway two-client run still closed with 1006 and no notice; the new lifecycle code was not yet deployed at the status check | `latestLocalWorkspaceCheck.socketLifecycleRegression`; `latestStagingBrowserFreshRoomCheck`; `latestStagingSocketRestartCheck`; `latestPostPushRailwayStatus` |
| Interrupted match cannot award rewards; old room is rejected | PARTIAL — staging restart checks made zero claim requests and an earlier old-room reconnect was rejected as `session_lost`. A new local regression expired a genuine server-issued run before claim and confirmed the `expired` result, unchanged credits/cleared progress/profile revision, and zero reward events. This is not live deployed staging claim evidence, so the release gate stays partial | `latestStagingBrowserFreshRoomCheck`; `previousStagingSocketRestartCheck`; `latestLocalExpiredRunRewardCheck`; `artifacts/war-for-mars/src/game/WarApp.tsx`; `artifacts/api-server/src/game/progression.test.ts`; `artifacts/api-server/src/routes/strikes.ts` |
| New room works after restart | PASS — one browser pilot created a distinct new room from the restart screen and started a match; two protocol clients also started a fresh room | `latestStagingBrowserFreshRoomCheck`; `latestStagingSocketRestartCheck` |
| Temporary disconnect reconnects while server remains running | PASS — two clients reclaimed their same seats and teams during a live staging match; browser-client and physical-device behavior remain unverified | `latestLiveTenClientMatch` |
| Room creation, invite, ready-up, team assignment, and late-join handling | PASS — two existing staging accounts joined the same room by code, received separate team assignments, and started only after both were ready; protocol checks also verified ten 5v5 seats and late-join rejection | `latestStagingAccountAndRoomUiCheck`; `latestLiveMultiplayerRoomSmoke` |
| Ten clients complete a match with consistent final results | PASS — all ten clients received the same completed result after two controlled reconnects; scripted protocol clients, not human gameplay | `latestLiveTenClientMatch` |
| Automated network impairment harness | PASS — latest suite used ten simulated clients with 35 ms latency, 20 ms jitter, 12% frame loss, and two reconnects; that run ended at 180.7 simulated seconds. Synthetic only, not deployed or real-network verification | `STAGING-TEST-RESULTS.json` latestNetworkHarness |
| Current Railway staging service health | PASS for current availability — app, API, socket, and database are online with no pending Railway work; the app now serves commit `4e8ab0a`. Railway still records five failed deployments in the 24-hour window: earlier healthcheck/config failures for the gateway access-code format, API database URL, and socket origin allowlist; each affected service later deployed successfully. These are not current workspace build failures and do not complete the release gate | `STAGING-TEST-RESULTS.json` `currentStagingRailwayHealth` |
| Current-source private staging/mobile smoke | PASS for limited smoke only — anonymous root and play routes are gated; approved access reached Solo Flight with WebGL, four controls in bounds across portrait/landscape, and clean exit. No sign-in or persistent progression test; not physical-device evidence | `STAGING-TEST-RESULTS.json` `latestStagingMobileSmoke` |
| Railway Production Clerk release | NOT CERTIFIED — current Railway API, frontend, and socket services are online and required Clerk variable names are present; no secret values were read. Clerk instance pairing and Production sign-in remain unverified because the connected Clerk API is Development. Public issuer/JWKS availability does not prove Railway Production connectivity | `STAGING-TEST-RESULTS.json` `railwayBackend.currentReadOnlyInventory`; `docs/game-runtime-forensic-report.md` |

## Local development socket checks

These checks ran in the staging Repl's development workspace. They do not establish deployed behavior or production readiness.

- **Authentication gate: PARTIAL.** The unauthenticated browser preview shows the Clerk create-account/sign-in screen, and an unauthenticated profile request returned `401`. No login, account creation, or Replit Invite-only deployment gate was exercised.
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
