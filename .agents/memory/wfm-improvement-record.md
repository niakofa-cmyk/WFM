---
name: WFM improvement record
description: Standing WFM device-scope and staging-promotion decisions.
---

For material WAR FOR MARS improvements and enhancements, maintain the dated
project record in `docs/game-improvement-record.md`. Keep this memory index
current when a durable game rule, product direction, or release gate changes.
Put implementation history, verification counts, and deployment evidence in
the project record or test reports—not in `MEMORY.md`.

**Why:** the owner asked for an ongoing record of WFM improvements and for the
project memory to stay current. The memory system is an index of durable
decisions, not a code changelog.

**How to apply:** after a material WFM improvement, update the project record
with its scope, verification, and remaining blockers. Add or revise a memory
pointer only for durable context a future agent cannot recover from code. Never
include credentials, tokens, personal account identifiers, or unverified claims.

## Physical-device scope

The owner approved Android Chrome as the required physical-device certification
scope and explicitly said iPhone/Safari is not required. Keep iOS marked
`NOT_REQUIRED`, not `PASS`. Cross-device profile synchronization is a separate
feature gate: a browser-session test on one machine is not evidence of two
physical devices.

**Why:** the owner chose to proceed without requiring iPhone or Safari.

**How to apply:** evaluate Android device evidence against the documented
Android criteria; keep any separate profile-sync gate pending until its own
approved evidence exists. Do not reintroduce iPhone/Safari as a mandatory gate
without a new owner decision.

## Replit invite-only launch policy

The owner confirmed on 2026-10-28 that Replit invite-only deployment is not a
WFM launch requirement. The Railway staging access gateway and private API/socket
boundary remain separate controls and must not be removed or inferred from this
policy decision.

**Why:** the Replit invite-only condition was a legacy promotion flag that did
not describe the protected Railway staging topology.

**How to apply:** do not include Replit invite-only status among required staging
promotion environment assertions unless the owner makes a new decision. Preserve
all other explicit environment and evidence gates.

## Release-status resume source

Before continuing WFM release work, check the current Git branch/worktree,
`docs/game-improvement-record.md`, and the latest entries in
`STAGING-TEST-REPORT.md` and `STAGING-TEST-RESULTS.json`. Treat the dated game
record as the source for Production/auth findings and the staging report/results
as the source for staging deployments, release gates, and device evidence. Keep
changing status out of this memory file. Do not infer live PASS from local tests
or evidence captured in a different environment; evaluate owner-reported device
evidence against the documented criteria.

**Why:** WFM release evidence spans local builds, Railway staging revisions,
physical-device tests, and Production authentication. Similar-looking results
from one environment do not establish readiness in another.

**How to apply:** when resuming after a pause, read the dated record and latest
report/results first, verify their source/deployment context, then continue only
the gates still marked pending. Keep staging promotion and Production
auth/readiness separate.

## Session verification and promotion

Keep Clerk SDK cryptographic verification as the authentication source of
truth. Do not add a WFM cache of raw bearer tokens or verified user IDs, and do
not lengthen authorization lifetimes in response to traffic. Promote staging
through the existing evidence-gated pull-request workflow; do not automate a
local checkout/merge to `main`.

**Why:** the proposed per-token cache could bypass renewed signature/session
checks and retain stale authorization, while a load-adaptive TTL worsens that
window. The installed Clerk backend already maintains a remote JWKS cache, and
the repository has a PR promotion gate tied to staging evidence.

**How to apply:** if authentication performance becomes a measured problem,
benchmark Clerk SDK verification and JWKS fetch behavior first. Preserve
expiration, issuer, audience, authorized-party, ownership, and promotion-gate
checks; do not introduce a token cache based only on assumed external rate
limits.
