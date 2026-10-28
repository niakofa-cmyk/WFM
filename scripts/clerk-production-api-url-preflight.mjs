import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const PREFLIGHT_TARGET = "WFM_CLERK_PREFLIGHT_TARGET";
const AUTH_PROVIDER = "WFM_CLERK_AUTH_PROVIDER";
const BACKEND_HOSTING = "WFM_CLERK_BACKEND_HOSTING";
const API_BASE_URL = "VITE_API_BASE_URL";

function normalizedValue(environment, name) {
  const value = environment[name];
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function apiUrlStatus(value) {
  if (typeof value !== "string" || !value.trim()) return "MISSING";

  try {
    const parsed = new URL(value.trim());
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return "INVALID_HTTPS_URL_SHAPE";
    }
  } catch {
    return "INVALID_HTTPS_URL_SHAPE";
  }

  return "PRESENT_VALID_HTTPS_URL";
}

export function evaluateProductionApiUrlPreflight(
  environment = process.env,
  serviceContext,
) {
  const targetAsserted =
    normalizedValue(environment, PREFLIGHT_TARGET) === "railway-production";
  const frontendService = serviceContext === "frontend";
  const provider = normalizedValue(environment, AUTH_PROVIDER);
  const hosting = normalizedValue(environment, BACKEND_HOSTING);

  const providerStatus =
    provider === "external-clerk"
      ? "EXTERNAL_CLERK_DECLARED"
      : provider === "replit-managed"
        ? "UNSUPPORTED_REPLIT_MANAGED_CLERK_FOR_RAILWAY"
        : provider
          ? "AMBIGUOUS"
          : "MISSING";
  const hostingStatus =
    hosting === "railway"
      ? "RAILWAY_DECLARED"
      : hosting === "replit"
        ? "HOSTING_MISMATCH"
        : hosting
          ? "AMBIGUOUS"
          : "MISSING";

  const scopeIsValid =
    targetAsserted &&
    frontendService &&
    providerStatus === "EXTERNAL_CLERK_DECLARED" &&
    hostingStatus === "RAILWAY_DECLARED";
  const apiUrl = scopeIsValid
    ? apiUrlStatus(environment[API_BASE_URL])
    : "NOT_CHECKED_SCOPE_BLOCKED";
  const structuralChecksPassed = apiUrl === "PRESENT_VALID_HTTPS_URL";

  return {
    check: "wfm-production-api-url-preflight",
    targetContext: targetAsserted
      ? "OPERATOR_ASSERTED_RAILWAY_PRODUCTION"
      : "NOT_ASSERTED",
    serviceContext: frontendService ? "frontend" : "NOT_ASSERTED",
    declarations: {
      authProvider: providerStatus,
      backendHosting: hostingStatus,
    },
    requiredVariables: {
      [PREFLIGHT_TARGET]: targetAsserted ? "PRESENT_EXPECTED" : "MISSING_OR_MISMATCH",
      [AUTH_PROVIDER]: providerStatus,
      [BACKEND_HOSTING]: hostingStatus,
      [API_BASE_URL]: apiUrl,
    },
    structuralStatus: structuralChecksPassed ? "PASS" : "BLOCKED",
    runtimeServiceContext: "NOT_PROVEN_BY_THIS_CHECK",
    productionAuthorization: "NOT_VERIFIED",
    productionEnablement: "BLOCKED",
    operatorAction:
      "Run from an authorized Railway Production frontend service context; then separately verify Clerk key pairing, issuer, origins, email delivery, and authenticated session behavior.",
    exitCode: structuralChecksPassed ? 2 : 1,
  };
}

function serviceContextFromArgs(args) {
  const serviceFlag = args.indexOf("--service");
  return serviceFlag >= 0 ? args[serviceFlag + 1] : undefined;
}

function main() {
  const report = evaluateProductionApiUrlPreflight(
    process.env,
    serviceContextFromArgs(process.argv.slice(2)),
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.exitCode;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main();
}
