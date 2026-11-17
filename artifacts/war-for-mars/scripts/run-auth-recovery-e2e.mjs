import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const localBin = fileURLToPath(new URL("../node_modules/.bin", import.meta.url));
const env = {
  ...process.env,
  PATH: [localBin, process.env.PATH].filter(Boolean).join(delimiter),
};

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}.`);
  }
}

const configuredBrowser = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  process.env.CHROME_BIN,
  "/repl/tools/bin/chromium",
].find((candidate) => candidate && existsSync(candidate));

if (!configuredBrowser) {
  if (process.platform !== "linux") {
    throw new Error("Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to run the auth recovery browser check.");
  }
  run("playwright", ["install", "--with-deps", "chromium"]);
}

run("playwright", [
  "test",
  "e2e/public.spec.ts",
  "--grep",
  "mobile sign-in retries the Clerk connection after its SDK stalls",
]);
