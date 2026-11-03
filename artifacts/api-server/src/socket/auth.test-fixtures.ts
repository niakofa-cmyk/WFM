import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createClerkSocketVerifier } from "./auth";

// Synthetic sessions for transport tests only. Never imported by a runtime entry.
export const TEST_ORIGIN = "https://wfm.test";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
export const testVerifier = createClerkSocketVerifier({
  authorizedParties: [TEST_ORIGIN],
  jwtKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
});
export function testToken(name: string, overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const id = createHash("sha256").update(name).digest("hex").slice(0, 24);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "synthetic" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({
    iss: "https://wfm-test.clerk.accounts.dev", sub: `user_${id}`, sid: `sess_${id}`,
    azp: TEST_ORIGIN, iat: now, nbf: now - 1, exp: now + 600, ...overrides,
  })).toString("base64url");
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), keys.privateKey).toString("base64url")}`;
}
export function testJoin(name: string, reconnectToken?: string) {
  return { type: "join", protocol: 1, name, sessionToken: testToken(name), ...(reconnectToken ? { reconnectToken } : {}) };
}
