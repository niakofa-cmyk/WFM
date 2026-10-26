# WAR FOR MARS staging verification report

- **Status:** PENDING
- **Tested source commit:** `b383619a51393a305048bb0253cded6c7a2cbe51` (workspace quality passes; full staging verification remains pending)
- **Staging Repl:** owner-confirmed separate Repl
- **Deployment visibility:** invite-only configuration pending; not published
- **Production readiness:** NOT CLAIMED

## Latest scoped evidence — 2026-10-26, 12:58 UTC

An explicitly authorized normal staging skirmish completed with an accepted
server reward: 90 → 130 credits. Its one identical duplicate returned
`replayed: true` and added no credits; an authenticated reload still showed 130.
Sign-out returned the profile to HTTP 401 and the browser was closed.
See `docs/staging-deterministic-reward-flight-evidence.json` and
`docs/staging-reward-parity-flight-report.md`.

This supersedes the reward-flight blocker only. The historical table and
overall release status remain pending: new-session/cross-device persistence,
account isolation, campaign, and deployed multiplayer checks are not established
by one skirmish. Production was not changed.

Keep this report free of secret values, player identifiers, private deployment URLs, and personal data. Put sanitized evidence in this repository and list its paths in `STAGING-TEST-RESULTS.json`.

| Check | Result | Evidence |
| --- | --- | --- |
| Staging Repl, database, and Clerk environment are isolated from production | PASS — owner-confirmed; deployment is not published | `STAGING-TEST-RESULTS.json` environment evidence |
| Reproducible workspace typecheck, tests, and builds | PASS — tested commit typechecks, all 55 API tests and 14 game tests pass, and production builds complete | `STAGING-TEST-RESULTS.json` workspaceQuality |
| Invite-only Reserved VM deployment configuration | PENDING — owner action required; nothing published | |
| Development landing page loads | PASS — Replit preview checked; sign-in not exercised | |
| Solo Practice gameplay lifecycle | PASS — preview-only WebGL2 run completed the 120-second match, showed a draw reason and debrief, and returned to setup and home; no sign-in or reward persistence was used | `STAGING-TEST-RESULTS.json` previewGameplay |
| Sign-up/sign-in and profile loading | PENDING — local preview shows the Clerk sign-in/create-account gate and unauthenticated profile request returns 401; successful sign-in was not exercised | |
| Profile persistence across sessions and devices | PENDING | |
| Two-account isolation for progression, credits, inventory, and history | PENDING | |
| Staging economy uses staging data | PENDING | |
| Server-owned rewards and duplicate-claim protection | PENDING | |
| Restart interrupts active match and notifies players | PENDING — direct Node `SIGTERM` check passed locally; managed workflow restart closed with 1006 and no notice; deployed restart not tested | Local checks below |
| Interrupted match cannot award rewards; old room is rejected | PENDING | |
| New room works after restart | PENDING | |
| Temporary disconnect reconnects while server remains running | PARTIAL — local live socket smoke passed; deployed and real-network reconnect remain pending | Local checks below |
| Room creation, invite, ready-up, team assignment, and late-join handling | PARTIAL — local room-code, host/ready, AI-fill, late-join, reconnect, and room-isolation checks passed; deployment access and ten human clients remain unverified | Local checks below |
| Ten clients complete a match with consistent final results | PENDING | |
| Automated network impairment harness | PASS — latest suite used ten simulated clients with 35 ms latency, 20 ms jitter, 12% frame loss, and two reconnects; that run ended at 180.7 simulated seconds. Synthetic only, not deployed or real-network verification | `STAGING-TEST-RESULTS.json` latestNetworkHarness |
| Railway production API/socket rollout | PENDING — PostgreSQL is online and socket `/healthz` passes; API is offline because Clerk variables are missing. No public domains or schema migration; no authenticated or multiplayer checks | `docs/railway-deployment-evaluation.md` |

## Local development socket checks

These checks ran in the staging Repl's development workspace. They do not establish deployed behavior or production readiness.

- **Authentication gate: PARTIAL.** The unauthenticated browser preview shows the Clerk create-account/sign-in screen, and an unauthenticated profile request returned `401`. No login, account creation, or Replit Invite-only deployment gate was exercised.
- **Room-code access: PASS locally.** A malformed short code was rejected. Two clients using the same generated code joined one lobby; a different valid code created an isolated room. The room code is a bearer invite, not account authentication; anyone who knows it can join an open lobby. Late join after match start was rejected. No generated code was retained in this report.
- **Live local 5v5: PASS for a 30-second smoke test.** Two WebSocket clients started a ten-seat match with eight AI seats, exchanged sequenced inputs through `lastSeq` 299, and each received 491 snapshots with 491 identical snapshot samples in common. This was not a six-minute match, ten human clients, or a real-network test.
- **Live socket smoke: PASS.** A client joined, readied, started, received an input acknowledgment in a snapshot (`lastSeq`), disconnected and reclaimed the same active seat. A second room had independent state. Empty seats were AI-controlled; this was not a ten-human match.
- **Direct Node `SIGTERM`: PASS.** An active match received input, then the compiled socket process received `SIGTERM`. The client received `interrupted` before close code `4002`.
- **Managed workflow restart: FAIL.** Restarting the Replit-managed Wing Socket workflow closed the active client with code `1006` and no `interrupted` notice, including after the shutdown send was changed to wait for its callback. This development workflow result is not interchangeable with direct Node `SIGTERM` or a deployed restart.

Passing these staging checks does not establish production readiness.
