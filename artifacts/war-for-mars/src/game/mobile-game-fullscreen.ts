type FullscreenDocument = {
  fullscreenElement: Element | null;
  documentElement: {
    requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  };
  exitFullscreen?: () => Promise<void>;
};

type LockableScreen = {
  orientation?: {
    lock?: (orientation: "landscape") => Promise<void>;
    unlock?: () => void;
  };
};

/**
 * Request immersive browser chrome only from a user gesture, such as the
 * hangar's Enter Universe button. Unsupported browsers remain usable normally.
 */
export async function enterMobileGameFullscreen(
  doc: FullscreenDocument = document,
  screenRef: LockableScreen = screen,
): Promise<boolean> {
  if (doc.fullscreenElement) return true;
  const request = doc.documentElement.requestFullscreen;
  if (!request) return false;
  try {
    await request.call(doc.documentElement, { navigationUI: "hide" });
  } catch {
    return false;
  }
  try {
    await screenRef.orientation?.lock?.("landscape");
  } catch {
    // Fullscreen may still have succeeded even when orientation locking is unavailable.
  }
  return true;
}

export function exitMobileGameFullscreen(
  doc: FullscreenDocument = document,
  screenRef: LockableScreen = screen,
) {
  if (doc.fullscreenElement && doc.exitFullscreen) {
    void doc.exitFullscreen().catch(() => undefined);
  }
  try {
    screenRef.orientation?.unlock?.();
  } catch {
    // Orientation unlock is optional and browser-dependent.
  }
}
