import type { ClerkMiddlewareOptions } from "@clerk/express";

/**
 * The API serves one configured Clerk instance, independently of its HTTP host.
 * Deriving a Production key from a Railway or forwarded hostname selects the
 * wrong Frontend API and can reject the game's otherwise valid session token.
 */
export function apiClerkOptions(
  publishableKey: string | undefined,
): ClerkMiddlewareOptions {
  return { publishableKey };
}
