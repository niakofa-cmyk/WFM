---
name: Staging browser verification
description: Protect credentials and distinguish real browser request behavior from synthetic HTTP tests.
---

Do not transfer test credentials through tool messages, URLs, public relay
routes, traces, or stored browser-state files when a remote browser notebook
cannot access project secrets. Use a project-side browser process that reads
the approved secret names itself. Keep long flights in a managed background
process rather than an ordinary detached process or a foreground shell call.

**Why:** the remote browser notebook does not share project environment
variables, and a six-minute Strike exceeds the foreground shell time limit.

**How to apply:** retain credentials and sessions only in the driver's memory,
emit sanitized status fields, and use the existing testing agent to evaluate
that driver's evidence rather than starting another tester.

Synthetic HTTP tests that explicitly supply Origin do not prove browser form
submissions will supply the same Origin under the page's privacy headers.

**Why:** a real browser rejected the staging form despite passing HTTP probes:
the page's no-referrer policy made its form POST carry an opaque Origin.

**How to apply:** verify actual browser-supplied request metadata for changes
to form/privacy headers; never resolve such failures by accepting null or
untrusted origins.

Authentication tests must confirm an active session before forcing navigation
away from a sign-in flow. A submitted form or changed URL is not sign-in proof.

**Why:** navigating after a fixed post-submit delay can interrupt session or
redirect completion and leave an inconclusive signed-out page without exposing
whether authentication succeeded, failed, or required another step.

**How to apply:** wait for a confirmed session or a specific safe error/challenge,
then require an authenticated profile response before starting rewarded play.

Follow normal intermediate sign-in screens. A separate password screen with
`needs_first_factor` is not itself a credential rejection or an active session.

**Why:** the hosted Clerk form can advance from the initial form to a separate
password factor; a driver that does not handle that screen cannot test login.

**How to apply:** submit the approved password factor once through its rendered
UI, distinguish an actual rejection from an intermediate step, and stop on
verification challenges or errors without retrying passwords.

Use Clerk's fixed verification codes only with a verified test-email alias in
the same instance; do not carry a code or test-mode assumption across instances.

**Why:** the staging account used a regular email and triggered a new-device
challenge; a test code configured in a separate Production instance did not
establish Development authentication.

**How to apply:** verify the `+clerk_test` alias requirement for automated OTP
tests, keep the alias attached to the intended user profile, and never treat
an OTP from another instance as proof of sign-in.

When Clerk instance metadata does not expose a comparable instance identifier,
compare the frontend and Backend API JWKS sets in memory and report only whether
they match.

**Why:** the instance endpoint and public environment response may omit a
comparable frontend identifier, while the public signing-key set can establish
whether both sides use the same instance without exposing key material.

**How to apply:** compare `GET /v1/jwks` from the authenticated connector with
the frontend's `/.well-known/jwks.json`; log only counts and equality, never
JWK values. Verify Development mode before any account lookup or write.

Keep OTP submission in the process/client that owns the waiting browser page.
Do not assume a second Playwright connection can resume another client's page.

**Why:** separate connections to a Playwright launch server exposed isolated
contexts; reconnecting succeeded but returned no original contexts or pages.

**How to apply:** prove a private, in-process OTP handoff with synthetic input
before starting another live challenge. Never log codes, expose a public relay,
or persist browser login state as a workaround.

Keep helper diagnostics failure-isolated from the browser-owning process.

**Why:** an early diagnostic failure led to an unhandled stream write error
that terminated the authenticated browser owner and lost the active session.

**How to apply:** handle IPC and child-stdin errors, return sanitized failure
states, and synthetically test helper failure/disconnect paths before involving
real sign-in. Preserve the first claim response so diagnosis does not need retries.

Require a deployed backend's accepted claim, not a local victory screen, as
evidence of a rewarded flight.

**Why:** a normally rendered browser battle reached a victory debrief while
server adjudication rejected its terminal replay frames. Same-source deployment
metadata and local unit tests did not establish runtime replay acceptance.

**How to apply:** test the full recorded browser replay against the intended
backend without truncating it or weakening validation. Freeze the accepted
balance before a duplicate request; asynchronous response listeners must not
overwrite the comparison baseline.
