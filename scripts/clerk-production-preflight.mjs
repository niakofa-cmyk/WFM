import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const PRODUCTION_CLERK_TARGET = Object.freeze({
  origin: "https://niakofa.com",
  issuer: "https://clerk.niakofa.com",
  jwksUrl: "https://clerk.niakofa.com/.well-known/jwks.json",
});

export const STAGING_CLERK_TARGET = Object.freeze({
  origin: "https://wfm-app-staging-staging.up.railway.app",
});

const PREFLIGHT_TARGETS = Object.freeze({
  "railway-production": Object.freeze({
    context: "OPERATOR_ASSERTED_RAILWAY_PRODUCTION",
    environment: "production",
    origin: PRODUCTION_CLERK_TARGET.origin,
    issuerVariable: "WFM_PROD_CLERK_ISSUER",
    expectedIssuer: PRODUCTION_CLERK_TARGET.issuer,
    jwksVariable: "WFM_PROD_CLERK_JWKS_URL",
    expectedJwksUrl: PRODUCTION_CLERK_TARGET.jwksUrl,
  }),
  "railway-staging": Object.freeze({
    context: "OPERATOR_ASSERTED_RAILWAY_STAGING",
    environment: "staging",
    origin: STAGING_CLERK_TARGET.origin,
    issuerVariable: "WFM_STAGING_CLERK_ISSUER",
    expectedIssuer: null,
    jwksVariable: null,
    expectedJwksUrl: null,
  }),
});

const REQUIRED_VARIABLES_BY_SERVICE = Object.freeze({
  frontend: Object.freeze(["VITE_CLERK_PUBLISHABLE_KEY"]),
  api: Object.freeze(["CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]),
  socket: Object.freeze(["CLERK_SECRET_KEY", "CLERK_ISSUER", "WING_ALLOWED_ORIGINS"]),
});

const PREFLIGHT_TARGET_VARIABLE = "WFM_CLERK_PREFLIGHT_TARGET";
const AUTH_PROVIDER_VARIABLE = "WFM_CLERK_AUTH_PROVIDER";
const BACKEND_HOSTING_VARIABLE = "WFM_CLERK_BACKEND_HOSTING";
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
      "Replit-managed Clerk Auth is intended for Replit-hosted apps and is not supported for Railway-hosted backends. The connected integration may be Replit-managed Development, not external Production. Replit's documented external-app flow deletes the managed tenant and does not migrate accounts, credentials, or sessions. Keep Production blocked; obtain a supported non-destructive path or a separately approved migration and recovery plan before replacement. Then rerun the service-scoped read-only preflight.",
  };
}

function variableIsPresent(environment, name) {
  const value = environment[name];
  return typeof value === "string" && value.trim().length > 0;
}

function authProviderHostingDeclaration(environment) {
  const providerValue = environment[AUTH_PROVIDER_VARIABLE];
  const provider = typeof providerValue === "string"
    ? providerValue.trim().toLowerCase()
    : "";
  const providerStatus =
    provider === "external-clerk"
      ? "EXTERNAL_CLERK_DECLARED"
      : provider === "replit-managed"
        ? "REPLIT_MANAGED_CLERK_DECLARED"
        : provider
          ? "AMBIGUOUS"
          : "MISSING";

  const hostingValue = environment[BACKEND_HOSTING_VARIABLE];
  const hosting = typeof hostingValue === "string"
    ? hostingValue.trim().toLowerCase()
    : "";
  const hostingStatus =
    hosting === "railway"
      ? "RAILWAY_DECLARED"
      : hosting === "replit"
        ? "REPLIT_DECLARED"
        : hosting
          ? "AMBIGUOUS"
          : "MISSING";

  let status;
  if (providerStatus === "MISSING" || hostingStatus === "MISSING") {
    status = "BLOCKED_PROVIDER_OR_HOSTING_DECLARATION_MISSING";
  } else if (providerStatus === "AMBIGUOUS" || hostingStatus === "AMBIGUOUS") {
    status = "BLOCKED_PROVIDER_OR_HOSTING_DECLARATION_AMBIGUOUS";
  } else if (hostingStatus !== "RAILWAY_DECLARED") {
    status = "BLOCKED_HOSTING_DECLARATION_MISMATCH";
  } else if (providerStatus === "REPLIT_MANAGED_CLERK_DECLARED") {
    status = "UNSUPPORTED_REPLIT_MANAGED_CLERK_FOR_RAILWAY";
  } else {
    // This declaration is operator input, not proof of the tenant that issued
    // any configured key or session token.
    status = "EXTERNAL_CLERK_DECLARED_NOT_VERIFIED";
  }

  return {
    provider: providerStatus,
    backendHosting: hostingStatus,
    status,
    verified: false,
  };
}

