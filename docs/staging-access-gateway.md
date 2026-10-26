# Private Railway staging access

## Scope

This is a staging-only access gate, not a replacement for Clerk authentication.
Production continues to use its existing deployment and Clerk instance.

The staging frontend service runs a gateway that serves the built WFM client
and proxies `/api` and WebSocket `/ws` to private Railway services. Only the
gateway may receive a public domain. Do not expose the staging API, socket, or
database directly: doing so would bypass the access gate.

## Access behavior

- Visitors must submit the staging code through a POST form.
- The code never appears in URLs, source files, browser cookies, or logs.
- Successful access creates a random opaque four-hour browser session. The
  cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, and host-only.
- Sessions and failed-attempt limits are bounded and process-local. Keep one
  gateway replica. Gateway restarts revoke access sessions and require the
  code again; they do not delete player progression.
- Five failed attempts trigger a ten-minute limit for the transport address.
  Forwarded address headers are not trusted for bypassing that limit.
- `/__staging/access` shows the unlock form or, once unlocked, a
  **Lock staging access** button. Locking revokes the session and closes its
  existing sockets. Session expiry also closes those sockets.
- Health checks use `/__staging/healthz`, which exposes only a status response.
- Clerk sign-in and the existing server-owned progression checks still apply
  after unlocking. Gate access does not grant credits, identify a player,
  create an account, or bypass API authentication.

## Railway setup

Use only project `wfm-staging`, environment `staging`.

### Frontend/gateway: `wfm-app-staging`

Build:

```sh
pnpm --filter @workspace/war-for-mars build && pnpm --filter @workspace/api-server build
```

Start:

```sh
pnpm --filter @workspace/api-server start:staging
```

Health check: `/__staging/healthz`.

| Variable | Configuration |
| --- | --- |
| `STAGING_GATE_ENABLED` | `true` |
| `STAGING_ACCESS_CODE` | Owner-supplied staging-only secret, 32–256 characters; save directly in Railway Variables. Never use a Clerk key or password. |
| `STAGING_PUBLIC_ORIGIN` | Exact HTTPS origin of the protected gateway, without a path. |
| `STAGING_API_UPSTREAM` | Private HTTP reference to the staging API on port 8080. |
| `STAGING_SOCKET_UPSTREAM` | Private HTTP reference to the staging socket on port 8099. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Existing staging Development instance's publishable key. |
| `VITE_API_BASE_URL` | `/`, so existing Clerk bearer-token forwarding uses the same-origin gateway. |
| `BASE_PATH` | `/` |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |

Leave `VITE_CLERK_PROXY_URL` absent for direct Clerk access. With no socket
override, the existing client derives the same-origin secure `/ws` endpoint.
The access secret must not have a `VITE_` prefix.

### Private backends

Keep the staging API's matching Development Clerk keys and its reference to the
fresh staging database. Set `API_ALLOWED_ORIGINS` and `WING_ALLOWED_ORIGINS` to
the exact gateway origin. Do not use production keys, production database
references, wildcard origins, or public backend domains.

## Safe deployment order

1. Pin the staging services to the reviewed source commit.
2. Save `STAGING_ACCESS_CODE` directly in the gateway service.
3. Deploy the gateway without a public domain and verify its health.
   `https://wfm-staging.invalid` may be used solely as a deliberately unusable
   bootstrap origin; it is not a playable address.
4. Only after the protected gateway is healthy, generate its public domain.
5. Set the real `STAGING_PUBLIC_ORIGIN` and both backend origin allowlists,
   then deploy the updated staging configuration.
6. Verify unauthorized HTTP and WebSocket traffic is rejected on that real
   endpoint before using the code.
7. Use approved staging-only accounts for sign-in and flight verification.

Do not attach a public domain while the previous ungated Vite server is still
serving. A failed replacement deployment can leave the old revision running.

## Verification

The workspace typecheck, 63 API/security/socket tests, 18 game tests, and all
artifact builds passed after implementation. Gateway integration tests use
synthetic credentials and local upstream fixtures, not live player data.

Coverage includes pages/assets/API denial, secure cookies, session expiry and
revocation, throttling, origin/host rejection, raw API request forwarding,
continued API authentication requirements, guarded socket upgrades after HTTP
proxy use, socket echo, and logout termination.

This is implementation evidence only. Until the protected staging endpoint and
approved staging account complete a flight, the live authenticated-flight task
and the production promotion gate remain incomplete.
