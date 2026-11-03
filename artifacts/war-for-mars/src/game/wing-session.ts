export const WING_PROTOCOL_VERSION = 1;
export type SessionTokenProvider = () => Promise<string | null>;

export function roomSessionKey(roomId: string, userId: string) {
  return `wfm-room-v1-${encodeURIComponent(userId)}-${roomId.toUpperCase()}`;
}

export async function sendAuthenticatedJoin(
  socket: Pick<WebSocket, "readyState" | "send">,
  getSessionToken: SessionTokenProvider,
  name: string,
  reconnectToken?: string,
  isCurrent = () => true,
) {
  if (!isCurrent() || socket.readyState !== 1) return;
  const sessionToken = await getSessionToken();
  if (!isCurrent() || socket.readyState !== 1) return;
  if (!sessionToken) throw new Error("Sign in again before joining the wing.");
  socket.send(JSON.stringify({
    type: "join", protocol: WING_PROTOCOL_VERSION, name, sessionToken,
    ...(reconnectToken ? { reconnectToken } : {}),
  }));
}

export function terminalSocketError(reason: unknown) {
  return reason === "authentication_required" || reason === "authentication_failed" ||
    reason === "protocol_mismatch" || reason === "already_joined";
}
