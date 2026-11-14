import assert from "node:assert/strict";
import { once } from "node:events";
import { Agent, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WebSocket, WebSocketServer } from "ws";
import { fixtureRequest as fetch } from "../testing/http-request";
import { createStagingGateway } from "./gateway";
import { createReplicaLookup } from "./replica-lookup";

test("replica DNS rotation supports single/all lookup forms, refreshes DNS and propagates failure", async () => {
  let calls = 0;
  const lookup = createReplicaLookup(async () => {
    if (++calls === 4) throw Object.assign(new Error("synthetic DNS failure"), { code: "EAI_AGAIN" });
    return [{ address: "::2", family: 6 }, { address: "::1", family: 6 }, { address: "::1", family: 6 }];
  });
  const next = (all: boolean) => new Promise((resolve, reject) => {
    lookup("synthetic.railway.internal", { all }, (error, address, family) => {
      if (error) reject(error);
      else resolve({ address, family });
    });
  });
  assert.deepEqual(await next(false), { address: "::1", family: 6 });
  assert.deepEqual(await next(true), { address: [
    { address: "::2", family: 6 }, { address: "::1", family: 6 },
  ], family: undefined });
  assert.deepEqual(await next(false), { address: "::1", family: 6 });
  await assert.rejects(next(true), { code: "EAI_AGAIN" });
  assert.equal(calls, 4);
});

test("gated websocket connections reach different real upstream servers without a routing bypass", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wfm-replica-gate-"));
  await writeFile(path.join(root, "index.html"), "<title>Synthetic staging</title>");
  const servers = [createServer(), createServer()];
  const sockets = servers.map((server, index) => {
    const wss = new WebSocketServer({ server });
    wss.on("connection", socket => socket.send(`replica-${index}`));
    return wss;
  });
  servers[0].listen(0, "127.0.0.1");
  await once(servers[0], "listening");
  const port = (servers[0].address() as AddressInfo).port;
  servers[1].listen(port, "127.0.0.2");
  await once(servers[1], "listening");
  const upstream = `http://sockets.railway.internal:${port}`;
  const origin = "https://staging.example";
  const agent = new Agent({ keepAlive: false, lookup: createReplicaLookup(async () => [
    { address: "127.0.0.1", family: 4 }, { address: "127.0.0.2", family: 4 },
  ]) });
  const gateway = createStagingGateway({
    publicOrigin: origin, accessCode: "synthetic-replica-fixture",
    apiUpstream: upstream, socketUpstream: upstream, staticRoot: root,
  }, { socketAgent: agent });
  gateway.server.listen(0, "127.0.0.1");
  await once(gateway.server, "listening");
  const base = `http://127.0.0.1:${(gateway.server.address() as AddressInfo).port}`;
  t.after(async () => {
    for (const wss of sockets) for (const socket of wss.clients) socket.terminate();
    await gateway.close();
    for (const server of servers) await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  });
  const headers = { host: "staging.example", origin };
  const login = await fetch(`${base}/__staging/access`, {
    method: "POST", headers: { ...headers, "content-type": "application/x-www-form-urlencoded" },
    body: "accessCode=synthetic-replica-fixture", redirect: "manual",
  });
  assert.equal(login.status, 303);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const results: string[] = [];
  for (let index = 0; index < 4; index++) {
    const ws = new WebSocket(base.replace("http:", "ws:") + "/ws", { headers: { ...headers, cookie } });
    t.after(() => ws.terminate());
    const [message] = await once(ws, "message");
    results.push(message.toString());
    ws.terminate();
  }
  assert.deepEqual(results, ["replica-0", "replica-1", "replica-0", "replica-1"]);
  // Rotation does not bypass the existing access gate.
  const rejected = new WebSocket(base.replace("http:", "ws:") + "/ws", { headers });
  rejected.on("error", () => {});
  const [, response] = await once(rejected, "unexpected-response");
  assert.equal(response.statusCode, 401);
  response.resume();
  rejected.terminate();
});
