type ClerkIssuerEnvironment = Record<string, string | undefined>;

/**
 * Replit-managed Clerk verifies sessions with the matching platform-injected
 * secret key. Its public issuer is not required as a separate runtime setting.
 * Keep issuer enforcement for every other production configuration.
 */
export function resolveClerkIssuer(
  environment: ClerkIssuerEnvironment,
): string | undefined {
  const issuer = environment.CLERK_ISSUER?.trim() || undefined;
  if (environment.NODE_ENV !== "production") return issuer;

  const provider = environment.WFM_CLERK_AUTH_PROVIDER?.trim();
  const hosting = environment.WFM_CLERK_BACKEND_HOSTING?.trim();

  if (provider && provider !== "external-clerk" && provider !== "replit-managed") {
    throw new Error("WFM_CLERK_AUTH_PROVIDER must be an explicitly supported provider.");
  }

  if (provider === "replit-managed") {
    if (hosting !== "replit") {
      throw new Error("Replit-managed Clerk requires a Replit-hosted backend.");
    }
    return issuer;
  }

  if (!issuer) {
    throw new Error(
      "CLERK_ISSUER must be configured before running the socket server in production.",
    );
  }
  return issuer;
}
