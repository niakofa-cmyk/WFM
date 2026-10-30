/** Deployment allowlist, not player authentication or an anti-cheat mechanism. */
export function parseSocketOrigins(value: string | undefined): ReadonlySet<string> | undefined {
  if (!value?.trim()) return undefined;
  const origins = value.split(",").map((entry) => {
    let url: URL;
    try {
      url = new URL(entry.trim());
    } catch {
      throw new Error("WING_ALLOWED_ORIGINS must contain comma-separated HTTP(S) origins.");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("WING_ALLOWED_ORIGINS must contain origins only, without paths or credentials.");
    }
    return url.origin;
  });
  return new Set(origins);
}

export function socketOriginAllowed(origin: string | undefined, allowed?: ReadonlySet<string>): boolean {
  return allowed === undefined || (origin !== undefined && allowed.has(origin));
}
