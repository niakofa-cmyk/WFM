import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { CommandBackdrop, CommandPanel, PanelLabel } from "./CommandArt";
import { FACTION_PALETTE } from "./faction-palette";
import { ShipIllustration } from "./ShipIllustration";
import { ROSTER, SHIPS, type ShipId } from "./ships";
import { currentWingSocketUrl } from "./socket-endpoint";
import { RustDiscFlight, type ExpeditionTransport } from "./RustDiscFlight";
import type { FlightInput } from "./flight-sector";
import {
  SECTOR_MISSIONS, sectorMission,
  type SectorClientPacket, type SectorMissionId, type SectorProgress, type SectorSnapshot,
} from "./sector-missions";
import {
  SECTOR_MAX_PILOTS, SECTOR_RECONNECT_WINDOW_MS, createSeqCounter, expeditionFeatureEnabled, generateRoomCode,
  isTerminalClose, isTerminalError, isValidRoomCode, missionLockState, missionNumber, normalizeRoomCode,
  parseSectorSnapshot, sectorSocketUrl, slotLabel, type MissionLock,
} from "./sector-client";

/**
 * Cooperative sector expedition client. The server owns every pilot, the
 * shared drone, progress and settlement; this screen only authenticates,
 * joins, readies, launches and streams FlightInput.
 */

const ENABLED = expeditionFeatureEnabled({
  DEV: import.meta.env.DEV,
  VITE_WFM_SECTOR_EXPEDITION_ENABLED: import.meta.env.VITE_WFM_SECTOR_EXPEDITION_ENABLED,
});
const HANDSHAKE_TIMEOUT_MS = 8000;

type View = "select" | "connecting" | "lobby" | "flight" | "debrief" | "error";
type Session = { missionId: SectorMissionId; room: string; shipId: ShipId };
type Connection = ExpeditionTransport["connection"];

export function SectorExpedition() {
  if (!ENABLED) return <Gate title="EXPEDITIONS OFFLINE" body="Cooperative sector expeditions are not enabled on this deployment yet. The local Rust Disc trainer is still open." />;
  return <SignedInGate />;
}
export default SectorExpedition;

function SignedInGate() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Gate title="CHECKING PILOT ID" body="Confirming your sign-in before any expedition link opens." loading />;
  if (!isSignedIn) return <Gate title="SIGN IN TO FLY TOGETHER" body="Expeditions are server-run and record discoveries to your pilot account, so they need a signed-in pilot. The local trainer needs no account." signIn />;
  return <ExpeditionClient />;
}

function Gate({ title, body, signIn, loading }: { title: string; body: string; signIn?: boolean; loading?: boolean }) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center bg-void px-4 text-bone" data-testid="screen-expedition-gate">
      <CommandBackdrop />
      <CommandPanel accent className="relative w-full max-w-md p-6">
        <PanelLabel>SECTOR EXPEDITION</PanelLabel>
        <h1 className="mt-2 font-hud text-4xl leading-none">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-bone/85" role={loading ? "status" : undefined}>{body}</p>
        <div className="mt-5 flex flex-col gap-2">
          {signIn ? <Link href="/sign-in" className="wfm-cmd wfm-cmd-primary min-h-12 justify-center font-hud tracking-widest">SIGN IN</Link> : null}
          {!loading ? <Link href="/flight" className="wfm-cmd wfm-cmd-secondary min-h-12 justify-center font-hud tracking-widest">LOCAL TRAINER · OFFLINE</Link> : null}
          {!loading ? <Link href="/" className="wfm-cmd wfm-cmd-quiet min-h-11 justify-center font-hud text-sm tracking-widest">COMMAND</Link> : null}
        </div>
      </CommandPanel>
    </main>
  );
}

// ---------------------------------------------------------------------------

