---
name: Development schema push mismatch
description: A known Drizzle introspection error in the WFM development database.
---

Drizzle schema introspection has failed before applying changes because an existing PostgreSQL field compared as `text` to the `progression_event_kind` enum. Do not respond by force-pushing the entire schema: the mismatch is unrelated to a new additive table and a forced diff could touch unrelated data.

**Why:** The development schema and Drizzle model have pre-existing type drift. A normal push can fail before it reaches the requested change, so the failure is not evidence that the new table itself is invalid.

**How to apply:** Confirm the database target is Development. Keep the Drizzle schema and additive SQL migration tracked, apply only the new non-destructive object through an approved Development path, and verify the application connection can see it. Never use this workaround for Railway staging or Production; do not change unrelated enum-backed tables without a separate review.
