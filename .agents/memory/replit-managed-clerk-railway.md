---
name: Managed Clerk hosting boundary
description: Replit-managed Clerk Production keys and use with Railway or other external hosting.
---

Replit-managed Clerk keeps Development and Production instances separate. Replit states that production keys are swapped automatically when publishing through Replit; the managed keys are not automatically available to Railway. Its guidance directs external hosting to a user-managed Clerk application. Do not copy or rotate Replit-managed secrets into Railway as a workaround.

**Why:** WFM's frontend and API run on Railway while its Clerk integration is Replit-managed. Variable-name presence does not prove same-instance key pairing, and the public sign-in previously showed Development mode.

**How to apply:** Confirm the hosting/auth architecture before production auth changes. Keep managed key switching within Replit publishing; if Railway remains the host, use an explicitly owner-authorized external Clerk configuration. Never infer pairing from variable names or inspect secret values.
