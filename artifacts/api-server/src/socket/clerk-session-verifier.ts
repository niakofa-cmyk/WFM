import { verifyToken, type VerifyTokenOptions } from "@clerk/backend";

const MAX_SESSION_TOKEN_LENGTH = 8 * 1024;

type SessionVerifierOptions = Pick<
  VerifyTokenOptions,
  "secretKey" | "jwtKey" | "issuer" | "audience" | "authorizedParties"
>;

export type SocketSessionVerifier = (token: string) => Promise<string>;

/**
 * Verifies a Clerk session JWT using Clerk's backend SDK and returns only its
 * verified subject. The token must never be logged or copied into a URL.
 */
export function createClerkSessionVerifier(options: SessionVerifierOptions): SocketSessionVerifier {
  if (!options.secretKey?.trim() && !options.jwtKey?.trim()) {
    throw new Error("A Clerk secret key or JWT public key is required for socket authentication.");
  }

  const verifierOptions: SessionVerifierOptions = {
    ...options,
    issuer: options.issuer?.trim() || undefined,
    audience: options.audience?.trim() || undefined,
    authorizedParties: options.authorizedParties?.length
      ? [...options.authorizedParties]
      : undefined,
  };

  return async (token) => {
    if (!token || token.length > MAX_SESSION_TOKEN_LENGTH) {
      throw new Error("Invalid Clerk session token.");
    }

    const verified = await verifyToken(token, verifierOptions);
    if (typeof verified.sub !== "string" || verified.sub.length === 0) {
      throw new Error("The verified Clerk session has no subject.");
    }
    return verified.sub;
  };
}
