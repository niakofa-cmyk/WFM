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

This workspace has no approved staging access-code or staging-account secrets.
The saved WFM Production browser state and Production test credentials must
not be reused against the isolated Development-auth staging environment.
Approved staging access and accounts are prerequisites for authenticated
release verification.

## Production boundary

Preparing or deploying this candidate to staging does not certify production.
Until the promotion checks and production acceptance succeed, production stays
on its existing release and Niakofa's Play Now stays unverified.
