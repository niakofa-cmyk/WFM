import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { Duplex } from "node:stream";
import path from "node:path";
import express, { type Request, type Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { ACCESS_COOKIE, ACCESS_TTL_MS, createStagingAccess, stripAccessCookie } from "./access";
import type { StagingGatewayConfig } from "./config";
import { stagingAccessPage } from "./page";

const HOP_HEADERS = [
  "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto",
  "proxy-authorization", "proxy-authenticate", "keep-alive", "te", "trailer",
];

export function createStagingGateway(config: StagingGatewayConfig) {
  const app = express();
  app.disable("x-powered-by");
  const server = createServer(app);
  const publicUrl = new URL(config.publicOrigin);
  const access = createStagingAccess(config.accessCode);
  const activeSockets = new Map<string, Set<Duplex>>();

  function accessPage(res: Response, rejected = false, unlocked = false) {
    res.setHeader("Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    res.type("html").send(stagingAccessPage(rejected, unlocked));
  }
  function allowedHost(req: { headers: { host?: string } }) {
    return req.headers.host?.toLowerCase() === publicUrl.host.toLowerCase();
  }
  function allowedOrigin(req: { headers: { origin?: string } }, required = false) {
    return req.headers.origin === config.publicOrigin || (!required && !req.headers.origin);
  }
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, nosnippet");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  // Liveness has no configuration, credential, or user details and permits the
  // platform's health-check Host header. It does not proxy anything.
  app.get("/__staging/healthz", (_req, res) => { res.json({ status: "ok" }); });
  app.use((req, res, next) => {
    if (!allowedHost(req) || !allowedOrigin(req) ||
      !req.originalUrl.startsWith("/") || req.originalUrl.startsWith("//")) {
      res.status(403).json({ error: "staging_origin_rejected" });
      return;
    }
    next();
  });
  app.get("/robots.txt", (_req, res) => { res.type("text").send("User-agent: *\nDisallow: /\n"); });
  app.get("/__staging/access", (req, res) => { accessPage(res, false, !!access.find(req.headers.cookie)); });
  app.post("/__staging/access",
    express.urlencoded({ extended: false, limit: "2kb", parameterLimit: 2 }),
    (req, res) => {
      if (!allowedOrigin(req, true)) {
        res.status(403).json({ error: "staging_origin_rejected" });
        return;
      }
      if (typeof req.body?.accessCode !== "string" || req.body.accessCode.length > 256) {
        res.status(400).json({ error: "staging_bad_request" });
        return;
      }
      const result = access.login(req.body.accessCode, req.socket.remoteAddress ?? "unknown");
      if (!result.token) {
        if (result.retryAfter) res.setHeader("Retry-After", result.retryAfter);
        res.status(result.retryAfter ? 429 : 401);
        accessPage(res, true);
        return;
      }
      res.setHeader("Set-Cookie",
        `${ACCESS_COOKIE}=${result.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ACCESS_TTL_MS / 1000}`);
      res.redirect(303, "/");
    },
  );
  app.post("/__staging/logout", (req, res) => {
    if (!allowedOrigin(req, true)) {
      res.status(403).json({ error: "staging_origin_rejected" });
      return;
    }
    const session = access.revoke(req.headers.cookie);
    if (session) for (const socket of activeSockets.get(session.id) ?? []) socket.destroy();
    res.setHeader("Set-Cookie",
      `${ACCESS_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    res.redirect(303, "/__staging/access");
  });
  app.use((req, res, next) => {
    if (!access.find(req.headers.cookie)) {
      if (req.path === "/api" || req.path.startsWith("/api/") || req.path === "/ws") {
        res.status(401).json({ error: "staging_access_required" });
      } else {
        res.status(401);
        accessPage(res);
      }
      return;
    }
    next();
  });

  function proxy(target: string) {
    return createProxyMiddleware<IncomingMessage, ServerResponse>({
      target,
      changeOrigin: true,
      // IMPORTANT: never auto-register an unguarded upgrade listener. Every
      // upgrade must pass the explicit access/origin check below.
      ws: false,
      xfwd: false,
      logger: undefined,
      on: {
        proxyReq(upstream, req) { prepareHeaders(upstream, req.headers.cookie); },
        proxyReqWs(upstream, req) { prepareHeaders(upstream, req.headers.cookie); },
        proxyRes(upstream) {
          upstream.headers["cache-control"] = "no-store";
          delete upstream.headers["x-powered-by"];
        },
        error(_error, _req, res) {
          if ("writeHead" in res) {
            if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json", "Cache-Control": "no-store" });
            res.end('{"error":"staging_upstream_unavailable"}');
          } else {
            res.destroy();
          }
        },
      },
    });
  }
  function prepareHeaders(
    upstream: { removeHeader(name: string): void; setHeader(name: string, value: string): void },
    cookie: string | undefined,
  ) {
    for (const name of HOP_HEADERS) upstream.removeHeader(name);
    upstream.setHeader("x-forwarded-host", publicUrl.host);
    upstream.setHeader("x-forwarded-proto", publicUrl.protocol.slice(0, -1));
    const filtered = stripAccessCookie(cookie);
    if (filtered) upstream.setHeader("cookie", filtered);
    else upstream.removeHeader("cookie");
  }
  const apiProxy = proxy(config.apiUpstream);
  const socketProxy = proxy(config.socketUpstream);
  app.use((req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) apiProxy(req, res, next);
    else next();
  });
  app.use(express.static(config.staticRoot, { index: false, redirect: false, dotfiles: "deny", cacheControl: false }));
  app.get("/{*path}", (req, res, next) => {
    if (path.extname(req.path) || !req.accepts("html")) { next(); return; }
    res.sendFile(path.join(config.staticRoot, "index.html"));
  });
  app.use((_error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    if (!res.headersSent) res.status(400).json({ error: "staging_bad_request" });
    else res.end();
  });
  server.on("upgrade", (req, socket, head) => {
    if (!(socket instanceof Socket)) { socket.destroy(); return; }
    const session = access.find(req.headers.cookie);
    const pathname = req.url?.split("?")[0];
    if (!allowedHost(req) || !allowedOrigin(req, true) || pathname !== "/ws" || !session) {
      socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    const sockets = activeSockets.get(session.id) ?? new Set<Duplex>();
    activeSockets.set(session.id, sockets);
    sockets.add(socket);
    const timer = setTimeout(() => socket.destroy(), Math.max(1, session.expiresAt - Date.now()));
    timer.unref();
    socket.once("close", () => {
      clearTimeout(timer);
      sockets.delete(socket);
      if (!sockets.size) activeSockets.delete(session.id);
    });
    socketProxy.upgrade(req, socket, head);
  });
  return {
    server,
    close: async () => {
      for (const sockets of activeSockets.values()) for (const socket of sockets) socket.destroy();
      server.closeAllConnections();
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