function ExpeditionClient() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [view, setView] = useState<View>("select");
  const [missionId, setMissionId] = useState<SectorMissionId>("rust-disc");
  const [shipId, setShipId] = useState<ShipId>("glide");
  const [codeInput, setCodeInput] = useState("");
  const [snapshot, setSnapshot] = useState<SectorSnapshot | null>(null);
  const [progress, setProgress] = useState<SectorProgress | null>(null);
  const [connection, setConnection] = useState<Connection>("connected");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const snapshotRef = useRef<SectorSnapshot | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const seq = useRef(createSeqCounter()).current;
  const authedRef = useRef(false);
  const joinedRef = useRef(false);
  const intentionalRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const lastUiRef = useRef(0);
  const openRef = useRef<(s: Session) => void>(() => undefined);

  const clearTimers = () => { timersRef.current.forEach(t => window.clearTimeout(t)); timersRef.current = []; };

  const closeSocket = useCallback(() => {
    intentionalRef.current = true;
    const ws = socketRef.current; socketRef.current = null;
    authedRef.current = false;
    clearTimers();
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000, "leave");
  }, []);

  const fail = useCallback((message: string) => {
    closeSocket();
    deadlineRef.current = null;
    setError(message); setView("error"); setConnection("lost");
  }, [closeSocket]);

  const send = useCallback((packet: SectorClientPacket) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !authedRef.current) return false;
    try { ws.send(JSON.stringify(packet)); return true; } catch { return false; }
  }, []);

  const scheduleReconnect = useCallback((session: Session) => {
    const now = Date.now();
    if (deadlineRef.current === null) deadlineRef.current = now + SECTOR_RECONNECT_WINDOW_MS;
    if (now >= deadlineRef.current) {
      fail("Expedition link interrupted. Your seat could not be recovered within five seconds. Start a new room to fly again.");
      return;
    }
    setConnection("reconnecting");
    timersRef.current.push(window.setTimeout(() => openRef.current(session), 700));
  }, [fail]);

  const handleSnapshot = useCallback((snap: SectorSnapshot) => {
    const prev = snapshotRef.current;
    snapshotRef.current = snap;
    joinedRef.current = true;
    deadlineRef.current = null;
    setConnection("connected");
    const nowMs = performance.now();
    if (!prev || prev.phase !== snap.phase || prev.pilots.length !== snap.pilots.length || nowMs - lastUiRef.current > 250 || snap.phase !== "active") {
      lastUiRef.current = nowMs;
      setSnapshot(snap);
      setProgress(snap.progress);
    }
    setView(snap.phase === "lobby" ? "lobby" : snap.phase === "active" ? "flight" : "debrief");
  }, []);

  const open = useCallback((session: Session) => {
    let url: URL;
    try { url = sectorSocketUrl(currentWingSocketUrl(), session.missionId, session.room); }
    catch (e) { fail(e instanceof Error ? e.message : "The expedition server address is invalid."); return; }
    intentionalRef.current = false;
    authedRef.current = false;
    seq.reset();
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { scheduleOrFail(); return; }
    socketRef.current = ws;
    let gotSnapshot = false;
    const handshake = window.setTimeout(() => { if (socketRef.current === ws && !gotSnapshot) ws.close(1000, "timeout"); }, HANDSHAKE_TIMEOUT_MS);
    timersRef.current.push(handshake);

    function scheduleOrFail() {
      if (joinedRef.current) scheduleReconnect(session);
      else fail("The expedition server is unavailable right now. Nothing was recorded. Try again shortly.");
    }

    ws.addEventListener("open", () => {
      void getTokenRef.current().then(token => {
        if (socketRef.current !== ws || ws.readyState !== WebSocket.OPEN) return;
        if (!token) { fail("Your sign-in session could not be verified. Sign in again before joining an expedition."); return; }
        ws.send(JSON.stringify({ type: "authenticate", token }));
      }).catch(() => { if (socketRef.current === ws) fail("Could not verify your sign-in session. Check your connection and try again."); });
    });
    ws.addEventListener("message", event => {
      if (socketRef.current !== ws) return;
      let packet: { type?: unknown; code?: unknown; reason?: unknown; message?: unknown };
      try { packet = JSON.parse(String(event.data)); } catch { return; }
      if (packet.type === "authenticated") {
        if (authedRef.current) return;
        authedRef.current = true;
        send({ type: "sector_join", version: 1, shipId: session.shipId });
        return;
      }
      if (packet.type === "sector_snapshot") {
        const snap = parseSectorSnapshot(packet);
        if (!snap) { fail("The expedition server sent an incompatible snapshot. Reload to update the client."); return; }
        gotSnapshot = true;
        handleSnapshot(snap);
        return;
      }
      if (packet.type === "error" || packet.type === "sector_error" || packet.type === "auth_error") {
        const code = String(packet.code ?? packet.reason ?? packet.type);
        const message = typeof packet.message === "string" && packet.message.length < 240 ? packet.message : "";
        if (packet.type === "auth_error" || isTerminalError(code)) {
          fail(message || describeTerminal(code));
        } else {
          setNotice(message || "The server rejected that request.");
        }
      }
    });
    ws.addEventListener("close", event => {
      window.clearTimeout(handshake);
      if (socketRef.current !== ws) return;
      socketRef.current = null; authedRef.current = false;
      if (intentionalRef.current) return;
      if (isTerminalClose(event.code)) { fail(describeTerminal(event.reason || String(event.code))); return; }
      const phase = snapshotRef.current?.phase;
      if (phase === "complete" || phase === "interrupted") return;
      scheduleOrFail();
    });
  }, [fail, handleSnapshot, scheduleReconnect, send, seq]);
  openRef.current = open;

  useEffect(() => () => closeSocket(), [closeSocket]);

  const start = (room: string) => {
    const code = normalizeRoomCode(room);
    if (!isValidRoomCode(code)) { setNotice("Invitation codes are 6-24 letters, numbers or hyphens."); return; }
    const mission = sectorMission(missionId);
    if (!mission) return;
    if (missionLockState(mission, progress) === "locked") { setNotice("Complete the prerequisite mission first."); return; }
    closeSocket();
    const session = { missionId, room: code, shipId };
    sessionRef.current = session;
    snapshotRef.current = null; joinedRef.current = false; deadlineRef.current = null;
    setSnapshot(null); setError(""); setNotice(""); setConnection("connected"); setView("connecting");
    open(session);
  };
  const leave = () => {
    closeSocket();
    snapshotRef.current = null; joinedRef.current = false; sessionRef.current = null;
    setSnapshot(null); setView("select"); setConnection("connected"); setNotice("");
  };
  const newRoom = () => { const keepMission = snapshot?.missionId ?? missionId; setMissionId(keepMission); leave(); setCodeInput(generateRoomCode()); };

  const sendInputRef = useRef((input: FlightInput) => {
    if (snapshotRef.current?.phase !== "active") return;
    send({ type: "sector_input", seq: seq.next(), input });
  });
  sendInputRef.current = (input: FlightInput) => {
    if (snapshotRef.current?.phase !== "active") return;
    send({ type: "sector_input", seq: seq.next(), input });
  };

  const activeMission = sectorMission(snapshot?.missionId ?? sessionRef.current?.missionId ?? missionId) ?? SECTOR_MISSIONS[0]!;
  const transport = useMemo<ExpeditionTransport>(() => ({
    snapshotRef, mission: activeMission, connection,
    sendInput: input => sendInputRef.current(input),
    onExit: leave,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeMission, connection]);

  if (view === "flight" && snapshotRef.current) {
    return <RustDiscFlight key={`${snapshotRef.current.roomCode}-${activeMission.id}`} expedition={transport} />;
  }

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-void text-bone" data-testid="screen-expedition">
      <CommandBackdrop dense />
      <div className="wfm-safe relative mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-8">
        <header className="flex flex-wrap items-center gap-3 border-b border-bone/10 pb-3 pr-12">
          <Link href="/" className="font-hud text-xs tracking-[0.25em] text-muted hover:text-bone">COMMAND</Link>
          <span className="text-bone/30">/</span>
          <p className="font-hud text-xs tracking-[0.25em] text-solar">SECTOR EXPEDITION · CO-OP 1-8 · SERVER-RUN</p>
          <Link href="/flight" className="ml-auto font-hud text-[11px] tracking-[0.2em] text-muted hover:text-bone">LOCAL TRAINER</Link>
        </header>

        {notice ? <p role="alert" className="mt-4 border-l-2 border-[#ff7a5c] bg-[#ff7a5c]/10 px-3 py-2 text-sm">{notice}</p> : null}

        {view === "select" ? (
          <Select missionId={missionId} setMissionId={setMissionId} progress={progress} shipId={shipId} setShipId={setShipId}
            code={codeInput} setCode={setCodeInput} onCreate={() => start(codeInput && isValidRoomCode(normalizeRoomCode(codeInput)) ? codeInput : generateRoomCode())} onJoin={() => start(codeInput)} />
        ) : null}
        {view === "connecting" ? <Connecting room={sessionRef.current?.room ?? ""} reconnecting={connection === "reconnecting"} onCancel={leave} /> : null}
        {view === "lobby" && snapshot ? (
          <Lobby snap={snapshot} connection={connection}
            onReady={ready => send({ type: "sector_ready", ready })}
            onLaunch={() => send({ type: "sector_launch" })} onLeave={leave} />
        ) : null}
        {view === "debrief" && snapshot ? (
          <Debrief snap={snapshot} onRetry={() => { if (!send({ type: "sector_retry" })) setNotice("The expedition link is closed, so settlement cannot be retried from here. The server keeps pending records."); }}
            onNewRoom={newRoom} onLeave={leave} />
        ) : null}
        {view === "error" ? (
          <CommandPanel accent className="mt-8 max-w-xl p-6" data-testid="panel-expedition-error">
            <PanelLabel tone="solar">EXPEDITION LINK</PanelLabel>
            <p className="mt-2 font-hud text-3xl leading-none text-[#ff7a5c]">{connection === "lost" ? "DISCONNECTED" : "UNAVAILABLE"}</p>
            <p className="mt-3 text-sm leading-relaxed text-bone/85" role="alert">{error}</p>
            <p className="mt-2 text-xs text-muted">This screen never switches to a local simulation. Online results only come from the server.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={newRoom} className="wfm-cmd wfm-cmd-primary min-h-12 justify-center font-hud tracking-widest">NEW ROOM</button>
              <button type="button" onClick={leave} className="wfm-cmd wfm-cmd-secondary min-h-12 justify-center font-hud tracking-widest">MISSION SELECT</button>
            </div>
          </CommandPanel>
        ) : null}
      </div>
    </main>
  );
}

