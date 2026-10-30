---
name: Nested checkout package-manager isolation
description: Keep a separate repository's Corepack and pnpm caches from changing the parent WFM workspace.
---

When checking a separate repository inside the WFM workspace, point `COREPACK_HOME` and `PNPM_HOME` outside the WFM checkout before running Corepack or pnpm. A tool cache under WFM's `.local` can be detected by the parent workspace and cause its lock metadata to change, even when the install is run from the nested repository.

**Why:** A nested-repository install unexpectedly changed the WFM lock and workspace metadata; the parent checkout was clean beforehand.

**How to apply:** Use cache directories outside the parent checkout for nested-repository commands, then inspect both repositories' Git status before and after.
