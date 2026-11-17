import { useAuth } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { installGameApiSession } from "./api-auth-session";

/** Bind authenticated transport before any account/progression hooks mount. */
export function GameApiSession({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const identity = userId && sessionId ? `${userId}:${sessionId}` : null;
  const [readySession, setReadySession] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !identity) return;
    const release = installGameApiSession(() => getToken(), setAuthTokenGetter);
    setReadySession(identity);
    return release;
  }, [getToken, isLoaded, isSignedIn, identity]);

  if (!isLoaded || !isSignedIn || !identity || readySession !== identity) {
    return (
      <main role="status" className="flex min-h-dvh items-center justify-center bg-void text-bone">
        Connecting your pilot session…
      </main>
    );
  }
  return <Fragment key={identity}>{children}</Fragment>;
}
