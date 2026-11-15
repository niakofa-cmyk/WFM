# Orbital production release readiness

## Approved scope

The owner approved including the current staging Orbital redesign in the WFM
production release, rather than releasing only the older production game's
authentication fix.

The candidate starts with the redesign deployed on all three staging services
at `94181eb5674b4802921d26bb462b632837fab5c1` and includes the subpath redirect
and session-token handoff fix. Account consumers wait until their session's
token provider is installed; token resolution fails after session replacement.
The previous `ApiAuthBridge` is removed to prevent competing registrations.

## Promotion process

- Preserve the isolated `wfm-staging` Railway project and its access gateway,
  database, and Development authentication.
- Advance the existing `staging` release branch without rewriting history.
- Pin staging frontend, API, and socket to the same candidate commit.
- Use the existing staging-to-main promotion pull request and both required
  GitHub checks. Do not bypass branch protection or weaken evidence checks.
- Record new live staging evidence for the exact candidate. Historical passes
  are not certification of the new candidate.
- Review production schema, external Production Clerk alignment, same-origin
  proxy routing, feature configuration, and rollback before production promotion.
- Enable Niakofa's Play Now only after the deployed gameplay and signed-in
  flow have been verified at `/kids/wfm/`; preserve `/kids/wfm/about` and `/kids/`.

## Outstanding live evidence

The existing `STAGING-TEST-RESULTS.json` remains PENDING. Its account sign-in,
progress/inventory/history isolation, server-owned rewards/duplicate-claim,
and interrupted-match reward-denial evidence is incomplete. Its tested source
also predates the current redesign. These fields must not be changed to PASS
without fresh, corresponding evidence.

Approved staging access and existing staging-account secrets are configured.
The owner confirmed the narrow authentication hotfix worked on a trusted staging
phone across reloads, corroborated by current profile HTTP 200 responses.
That check exercised the older isolated frontend hotfix, not the full redesigned
universe candidate.

New automated staging client-trust email preparation is blocked by Clerk's
`dev_monthly_email_limit_exceeded`. Do not request additional codes, substitute
Production credentials, bypass verification, or turn historical passes into
current-candidate certification. Existing trusted staging browsers may be used
normally, with their evidence and limitations recorded separately.

## Full-universe release preparation — 2026-11-15

The owner explicitly requested the new redesigned Orbital universe on the live
website rather than extending the narrow sign-in-only hotfix exception.
The release candidate reconciles the current redesign with the existing staging
branch by an ordinary merge, retaining the newer account-session isolation
fix. No history was rewritten.

Live production still serves the earlier frontend and older API/socket
deployments. Updating the frontend alone would not establish the shared Orbital
universe. Frontend, API and socket must be validated together on one candidate,
with matching schema and feature configuration.

The shared-flight configuration currently permits distributed persistence only
in explicit staging. Production has no dedicated Redis service in the inspected
Railway project. Production activation therefore requires a separately reviewed
infrastructure/configuration rollout as well as passing promotion evidence.
Do not point production at staging Redis or disguise production as staging.

The existing staging-to-main evidence gate remains unchanged. The narrow auth
draft remains separate; its exception must not be expanded to admit the entire
universe release.

## Production boundary

Preparing or deploying this candidate to staging does not certify production.
Until the promotion checks and production acceptance succeed, production stays
on its existing release and Niakofa's Play Now stays unverified.
