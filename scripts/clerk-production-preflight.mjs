import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const PRODUCTION_CLERK_TARGET = Object.freeze({
  origin: "https://niakofa.com",
  issuer: "https://clerk.niakofa.com",
  jwksUrl: "https://clerk.niakofa.com/.well-known/jwks.json",
});

const REQUIRED_VARIABLES_BY_SERVICE = Object.freeze({
  frontend: Object.freeze(["VITE_CLERK_PUBLISHABLE_KEY"]),
  api: Object.freeze(["CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]),
  socket: Object.freeze(["CLERK_SECRET_KEY", "CLERK_ISSUER", "WING_ALLOWED_ORIGINS"]),
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

function authorizationAndProductionChecks(
  apiAllowedOrigins = "NOT_CHECKED",
  wingAllowedOrigins = "NOT_CHECKED",
) {
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
      wingAllowedOrigins: {
        variable: "WING_ALLOWED_ORIGINS",
        status: wingAllowedOrigins,
      },
      clerkAllowedOrigins: EXTERNAL_INSTANCE_REQUIRED,
      clerkRedirectOrigins: EXTERNAL_INSTANCE_REQUIRED,
      emailDelivery: EMAIL_DELIVERY_REQUIRED,
    },
    operatorAction:
      "The connected Clerk integration may be Replit-managed Development, not external Production. Replit's documented external-app flow deletes the managed tenant and does not migrate accounts, credentials, or sessions. Keep Production blocked; obtain a supported non-destructive path or a separately approved migration and recovery plan before replacement. Then rerun the frontend, API, and socket service-scoped read-only preflights.",
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
  const requiredVariableNames = Object.hasOwn(
    REQUIRED_VARIABLES_BY_SERVICE,
    serviceContext,
  )
    ? REQUIRED_VARIABLES_BY_SERVICE[serviceContext]
    : [];

  if (!targetAsserted || requiredVariableNames.length === 0) {
    return {
      check: "wfm-clerk-production-preflight",
      targetContext: targetAsserted
        ? "OPERATOR_ASSERTED_RAILWAY_PRODUCTION"
        : "NOT_ASSERTED",
      targetContextVariable: PREFLIGHT_TARGET_VARIABLE,
      serviceContext: requiredVariableNames.length
        ? serviceContext
        : "NOT_ASSERTED",
      configurationStatus: "NOT_CHECKED",
      requiredVariables: requiredVariableNames.map((name) => ({
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

  const requiredVariables = requiredVariableNames.map((name) => ({
    name,
    status: variableIsPresent(environment, name) ? "PRESENT" : "MISSING",
  }));
  const apiAllowedOrigins =
    serviceContext === "api"
      ? exactOriginAllowlistStatus(environment.API_ALLOWED_ORIGINS)
      : "NOT_CHECKED";
  const wingAllowedOrigins =
    serviceContext === "socket"
      ? exactOriginAllowlistStatus(environment.WING_ALLOWED_ORIGINS)
      : "NOT_CHECKED";
  const productionOrigin =
    serviceContext === "api"
      ? apiAllowedOrigins
      : serviceContext === "socket"
        ? wingAllowedOrigins
        : "NOT_CHECKED";
  const clerkIssuer = exactMetadataStatus(
    environment,
    ISSUER_VARIABLE,
    PRODUCTION_CLERK_TARGET.issuer,
  );
  const runtimeClerkIssuer =
    serviceContext === "socket"
      ? exactMetadataStatus(environment, "CLERK_ISSUER", PRODUCTION_CLERK_TARGET.issuer)
      : "NOT_CHECKED";
  const clerkJwksUrl = exactMetadataStatus(
    environment,
    JWKS_VARIABLE,
    PRODUCTION_CLERK_TARGET.jwksUrl,
  );

  const configurationStatus =
    requiredVariables.every((variable) => variable.status === "PRESENT") &&
    (serviceContext === "frontend" || productionOrigin === "MATCH") &&
    clerkIssuer === "MATCH" &&
    clerkJwksUrl === "MATCH" &&
    (serviceContext !== "socket" || runtimeClerkIssuer === "MATCH")
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
    requiredVariables,
    publicConfiguration: {
      productionOrigin: {
        variable:
          serviceContext === "api"
            ? "API_ALLOWED_ORIGINS"
            : serviceContext === "socket"
              ? "WING_ALLOWED_ORIGINS"
              : null,
        status: productionOrigin,
      },
      clerkIssuer: {
        variable: ISSUER_VARIABLE,
        status: clerkIssuer,
      },
      runtimeClerkIssuer: {
        variable: serviceContext === "socket" ? "CLERK_ISSUER" : null,
        status: runtimeClerkIssuer,
      },
      clerkJwksUrl: {
        variable: JWKS_VARIABLE,
        status: clerkJwksUrl,
      },
    },
    configurationStatus,
    ...authorizationAndProductionChecks(apiAllowedOrigins, wingAllowedOrigins),
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
