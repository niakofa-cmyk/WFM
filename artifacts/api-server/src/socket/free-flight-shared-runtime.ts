import { createHash, randomUUID } from "node:crypto";
import type {
  createFreeFlightRuntime,
  FreeFlightAdmission,
} from "./free-flight-runtime";

type Runtime = ReturnType<typeof createFreeFlightRuntime>;
export type FreeFlightSocket = {
  readyState: number;
  bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
};

export type FreeFlightRedisBus = {
  get(key: string): Promise<string | null>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
  publish(channel: string, message: string): Promise<unknown>;
  pSubscribe(
    pattern: string,
    listener: (message: string, channel: string) => void,
  ): Promise<unknown>;
  pUnsubscribe(pattern: string): Promise<unknown>;
  close(): Promise<void>;
};

type Owner = { instanceId: string; fencingToken: number };
type Command = {
  version: 1;
  type: "join" | "packet" | "disconnect" | "heartbeat";
  sessionKey: string;
  fencingToken: number;
  originInstanceId: string;
  connectionId: string;
  userId: string;
  packet?: Record<string, unknown>;
};
type Response = {
  version: 1;
  type: "packet" | "close";
  connectionId: string;
  data?: string;
  code?: number;
  reason?: string;
};
type ProxyRoute = {
  sessionKey: string;
  userId: string;
  connectionId: string;
  owner: Owner;
  lastOwnerCheckAt: number;
  joining: boolean;
  pendingPackets: Array<Record<string, unknown>>;
};
type LocalRoute = {
  sessionKey: string;
  userId: string;
  connectionId: string;
  owner: Owner;
};
type RemoteSocket = FreeFlightSocket & {
  connectionId: string;
  sessionKey: string;
  originInstanceId: string;
  userId: string;
  fencingToken: number;
  lastSeenAt: number;
  joined: boolean;
};

const LEASE_TTL_MS = 15_000;
const LEASE_RENEW_MS = 4_000;
const OWNER_CACHE_MS = 500;
const REMOTE_HEARTBEAT_MS = 5_000;
const REMOTE_TIMEOUT_MS = 20_000;
const OPEN = 1;
const CLOSE = 3;
const OWNER_PATTERN = /^[0-9a-f-]{36}\|[1-9][0-9]*$/i;
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
const CLAIM_SCRIPT = `
  if redis.call("EXISTS", KEYS[1]) ~= 0 then return false end
  local fence = redis.call("INCR", KEYS[2])
  local value = ARGV[1] .. "|" .. fence
  redis.call("PSETEX", KEYS[1], ARGV[2], value)
  return fence
`;
const RENEW_SCRIPT = `
  if redis.call("GET", KEYS[1]) ~= ARGV[1] then return 0 end
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
`;
const RELEASE_SCRIPT = `
  if redis.call("GET", KEYS[1]) ~= ARGV[1] then return 0 end
  return redis.call("DEL", KEYS[1])
`;
const CLAIM_USER_SCRIPT = `
  local existing = redis.call("GET", KEYS[1])
  if not existing then
    redis.call("PSETEX", KEYS[1], ARGV[2], ARGV[1])
    return 1
  end
  local oldSession, oldOwner, oldFence = string.match(existing, "([^|]+)|([^|]+)|([0-9]+)|")
  local newSession, newOwner, newFence = string.match(ARGV[1], "([^|]+)|([^|]+)|([0-9]+)|")
  if oldSession == newSession and
      ((oldOwner == newOwner and oldFence == newFence) or tonumber(oldFence) < tonumber(newFence)) then
    redis.call("PSETEX", KEYS[1], ARGV[2], ARGV[1])
    return 1
  end
  return 0
`;
const RENEW_USER_SCRIPT = `
  if redis.call("GET", KEYS[1]) ~= ARGV[1] then return 0 end
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
`;
const RELEASE_USER_SCRIPT = `
  if redis.call("GET", KEYS[1]) ~= ARGV[1] then return 0 end
  return redis.call("DEL", KEYS[1])
`;

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const leaseKey = (key: string) => `wfm:freeflight:lease:${digest(key)}`;
const fenceKey = (key: string) => `wfm:freeflight:fence:${digest(key)}`;
const userLeaseKey = (userId: string) => `wfm:freeflight:user:${digest(userId)}`;
const commandChannel = (key: string) => `wfm:freeflight:commands:${digest(key)}`;
const responseChannel = (instanceId: string) => `wfm:freeflight:responses:${instanceId}`;
const ownerValue = (owner: Owner) => `${owner.instanceId}|${owner.fencingToken}`;
const userLeaseValue = (
  sessionKey: string,
  owner: Owner,
  connectionId: string,
) => `${digest(sessionKey)}|${owner.instanceId}|${owner.fencingToken}|${connectionId}`;

