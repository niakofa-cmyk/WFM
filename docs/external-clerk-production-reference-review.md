# External Clerk Production connection: vetted reference review

This review records how the owner-supplied proposals should inform WFM without
weakening its authentication or release gates. The source files are preserved
under `attached_assets/`:

- `Pasted-The-structural-review-completely-validates-your-path-th_1793200188616.txt`
- `Pasted--Architectural-Alignment-Connecting-the-External-Produc_1793200210939.txt`
- `Pasted--1-Automated-Staging-to-Main-Deployment-Checklist-File-_1793200228437.txt`

The attachments are reference material, not proof of live configuration or
authorization. Production remains blocked until the independent requirements in
[`production-clerk-preflight.md`](./production-clerk-preflight.md) are met.

## Reuse: verification goals already implemented

WFM already verifies the socket session using Clerk's backend SDK. The browser
obtains a session token through Clerk `getToken()` and sends it in the first
WebSocket data frame after the socket opens. The token is not sent in a URL,
stored in browser storage, or logged. The socket rejects unauthenticated
commands and binds the player identity to the verified subject.

The verifier in `artifacts/api-server/src/socket/clerk-session-verifier.ts`
checks the signature and token time bounds through `@clerk/backend` and accepts
the configured issuer, optional audience, and authorized-party allowlist. The
socket entry point in `artifacts/api-server/src/socket/index.ts` fails closed
when required Production configuration is unavailable. Existing tests use
synthetic signed tokens and cover valid tokens, bad signatures, expiry, issuer,
audience, authorized party, missing subject/key, and oversized input.

The related regression coverage is:

- `artifacts/api-server/src/socket/clerk-session-verifier.test.ts`
- `artifacts/api-server/src/socket/server.test.ts`
- `artifacts/api-server/src/socket/origin-policy.test.ts`
- `artifacts/war-for-mars/src/game/socket-endpoint.test.ts`
- `scripts/clerk-production-preflight.test.mjs`

The Production preflight tests ensure structural checks never certify external
connection authorization, key-instance pairing, email delivery, or Production
readiness. The API continues to pass the configured publishable key directly;
keys must not be derived from the app hostname or issuer URL.

## Proposal elements not adopted

1. **Do not put session tokens in WebSocket query parameters.** Query strings can
   be captured by access logs, monitoring, and diagnostic tooling. WFM
   intentionally sends the token in the first data frame and rejects
   token-bearing query parameter names.
2. **Do not add a duplicate Production Clerk manager for profile reads,
   invitations, or session revocation.** These operations are outside the
   current authentication boundary and would add unnecessary access to personal
   data and session-management capabilities. Use existing Clerk middleware and
   the socket verifier.
3. **Do not add the proposed raw-token cache.** It stores bearer credentials and
   risks turning a cache hit into trust beyond the token's verified claims or
   validity. WFM has no measured need for this optimization; keep verification
   through Clerk's SDK on each authentication.
4. **Do not use decode-only JWT tests.** Parsing a token's claims does not verify
   its signature. Keep the existing cryptographically signed synthetic fixtures
   and rejection tests.
5. **Do not use key-prefix checks or shell output to identify credentials.**
   Prefixes and presence cannot establish tenant identity or key pairing.
   Never echo keys, tokens, or credentials.
6. **Do not implement the proposed automatic staging-to-main merge/push script.**
   It changes branches and can prepare a Production-triggering push without
   satisfying WFM's release evidence gate. Use the existing
   `scripts/verify-staging-promotion.mjs` gate and the reviewed promotion process;
   do not merge or push as a substitute for missing evidence.
7. **Do not treat Clerk Native API setup as web authentication evidence.** WFM
   is a browser game; native-app configuration does not authorize Railway
   services or prove web session verification.

## Safe completion sequence

1. Keep the Replit-managed tenant intact. Do not assume Replit supports a second
   external Production Clerk connection alongside it: the currently documented
   switch to an external Clerk app requires deleting the managed app and does
   not migrate accounts, credentials, or sessions. Unless Replit offers a
   verified non-destructive authorization flow, this step stays blocked.
   Project-secret presence is not authorization. See
   [`external-clerk-migration-and-recovery-plan.md`](./external-clerk-migration-and-recovery-plan.md).
2. Using the authorized connection, verify only safe instance metadata and
   privately confirm that frontend and API keys belong to that instance. Do not
   compare, copy, log, or disclose key values.
3. Verify the intended issuer/JWKS, exact app/API origins, Clerk allowed origins
   and redirects, and actual email delivery. Structural preflight results alone
   do not clear these checks.
4. Test the verified code on staging first, with the frontend, API, and socket
   on one revision. Exercise sign-in, protected API, profile load, session
   refresh, sign-out, unauthenticated rejection, and authenticated socket
   joining/reconnect. Keep the independent game reward and device gates intact.
5. Only after the preceding evidence is reviewed, obtain separate approval for
   Production changes and rollout. Use an approved dedicated test account for
   the controlled Production smoke test. Record sanitized outcomes only.

No step in this document authorizes a secret change, managed-tenant deletion,
Railway Production mutation, Production sign-in, publish, deployment, or push.
