import { verifyToken } from "@clerk/express";

export const WING_PROTOCOL_VERSION = 1;
export type SocketSession = { playerId: string; expiresAt: number };
export type VerifySocketSession = (token: string, origin: string | undefined) => Promise<SocketSession | null>;

export function createClerkSocketVerifier(config: {
  authorizedParties: readonly string[];
  jwtKey?: string;
  secretKey?: string;
}): VerifySocketSession {
  if (!config.jwtKey && !config.secretKey) throw new Error("Socket Clerk verification credentials are required.");
  if (config.authorizedParties.length === 0) throw new Error("Socket authorized frontend origins are required.");
  const parties = config.authorizedParties.map((party) => {
    let url: URL;
    try { url = new URL(party); } catch { throw new Error("Socket authorized parties must be exact HTTP(S) origins."); }
    if (!["https:", "http:"].includes(url.protocol) || url.origin !== party) {
      throw new Error("Socket authorized parties must be exact HTTP(S) origins.");
    }
    return party;
  });
  return async (token, origin) => {
    if (!origin || !parties.includes(origin)) return null;
    try {
      const claims = await verifyToken(token, {
        jwtKey: config.jwtKey,
        secretKey: config.secretKey,
        authorizedParties: parties,
        clockSkewInMs: 0,
      });
      if (
        typeof claims.sub !== "string" || !claims.sub.startsWith("user_") ||
        typeof claims.sid !== "string" || !claims.sid.startsWith("sess_") ||
        claims.azp !== origin || claims.sts === "pending" ||
        typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()
      ) return null;
      return { playerId: claims.sub, expiresAt: claims.exp * 1000 };
    } catch {
      // Authentication failures never echo tokens, claims or provider diagnostics.
      return null;
    }
  };
}
