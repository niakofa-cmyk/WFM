import assert from "node:assert/strict";
import test from "node:test";
import {
  verifyBuildOnlyChange,
  verifyAuthRecoveryHotfix,
  AUTH_RECOVERY_BASE_SHA,
  AUTH_RECOVERY_BLOBS,
  verifyAuthProfileHotfix,
  AUTH_PROFILE_BASE_SHA,
  AUTH_PROFILE_BRANCH,
  AUTH_PROFILE_BLOBS,
  verifyDocsAuditChange,
  DOCS_AUDIT_BASE_SHA,
  DOCS_AUDIT_BRANCH,
  verifyProductionSigninHotfix,
  PRODUCTION_SIGNIN_BASE_SHA,
  PRODUCTION_SIGNIN_BRANCH,
  PRODUCTION_SIGNIN_BLOBS,
} from "./verify-build-only-promotion.mjs";

const baseManifest = {
  name: "workspace",
  version: "0.0.0",
  license: "MIT",
  scripts: {
    build: "pnpm run typecheck && pnpm -r --if-present run build",
    test: "pnpm -r --workspace-concurrency=1 --if-present run test",
  },
  private: true,
  dependencies: { "@replit/connectors-sdk": "^0.4.3" },
};

const pinnedManifest = {
  ...baseManifest,
  packageManager: "pnpm@10.26.1",
  engines: { pnpm: "10.26.1" },
};

const baseWorkflow = `
name: Workspace quality
jobs:
  verify:
    name: Verify workspace
`;

const gatedWorkflow = `
name: Workspace quality
jobs:
  verify:
    name: Verify workspace
  verify-staging-evidence:
    name: Verify staging evidence
    needs: verify
    if: github.event_name == 'pull_request'
    steps:
      - if: github.head_ref == 'staging'
        run: node scripts/verify-staging-promotion.mjs
      - if: github.head_ref != 'staging'
        run: node scripts/verify-build-only-promotion.mjs
      - run: node --test scripts/verify-build-only-promotion.test.mjs
      - uses: pnpm/action-setup@v4
        with:
          version: 10.26.1
      - run: pnpm install --frozen-lockfile
`;

const bootstrapPaths = [
  ".github/workflows/quality.yml",
  "package.json",
  "scripts/verify-build-only-promotion.mjs",
  "scripts/verify-build-only-promotion.test.mjs",
];

function verify(overrides = {}) {
  return verifyBuildOnlyChange({
    changedPaths: bootstrapPaths,
    baseManifest,
    headManifest: pinnedManifest,
    baseWorkflow,
    headWorkflow: gatedWorkflow,
    ...overrides,
  });
}

test("accepts the pnpm pin with the initial, tested gate implementation", () => {
  const result = verify();
  assert.equal(result.packageManager, "pnpm@10.26.1");
  assert.equal(result.stagingCertificationClaimed, false);
  assert.equal(result.bootstrappingGate, true);
});

test("rejects application changes on a non-staging pull request", () => {
  assert.throws(
    () => verify({ changedPaths: [...bootstrapPaths, "artifacts/war-for-mars/src/main.tsx"] }),
    /runtime or unrelated changes/,
  );
});

test("rejects dependency, script, or other package manifest changes", () => {
  const changedManifest = {
    ...pinnedManifest,
    dependencies: { ...pinnedManifest.dependencies, anotherPackage: "1.0.0" },
  };
  assert.throws(
    () => verify({ headManifest: changedManifest }),
    /limited to packageManager and engines\.pnpm/,
  );
});

test("rejects lockfile changes", () => {
  assert.throws(
    () => verify({ changedPaths: [...bootstrapPaths, "pnpm-lock.yaml"] }),
    /runtime or unrelated changes/,
  );
});

test("rejects mismatched package manager fields", () => {
  assert.throws(
    () =>
      verify({
        headManifest: {
          ...pinnedManifest,
          engines: { pnpm: "9.15.5" },
        },
      }),
    /engines\.pnpm must be 10\.26\.1/,
  );
});

test("rejects the build-only route if the live staging route is removed", () => {
  assert.throws(
    () => verify({ headWorkflow: gatedWorkflow.replace("node scripts/verify-staging-promotion.mjs", "echo pass") }),
    /live staging evidence verifier/,
  );
});

