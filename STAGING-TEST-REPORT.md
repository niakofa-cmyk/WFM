# WAR FOR MARS staging verification report

- **Status:** PENDING
- **Tested source commit:** `aa50a66762637cbbe8ae12652c0854fb3a2012aa` (workspace quality and local socket checks; full staging verification remains pending)
- **Staging Repl:** owner-confirmed separate Repl
- **Deployment visibility:** invite-only configuration pending; not published
- **Production readiness:** NOT CLAIMED

Keep this report free of secret values, player identifiers, private deployment URLs, and personal data. Put sanitized evidence in this repository and list its paths in `STAGING-TEST-RESULTS.json`.

| Check | Result | Evidence |
| --- | --- | --- |
| Staging Repl, database, and Clerk environment are isolated from production | PASS — owner-confirmed; deployment is not published | `STAGING-TEST-RESULTS.json` environment evidence |
| Invite-only Reserved VM deployment configuration | PENDING — owner action required; nothing published | |
| Development landing page loads | PASS — Replit preview checked; sign-in not exercised | |
| Sign-up/sign-in and profile loading | PENDING | |
| Profile persistence across sessions and devices | PENDING | |
| Two-account isolation for progression, credits, inventory, and history | PENDING | |
| Staging economy uses staging data | PENDING | |
| Server-owned rewards and duplicate-claim protection | PENDING | |
| Restart interrupts active match and notifies players | PENDING — direct Node `SIGTERM` check passed locally; managed workflow restart closed with 1006 and no notice; deployed restart not tested | Local checks below |
| Interrupted match cannot award rewards; old room is rejected | PENDING | |
| New room works after restart | PENDING | |
| Temporary disconnect reconnects while server remains running | PARTIAL — local live socket smoke passed; deployed and real-network reconnect remain pending | Local checks below |
| Room creation, invite, ready-up, team assignment, and late-join handling | PENDING | |
| Ten clients complete a match with consistent final results | PENDING | |
| Automated network impairment harness | PASS — rerun in workspace suite; synthetic only, not deployed browser or real-network verification | `docs/staging-network-impairment-evidence.json` |

## Local development socket checks

These checks ran in the staging Repl's development workspace. They do not establish deployed behavior or production readiness.

- **Live socket smoke: PASS.** A client joined, readied, started, received an input acknowledgment in a snapshot (`lastSeq`), disconnected and reclaimed the same active seat. A second room had independent state. Empty seats were AI-controlled; this was not a ten-human match.
- **Direct Node `SIGTERM`: PASS.** An active match received input, then the compiled socket process received `SIGTERM`. The client received `interrupted` before close code `4002`.
- **Managed workflow restart: FAIL.** Restarting the Replit-managed Wing Socket workflow closed the active client with code `1006` and no `interrupted` notice, including after the shutdown send was changed to wait for its callback. This development workflow result is not interchangeable with direct Node `SIGTERM` or a deployed restart.

Passing these staging checks does not establish production readiness.
