---
name: Staging and promotion policy
description: Environment separation and promotion requirements for WAR FOR MARS.
---

Use a separate Repl, database, and authentication environment for staging. Never reuse production data or secrets in staging. Promote changes only after staging checks pass; staging success alone does not establish production readiness.

**Why:** the user explicitly requested isolated staging data and a test-gated promotion process.

**How to apply:** when preparing staging, configuring authentication or databases, or promoting changes, preserve isolation and require evidence of passing staging checks. Review production schema, auth, recovery, and rollback separately.
