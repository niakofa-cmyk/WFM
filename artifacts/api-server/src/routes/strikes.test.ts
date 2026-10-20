import assert from "node:assert/strict";
import test from "node:test";
import app from "../app";

test("legacy client-authored reward claims are rejected without an authenticated server run", async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/strikes/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gain: 9_999_999,
        cleared: 4,
        credits: 9_999_999,
        inputs: [],
      }),
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
