---
name: Railway package-manager inference
description: Why the root pnpm version must stay explicit and consistent with CI.
---

Keep the root package-manager pin and CI toolchain consistent; do not solve Railway frozen-install failures by disabling the lockfile check or regenerating an unchanged lockfile.

**Why:** Railpack inferred pnpm 9 from the version-9 lockfile, while the workspace and CI used pnpm 10. The inferred version ignored workspace-file overrides and rejected every service's frozen install.

**How to apply:** inspect the selected pnpm version in build logs first. Lockfile format alone does not identify the intended pnpm major. Verify a frozen install with the declared manager before changing dependencies.
