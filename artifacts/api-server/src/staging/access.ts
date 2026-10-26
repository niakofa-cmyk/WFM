import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "__Host-wfm_staging";
export const ACCESS_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000;
const MAX_CLIENTS = 1000;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;

type Session = { id: string; expiresAt: number };
type Failure = { count: number; resetsAt: number };
const hash = (value: string) => createHash("sha256").update(value).digest();

/** Opaque, bounded, process-local access sessions. Gateway restarts revoke them. */
export function createStagingAccess(
  accessCode: string,
  now: () => number = Date.now,
  ttl = ACCESS_TTL_MS,
) {
  const expected = hash(accessCode);
  const sessions = new Map<string, Session>();
  const failures = new Map<string, Failure>();

  function prune() {
    for (const [id, session] of sessions) if (session.expiresAt <= now()) sessions.delete(id);
    for (const [id, failure] of failures) if (failure.resetsAt <= now()) failures.delete(id);
  }
  function sessionKey(cookie: string | undefined) {
    const values = (cookie ?? "").split(";").map(part => part.trim())
      .filter(part => part.startsWith(`${ACCESS_COOKIE}=`))
      .map(part => part.slice(ACCESS_COOKIE.length + 1));
    if (values.length !== 1 || !/^[a-f0-9]{64}$/.test(values[0])) return undefined;
    return hash(values[0]).toString("hex");
  }
  return {
    login(code: string, client: string) {
      prune();
      // Hash transport addresses rather than retaining IP strings. Do not trust
      // caller-supplied forwarding headers to bypass throttling.
      const clientKey = hash(client).toString("hex");
      const prior = failures.get(clientKey);
      if (prior && prior.count >= MAX_FAILURES) {
        return { retryAfter: Math.ceil((prior.resetsAt - now()) / 1000) };
      }
      if (!timingSafeEqual(hash(code), expected)) {
        if (failures.size >= MAX_CLIENTS && !prior) {
          // Fail closed when the bounded limiter is full instead of allowing
          // attacker churn to evict existing limits.
          return { retryAfter: Math.ceil(ATTEMPT_WINDOW_MS / 1000) };
        }
        failures.set(clientKey, {
          count: (prior?.count ?? 0) + 1,
          resetsAt: prior?.resetsAt ?? now() + ATTEMPT_WINDOW_MS,
        });
        return {};
      }
      failures.delete(clientKey);
      if (sessions.size >= MAX_SESSIONS) {
        return { retryAfter: 60 };
      }
      const token = randomBytes(32).toString("hex");
      const id = hash(token).toString("hex");
      const session = { id, expiresAt: now() + ttl };
      sessions.set(id, session);
      return { token, session };
    },
    find(cookie: string | undefined) {
      prune();
      const key = sessionKey(cookie);
      return key ? sessions.get(key) : undefined;
    },
    revoke(cookie: string | undefined) {
      const key = sessionKey(cookie);
      const session = key ? sessions.get(key) : undefined;
      if (key) sessions.delete(key);
      return session;
    },
  };
}

export function stripAccessCookie(cookie: string | undefined) {
  return (cookie ?? "").split(";").map(part => part.trim())
    .filter(part => part && !part.startsWith(`${ACCESS_COOKIE}=`)).join("; ");
}
