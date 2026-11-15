---
name: WFM Clerk E2E account isolation
description: Safety rules for authenticated browser tests against WAR FOR MARS.
---

Authenticated browser tests must use a dedicated account that already exists in the WFM Development Clerk instance. Do not reuse test fixtures from another product, and do not automatically create an account when the configured email is missing from Clerk.

**Why:** The selected Clerk application has not been verified from the configured keys, so provisioning could create a user in the wrong instance. A working testing token proves a development instance is reachable, not that it is the intended application.

**How to apply:** Use the WFM sign-up flow to create the development test account, configure only its email for the Playwright testing-ticket helper, and verify the intended Clerk instance before adding automated account provisioning.