function describeTerminal(code: string): string {
  if (/auth|token/i.test(code)) return "Your sign-in could not be verified by the expedition server. Sign in again, then start a new room.";
  if (/reservation|expired/i.test(code)) return "Your seat reservation expired. Start a new room to fly again.";
  if (/locked|prerequisite/i.test(code)) return "That mission is locked for your account. Complete its prerequisite first.";
  if (/full/i.test(code)) return "That expedition already has eight pilots.";
  if (/version/i.test(code)) return "This client is out of date for the expedition server. Reload the page.";
  return "The expedition server closed the link under its access policy. Start a new room to try again.";
}

// ---------- Select ----------
const LOCK_LABEL: Record<MissionLock, string> = { open: "OPEN", locked: "LOCKED", complete: "RECORDED", unknown: "SERVER CHECKS ON JOIN" };

function Select(props: {
  missionId: SectorMissionId; setMissionId: (m: SectorMissionId) => void; progress: SectorProgress | null;
  shipId: ShipId; setShipId: (s: ShipId) => void; code: string; setCode: (c: string) => void; onCreate: () => void; onJoin: () => void;
}) {
  const selected = sectorMission(props.missionId)!;
  const lock = missionLockState(selected, props.progress);
  const pal = FACTION_PALETTE[SHIPS[props.shipId].faction];
  const code = normalizeRoomCode(props.code);
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section>
        <h1 className="font-hud text-5xl leading-[0.9] sm:text-6xl">THE ROUTE<br />TO MARS</h1>
        <p className="mt-2 max-w-lg text-sm text-bone/80">Three sectors, flown together. Each recorded clear opens the next for your account. No friendly fire, no PvP, one shared sentinel.</p>
        <p className="mt-2 font-hud text-[11px] tracking-[0.2em] text-muted" data-testid="text-progress">
          {props.progress
            ? `ACCOUNT PROGRESS · ${props.progress.completed.length}/${SECTOR_MISSIONS.length} RECORDED${props.progress.persistenceAvailable ? "" : " · RECORDS UNAVAILABLE"}`
            : "ACCOUNT PROGRESS LOADS FROM THE SERVER WHEN YOU CONNECT"}
        </p>
        <ol className="relative mt-6 space-y-3 pl-6" data-testid="list-missions">
          <span aria-hidden="true" className="absolute bottom-6 left-[9px] top-6 w-px bg-gradient-to-b from-spectral via-solar to-[#ff7a5c]/60" />
          {SECTOR_MISSIONS.map(m => {
            const st = missionLockState(m, props.progress);
            const on = m.id === props.missionId;
            return (
              <li key={m.id} className="relative">
                <span aria-hidden="true" className={`absolute -left-6 top-5 h-[19px] w-[19px] rotate-45 border-2 ${st === "complete" ? "border-solar bg-solar" : st === "locked" ? "border-bone/30 bg-void" : "border-spectral bg-void"}`} />
                <button type="button" disabled={st === "locked"} onClick={() => props.setMissionId(m.id)} aria-pressed={on} data-testid={`button-mission-${m.id}`}
                  className={`w-full border p-4 text-left transition-transform active:scale-[0.99] disabled:opacity-45 ${on ? "border-solar bg-solar/10" : "border-bone/15 bg-void/60"}`}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-hud text-xs tracking-[0.25em] text-muted">SECTOR {String(missionNumber(m.id)).padStart(2, "0")}</span>
                    <span className={`font-hud text-[10px] tracking-[0.2em] ${st === "complete" ? "text-solar" : st === "locked" ? "text-[#ff7a5c]" : "text-spectral"}`}>{LOCK_LABEL[st]}</span>
                  </span>
                  <span className="mt-1 block font-hud text-2xl leading-none">{m.title.toUpperCase()}</span>
                  <span className="mt-1 block text-sm text-bone/75">{m.description}</span>
                  {m.prerequisite ? <span className="mt-2 block font-hud text-[10px] tracking-[0.2em] text-muted">REQUIRES {sectorMission(m.prerequisite)!.title.toUpperCase()}</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <CommandPanel accent className="p-4" data-testid="panel-expedition-join">
        <PanelLabel>HULL · {SHIPS[props.shipId].faction === "ussf" ? "USSF" : "THE ACCORD"}</PanelLabel>
        <div className="mt-2 flex items-center gap-3">
          <ShipIllustration ship={props.shipId} caption={false} grid={false} className="h-20 w-20 shrink-0" />
          <div>
            <p className="font-hud text-3xl leading-none" style={{ color: pal.accent }}>{SHIPS[props.shipId].name.toUpperCase()}</p>
            <p className="text-xs text-muted">{SHIPS[props.shipId].role}</p>
          </div>
        </div>
        {(["ussf", "accord"] as const).map(f => (
          <div key={f} className="mt-2 grid grid-cols-4 gap-1">
            {ROSTER[f].map(id => (
              <button key={id} type="button" onClick={() => props.setShipId(id)} data-testid={`button-exp-hull-${id}`}
                className="min-h-11 border px-1 font-hud text-[10px] tracking-wider"
                style={{ borderColor: id === props.shipId ? FACTION_PALETTE[f].accent : "rgba(230,225,214,0.16)", background: id === props.shipId ? `${FACTION_PALETTE[f].accent}22` : "transparent", color: FACTION_PALETTE[f].accent }}>
                {SHIPS[id].name.toUpperCase()}
              </button>
            ))}
          </div>
        ))}

        <div className="mt-5 border-t border-bone/10 pt-4">
          <PanelLabel>INVITATION · {selected.title.split("·")[0]!.trim().toUpperCase()}</PanelLabel>
          <label htmlFor="exp-code" className="sr-only">Invitation code</label>
          <input id="exp-code" data-testid="input-expedition-code" autoComplete="off" autoCapitalize="characters" maxLength={24}
            value={props.code} onChange={e => props.setCode(e.target.value.toUpperCase())} placeholder="6-24 LETTERS, NUMBERS, -"
            className="mt-2 h-12 w-full border border-bone/30 bg-void px-3 font-hud text-lg tracking-[0.2em] text-bone placeholder:text-sm placeholder:text-muted" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={lock === "locked"} onClick={props.onCreate} data-testid="button-expedition-create"
              className="wfm-cmd wfm-cmd-primary wfm-chamfer min-h-12 justify-center font-hud tracking-widest disabled:opacity-50">CREATE ROOM</button>
            <button type="button" disabled={lock === "locked" || !isValidRoomCode(code)} onClick={props.onJoin} data-testid="button-expedition-join"
              className="wfm-cmd wfm-cmd-secondary min-h-12 justify-center font-hud tracking-widest disabled:opacity-50">JOIN CODE</button>
          </div>
          <p className="mt-2 text-xs text-muted">Create uses the code above if valid, otherwise a fresh one. Share it with up to seven pilots. Expeditions award 0 credits; they record discoveries and unlocks only.</p>
        </div>
      </CommandPanel>
    </div>
  );
}

function Connecting({ room, reconnecting, onCancel }: { room: string; reconnecting: boolean; onCancel: () => void }) {
  return (
    <div className="mt-16 max-w-md" role="status" data-testid="status-expedition-connecting">
      <p className="font-hud text-xs tracking-[0.3em] text-muted">ROOM {room}</p>
      <p className="mt-2 flex items-center gap-3 font-hud text-3xl"><span className="wfm-blink h-3 w-3 bg-solar" aria-hidden="true" />{reconnecting ? "RECOVERING SEAT" : "AUTHENTICATING"}</p>
      <div className="mt-4 space-y-1.5">{[0, 1, 2].map(i => <div key={i} className="h-3 animate-pulse bg-bone/10" style={{ width: `${88 - i * 21}%` }} />)}</div>
      <button type="button" onClick={onCancel} className="wfm-cmd wfm-cmd-quiet mt-6 min-h-11 px-4 font-hud text-sm tracking-widest">CANCEL</button>
    </div>
  );
}

// ---------- Lobby ----------
function Lobby({ snap, connection, onReady, onLaunch, onLeave }: {
  snap: SectorSnapshot; connection: Connection; onReady: (r: boolean) => void; onLaunch: () => void; onLeave: () => void;
}) {
  const mission = sectorMission(snap.missionId)!;
  const own = snap.pilots.find(p => p.slot === snap.ownSlot);
  const host = snap.ownSlot === snap.hostSlot;
  const connected = snap.pilots.filter(p => p.connected);
  const allReady = connected.length > 0 && connected.every(p => p.ready);
  const [copied, setCopied] = useState(false);
  const copy = () => { void navigator.clipboard?.writeText(snap.roomCode).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1400); }).catch(() => undefined); };
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]" data-testid="screen-expedition-lobby">
      <section>
        <p className="font-hud text-xs tracking-[0.3em] text-muted">SECTOR {String(missionNumber(mission.id)).padStart(2, "0")} · LOBBY</p>
        <h1 className="mt-1 font-hud text-4xl leading-none">{mission.title.toUpperCase()}</h1>
        <p className="mt-2 text-sm text-bone/80">{mission.description}</p>
        <button type="button" onClick={copy} data-testid="button-copy-code" className="mt-5 block w-full border border-dashed border-solar/60 bg-solar/5 px-4 py-3 text-left">
          <span className="block font-hud text-[10px] tracking-[0.3em] text-muted">INVITATION CODE · TAP TO COPY</span>
          <span className="block font-hud text-4xl tracking-[0.15em] text-solar" data-testid="text-room-code">{snap.roomCode}</span>
          <span className="block font-hud text-[10px] tracking-[0.2em] text-muted">{copied ? "COPIED" : `${snap.pilots.length}/${SECTOR_MAX_PILOTS} SEATS`}</span>
        </button>
        {connection !== "connected" ? <p role="alert" className="mt-3 font-hud text-xs tracking-[0.2em] text-[#ff7a5c]">LINK INTERRUPTED · RECOVERING SEAT</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onReady(!own?.ready)} data-testid="button-ready"
            className={`wfm-cmd min-h-14 justify-center font-hud text-lg tracking-widest ${own?.ready ? "wfm-cmd-secondary" : "wfm-cmd-primary"}`}>{own?.ready ? "STAND DOWN" : "READY"}</button>
          <button type="button" disabled={!host || !allReady} onClick={onLaunch} data-testid="button-host-launch"
            className="wfm-cmd wfm-cmd-primary wfm-chamfer min-h-14 justify-center font-hud text-lg tracking-widest disabled:opacity-40">LAUNCH</button>
        </div>
        <p className="mt-2 text-xs text-muted">{host ? (allReady ? "All connected pilots are ready. Launch when the wing is set." : "You host this room. Launch unlocks when every connected pilot is ready.") : "The host launches once every connected pilot is ready."}</p>
        <button type="button" onClick={onLeave} className="wfm-cmd wfm-cmd-quiet mt-4 min-h-11 px-4 font-hud text-sm tracking-widest">LEAVE ROOM</button>
      </section>
      <CommandPanel className="p-4" data-testid="panel-roster">
        <PanelLabel>WING ROSTER · SLOTS ONLY</PanelLabel>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {Array.from({ length: SECTOR_MAX_PILOTS }, (_, slot) => {
            const p = snap.pilots.find(x => x.slot === slot);
            if (!p) return <li key={slot} className="flex min-h-16 items-center border border-dashed border-bone/10 px-3 font-hud text-xs tracking-[0.25em] text-bone/25">{slotLabel(slot)} · OPEN</li>;
            const accent = FACTION_PALETTE[SHIPS[p.shipId].faction].accent;
            return (
              <li key={slot} className="flex min-h-16 items-center gap-2 border bg-void/60 px-2" style={{ borderColor: `${accent}55`, opacity: p.connected ? 1 : 0.5 }} data-testid={`roster-slot-${slot}`}>
                <ShipIllustration ship={p.shipId} caption={false} grid={false} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-hud text-sm tracking-[0.15em]">{slotLabel(slot)}{slot === snap.ownSlot ? " · YOU" : ""}{slot === snap.hostSlot ? " · HOST" : ""}</p>
                  <p className="font-hud text-[10px] tracking-[0.2em]" style={{ color: accent }}>{SHIPS[p.shipId].name.toUpperCase()}</p>
                </div>
                <span className={`font-hud text-[10px] tracking-[0.2em] ${!p.connected ? "text-[#ff7a5c]" : p.ready ? "text-solar" : "text-muted"}`}>{!p.connected ? "LINK LOST" : p.ready ? "READY" : "STANDBY"}</span>
              </li>
            );
          })}
        </ul>
      </CommandPanel>
    </div>
  );
}

