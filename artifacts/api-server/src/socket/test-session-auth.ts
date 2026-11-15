import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import type { SocketSessionVerifier } from "./clerk-session-verifier";

export function createSocketTestAuth() {
  const sessions = new Map<string, string>();
  const verifySessionToken: SocketSessionVerifier = async (token) => {
    const playerId = sessions.get(token);
    if (!playerId) throw new Error("Synthetic socket session is not registered.");
    return playerId;
  };

  return {
    verifySessionToken,
    issueSession(playerId: string) {
      const token = randomUUID();
      sessions.set(token, playerId);
      return token;
    },
  };
}

export function waitForPacket(
  socket: WebSocket,
  accept: (packet: { type?: string; [key: string]: unknown }) => boolean,
  timeoutMs = 3000,
) {
  return new Promise<{ type?: string; [key: string]: unknown }>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for a synthetic WebSocket packet."));
    }, timeoutMs);
    const onMessage = (data: Buffer) => {
      try {
        const packet = JSON.parse(data.toString()) as { type?: string; [key: string]: unknown };
        if (accept(packet)) {
          cleanup();
          resolve(packet);
        }
      } catch {
        // Ignore malformed test packets.
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("message", onMessage);
    };
    socket.on("message", onMessage);
  });
}

export async function authenticateTestSocket(
  socket: WebSocket,
  auth: ReturnType<typeof createSocketTestAuth>,
  playerId: string,
) {
  const authenticated = waitForPacket(socket, (packet) => packet.type === "authenticated");
  socket.send(JSON.stringify({
    type: "authenticate",
    token: auth.issueSession(playerId),
  }));
  await authenticated;
}
