import type { GameProfile } from "@workspace/api-client-react";
import type { LocalPerformanceDeviceInfo } from "./local-performance";
import type { Save } from "./save";

type ComparableProfile = Pick<
  GameProfile,
  | "credits"
  | "faction"
  | "shipId"
  | "scheme"
  | "refit"
  | "shieldMk2"
  | "hold"
  | "mission"
  | "cleared"
  | "tech"
>;

type SafeDeviceInfo = Pick<
  LocalPerformanceDeviceInfo,
  "chromeVersion" | "screenCssPixels" | "viewportCssPixels" | "orientationAtStart" | "devicePixelRatio"
>;

export type ReadOnlyProfileCheckInput = {
  capturedAt: string;
  pageOrigin: string;
  apiBaseUrl: string | null;
  device: SafeDeviceInfo;
  signedIn: boolean;
  outcome: "success" | "failure";
  httpStatus: number | null;
  responseTimeMs: number;
  visibleProfileFieldsMatchServer: boolean | null;
};

export type ReadOnlyProfileCheckReport = {
  title: string;
  capturedAt: string;
  pageOrigin: string;
  apiOrigin: string;
  device: SafeDeviceInfo;
  authentication: {
    signedInAtCheck: boolean;
    profileRequest: {
      method: "GET";
      path: "/api/game/profile";
      outcome: "success" | "failure";
      status: string;
      responseTimeMs: number;
    };
    visibleProfileFieldsMatchServer: boolean | null;
  };
  sideEffects: {
    writesSentByThisCheck: false;
    rewardClaimSentByThisCheck: false;
    rewardLedgerInspected: false;
  };
  limits: string;
};

export function displayedProfileMatchesServer(profile: ComparableProfile, save: Save): boolean {
  return profile.credits === save.credits &&
    profile.faction === save.faction &&
    profile.shipId === save.ship &&
    profile.scheme === save.scheme &&
    profile.refit === save.refit &&
    profile.shieldMk2 === (save.shieldMk2 ?? false) &&
    profile.hold === save.hold &&
    profile.mission === save.mission &&
    profile.cleared === save.cleared &&
    profile.tech === save.tech;
}

export function readHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : null;
}

function originOnly(value: string, base?: string): string {
  try {
    return new URL(value, base).origin;
  } catch {
    return "unavailable";
  }
}

export function createReadOnlyProfileCheckReport(
  input: ReadOnlyProfileCheckInput,
): ReadOnlyProfileCheckReport {
  const pageOrigin = originOnly(input.pageOrigin);
  const apiOrigin = input.apiBaseUrl
    ? originOnly(input.apiBaseUrl, pageOrigin)
    : pageOrigin;
  const responseTimeMs = Number.isFinite(input.responseTimeMs)
    ? Math.max(0, Math.round(input.responseTimeMs))
    : 0;

  return {
    title: "WFM read-only phone profile check",
    capturedAt: input.capturedAt,
    pageOrigin,
    apiOrigin,
    device: {
      chromeVersion: input.device.chromeVersion,
      screenCssPixels: input.device.screenCssPixels,
      viewportCssPixels: input.device.viewportCssPixels,
      orientationAtStart: input.device.orientationAtStart,
      devicePixelRatio: input.device.devicePixelRatio,
    },
    authentication: {
      signedInAtCheck: input.signedIn,
      profileRequest: {
        method: "GET",
        path: "/api/game/profile",
        outcome: input.outcome,
        status: input.outcome === "success"
          ? "2xx"
          : input.httpStatus === null ? "unavailable" : `HTTP ${input.httpStatus}`,
        responseTimeMs,
      },
      visibleProfileFieldsMatchServer: input.visibleProfileFieldsMatchServer,
    },
    sideEffects: {
      writesSentByThisCheck: false,
      rewardClaimSentByThisCheck: false,
      rewardLedgerInspected: false,
    },
    limits: "This phone check verifies only an authenticated profile read and selected visible-state comparison. It does not inspect Railway logs or the reward database ledger, and cannot certify interrupted-claim denial.",
  };
}
