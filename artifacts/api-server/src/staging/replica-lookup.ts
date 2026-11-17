import { lookup } from "node:dns/promises";
import type { LookupAddress, LookupOptions } from "node:dns";
import type { LookupFunction } from "node:net";

type ResolveAddresses = (
  hostname: string,
  options: LookupOptions & { all: true },
) => Promise<LookupAddress[]>;

/** Rotate real service DNS addresses, never a client-supplied replica or URL. */
export function createReplicaLookup(resolve: ResolveAddresses = lookup): LookupFunction {
  let cursor = 0;
  return (hostname, options, callback) => {
    // Resolve on every new connection so removed/replaced replicas are not
    // pinned by an application cache. Already-open sockets stay untouched.
    void resolve(hostname, { ...options, all: true }).then(addresses => {
      const unique = [...new Map(addresses.map(a => [`${a.family}:${a.address}`, a])).values()]
        .sort((a, b) => a.family - b.family || a.address.localeCompare(b.address));
      if (!unique.length) {
        callback(Object.assign(new Error("Socket service has no DNS addresses"), { code: "ENOTFOUND" }), "");
        return;
      }
      const index = cursor++ % unique.length;
      const ordered = [...unique.slice(index), ...unique.slice(0, index)];
      if (options.all) callback(null, ordered);
      else callback(null, ordered[0].address, ordered[0].family);
    }, error => callback(error, ""));
  };
}
