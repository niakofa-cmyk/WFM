import assert from "node:assert/strict";
import test from "node:test";
import { verifyBuildOnlyChange } from "./verify-build-only-promotion.mjs";

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
