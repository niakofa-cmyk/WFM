type TokenGetter = () => Promise<string | null> | string | null;
type RegisterTokenGetter = (getter: TokenGetter | null) => void;

let activeBinding: symbol | null = null;

/**
 * A subpath-hosted Clerk session may not supply cookies on sibling /api routes.
 * Use a fresh Clerk Bearer token without copying it to storage or weakening the
 * API's normal Clerk verification. In-flight requests must fail after sign-out.
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
    // An old effect's cleanup must not clear a newer account's binding.
    if (activeBinding === binding) {
      activeBinding = null;
      register(null);
    }
  };
}
