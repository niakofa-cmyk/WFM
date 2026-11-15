import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { requiredEnvironmentFailures } from "./staging-promotion-policy.mjs";

const root = process.cwd();
const resultsPath = resolve(root, "STAGING-TEST-RESULTS.json");
const requiredTests = [
  "signupAndSignin",
  "profilePersistsAcrossSessions",
  "profileSyncsAcrossDevices",
  "accountProgressInventoryAndHistoryAreIsolated",
  "sharedEconomyUsesStagingData",
  "serverOwnedRewardsAndDuplicateClaims",
  "restartEndsMatchAndNotifiesPlayers",
  "interruptedMatchCannotClaimRewards",
  "freshRoomRequiredAfterRestart",
  "ordinaryDisconnectReconnect",
  "roomInviteReadyAndTeamAssignment",
  "tenClientMatchCompletion",
  "networkImpairmentHarness",
];
const allowedPostTestFiles = new Set([
  "STAGING-TEST-RESULTS.json",
  "STAGING-TEST-REPORT.md",
  "docs/staging-network-impairment-evidence.json",
]);
const failures = [];

function validSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

if (!existsSync(resultsPath)) {
  console.error("Staging results file is missing.");
  process.exit(1);
}

let results;
try {
  results = JSON.parse(readFileSync(resultsPath, "utf8"));
} catch (error) {
  console.error(`Staging results JSON is invalid: ${error.message}`);
  process.exit(1);
}
if (results === null || typeof results !== "object" || Array.isArray(results)) {
  console.error("Staging results JSON must contain an object.");
  process.exit(1);
}

if (process.env.PR_HEAD_REF !== "staging") {
  failures.push("Promotion pull requests must come directly from the staging branch.");
}
if (results.overallStatus !== "PASS") failures.push("overallStatus must be PASS.");
if (results.productionReadiness !== "NOT_CLAIMED") {
  failures.push("Staging results must not claim production readiness.");
}
failures.push(...requiredEnvironmentFailures(results.environment ?? {}));
for (const key of requiredTests) {
  if (results.tests?.[key] !== "PASS") failures.push(`tests.${key} must be PASS.`);
}

const evidenceFiles = results.evidenceFiles;
if (!Array.isArray(evidenceFiles) || !evidenceFiles.includes("STAGING-TEST-REPORT.md")) {
  failures.push("evidenceFiles must include STAGING-TEST-REPORT.md.");
} else {
  for (const file of evidenceFiles) {
    if (typeof file !== "string" || file.startsWith("/") || file.split(/[\\/]/).includes("..")) {
      failures.push(`Evidence path is not a safe repository-relative path: ${String(file)}.`);
    } else if (!existsSync(resolve(root, file))) {
      failures.push(`Evidence file does not exist: ${file}.`);
    }
  }
}

const testedSha = results.testedSourceCommit;
const prHeadSha = process.env.PR_HEAD_SHA;
if (!validSha(testedSha)) {
  failures.push("testedSourceCommit must be a full 40-character commit SHA.");
} else if (!validSha(prHeadSha)) {
  failures.push("Pull request head SHA is unavailable.");
} else {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", testedSha, prHeadSha], {
      cwd: root,
      stdio: "ignore",
    });
    const changedAfterTest = git(["diff", "--name-only", `${testedSha}..${prHeadSha}`])
      .split("\n")
      .filter(Boolean)
      .filter((file) => !allowedPostTestFiles.has(file));
    if (changedAfterTest.length > 0) {
      failures.push(`Application changes were made after staging verification: ${changedAfterTest.join(", ")}.`);
    }
  } catch {
    failures.push("testedSourceCommit must be an ancestor of the promotion pull request.");
  }
}

if (failures.length > 0) {
  console.error("Staging promotion blocked:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Staging evidence is complete for the tested source commit.");
