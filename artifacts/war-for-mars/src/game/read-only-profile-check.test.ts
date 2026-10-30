import assert from "node:assert/strict";
import test from "node:test";
import { defaultSave } from "./save";
import {
  createReadOnlyProfileCheckReport,
  displayedProfileMatchesServer,
  readHttpStatus,
} from "./read-only-profile-check";

const device = {
  environment: "Browser host; verify the environment separately",
  chromeVersion: "Chrome 123",
  screenCssPixels: "360x800 CSS px",
  viewportCssPixels: "360x740 CSS px",
  orientationAtStart: "portrait-primary",
  devicePixelRatio: 3,
};

const profile = {
  credits: 90,
  faction: "accord" as const,
  shipId: "mandjet" as const,
  scheme: "arc" as const,
  refit: 0,
  shieldMk2: false,
  hold: null,
  mission: "contact" as const,
  cleared: 0,
  tech: null,
};

test("compares only the signed-in profile fields visible in the current game save", () => {
  const save = defaultSave();
  assert.equal(displayedProfileMatchesServer(profile, save), true);
  assert.equal(displayedProfileMatchesServer({ ...profile, scheme: "strafe" }, save), false);
  assert.equal(displayedProfileMatchesServer({ ...profile, credits: 91 }, save), false);
});

test("extracts only a valid numeric HTTP status from an API error", () => {
  assert.equal(readHttpStatus({ status: 401, message: "do not include this detail" }), 401);
  assert.equal(readHttpStatus({ status: 99 }), null);
  assert.equal(readHttpStatus("HTTP 401 private error"), null);
  assert.equal(readHttpStatus(null), null);
});

test("creates a safe read-only report without account IDs, tokens, or balance values", () => {
  const report = createReadOnlyProfileCheckReport({
    capturedAt: "2026-10-28T12:00:00.000Z",
    pageOrigin: "https://wfm-app-staging-staging.up.railway.app/path?room=private-room",
    apiBaseUrl: "https://wfm-api-staging.up.railway.app/api?token=must-not-appear",
    device,
    signedIn: true,
    outcome: "success",
    httpStatus: null,
    responseTimeMs: 12.6,
    visibleProfileFieldsMatchServer: true,
  });
  const serialized = JSON.stringify(report);

  assert.equal(report.pageOrigin, "https://wfm-app-staging-staging.up.railway.app");
  assert.equal(report.apiOrigin, "https://wfm-api-staging.up.railway.app");
  assert.equal(report.authentication.profileRequest.status, "2xx");
  assert.equal(report.authentication.profileRequest.responseTimeMs, 13);
  assert.equal(report.sideEffects.writesSentByThisCheck, false);
  assert.equal(report.sideEffects.rewardClaimSentByThisCheck, false);
  assert.equal(report.sideEffects.rewardLedgerInspected, false);
  assert.doesNotMatch(serialized, /private-room|must-not-appear|user_[A-Za-z0-9]+|Bearer|token/i);
  assert.doesNotMatch(serialized, /"credits"\s*:/);
});

test("reports failed profile reads without copying raw error text", () => {
  const report = createReadOnlyProfileCheckReport({
    capturedAt: "2026-10-28T12:00:00.000Z",
    pageOrigin: "https://wfm-app-staging-staging.up.railway.app",
    apiBaseUrl: null,
    device,
    signedIn: true,
    outcome: "failure",
    httpStatus: 401,
    responseTimeMs: 8,
    visibleProfileFieldsMatchServer: null,
  });

  assert.equal(report.authentication.profileRequest.status, "HTTP 401");
  assert.equal(report.authentication.visibleProfileFieldsMatchServer, null);
  assert.equal(report.sideEffects.rewardClaimSentByThisCheck, false);
});
