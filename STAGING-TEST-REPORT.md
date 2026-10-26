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
| Reproducible workspace typecheck, tests, and builds | PASS — tested commit typechecks, 70 API tests and 32 game tests pass, and production builds complete | `STAGING-TEST-RESULTS.json` workspaceQuality |
| Invite-only Reserved VM deployment configuration | PENDING — legacy Replit requirement is not met by the deployed Railway gateway; false flag preserved for explicit policy review | |
| Development landing page loads | PASS — Replit preview checked; sign-in not exercised | |
| Solo Practice gameplay lifecycle | PASS — preview-only WebGL2 run completed the 120-second match, showed a draw reason and debrief, and returned to setup and home; no sign-in or reward persistence was used | `STAGING-TEST-RESULTS.json` previewGameplay |
| Sign-up/sign-in and profile loading | PARTIAL — three fresh staging contexts signed in and loaded profiles; sign-out returned 401. New-account creation not tested | Live profile-session section |
| Profile persistence across fresh sessions | PASS — both first-pilot contexts loaded the saved 130-credit profile and restored selection | Live profile-session section |
| Automatic same-account sync across independent browser contexts | PASS — visible selection changed after 26.8 seconds without reload and restored automatically | Live profile-session section |
| Synchronization across distinct physical devices | PENDING — independent browser contexts are not physical-device evidence | |
| Two-account isolation for progression, credits, inventory, and history | PARTIAL — second pilot's entire returned profile was unchanged during the first pilot's reversible selection writes; separate history/inventory endpoints and cross-account writes unverified | Live profile-session section |
| Staging economy uses staging data | PENDING | |
| Server-owned rewards and duplicate-claim protection | PARTIAL — one authenticated staging skirmish received a server-accepted reward; its identical duplicate added no credits, and the balance survived reload. Broader replay, interruption, and campaign coverage remains pending | `latestAuthenticatedRewardFlight` |
| Restart interrupts active match and notifies players | PENDING — direct Node `SIGTERM` check passed locally; managed workflow restart closed with 1006 and no notice; deployed restart not tested | Local checks below |
| Interrupted match cannot award rewards; old room is rejected | PENDING | |
| New room works after restart | PENDING | |
| Temporary disconnect reconnects while server remains running | PASS — two clients reclaimed their same seats and teams during a live staging match; browser-client and physical-device behavior remain unverified | `latestLiveTenClientMatch` |
| Room creation, invite, ready-up, team assignment, and late-join handling | PARTIAL — live protocol checks verified ten 5v5 seats, host/readiness gates, late-join rejection, and reconnect; browser invite flow remains unverified | `latestLiveMultiplayerRoomSmoke` |
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
