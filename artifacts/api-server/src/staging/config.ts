export type StagingGatewayConfig = {
  publicOrigin: string;
  accessCode: string;
  apiUpstream: string;
  socketUpstream: string;
  staticRoot: string;
};

export function readStagingGatewayConfig(
  env: Record<string, string | undefined>,
  staticRoot: string,
): StagingGatewayConfig {
  if (env.STAGING_GATE_ENABLED !== "true") {
    throw new Error("STAGING_GATE_ENABLED must explicitly enable this staging-only server.");
  }
  const accessCode = env.STAGING_ACCESS_CODE;
  if (!accessCode || accessCode.length < 32 || accessCode.length > 256 || /[\r\n]/.test(accessCode)) {
    throw new Error("STAGING_ACCESS_CODE must contain 32–256 characters.");
  }
  function urlSetting(name: string, upstream: boolean) {
    let url: URL;
    try {
      url = new URL(env[name] ?? "");
    } catch {
      throw new Error(`${name} must be configured as an absolute URL.`);
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error(`${name} must not contain credentials, paths, queries, or fragments.`);
    }
    if (upstream) {
      if (url.protocol !== "http:" || !url.hostname.endsWith(".railway.internal")) {
        throw new Error(`${name} must use private Railway HTTP networking.`);
      }
    } else if (url.protocol !== "https:") {
      throw new Error("STAGING_PUBLIC_ORIGIN must use HTTPS.");
    }
    return url.origin;
  }
  return {
    accessCode,
    publicOrigin: urlSetting("STAGING_PUBLIC_ORIGIN", false),
    apiUpstream: urlSetting("STAGING_API_UPSTREAM", true),
    socketUpstream: urlSetting("STAGING_SOCKET_UPSTREAM", true),
    staticRoot,
  };
}
