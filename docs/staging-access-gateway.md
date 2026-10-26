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

### Deployment attempt: 2026-10-26 UTC

Source commit: `b9be83a62de348293157a8e63f02a65988506649`.
The GitHub push workspace-quality run passed. Pull-request checks requiring
completed staging evidence remain blocked; they have not been bypassed.

After owner confirmation, the reviewed staging changes were applied:

| Service | Deployment | Observation |
| --- | --- | --- |
| Gateway | `1c8dc99f-8bfa-44c5-a9a4-651d02edad10` | Build completed, but runtime configuration validation rejects `STAGING_ACCESS_CODE`; Railway was still in `DEPLOYING` at observation. |
| API | `def24e22-d8f4-463c-9b5f-9c28bad2fa6b` | `SUCCESS` |
| Socket | `45d73f71-850a-43f8-a30d-102747a214d8` | `SUCCESS` |
| Database | `6922606e-d6f1-4665-94bc-227174685123` | Existing isolated instance remains `SUCCESS` |

Only the access-code variable's presence and the validator's safe error were
checked. No value or exact length was read. The value must be 32–256 characters
without line breaks; the owner must correct it directly in the staging
gateway's Railway Variables.

All four staging services still have zero public domains and zero TCP proxies.
No public address was generated, no production changes were made, and no
sign-in or gameplay writes were performed. Gateway access and the authenticated
flight remain **BLOCKED**, not certified.

### Corrected deployment and live restrictions: 2026-10-26 UTC

The owner replaced the staging code through Railway Variables. Deployment
`d75191d3-6252-4003-ad7e-e5fbf82898a4` reached `SUCCESS`, and runtime logs
confirmed the gateway was listening without a configuration error. The code's
value was not retrieved.

Only after that success, the gateway received this address:

`https://wfm-app-staging-staging.up.railway.app`

Its health endpoint returned 200 and its root returned 403 while the bootstrap
origin was still active, confirming it did not expose the old ungated frontend.
The real gateway origin and the exact API/socket origin allowlists were then
deployed together, still using source commit
`b9be83a62de348293157a8e63f02a65988506649`.

| Service | Current deployment | Observed status |
| --- | --- | --- |
| Gateway | `a33d9169-4475-4f3a-a216-09a2a69dc063` | `SUCCESS`; listening, no runtime errors observed |
| API | `17f79d09-2e29-4d60-a40c-0e9a959533c3` | `SUCCESS` |
| Socket | `4c41dce5-7125-47be-9f4a-3b57423308ff` | `SUCCESS` |

Live anonymous verification passed all eleven HTTP checks:

| Request | Expected and observed |
| --- | --- |
| GET `/__staging/healthz` | 200 |
| GET `/__staging/access` | 200; access form present |
| GET `/`, `/sign-in`, `/assets/unauthorized-check.js` | 401 each |
| GET `/api/game/profile`, `/api/readyz` | 401 each, `staging_access_required` |
| GET `/ws` without an upgrade | 401 |
| GET `/` with an untrusted Origin | 403 |
| POST `/__staging/access` without Origin | 403 |
| POST `/__staging/access` with the correct Origin and a deliberately invalid synthetic code | 401 |

All responses had `Cache-Control: no-store`; none issued an access cookie.
Three real WebSocket upgrade attempts also returned 401: correct Origin
without a session, missing Origin, and an untrusted Origin.

Only the gateway has a public domain. The API, socket, and database retain
zero public domains and zero TCP proxies. No production configuration was
changed, and no Clerk account or progression records were created.

**Still pending:** a successful code unlock, authenticated upstream
connectivity, approved Clerk staging-account sign-in, a complete flight,
debrief/reward persistence, and live restart/reconnect checks. The browser
runner does not have the access code; `WFM_STAGING_ACCESS_CODE` is absent from
its secure test configuration. Anonymous rejection tests do not certify these
positive flows or production readiness.

### Code-authorized connectivity: 2026-10-26 UTC

The owner supplied `WFM_STAGING_ACCESS_CODE` through the secure test-secret
flow. A test process used it without displaying the code, cookie, or token.
The existing deployed source and Railway configuration were left unchanged.

| Live check | Observation |
| --- | --- |
| Correct code submission | 303 redirect to `/` |
| Access cookie policy | Secure, HttpOnly, SameSite=Lax |
| Unlocked `/` and `/sign-in` | 200 each |
| Unlocked `/api/readyz` through the private API | 200 |
| Unlocked `/api/game/profile` without Clerk credentials | 401, `authentication_required` |
| WebSocket `/ws?room=staging-gate-check` with gate session and approved Origin | Upgrade succeeded |
| Logout while the socket was open | 303; active socket closed |
| Reuse of the revoked cookie | 401 |

An initial WebSocket probe omitted the required `room` query parameter and
received 400. The proper request succeeded; that response was protocol
validation, not a proxy defect. No application-code change was necessary.
The probe did not send a join message or create a match.

**Gateway deployment and private-upstream connectivity are verified.** This is
not authenticated gameplay certification: the profile's 401 is expected before
Clerk sign-in. The runner still needs an approved, existing account from the
same isolated WFM Development Clerk instance before checking sign-in, a full
flight, rewards, and saved progression. No production account, new test user,
or progression write was used in these checks.

### Browser form regression discovered during flight setup

The real browser could not pass the gate even though the explicit-Origin HTTP
probe passed. A focused browser check confirmed `Referrer-Policy: no-referrer`
made the form POST carry `Origin: null`, producing 403.

The source fix changes the access-form pages to `Referrer-Policy: same-origin`;
other responses retain their existing policy. The strict origin check is
unchanged, and a regression test verifies that an opaque `null` Origin is
still rejected, even with the correct synthetic code.

All seven gateway tests, API typecheck, and API build pass after this fix.
The form fix was deployed from `2622ec0f97d541de954a621de7abbab1e2f5f913`
in Railway deployment `25506d2b-a7fb-4095-a7df-9624ebf89805`. The browser then
successfully submitted the code and received the normal 303 redirect.

The next check stopped before filling Clerk credentials: sign-in was blank
because the frontend's internal hostname-derived key helper selected
`clerk.wfm-app-staging-staging.up.railway.app`, which failed certificate
validation. The frontend is being corrected to honor the explicitly configured
key, as the API already does. No keys were inspected or changed. The three
new configuration tests, all 18 existing game tests, game typecheck, and game
production build pass. Live Clerk account authentication remains unverified.
