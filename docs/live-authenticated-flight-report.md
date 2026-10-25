# WAR FOR MARS live authenticated flight verification

- **Status:** BLOCKED — no live authenticated flight or progression write was performed.
- **Date:** 2026-10-25
- **Target checked:** `https://niakofa.com/kids/wfm/sign-in`
- **Tested source commit:** `116466eb12dd2ae1f4f7be1501eee483441194f4`.
- **Credentials and account safety:** no secret values were read or recorded; no account was created; no Clerk application or deployment configuration was changed.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Live sign-in page is reachable | PASS | Browser screenshot loaded the WFM sign-in form. |
| Live site uses the intended Clerk Production instance | NOT VERIFIED | The form visibly reports **Development mode**. Production key/app association cannot be verified from this workspace. |
| Current WFM Replit deployment | NOT DEPLOYED | Replit deployment metadata reports no active deployment for this Repl; the checked Niakofa route is not this Repl's published deployment. |
| Existing approved Development account can authenticate locally | PASS | `pnpm --filter @workspace/war-for-mars run test:e2e:auth` passed 1 test: sign-in, enter WFM, profile availability check, sign-out. The test uses the local Vite app and local API. |
| Authenticated flight on the live site | NOT RUN | The live page is using Development mode. Using the Development test account against the live route could mix Clerk and backend environments. |
| Live debrief, server reward, and persisted progression | NOT VERIFIED | No live flight was completed and no live progression write was attempted. |

## Boundary and next gate

The passing local E2E result establishes only the Development sign-in and game-entry path. It does not establish that production authentication is configured correctly or that live player data is isolated.

Before testing a live flight, the owner must confirm that the live host serves the intended Clerk Production instance and that an already-approved test account exists in that same instance. Then repeat the sign-in, sortie, debrief, and server-persisted progression checks on the live host. Do not create a new account or use the Development test account to write live progression.
