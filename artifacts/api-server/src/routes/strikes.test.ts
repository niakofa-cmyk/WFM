import assert from "node:assert/strict";
import test from "node:test";
import app from "../app";

const validClaim = {
  seed: 12345,
  shipId: "mandjet",
  faction: "accord",
  refit: 0,
  pace: "strike",
  goal: "disc",
  disc: "rust",
  allyCount: 4,
  foeCount: 5,
  tech: null,
  inputs: [],
  mission: "skirmish",
  cleared: 0,
  hold: null,
  paid: 0,
  prices: {},
};

test("strike claim HTTP endpoint validates inputs and calculates rewards on the server", async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const baseUrl = `http://127.0.0.1:${address.port}/api/strikes/claim`;
    const validResponse = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validClaim),
    });
    assert.equal(validResponse.status, 200);
    const grant = (await validResponse.json()) as { outcome: string; gain: number; kills: number };
    assert.equal(grant.outcome, "loss");
    assert.equal(grant.kills, 0);
    assert.equal(grant.gain, 30);

    const invalidResponse = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validClaim, inputs: [{ ...validClaim, throttle: 200 }] }),
    });
    assert.equal(invalidResponse.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
