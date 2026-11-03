export const CLIENT_RECONNECT_WINDOW_MS = 4_200;
export const SOCKET_HANDSHAKE_TIMEOUT_MS = 1_500;

const BASE_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 1_000;
const HANDSHAKE_MARGIN_MS = 150;

export function reconnectDelayMs(attempt: number, randomValue = Math.random()): number {
  const normalizedAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  const exponent = Math.min(normalizedAttempt, 3);
  const baseDelay = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** exponent);
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.max(0, Math.min(1, randomValue))
    : 0.5;
  return Math.round(baseDelay * (0.9 + normalizedRandom * 0.2));
}

/**
 * Return a retry delay only when another socket attempt can finish before the
 * server's short reconnect reservation expires.
 */
export function nextReconnectDelayMs(
  attempt: number,
  deadlineMs: number,
  nowMs: number,
  randomValue = Math.random(),
): number | null {
  const remainingMs = deadlineMs - nowMs;
  const requiredMs = SOCKET_HANDSHAKE_TIMEOUT_MS + HANDSHAKE_MARGIN_MS;
  if (!Number.isFinite(remainingMs) || remainingMs <= requiredMs) return null;

  return Math.min(
    reconnectDelayMs(attempt, randomValue),
    remainingMs - requiredMs,
  );
}
