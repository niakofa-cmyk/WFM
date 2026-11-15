import { useAuth } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useEffect, useState, type ReactNode } from "react";
import { installGameApiSession } from "./api-auth-session";

/** Bind authenticated transport before any account/progression hooks mount. */
export function GameApiSession({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, sessionId, getToken } = useAuth();
  const [readySession, setReadySession] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId) return;
    const release = installGameApiSession(() => getToken(), setAuthTokenGetter);
    setReadySession(sessionId);
    return release;
  }, [getToken, isLoaded, isSignedIn, sessionId]);

  if (!isLoaded || !isSignedIn || !sessionId || readySession !== sessionId) {
    return (
      <main role="status" className="flex min-h-dvh items-center justify-center bg-void text-bone">
        Connecting your pilot session…
      </main>
    );
  }
  return children;
}
