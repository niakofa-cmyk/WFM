# Multiplayer socket session authentication

The Wing Socket accepts no player identity until it verifies a Clerk session
token. The web client obtains the current session token through Clerk's
`getToken()` API and sends it in the first WebSocket data frame:

```json
{ "type": "authenticate", "token": "<session token>" }
```

The token is not placed in the WebSocket URL, query string, browser storage, or
logs. The socket rejects room commands that arrive before authentication,
closes the connection on invalid/expired credentials, and returns only a
generic authentication error. The verified Clerk subject becomes the player's
socket identity; client-supplied player IDs are ignored. Reconnects require
both the same verified subject and that seat's reconnect token, preventing
cross-account seat recovery or duplicate seats.

The web client's socket URL resolver and the socket server's upgrade handler
reject common token-bearing query parameter names. Room routing may use a
`room` query parameter, but authentication is sent only after the WebSocket
opens, in the first data frame described above.

## Verification rules

The socket delegates JWT verification to Clerk's `@clerk/backend` `verifyToken`
SDK. It verifies the signature, expiration, configured issuer, and optional
audience. In Production, socket startup fails closed unless `CLERK_ISSUER`,
`CLERK_SECRET_KEY`, and the existing `WING_ALLOWED_ORIGINS` configuration are
available. The configured origins are also used as the authorized-party
allowlist. Set `CLERK_AUDIENCE` only if the deployed Clerk token configuration
issues an audience claim that the service should require.

The `socket` target of `preflight:clerk:production` checks presence of those
service variables, exact issuer/origin metadata, and the public Production
issuer/JWKS inputs. This is a structural check only. It cannot prove that the
secret key belongs to the authorized external Clerk instance, confirm email
delivery, or replace a controlled sign-in and protected-route smoke test.
Production remains blocked until those independent checks are authorized and
completed. No Railway settings, secrets, or Production deployment were changed
for this code update.

## Regression coverage

- `src/socket/clerk-session-verifier.test.ts` signs synthetic RS256 JWT fixtures
  and exercises valid, invalid-signature, expired, issuer, audience,
  authorized-party, missing-subject, missing-key, and oversized-token cases.
- `src/socket/server.test.ts` checks unauthenticated command rejection,
  verified identity ownership, duplicate-seat rejection, reconnect ownership,
  and existing room/restart behavior using an injected synthetic verifier.
- `src/socket/network-impairment.test.ts` keeps reconnect simulation on the
  same synthetic player identity.
- `src/socket/origin-policy.test.ts` retains origin enforcement coverage.

These tests do not use live Clerk tokens or establish Production key pairing.
