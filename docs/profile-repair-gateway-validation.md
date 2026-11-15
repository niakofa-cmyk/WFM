# Profile repair: validation-only private staging gateway

## Status and approval boundary

Prepared for review only. This branch is not a production candidate, is not part
of the profile-repair pull request, and has not been deployed. Creating this
branch does not authorize a Railway source/configuration change or deployment.

No live account checks were performed as part of this preparation. A passing
local gateway fixture is not Clerk sign-in, profile persistence, account
isolation, gameplay, reward, or production certification.

## Separate source provenance

- Repair application base: `250cc17c38fce61bc4f942434fc7ab995e47f94a`.
- Private hosting infrastructure source:
  `81ad603a5a0d300714bee024d58342c8115312df`.
- Branch: `validation/profile-repair-private-gateway`.

The complete frontend, existing API application source, socket source, shared
libraries, dependency versions, lockfile, workflows, and release-policy files
remain unchanged from the repair base. No Orbital gameplay, schema migration,
feature flag, authentication replacement, or provider configuration was added.

Only these infrastructure files were imported, byte-for-byte, from the pinned
hosting source:

```text
artifacts/api-server/src/staging/access.ts
artifacts/api-server/src/staging/access.test.ts
artifacts/api-server/src/staging/config.ts
artifacts/api-server/src/staging/gateway.ts
artifacts/api-server/src/staging/gateway.test.ts
artifacts/api-server/src/staging/index.ts
artifacts/api-server/src/staging/page.ts
artifacts/api-server/src/staging/replica-lookup.ts
artifacts/api-server/src/staging/replica-lookup.test.ts
artifacts/api-server/src/testing/http-request.ts
```

Additional changes are limited to:

1. One `staging-gateway` entry point in the existing API build.
2. API package scripts `start:staging` and `test:staging`.
3. This review document.

The package's existing `start` and `test` scripts remain unchanged.
`test:staging` is explicit and must be run separately; existing CI has not been
modified or claimed to cover this validation branch.

## Local verification

Executed successfully during branch preparation:

```sh
# From artifacts/api-server, using the existing installed dependency versions:
tsx --test --test-concurrency=1 src/staging/*.test.ts
tsc --noEmit --strict --module esnext --moduleResolution bundler \
  --target es2022 --esModuleInterop --skipLibCheck --types node \
  --lib ES2022,DOM src/staging/*.ts src/testing/http-request.ts
NODE_ENV=production node build.mjs
```

- All nine gateway tests passed using synthetic data and loopback upstreams.
- Focused gateway TypeScript check passed.
- Build emitted the existing API/socket bundles and the new gateway bundle.
- All ten imported files were compared as raw bytes to the pinned source.
- API package metadata was compared structurally against the base after
  removing exactly the two added scripts.
- API build wiring was compared against the base with exactly one added entry.
- No application, library, dependency, workflow, or release-policy changes.

The tests cover unauthenticated page/asset/API denial; access-code login;
continued upstream Clerk authorization; Bearer preservation; stripping only
the gateway cookie; hostile/null Origin rejection; hostile Host rejection;
oversized bodies; throttling; forged/expired/revoked access sessions; gated
WebSocket upgrades; logout revocation; and private-replica DNS rotation.

Reproduce source comparison from this branch with both pinned commits fetched:

```sh
base=250cc17c38fce61bc4f942434fc7ab995e47f94a
infra=81ad603a5a0d300714bee024d58342c8115312df

git diff --exit-code "$base" -- \
  artifacts/war-for-mars lib pnpm-lock.yaml .github scripts
git diff --exit-code "$base" -- artifacts/api-server/src \
  ':!artifacts/api-server/src/staging' \
  ':!artifacts/api-server/src/testing/http-request.ts'
git diff --exit-code "$infra" -- artifacts/api-server/src/staging \
  artifacts/api-server/src/testing/http-request.ts
git diff --stat "$base"
```

## Proposed staging use, requiring separate approval

If approved later, only the staging app would use this validation commit.
The staging API and socket should remain pinned to the original repair SHA.
Keep the existing private access-code gateway, private upstreams, origin/host
checks, and separate Clerk authentication. Do not replace the gateway with an
ungated static server. No new dependencies, schema changes, or flag changes
are needed for this infrastructure proposal.

This necessarily gives the app a **different deployment SHA** from the repair.
Evidence must identify both the validation hosting commit and unchanged repair
application provenance. It cannot claim all three services deployed the
identical repair SHA.

After a separately approved app deployment:

1. Verify the app's served frontend and gateway provenance, and verify the API
   and socket still serve the original repair.
2. Confirm gateway health, locked page/asset/API rejection, normal unlock,
   upstream readiness, and unauthenticated profile rejection.
3. Sign in as approved staging account A and confirm its profile loads.
4. Reload and confirm A's profile persists.
5. Sign out and sign in as approved staging account B in the same browser.
6. Confirm B sees B's profile, not A's; sign out and close the browser.

Do not play, change progression, claim rewards, merge the repair pull request,
or touch production. The existing Clerk new-device challenge remains an
independent blocker until a valid approved verification path is available.
