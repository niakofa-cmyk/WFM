import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defineConfig } from "@playwright/test";

const chromiumExecutable =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  process.env.CHROME_BIN ??
  (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);

const authEnabled = process.env.WFM_E2E_AUTH === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: authEnabled ? "authenticated.spec.ts" : "public.spec.ts",
  globalSetup: authEnabled ? "./e2e/global-setup.ts" : undefined,
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: join(tmpdir(), "wfm-playwright-results"),
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : {},
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "pnpm run dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      PORT: "4173",
      BASE_PATH: "/",
      VITE_API_BASE_URL: "http://127.0.0.1:8080",
    },
  },
});
