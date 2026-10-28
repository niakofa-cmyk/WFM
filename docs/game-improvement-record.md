# WAR FOR MARS — Game Improvement Record

## 2026-10-28 — Production profile authentication preparation

### Finding

The owner reported that the public WFM page loads in Chrome but the player
profile request returns HTTP 401 `authentication_required`. Read-only inspection
found that the Production `origin/main` frontend source used Clerk's
hostname-derived publishable-key helper and did not connect the Clerk session
token to the shared API client. The current staging source contains that bridge.
This is the leading source-level explanation, not proof of Production
key-instance pairing or the exact live request headers.

### Local preparation

Created a separate, uncommitted local branch from `origin/main` and prepared a
minimal frontend change that:

- passes the explicitly configured `VITE_CLERK_PUBLISHABLE_KEY` through
  `configuredClerkPublishableKey`, without deriving it from the hostname;
- uses the Clerk SDK token getter for API requests only when
  `VITE_API_BASE_URL` is explicitly configured, preserving the same-origin
  Development path;
- adds synthetic regression tests for configured-key handling, bridge wiring,
  bearer transport, signed-out requests, and explicit authorization headers.

### Verification and limits

- WFM tests: **14/14 passed**.
- WFM typecheck: **passed**.
- WFM production build: **passed**.
- Full workspace typecheck, tests, and builds passed before the final API-base
  guard; the final WFM-only test, typecheck, and build passed afterward.
- The local mobile preview rendered the public landing page. Its browser was
  unsigned-in and loaded Development Clerk keys, so it did not verify a signed-in
  profile or Production credentials.
- `VITE_API_BASE_URL` presence in the Production frontend, frontend/API
  Clerk-key pairing, allowed origins/redirects, email delivery, and protected
  API/session behavior remain unverified.

No secrets were read or changed. No Railway settings, player data, Production
deployment, commit, or push was changed. Production remains **NOT CLAIMED** and
release authorization remains blocked on the existing staging and auth
certification gates.
