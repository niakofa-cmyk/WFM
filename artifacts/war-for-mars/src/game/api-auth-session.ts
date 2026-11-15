type TokenGetter = () => Promise<string | null> | string | null;
type RegisterTokenGetter = (getter: TokenGetter | null) => void;

let activeBinding: symbol | null = null;

/**
 * Same-origin APIs may not receive a subpath Clerk cookie. Bind fresh Bearer
 * tokens without persisting them, and reject tokens resolved after sign-out.
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
    // Old cleanup cannot remove a newer account's provider.
    if (activeBinding === binding) {
      activeBinding = null;
      register(null);
    }
  };
}
