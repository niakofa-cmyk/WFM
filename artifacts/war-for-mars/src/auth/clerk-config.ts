/** External hosting must use the selected instance, never a hostname-derived key. */
export function configuredClerkPublishableKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
  return key;
}

/**
 * Development Clerk sessions use the Development Frontend API directly.
 * Never route them through a proxy configured for another hosted environment.
 */
export function clerkProxyUrlForEnvironment(
  isDevelopment: boolean,
  configuredUrl: string | undefined,
): string | undefined {
  if (isDevelopment) return undefined;
  return configuredUrl?.trim() || undefined;
}

/** Keep completed authentication inside this game's mounted entry route. */
export function gameAuthReturnUrl(basePath: string): string {
  const base = basePath.trim().replace(/\/+$/, "");
  if (base && (!base.startsWith("/") || base.startsWith("//") || /[?#\\]/.test(base))) {
    throw new Error("Invalid game base path.");
  }
  return `${base}/`;
}
