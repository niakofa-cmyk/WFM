# Staging Clerk auth preflight

The staging preflight is an operator-only, read-only CLI check. It does not add
an HTTP endpoint, contact Clerk, verify a JWT, test email delivery, or prove
that configured keys belong to the declared instance. The existing public
staging health endpoint remains limited to health status.

Run each invocation only in an authorized Railway staging service-scoped
process context so the process sees that service's environment. Do not run it
against Production, add variables to Railway to satisfy the check, or put
credentials on a command line.

The operator must supply these non-secret, process-only declarations:

- `WFM_CLERK_PREFLIGHT_TARGET=railway-staging`
- `WFM_CLERK_BACKEND_HOSTING=railway`
- `WFM_CLERK_AUTH_PROVIDER=external-clerk` only if independently confirmed;
  use `replit-managed` when that is the known provider. The managed provider
  declaration intentionally blocks because Replit-managed Clerk Auth is
  intended for Replit-hosted apps, not Railway-hosted backends.
- `WFM_STAGING_CLERK_ISSUER` set to the owner-approved public staging issuer.

Do not infer the provider from key prefixes, issuer strings, or the presence of
variables. Missing or ambiguous declarations fail closed before key-variable
presence is inspected. An `external-clerk` declaration is still an assertion,
not verified compatibility or key-instance pairing.

Example after setting the declarations above in the authorized process
environment (replace the issuer placeholder with the approved public issuer):

```sh
WFM_CLERK_PREFLIGHT_TARGET=railway-staging \
WFM_CLERK_AUTH_PROVIDER=external-clerk \
WFM_CLERK_BACKEND_HOSTING=railway \
WFM_STAGING_CLERK_ISSUER=https://<owner-approved-staging-issuer> \
pnpm --filter @workspace/scripts run preflight:clerk:staging -- --service frontend

WFM_CLERK_PREFLIGHT_TARGET=railway-staging \
WFM_CLERK_AUTH_PROVIDER=external-clerk \
WFM_CLERK_BACKEND_HOSTING=railway \
WFM_STAGING_CLERK_ISSUER=https://<owner-approved-staging-issuer> \
pnpm --filter @workspace/scripts run preflight:clerk:staging -- --service api

WFM_CLERK_PREFLIGHT_TARGET=railway-staging \
WFM_CLERK_AUTH_PROVIDER=external-clerk \
WFM_CLERK_BACKEND_HOSTING=railway \
WFM_STAGING_CLERK_ISSUER=https://<owner-approved-staging-issuer> \
pnpm --filter @workspace/scripts run preflight:clerk:staging -- --service socket
```

The frontend check reports presence for `VITE_CLERK_PUBLISHABLE_KEY` and exact
`STAGING_PUBLIC_ORIGIN` matching. The API check reports presence for
`CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, plus exact
`API_ALLOWED_ORIGINS` matching. The socket check reports presence for
`CLERK_SECRET_KEY`, `CLERK_ISSUER`, and `WING_ALLOWED_ORIGINS`, the exact
allowed-origin match, and whether the configured public issuer matches the
operator-declared issuer. Any reported issuer is sanitized to an HTTPS origin;
credentials, path, query, or fragment are never emitted.

`STRUCTURAL_ONLY_EXTERNAL_TENANT_UNVERIFIED` means only that the selected
process's variable-presence and metadata comparisons passed. It does not mean
the Railway service context was independently authenticated, Clerk key
pairing was proved, or sign-in/socket authentication works. No token or secret
values are printed. Production enablement remains `BLOCKED`.
