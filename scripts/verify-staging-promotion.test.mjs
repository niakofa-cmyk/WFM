import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const promotionScript = path.join(sourceDirectory, "verify-staging-promotion.mjs");
const policyModule = path.join(sourceDirectory, "staging-promotion-policy.mjs");
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

function validResults() {
  return {
    overallStatus: "PASS",
    productionReadiness: "NOT_CLAIMED",
    testedSourceCommit: "pending-base-commit",
    environment: {
      separateRepl: true,
      separateStagingDatabase: true,
      stagingOnlyAuthentication: true,
      productionDataUntouched: true,
    },
    tests: Object.fromEntries(requiredTests.map((key) => [key, "PASS"])),
    evidenceFiles: ["STAGING-TEST-REPORT.md"],
  };
}

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
    },
  }).trim();
}

function commitAll(root, message) {
  git(root, "add", "-A");
  git(root, "commit", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

function createFixtureRepo(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "wfm-staging-promotion-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  mkdirSync(path.join(root, "scripts"));
  copyFileSync(promotionScript, path.join(root, "scripts/verify-staging-promotion.mjs"));
  copyFileSync(policyModule, path.join(root, "scripts/staging-promotion-policy.mjs"));
  writeFileSync(path.join(root, "STAGING-TEST-REPORT.md"), "Synthetic release evidence.\n");
  writeFileSync(path.join(root, "STAGING-TEST-RESULTS.json"), JSON.stringify(validResults(), null, 2));

  git(root, "init", "--quiet", "--initial-branch=staging");
  git(root, "config", "user.name", "WFM Gate Test");
  git(root, "config", "user.email", "wfm-gate-test@example.invalid");
  const baseSha = commitAll(root, "synthetic tested source");

  const resultsPath = path.join(root, "STAGING-TEST-RESULTS.json");
  const results = JSON.parse(readFileSync(resultsPath, "utf8"));
  results.testedSourceCommit = baseSha;
  writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`);
  const headSha = commitAll(root, "synthetic evidence-only update");

  return { root, resultsPath, baseSha, headSha };
}

function readResults(repo) {
  return JSON.parse(readFileSync(repo.resultsPath, "utf8"));
}

function writeResults(repo, results) {
  writeFileSync(repo.resultsPath, `${JSON.stringify(results, null, 2)}\n`);
}

function runVerifier(repo, { ref = "staging", headSha = repo.headSha } = {}) {
  const result = spawnSync(
    process.execPath,
    [path.join(repo.root, "scripts/verify-staging-promotion.mjs")],
    {
      cwd: repo.root,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: repo.root,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        PR_HEAD_REF: ref,
        PR_HEAD_SHA: headSha,
      },
    },
  );
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

test("accepts complete synthetic evidence and an evidence-only report update", (t) => {
  const repo = createFixtureRepo(t);

  const initial = runVerifier(repo);
  assert.equal(initial.status, 0, initial.output);
  assert.match(initial.output, /Staging evidence is complete/);

  const results = readResults(repo);
  results.evidenceFiles.push("docs/staging-network-impairment-evidence.json");
  writeResults(repo, results);
  writeFileSync(
    path.join(repo.root, "STAGING-TEST-REPORT.md"),
    "Updated synthetic evidence report.\n",
  );
  const networkEvidencePath = path.join(
    repo.root,
    "docs/staging-network-impairment-evidence.json",
  );
  mkdirSync(path.dirname(networkEvidencePath), { recursive: true });
  writeFileSync(networkEvidencePath, "{}\n");
  repo.headSha = commitAll(repo.root, "synthetic report update");
  const updated = runVerifier(repo);
  assert.equal(updated.status, 0, updated.output);
});

test("rejects a pull request that does not come from staging", (t) => {
  const repo = createFixtureRepo(t);
  const result = runVerifier(repo, { ref: "feature/gameplay" });
  assert.equal(result.status, 1);
  assert.match(result.output, /must come directly from the staging branch/);
});

test("requires PASS overall evidence and never claims Production readiness", (t) => {
  const repo = createFixtureRepo(t);
  const results = readResults(repo);
  results.overallStatus = "PENDING";
  results.productionReadiness = "READY";
  writeResults(repo, results);

  const result = runVerifier(repo);
  assert.equal(result.status, 1);
  assert.match(result.output, /overallStatus must be PASS/);
  assert.match(result.output, /production readiness/);
});

test("rejects every required release test unless it is PASS", (t) => {
  const repo = createFixtureRepo(t);
  const results = readResults(repo);
  for (const key of requiredTests) results.tests[key] = "PARTIAL";
  writeResults(repo, results);

  const result = runVerifier(repo);
  assert.equal(result.status, 1);
  for (const key of requiredTests) {
    assert.match(result.output, new RegExp(`tests\\.${key} must be PASS`));
  }
});

test("requires the staging environment assertions to be literal true", (t) => {
  const repo = createFixtureRepo(t);
  const results = readResults(repo);
  results.environment.separateStagingDatabase = "true";
  writeResults(repo, results);

  const result = runVerifier(repo);
  assert.equal(result.status, 1);
  assert.match(result.output, /environment\.separateStagingDatabase must be confirmed true/);
});

test("rejects invalid pull-request and tested-source SHAs", (t) => {
  const repo = createFixtureRepo(t);
  const invalidHead = runVerifier(repo, { headSha: "not-a-commit" });
  assert.equal(invalidHead.status, 1);
  assert.match(invalidHead.output, /Pull request head SHA is unavailable/);

  const results = readResults(repo);
  results.testedSourceCommit = "not-a-sha";
  writeResults(repo, results);
  const invalidTestedSha = runVerifier(repo);
  assert.equal(invalidTestedSha.status, 1);
  assert.match(invalidTestedSha.output, /testedSourceCommit must be a full 40-character commit SHA/);
});

test("requires the tested source to be an ancestor of the pull-request head", (t) => {
  const repo = createFixtureRepo(t);
  const results = readResults(repo);
  results.testedSourceCommit = "0".repeat(40);
  writeResults(repo, results);

  const result = runVerifier(repo);
  assert.equal(result.status, 1);
  assert.match(result.output, /testedSourceCommit must be an ancestor/);
});

test("rejects application files changed after the tested source", (t) => {
  const repo = createFixtureRepo(t);
  const sourceFile = path.join(repo.root, "artifacts/war-for-mars/src/unreviewed.ts");
  mkdirSync(path.dirname(sourceFile), { recursive: true });
  writeFileSync(sourceFile, "export const unreviewed = true;\n");
  repo.headSha = commitAll(repo.root, "synthetic application change");

  const result = runVerifier(repo);
  assert.equal(result.status, 1);
  assert.match(result.output, /Application changes were made after staging verification/);
  assert.match(result.output, /artifacts\/war-for-mars\/src\/unreviewed\.ts/);
});

test("requires a safe existing report path in the evidence list", (t) => {
  const repo = createFixtureRepo(t);
  const results = readResults(repo);
  results.evidenceFiles = ["other-evidence.md"];
  writeResults(repo, results);
  const missingRequired = runVerifier(repo);
  assert.equal(missingRequired.status, 1);
  assert.match(missingRequired.output, /evidenceFiles must include STAGING-TEST-REPORT\.md/);

  results.evidenceFiles = ["STAGING-TEST-REPORT.md", "../outside.md"];
  writeResults(repo, results);

  const unsafe = runVerifier(repo);
  assert.equal(unsafe.status, 1);
  assert.match(unsafe.output, /Evidence path is not a safe repository-relative path/);

  results.evidenceFiles = ["STAGING-TEST-REPORT.md", "missing-evidence.json"];
  writeResults(repo, results);
  const missing = runVerifier(repo);
  assert.equal(missing.status, 1);
  assert.match(missing.output, /Evidence file does not exist/);
});
