---
name: Managed Clerk hosting boundary
description: Replit-managed Clerk Production keys and use with Railway or other external hosting.
---

Replit-managed Clerk keeps Development and Production instances separate. Replit states that production keys are swapped automatically when publishing through Replit; the managed keys are not automatically available to Railway. Its guidance directs external hosting to a user-managed Clerk application. Do not copy or rotate Replit-managed secrets into Railway as a workaround.

**Why:** WFM's frontend and API run on Railway while its Clerk integration is Replit-managed. Variable-name presence does not prove same-instance key pairing, and the public sign-in previously showed Development mode.

**How to apply:** Confirm the hosting/auth architecture before production auth changes. Keep managed key switching within Replit publishing; if Railway remains the host, use an explicitly owner-authorized external Clerk configuration. Never infer pairing from variable names or inspect secret values.

For the owner-selected external Clerk Production instance, the independently hosted API must use its configured instance rather than derive an instance from the API request hostname. The installed Clerk `publishableKeyFromHost` helper preserves a Development fallback but derives a new key for Production; it does not preserve a configured Production fallback.

**Why:** The game origin and Railway API hostname differ. Host-derived Production configuration can select a different Frontend API than the one that issued the player's session.

**How to apply:** Preserve the fixed external-instance configuration on the API. Do not reintroduce host-derived instance selection merely to copy Replit-managed multi-domain examples; keep credentials private and validate with synthetic signing material.
