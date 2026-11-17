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

// One-time exception for the reviewed PR 8 visual-audit checklist. It is
// restricted to this exact main base, branch, checklist, and policy tests.
export const DOCS_AUDIT_BASE_SHA = "05e17d8040856336904178e115425d6e56e2d9f4";
export const DOCS_AUDIT_BRANCH = "docs/wfm-visual-audit-actionable-checklist";
const DOCS_AUDIT_FILES = [
  "docs/audits/WFM-visual-audit-actionable-checklist.md",
  "scripts/verify-build-only-promotion.mjs",
  "scripts/verify-build-only-promotion.test.mjs",
];

// Owner-approved, one-time production recovery patch. Pin the actual Git blobs,
// not just filenames: this must not become a general runtime-change bypass.
// Once main advances past this base, this exception can no longer be used.
export const AUTH_RECOVERY_BASE_SHA = "3ecff671fdadaa041599d3c3b475b83bc810ec36";
export const AUTH_RECOVERY_BLOBS = Object.freeze({
  "artifacts/war-for-mars/src/App.tsx": "f6e4906e2c4a097438bafad5ad7dfc151e92c147",
  "artifacts/war-for-mars/src/components/auth-initialization.tsx": "cfb900759aaef293f687a021ba8bbb7e3b4ce219",
  "artifacts/war-for-mars/src/game/auth-initialization.test.ts": "c0cbd16d85ac96d96efb41ab5735bb45d3c2ffc5",
});
const AUTH_RECOVERY_POLICY_FILES = [
  "scripts/verify-build-only-promotion.mjs",
  "scripts/verify-build-only-promotion.test.mjs",
];

// A separate owner-approved exception for the reviewed production profile
// repair. It expires when main changes and does not certify live staging.
export const AUTH_PROFILE_BASE_SHA = "1c161837a4ae790e7df9b5369de81b5f7cb57975";
export const AUTH_PROFILE_BRANCH = "fix/production-profile-bearer-session";
export const AUTH_PROFILE_BLOBS = Object.freeze({
  "artifacts/war-for-mars/src/App.tsx": "6f996e0f1acb366b800f8e572b61fe60f6e7d8e4",
  "artifacts/war-for-mars/src/game/GameApiSession.tsx": "37482918cc37f536df9651bbbdf51f19bfeb94f0",
  "artifacts/war-for-mars/src/game/api-auth-session.ts": "2ce20d3664261391311ab39e2d184b6a667207e8",
  "artifacts/war-for-mars/src/game/api-auth-session.test.ts": "d6cb0132f0cb40e55cd8c92ff1fb6a61ccf5e2ec",
  "artifacts/war-for-mars/src/game/pilot-session-storage.ts": "80147faf5366e5e926c76628eee82d1b2db674d2",
  "artifacts/war-for-mars/src/game/pilot-session-storage.test.ts": "6b8d135dc74108bcbff129ad755ed26a9fa87a82",
  "artifacts/war-for-mars/src/game/WarApp.tsx": "57b24315751ad9d5880c3ae849fe066eeb2a5094",
});

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

