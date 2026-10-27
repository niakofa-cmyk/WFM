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

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-void px-4 py-8 text-bone">
      <section className="w-full max-w-2xl border border-solar/70 bg-void/95 p-5 shadow-2xl sm:p-8">
        <p className="font-hud text-xs tracking-[0.24em] text-solar">PRIVATE WING · LOBBY</p>
        <h1 className="mt-2 font-hud text-4xl leading-none sm:text-5xl">ASSEMBLE YOUR STRIKE</h1>
        <p className="mt-3 text-sm text-muted">
          Share this code with your group. The host launches when every connected pilot is ready. Empty seats fly with AI.
        </p>
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
