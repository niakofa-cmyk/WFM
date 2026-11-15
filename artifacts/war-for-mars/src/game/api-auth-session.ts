type TokenGetter = () => Promise<string | null> | string | null;
type RegisterTokenGetter = (getter: TokenGetter | null) => void;

let activeBinding: symbol | null = null;

function rejectDisposedSession(): never {
  throw new Error("Your game session changed. Please sign in again.");
}

/**
 * Bind a fresh Clerk bearer token for each API request. Never persist tokens,
 * and reject a token if the account signs out or changes while it resolves.
 */
export function installGameApiSession(
  getToken: TokenGetter,
  register: RegisterTokenGetter,
): () => void {
  const binding = Symbol("game-api-session");
  let active = true;
  activeBinding = binding;
  register(async () => {
    if (!active || activeBinding !== binding) {
      throw new Error("Your game session changed. Please sign in again.");
    }
    const token = await getToken();
    if (!active || activeBinding !== binding) {
      throw new Error("Your game session changed. Please sign in again.");
    }
    if (!token) {
      throw new Error("Your game session is unavailable. Please sign in again.");
    }
    return token;
  });
  return () => {
    active = false;
    // Cleanup from an older account must not clear a newer account's provider.
    if (activeBinding === binding) {
      activeBinding = null;
      // Keep late game callbacks fail-closed instead of reverting to cookies.
      register(rejectDisposedSession);
    }
  };
}
