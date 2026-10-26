import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { buildPublishableKey } from "@clerk/shared/keys";
import { apiClerkOptions } from "./clerk-auth-options";
import { requirePlayerAuth } from "./playerAuth";
import { fixtureRequest as fetch } from "../testing/http-request";

test("API authentication preserves its configured instance instead of deriving one from the HTTP host", async () => {
  // Entirely synthetic instance and signing material; no configured credentials
  // or real Clerk users are read or contacted by this test.
  const frontendApi = "clerk.auth-fixture.example";
  const publishableKey = buildPublishableKey(frontendApi);
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const options = apiClerkOptions(publishableKey);
  assert.equal(options.publishableKey, publishableKey);

  const app = express();
  app.use(clerkMiddleware({
    ...options,
    jwtKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
  }));
  app.get("/profile", requirePlayerAuth, (req, res) => {
    res.json({ authenticated: true, host: req.headers.host });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const payload = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
      iss: `https://${frontendApi}`,
      sub: "user_synthetic_fixture",
      sid: "sess_synthetic_fixture",
      azp: "https://game.example",
      iat: now - 5,
      nbf: now - 5,
      exp: now + 60,
    })}`;
    const signature = createSign("RSA-SHA256")
      .update(payload)
      .sign(privateKey, "base64url");
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/profile`;
    for (const host of ["api-service.up.railway.app", "untrusted.example"]) {
      const response = await fetch(url, {
        headers: {
          authorization: `Bearer ${payload}.${signature}`,
          host,
          "x-forwarded-host": host,
        },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { authenticated: true, host });
    }
    const anonymous = await fetch(url);
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await anonymous.json(), { error: "authentication_required" });
    const invalidSignature =
      (signature.startsWith("A") ? "B" : "A") + signature.slice(1);
    const forged = await fetch(url, {
      headers: { authorization: `Bearer ${payload}.${invalidSignature}` },
    });
    assert.equal(forged.status, 401);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
});
