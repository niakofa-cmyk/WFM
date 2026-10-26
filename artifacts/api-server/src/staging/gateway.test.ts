import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WebSocket, WebSocketServer } from "ws";
import { createStagingGateway } from "./gateway";
import { fixtureRequest as fetch } from "../testing/http-request";

const ORIGIN = "https://staging.example";
const fixtureCode = "synthetic-code-for-isolated-staging-tests";
const host = { host: "staging.example" };

async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "wfm-staging-gate-"));
  await writeFile(path.join(root, "index.html"), "<!doctype html><title>Synthetic WFM shell</title>");
  await writeFile(path.join(root, "fixture.js"), "/* synthetic asset */");
  let apiRequests = 0;
  const api = createServer((req, res) => {
    apiRequests++;
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization !== "Bearer synthetic-session") {
      res.writeHead(401).end('{"error":"authentication_required"}');
      return;
    }
    if (req.url === "/api/fixture-echo") {
      const chunks: Buffer[] = [];
      req.on("data", data => chunks.push(Buffer.from(data)));
      req.on("end", () => res.end(JSON.stringify({ body: Buffer.concat(chunks).toString() })));
      return;
    }
    res.end(JSON.stringify({
      path: req.url,
      cookie: req.headers.cookie,
      forwardedHost: req.headers["x-forwarded-host"],
      forwardedProto: req.headers["x-forwarded-proto"],
    }));
  });
  const socketServer = createServer();
  const wss = new WebSocketServer({ server: socketServer });
  wss.on("connection", socket => socket.on("message", data => socket.send(data)));
  const apiUrl = await listen(api);
  const socketUrl = await listen(socketServer);
  const gateway = createStagingGateway({
    publicOrigin: ORIGIN,
    accessCode: fixtureCode,
    apiUpstream: apiUrl,
    socketUpstream: socketUrl,
    staticRoot: root,
  });
  const url = await listen(gateway.server);
  async function login() {
    const response = await fetch(`${url}/__staging/access`, {
      method: "POST",
      headers: { ...host, origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ accessCode: fixtureCode }),
      redirect: "manual",
    });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/");
    const cookie = response.headers.get("set-cookie")!;
    for (const flag of ["Secure", "HttpOnly", "SameSite=Lax", "Path=/"]) assert.ok(cookie.includes(flag));
    return cookie.split(";")[0];
  }
  return {
    url,
    socketUrl: url.replace("http:", "ws:") + "/ws",
    login,
    get apiRequests() { return apiRequests; },
    async close() {
      await gateway.close();
      for (const client of wss.clients) client.terminate();
      await close(api);
      await close(socketServer);
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function rejectedUpgrade(url: string, headers: Record<string, string>) {
  return new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(url, { headers });
    socket.on("error", () => { /* expected after an unauthorized handshake */ });
    socket.once("unexpected-response", (_req, res) => {
      res.resume();
      socket.terminate();
      resolve(res.statusCode!);
    });
    socket.once("open", () => { socket.terminate(); reject(new Error("An unauthorized upgrade succeeded")); });
  });
}

test("gate protects pages, assets and API; Clerk authentication is still required after unlocking", async t => {
  const f = await fixture();
  t.after(f.close);
  for (const resource of ["/", "/sign-in", "/fixture.js", "/api/game/profile"]) {
    const response = await fetch(f.url + resource, { headers: host });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok(!(await response.text()).includes("Synthetic WFM shell"));
  }
  assert.equal(f.apiRequests, 0);
  const health = await fetch(f.url + "/__staging/healthz");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  const cookie = await f.login();
  const shell = await fetch(f.url + "/sign-in", { headers: { ...host, cookie } });
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /Synthetic WFM shell/);
  const missing = await fetch(f.url + "/missing.js", { headers: { ...host, cookie } });
  assert.equal(missing.status, 404);
  const noClerk = await fetch(f.url + "/api/game/profile", { headers: { ...host, cookie } });
  assert.equal(noClerk.status, 401);
  assert.deepEqual(await noClerk.json(), { error: "authentication_required" });
  const valid = await fetch(f.url + "/api/game/profile?fixture=1", {
    headers: {
      ...host, cookie: `${cookie}; __session=synthetic`, authorization: "Bearer synthetic-session",
      "x-forwarded-host": "untrusted.example", "x-forwarded-proto": "http",
    },
  });
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), {
    path: "/api/game/profile?fixture=1",
    cookie: "__session=synthetic",
    forwardedHost: "staging.example",
    forwardedProto: "https",
  });
  const body = JSON.stringify({ seq: 12, fire: true });
  const posted = await fetch(f.url + "/api/fixture-echo", {
    method: "POST", headers: {
      ...host, cookie, origin: ORIGIN,
      authorization: "Bearer synthetic-session", "content-type": "application/json",
    }, body,
  });
  assert.equal(posted.status, 200);
  assert.deepEqual(await posted.json(), { body });
});

test("gate rejects hostile hosts, cross-origin submissions, wrong codes and oversized bodies", async t => {
  const f = await fixture();
  t.after(f.close);
  const hostile = await fetch(f.url + "/", { headers: { host: "untrusted.example" } });
  assert.equal(hostile.status, 403);
  const crossOrigin = await fetch(f.url + "/__staging/access", {
    method: "POST", headers: { ...host, origin: "https://untrusted.example" },
  });
  assert.equal(crossOrigin.status, 403);
  const oversized = await fetch(f.url + "/__staging/access", {
    method: "POST",
    headers: { ...host, origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" },
    body: `accessCode=${"x".repeat(3000)}`,
  });
  assert.equal(oversized.status, 400);
  const wrong = await fetch(f.url + "/__staging/access", {
    method: "POST",
    headers: { ...host, origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" },
    body: "accessCode=incorrect",
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get("set-cookie"), null);
  assert.ok(!(await wrong.text()).includes(fixtureCode));
});

test("all websocket upgrades stay gated after HTTP proxy use; logout closes and revokes access", async t => {
  const f = await fixture();
  t.after(f.close);
  const cookie = await f.login();
  await fetch(f.url + "/api/game/profile", { headers: { ...host, cookie } });
  assert.equal(await rejectedUpgrade(f.socketUrl, { ...host, origin: ORIGIN }), 401);
  assert.equal(await rejectedUpgrade(f.socketUrl, { ...host, origin: "https://untrusted.example", cookie }), 401);
  assert.equal(await rejectedUpgrade(f.socketUrl, { ...host, cookie }), 401);
  const ws = new WebSocket(f.socketUrl, { headers: { ...host, origin: ORIGIN, cookie } });
  ws.on("error", () => {});
  t.after(() => ws.terminate());
  await once(ws, "open");
  const echo = once(ws, "message");
  ws.send("synthetic-flight-input");
  assert.equal((await echo)[0].toString(), "synthetic-flight-input");
  const closed = once(ws, "close");
  const logout = await fetch(f.url + "/__staging/logout", {
    method: "POST", headers: { ...host, origin: ORIGIN, cookie }, redirect: "manual",
  });
  assert.equal(logout.status, 303);
  await closed;
  assert.equal((await fetch(f.url + "/", { headers: { ...host, cookie } })).status, 401);
  assert.equal(await rejectedUpgrade(f.socketUrl, { ...host, origin: ORIGIN, cookie }), 401);
});
