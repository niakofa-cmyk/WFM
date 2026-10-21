type SocketEndpointOptions = {
  pageUrl: string;
  basePath: string;
  endpoint?: string;
};

/** Shared by initial joins and reconnects; never silently switches online hosts. */
export function resolveWingSocketUrl({ pageUrl, basePath, endpoint }: SocketEndpointOptions): URL {
  const page = new URL(pageUrl);
  const configured = endpoint?.trim();
  let target: URL;
  try {
    target = configured
      ? new URL(configured)
      : new URL(`${basePath.replace(/\/?$/, "/")}ws`, page);
  } catch {
    throw new Error("The match server address is invalid. Contact the game operator.");
  }
  if (!configured) target.protocol = page.protocol === "https:" ? "wss:" : "ws:";
  if (!["ws:", "wss:"].includes(target.protocol) || target.username || target.password || target.hash) {
    throw new Error("The match server must use a ws:// or wss:// address without credentials or fragments.");
  }
  if (page.protocol === "https:" && target.protocol !== "wss:") {
    throw new Error("This secure game page requires a wss:// match server.");
  }
  return target;
}

export function currentWingSocketUrl(): URL {
  return resolveWingSocketUrl({
    pageUrl: window.location.href,
    basePath: import.meta.env.BASE_URL,
    endpoint: import.meta.env.VITE_WING_SOCKET_URL,
  });
}
