---
name: Preview API isolation
description: Keep the Replit Development preview on its matching local API and database.
---

The Replit Development game preview must use the same-origin `/api` route to
reach the local API. Do not point its `VITE_API_BASE_URL` at a Railway
Production service. The published/production target is separate and must not be
changed while fixing preview authentication.

**Why:** the preview's Replit-managed Development Clerk session is not
interchangeable with the Railway Production Clerk instance. Sending that
session to Production caused `authentication_required` and risked crossing the
intended data boundary.

**How to apply:** when the Development preview reports a profile 401, verify
that its API base is empty so requests stay same-origin; verify `/api/healthz`
and expect unauthenticated profile requests to remain 401. Do not treat a public
landing-page screenshot as an authenticated profile test.
