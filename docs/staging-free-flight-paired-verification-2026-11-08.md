# Staging free-flight rollout and paired verification

**Date:** 2026-11-08

**Scope:** isolated WFM staging only
**Source:** `design/orbital-universe-entry` at `76e89c469cb2ffabfa7d456f9574cc7feae7c6d0`

## Rollout

- The staging app, API, and Wing Socket were pinned to the same source commit
  and their Railway deployments completed successfully.
- The API service's configured non-forced Drizzle predeploy completed as part
  of its successful deployment. No direct SQL or Production database operation
  was performed.
- `VITE_WFM_ORBITAL_FREE_FLIGHT_ENABLED` and
  `ORBITAL_FREE_FLIGHT_ENABLED` were enabled in staging only so the deployed
  client and socket could expose the shared-flight path. No Production
  variables or services were changed.
- The protected gateway health check returned HTTP 200. An anonymous request
  to the app root returned HTTP 401 and retained the staging access gate.

## Browser verification attempt

- The staging access gate was passed in one mobile-emulated browser context.
- The first pilot sign-in did not produce a confirmed authenticated profile
  (`/api/game/profile` HTTP 200). The process stopped before entering the
  universe; the second pilot was not attempted.
- No free-flight snapshot, shared session, movement replication, patrol
  interception, damage, kill, reward, or faction-state result was observed.
- This was not a two-device pass and did not use physical devices. The
  authentication challenge state was not retained for inspection, so its
  precise cause is unknown. No retry was made.

## Readiness conclusion

The staging deployment is available behind its protected gateway, but the
authenticated paired-flight gate remains **unverified**. Do not treat this
attempt as evidence of live multiplayer combat, reward settlement, or
Production readiness.

Before retrying, use a fresh verification code for the currently active
staging sign-in challenge through the secure secrets flow. Keep the browser
session in the project-side test driver, confirm both authenticated profile
responses before entering flight, and then verify both clients share the same
server session and patrol actors. Continue with movement replication,
interception, and server-reported combat results only after those prerequisites
pass.
