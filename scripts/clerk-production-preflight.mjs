import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const PRODUCTION_CLERK_TARGET = Object.freeze({
  origin: "https://niakofa.com",
  issuer: "https://clerk.niakofa.com",
  jwksUrl: "https://clerk.niakofa.com/.well-known/jwks.json",
});

const REQUIRED_KEY_VARIABLES_BY_SERVICE = Object.freeze({
  frontend: Object.freeze(["VITE_CLERK_PUBLISHABLE_KEY"]),
  api: Object.freeze(["CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]),
});

const PREFLIGHT_TARGET_VARIABLE = "WFM_CLERK_PREFLIGHT_TARGET";
const ISSUER_VARIABLE = "WFM_PROD_CLERK_ISSUER";
const JWKS_VARIABLE = "WFM_PROD_CLERK_JWKS_URL";
const EXTERNAL_CONNECTION_NOT_VERIFIED =
  "NOT_VERIFIED_BY_RAILWAY_SERVICE_CONTEXT";
const EXTERNAL_INSTANCE_REQUIRED =
  "NOT_CHECKED_REQUIRES_AUTHORIZED_EXTERNAL_PRODUCTION_CLERK_CONNECTION";
const EMAIL_DELIVERY_REQUIRED =
  "BLOCKED_REQUIRES_TEST_INBOX_OR_CLERK_DELIVERY_LOG_CONFIRMATION";

function authorizationAndProductionChecks(apiAllowedOrigins = "NOT_CHECKED") {
  return {
    authorization: {
      replitManagedClerkAvailability: "NOT_CHECKED_FROM_RAILWAY_SERVICE_CONTEXT",
      externalProductionClerkConnection: {
        status: EXTERNAL_CONNECTION_NOT_VERIFIED,
        gate: "BLOCKED_REQUIRES_OWNER_CONFIRMATION_OF_SECURE_EXTERNAL_CONNECTION",
      },
      frontendApiKeyInstancePairing:
        "BLOCKED_REQUIRES_AUTHORIZED_EXTERNAL_INSTANCE_AND_SAFE_METADATA_MATCH",
    },
    productionVerification: {
      apiAllowedOrigins: {
        variable: "API_ALLOWED_ORIGINS",
        status: apiAllowedOrigins,
      },
      clerkAllowedOrigins: EXTERNAL_INSTANCE_REQUIRED,
      clerkRedirectOrigins: EXTERNAL_INSTANCE_REQUIRED,
      emailDelivery: EMAIL_DELIVERY_REQUIRED,
    },
    operatorAction:
      "Verify the existing external Production Clerk connection through Replit's secure integration flow; if it is absent, have the owner authorize it. Then rerun both service-scoped read-only preflights. This Railway process cannot inspect Replit integration authorization or prove key pairing.",
  };
}

function variableIsPresent(environment, name) {
  const value = environment[name];
  return typeof value === "string" && value.trim().length > 0;
}

function exactOriginAllowlistStatus(value) {
  if (typeof value !== "string" || !value.trim()) return "MISSING";

  const entries = value.split(",").map((entry) => entry.trim());
  if (entries.length !== 1 || entries[0] !== PRODUCTION_CLERK_TARGET.origin) {
    return "MISMATCH";
  }

  try {
    const parsed = new URL(entries[0]);
    if (
      parsed.protocol !== "https:" ||
      parsed.origin !== entries[0] ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return "MISMATCH";
    }
  } catch {
    return "MISMATCH";
  }

  return "MATCH";
}

function exactMetadataStatus(environment, name, expected) {
  if (!variableIsPresent(environment, name)) return "MISSING";
  return environment[name].trim() === expected ? "MATCH" : "MISMATCH";
}

function manualVerificationStatus() {
  return {
    keyInstancePairing:
      "BLOCKED_REQUIRES_AUTHORIZED_EXTERNAL_INSTANCE_AND_SAFE_METADATA_MATCH",
    emailDelivery: EMAIL_DELIVERY_REQUIRED,
    dedicatedTestAccount:
      "BLOCKED_REQUIRES_APPROVED_DEDICATED_PRODUCTION_TEST_ACCOUNT",
    protectedApiAndSessionSmokeTest: "NOT_RUN",
  };
}

export function evaluateClerkProductionPreflight(
  environment = process.env,
  serviceContext,
) {
  const targetAsserted =
    environment[PREFLIGHT_TARGET_VARIABLE] === "railway-production";
  const requiredKeyVariableNames = Object.hasOwn(
    REQUIRED_KEY_VARIABLES_BY_SERVICE,
    serviceContext,
  )
    ? REQUIRED_KEY_VARIABLES_BY_SERVICE[serviceContext]
    : [];

  if (!targetAsserted || requiredKeyVariableNames.length === 0) {
    return {
      check: "wfm-clerk-production-preflight",
      targetContext: targetAsserted
        ? "OPERATOR_ASSERTED_RAILWAY_PRODUCTION"
        : "NOT_ASSERTED",
      targetContextVariable: PREFLIGHT_TARGET_VARIABLE,
      serviceContext: requiredKeyVariableNames.length
        ? serviceContext
        : "NOT_ASSERTED",
      configurationStatus: "NOT_CHECKED",
      requiredKeyVariables: requiredKeyVariableNames.map((name) => ({
        name,
        status: "NOT_CHECKED",
      })),
      publicConfiguration: {
        productionOrigin: "NOT_CHECKED",
        clerkIssuer: "NOT_CHECKED",
        clerkJwksUrl: "NOT_CHECKED",
      },
      ...authorizationAndProductionChecks(),
      overallStatus: "BLOCKED_TARGET_OR_SERVICE_CONTEXT_NOT_ASSERTED",
      manualVerification: manualVerificationStatus(),
      productionEnablement: "BLOCKED",
      secretValuesPrinted: false,
      exitCode: 1,
    };
  }

  const requiredKeyVariables = requiredKeyVariableNames.map((name) => ({
    name,
    status: variableIsPresent(environment, name) ? "PRESENT" : "MISSING",
  }));
  const productionOrigin =
    serviceContext === "api"
      ? exactOriginAllowlistStatus(environment.API_ALLOWED_ORIGINS)
      : "NOT_CHECKED";
  const clerkIssuer = exactMetadataStatus(
    environment,
    ISSUER_VARIABLE,
    PRODUCTION_CLERK_TARGET.issuer,
  );
  const clerkJwksUrl = exactMetadataStatus(
    environment,
    JWKS_VARIABLE,
    PRODUCTION_CLERK_TARGET.jwksUrl,
  );

  const configurationStatus =
    requiredKeyVariables.every((variable) => variable.status === "PRESENT") &&
    (serviceContext === "frontend" || productionOrigin === "MATCH") &&
    clerkIssuer === "MATCH" &&
    clerkJwksUrl === "MATCH"
      ? "PASS"
      : "BLOCKED";

  return {
    check: "wfm-clerk-production-preflight",
    targetContext: "OPERATOR_ASSERTED_RAILWAY_PRODUCTION",
    serviceContext,
    publicTarget: {
      productionOrigin: PRODUCTION_CLERK_TARGET.origin,
      clerkIssuer: PRODUCTION_CLERK_TARGET.issuer,
      clerkJwksUrl: PRODUCTION_CLERK_TARGET.jwksUrl,
    },
    requiredKeyVariables,
    publicConfiguration: {
      productionOrigin: {
        variable: serviceContext === "api" ? "API_ALLOWED_ORIGINS" : null,
        status: productionOrigin,
      },
      clerkIssuer: {
        variable: ISSUER_VARIABLE,
        status: clerkIssuer,
      },
      clerkJwksUrl: {
        variable: JWKS_VARIABLE,
        status: clerkJwksUrl,
      },
    },
    configurationStatus,
    ...authorizationAndProductionChecks(productionOrigin),
    overallStatus:
      configurationStatus === "PASS"
        ? "STRUCTURAL_PASS_MANUAL_GATES_BLOCKED"
        : "BLOCKED_STRUCTURAL_CONFIGURATION",
    manualVerification: manualVerificationStatus(),
    productionEnablement: "BLOCKED",
    secretValuesPrinted: false,
    // Exit 2 means the structural checks passed, but the manual Production
    // authorization and account checks still block enabling live auth.
    exitCode: configurationStatus === "PASS" ? 2 : 1,
  };
}

function serviceArgument(argumentsList) {
  const index = argumentsList.indexOf("--service");
  if (index >= 0) return argumentsList[index + 1];

  const option = argumentsList.find((argument) =>
    argument.startsWith("--service="),
  );
  return option?.slice("--service=".length);
}

function main() {
  const report = evaluateClerkProductionPreflight(
    process.env,
    serviceArgument(process.argv.slice(2)),
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.exitCode;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch {
    // Do not include exception text: environment access or malformed input
    // must never result in values being echoed to the terminal.
    console.error(
      "Production Clerk preflight failed safely; no values logged.",
    );
    process.exitCode = 1;
  }
}
