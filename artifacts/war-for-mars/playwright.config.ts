import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const basePath = process.env.BASE_PATH || "/kids/wfm/";
const normalizedBasePath = `/${basePath.split("/").filter(Boolean).join("/")}/`;
const chromiumExecutable = existsSync("/repl/tools/bin/chromium")
  ? "/repl/tools/bin/chromium"
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "mounted-route.spec.ts",
  outputDir: "../../generated-artifacts/orbital-signin-main-port-playwright",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    launchOptions: chromiumExecutable
      ? { executablePath: chromiumExecutable }
      : undefined,
  },
  webServer: {
    command: "pnpm run dev",
    url: `http://127.0.0.1:4173${normalizedBasePath}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: "4173",
      BASE_PATH: normalizedBasePath,
    },
  },
});