// ---------- Debrief ----------
const SETTLEMENT_COPY: Record<SectorSnapshot["settlement"]["status"], [string, string]> = {
  not_started: ["NOT STARTED", "The server has not begun recording this expedition."],
  pending: ["PENDING", "The server is writing the discovery to your account."],
  recorded: ["RECORDED", "Discovery and mission unlock saved to your account."],
  unavailable: ["UNAVAILABLE", "Records are temporarily unavailable. Retry asks the server to persist again; nothing is replayed."],
  not_eligible: ["NOT ELIGIBLE", "This run does not qualify for a record."],
};

function Debrief({ snap, onRetry, onNewRoom, onLeave }: { snap: SectorSnapshot; onRetry: () => void; onNewRoom: () => void; onLeave: () => void }) {
  const mission = sectorMission(snap.missionId)!;
  const own = snap.pilots.find(p => p.slot === snap.ownSlot);
  const won = snap.phase === "complete";
  const [label, line] = SETTLEMENT_COPY[snap.settlement.status];
  const next = SECTOR_MISSIONS.find(m => m.prerequisite === mission.id);
  const rows: [string, ReactNode][] = [
    ["MISSION", mission.title.toUpperCase()],
    ["WING", `${snap.pilots.length} PILOT${snap.pilots.length === 1 ? "" : "S"}`],
    ["YOUR HULL", own ? `${Math.round(own.flight.hull)}% · ${SHIPS[own.shipId].name.toUpperCase()}` : "-"],
    ["DISCOVERIES", String(own?.flight.discoveries ?? 0)],
    ["CREDITS", "0 CR"],
    ["NEXT SECTOR", next ? (snap.progress.completed.includes(mission.id) ? `${next.title.toUpperCase()} · OPEN` : `${next.title.toUpperCase()} · LOCKED`) : "ROUTE COMPLETE"],
  ];
  return (
    <div className="mt-8 max-w-2xl" data-testid="screen-expedition-debrief">
      <p className="font-hud text-xs tracking-[0.3em] text-muted">ROOM {snap.roomCode} · SERVER DEBRIEF</p>
      <h1 className={`font-hud text-6xl leading-none ${won ? "text-solar" : "text-[#ff7a5c]"}`}>{won ? "SECTOR CLEARED" : "INTERRUPTED"}</h1>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-y border-bone/15 py-3 font-hud text-sm">
        {rows.map(([k, v]) => <div key={k} className="contents"><dt className="tracking-[0.2em] text-muted">{k}</dt><dd className="text-right">{v}</dd></div>)}
      </dl>
      <div className={`mt-4 border-l-2 px-3 py-2 ${snap.settlement.status === "recorded" ? "border-solar bg-solar/10" : snap.settlement.status === "unavailable" ? "border-[#ff7a5c] bg-[#ff7a5c]/10" : "border-spectral bg-spectral/10"}`} data-testid="status-settlement">
        <p className="font-hud text-sm tracking-[0.25em]">RECORD · {label}{snap.settlement.replayed ? " · ALREADY SAVED" : ""}</p>
        <p className="text-sm text-bone/80">{snap.settlement.reason || line}</p>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {snap.settlement.status === "unavailable" || snap.settlement.status === "pending" ? (
          <button type="button" onClick={onRetry} data-testid="button-settlement-retry" className="wfm-cmd wfm-cmd-primary min-h-12 justify-center font-hud tracking-widest">RETRY RECORD</button>
        ) : null}
        <button type="button" onClick={onNewRoom} data-testid="button-new-room" className="wfm-cmd wfm-cmd-secondary min-h-12 justify-center font-hud tracking-widest">NEW ROOM</button>
        <button type="button" onClick={onLeave} className="wfm-cmd wfm-cmd-quiet min-h-12 justify-center font-hud tracking-widest">MISSION SELECT</button>
      </div>
    </div>
  );
}
