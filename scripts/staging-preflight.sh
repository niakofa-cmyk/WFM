#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$workspace_root"

printf '%s\n' '[Staging preflight] Type-checking workspace...'
pnpm run typecheck

printf '%s\n' '[Staging preflight] Running workspace tests...'
pnpm test

printf '%s\n' '[Staging preflight] Building and auditing artifacts...'
pnpm run build

printf '%s\n' '[Staging preflight] PASS. No database migration or remote deployment was run.'
