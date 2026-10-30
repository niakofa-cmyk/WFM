---
name: Railway service-scoped preflight
description: Run value-safe checks with one Railway service's variables without changing that service.
---

For a read-only preflight that needs a Railway service's variable presence or public configuration, the Railway CLI can inject selected service variables into a local command. Explicitly select the project, environment, and service, and check the installed CLI's help for supported flags rather than assuming options from another version. Railway MCP authorization and the local CLI's login/token are separate authentication contexts; a secret's presence does not prove that the CLI accepts it. Verify the CLI from the same workspace shell before running service-scoped commands.

**Why:** The Replit workspace does not provide a shell inside a Railway service. Service-scoped variable injection is a safer read-only alternative, but Railway sealed variables may not be available locally, and a script's target label remains an operator assertion rather than proof of identity-provider authorization or key pairing. A rejected narrow token must not be silently replaced with a broader credential.

**How to apply:** Use only with scripts designed to report statuses and variable presence, never values. Confirm authentication in the same shell (suppressing account details), then use explicit staging project/environment/service selectors. Do not use it for production sign-in, mutations, or deployments; report missing sealed variables as an execution limitation, not proof they are absent from the running service.
