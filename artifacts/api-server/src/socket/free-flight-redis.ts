import { createClient } from "redis";
import type { FreeFlightRedisBus } from "./free-flight-shared-runtime";

export async function connectFreeFlightRedis(url: string): Promise<FreeFlightRedisBus> {
  if (!url.startsWith("redis://") && !url.startsWith("rediss://")) {
    throw new Error("Free-flight Redis URL must use Redis or TLS Redis.");
  }
  const publisher = createClient({ url });
  const subscriber = publisher.duplicate();
  const reportError = () => {
    process.stderr.write('{"event":"freeflight_redis_transport_error"}\n');
  };
  publisher.on("error", reportError);
  subscriber.on("error", reportError);
  try {
    await Promise.all([publisher.connect(), subscriber.connect()]);
  } catch {
    await Promise.allSettled([
      publisher.isOpen ? publisher.quit() : Promise.resolve(),
      subscriber.isOpen ? subscriber.quit() : Promise.resolve(),
    ]);
    throw new Error("Free-flight Redis transport could not connect.");
  }
  return {
    get: (key) => publisher.get(key),
    eval: (script, options) => publisher.eval(script, options),
    publish: (channel, message) => publisher.publish(channel, message),
    pSubscribe: (pattern, listener) => subscriber.pSubscribe(pattern, listener),
    pUnsubscribe: (pattern) => subscriber.pUnsubscribe(pattern),
    async close() {
      await Promise.allSettled([
        publisher.isOpen ? publisher.quit() : Promise.resolve(),
        subscriber.isOpen ? subscriber.quit() : Promise.resolve(),
      ]);
    },
  };
}
