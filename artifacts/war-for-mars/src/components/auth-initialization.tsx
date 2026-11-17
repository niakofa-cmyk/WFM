import { useAuth } from "@clerk/react";
import React, { useEffect, useState, type ReactNode } from "react";

export const AUTH_INITIALIZATION_TIMEOUT_MS = 10_000;

export function AuthLoadingView({
  timedOut,
  onRetry,
}: {
  timedOut: boolean;
  onRetry: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-void px-6 py-10 text-bone" data-testid="auth-initialization">
      <section className="w-full max-w-md border border-bone/20 bg-panel p-6">
        <p className="font-hud text-sm tracking-widest text-solar">WAR FOR MARS</p>
        <div role="status" aria-live="polite" aria-atomic="true">
          <h1 className="mt-3 font-hud text-3xl">
            {timedOut ? "Sign-in is taking longer than expected" : "Connecting to sign-in…"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {timedOut
              ? "We could not finish loading the sign-in service. Check your connection, then try again. The game has not started."
              : "Please wait while we securely check your pilot session. The game will open when this check finishes."}
          </p>
        </div>
        {timedOut && (
          <button type="button" onClick={onRetry} className="mt-6 min-h-12 w-full bg-solar px-5 py-3 font-hud tracking-widest text-void" data-testid="button-retry-auth">
            Retry connection
          </button>
        )}
        <a href="/kids/wfm/about" className="mt-5 inline-flex min-h-11 items-center text-sm underline underline-offset-4">
          Back to Niakofa Kids
        </a>
      </section>
    </main>
  );
}

/**
 * Clerk's signed-in/out branches both render nothing until its SDK is ready.
 * Keep an explicit visible state on every route without assuming a session.
 */
export function AuthInitialization({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(() => setTimedOut(true), AUTH_INITIALIZATION_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  if (!isLoaded) {
    return <AuthLoadingView timedOut={timedOut} onRetry={() => window.location.reload()} />;
  }
  return <>{children}</>;
}
