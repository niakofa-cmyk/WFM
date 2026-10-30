---
name: Railway service-scoped preflight
description: Run value-safe service checks and distinguish Railway connector access from local CLI visibility.
---

For a read-only preflight that needs a Railway service's variable presence or public configuration, the Railway CLI can inject selected service variables into a local command. Explicitly select the project, environment, and service, and check the installed CLI's help for supported flags rather than assuming options from another version. Railway MCP authorization and the local CLI's login/token are separate authentication contexts; a secret's presence does not prove that the CLI accepts it. Verify the CLI from the same workspace shell before running service-scoped commands.

Do not infer missing Railway workspace membership from a CLI project list alone when the connected Railway account can see the project. Even a matching `whoami` email does not explain why CLI and connector visibility differ. Do not invite another account or change workspace membership solely because the CLI list omits the project; first reconcile the local CLI session, supported workspace-selection behavior, and connector context.

**Why:** The Replit workspace does not provide a shell inside a Railway service. Service-scoped variable injection is a safer read-only alternative, but Railway sealed variables may not be available locally, and a script's target label remains an operator assertion rather than proof of identity-provider authorization or key pairing. Railway's connected account and local CLI can also disagree on project visibility; a rejected or missing CLI result alone does not prove the owner must invite another account. A rejected narrow token must not be silently replaced with a broader credential.

**How to apply:** Use only with scripts designed to report statuses and variable presence, never values. Confirm authentication in the same shell (suppressing account details), then use explicit staging project/environment/service selectors. If the connected account sees a project but the authenticated CLI does not, stop before linking or accessing a database and reconcile the context without changing membership based only on that discrepancy. Do not use this for production sign-in, mutations, or deployments; report missing sealed variables as an execution limitation, not proof they are absent from the running service.
