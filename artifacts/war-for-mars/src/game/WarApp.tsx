import { useEffect, useRef, useState } from "react";
import { Arena, type StrikeResult, type OnlineRoom } from "./Arena";
import { armGyro, disarmGyro } from "./gyro";
import { applyBuy, applyDock, dockValue, GOODS, scrapValue, winBid, type GoodId } from "./market";
import { applyRefit, loadSave, refitCost, writeSave, type Save } from "./save";
import { refitMul, ROSTER, SHIPS, type Faction, type Scheme, type ShipId } from "./ships";
import { sfxUi, unlockAudio } from "./audio";
import { claimStrike } from "./claim-strike";
import { DISPATCHES, SORTIES, sortieById, sortieUnlocked, TECHS, type TechId } from "./campaign";
import { HomeScreen } from "./HomeScreen";
import { OnlineLobby, type LobbyState } from "./OnlineLobby";
import type { StepInput } from "./sim";
import { MenuState, nextMenu, type MenuAction, type MenuStateId } from "./menu";

type Phase = "brief" | "fight" | "debrief";
type RoomEnvelope = {
  tick: number;
  time: number;
  players: Array<{ slotId: number; lastSeq: number; [key: string]: unknown }>;
  match: import("./sim").Match;
};
type LobbySession = {
  socket: WebSocket;
  roomId: string;
  slotId: number;
  team: 0 | 1;
  reconnectToken: string;
  name: string;
  lobby: LobbyState;
  ready: boolean;
};

const emptySave = (): Save => ({
  v: 1,
  credits: 90,
  ship: "mandjet",
  faction: "accord",
  scheme: "arc",
  refit: 0,
  prices: { salt: 40, iron: 70, dust: 110, resin: 55 },
  hold: null,
  paid: 0,
  pace: "practice",
  gyro: false,
  drilled: false,
  mission: "contact",
  cleared: 0,
  tech: null,
});

