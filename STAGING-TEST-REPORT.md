# WAR FOR MARS staging verification report

**Status:** PENDING  
**Tested source commit:** PENDING  
**Staging Repl:** separate Repl required  
**Deployment visibility:** invite-only required  
**Production readiness:** NOT CLAIMED

Keep this report free of secret values, player identifiers, private deployment URLs, and personal data. Put sanitized evidence in this repository and list its paths in `STAGING-TEST-RESULTS.json`.

| Check | Result | Evidence |
| --- | --- | --- |
| Staging Repl, database, and Clerk environment are isolated from production | PENDING | |
| Sign-up/sign-in and profile loading | PENDING | |
| Profile persistence across sessions and devices | PENDING | |
| Two-account isolation for progression, credits, inventory, and history | PENDING | |
| Staging economy uses staging data | PENDING | |
| Server-owned rewards and duplicate-claim protection | PENDING | |
| Restart interrupts active match and notifies players | PENDING | |
| Interrupted match cannot award rewards; old room is rejected | PENDING | |
| New room works after restart | PENDING | |
| Temporary disconnect reconnects while server remains running | PENDING | |
| Room creation, invite, ready-up, team assignment, and late-join handling | PENDING | |
| Ten clients complete a match with consistent final results | PENDING | |
| Automated network impairment test on the staging branch | PENDING | |

Passing these staging checks does not establish production readiness.
