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

For production email-factor checks, an HTTP 200 from Clerk's second-factor preparation endpoint and a visible code challenge prove only that challenge setup was accepted. They do not prove the email reached the account's inbox.

**Why:** A Production sign-in attempt showed a prepared second-factor challenge without a visible rate-limit or delivery error, while the account owner reported that no email arrived.

**How to apply:** Verify delivery from the matching Clerk instance's mail logs or recipient confirmation. Do not claim delivery from HTTP status alone, and avoid repeated sign-in/code requests that may trigger rate limits.

Reusing the same email/password values across deployment and Production does not establish a shared Clerk user store or identify which instance handled a sign-in.

**Why:** The user reports using the same credentials in both environments, while the connected Clerk API reports Development and the public WFM bundle serves a live publishable key.

**How to apply:** Verify the actual instance environment and key mode before attributing account or email-delivery behavior to a Clerk environment. Never infer a key match from reused credentials.

A Replit Clerk connector's `connection.environment` can report `production` while its authenticated Clerk instance reports `environment_type: development`.

**Why:** The Replit connector scope and the Clerk tenant environment are separate signals; trusting the former can misidentify a Development tenant as Production.

**How to apply:** For any Clerk connection, check the authenticated instance metadata and treat `environment_type` as authoritative for the tenant actually reached. Do not use the connector scope as proof of an external Production connection.

Preserve WFM's existing Replit-managed Development Clerk while evaluating external Production auth. Do not delete or replace the managed app until a verified migration and recovery plan exists and the owner explicitly approves the replacement.

**Why:** The user chose to keep Development authentication intact while considering an external Production Clerk. Replit documents that switching to an external Clerk requires deleting the managed app first; deletion removes the tenant and does not automatically migrate accounts, credentials, or sessions.

**How to apply:** Keep Production authorization blocked unless a genuinely separate external Production connection is supported and verified. If replacement is later proposed, first document account/session impact, dependencies, cutover validation, and rollback; obtain explicit owner approval before any deletion or cutover.
