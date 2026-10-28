# Production API URL preflight

This check validates only the Production frontend's public API base URL
configuration shape. It does not prove Railway service identity, Clerk key
pairing, user sign-in, or Production readiness. Its `productionEnablement` result
remains `BLOCKED` even when the structural URL check passes.

Run it only in an authorized frontend service context:

```sh
pnpm --filter @workspace/scripts run preflight:clerk:production-api-url -- --service frontend
```

The check requires these declarations:

- `WFM_CLERK_PREFLIGHT_TARGET=railway-production`
- `WFM_CLERK_AUTH_PROVIDER=external-clerk`
- `WFM_CLERK_BACKEND_HOSTING=railway`
- `VITE_API_BASE_URL` must be an absolute HTTPS URL without credentials, query, or fragment.

The report exposes statuses only; it never prints the URL or credential values.
The target and provider/hosting declarations are operator assertions, not proof
that the process is running inside the intended Railway service. A structural
pass exits with status 2 because Production authorization remains unverified.
Before any Production enablement, separately verify the Clerk frontend/API key
pair, issuer, allowed origins and redirects, email delivery, protected API
access, profile load, refresh, sign-out, and unauthenticated rejection.
