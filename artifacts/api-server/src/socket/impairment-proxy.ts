import { createServer } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";

export type NetworkImpairmentConfig = {
  latencyMs: number;
  jitterMs: number;
  frameLossRate: number;
  seed: number;
};

type Direction = "clientToServer" | "serverToClient";
type DirectionMetrics = {
  forwarded: number;
  dropped: number;
  delaySamples: number;
  totalDelayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
};
type PendingFrame = { data: RawData; isBinary: boolean };

function emptyMetrics(): DirectionMetrics {
  return {
    forwarded: 0,
    dropped: 0,
    delaySamples: 0,
    totalDelayMs: 0,
    minDelayMs: Number.POSITIVE_INFINITY,
    maxDelayMs: 0,
  };
}

function textFrom(data: RawData) {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return Buffer.from(data).toString("utf8");
}

function packetType(data: RawData, isBinary: boolean): string | null {
  if (isBinary) return null;
  try {
    const parsed = JSON.parse(textFrom(data)) as { type?: unknown };
    return typeof parsed.type === "string" ? parsed.type : null;
  } catch {
    return null;
  }
}

export async function startNetworkImpairmentProxy(
  upstreamBaseUrl: string,
  config: NetworkImpairmentConfig,
) {
  const upstreamBase = new URL(upstreamBaseUrl);
  if (upstreamBase.protocol !== "ws:" && upstreamBase.protocol !== "wss:") {
    throw new Error("The impairment proxy upstream must use ws:// or wss://.");
  }
  if (
    !Number.isFinite(config.latencyMs) ||
    config.latencyMs < 0 ||
    !Number.isFinite(config.jitterMs) ||
    config.jitterMs < 0 ||
    !Number.isFinite(config.frameLossRate) ||
    config.frameLossRate < 0 ||
    config.frameLossRate > 1 ||
    !Number.isSafeInteger(config.seed)
  ) {
    throw new Error("Invalid network impairment configuration.");
  }

  const metrics: Record<Direction, DirectionMetrics> = {
    clientToServer: emptyMetrics(),
    serverToClient: emptyMetrics(),
  };
  const scheduled = new Set<NodeJS.Timeout>();
  const upstreams = new Set<WebSocket>();
  let randomState = config.seed >>> 0 || 0x6d2b79f5;
  let closing = false;

  const random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 0x1_0000_0000;
  };
  const delayFor = () =>
    Math.max(0, Math.round(config.latencyMs + (random() * 2 - 1) * config.jitterMs));

  const server = createServer((_request, response) => {
    response.writeHead(404).end();
  });
  const webSockets = new WebSocketServer({
    noServer: true,
    maxPayload: 8 * 1024,
    perMessageDeflate: false,
  });

  const relay = (data: RawData, isBinary: boolean, direction: Direction, target: WebSocket) => {
    const stats = metrics[direction];
    const type = packetType(data, isBinary);
    const eligibleForFrameLoss =
      (direction === "clientToServer" && type === "input") ||
      (direction === "serverToClient" && type === "snapshot");
    if (eligibleForFrameLoss && random() < config.frameLossRate) {
      stats.dropped += 1;
      return;
    }

    const delayMs = delayFor();
    stats.delaySamples += 1;
    stats.totalDelayMs += delayMs;
    stats.minDelayMs = Math.min(stats.minDelayMs, delayMs);
    stats.maxDelayMs = Math.max(stats.maxDelayMs, delayMs);
    const timer = setTimeout(() => {
      scheduled.delete(timer);
      if (target.readyState !== WebSocket.OPEN) return;
      target.send(data, { binary: isBinary });
      stats.forwarded += 1;
    }, delayMs);
    scheduled.add(timer);
  };

  server.on("upgrade", (request, rawSocket, head) => {
    if (closing) {
      rawSocket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
      rawSocket.destroy();
      return;
    }
    let targetUrl: URL;
    try {
      targetUrl = new URL(request.url ?? "/", upstreamBase);
    } catch {
      rawSocket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      rawSocket.destroy();
      return;
    }
    if (targetUrl.origin !== upstreamBase.origin) {
      rawSocket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      rawSocket.destroy();
      return;
    }

    webSockets.handleUpgrade(request, rawSocket, head, (downstream) => {
      const upstream = new WebSocket(targetUrl);
      upstreams.add(upstream);
      const pending: PendingFrame[] = [];

      downstream.on("message", (data, isBinary) => {
        if (upstream.readyState !== WebSocket.OPEN) {
          if (upstream.readyState === WebSocket.CONNECTING) pending.push({ data, isBinary });
          return;
        }
        relay(data, isBinary, "clientToServer", upstream);
      });
      upstream.on("open", () => {
        for (const frame of pending.splice(0)) {
          relay(frame.data, frame.isBinary, "clientToServer", upstream);
        }
      });
      upstream.on("message", (data, isBinary) => {
        relay(data, isBinary, "serverToClient", downstream);
      });
      upstream.on("error", () => {
        if (downstream.readyState === WebSocket.OPEN) downstream.close(1011, "Upstream unavailable");
      });
      downstream.on("error", () => upstream.terminate());
      downstream.on("close", () => {
        upstreams.delete(upstream);
        upstream.terminate();
      });
      upstream.on("close", (code, reason) => {
        upstreams.delete(upstream);
        if (downstream.readyState === WebSocket.OPEN) {
          const details = reason.length ? `: ${reason.toString()}` : "";
          downstream.close(1011, `Upstream closed (${code}${details})`);
        }
      });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Network impairment proxy failed to bind.");

  return {
    port: address.port,
    get metrics() {
      const snapshot = (direction: Direction): DirectionMetrics => {
        const value = metrics[direction];
        return {
          ...value,
          minDelayMs: Number.isFinite(value.minDelayMs) ? value.minDelayMs : 0,
        };
      };
      return {
        clientToServer: snapshot("clientToServer"),
        serverToClient: snapshot("serverToClient"),
      };
    },
    async close() {
      closing = true;
      for (const timer of scheduled) clearTimeout(timer);
      scheduled.clear();
      for (const downstream of webSockets.clients) downstream.terminate();
      for (const upstream of upstreams) upstream.terminate();
      upstreams.clear();
      await new Promise<void>((resolve) => webSockets.close(() => resolve()));
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
