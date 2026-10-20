let listening = false;
let yaw = 0;
let pitch = 0;
let baseGamma: number | null = null;
let baseBeta: number | null = null;

function clamp(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

function onOrient(event: DeviceOrientationEvent) {
  if (event.gamma == null || event.beta == null) return;
  if (baseGamma == null || baseBeta == null) {
    baseGamma = event.gamma;
    baseBeta = event.beta;
  }
  yaw = clamp((event.gamma - baseGamma) / 26) * 0.6;
  pitch = clamp((baseBeta - event.beta) / 26) * 0.45;
}

export function gyroAim(): { yaw: number; pitch: number } {
  return { yaw, pitch };
}

export function resetGyro() {
  baseGamma = null;
  baseBeta = null;
  yaw = 0;
  pitch = 0;
}

export async function armGyro(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const ctor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<string>;
  };
  if (typeof ctor?.requestPermission === "function") {
    try {
      const result = await ctor.requestPermission();
      if (result !== "granted") return false;
    } catch {
      return false;
    }
  }
  if (!listening) {
    window.addEventListener("deviceorientation", onOrient);
    listening = true;
  }
  resetGyro();
  return true;
}
