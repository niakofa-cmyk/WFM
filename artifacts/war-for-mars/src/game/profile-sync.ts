/** Serialize refreshes and discard responses superseded by a newer refresh.
 * Disposal also prevents an old account/view from applying an in-flight result.
 */
export function createProfileSync<T>(
  load: () => Promise<T>,
  apply: (profile: T) => void,
  onError: () => void,
) {
  let disposed = false;
  let running = false;
  let requested = 0;

  const refresh = async () => {
    if (disposed) return;
    requested++;
    if (running) return;
    running = true;
    try {
      let version: number;
      do {
        version = requested;
        try {
          const profile = await load();
          if (!disposed && version === requested) apply(profile);
        } catch {
          if (!disposed && version === requested) onError();
        }
      } while (!disposed && version !== requested);
    } finally {
      running = false;
    }
  };

  return { refresh, dispose: () => { disposed = true; } };
}