test("rejects bootstrap changes to the existing workspace-quality job", () => {
  assert.throws(
    () =>
      verify({
        headWorkflow: gatedWorkflow.replace(
          "name: Verify workspace",
          "name: Skipped workspace",
        ),
      }),
    /only append to the existing quality workflow/,
  );
});

test("after bootstrap, only the root pnpm pin is allowed", () => {
  assert.doesNotThrow(() =>
    verify({
      changedPaths: ["package.json"],
      baseWorkflow: gatedWorkflow,
    }),
  );
  assert.throws(
    () =>
      verify({
        changedPaths: ["package.json", ".github/workflows/quality.yml"],
        baseWorkflow: gatedWorkflow,
      }),
    /runtime or unrelated changes/,
  );
});

const docsAuditPaths = [
  "docs/audits/WFM-visual-audit-actionable-checklist.md",
  "scripts/verify-build-only-promotion.mjs",
  "scripts/verify-build-only-promotion.test.mjs",
];

function verifyDocsAudit(overrides = {}) {
  return verifyDocsAuditChange({
    baseSha: DOCS_AUDIT_BASE_SHA,
    headRef: DOCS_AUDIT_BRANCH,
    changedPaths: docsAuditPaths,
    baseManifest: pinnedManifest,
    headManifest: pinnedManifest,
    baseWorkflow: gatedWorkflow,
    headWorkflow: gatedWorkflow,
    ...overrides,
  });
}

test("accepts only the exact visual-audit documentation exception", () => {
  const result = verifyDocsAudit();
  assert.equal(result.kind, "docs-only-audit-checklist");
  assert.equal(result.stagingCertificationClaimed, false);
});

test("the visual-audit exception is limited to its approved base and branch", () => {
  assert.throws(
    () => verifyDocsAudit({ baseSha: "a".repeat(40) }),
    /approved main base/,
  );
  assert.throws(
    () => verifyDocsAudit({ headRef: "another-docs-branch" }),
    /approved branch/,
  );
});

test("the visual-audit exception rejects runtime, lockfile, and extra documentation changes", () => {
  for (const extraPath of [
    "artifacts/war-for-mars/src/App.tsx",
    "pnpm-lock.yaml",
    "docs/another-file.md",
  ]) {
    assert.throws(
      () => verifyDocsAudit({ changedPaths: [...docsAuditPaths, extraPath] }),
      /only its checklist and scoped gate regression tests/,
    );
  }
});

test("the visual-audit exception rejects manifest or release-workflow changes", () => {
  assert.throws(
    () =>
      verifyDocsAudit({
        headManifest: { ...pinnedManifest, scripts: {} },
      }),
    /must not alter the package manifest/,
  );
  assert.throws(
    () => verifyDocsAudit({ headWorkflow: `${gatedWorkflow}\n# changed` }),
    /must not alter the release workflow/,
  );
});

const productionSigninPaths = [
  ...Object.keys(PRODUCTION_SIGNIN_BLOBS),
  "scripts/verify-build-only-promotion.mjs",
  "scripts/verify-build-only-promotion.test.mjs",
];

function verifyProductionSignin(overrides = {}) {
  return verifyProductionSigninHotfix({
    baseSha: PRODUCTION_SIGNIN_BASE_SHA,
    headRef: PRODUCTION_SIGNIN_BRANCH,
    changedPaths: productionSigninPaths,
    baseManifest: pinnedManifest,
    headManifest: pinnedManifest,
    baseWorkflow: gatedWorkflow,
    headWorkflow: gatedWorkflow,
    headBlobs: { ...PRODUCTION_SIGNIN_BLOBS },
    ...overrides,
  });
}

test("accepts only the exact owner-prepared production sign-in patch", () => {
  const result = verifyProductionSignin();
  assert.equal(result.kind, "production-signin-return-hotfix");
  assert.equal(result.stagingCertificationClaimed, false);
  assert.equal(result.productionDeploymentAuthorized, false);
});

test("the production sign-in exception is limited to its approved base and branch", () => {
  assert.throws(
    () => verifyProductionSignin({ baseSha: "a".repeat(40) }),
    /approved main base/,
  );
  assert.throws(
    () => verifyProductionSignin({ headRef: "another-signin-branch" }),
    /approved branch/,
  );
});

