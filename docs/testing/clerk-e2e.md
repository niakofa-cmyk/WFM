# WFM Clerk browser tests

These tests are for the existing WFM Clerk application and its Development instance only. They do not use or create accounts in the separate NiaKofa project.

## Public browser smoke tests

Run:

```sh
pnpm --filter @workspace/war-for-mars run test:e2e
```

The suite checks the landing page, the Clerk sign-up form, and the browser's ability to enter and exit the Solo Flight 3D scene. It launches an isolated Vite server on port 4173 and points API calls at the local API service on port 8080; it does not target the Railway production API.

## Authenticated Development test

Create a dedicated test account in the WFM Development sign-up flow. In Replit Development Environment Variables, set `WFM_E2E_EMAIL` to that account's email. Do not use a production account. No password is stored: Clerk's official Playwright helper signs in through a Development-only testing ticket.

Ensure the API workflow is running, then run:

```sh
pnpm --filter @workspace/war-for-mars run test:e2e:auth
```

The command requires the existing Development `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`, checks that they are test keys without displaying them, and refuses to run if the local API is unavailable. Test output, screenshots, traces, and videos do not contain saved credentials; Playwright screenshots, traces, and videos are disabled.

After testing, remove the dedicated account from the WFM Development Clerk instance if it is no longer needed. Never copy test credentials into source code, `.env` files, chat, or a production environment.
