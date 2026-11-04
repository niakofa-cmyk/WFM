import { useAuth } from "@clerk/react";
import type { OperationDirectoryResponse } from "@workspace/api-client-react";
import { useEffect, useRef, useState } from "react";
import type { OnlineSnapshot } from "./Arena";
import { currentWingSocketUrl } from "./socket-endpoint";
import { CinderRingArtwork } from "./CinderRingArtwork";

type Props = {
  operations: OperationDirectoryResponse;
  atAsteroid: boolean;
  queueAvailable: boolean;
  queueing: boolean;
  onJoinQueue: () => void;
  onTravel: () => void;
};

const WING_RELAY_ID = "cinder-ring-wing-relay-5v5";
const MATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SpectatorContact = { x: number; z: number; team: 0 | 1; health: number; alive: boolean };
type SpectatorState = {
  contacts: SpectatorContact[];
  relays: Array<{ x: number; z: number; owner: -1 | 0 | 1; progress: number }>;
  over: boolean;
};
type ConnectionState = "connecting" | "live" | "ended" | "error";

function anonymousState(snapshot: OnlineSnapshot): SpectatorState | null {
  const match = snapshot?.match;
  if (!match || !Array.isArray(match.relays)) return null;
  const craft = [match.player, ...match.allies, ...match.enemies];
  const contacts: SpectatorContact[] = craft.flatMap((ship, index) => {
    if (!ship || !Number.isFinite(ship.x) || !Number.isFinite(ship.z)) return [];
    return [{
      x: ship.x,
      z: ship.z,
      team: index < 1 + match.allies.length ? 0 : 1,
      health: ship.hullMax > 0 ? Math.max(0, Math.min(1, ship.hull / ship.hullMax)) : 0,
      alive: Boolean(ship.alive),
    }];
  });
  return {
    contacts,
    relays: match.relays.flatMap((relay) =>
      Number.isFinite(relay.x) && Number.isFinite(relay.z)
        ? [{ x: relay.x, z: relay.z, owner: relay.own, progress: relay.cap }]
        : [],
    ),
    over: Boolean(match.over),
  };
}

function statusLabel(status: ConnectionState) {
  if (status === "connecting") return "CONNECTING TO LIVE FEED";
  if (status === "live") return "LIVE · SERVER SNAPSHOT";
  if (status === "ended") return "MATCH ENDED";
  return "SPECTATOR LINK ERROR";
}

