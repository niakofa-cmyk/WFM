import { request } from "node:http";

/** Local fixtures need explicit Host headers, which fetch may silently replace. */
export function fixtureRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | URLSearchParams;
    redirect?: "manual";
  } = {},
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method ?? "GET", headers: options.headers }, res => {
      const chunks: Buffer[] = [];
      res.on("data", chunk => chunks.push(Buffer.from(chunk)));
      res.on("error", reject);
      res.on("end", () => {
        const headers = new Headers();
        for (let n = 0; n < res.rawHeaders.length; n += 2) {
          headers.append(res.rawHeaders[n], res.rawHeaders[n + 1]);
        }
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 500, headers }));
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("Local HTTP fixture timed out")));
    req.end(options.body?.toString());
  });
}
