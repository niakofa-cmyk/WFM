import { battlefieldProfile, battlefieldMapCoordinate, type BattlefieldIntel } from "./battlefield";

type LobbyPlayer = {
  slotId: number;
  team: 0 | 1;
  connected: boolean;
  name: string | null;
  ready: boolean;
};

export type LobbyState = {
  phase: "lobby" | "active";
  hostSlotId: number | null;
  connectedCount: number;
  maxPlayers: number;
  players: LobbyPlayer[];
  battlefield: BattlefieldIntel;
};

type Props = {
  roomCode: string;
  slotId: number;
  lobby: LobbyState;
  ready: boolean;
  status: string;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
};

export function OnlineLobby({ roomCode, slotId, lobby, ready, status, onReady, onStart, onLeave }: Props) {
  const isHost = lobby.hostSlotId === slotId;
  const everyoneReady =
    lobby.connectedCount > 0 &&
    lobby.players.filter((player) => player.connected).every((player) => player.ready);
  const battlefield = battlefieldProfile(lobby.battlefield.disc);

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-void px-4 py-8 text-bone">
      <section className="w-full max-w-2xl border border-solar/70 bg-void/95 p-5 shadow-2xl sm:p-8">
        <p className="font-hud text-xs tracking-[0.24em] text-solar">PRIVATE WING · LOBBY</p>
        <h1 className="mt-2 font-hud text-4xl leading-none sm:text-5xl">ASSEMBLE YOUR STRIKE</h1>
        <p className="mt-3 text-sm text-muted">
          Share this code with your group. The host launches when every connected pilot is ready. Empty seats fly with AI.
        </p>
        <section
          data-testid="panel-battlefield-briefing"
          data-battlefield={lobby.battlefield.disc}
          className="mt-5 grid gap-4 border border-bone/20 bg-panel/65 p-3 sm:grid-cols-[148px_1fr] sm:items-center"
          aria-labelledby="battlefield-title"
        >
          <svg
            role="img"
            aria-label={`${battlefield.title} tactical map with ${lobby.battlefield.relays.length} relays and ${lobby.battlefield.rocks.length} obstacles`}
            viewBox="0 0 100 100"
            className="mx-auto aspect-square w-36 max-w-full"
          >
            <circle cx="50" cy="50" r="46" fill="#090b10" stroke="#e0a15a" strokeOpacity=".55" />
            <circle cx="50" cy="50" r="31" fill="none" stroke="#e6e1d6" strokeOpacity=".12" />
            <circle cx="50" cy="50" r="16" fill="none" stroke="#e6e1d6" strokeOpacity=".1" />
            <path d="M50 5v90M5 50h90" stroke="#e6e1d6" strokeOpacity=".1" />
            {lobby.battlefield.rocks.map((rock, index) => (
              <circle
                key={`rock-${index}`}
                cx={battlefieldMapCoordinate(rock.x)}
                cy={battlefieldMapCoordinate(rock.z)}
                r={Math.max(1.4, (rock.r / 78) * 43)}
                fill="#8d877c"
                fillOpacity=".58"
              />
            ))}
            {lobby.battlefield.relays.map((relay, index) => (
              <g
                key={`relay-${index}`}
                transform={`translate(${battlefieldMapCoordinate(relay.x)} ${battlefieldMapCoordinate(relay.z)})`}
              >
                <circle r="4.5" fill={relay.own === 1 ? "#e0a15a" : relay.own === -1 ? "#c45c48" : "#c8c2b8"} fillOpacity=".2" />
                <path d="M-2.2-2.2h4.4v4.4h-4.4z" fill={relay.own === 1 ? "#e0a15a" : relay.own === -1 ? "#c45c48" : "#c8c2b8"} />
              </g>
            ))}
          </svg>
          <div>
            <p className="font-hud text-[10px] tracking-[0.2em] text-solar">AERIAL BATTLEFIELD · {battlefield.callsign}</p>
            <h2 id="battlefield-title" className="mt-1 font-hud text-2xl leading-none">{battlefield.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{battlefield.briefing}</p>
            <p className="mt-2 font-hud text-[10px] tracking-widest text-bone/75">{battlefield.tacticalRead}</p>
            <p className="mt-2 text-[10px] text-muted">Server-assigned field · private rooms remain no-reward</p>
          </div>
        </section>
        <div className="mt-5 flex items-center justify-between gap-3 border border-bone/20 bg-bone/5 p-3">
          <div>
            <p className="font-hud text-xs tracking-widest text-muted">ROOM CODE</p>
            <p data-testid="text-lobby-room-code" className="font-hud text-2xl tracking-[0.2em] text-solar">{roomCode}</p>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(roomCode)}
            className="h-10 border border-bone/30 px-3 font-hud text-xs tracking-widest"
          >
            COPY CODE
          </button>
        </div>
        <p className="mt-4 font-hud text-sm tracking-widest">
          {lobby.connectedCount}/10 PILOTS CONNECTED · {isHost ? "YOU ARE HOST" : "WAITING FOR HOST"}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {([0, 1] as const).map((team) => {
            const players = lobby.players.filter((player) => player.team === team);
            const connected = players.filter((player) => player.connected).length;
            return (
              <div key={team} className="border border-bone/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-hud text-sm tracking-widest text-solar">TEAM {team + 1}</h2>
                  <span className="text-xs text-muted">{connected}/5 PILOTS · {5 - connected} AI</span>
                </div>
                <ul className="space-y-1.5">
                  {players.map((player) => (
                    <li key={player.slotId} className="flex items-center justify-between text-sm">
                      <span className={player.connected ? "text-bone" : "text-muted"}>
                        {player.connected ? player.name || "Pilot" : "Open seat · AI"}
                        {player.slotId === lobby.hostSlotId ? " · HOST" : ""}
                        {player.slotId === slotId ? " · YOU" : ""}
                      </span>
                      <span className="font-hud text-xs tracking-widest">
                        {player.connected ? (player.ready ? "READY" : "NOT READY") : "AI"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-alert">{status}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onReady(!ready)}
            className={ready
              ? "h-12 border border-solar bg-solar/10 font-hud tracking-widest text-solar"
              : "h-12 bg-solar font-hud tracking-widest text-void"}
          >
            {ready ? "CANCEL READY" : "READY UP"}
          </button>
          <button
            type="button"
            disabled={!isHost || !everyoneReady}
            onClick={onStart}
            className="h-12 border border-bone/30 font-hud tracking-widest disabled:opacity-35"
          >
            {isHost ? (everyoneReady ? "START 5V5" : "WAITING FOR READY") : "HOST STARTS MATCH"}
          </button>
        </div>
        <button type="button" onClick={onLeave} className="mt-3 h-10 w-full text-sm text-muted underline">
          Leave lobby
        </button>
      </section>
    </main>
  );
}
