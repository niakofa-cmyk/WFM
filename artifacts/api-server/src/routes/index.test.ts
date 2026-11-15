import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { Router } from "express";
import { createApiRouter } from "./index";

test("public operation discovery is mounted before authentication-wide routers", async () => {
  const operations = Router();
  operations.get("/world/operations", (_req, res) => res.json({ instances: [] }));
  const app = express().use(createApiRouter(operations));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/world/operations`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { instances: [] });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
