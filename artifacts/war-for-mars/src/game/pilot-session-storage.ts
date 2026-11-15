type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Capture the owner per mounted game so late callbacks cannot touch another pilot. */
export function createPilotSessionStorage(
  userId: string | null | undefined,
  getStorage: () => SessionStorage = () => window.sessionStorage,
): SessionStorage {
  const ownedKey = (key: string) => {
    if (!userId) throw new Error("A signed-in pilot is required for game session storage.");
    return `wfm-pilot:${encodeURIComponent(userId)}:${key}`;
  };
  // Deliberately do not migrate ownerless legacy claims or reconnect tokens:
  // there is no safe way to infer which pilot owns them.
  return {
    getItem: (key) => getStorage().getItem(ownedKey(key)),
    setItem: (key, value) => getStorage().setItem(ownedKey(key), value),
    removeItem: (key) => getStorage().removeItem(ownedKey(key)),
  };
}