export function verifyDocsAuditChange({
  baseSha,
  headRef,
  changedPaths,
  baseManifest,
  headManifest,
  baseWorkflow,
  headWorkflow,
}) {
  if (baseSha !== DOCS_AUDIT_BASE_SHA) {
    fail("The visual-audit checklist exception is restricted to its approved main base.");
  }
  if (headRef !== DOCS_AUDIT_BRANCH) {
    fail("The visual-audit checklist exception is restricted to its approved branch.");
  }

  const actual = [...new Set(changedPaths)].sort();
  const required = [...DOCS_AUDIT_FILES].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    fail("The visual-audit exception permits only its checklist and scoped gate regression tests.");
  }
  if (JSON.stringify(baseManifest) !== JSON.stringify(headManifest)) {
    fail("The visual-audit checklist change must not alter the package manifest.");
  }
  if (baseWorkflow !== headWorkflow) {
    fail("The visual-audit checklist change must not alter the release workflow.");
  }

  verifyWorkflowRoutes(baseWorkflow);
  return {
    kind: "docs-only-audit-checklist",
    changedPaths: actual,
    stagingCertificationClaimed: false,
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function verifyAuthRecoveryHotfix({
  baseSha,
  headRef,
  changedPaths,
  baseManifest,
  headManifest,
  baseWorkflow,
  headWorkflow,
  headBlobs,
}) {
  if (baseSha !== AUTH_RECOVERY_BASE_SHA) {
    fail("The auth recovery exception is restricted to its approved production base.");
  }
  if (headRef !== "fix/auth-loading-recovery") {
    fail("The auth recovery exception is restricted to its approved hotfix branch.");
  }
  const requiredPaths = [
    ...Object.keys(AUTH_RECOVERY_BLOBS),
    ...AUTH_RECOVERY_POLICY_FILES,
  ];
  const actual = [...new Set(changedPaths)].sort();
  if (JSON.stringify(actual) !== JSON.stringify(requiredPaths.sort())) {
    fail("The auth recovery hotfix must contain exactly the approved recovery and policy files.");
  }
  for (const [path, expected] of Object.entries(AUTH_RECOVERY_BLOBS)) {
    if (headBlobs?.[path] !== expected) {
      fail(`The auth recovery hotfix content differs from the approved patch: ${path}.`);
    }
  }
  if (JSON.stringify(baseManifest) !== JSON.stringify(headManifest)) {
    fail("The auth recovery hotfix must not change the package manifest.");
  }
  if (baseWorkflow !== headWorkflow) {
    fail("The auth recovery hotfix must not change the release workflow.");
  }
  verifyWorkflowRoutes(headWorkflow);
  return {
    kind: "auth-initialization-hotfix",
    changedPaths: actual,
    stagingCertificationClaimed: false,
  };
}

export function verifyAuthProfileHotfix({
  baseSha,
  headRef,
  changedPaths,
  baseManifest,
  headManifest,
  baseWorkflow,
  headWorkflow,
  headBlobs,
}) {
  if (baseSha !== AUTH_PROFILE_BASE_SHA) {
    fail("The profile auth exception is restricted to its approved production base.");
  }
  if (headRef !== AUTH_PROFILE_BRANCH) {
    fail("The profile auth exception is restricted to its approved hotfix branch.");
  }
  const requiredPaths = [...Object.keys(AUTH_PROFILE_BLOBS), ...AUTH_RECOVERY_POLICY_FILES].sort();
  const actual = [...new Set(changedPaths)].sort();
  if (JSON.stringify(actual) !== JSON.stringify(requiredPaths)) {
    fail("The profile auth hotfix must contain exactly the approved source, tests and policy files.");
  }
  for (const [path, expected] of Object.entries(AUTH_PROFILE_BLOBS)) {
    if (headBlobs?.[path] !== expected) {
      fail(`The profile auth hotfix content differs from the approved patch: ${path}.`);
    }
  }
  if (JSON.stringify(baseManifest) !== JSON.stringify(headManifest)) {
    fail("The profile auth hotfix must not change the package manifest.");
  }
  if (baseWorkflow !== headWorkflow) {
    fail("The profile auth hotfix must not change the release workflow.");
  }
  verifyWorkflowRoutes(headWorkflow);
  return {
    kind: "profile-auth-hotfix",
    changedPaths: actual,
    stagingCertificationClaimed: false,
  };
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

  const inputs = {
    changedPaths,
    baseManifest,
    headManifest,
    baseWorkflow,
    headWorkflow,
  };
  if (process.env.GITHUB_HEAD_REF === DOCS_AUDIT_BRANCH) {
    verifyDocsAuditChange({
      ...inputs,
      baseSha,
      headRef: process.env.GITHUB_HEAD_REF,
    });
    console.log(
      "Verified the exact visual-audit documentation exception; full workspace validation and frozen install remain required. No runtime changes or live staging certification are permitted.",
    );
    return;
  }
  if (process.env.GITHUB_HEAD_REF === AUTH_PROFILE_BRANCH) {
    verifyAuthProfileHotfix({
      ...inputs,
      baseSha,
      headRef: process.env.GITHUB_HEAD_REF,
      headBlobs: Object.fromEntries(
        Object.keys(AUTH_PROFILE_BLOBS).map((path) => [
          path,
          git(["rev-parse", `${headSha}:${path}`]),
        ]),
      ),
    });
    console.log(
      "Verified the exact owner-approved production profile auth hotfix; full workspace validation and frozen install remain required. Live staging acceptance and production verification are NOT certified by this exception.",
    );
    return;
  }
  const authRecoveryRequested = changedPaths.some((path) =>
    Object.hasOwn(AUTH_RECOVERY_BLOBS, path),
  );
  if (authRecoveryRequested) {
    verifyAuthRecoveryHotfix({
      ...inputs,
      baseSha,
      headRef: process.env.GITHUB_HEAD_REF,
      headBlobs: Object.fromEntries(
        Object.keys(AUTH_RECOVERY_BLOBS).map((path) => [
          path,
          git(["rev-parse", `${headSha}:${path}`]),
        ]),
      ),
    });
    console.log(
      "Verified the exact owner-approved auth-loading recovery hotfix; full workspace validation and frozen install remain required. No live staging certification is claimed.",
    );
    return;
  }

  const result = verifyBuildOnlyChange(inputs);

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