export function WarApp() {
  const [save, setSave] = useState<Save>(emptySave);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("brief");
  const [shell, setShell] = useState<MenuStateId>(MenuState.BOOT);
  const [sortie, setSortie] = useState(0);
  const [result, setResult] = useState<StrikeResult | null>(null);
  const [gain, setGain] = useState(0);
  const [cargoLine, setCargoLine] = useState("");
  const [advance, setAdvance] = useState("");
  const [onlineSession, setOnlineSession] = useState<OnlineRoom | null>(null);
  const [onlineLobby, setOnlineLobby] = useState<LobbySession | null>(null);
  const [onlineStatus, setOnlineStatus] = useState("");
  const [offlineAvailable, setOfflineAvailable] = useState(false);
  const [roomCode, setRoomCode] = useState(
    () => new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() ?? "",
  );
  const joinSocketRef = useRef<WebSocket | null>(null);
  const joinTimeoutRef = useRef<number | null>(null);
  const lobbyRetryRef = useRef<number | null>(null);

  const failOnline = (reason: string) => {
    if (joinTimeoutRef.current != null) window.clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = null;
    if (lobbyRetryRef.current != null) window.clearTimeout(lobbyRetryRef.current);
    lobbyRetryRef.current = null;
    joinSocketRef.current?.close();
    joinSocketRef.current = null;
    setOnlineLobby(null);
    setOnlineSession(null);
    setOnlineStatus(reason);
    setOfflineAvailable(true);
  };

  const beginOnline = (socket: WebSocket, packet: Record<string, unknown>, roomId: string) => {
    const snapshot = packet.snapshot as RoomEnvelope | undefined;
    const slotId = Number(packet.slotId);
    if (!snapshot?.match || !Number.isInteger(slotId)) {
      failOnline("The room sent an invalid match state. Rejoin or create another room.");
      return;
    }
    const reconnectToken = String(packet.reconnectToken ?? "");
    if (reconnectToken) {
      try {
        sessionStorage.setItem(`wfm-room-${roomId}`, reconnectToken);
      } catch {
        // The live socket still reconnects; storage may be disabled in private browsing.
      }
    }
    setOnlineLobby(null);
    setOnlineSession({
      socket,
      snapshot,
      roomId,
      slotId,
      team: Number(packet.team) as 0 | 1,
      reconnectToken,
      name: "Pilot",
    });
    setOnlineStatus("");
    setResult(null);
    setPhase("fight");
    setShell(MenuState.GAMEPLAY);
  };

  const showOnlineError = (code: string) => {
    const messages: Record<string, string> = {
      capacity: "The server is at room capacity. Try again later.",
      full: "That room already has ten pilots. Join another room.",
      match_started: "That match has already started. Use a new room code for a new lobby.",
      session_lost: "That match session is no longer available. Create a new room.",
      host_only: "Only the lobby host can launch the match.",
      pilots_not_ready: "Every connected pilot must ready up before launch.",
      invalid_input: "The server rejected an invalid control packet.",
      rate_limited: "Too many messages were sent. Reconnect and try again.",
    };
    return messages[code] ?? "Could not connect to that room. Check the code and try again.";
  };

  const joinOnline = (requestedRoomCode: string) => {
    if (joinSocketRef.current || onlineLobby || onlineSession) return;
    const normalizedRoomCode = requestedRoomCode.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{5,23}$/.test(normalizedRoomCode)) {
      setOnlineStatus("Enter a room code (6–24 letters, numbers, or hyphens).");
      return;
    }
    setRoomCode(normalizedRoomCode);
    unlockAudio();
    setOnlineStatus("Calling the wing…");
    setOfflineAvailable(false);
    let url: URL;
    try {
      url = new URL(`${import.meta.env.BASE_URL}ws`, window.location.href);
      url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("room", normalizedRoomCode.toLowerCase());
      const roomPath = `${window.location.pathname}?room=${encodeURIComponent(normalizedRoomCode)}`;
      window.history.replaceState({}, "", roomPath);
      let token = "";
      try {
        token = sessionStorage.getItem(`wfm-room-${normalizedRoomCode}`) ?? "";
      } catch {
        token = "";
      }
      let joined = false;
      let started = false;
      let retries = 0;
      let mySlotId: number | null = null;
      let myTeam: 0 | 1 = 0;
      joinTimeoutRef.current = window.setTimeout(() => {
        if (!joined) failOnline("Room connection timed out. Check your connection and retry.");
      }, 5000);

      const connect = (targetUrl: URL) => {
        if (started || retries > 5) return;
        const socket = new WebSocket(targetUrl);
        joinSocketRef.current = socket;
        socket.addEventListener("open", () => {
          if (joinSocketRef.current !== socket) return;
          socket.send(JSON.stringify({ type: "join", name: "Pilot", ...(token ? { reconnectToken: token } : {}) }));
        });
        socket.addEventListener("message", (event) => {
          let packet: { type?: string; [key: string]: unknown };
          try {
            packet = JSON.parse(String(event.data));
          } catch {
            return;
          }
          if (packet.type === "error") {
            if (started) return;
            const reason = String(packet.reason ?? "unavailable");
            if (reason === "match_not_started" || reason === "invalid_lobby_action") {
              setOnlineStatus(showOnlineError(reason));
              return;
            }
            if (reason === "host_only" || reason === "pilots_not_ready") {
              setOnlineStatus(showOnlineError(reason));
              return;
            }
            if (reason === "session_lost") {
              try {
                sessionStorage.removeItem(`wfm-room-${normalizedRoomCode}`);
              } catch {
                // A fresh room can still be created if storage is unavailable.
              }
            }
            failOnline(showOnlineError(reason));
            return;
          }
          if (packet.type === "joined") {
            joined = true;
            retries = 0;
            token = String(packet.reconnectToken ?? token);
            if (token) {
              try {
                sessionStorage.setItem(`wfm-room-${normalizedRoomCode}`, token);
              } catch {
                // The live socket can reconnect without browser storage.
              }
            }
            mySlotId = Number(packet.slotId);
            myTeam = Number(packet.team) as 0 | 1;
            const phase = packet.phase === "active" ? "active" : "lobby";
            if (phase === "active") {
              started = true;
              if (joinTimeoutRef.current != null) window.clearTimeout(joinTimeoutRef.current);
              joinTimeoutRef.current = null;
              beginOnline(socket, packet, normalizedRoomCode);
            } else {
              const snapshot = packet.snapshot as RoomEnvelope | undefined;
              const slotId = Number(packet.slotId);
              const team = Number(packet.team) as 0 | 1;
              if (!snapshot?.match || !Number.isInteger(slotId)) {
                failOnline("The room sent an invalid lobby state. Try another room.");
                return;
              }
              setOnlineLobby((previous) => ({
                socket,
                roomId: normalizedRoomCode,
                slotId,
                team,
                reconnectToken: token,
                name: "Pilot",
                ready: previous?.slotId === slotId ? previous.ready : false,
                lobby: previous?.lobby ?? {
                  phase: "lobby",
                  hostSlotId: slotId,
                  connectedCount: 1,
                  maxPlayers: 10,
                  players: snapshot.players.map((player) => ({
                    slotId: player.slotId,
                    team: (player.slotId < 5 ? 0 : 1) as 0 | 1,
                    connected: player.connected === true,
                    name: typeof player.name === "string" ? player.name : null,
                    ready: false,
                  })),
                },
              }));
              setOnlineStatus("");
              if (joinTimeoutRef.current != null) window.clearTimeout(joinTimeoutRef.current);
              joinTimeoutRef.current = null;
            }
            return;
          }
          if (packet.type === "lobby") {
            retries = 0;
            const lobby = packet as unknown as LobbyState;
            setOnlineLobby((previous) => previous ? {
              ...previous,
              lobby,
              ready: lobby.players.find((player) => player.slotId === previous.slotId)?.ready ?? previous.ready,
            } : previous);
            return;
          }
          if (packet.type === "started") {
            started = true;
            if (joinTimeoutRef.current != null) window.clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
            beginOnline(socket, {
              ...packet,
              slotId: mySlotId ?? -1,
              team: myTeam,
              reconnectToken: token,
            }, normalizedRoomCode);
          }
        });
        socket.addEventListener("close", () => {
          if (started || joinSocketRef.current !== socket) return;
          if (!joined) {
            failOnline("Room connection closed before joining. Check the room code and retry.");
            return;
          }
          retries += 1;
          setOnlineStatus("Signal lost · reconnecting (seat held for 5 seconds)");
          if (retries > 5) {
            failOnline("Could not reconnect before the seat hold expired. Rejoin the room.");
            return;
          }
          const delay = Math.min(2800, 450 * 2 ** (retries - 1));
          lobbyRetryRef.current = window.setTimeout(() => connect(targetUrl), delay);
        });
        socket.addEventListener("error", () => {
          if (!joined && joinSocketRef.current === socket) {
            setOnlineStatus("Connection failed · retrying…");
          }
        });
      };
      connect(url);
    } catch {
      failOnline("Could not open the room connection. Try again.");
    }
  };

  useEffect(() => () => {
    if (joinTimeoutRef.current != null) window.clearTimeout(joinTimeoutRef.current);
    if (lobbyRetryRef.current != null) window.clearTimeout(lobbyRetryRef.current);
    joinSocketRef.current?.close();
  }, []);

  useEffect(() => {
    setSave(loadSave());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeSave(save);
  }, [save, ready]);

  useEffect(() => {
    if (shell !== MenuState.BOOT) return;
    const id = window.setTimeout(() => setShell(MenuState.TITLE), 800);
    return () => window.clearTimeout(id);
  }, [shell]);

  useEffect(() => {
    if (shell !== MenuState.LOADING) return;
    const id = window.setTimeout(() => {
      setResult(null);
      setPhase("fight");
      setShell(MenuState.GAMEPLAY);
    }, 1100);
    return () => window.clearTimeout(id);
  }, [shell]);

  const act = (action: MenuAction) => {
    if (shell === MenuState.LOADING) return;
    unlockAudio();
    sfxUi();
    setOfflineAvailable(false);
    setOnlineStatus("");
    if (action === "ARCADE") setSave((prev) => ({ ...prev, mission: "skirmish" }));
    setShell((prev) => nextMenu(prev, action));
  };

  const ship = SHIPS[save.ship];
  const cost = refitCost(save.refit);
  const bonus = refitMul(save.refit);
  const active = sortieById(save.mission);
  const pace = active?.pace ?? save.pace;
  const goal = active?.goal ?? "disc";

  const pickFaction = (faction: Faction) => {
    setSave((prev) => ({
      ...prev,
      faction,
      ship: ROSTER[faction].includes(prev.ship) ? prev.ship : ROSTER[faction][0],
    }));
  };

  const buy = (id: GoodId) => {
    setSave((prev) => applyBuy(prev, id));
  };

  const sellDock = () => {
    setSave((prev) => applyDock(prev));
  };

  const start = () => {
    if (shell === MenuState.LOADING) return;
    unlockAudio();
    setShell(MenuState.LOADING);
  };

  const finish = (next: StrikeResult, replay: { seed: number; inputs: StepInput[] }) => {
    if (onlineSession) {
      try {
        sessionStorage.removeItem(`wfm-room-${onlineSession.roomId}`);
      } catch {
        // A completed room does not need a browser-stored reconnect token.
      }
      setResult(next);
      setGain(0);
      setCargoLine("Live wing operation complete.");
      setAdvance("");
      setPhase("debrief");
      setOnlineSession(null);
      joinSocketRef.current = null;
      return;
    }
    const claim = {
      seed: replay.seed,
      shipId: save.ship,
      faction: save.faction,
      refit: save.refit,
      pace,
      goal,
      disc: active?.disc ?? "rust",
      allyCount: active?.allyCount ?? 4,
      foeCount: active?.foeCount ?? 5,
      tech: save.tech,
      inputs: replay.inputs,
      mission: save.mission,
      cleared: save.cleared,
      hold: save.hold,
      paid: save.paid,
      prices: save.prices,
    };
    void claimStrike({ data: claim })
      .then((grant) => {
        setAdvance(grant.advance);
        setCargoLine(grant.cargoLine);
        setGain(grant.gain);
        setResult({ outcome: grant.outcome, kills: grant.kills, deaths: next.deaths, relays: grant.relays, reason: next.reason });
        setSave((prev) => ({
          ...prev,
          credits: prev.credits + grant.gain,
          hold: null,
          paid: 0,
          prices: grant.prices,
          cleared: grant.cleared,
        }));
        setPhase("debrief");
      })
      .catch(() => {
        setAdvance("");
        setCargoLine("The yard did not log this strike.");
        setGain(0);
        setResult(next);
        setPhase("debrief");
      });
  };

  if (onlineLobby) {
    return (
      <OnlineLobby
        roomCode={onlineLobby.roomId}
        slotId={onlineLobby.slotId}
        lobby={onlineLobby.lobby}
        ready={onlineLobby.ready}
        status={onlineStatus}
        onReady={(ready) => {
          const socket = onlineLobby.socket;
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ready", ready }));
            setOnlineStatus("");
          } else {
            setOnlineStatus("Signal disconnected · reconnecting…");
          }
        }}
        onStart={() => {
          const socket = onlineLobby.socket;
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "start" }));
            setOnlineStatus("Launching the match…");
          } else {
            setOnlineStatus("Signal disconnected · reconnecting…");
          }
        }}
        onLeave={() => {
          if (lobbyRetryRef.current != null) window.clearTimeout(lobbyRetryRef.current);
          lobbyRetryRef.current = null;
          joinSocketRef.current?.close();
          joinSocketRef.current = null;
          try {
            sessionStorage.removeItem(`wfm-room-${onlineLobby.roomId}`);
          } catch {
            // The room can still be left when browser storage is unavailable.
          }
          window.history.replaceState({}, "", window.location.pathname);
          setOnlineLobby(null);
          setOnlineStatus("Left lobby.");
          setOfflineAvailable(false);
          setShell(MenuState.MAIN_MENU);
        }}
      />
    );
  }

  if (phase === "fight") {
    return (
      <Arena
        key={`${sortie}-${save.ship}-${save.scheme}-${save.refit}-${save.mission}-${pace}-${save.tech ?? "none"}`}
        shipId={save.ship}
        faction={save.faction}
        scheme={save.scheme}
        refit={save.refit}
        pace={pace}
        goal={goal}
        disc={active?.disc ?? "rust"}
        allyCount={active?.allyCount ?? 4}
        foeCount={active?.foeCount ?? 5}
        objective={
          active?.id === "cage"
            ? save.faction === "ussf"
              ? "COVER THE CAGE"
              : "STOP THE CAGE"
            : (active?.objective ?? "HOLD TWO RELAYS")
        }
        tech={save.tech}
        gyro={save.gyro}
        drilled={save.drilled}
        onDrill={() => setSave((prev) => (prev.drilled ? prev : { ...prev, drilled: true }))}
        onDone={finish}
        onNetworkExit={() => {
          try {
            if (onlineSession) sessionStorage.removeItem(`wfm-room-${onlineSession.roomId}`);
          } catch {
            // Keep the server-restart message visible even without browser storage.
          }
          setOnlineSession(null);
          joinSocketRef.current = null;
          setOnlineStatus("The match server restarted and this room could not be restored. Create a new room.");
          setOfflineAvailable(true);
          setResult(null);
          setPhase("brief");
          setShell(MenuState.MAIN_MENU);
        }}
        online={onlineSession ?? undefined}
      />
    );
  }

  if (phase === "debrief" && result) {
    const title =
      result.outcome === "win"
        ? goal === "extract"
          ? save.faction === "ussf"
            ? "Cage away"
            : "Cage stopped"
          : goal === "ace"
          ? "Warden down"
          : goal === "beacons"
            ? "Beacons held"
            : "Disc held"
        : result.outcome === "loss"
          ? goal === "extract"
            ? save.faction === "ussf"
              ? "Cage lost"
              : "Cage escaped"
            : "Wing lost"
          : "Split disc";
    return (
      <main className="mx-auto flex h-dvh max-w-xl flex-col justify-center gap-4 overflow-y-auto px-5 py-8">
        <p className="font-hud text-sm tracking-widest text-solar">DEBRIEF</p>
        <h1 className="font-hud text-5xl leading-none text-bone">{title}</h1>
        <p data-testid="text-result-reason" className="text-sm leading-relaxed text-solar">{result.reason}</p>
        <p className="text-sm leading-relaxed text-muted">
          {ship.name} came back with {result.kills} kills and {result.relays} relays. The hangar logged{" "}
          {gain} credits. {cargoLine || "No crate in the hold."} {advance}
        </p>
        <p className="font-hud text-2xl text-solar">{save.credits} CR</p>
        <button
          type="button"
          className="h-12 bg-solar font-hud text-lg tracking-widest text-void"
          onClick={() => {
            setSortie((n) => n + 1);
            start();
          }}
        >
          Fly again
        </button>
        <button
          type="button"
          className="h-12 border border-bone/30 font-hud text-lg tracking-widest text-bone"
          onClick={() => {
            setPhase("brief");
            setShell(MenuState.HANGAR);
          }}
        >
          Hangar
        </button>
      </main>
    );
  }

  if (shell !== MenuState.HANGAR && shell !== MenuState.GAMEPLAY) {
    return (
      <HomeScreen
        state={shell}
        tipIndex={sortie}
        faction={save.faction}
        ship={save.ship}
        scheme={save.scheme}
        gyro={save.gyro}
        refit={save.refit}
        credits={save.credits}
        tech={save.tech}
        cleared={save.cleared}
        refitLabel={save.refit >= 5 ? "REFIT MAX" : `REFIT +6% · ${cost}`}
        refitDisabled={save.refit >= 5 || save.credits < cost}
        onAction={act}
        onOnline={joinOnline}
        roomCode={roomCode}
        onRoomCode={setRoomCode}
        onCreateRoom={() => {
          const generated = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
          setRoomCode(generated);
          joinOnline(generated);
        }}
        onlineStatus={onlineStatus}
        offlineAvailable={offlineAvailable}
        onOfflineStrike={() => {
          unlockAudio();
          setOfflineAvailable(false);
          setOnlineStatus("Offline Strike · AI fills the wing.");
          setSave((prev) => ({ ...prev, mission: "skirmish", pace: "strike" }));
          setShell(MenuState.LOADING);
        }}
        onFaction={pickFaction}
        onShip={(id: ShipId) => setSave((prev) => ({ ...prev, ship: id }))}
        onScheme={(scheme: Scheme) => setSave((prev) => ({ ...prev, scheme }))}
        onGyro={() => {
          if (save.gyro) {
            disarmGyro();
            setSave((prev) => ({ ...prev, gyro: false }));
            return;
          }
          void armGyro().then((ok) => setSave((prev) => ({ ...prev, gyro: ok })));
        }}
        onTech={(id: TechId) =>
          setSave((prev) => ({ ...prev, tech: prev.tech === id ? null : id }))
        }
        onRefit={() => setSave((prev) => applyRefit(prev))}
      />
    );
  }

  const held = save.hold ? GOODS.find((good) => good.id === save.hold) : null;

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col px-4 pt-5">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-3">
      <header>
        <p className="font-hud text-sm tracking-widest text-solar">USSF VS THE ACCORD</p>
        <h1 className="font-hud text-5xl leading-none text-bone sm:text-6xl">WAR FOR MARS</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          The fleet that took Eon Dusk to Mars is gone. He is a prisoner of the Accord. Answer with three
          sorties, or take the open skirmish.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MissionButton
          label="Skirmish"
          detail={save.pace === "strike" ? "Six minutes" : "Two minutes"}
          active={save.mission === "skirmish"}
          locked={false}
          onClick={() => setSave((prev) => ({ ...prev, mission: "skirmish" }))}
        />
        {SORTIES.map((sortie) => {
          const locked = !sortieUnlocked(sortie.id, save.cleared);
          return (
            <MissionButton
              key={sortie.id}
              label={sortie.name}
              detail={locked ? "Locked" : sortie.objective.toLowerCase()}
              active={save.mission === sortie.id}
              locked={locked}
              onClick={() => {
                if (locked) return;
                setSave((prev) => ({ ...prev, mission: sortie.id }));
              }}
            />
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted">
        {active
          ? active.brief
          : save.pace === "strike"
            ? "Six-minute Strike: hold two relays to drain enemy integrity. Kills also drain it; the higher integrity bar wins at 0:00."
            : "Two-minute practice: learn the controls, capture relays, and break enemy integrity before the clock runs out."}
      </p>
      <section className="border border-bone/15 px-3 py-3">
        <p className="font-hud text-sm tracking-widest text-solar">YARD CHANNEL</p>
        <ul className="mt-2 flex flex-col gap-2">
          {DISPATCHES.filter((note) => save.cleared >= note.need).map((note) => (
            <li key={note.from} className="text-sm leading-snug text-bone/90">
              <span className="font-hud text-xs tracking-widest text-solar">{note.from}</span> {note.text}
            </li>
          ))}
        </ul>
      </section>
      <div className="grid grid-cols-3 gap-2">
        {TECHS.map((tech) => {
          const locked = save.cleared < tech.need;
          const on = save.tech === tech.id;
          return (
            <button
              key={tech.id}
              type="button"
              disabled={locked}
              onClick={() =>
                setSave((prev) => ({
                  ...prev,
                  tech: prev.tech === tech.id ? null : (tech.id as TechId),
                }))
              }
              className={
                on
                  ? "h-14 bg-solar px-2 text-left text-void"
                  : "h-14 border border-bone/20 bg-panel px-2 text-left text-bone disabled:opacity-40"
              }
            >
              <span className="block font-hud text-xs leading-none tracking-widest">{tech.name.toUpperCase()}</span>
              <span className={on ? "text-xs text-void/80" : "text-xs text-muted"}>{locked ? "Locked" : tech.detail}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FactionButton
          label="The Accord"
          detail="Solar, stealth, the rings"
          active={save.faction === "accord"}
          onClick={() => pickFaction("accord")}
        />
        <FactionButton
          label="USSF"
          detail="Sensors, wards, the glide"
          active={save.faction === "ussf"}
          onClick={() => pickFaction("ussf")}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ROSTER[save.faction].map((id) => {
          const def = SHIPS[id];
          const on = save.ship === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSave((prev) => ({ ...prev, ship: id }))}
              className={
                on
                  ? "border border-solar bg-panel px-3 py-2 text-left"
                  : "border border-bone/15 bg-void px-3 py-2 text-left"
              }
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-hud text-xl leading-none text-bone">{def.name}</span>
                <span className="font-hud text-sm tracking-widest text-solar">{def.ultShort}</span>
              </span>
              <span className="mt-1 block text-xs text-muted">
                {def.role} · HND {def.handling.toFixed(2)} · SPD {def.maxSpeed} · SHD {Math.round(def.shield * bonus)}
              </span>
              <span className="mt-1 block line-clamp-2 text-sm leading-snug text-bone/90">{def.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={
            save.scheme === "arc"
              ? "h-11 bg-solar px-4 font-hud tracking-widest text-void"
              : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone"
          }
          onClick={() => setSave((prev) => ({ ...prev, scheme: "arc" }))}
        >
          ARC
        </button>
        <button
          type="button"
          className={
            save.scheme === "strafe"
              ? "h-11 bg-solar px-4 font-hud tracking-widest text-void"
              : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone"
          }
          onClick={() => setSave((prev) => ({ ...prev, scheme: "strafe" }))}
        >
          STRAFE
        </button>
        <p className="text-xs text-muted">
          {save.scheme === "arc"
            ? "Left stick and A/D turn the nose. Right stick aims."
            : "Left stick slides. Right stick turns the nose."}
          {save.gyro ? " Tilt rolls the nose." : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={
            save.pace === "practice"
              ? "h-11 bg-solar px-4 font-hud tracking-widest text-void"
              : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone"
          }
          onClick={() => setSave((prev) => ({ ...prev, pace: "practice" }))}
        >
          PRACTICE 2:00
        </button>
        <button
          type="button"
          className={
            save.pace === "strike"
              ? "h-11 bg-solar px-4 font-hud tracking-widest text-void"
              : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone"
          }
          onClick={() => setSave((prev) => ({ ...prev, pace: "strike" }))}
        >
          STRIKE 6:00
        </button>
        <button
          type="button"
          className={
            save.gyro
              ? "h-11 bg-solar px-4 font-hud tracking-widest text-void"
              : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone"
          }
          onClick={() => {
            if (save.gyro) {
              disarmGyro();
              setSave((prev) => ({ ...prev, gyro: false }));
              return;
            }
            void armGyro().then((ok) => {
              setSave((prev) => ({ ...prev, gyro: ok }));
            });
          }}
        >
          {save.gyro ? "GYRO ON" : "GYRO"}
        </button>
      </div>

      <section className="border border-bone/15 bg-panel px-3 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-hud text-sm tracking-widest text-solar">PHOBOS YARD</p>
          <p className="text-xs text-muted">One crate. Prices move after each strike.</p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {GOODS.map((good) => {
            const price = save.prices[good.id];
            const mine = save.hold === good.id;
            return (
              <button
                key={good.id}
                type="button"
                disabled={!mine && (save.hold != null || save.credits < price)}
                onClick={() => buy(good.id)}
                className={
                  mine
                    ? "border border-solar px-2 py-2 text-left"
                    : "border border-bone/15 px-2 py-2 text-left disabled:opacity-40"
                }
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-hud text-sm text-bone">{good.name}</span>
                  <span className="font-hud text-sm text-solar">{price}</span>
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {mine ? "In the hold" : `Win pays ${winBid(price)}`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {held
            ? `${held.name} is aboard. A held disc pays ${winBid(save.prices[held.id])}. A loss scraps it for ${scrapValue(save.paid)}. The dock will take it now for ${dockValue(save.paid)}.`
            : "Buy a crate before you launch. Come back with the disc and the yard pays above the board."}
        </p>
        {held ? (
          <button
            type="button"
            className="mt-2 h-10 border border-bone/25 px-3 font-hud text-sm tracking-widest text-bone"
            onClick={sellDock}
          >
            Sell to the dock · {dockValue(save.paid)}
          </button>
        ) : null}
      </section>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-bone/15 bg-void py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-hud text-xl text-solar">{save.credits} CR</p>
          <button
            type="button"
            className="h-11 border border-bone/25 px-3 font-hud tracking-widest text-bone"
            onClick={() => act("BACK")}
          >
            MENU
          </button>
          <button
            type="button"
            disabled={save.refit >= 5 || save.credits < cost}
            className="h-11 border border-solar px-3 font-hud tracking-widest text-solar disabled:border-bone/20 disabled:text-muted"
            onClick={() => setSave((prev) => applyRefit(prev))}
          >
            {save.refit >= 5 ? "REFIT MAX" : `REFIT +6% · ${cost}`}
          </button>
        </div>
        <button
          type="button"
          className="h-14 bg-solar font-hud text-2xl tracking-widest text-void"
          onClick={() => {
            setSortie((n) => n + 1);
            start();
          }}
        >
          Start
        </button>
      </div>
    </main>
  );
}

function MissionButton({
  label,
  detail,
  active,
  locked,
  onClick,
}: {
  label: string;
  detail: string;
  active: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={
        active
          ? "h-14 bg-solar px-2 text-left text-void"
          : "h-14 border border-bone/20 bg-panel px-2 text-left text-bone disabled:opacity-40"
      }
    >
      <span className="block font-hud text-sm leading-none tracking-widest">{label.toUpperCase()}</span>
      <span className={active ? "text-xs text-void/80" : "text-xs text-muted"}>{detail}</span>
    </button>
  );
}

function FactionButton({
  label,
  detail,
  active,
  onClick,
}: {
  label: string;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "h-16 bg-solar px-3 text-left text-void"
          : "h-16 border border-bone/20 bg-panel px-3 text-left text-bone"
      }
    >
      <span className="block font-hud text-xl leading-none">{label}</span>
      <span className={active ? "text-xs text-void/80" : "text-xs text-muted"}>{detail}</span>
    </button>
  );
}
