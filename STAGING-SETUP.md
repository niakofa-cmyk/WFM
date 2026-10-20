# WAR FOR MARS isolated staging

This branch is the import source for a **separate staging Repl**. Do not use the current Repl as staging: it is the production project if it is published. Replit does not provide a second staging slot inside the same Repl.

## Create the isolated Repl

1. Import the public repository `niakofa-cmyk/WFM` into a new Repl.
2. In the new Repl's Shell, check out this branch if the import starts on `main`:

   ```sh
   git fetch origin staging
   git switch --track -c staging origin/staging
   ```

3. Confirm `git branch --show-current` returns `staging`.
4. Enable Replit-managed Clerk Auth in the new Repl. Let Replit provision its own authentication tenant and environment keys; **do not copy Clerk keys, `SESSION_SECRET`, or any other secret from the production Repl**.
5. Use only the new Repl's database. Replit separates each Repl's development and published databases. The staging deployment build runs the non-forced Drizzle schema push against the staging deployment database; it does not connect to the original Repl's database.
6. Publish the new Repl with **Invite only** visibility and invite only the test participants. This branch uses a Reserved VM because the game depends on a continuously running WebSocket service.

Never put secret values, account identifiers, private deployment URLs, or player data in this public repository. Keep any remaining staging-only secrets in the new Repl's Secrets panel. Do not import production accounts, profiles, credits, inventory, match history, or economy state.

## Staging verification

Use staging-only accounts and record sanitized outcomes in `STAGING-TEST-REPORT.md` and `STAGING-TEST-RESULTS.json`.

- Sign up, sign in, sign out, and sign back in. Confirm the profile and progression load from the staging database.
- Use the same staging account in two browsers/devices. Confirm saved progress follows that account.
- Use two separate staging accounts. Confirm profiles, credits, inventory, campaign state, and transaction history are private to each account; confirm shared market state behaves as designed.
- Complete a strike and retry its reward claim. Confirm the retry does not grant a second reward.
- Start an online match, restart the socket service, and confirm the active match is marked interrupted, players see a restart/lost-session message, the old room cannot be resumed, and the interrupted match cannot grant a reward. Create a fresh room and confirm it works.
- Separately test an ordinary temporary socket disconnect while the server stays up. Confirm reconnect reclaims the reserved seat.
- Verify room creation, invite codes, ready-up, balanced team assignment, full-room and late-join handling, and that all connected clients receive the same completed match result.
- Run the automated impairment suite from the staging branch:

  ```sh
  pnpm --filter @workspace/api-server run test:network
  ```

The automated suite is supporting evidence, not a substitute for connecting to the deployed staging socket with browser clients. Record the tested source commit and sanitized evidence; do not include private URLs or credentials.

## Promotion gate

`STAGING-TEST-RESULTS.json` remains `PENDING` until every required staging check passes. A promotion pull request must come from `staging`, record the exact tested source commit, include the completed report, and contain no application-code changes after that tested commit. GitHub Actions checks the evidence.

The `main` branch is protected: changes require a pull request and passing **Verify workspace** and **Verify staging evidence** checks. Direct pushes are blocked, and administrators are subject to the same checks. The staging evidence check is intentionally pending until the separate Repl is created and the live tests pass.

A staging pass is **not** production certification. Production authentication, database schema changes, rollback/recovery, and production data handling require a separate review and approval before the production Repl is published or updated.
