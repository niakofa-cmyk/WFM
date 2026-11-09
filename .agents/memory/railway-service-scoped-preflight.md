---
name: Railway service-scoped preflight
description: Run value-safe service checks and distinguish Railway connector access from local CLI visibility.
---

Distinguish a configured source pin from a deployment's reported commit metadata.

**Why:** an approved staging rollout retained its intended source pin, while
deployment metadata reported the branch's later documentation-only commit.
Neither field alone proved the other was wrong.

**How to apply:** record both separately, compare the exact revisions before
claiming runtime equivalence, and never claim an exact tested runtime match if
their gameplay source differs.

For a read-only preflight that needs a Railway service's variable presence or public configuration, the Railway CLI can inject selected service variables into a local command. Explicitly select the project, environment, and service, and check the installed CLI's help for supported flags rather than assuming options from another version. Railway MCP authorization and the local CLI's login/token are separate authentication contexts; a secret's presence does not prove that the CLI accepts it. Verify the CLI from the same workspace shell before running service-scoped commands.

Railway SSH is service-scoped: an API service shell is not a PostgreSQL session. Verify the exact service name from read-only environment metadata before opening a shell. SQL statements pasted directly at a Linux shell prompt are treated as shell commands; use an authorized SQL client connected to the intended staging database, and keep reward-ledger checks read-only.

The Railway MCP toolset provides project, service, deployment, status, and log inspection, but no SQL execution path. Replit's `executeSql` callback targets Replit-managed databases, not an external Railway PostgreSQL database. If an audit needs Railway Postgres rows and no authorized read-only SQL connection is available, do not substitute another database or retrieve credentials; stop and have an authorized operator run bounded read-only queries and share sanitized aggregates.

When diagnosing a specific Railway release, request logs by deployment ID. Broad service/environment log queries can include older build or healthcheck failures and make them look current; correlate timestamps and deployment IDs before assigning a warning or error to the active release.

Structured JSON stdout can appear in Railway logs as an empty `message` with
the event and fields stored in `attributes`, not as searchable message text.

**Why:** message-only searches missed WFM's startup readiness records even
though the exact deployment had emitted them.

**How to apply:** inspect attribute names first, then print only allowlisted
readiness event/boolean/version fields. Do not dump arbitrary attributes or
interpret a blank message as missing telemetry.

Do not infer missing Railway workspace membership from a CLI project list alone when the connected Railway account can see the project. Even a matching `whoami` email does not explain why CLI and connector visibility differ. Do not invite another account or change workspace membership solely because the CLI list omits the project; first reconcile the local CLI session, supported workspace-selection behavior, and connector context.

**Why:** The API and Postgres services are separate Railway targets, so a shell on the API service cannot accept SQL directly. The Replit workspace does not provide a shell inside a Railway service. Service-scoped variable injection is a safer read-only alternative, but Railway sealed variables may not be available locally, and a script's target label remains an operator assertion rather than proof of identity-provider authorization or key pairing. Railway's connected account and local CLI can also disagree on project visibility; a rejected or missing CLI result alone does not prove the owner must invite another account. A rejected narrow token must not be silently replaced with a broader credential. Service-level log results can span multiple releases, so exact deployment scoping is needed to distinguish a current fault from superseded healthcheck failures. Replit's SQL callback does not reach external Railway Postgres, and the Railway MCP connection has no SQL executor.

**How to apply:** Use only with scripts designed to report statuses and variable presence, never values. Confirm authentication in the same shell (suppressing account details), then use explicit staging project/environment/service selectors. For incident timelines, query logs for the exact deployment ID and verify timestamps before attributing errors. If the connected account sees a project but the authenticated CLI does not, stop before linking or accessing a database and reconcile the context without changing membership based only on that discrepancy. For a Railway database audit, require an explicitly authorized read-only SQL path to that exact staging database; never use Replit's managed-database callback as a substitute. Do not use this for production sign-in, mutations, or deployments; report missing sealed variables as an execution limitation, not proof they are absent from the running service.
