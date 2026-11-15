import type { CorsOptions } from "cors";

export function parseApiAllowedOrigins(
  value: string | undefined,
): ReadonlySet<string> | undefined {
  if (!value?.trim()) return undefined;

  const origins = value.split(",").map((entry) => {
    let url: URL;
    try {
      url = new URL(entry.trim());
    } catch {
      throw new Error(
        "API_ALLOWED_ORIGINS must contain comma-separated HTTP(S) origins.",
      );
    }

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "API_ALLOWED_ORIGINS must contain origins only, without paths or credentials.",
      );
    }
    return url.origin;
  });

  return new Set(origins);
}

export function isApiOriginAllowed(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string> | undefined,
  isProduction: boolean,
): boolean {
  if (!origin) return true;
  if (!allowedOrigins) return !isProduction;
  return allowedOrigins.has(origin);
}

export function createApiCorsOrigin(
  nodeEnv: string | undefined,
  allowedOriginsValue: string | undefined,
): NonNullable<CorsOptions["origin"]> {
  const isProduction = nodeEnv === "production";
  const allowedOrigins = parseApiAllowedOrigins(allowedOriginsValue);

  if (isProduction && !allowedOrigins?.size) {
    throw new Error(
      "API_ALLOWED_ORIGINS must be configured before running the API in production.",
    );
  }

  return (origin, callback) => {
    callback(
      null,
      isApiOriginAllowed(origin, allowedOrigins, isProduction),
    );
  };
}
