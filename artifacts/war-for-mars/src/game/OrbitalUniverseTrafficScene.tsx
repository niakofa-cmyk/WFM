import React, { useEffect, useRef, useState } from "react";
import type { WorldPatrolDirectory } from "@workspace/api-client-react";
import {
  createOrbitalNativeSpectatorRenderer,
  type NativeSpectatorState,
} from "./orbital-native-spectator-renderer";

type Props = {
  traffic: WorldPatrolDirectory["traffic"];
  nearbyPilotCount: number;
};

function sceneState(directory: WorldPatrolDirectory["traffic"]): NativeSpectatorState {
  return {
    receivedAt: Date.now(),
    contacts: directory.slice(0, 64).map((contact) => ({
      x: contact.position.x,
      z: contact.position.z,
      yaw: contact.yaw,
      shipId: contact.hullId,
      team: contact.faction === "ussf" ? 0 : 1,
      health: 1,
      alive: true,
      velocity: contact.velocity,
    })),
  };
}

/** Read-only 3D rendering of server-simulated patrols in the current region. */
export function OrbitalUniverseTrafficScene({ traffic, nearbyPilotCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestStateRef = useRef(sceneState(traffic));
  const [unavailable, setUnavailable] = useState(false);
  latestStateRef.current = sceneState(traffic);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: ReturnType<typeof createOrbitalNativeSpectatorRenderer>;
    try {
      renderer = createOrbitalNativeSpectatorRenderer(canvas);
    } catch {
      setUnavailable(true);
      return;
    }
    let frame = 0;
    const draw = () => {
      renderer.render(latestStateRef.current);
      frame = window.requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.cancelAnimationFrame(frame);
      renderer.dispose();
    };
  }, []);

  return (
    <section
      aria-label="Live faction traffic in the current universe region"
      data-testid="panel-orbital-universe-traffic"
      className="mt-4 border border-spectral/25 bg-void/75 p-3"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-hud text-[10px] tracking-[0.18em] text-spectral">
          ORBITAL REGION TRAFFIC · SERVER ROUTES
        </p>
        <p className="text-[9px] tracking-widest text-muted" data-testid="text-nearby-pilot-count">
          {nearbyPilotCount} PILOT{nearbyPilotCount === 1 ? "" : "S"} IN REGION · ANONYMOUS COUNT
        </p>
      </div>
      {unavailable ? (
        <p role="status" className="px-3 py-6 text-center text-xs text-muted">
          Native 3D traffic rendering is unavailable in this browser.
        </p>
      ) : (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Orbital 3D view of ${traffic.length} server-reported patrol ships`}
          className="block h-48 w-full border border-bone/10 bg-[#05080d] sm:h-56"
        />
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Fleet poses follow the server's saved route clocks. Nearby pilot presence is shown only as a region total; individual pilot positions and identities are not published.
      </p>
    </section>
  );
}
