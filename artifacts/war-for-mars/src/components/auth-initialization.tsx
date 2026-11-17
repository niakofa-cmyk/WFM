import { useAuth } from "@clerk/react";
import React, { useEffect, useState, type ReactNode } from "react";

export const AUTH_INITIALIZATION_TIMEOUT_MS = 10_000;

export function AuthLoadingView({
  timedOut,
  onRetry,
  returnHref,
}: {
  timedOut: boolean;
  onRetry: () => void;
  returnHref: string;
}) {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-void px-4 py-8 text-bone"
      data-testid="auth-initialization"
    >
      <section className="wfm-safe wfm-panel wfm-panel-accent w-full max-w-md p-6">
        <p className="font-hud text-sm tracking-[0.24em] text-solar">WAR FOR MARS</p>
        <div role="status" aria-live="polite" aria-atomic="true">
          <h1 className="mt-4 font-hud text-3xl">
            {timedOut ? "Sign-in is taking longer than expected" : "Connecting to sign-in…"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {timedOut
              ? "We could not finish loading the sign-in service. Check your connection, then try again. The game has not started."
              : "Please wait while we securely check your pilot session. The game will open when this check finishes."}
          </p>
        </div>
        {timedOut ? (
          <button
            type="button"
            onClick={onRetry}
            className="wfm-cmd wfm-cmd-primary wfm-chamfer mt-6 min-h-12 w-full justify-center px-5 py-3 font-hud tracking-widest"
            data-testid="button-retry-auth"
          >
            Retry connection
          </button>
        ) : null}
        <a
          href={returnHref}
          className="mt-5 inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-solar"
        >
          Back to Niakofa Kids
        </a>
      </section>
    </main>
  );
}

/**
 * Keep hosted sign-in widgets hidden until Clerk initializes, and give a clear
 * retry when its SDK stalls. The public landing remains available separately.
 */
export function AuthInitialization({
  children,
  returnHref,
}: {
  children: ReactNode;
  returnHref: string;
}) {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(
      () => setTimedOut(true),
      AUTH_INITIALIZATION_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <AuthLoadingView
        timedOut={timedOut}
        returnHref={returnHref}
        onRetry={() => window.location.reload()}
      />
    );
  }
  return <>{children}</>;
}