test("the production sign-in exception rejects extra runtime, lockfile, or documentation changes", () => {
  for (const extraPath of [
    "artifacts/war-for-mars/src/game/WarApp.tsx",
    "pnpm-lock.yaml",
    "docs/another-file.md",
  ]) {
    assert.throws(
      () =>
        verifyProductionSignin({
          changedPaths: [...productionSigninPaths, extraPath],
        }),
      /only its reviewed files and gate regression tests/,
    );
  }
});

test("the production sign-in exception pins every reviewed source blob", () => {
  for (const path of Object.keys(PRODUCTION_SIGNIN_BLOBS)) {
    assert.throws(
      () =>
        verifyProductionSignin({
          headBlobs: {
            ...PRODUCTION_SIGNIN_BLOBS,
            [path]: "a".repeat(40),
          },
        }),
      /differs from its reviewed content/,
    );
  }
});

test("the production sign-in exception rejects workspace manifest or release-workflow changes", () => {
  assert.throws(
    () =>
      verifyProductionSignin({
        headManifest: { ...pinnedManifest, scripts: {} },
      }),
    /must not change the workspace package manifest/,
  );
  assert.throws(
    () => verifyProductionSignin({ headWorkflow: `${gatedWorkflow}\n# changed` }),
    /must not change the release workflow/,
  );
});

const recoveryPaths = [
  ...Object.keys(AUTH_RECOVERY_BLOBS),
  "scripts/verify-build-only-promotion.mjs",
  "scripts/verify-build-only-promotion.test.mjs",
];

function verifyRecovery(overrides = {}) {
  return verifyAuthRecoveryHotfix({
    baseSha: AUTH_RECOVERY_BASE_SHA,
    headRef: "fix/auth-loading-recovery",
    changedPaths: recoveryPaths,
    baseManifest: pinnedManifest,
    headManifest: pinnedManifest,
    baseWorkflow: gatedWorkflow,
    headWorkflow: gatedWorkflow,
    headBlobs: { ...AUTH_RECOVERY_BLOBS },
    ...overrides,
  });
}

test("accepts only the exact approved recovery patch without claiming staging certification", () => {
  const result = verifyRecovery();
  assert.equal(result.kind, "auth-initialization-hotfix");
  assert.equal(result.stagingCertificationClaimed, false);
});

test("the recovery exception expires after the production base changes", () => {
  assert.throws(() => verifyRecovery({ baseSha: "a".repeat(40) }), /approved production base/);
});

test("the recovery exception cannot be used by staging or another branch", () => {
  for (const headRef of [undefined, "", "staging", "unrelated-change"]) {
    assert.throws(() => verifyRecovery({ headRef }), /approved hotfix branch/);
  }
});

test("rejects modified or missing approved source blobs, including auth and test changes", () => {
  for (const path of Object.keys(AUTH_RECOVERY_BLOBS)) {
    const changed = { ...AUTH_RECOVERY_BLOBS, [path]: "a".repeat(40) };
    assert.throws(() => verifyRecovery({ headBlobs: changed }), /differs from the approved patch/);
    delete changed[path];
    assert.throws(() => verifyRecovery({ headBlobs: changed }), /differs from the approved patch/);
  }
});

test("rejects unrelated runtime, backend, lockfile, manifest, evidence and workflow changes", () => {
  for (const path of [
    "artifacts/war-for-mars/src/game/WarApp.tsx",
    "artifacts/api-server/src/middlewares/playerAuth.ts",
    "pnpm-lock.yaml",
    "package.json",
    "STAGING-TEST-RESULTS.json",
    ".github/workflows/quality.yml",
  ]) {
    assert.throws(
      () => verifyRecovery({ changedPaths: [...recoveryPaths, path] }),
      /exactly the approved recovery and policy files/,
    );
  }
});

test("requires every approved recovery and policy file", () => {
  for (const path of recoveryPaths) {
    assert.throws(
      () => verifyRecovery({ changedPaths: recoveryPaths.filter((item) => item !== path) }),
      /exactly the approved recovery and policy files/,
    );
  }
});

