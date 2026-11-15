import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const PINNED_PNPM_VERSION = "10.26.1";
const PACKAGE_MANAGER = `pnpm@${PINNED_PNPM_VERSION}`;
const BOOTSTRAP_FILES = [
  ".github/workflows/quality.yml",
  "package.json",
  "scripts/verify-build-only-promotion.mjs",
  "scripts/verify-build-only-promotion.test.mjs",
];

function fail(message) {
  throw new Error(message);
}

function normalizePackageManagerMetadata(manifest) {
  const normalized = structuredClone(manifest);
  delete normalized.packageManager;

  if (normalized.engines) {
    delete normalized.engines.pnpm;
    if (Object.keys(normalized.engines).length === 0) {
      delete normalized.engines;
    }
  }

  return normalized;
}

function hasStagingEvidenceJob(workflow) {
  return /^\s{2}verify-staging-evidence:/m.test(workflow);
}

function verifyWorkflowRoutes(workflow) {
  if (!hasStagingEvidenceJob(workflow)) {
    fail("The quality workflow must define the Verify staging evidence job.");
  }
  if (!workflow.includes("needs: verify")) {
    fail("The evidence gate must wait for the complete workspace quality job.");
  }
  if (!workflow.includes("if: github.event_name == 'pull_request'")) {
    fail("The evidence gate must be limited to pull requests.");
  }
  if (!workflow.includes("github.event.pull_request.base.ref == 'main'")) {
    fail("The staging promotion gate must run only for pull requests targeting main.");
  }
  if (!workflow.includes("if: github.head_ref == 'staging'")) {
    fail("Staging-source pull requests must select the live evidence route.");
  }
  if (!workflow.includes("if: github.head_ref != 'staging'")) {
    fail("Only non-staging pull requests may select the build-only route.");
  }
  if (!workflow.includes("node scripts/verify-staging-promotion.mjs")) {
    fail("Staging-source pull requests must use the live staging evidence verifier.");
  }
  if (!workflow.includes("node scripts/verify-build-only-promotion.mjs")) {
    fail("Non-staging pull requests must use the build-only verifier.");
  }
  if (
    !workflow.includes(
      "node --test scripts/verify-build-only-promotion.test.mjs",
    )
  ) {
    fail("The build-only route must run its regression tests.");
  }
  if (!workflow.includes("version: 10.26.1")) {
    fail("The quality workflow must use pnpm 10.26.1.");
  }
  if (!workflow.includes("uses: pnpm/action-setup@v4")) {
    fail("The build-only route must install pnpm through the pinned setup action.");
  }
  if (!workflow.includes("pnpm install --frozen-lockfile")) {
    fail("The build-only route must verify a frozen dependency install.");
  }
}

export function verifyBuildOnlyChange({
  changedPaths,
  baseManifest,
  headManifest,
  baseWorkflow,
  headWorkflow,
}) {
  const normalizedPaths = [...new Set(changedPaths)].sort();
  const bootstrappingGate = !hasStagingEvidenceJob(baseWorkflow);
  const allowedPaths = new Set(
    bootstrappingGate ? BOOTSTRAP_FILES : ["package.json"],
  );
  const unexpectedPaths = normalizedPaths.filter((path) => !allowedPaths.has(path));

  if (unexpectedPaths.length > 0) {
    fail(
      `Non-staging pull requests may not include runtime or unrelated changes: ${unexpectedPaths.join(", ")}.`,
    );
  }
  if (!normalizedPaths.includes("package.json")) {
    fail("The only supported non-staging change is the root pnpm version pin.");
  }
  if (
    bootstrappingGate &&
    BOOTSTRAP_FILES.some((path) => !normalizedPaths.includes(path))
  ) {
    fail("The initial gate implementation must include its workflow and regression tests.");
  }
  if (bootstrappingGate) {
    const existingWorkflow = baseWorkflow.trimEnd();
    if (!headWorkflow.startsWith(`${existingWorkflow}\n`)) {
      fail("The initial gate may only append to the existing quality workflow.");
    }
  }
  if (
    !bootstrappingGate &&
    normalizedPaths.some((path) => BOOTSTRAP_FILES.slice(0, 1).includes(path))
  ) {
    fail("The staging gate workflow cannot be changed in a build-only pin pull request.");
  }

  if (
    JSON.stringify(normalizePackageManagerMetadata(baseManifest)) !==
    JSON.stringify(normalizePackageManagerMetadata(headManifest))
  ) {
    fail("The package.json change must be limited to packageManager and engines.pnpm.");
  }
  if (headManifest.packageManager !== PACKAGE_MANAGER) {
    fail(`packageManager must be ${PACKAGE_MANAGER}.`);
  }
  if (headManifest.engines?.pnpm !== PINNED_PNPM_VERSION) {
    fail(`engines.pnpm must be ${PINNED_PNPM_VERSION}.`);
  }

  verifyWorkflowRoutes(headWorkflow);

  return {
    bootstrappingGate,
    changedPaths: normalizedPaths,
    packageManager: PACKAGE_MANAGER,
    stagingCertificationClaimed: false,
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function requireSha(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/i.test(value)) {
    fail(`${label} must be a full 40-character commit SHA.`);
  }
  return value;
}

function readGitJson(sha, path) {
  return JSON.parse(git(["show", `${sha}:${path}`]));
}

function main() {
  const baseSha = requireSha(process.env.PR_BASE_SHA, "PR_BASE_SHA");
  const headSha = requireSha(process.env.PR_HEAD_SHA, "PR_HEAD_SHA");

  try {
    execFileSync("git", ["merge-base", "--is-ancestor", baseSha, headSha], {
      stdio: "ignore",
    });
  } catch {
    fail("The pull request must be up to date with its base branch.");
  }

  const changedPaths = git([
    "diff",
    "--name-only",
    "--no-renames",
    baseSha,
    headSha,
  ])
    .split("\n")
    .filter(Boolean);
  const baseManifest = readGitJson(baseSha, "package.json");
  const headManifest = readGitJson(headSha, "package.json");
  const baseWorkflow = git([
    "show",
    `${baseSha}:.github/workflows/quality.yml`,
  ]);
  const headWorkflow = git([
    "show",
    `${headSha}:.github/workflows/quality.yml`,
  ]);

  const result = verifyBuildOnlyChange({
    changedPaths,
    baseManifest,
    headManifest,
    baseWorkflow,
    headWorkflow,
  });

  console.log(
    `Verified build-only pnpm pin ${result.packageManager}; no live staging certification is claimed.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(`Build-only verification blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
