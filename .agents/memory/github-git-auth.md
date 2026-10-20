---
name: GitHub push authentication
description: Use the authenticated GitHub CLI as Git's credential helper when a push fails despite an active GitHub login.
---

If `git push` reports invalid username or token while `gh auth status` confirms an active GitHub account, run `gh auth setup-git` and retry. This uses the CLI's existing authentication without reading or printing the credential.

**Why:** The repository's GitHub connection and CLI login were valid, but Git was not using the CLI credential helper; configuring it fixed the push.

**How to apply:** On GitHub push authentication failures, check `gh auth status`; if active, run `gh auth setup-git` before requesting new credentials or changing the remote.