function exactOriginAllowlistStatus(
  value,
  expectedOrigin = PRODUCTION_CLERK_TARGET.origin,
) {
  if (typeof value !== "string" || !value.trim()) return "MISSING";

  const entries = value.split(",").map((entry) => entry.trim());
  if (entries.length !== 1 || entries[0] !== expectedOrigin) {
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

function safePublicIssuerOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      (parsed.pathname !== "" && parsed.pathname !== "/") ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function notCheckedVariables(variableNames) {
  return variableNames.map((name) => ({ name, status: "NOT_CHECKED" }));
}

function originVariableFor(target, serviceContext) {
  if (serviceContext === "api") return "API_ALLOWED_ORIGINS";
  if (serviceContext === "socket") return "WING_ALLOWED_ORIGINS";
  if (target?.environment === "staging" && serviceContext === "frontend") {
    return "STAGING_PUBLIC_ORIGIN";
  }
  return null;
}

function stagingDiagnosticChecks(originVariable, originStatus) {
  return {
    stagingVerification: {
      applicationOrigin: {
        variable: originVariable,
        status: originStatus,
      },
      keyInstancePairing: "NOT_VERIFIED_FROM_VARIABLE_PRESENCE",
      signInAndSocketSmoke: "NOT_RUN",
    },
    operatorAction:
      "This operator-only check reads process environment in a declared Railway service scope. It reports public issuer/origin metadata and required-variable presence only; it does not verify Clerk key pairing, authenticate a token, or prove the Railway runtime context. Do not publish it as an HTTP endpoint.",
  };
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
  const target = PREFLIGHT_TARGETS[environment[PREFLIGHT_TARGET_VARIABLE]];
  const targetAsserted = Boolean(target);
  const requiredVariableNames = Object.hasOwn(
    REQUIRED_VARIABLES_BY_SERVICE,
    serviceContext,
  )
    ? [
        ...REQUIRED_VARIABLES_BY_SERVICE[serviceContext],
        ...(target?.environment === "staging" && serviceContext === "frontend"
          ? ["STAGING_PUBLIC_ORIGIN"]
          : []),
      ]
    : [];

  if (!targetAsserted || requiredVariableNames.length === 0) {
    const stagingTarget = target?.environment === "staging";
    return {
      check: stagingTarget
        ? "wfm-clerk-staging-auth-preflight"
        : "wfm-clerk-production-preflight",
      targetContext: target?.context ?? "NOT_ASSERTED",
      targetContextVariable: PREFLIGHT_TARGET_VARIABLE,
      serviceContext: requiredVariableNames.length
        ? serviceContext
        : "NOT_ASSERTED",
      configurationStatus: "NOT_CHECKED",
      requiredVariables: notCheckedVariables(requiredVariableNames),
      publicConfiguration: stagingTarget
        ? {
            stagingOrigin: "NOT_CHECKED",
            clerkIssuer: "NOT_CHECKED",
            runtimeClerkIssuer: "NOT_CHECKED",
          }
        : {
            productionOrigin: "NOT_CHECKED",
            clerkIssuer: "NOT_CHECKED",
            clerkJwksUrl: "NOT_CHECKED",
          },
      providerHostingCompatibility: {
        provider: "NOT_CHECKED",
        backendHosting: "NOT_CHECKED",
        status: "NOT_CHECKED_TARGET_OR_SERVICE_SCOPE",
        verified: false,
      },
      ...authorizationAndProductionChecks(),
      overallStatus: "BLOCKED_TARGET_OR_SERVICE_CONTEXT_NOT_ASSERTED",
      manualVerification: manualVerificationStatus(),
      productionEnablement: "BLOCKED",
      stagingAuthReadiness: stagingTarget
        ? "BLOCKED_TARGET_OR_SERVICE_SCOPE_NOT_ASSERTED"
        : "NOT_APPLICABLE",
      secretValuesPrinted: false,
      exitCode: 1,
    };
  }

  const providerHostingCompatibility =
    authProviderHostingDeclaration(environment);
  if (
    providerHostingCompatibility.status !==
    "EXTERNAL_CLERK_DECLARED_NOT_VERIFIED"
  ) {
    const replitManaged =
      providerHostingCompatibility.status ===
      "UNSUPPORTED_REPLIT_MANAGED_CLERK_FOR_RAILWAY";
    const stagingTarget = target.environment === "staging";
    const requiredVariables = notCheckedVariables(requiredVariableNames);
    const stageChecks = stagingTarget
      ? stagingDiagnosticChecks(
          originVariableFor(target, serviceContext),
          "NOT_CHECKED",
        )
      : authorizationAndProductionChecks();
    const report = {
      check: stagingTarget
        ? "wfm-clerk-staging-auth-preflight"
        : "wfm-clerk-production-preflight",
      targetContext: target.context,
      targetContextVariable: PREFLIGHT_TARGET_VARIABLE,
      serviceContext,
      configurationStatus: "BLOCKED",
      requiredVariables,
      publicConfiguration: stagingTarget
        ? {
            stagingOrigin: {
              variable: serviceContext === "frontend"
                ? "STAGING_PUBLIC_ORIGIN"
                : serviceContext === "api"
                  ? "API_ALLOWED_ORIGINS"
                  : "WING_ALLOWED_ORIGINS",
              status: "NOT_CHECKED",
            },
            clerkIssuer: {
              variable: target.issuerVariable,
              status: "NOT_CHECKED",
            },
            runtimeClerkIssuer: {
              variable: serviceContext === "socket" ? "CLERK_ISSUER" : null,
              status: "NOT_CHECKED",
            },
          }
        : {
            productionOrigin: "NOT_CHECKED",
            clerkIssuer: "NOT_CHECKED",
            clerkJwksUrl: "NOT_CHECKED",
          },
      providerHostingCompatibility,
      ...stageChecks,
      overallStatus: replitManaged
        ? "BLOCKED_REPLIT_MANAGED_CLERK_UNSUPPORTED_FOR_RAILWAY"
        : providerHostingCompatibility.status,
      manualVerification: stagingTarget
        ? {
            keyInstancePairing: "NOT_VERIFIED_FROM_VARIABLE_PRESENCE",
            authenticatedSocketJoinAndReconnect: "NOT_RUN",
          }
        : manualVerificationStatus(),
      productionEnablement: "BLOCKED",
      stagingAuthReadiness: stagingTarget
        ? "BLOCKED_PROVIDER_OR_HOSTING_DECLARATION"
        : "NOT_APPLICABLE",
      operatorAction: replitManaged
        ? "Replit-managed Clerk Auth is intended for Replit-hosted apps and is not supported for Railway-hosted backends. Do not copy managed keys to Railway. Keep Production blocked and use only a separately authorized, supported authentication path."
        : "Set WFM_CLERK_AUTH_PROVIDER to external-clerk or replit-managed and WFM_CLERK_BACKEND_HOSTING to railway for this preflight process only. Missing or ambiguous declarations fail closed. These declarations, variable names, key prefixes, and issuer strings do not prove tenant compatibility or authorize Production.",
      secretValuesPrinted: false,
      exitCode: 1,
    };
    return report;
  }

  const stagingTarget = target.environment === "staging";
  const requiredVariables = requiredVariableNames.map((name) => ({
    name,
    status: variableIsPresent(environment, name) ? "PRESENT" : "MISSING",
  }));
  const originVariable = originVariableFor(target, serviceContext);
  const originStatus = originVariable
    ? exactOriginAllowlistStatus(environment[originVariable], target.origin)
    : "NOT_CHECKED";
  const apiAllowedOrigins =
    serviceContext === "api"
      ? originStatus
      : "NOT_CHECKED";
  const wingAllowedOrigins =
    serviceContext === "socket"
      ? originStatus
      : "NOT_CHECKED";
  const expectedIssuerInput = environment[target.issuerVariable];
  const operatorDeclaredIssuer = stagingTarget
    ? safePublicIssuerOrigin(expectedIssuerInput)
    : target.expectedIssuer;
  const clerkIssuerStatus = stagingTarget
    ? !variableIsPresent(environment, target.issuerVariable)
      ? "MISSING"
      : operatorDeclaredIssuer
        ? "OPERATOR_DECLARED_PUBLIC_ISSUER"
        : "INVALID"
    : exactMetadataStatus(
        environment,
        target.issuerVariable,
        target.expectedIssuer,
      );
  const runtimeClerkIssuer =
    serviceContext === "socket"
      ? stagingTarget
        ? !variableIsPresent(environment, "CLERK_ISSUER")
          ? "MISSING"
          : safePublicIssuerOrigin(environment.CLERK_ISSUER) ===
              operatorDeclaredIssuer && operatorDeclaredIssuer
            ? "MATCHES_OPERATOR_DECLARATION"
            : safePublicIssuerOrigin(environment.CLERK_ISSUER)
              ? "MISMATCH"
              : "INVALID"
        : exactMetadataStatus(
            environment,
            "CLERK_ISSUER",
            target.expectedIssuer,
          )
      : "NOT_CHECKED";
  const clerkJwksUrl = target.jwksVariable
    ? exactMetadataStatus(
        environment,
        target.jwksVariable,
        target.expectedJwksUrl,
      )
    : "NOT_APPLICABLE";

  const configurationStatus =
    providerHostingCompatibility.status ===
      "EXTERNAL_CLERK_DECLARED_NOT_VERIFIED" &&
    requiredVariables.every((variable) => variable.status === "PRESENT") &&
    (originVariable === null || originStatus === "MATCH") &&
    (stagingTarget
      ? clerkIssuerStatus === "OPERATOR_DECLARED_PUBLIC_ISSUER"
      : clerkIssuerStatus === "MATCH") &&
    (stagingTarget || clerkJwksUrl === "MATCH") &&
    (serviceContext !== "socket" ||
      runtimeClerkIssuer ===
        (stagingTarget ? "MATCHES_OPERATOR_DECLARATION" : "MATCH"))
      ? "PASS"
      : "BLOCKED";

  const publicOriginStatus = {
    variable: originVariable,
    status: originStatus,
  };
  const publicIssuerStatus = stagingTarget
    ? {
        variable: target.issuerVariable,
        status: clerkIssuerStatus,
        configuredPublicIssuer:
          operatorDeclaredIssuer ?? "NOT_A_SAFE_HTTPS_ORIGIN",
      }
    : {
        variable: target.issuerVariable,
        status: clerkIssuerStatus,
      };
  const publicRuntimeIssuerStatus = {
    variable: serviceContext === "socket" ? "CLERK_ISSUER" : null,
    status: runtimeClerkIssuer,
    ...(stagingTarget && serviceContext === "socket"
      ? {
          configuredPublicIssuer:
            safePublicIssuerOrigin(environment.CLERK_ISSUER) ??
            "NOT_A_SAFE_HTTPS_ORIGIN",
        }
      : {}),
  };
  const publicConfiguration = stagingTarget
    ? {
        stagingOrigin: publicOriginStatus,
        clerkIssuer: publicIssuerStatus,
        runtimeClerkIssuer: publicRuntimeIssuerStatus,
      }
    : {
        productionOrigin: publicOriginStatus,
        clerkIssuer: publicIssuerStatus,
        runtimeClerkIssuer: publicRuntimeIssuerStatus,
        clerkJwksUrl: {
          variable: target.jwksVariable,
          status: clerkJwksUrl,
        },
      };

  const authChecks = stagingTarget
    ? stagingDiagnosticChecks(originVariable, originStatus)
    : authorizationAndProductionChecks(
        apiAllowedOrigins,
        wingAllowedOrigins,
      );
  return {
    check: stagingTarget
      ? "wfm-clerk-staging-auth-preflight"
      : "wfm-clerk-production-preflight",
    targetContext: target.context,
    targetContextVariable: PREFLIGHT_TARGET_VARIABLE,
    serviceContext,
    publicTarget: stagingTarget
      ? { stagingOrigin: target.origin }
      : {
          productionOrigin: target.origin,
          clerkIssuer: target.expectedIssuer,
          clerkJwksUrl: target.expectedJwksUrl,
        },
    requiredVariables,
    publicConfiguration,
    configurationStatus,
    providerHostingCompatibility,
    ...authChecks,
    overallStatus:
      configurationStatus === "PASS"
        ? stagingTarget
          ? "STAGING_STRUCTURAL_PASS_EXTERNAL_TENANT_UNVERIFIED"
          : "STRUCTURAL_PASS_MANUAL_GATES_BLOCKED"
        : "BLOCKED_STRUCTURAL_CONFIGURATION",
    manualVerification: stagingTarget
      ? {
          keyInstancePairing: "NOT_VERIFIED_FROM_VARIABLE_PRESENCE",
          authenticatedSocketJoinAndReconnect: "NOT_RUN",
        }
      : manualVerificationStatus(),
    productionEnablement: "BLOCKED",
    stagingAuthReadiness: stagingTarget
      ? configurationStatus === "PASS"
        ? "STRUCTURAL_ONLY_EXTERNAL_TENANT_UNVERIFIED"
        : "BLOCKED_STRUCTURAL_CONFIGURATION"
      : "NOT_APPLICABLE",
    secretValuesPrinted: false,
    // Exit 2 means only structural checks passed. Production remains blocked;
    // staging instance pairing and live authentication remain unverified.
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
    console.error("Clerk auth preflight failed safely; no values logged.");
    process.exitCode = 1;
  }
}
