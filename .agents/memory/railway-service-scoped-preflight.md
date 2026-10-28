---
name: Railway service-scoped preflight
description: Run value-safe checks with one Railway service's variables without changing that service.
---

For a read-only preflight that needs a Railway service's variable presence or public configuration, the Railway CLI can inject selected service variables into a local command. Use an explicit project, environment, and service with `railway run --no-local`; the flag prevents local development overrides from being mixed into the selected service context. A one-off `pnpm dlx @railway/cli` works when the CLI is not installed in the workspace.

**Why:** The Replit workspace does not provide a shell inside a Railway service. Service-scoped variable injection is a safer read-only alternative, but Railway sealed variables may not be available locally, and a script's target label remains an operator assertion rather than proof of identity-provider authorization or key pairing.

**How to apply:** Use only with scripts designed to report statuses and variable presence, never values. Do not use it for production sign-in, mutations, or deployments; report missing sealed variables as an execution limitation, not proof they are absent from the running service.
