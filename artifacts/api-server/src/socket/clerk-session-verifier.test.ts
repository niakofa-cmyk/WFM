import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { createClerkSessionVerifier } from "./clerk-session-verifier";

const ISSUER = "https://auth.example.test";
const AUTHORIZED_PARTY = "https://game.example.test";
const AUDIENCE = "wfm-api";

function makeKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

function signSession(
  privateKey: string,
  claims: Record<string, unknown>,
): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(privateKey).toString("base64url")}`;
}

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: "user_synthetic_test",
    iss: ISSUER,
    azp: AUTHORIZED_PARTY,
    aud: AUDIENCE,
    iat: now,
    nbf: now - 1,
    exp: now + 60,
    ...overrides,
  };
}

test("Clerk session verifier accepts a correctly signed token and returns only its subject", async () => {
  const keys = makeKeyPair();
  const verify = createClerkSessionVerifier({
    jwtKey: keys.publicKey,
    issuer: ISSUER,
    audience: AUDIENCE,
    authorizedParties: [AUTHORIZED_PARTY],
  });
  const token = signSession(keys.privateKey, claims());

  assert.equal(await verify(token), "user_synthetic_test");
});

test("Clerk session verifier rejects invalid signatures", async () => {
  const signer = makeKeyPair();
  const verifier = makeKeyPair();
  const verify = createClerkSessionVerifier({ jwtKey: verifier.publicKey });

  await assert.rejects(verify(signSession(signer.privateKey, claims())));
});

test("Clerk session verifier rejects expired sessions", async () => {
  const keys = makeKeyPair();
  const verify = createClerkSessionVerifier({
    jwtKey: keys.publicKey,
    issuer: ISSUER,
    authorizedParties: [AUTHORIZED_PARTY],
  });

  await assert.rejects(
    verify(signSession(keys.privateKey, claims({ exp: Math.floor(Date.now() / 1000) - 60 }))),
  );
});

test("Clerk session verifier rejects an unexpected issuer", async () => {
  const keys = makeKeyPair();
  const verify = createClerkSessionVerifier({
    jwtKey: keys.publicKey,
    issuer: ISSUER,
  });

  await assert.rejects(
    verify(signSession(keys.privateKey, claims({ iss: "https://other.example.test" }))),
  );
});

test("Clerk session verifier rejects an unauthorized party and unexpected audience", async () => {
  const keys = makeKeyPair();
  const verify = createClerkSessionVerifier({
    jwtKey: keys.publicKey,
    issuer: ISSUER,
    audience: AUDIENCE,
    authorizedParties: [AUTHORIZED_PARTY],
  });

  await assert.rejects(
    verify(signSession(keys.privateKey, claims({ azp: "https://attacker.example.test" }))),
  );
  await assert.rejects(
    verify(signSession(keys.privateKey, claims({ aud: "another-api" }))),
  );
});

test("Clerk session verifier fails closed on missing keys, missing subjects, and oversized tokens", async () => {
  assert.throws(() => createClerkSessionVerifier({}));

  const keys = makeKeyPair();
  const verify = createClerkSessionVerifier({ jwtKey: keys.publicKey });
  await assert.rejects(verify(signSession(keys.privateKey, claims({ sub: "" }))));
  await assert.rejects(verify("x".repeat(8 * 1024 + 1)));
});
