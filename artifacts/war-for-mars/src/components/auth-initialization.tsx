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
    <div
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[200] mx-auto flex max-w-md items-center justify-between gap-3 rounded-md border border-white/15 bg-[#141820]/95 px-3 py-2 text-xs text-bone shadow-lg backdrop-blur"
      data-testid="auth-initialization"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span>
        {timedOut
          ? "Still connecting securely. Your pilot session is not verified; the game remains locked."
          : "Checking your secure pilot session…"}
      </span>
      {timedOut ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-9 shrink-0 rounded border border-solar/50 px-3 font-hud tracking-widest text-solar hover:bg-solar/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-solar"
          data-testid="button-retry-auth"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

/**
 * Keep the route visible while Clerk initializes. Show delays and retry state
 * inline without treating an unverified session as authenticated.
 */
export function AuthInitialization({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setTimedOut(false);
      return;
    }
    const timer = window.setTimeout(
      () => setTimedOut(true),
      AUTH_INITIALIZATION_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  return (
    <>
      {children}
      {!isLoaded ? (
        <AuthLoadingView
          timedOut={timedOut}
          onRetry={() => window.location.reload()}
        />
      ) : null}
    </>
  );
}
