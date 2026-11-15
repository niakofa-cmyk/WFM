# Production sign-in frontend hotfix — review only

## Release boundary

Prepared against the actually deployed production frontend revision
`05e17d8040856336904178e115425d6e56e2d9f4`, not the broader Development branch.
The reviewed branch is `fix/wfm-production-signin-return`.

This preparation is **not authorization to merge or deploy**. No production
service, authentication setting, environment variable, or database was changed.
The previously approved fresh-production schema initialization must not be rerun.

## Changes

- Use the explicitly configured Clerk publishable key instead of deriving an
  instance from the website hostname.
- Set both completed sign-in and registration destinations to the mounted game
  entry, including `/kids/wfm/` in production, rather than the host site's
  generic `/login` destination.
- Add six regression tests for instance selection, missing configuration,
  mounted return destinations, unsafe paths, and both component bindings.
- Include auth tests in the existing frontend test command so routine CI runs
  them as well.

Only the three frontend auth files, the frontend test command and this review
document differ from the production base. The existing `GameApiSession` bearer-token transport, SDK
versions, lockfile, API, socket, gameplay and deployment configuration are
unchanged. No private staging gateway is added to production.

## Verification

- Six focused auth regression tests: passed.
- Full frontend test command, including the new auth regressions and existing
  profile-token/account-isolation tests: all 25 passed.
- Library TypeScript build and frontend type check: passed.
- Frontend Vite build with `BASE_PATH=/kids/wfm/`: passed.
- The local build used a synthetic public-key fixture, not a production
  credential. Generated build output is not part of this release; Railway must
  rebuild using its existing production configuration if deployment is approved.
- The three frontend auth files match staging hotfix
  `84706e6c91ec9e4c0490033fc357d263ad6061a3`.
- Staging deployment `70afe82b-ffa9-4858-a0dd-8942acb9c25c` succeeded.
- The owner confirmed trusted-phone game/profile loading and reload retention.
  Current staging gateway logs corroborated profile HTTP 200 responses on
  2026-11-15 at 21:58:16, 21:58:55 and 21:58:58 UTC.

## Remaining limits

A fresh staging email-code challenge is **not certified**. Clerk rejected code
preparation with `dev_monthly_email_limit_exceeded`; no code was submitted to
work around that limit. Trusted-session evidence is not fresh-challenge evidence.
Production sign-in/profile behavior with this hotfix remains untested until a
separately approved frontend deployment is serving.

## Proposed deployment and rollback

After explicit approval, release only the reviewed frontend source, retaining
its current production build/start commands and environment configuration. Do
not deploy the API or socket and do not apply a migration as part of this fix.

Then verify canonical `/kids/wfm/sign-in` return, authenticated profile HTTP 200,
and profile/session retention on reload using the approved production account.
Check the direct Railway host's actual Clerk hostname/TLS separately; any Clerk
origin-policy restriction must be reported, not bypassed.

The previous successful frontend deployment is
`0351e2c3-0fef-4ffa-b630-a76b7590f28c` at the production base above. If the
frontend release regresses, restore only that frontend deployment through
Railway's reviewed rollback path. Do not undo the separately approved database
schema repair.