test("rejects workflow and package drift even if the caller omits their changed paths", () => {
  assert.throws(
    () => verifyRecovery({ headWorkflow: `${gatedWorkflow}\n# changed` }),
    /must not change the release workflow/,
  );
  assert.throws(
    () => verifyRecovery({ headManifest: { ...pinnedManifest, scripts: {} } }),
    /must not change the package manifest/,
  );
});

test("the exception retains the existing live-staging route and workspace dependency", () => {
  for (const fragment of [
    "needs: verify",
    "node scripts/verify-staging-promotion.mjs",
    "node --test scripts/verify-build-only-promotion.test.mjs",
    "pnpm install --frozen-lockfile",
  ]) {
    const workflow = gatedWorkflow.replace(fragment, "disabled");
    assert.throws(() => verifyRecovery({ baseWorkflow: workflow, headWorkflow: workflow }));
  }
});

const profilePaths = [
  ...Object.keys(AUTH_PROFILE_BLOBS),
  "scripts/verify-build-only-promotion.mjs",
  "scripts/verify-build-only-promotion.test.mjs",
];

function verifyProfile(overrides = {}) {
  return verifyAuthProfileHotfix({
    baseSha: AUTH_PROFILE_BASE_SHA,
    headRef: AUTH_PROFILE_BRANCH,
    changedPaths: profilePaths,
    baseManifest: pinnedManifest,
    headManifest: pinnedManifest,
    baseWorkflow: gatedWorkflow,
    headWorkflow: gatedWorkflow,
    headBlobs: { ...AUTH_PROFILE_BLOBS },
    ...overrides,
  });
}

test("accepts the exact profile repair without certifying live staging or production", () => {
  const result = verifyProfile();
  assert.equal(result.kind, "profile-auth-hotfix");
  assert.equal(result.stagingCertificationClaimed, false);
});

test("profile exception expires when production advances and rejects other source branches", () => {
  assert.throws(() => verifyProfile({ baseSha: "a".repeat(40) }), /approved production base/);
  for (const headRef of [undefined, "", "staging", "fix/auth-loading-recovery", "another-hotfix"]) {
    assert.throws(() => verifyProfile({ headRef }), /approved hotfix branch/);
  }
});

test("profile exception rejects altered or missing runtime and regression-test blobs", () => {
  for (const path of Object.keys(AUTH_PROFILE_BLOBS)) {
    const headBlobs = { ...AUTH_PROFILE_BLOBS, [path]: "a".repeat(40) };
    assert.throws(() => verifyProfile({ headBlobs }), /differs from the approved patch/);
    delete headBlobs[path];
    assert.throws(() => verifyProfile({ headBlobs }), /differs from the approved patch/);
  }
});

test("profile exception rejects missing required files and unrelated changes", () => {
  for (const path of profilePaths) {
    assert.throws(
      () => verifyProfile({ changedPaths: profilePaths.filter((entry) => entry !== path) }),
      /exactly the approved source, tests and policy files/,
    );
  }
  for (const path of [
    "artifacts/api-server/src/middlewares/playerAuth.ts",
    "pnpm-lock.yaml",
    "package.json",
    "STAGING-TEST-RESULTS.json",
    ".github/workflows/quality.yml",
  ]) {
    assert.throws(
      () => verifyProfile({ changedPaths: [...profilePaths, path] }),
      /exactly the approved source, tests and policy files/,
    );
  }
});

test("profile exception rejects unreported workflow and package changes", () => {
  assert.throws(
    () => verifyProfile({ headWorkflow: `${gatedWorkflow}\n# changed` }),
    /must not change the release workflow/,
  );
  assert.throws(
    () => verifyProfile({ headManifest: { ...pinnedManifest, scripts: {} } }),
    /must not change the package manifest/,
  );
});

test("profile exception preserves workspace, live staging, test and frozen-install gates", () => {
  for (const fragment of [
    "needs: verify",
    "node scripts/verify-staging-promotion.mjs",
    "node --test scripts/verify-build-only-promotion.test.mjs",
    "pnpm install --frozen-lockfile",
  ]) {
    const workflow = gatedWorkflow.replace(fragment, "disabled");
    assert.throws(() => verifyProfile({ baseWorkflow: workflow, headWorkflow: workflow }));
  }
});