function parseOwner(value: string | null): Owner | null {
  if (!value || !OWNER_PATTERN.test(value)) return null;
  const separator = value.lastIndexOf("|");
  const fencingToken = Number(value.slice(separator + 1));
  if (!Number.isSafeInteger(fencingToken) || fencingToken <= 0) return null;
  return { instanceId: value.slice(0, separator), fencingToken };
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCommand(message: string): Command | null {
  try {
    const value: unknown = JSON.parse(message);
    if (!object(value) || value.version !== 1 ||
        !["join", "packet", "disconnect", "heartbeat"].includes(String(value.type)) ||
        typeof value.sessionKey !== "string" || value.sessionKey.length < 2 ||
        value.sessionKey.length > 128 || !Number.isSafeInteger(value.fencingToken) ||
        (value.fencingToken as number) <= 0 ||
        typeof value.originInstanceId !== "string" || !UUID_PATTERN.test(value.originInstanceId) ||
        typeof value.connectionId !== "string" || !UUID_PATTERN.test(value.connectionId) ||
        typeof value.userId !== "string" || value.userId.length < 1 ||
        value.userId.length > 256 ||
        (value.packet !== undefined && !object(value.packet))) return null;
    return value as unknown as Command;
  } catch {
    return null;
  }
}

function parseResponse(message: string): Response | null {
  try {
    const value: unknown = JSON.parse(message);
    if (!object(value) || value.version !== 1 ||
        (value.type !== "packet" && value.type !== "close") ||
        typeof value.connectionId !== "string" || !UUID_PATTERN.test(value.connectionId) ||
        (value.type === "packet" && typeof value.data !== "string") ||
        (value.type === "close" &&
          (value.code !== undefined && !Number.isInteger(value.code) ||
            value.reason !== undefined && typeof value.reason !== "string"))) return null;
    return value as unknown as Response;
  } catch {
    return null;
  }
}

function safeClose(socket: FreeFlightSocket, code: number, reason: string) {
  try {
    if (socket.readyState === OPEN) socket.close(code, reason);
  } catch {
    // The WebSocket close event owns cleanup.
  }
}

/**
 * Routes every spatial shard to one fenced simulation owner. Redis Pub/Sub is
 * transport only; PostgreSQL checkpoints remain the durable source of state.
 */
export async function createFreeFlightSharedRuntime(options: {
  runtime: Runtime;
  bus: FreeFlightRedisBus;
  resolveAdmission: (userId: string) => Promise<FreeFlightAdmission | null>;
  instanceId?: string;
}) {
  const { runtime, bus, resolveAdmission } = options;
  const instanceId = options.instanceId ?? randomUUID();
  if (!UUID_PATTERN.test(instanceId)) throw new Error("Invalid free-flight server identity.");

  const owners = new Map<string, Owner>();
  const ownerCheckedAt = new Map<string, number>();
  const localSockets = new Map<FreeFlightSocket, LocalRoute>();
  const proxyRoutes = new Map<FreeFlightSocket, ProxyRoute>();
  const routeSockets = new Map<string, FreeFlightSocket>();
  const remoteSockets = new Map<string, RemoteSocket>();
  const ownerCommandPattern = "wfm:freeflight:commands:*";
  const ownResponseChannel = responseChannel(instanceId);
  let closing = false;
  let closed = false;

  async function publish(channel: string, value: unknown) {
    if (closed) return;
    await bus.publish(channel, JSON.stringify(value));
  }

  async function sendCommand(owner: Owner, command: Omit<Command, "version" | "fencingToken">) {
    await publish(commandChannel(command.sessionKey), {
      ...command,
      version: 1,
      fencingToken: owner.fencingToken,
    });
  }

  async function claim(sessionKey: string): Promise<Owner | null> {
    const result = await bus.eval(CLAIM_SCRIPT, {
      keys: [leaseKey(sessionKey), fenceKey(sessionKey)],
      arguments: [instanceId, String(LEASE_TTL_MS)],
    });
    const fencingToken = Number(result);
    if (!Number.isSafeInteger(fencingToken) || fencingToken <= 0) return null;
    const owner = { instanceId, fencingToken };
    owners.set(sessionKey, owner);
    ownerCheckedAt.set(sessionKey, Date.now());
    runtime.setFencingToken(sessionKey, fencingToken);
    return owner;
  }

  async function resolveOwner(sessionKey: string): Promise<Owner | null> {
    const known = owners.get(sessionKey);
    const now = Date.now();
    if (known && now - (ownerCheckedAt.get(sessionKey) ?? 0) < OWNER_CACHE_MS) return known;
    const actual = parseOwner(await bus.get(leaseKey(sessionKey)));
    if (actual?.instanceId === instanceId && known?.fencingToken === actual.fencingToken) {
      ownerCheckedAt.set(sessionKey, now);
      return actual;
    }
    if (known) {
      owners.delete(sessionKey);
      ownerCheckedAt.delete(sessionKey);
      dropOwnedSession(sessionKey);
    }
    if (actual) return actual;
    const claimed = await claim(sessionKey);
    if (claimed) return claimed;
    return parseOwner(await bus.get(leaseKey(sessionKey)));
  }

  function isCurrentOwner(sessionKey: string, fencingToken: number) {
    return owners.get(sessionKey)?.fencingToken === fencingToken;
  }

  async function claimUserSeat(
    sessionKey: string,
    owner: Owner,
    userId: string,
    connectionId: string,
  ): Promise<boolean> {
    const value = userLeaseValue(sessionKey, owner, connectionId);
    const result = await bus.eval(CLAIM_USER_SCRIPT, {
      keys: [userLeaseKey(userId)],
      arguments: [value, String(LEASE_TTL_MS)],
    });
    return Number(result) === 1;
  }

  function releaseUserSeat(sessionKey: string, owner: Owner, userId: string, connectionId: string) {
    void bus.eval(RELEASE_USER_SCRIPT, {
      keys: [userLeaseKey(userId)],
      arguments: [userLeaseValue(sessionKey, owner, connectionId)],
    }).catch(() => {});
  }

  async function renewUserSeat(sessionKey: string, owner: Owner, userId: string, connectionId: string) {
    const result = await bus.eval(RENEW_USER_SCRIPT, {
      keys: [userLeaseKey(userId)],
      arguments: [userLeaseValue(sessionKey, owner, connectionId), String(LEASE_TTL_MS)],
    });
    return Number(result) === 1;
  }

  function dropOwnedSession(sessionKey: string) {
    for (const remote of [...remoteSockets.values()]) {
      if (remote.sessionKey !== sessionKey) continue;
      closeRemote(remote, 1012, "Free-flight session owner changed");
    }
    for (const [socket, route] of [...localSockets]) {
      if (route.sessionKey !== sessionKey) continue;
      localSockets.delete(socket);
      releaseUserSeat(route.sessionKey, route.owner, route.userId, route.connectionId);
      safeClose(socket, 1012, "Free-flight session owner changed");
    }
    runtime.relinquishSession(sessionKey);
  }

  function sendResponse(remote: RemoteSocket, response: Response) {
    void publish(responseChannel(remote.originInstanceId), response).catch(() => {
      remote.close(CLOSE, "Shared flight transport unavailable");
    });
  }

  function closeRemote(remote: RemoteSocket, code = 1001, reason = "Remote pilot disconnected") {
    if (remote.readyState !== OPEN) return;
    remote.readyState = CLOSE;
    remoteSockets.delete(remote.connectionId);
    runtime.detach(remote);
    releaseUserSeat(remote.sessionKey, {
      instanceId,
      fencingToken: remote.fencingToken,
    }, remote.userId, remote.connectionId);
    sendResponse(remote, {
      version: 1, type: "close", connectionId: remote.connectionId, code, reason,
    });
  }

  function createRemoteSocket(command: Command): RemoteSocket {
    const remote: RemoteSocket = {
      readyState: OPEN,
      bufferedAmount: 0,
      connectionId: command.connectionId,
      sessionKey: command.sessionKey,
      originInstanceId: command.originInstanceId,
      userId: command.userId,
      fencingToken: command.fencingToken,
      lastSeenAt: Date.now(),
      joined: false,
      send(data: string) {
        if (this.readyState !== OPEN) return;
        try {
          const packet = JSON.parse(data) as { type?: unknown };
          if (packet.type === "freeflight_joined") this.joined = true;
          else if (packet.type === "error" && !this.joined) {
            setTimeout(() => closeRemote(this, 1008, "Free-flight join failed"), 20).unref();
          }
        } catch {
          // The game runtime controls packet serialization.
        }
        sendResponse(this, {
          version: 1, type: "packet", connectionId: this.connectionId, data,
        });
      },
      close(code = 1001, reason = "Remote pilot disconnected") {
        closeRemote(this, code, reason);
      },
    };
    return remote;
  }

  async function onCommand(message: string, channel: string) {
    if (closed) return;
    const command = parseCommand(message);
    if (!command || channel !== commandChannel(command.sessionKey)) return;
    let verifiedOwner: Owner | null;
    try {
      verifiedOwner = await resolveOwner(command.sessionKey);
    } catch {
      verifiedOwner = null;
    }
    if (!verifiedOwner || verifiedOwner.instanceId !== instanceId ||
        verifiedOwner.fencingToken !== command.fencingToken ||
        !isCurrentOwner(command.sessionKey, command.fencingToken)) return;
    if (command.type === "join") {
      if (command.originInstanceId === instanceId || remoteSockets.has(command.connectionId)) return;
      let admission: FreeFlightAdmission | null;
      try {
        admission = await resolveAdmission(command.userId);
      } catch {
        admission = null;
      }
      if (!admission || admission.sessionKey !== command.sessionKey ||
          !isCurrentOwner(command.sessionKey, command.fencingToken)) {
        await publish(responseChannel(command.originInstanceId), {
          version: 1, type: "packet", connectionId: command.connectionId,
          data: JSON.stringify({ type: "error", reason: "freeflight_not_authorized" }),
        } satisfies Response).catch(() => {});
        return;
      }
      const owner = { instanceId, fencingToken: command.fencingToken };
      if (!await claimUserSeat(
        command.sessionKey, owner, command.userId, command.connectionId,
      )) {
        await publish(responseChannel(command.originInstanceId), {
          version: 1, type: "packet", connectionId: command.connectionId,
          data: JSON.stringify({ type: "error", reason: "freeflight_session_already_active" }),
        } satisfies Response).catch(() => {});
        await publish(responseChannel(command.originInstanceId), {
          version: 1, type: "close", connectionId: command.connectionId,
          code: 1008, reason: "Pilot already has an active free-flight seat",
        } satisfies Response).catch(() => {});
        return;
      }
      const remote = createRemoteSocket(command);
      remoteSockets.set(remote.connectionId, remote);
      void runtime.handle(remote, command.userId, { type: "freeflight_join" })
        .then(() => {
          if (!runtime.hasUser(command.userId)) {
            closeRemote(remote, 1008, "Free-flight join failed");
          }
        }).catch(() => {
          remote.send(JSON.stringify({ type: "error", reason: "freeflight_service_unavailable" }));
          closeRemote(remote, 1011, "Free-flight owner failed");
        });
      return;
    }
    const remote = remoteSockets.get(command.connectionId);
    if (!remote || remote.sessionKey !== command.sessionKey ||
        remote.originInstanceId !== command.originInstanceId ||
        remote.userId !== command.userId ||
        remote.fencingToken !== command.fencingToken ||
        remote.readyState !== OPEN) return;
    remote.lastSeenAt = Date.now();
    if (command.type === "heartbeat") return;
    if (command.type === "disconnect") {
      closeRemote(remote);
      return;
    }
    if (command.packet) {
      void runtime.handle(remote, command.userId, command.packet).catch(() => {
        remote.send(JSON.stringify({ type: "error", reason: "freeflight_service_unavailable" }));
      });
    }
  }

  async function onResponse(message: string) {
    if (closed) return;
    const response = parseResponse(message);
    if (!response) return;
    const socket = routeSockets.get(response.connectionId);
    if (!socket) return;
    if (response.type === "close") {
      routeSockets.delete(response.connectionId);
      proxyRoutes.delete(socket);
      safeClose(socket, response.code ?? 1001, response.reason ?? "Shared flight session ended");
      return;
    }
    if (socket.readyState !== OPEN) return;
    if (socket.bufferedAmount > 1_048_576) {
      proxyRoutes.delete(socket);
      safeClose(socket, 1013, "Shared flight client cannot keep up");
      return;
    }
    try {
      const route = proxyRoutes.get(socket);
      if (route) {
        let packet: unknown;
        try { packet = JSON.parse(response.data!); } catch { packet = null; }
        if (object(packet) && packet.type === "freeflight_joined" && route.joining) {
          route.joining = false;
          for (const pending of route.pendingPackets.splice(0)) {
            await sendCommand(route.owner, {
              type: "packet", sessionKey: route.sessionKey,
              originInstanceId: instanceId, connectionId: route.connectionId,
              userId: route.userId, packet: pending,
            });
          }
        }
      }
      socket.send(response.data!);
    } catch {
      routeSockets.delete(response.connectionId);
      proxyRoutes.delete(socket);
      safeClose(socket, 1011, "Shared flight transport failed");
    }
  }

  await Promise.all([
    bus.pSubscribe(ownerCommandPattern, (message, channel) => { void onCommand(message, channel); }),
    bus.pSubscribe(ownResponseChannel, (message) => { void onResponse(message); }),
  ]);

  async function routeToOwner(
    socket: FreeFlightSocket,
    sessionKey: string,
    userId: string,
    packet: Record<string, unknown>,
    owner: Owner,
    existing?: ProxyRoute,
  ) {
    const route: ProxyRoute = existing ?? {
      sessionKey, userId, connectionId: randomUUID(), owner, lastOwnerCheckAt: Date.now(),
      joining: false, pendingPackets: [],
    };
    const ownerChanged = !existing ||
      existing.owner.fencingToken !== owner.fencingToken ||
      existing.owner.instanceId !== owner.instanceId;
    route.owner = owner;
    route.lastOwnerCheckAt = Date.now();
    proxyRoutes.set(socket, route);
    routeSockets.set(route.connectionId, socket);
    if (ownerChanged) {
      route.joining = true;
      await sendCommand(owner, {
        type: "join", sessionKey, originInstanceId: instanceId,
        connectionId: route.connectionId, userId,
      });
    }
    if (packet.type !== "freeflight_join") {
      if (route.joining) {
        if (route.pendingPackets.length >= 16) {
          routeSockets.delete(route.connectionId);
          proxyRoutes.delete(socket);
          safeClose(socket, 1013, "Free-flight reconnect is catching up");
        } else route.pendingPackets.push(packet);
      } else {
        await sendCommand(owner, {
          type: "packet", sessionKey, originInstanceId: instanceId,
          connectionId: route.connectionId, userId, packet,
        });
      }
    }
  }

  async function handle(socket: FreeFlightSocket, userId: string, packet: Record<string, unknown>) {
    if (closing || closed) {
      socket.close(1012, "Shared flight runtime is shutting down");
      return;
    }
    const proxy = proxyRoutes.get(socket);
    const localRoute = localSockets.get(socket);
    if (proxy) {
      const owner = await resolveOwner(proxy.sessionKey);
      if (!owner) {
        proxyRoutes.delete(socket);
        safeClose(socket, 1013, "Shared flight owner unavailable");
        return;
      }
      if (owner.instanceId !== instanceId ||
          owner.fencingToken !== proxy.owner.fencingToken) {
        await routeToOwner(socket, proxy.sessionKey, userId, packet, owner, proxy);
      } else if (proxy.joining) {
        if (proxy.pendingPackets.length >= 16) {
          routeSockets.delete(proxy.connectionId);
          proxyRoutes.delete(socket);
          safeClose(socket, 1013, "Free-flight reconnect is catching up");
        } else proxy.pendingPackets.push(packet);
      } else {
        proxy.lastOwnerCheckAt = Date.now();
        await sendCommand(owner, {
          type: "packet", sessionKey: proxy.sessionKey, originInstanceId: instanceId,
          connectionId: proxy.connectionId, userId, packet,
        });
      }
      return;
    }
    if (localRoute) {
      const owner = await resolveOwner(localRoute.sessionKey);
      if (owner?.instanceId === instanceId &&
          owner.fencingToken === localRoute.owner.fencingToken) {
        await runtime.handle(socket, userId, packet);
      } else {
        localSockets.delete(socket);
        safeClose(socket, 1012, "Free-flight session owner changed; reconnect to resume");
      }
      return;
    }
    if (packet.type !== "freeflight_join") {
      socket.send(JSON.stringify({ type: "error", reason: "freeflight_join_required" }));
      return;
    }
    let admission: FreeFlightAdmission | null;
    try {
      admission = await resolveAdmission(userId);
    } catch {
      admission = null;
    }
    if (!admission) {
      socket.send(JSON.stringify({ type: "error", reason: "freeflight_not_authorized" }));
      return;
    }
    const owner = await resolveOwner(admission.sessionKey);
    if (!owner) {
      socket.send(JSON.stringify({ type: "error", reason: "freeflight_owner_unavailable" }));
      return;
    }
    if (owner.instanceId === instanceId) {
      const connectionId = randomUUID();
      if (!await claimUserSeat(admission.sessionKey, owner, userId, connectionId)) {
        socket.send(JSON.stringify({ type: "error", reason: "freeflight_session_already_active" }));
        socket.close(1008, "Pilot already has an active free-flight seat");
        return;
      }
      localSockets.set(socket, {
        sessionKey: admission.sessionKey, userId, connectionId, owner,
      });
      await runtime.handle(socket, userId, packet);
      if (!runtime.hasUser(userId)) {
        localSockets.delete(socket);
        releaseUserSeat(admission.sessionKey, owner, userId, connectionId);
      }
      return;
    }
    await routeToOwner(socket, admission.sessionKey, userId, packet, owner);
  }

  function detach(socket: FreeFlightSocket | null) {
    if (!socket) return;
    const route = proxyRoutes.get(socket);
    if (route) {
      proxyRoutes.delete(socket);
      routeSockets.delete(route.connectionId);
      void sendCommand(route.owner, {
        type: "disconnect", sessionKey: route.sessionKey, originInstanceId: instanceId,
        connectionId: route.connectionId, userId: route.userId,
      }).catch(() => {});
      return;
    }
    const local = localSockets.get(socket);
    if (local) {
      localSockets.delete(socket);
      releaseUserSeat(local.sessionKey, local.owner, local.userId, local.connectionId);
    }
    runtime.detach(socket);
  }

  const renewTimer = setInterval(() => {
    for (const [sessionKey, owner] of owners) {
      void bus.eval(RENEW_SCRIPT, {
        keys: [leaseKey(sessionKey)],
        arguments: [ownerValue(owner), String(LEASE_TTL_MS)],
      }).then((result) => {
        if (Number(result) === 1) {
          ownerCheckedAt.set(sessionKey, Date.now());
          for (const [socket, route] of localSockets) {
            if (route.sessionKey !== sessionKey) continue;
            void renewUserSeat(
              route.sessionKey, route.owner, route.userId, route.connectionId,
            ).then((renewed) => {
              if (!renewed && localSockets.has(socket)) {
                localSockets.delete(socket);
                safeClose(socket, 1012, "Free-flight pilot lease expired");
              }
            }).catch(() => safeClose(socket, 1013, "Free-flight presence unavailable"));
          }
          for (const remote of remoteSockets.values()) {
            if (remote.sessionKey !== sessionKey) continue;
            void renewUserSeat(
              remote.sessionKey, { instanceId, fencingToken: remote.fencingToken },
              remote.userId, remote.connectionId,
            ).then((renewed) => {
              if (!renewed) closeRemote(remote, 1012, "Free-flight pilot lease expired");
            }).catch(() => closeRemote(remote, 1013, "Free-flight presence unavailable"));
          }
          return;
        }
        owners.delete(sessionKey);
        ownerCheckedAt.delete(sessionKey);
        dropOwnedSession(sessionKey);
      }).catch(() => {
        owners.delete(sessionKey);
        ownerCheckedAt.delete(sessionKey);
        dropOwnedSession(sessionKey);
      });
    }
    const now = Date.now();
    for (const remote of remoteSockets.values()) {
      if (now - remote.lastSeenAt > REMOTE_TIMEOUT_MS) {
        closeRemote(remote, 1001, "Remote pilot heartbeat expired");
      }
    }
    for (const [socket, route] of proxyRoutes) {
      if (now - route.lastOwnerCheckAt >= REMOTE_HEARTBEAT_MS) {
        void (async () => {
          const owner = await resolveOwner(route.sessionKey);
          if (owner && (owner.instanceId !== route.owner.instanceId ||
              owner.fencingToken !== route.owner.fencingToken)) {
            await routeToOwner(
              socket, route.sessionKey, route.userId,
              { type: "freeflight_join" }, owner, route,
            );
          } else if (owner) {
            await sendCommand(owner, {
              type: "heartbeat", sessionKey: route.sessionKey,
              originInstanceId: instanceId, connectionId: route.connectionId,
              userId: route.userId,
            });
          } else safeClose(socket, 1013, "Shared flight owner unavailable");
          route.lastOwnerCheckAt = now;
        })().catch(() => safeClose(socket, 1013, "Shared flight transport unavailable"));
      }
    }
  }, LEASE_RENEW_MS);
  renewTimer.unref();

  return {
    handle,
    detach,
    advance(now?: number) { runtime.advance(now); },
    get sessionCount() { return runtime.sessionCount; },
    get pilotCount() { return runtime.pilotCount; },
    async close() {
      if (closing || closed) return;
      closing = true;
      clearInterval(renewTimer);
      let checkpointsFlushed = false;
      try {
        await runtime.close();
        checkpointsFlushed = true;
      } finally {
        const proxyDisconnects = [...proxyRoutes.entries()].map(async ([socket, route]) => {
          await sendCommand(route.owner, {
            type: "disconnect", sessionKey: route.sessionKey,
            originInstanceId: instanceId, connectionId: route.connectionId,
            userId: route.userId,
          }).catch(() => {});
          safeClose(socket, 1012, "Shared flight runtime is shutting down");
        });
        await Promise.allSettled(proxyDisconnects);
        for (const route of localSockets.values()) {
          releaseUserSeat(route.sessionKey, route.owner, route.userId, route.connectionId);
        }
        if (checkpointsFlushed) {
          await Promise.all([...owners].map(async ([sessionKey, owner]) => {
            await bus.eval(RELEASE_SCRIPT, {
              keys: [leaseKey(sessionKey)],
              arguments: [ownerValue(owner)],
            }).catch(() => {});
          }));
        }
        closed = true;
        owners.clear();
        proxyRoutes.clear();
        routeSockets.clear();
        localSockets.clear();
        remoteSockets.clear();
        await Promise.all([
          bus.pUnsubscribe(ownerCommandPattern),
          bus.pUnsubscribe(ownResponseChannel),
        ]).catch(() => {});
        await bus.close();
      }
    },
  };
}