export function AsteroidArenaHub({
  operations,
  atAsteroid,
  queueAvailable,
  queueing,
  onJoinQueue,
  onTravel,
}: Props) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [matchId, setMatchId] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SpectatorState | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const operation = operations.operations.find((entry) => entry.id === WING_RELAY_ID);
  const activeMatches = operations.instances.filter((instance) =>
    instance.operationId === WING_RELAY_ID &&
    instance.phase === "active" &&
    MATCH_ID_PATTERN.test(instance.id),
  );
  const location = operation
    ? operations.locations.find((entry) => entry.id === operation.locationId)
    : undefined;

  useEffect(() => {
    if (!matchId) return;
    let disposed = false;
    let authenticated = false;
    let joined = false;
    let ended = false;
    let socket: WebSocket | null = null;
    setConnection("connecting");
    setState(null);
    setMessage("");

    const fail = (reason: string) => {
      if (disposed) return;
      setConnection("error");
      setMessage(reason);
      socket?.close();
    };

    void (async () => {
      try {
        const token = isSignedIn ? await getToken() : null;
        if (disposed) return;
        if (!token) {
          fail("Sign in is required to open a read-only match feed.");
          return;
        }
        const url = currentWingSocketUrl();
        url.searchParams.set("spectate", matchId);
        socket = new WebSocket(url);
        socketRef.current = socket;
        socket.addEventListener("open", () => {
          if (disposed) return;
          try {
            socket?.send(JSON.stringify({ type: "authenticate", token }));
          } catch {
            fail("Authentication could not be sent.");
          }
        });
        socket.addEventListener("message", (event) => {
          if (disposed) return;
          let packet: { type?: unknown; snapshot?: unknown; message?: unknown; reason?: unknown };
          try {
            packet = JSON.parse(String(event.data));
          } catch {
            return;
          }
          if (packet.type === "authenticated") {
            authenticated = true;
            return;
          }
          if (packet.type === "spectator_joined" || packet.type === "spectator_snapshot") {
            if (!authenticated || !packet.snapshot) return;
            if (packet.type === "spectator_joined") joined = true;
            if (!joined) return;
            const safe = anonymousState(packet.snapshot as OnlineSnapshot);
            if (!safe) {
              fail("The server snapshot could not be read.");
              return;
            }
            setState(safe);
            setConnection(safe.over ? "ended" : "live");
            ended = safe.over;
            return;
          }
          if (packet.type === "authentication_failed" || packet.type === "error") {
            fail(typeof packet.reason === "string"
              ? packet.reason.replaceAll("_", " ")
              : typeof packet.message === "string"
                ? packet.message
                : "The server rejected this spectator link.");
          }
        });
        socket.addEventListener("error", () => fail("The live spectator connection failed."));
        socket.addEventListener("close", () => {
          if (!disposed && !ended) {
            setConnection("error");
            setMessage((current) => current || "The spectator feed disconnected.");
          }
        });
      } catch (error) {
        fail(error instanceof Error ? error.message : "The live spectator connection failed.");
      }
    })();

    return () => {
      disposed = true;
      if (socketRef.current === socket) socketRef.current = null;
      if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        socket.close();
      }
    };
  }, [matchId, getToken, isSignedIn]);

  const leaveSpectator = () => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) socket.close();
    setMatchId(null);
    setState(null);
    setMessage("");
  };

  const canQueue = atAsteroid && queueAvailable && isLoaded && Boolean(isSignedIn) && !queueing;

  return (
    <section data-testid="screen-asteroid-arena-hub" className="relative overflow-hidden border border-solar/30 bg-void px-4 py-6 text-bone sm:px-8 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_70%_0%,rgba(224,161,90,0.12),transparent_65%)]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-5 overflow-hidden">
          <CinderRingArtwork />
        </div>
        <header className="border-b border-solar/35 pb-5">
          <p className="font-hud text-[10px] tracking-[0.24em] text-solar">CINDER RING / PERSISTENT UNIVERSE / WING RELAY</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-hud text-4xl leading-none tracking-wide sm:text-6xl">ASTEROID ARENA</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Live competitive flights are server-run. Watch an active wing or enter the human-only queue from the ring.
              </p>
            </div>
            <div className="border-l-2 border-solar pl-3">
              <p className="font-hud text-[10px] tracking-[0.2em] text-muted">OPERATION</p>
              <p className="font-hud text-lg text-solar">5V5 WING RELAY</p>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
          <div className="min-w-0 border border-bone/15 bg-panel/75">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-bone/10 px-4 py-4">
              <div>
                <p className="font-hud text-xs tracking-[0.2em] text-spectral">PUBLIC MATCH FEED</p>
                <h2 className="mt-1 font-hud text-2xl">Active wings</h2>
              </div>
              <p data-testid="text-active-wing-count" className="font-mono text-xs text-muted">{activeMatches.length} ACTIVE</p>
            </div>

            {matchId ? (
              <div className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-hud text-xs tracking-[0.2em] text-solar">{statusLabel(connection)}</p>
                    <p role={connection === "error" ? "alert" : "status"} aria-live="polite" className="mt-1 text-xs text-muted">
                      {message || (connection === "connecting" ? "Requesting an anonymous server snapshot…" : "Read-only spectator view · no combat input")}
                    </p>
                  </div>
                  <button type="button" data-testid="button-leave-spectator" onClick={leaveSpectator} className="min-h-11 border border-bone/25 px-4 font-hud text-xs tracking-widest text-bone">
                    LEAVE FEED
                  </button>
                </div>
                {state ? <TacticalSnapshot state={state} /> : (
                  <div role="status" className="mt-4 h-64 animate-pulse border border-bone/10 bg-void/80">
                    <div className="mx-auto mt-12 h-40 w-40 rounded-full border border-solar/20" />
                    <p className="mt-4 text-center font-hud text-[10px] tracking-[0.2em] text-muted">AWAITING SERVER TELEMETRY</p>
                  </div>
                )}
              </div>
            ) : activeMatches.length === 0 ? (
              <div className="m-4 border border-dashed border-bone/20 p-6">
                <p className="font-hud text-lg tracking-wide">NO ACTIVE MATCH SIGNAL</p>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
                  The directory currently reports no active 5v5 Wing Relay instance. Queue for the next ten-pilot match when you are at Cinder Ring.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-bone/10">
                {activeMatches.map((instance, index) => (
                  <article key={instance.id} data-testid={`card-wing-match-${index + 1}`} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <MatchGlyph />
                      <div>
                        <p className="font-hud text-lg">CINDER RING · LIVE MATCH</p>
                        <p className="mt-1 text-xs text-muted">{instance.currentPlayers}/{instance.capacity} PILOTS CONNECTED · {instance.phase.toUpperCase()}</p>
                        <p className="mt-1 font-mono text-[10px] tracking-wider text-bone/45">SERVER INSTANCE VERIFIED</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid={`button-spectate-wing-match-${index + 1}`}
                      onClick={() => setMatchId(instance.id)}
                      className="min-h-11 bg-solar px-5 font-hud text-xs tracking-[0.17em] text-void"
                    >
                      OPEN SPECTATOR FEED
                    </button>
                  </article>
                ))}
              </div>
            )}
            {operation && activeMatches.length > 0 ? (
              <p className="border-t border-bone/10 px-4 py-3 text-[10px] tracking-widest text-muted">
                {operation.title.toUpperCase()} · {location?.name.toUpperCase() ?? "ASTEROID LOCATION"}
              </p>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="border border-solar/40 bg-panel/80 p-4">
              <p className="font-hud text-xs tracking-[0.2em] text-solar">COMPETITIVE ENTRY</p>
              <h2 className="mt-1 font-hud text-2xl">Wing Relay queue</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Ten signed-in human pilots are required to launch. No AI-fill, open seats, or substitute pilots.
              </p>
              <div className="mt-4 grid grid-cols-5 gap-1" aria-label="Ten human pilots required">
                {Array.from({ length: 10 }, (_, index) => (
                  <span key={index} aria-hidden="true" className="h-2 border border-bone/25 bg-void">
                    <span className="block h-full w-full bg-solar/25" />
                  </span>
                ))}
              </div>
              {!atAsteroid ? (
                <div className="mt-4 border-l-2 border-spectral pl-3">
                  <p className="font-hud text-xs tracking-widest text-spectral">NOT AT CINDER RING</p>
                  <button type="button" data-testid="button-travel-to-asteroid-arena" onClick={onTravel} className="mt-3 min-h-12 w-full bg-solar px-3 font-hud text-xs tracking-widest text-void">
                    TRAVEL TO THE ARENA
                  </button>
                </div>
              ) : (
                <>
                  {!isLoaded ? (
                    <p role="status" className="mt-4 min-h-11 border border-bone/15 px-3 py-3 text-xs text-muted">CHECKING PILOT ACCOUNT…</p>
                  ) : !isSignedIn ? (
                    <p className="mt-4 border border-alert/40 bg-alert/5 px-3 py-3 text-xs leading-relaxed text-bone">
                      Sign in to join the competitive queue. Ten authenticated human pilots are required.
                    </p>
                  ) : !queueAvailable ? (
                    <p className="mt-4 border border-bone/15 px-3 py-3 text-xs text-muted">Competitive queue is currently unavailable.</p>
                  ) : (
                    <button
                      type="button"
                      data-testid="button-join-asteroid-competitive-queue"
                      disabled={!canQueue}
                      onClick={onJoinQueue}
                      className="mt-4 min-h-14 w-full bg-solar px-4 font-hud text-sm tracking-[0.15em] text-void disabled:border disabled:border-bone/15 disabled:bg-transparent disabled:text-muted"
                    >
                      {queueing ? "ASSEMBLING TEN PILOTS…" : "JOIN HUMAN-ONLY QUEUE"}
                    </button>
                  )}
                  <p className="mt-3 text-[10px] leading-relaxed text-muted">
                    {queueing ? "Searching for ten authenticated human pilots. This queue never fills seats with AI." : "Queue entry uses the existing server-authoritative Wing matchmaking and combat simulation."}
                  </p>
                </>
              )}
            </section>

            <section className="border border-bone/15 bg-panel/55 p-4">
              <p className="font-hud text-xs tracking-[0.2em] text-muted">SPECTATOR SAFETY</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                This view contains anonymous positions, team assignment, hull condition, and relay ownership only. No callsigns or player identifiers are shown, and no combat controls are available.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </section>
  );
}

function TacticalSnapshot({ state }: { state: SpectatorState }) {
  const coordinate = (value: number) => 50 + (Math.max(-1, Math.min(1, value / 78)) * 42);
  return (
    <div className="mt-4 grid gap-4 border border-bone/10 bg-void/70 p-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <svg role="img" aria-label="Anonymous live match map showing team contacts and relays" viewBox="0 0 100 100" className="mx-auto aspect-square w-full max-w-[25rem]">
        <circle cx="50" cy="50" r="46" fill="#090b10" stroke="#e0a15a" strokeOpacity=".55" />
        <circle cx="50" cy="50" r="31" fill="none" stroke="#e6e1d6" strokeOpacity=".12" />
        <circle cx="50" cy="50" r="16" fill="none" stroke="#e6e1d6" strokeOpacity=".1" />
        <path d="M50 5v90M5 50h90" stroke="#e6e1d6" strokeOpacity=".1" />
        {state.relays.map((relay, index) => (
          <g key={`relay-${index}`} transform={`translate(${coordinate(relay.x)} ${coordinate(relay.z)})`}>
            <circle r="5" fill={relay.owner === 0 ? "#e0a15a" : relay.owner === 1 ? "#78bfff" : "#8d877c"} fillOpacity=".2" />
            <path d="M-2-2h4v4h-4z" fill={relay.owner === 0 ? "#e0a15a" : relay.owner === 1 ? "#78bfff" : "#8d877c"} />
          </g>
        ))}
        {state.contacts.map((contact, index) => (
          <g key={`contact-${index}`} transform={`translate(${coordinate(contact.x)} ${coordinate(contact.z)})`} opacity={contact.alive ? 1 : 0.35}>
            <circle r="2.4" fill={contact.team === 0 ? "#e0a15a" : "#78bfff"} />
            <circle r="3.5" fill="none" stroke={contact.team === 0 ? "#e0a15a" : "#78bfff"} strokeOpacity=".45" />
          </g>
        ))}
      </svg>
      <div className="flex flex-col justify-between gap-4">
        <div>
          <p className="font-hud text-[10px] tracking-[0.18em] text-muted">ANONYMOUS CONTACTS</p>
          {([0, 1] as const).map((team) => {
            const members = state.contacts.filter((contact) => contact.team === team);
            return (
              <div key={team} className="mt-3">
                <div className="flex items-center justify-between font-hud text-xs tracking-widest">
                  <span className={team === 0 ? "text-solar" : "text-spectral"}>TEAM {team + 1}</span>
                  <span className="text-muted">{members.filter((member) => member.alive).length}/{members.length} UP</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {members.map((member, index) => (
                    <span key={index} title={`Team ${team + 1} hull ${Math.round(member.health * 100)}%`} className={`h-2 w-6 ${team === 0 ? "bg-solar" : "bg-spectral"} ${member.alive ? "opacity-90" : "opacity-25"}`}>
                      <span className="block h-full bg-void/60" style={{ transform: `scaleX(${1 - member.health})`, transformOrigin: "right" }} />
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <p className="font-hud text-[10px] tracking-[0.18em] text-muted">RELAY CONTROL</p>
          <p className="mt-1 font-mono text-sm text-bone">
            {state.relays.filter((relay) => relay.owner === 0).length} / {state.relays.length} · TEAM 1
          </p>
          <p className="mt-1 font-mono text-sm text-spectral">
            {state.relays.filter((relay) => relay.owner === 1).length} / {state.relays.length} · TEAM 2
          </p>
          {state.over ? <p className="mt-3 border-t border-alert/30 pt-3 font-hud text-xs tracking-widest text-alert">SERVER MATCH COMPLETE</p> : null}
        </div>
      </div>
    </div>
  );
}

function MatchGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className="h-14 w-14 shrink-0">
      <circle cx="32" cy="32" r="28" fill="none" stroke="#e0a15a" strokeOpacity=".5" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#e6e1d6" strokeOpacity=".18" />
      <path d="M32 5v54M5 32h54" stroke="#e6e1d6" strokeOpacity=".12" />
      <path d="M19 20l8 4-6 7zM45 44l-8-4 6-7z" fill="#e0a15a" />
      <path d="M45 20l-8 4 6 7zM19 44l8-4-6-7z" fill="#78bfff" />
      <circle cx="32" cy="32" r="4" fill="#e6e1d6" fillOpacity=".7" />
    </svg>
  );
}
