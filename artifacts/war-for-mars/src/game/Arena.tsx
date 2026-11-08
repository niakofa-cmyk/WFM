import type { Match, StepInput } from "./sim";
import type { Faction, ShipId } from "./ships";

export type StrikeResult = {
  outcome: "win" | "loss" | "draw";
  kills: number;
  deaths: number;
  relays: number;
  reason: string;
};

export type WingRewardNotice = {
  status: "awarded" | "not_eligible" | "daily_limit" | "disabled" | "unavailable";
  outcome: "win" | "loss" | "draw";
  gain: number;
  balanceAfter: number | null;
  revision: number | null;
  reason?: string;
};

export type OnlineSnapshot = {
  tick: number;
  time: number;
  players: Array<{ slotId: number; lastSeq: number; connected?: boolean; [key: string]: unknown }>;
  match: Match;
};

export type OnlineRoom = {
  socket: WebSocket;
  snapshot: OnlineSnapshot;
  roomId: string;
  slotId: number;
  team: 0 | 1;
  reconnectToken: string;
  name: string;
  getSessionToken: () => Promise<string | null>;
  sessionKey?: string;
};

type RetiredArenaProps = {
  shipId?: ShipId;
  faction?: Faction;
  onGraphicsError?: (message: string) => void;
  onNetworkExit?: (reason: string) => void;
  onDone?: (result: StrikeResult, replay: { seed: number; inputs: StepInput[]; checksums?: number[] }, reward?: WingRewardNotice) => void;
  [key: string]: unknown;
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** The former Three.js combat runtime is retired; no match or reward is started here. */
export function Arena(_props: RetiredArenaProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#080b12] px-6 py-12 text-[#e8e3d8]" data-testid="screen-legacy-combat-retired">
      <p className="font-mono text-xs tracking-[0.25em] text-[#e0a15a]">ORBITAL-ONLY REBUILD</p>
      <h1 className="font-hud text-4xl">LEGACY COMBAT RETIRED</h1>
      <p className="max-w-xl text-center text-sm text-white/65">
        The former Three.js arena no longer runs. This route does not create a match, connect a combat session, or settle rewards.
      </p>
      <a
        className="min-h-12 bg-[#e0a15a] px-6 py-3 font-hud text-[#080b12]"
        href={`${basePath}/combat-lab.html?universe=1&destination=cinder-ring`}
      >
        ENTER ORBITAL FLIGHT
      </a>
    </main>
  );
}

export default Arena;
