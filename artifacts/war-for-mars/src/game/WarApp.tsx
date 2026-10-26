import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { StrikeResult, OnlineRoom } from "./Arena";
import { armGyro, disarmGyro } from "./gyro";
import { currentWingSocketUrl } from "./socket-endpoint";
import {
  CLIENT_RECONNECT_WINDOW_MS,
  SOCKET_HANDSHAKE_TIMEOUT_MS,
  nextReconnectDelayMs,
} from "./reconnect-policy";
import {
  defaultSave,
  loadDevicePreferences,
  refitCost,
  saveFromProfile,
  writeDevicePreferences,
  type Save,
} from "./save";
import { refitMul, ROSTER, SHIPS, type Faction, type Scheme, type ShipId } from "./ships";
import { sfxUi, unlockAudio } from "./audio";
import {
  claimServerStrike,
  loadServerProfile,
  startServerStrike,
} from "./progression-api";
import {
  DISPATCHES,
  RECOVERED_INTEL,
  SORTIES,
  sortieById,
  sortieUnlocked,
  TECHS,
  type TechId,
} from "./campaign";
import { HomeScreen } from "./HomeScreen";
import { DeploymentBriefing } from "./DeploymentBriefing";
import { OnlineLobby, type LobbyState } from "./OnlineLobby";
import type { StepInput } from "./sim";
import { MenuState, nextMenu, type MenuAction, type MenuStateId } from "./menu";
import type { StrikeRun, StrikeStartInput } from "@workspace/api-client-react";
import { useDurableAction } from "./useDurableAction";
import { resolveArenaTech } from "./arena-config";

const Arena = lazy(() => import("./Arena").then((module) => ({ default: module.Arena })));
const MarketPanel = lazy(() => import("./MarketPanel").then((module) => ({ default: module.MarketPanel })));
const GalaxyScreen = lazy(() => import("./GalaxyScreen").then((module) => ({ default: module.GalaxyScreen })));

function ModuleLoading({ label }: { label: string }) {
  return (
    <main role="status" className="flex min-h-dvh items-center justify-center bg-void px-4 text-bone">
      <p className="font-hud text-sm tracking-[0.2em] text-solar">{label}</p>
    </main>
  );
}

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

export function WarApp() {
  const [save, setSave] = useState<Save>(defaultSave);
  const [ready, setReady] = useState(false);
  const [profileStatus, setProfileStatus] = useState<"loading" | "ready" | "error">("loading");
  const [profileError, setProfileError] = useState("");
  const [profileRetry, setProfileRetry] = useState(0);
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
  const [offlineMode, setOfflineMode] = useState(false);
  const [activeRun, setActiveRun] = useState<StrikeRun | null>(null);
  const [pendingClaim, setPendingClaim] = useState<{
    runId: string;
    inputs: StepInput[];
    preview: StrikeResult;
  } | null>(null);
  const [claimError, setClaimError] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const durable = useDurableAction();
  const [galaxyOpen, setGalaxyOpen] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  const [startingRun, setStartingRun] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const syncCredits = useCallback((credits: number) => {
    setSave((previous) => previous.credits === credits ? previous : { ...previous, credits });
  }, []);
  const [roomCode, setRoomCode] = useState(
    () => new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() ?? "",
  );
  const joinSocketRef = useRef<WebSocket | null>(null);
  const joinTimeoutRef = useRef<number | null>(null);
  const joinAttemptTimeoutRef = useRef<number | null>(null);
  const lobbyRetryRef = useRef<number | null>(null);

  const failOnline = (reason: string) => {
    if (joinTimeoutRef.current != null) window.clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = null;
    if (joinAttemptTimeoutRef.current != null) window.clearTimeout(joinAttemptTimeoutRef.current);
    joinAttemptTimeoutRef.current = null;
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
    setOfflineMode(false);
    setResult(null);
    setPhase("fight");
    setShell(MenuState.GAMEPLAY);
  };

  const showOnlineError = (code: string) => {
    const messages: Record<string, string> = {
      capacity: "The server is at room capacity. Try again later.",
      full: "That room already has ten pilots. Join another room.",
      match_started: "That match has already started. Use a new room code for a new lobby.",
      session_lost: "The previous match could not be restored after a server restart or room expiry. No match rewards were issued. Create or join a new room.",
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
    setOfflineMode(false);
    unlockAudio();
    setOnlineStatus("Calling the wing…");
    setOfflineAvailable(false);
    let url: URL;
    try {
      url = currentWingSocketUrl();
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
      let retryAttempt = 0;
      const initialJoinDeadline = performance.now() + 5_000;
      let reconnectDeadline = 0;
      let mySlotId: number | null = null;
      let myTeam: 0 | 1 = 0;
      const clearAttemptTimeout = () => {
        if (joinAttemptTimeoutRef.current != null) {
          window.clearTimeout(joinAttemptTimeoutRef.current);
        }
        joinAttemptTimeoutRef.current = null;
      };
      const scheduleRetry = () => {
        if (started) return;
        const now = performance.now();
        if (joined && reconnectDeadline === 0) {
          reconnectDeadline = now + CLIENT_RECONNECT_WINDOW_MS;
        }
        const deadline = joined ? reconnectDeadline : initialJoinDeadline;
        const delay = nextReconnectDelayMs(retryAttempt++, deadline, now);
        if (delay == null) {
          if (joined) {
            failOnline("Signal was not restored before the room's reconnect hold expired. Rejoin the room.");
          }
          return;
        }
        if (lobbyRetryRef.current != null) window.clearTimeout(lobbyRetryRef.current);
        lobbyRetryRef.current = window.setTimeout(() => {
          lobbyRetryRef.current = null;
          connect(url);
        }, delay);
      };
      joinTimeoutRef.current = window.setTimeout(() => {
        if (!joined) failOnline("Room connection timed out. Check your connection and retry.");
      }, 5000);

      const connect = (targetUrl: URL) => {
        if (started) return;
        let socket: WebSocket;
        try {
          socket = new WebSocket(targetUrl);
        } catch {
          setOnlineStatus(joined ? "Signal lost · reconnecting…" : "Connection failed · retrying…");
          scheduleRetry();
          return;
        }
        joinSocketRef.current = socket;
        clearAttemptTimeout();
        joinAttemptTimeoutRef.current = window.setTimeout(() => {
          if (joinSocketRef.current !== socket || started) return;
          setOnlineStatus(joined ? "Signal lost · reconnecting…" : "Connection failed · retrying…");
          socket.close();
        }, SOCKET_HANDSHAKE_TIMEOUT_MS);
        socket.addEventListener("open", () => {
          if (joinSocketRef.current !== socket) return;
          try {
            socket.send(JSON.stringify({ type: "join", name: "Pilot", ...(token ? { reconnectToken: token } : {}) }));
          } catch {
            socket.close();
          }
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
            retryAttempt = 0;
            reconnectDeadline = 0;
            clearAttemptTimeout();
            if (lobbyRetryRef.current != null) window.clearTimeout(lobbyRetryRef.current);
            lobbyRetryRef.current = null;
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
            clearAttemptTimeout();
            reconnectDeadline = 0;
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
          clearAttemptTimeout();
          if (!joined) {
            setOnlineStatus("Room connection interrupted · retrying…");
            scheduleRetry();
            return;
          }
          setOnlineStatus("Signal lost · reconnecting (seat held for 5 seconds)");
          scheduleRetry();
        });
        socket.addEventListener("error", () => {
          if (joinSocketRef.current === socket) {
            setOnlineStatus(joined ? "Signal lost · reconnecting…" : "Connection failed · retrying…");
            socket.close();
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
    if (joinAttemptTimeoutRef.current != null) window.clearTimeout(joinAttemptTimeoutRef.current);
    if (lobbyRetryRef.current != null) window.clearTimeout(lobbyRetryRef.current);
    joinSocketRef.current?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const device = loadDevicePreferences();
    setSave((previous) => ({ ...previous, ...device }));
    setProfileStatus("loading");
    setProfileError("");
    void loadServerProfile()
      .then((profile) => {
        if (cancelled) return;
        setSave(saveFromProfile(profile, device));
        try {
          const rawPending = sessionStorage.getItem("wfm-pending-claim-v1");
          if (rawPending) {
            const pending = JSON.parse(rawPending) as {
              runId?: unknown;
              inputs?: unknown;
              preview?: unknown;
            };
            if (
              typeof pending.runId === "string" &&
              Array.isArray(pending.inputs) &&
              pending.inputs.length <= 22_000 &&
              pending.preview &&
              typeof pending.preview === "object"
            ) {
              const restored = pending as { runId: string; inputs: StepInput[]; preview: StrikeResult };
              setPendingClaim(restored);
              setResult(restored.preview);
              setPhase("debrief");
            }
          }
        } catch {
          // Storage may be unavailable or contain malformed local data; the server profile remains authoritative.
        }
        setProfileStatus("ready");
        setReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProfileError(error instanceof Error ? error.message : "Could not load the player profile.");
        setProfileStatus("error");
        setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileRetry]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void loadServerProfile().then((profile) => {
        if (!cancelled) setSave((previous) => saveFromProfile(profile, { gyro: previous.gyro, drilled: previous.drilled }));
      }).catch(() => { if (!cancelled) setActionError("Server action confirmed; profile refresh unavailable. Retry loading before another purchase."); });
    };
    window.addEventListener("wfm:profile-refresh", refresh);
    return () => { cancelled = true; window.removeEventListener("wfm:profile-refresh", refresh); };
  }, []);

  useEffect(() => {
    if (ready) writeDevicePreferences({ gyro: save.gyro, drilled: save.drilled });
  }, [save.gyro, save.drilled, ready]);

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

  const start = async () => {
    if (shell === MenuState.LOADING || startingRun) return;
    if (pendingClaim) {
      setCampaignError("Verify the pending sortie before starting another run.");
      return;
    }
    unlockAudio();
    setResult(null);
    setPhase("brief");
    setCampaignError("");
    if (offlineMode && !activeRun) {
      setShell(MenuState.LOADING);
      return;
    }
    try {
      const selection: StrikeStartInput = {
        shipId: save.ship,
        faction: save.faction,
        scheme: save.scheme,
        pace: save.pace,
        mission: save.mission,
        tech: save.tech,
      };
      const run = await startServerStrike(selection);
      setActiveRun(run);
      setSave(saveFromProfile(run.profile, { gyro: save.gyro, drilled: save.drilled }));
      setOfflineMode(false);
      setPendingClaim(null);
      setClaimError("");
      setShell(MenuState.LOADING);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "The yard could not authorize this sortie.");
    } finally {
      setStartingRun(false);
    }
  };

  const performRefit = async () => {
    if (actionBusy || durable.blocked) return;
    if (pendingClaim) {
      setActionError("Retry the pending sortie verification before changing the yard ledger.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      await durable.run({ kind: "refit", data: { action: "refit" } }, "Standard Phobos ship refit");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The yard rejected that transaction.");
    } finally {
      setActionBusy(false);
    }
  };

  const submitClaim = async (runId: string, inputs: StepInput[], preview: StrikeResult) => {
    const pending = { runId, inputs, preview };
    setPendingClaim(pending);
    try {
      sessionStorage.setItem("wfm-pending-claim-v1", JSON.stringify(pending));
    } catch {
      // The live request can still complete; if the tab closes, the run expires without client-side rewards.
    }
    setClaimError("");
    setClaimSubmitting(true);
    setResult(preview);
    setGain(0);
    setCargoLine("Submitting the replay for server verification. No reward is final yet.");
    setAdvance("");
    setPhase("debrief");
    try {
      const grant = await claimServerStrike(runId, { inputs });
      setPendingClaim(null);
      try {
        sessionStorage.removeItem("wfm-pending-claim-v1");
      } catch {
        // The verified profile remains authoritative even if local session storage is unavailable.
      }
      setActiveRun(null);
      setClaimError("");
      setAdvance(grant.advance);
      setCargoLine(grant.cargoLine);
      setGain(grant.gain);
      setResult({
        outcome: grant.outcome,
        kills: grant.kills,
        deaths: preview.deaths,
        relays: grant.relays,
        reason: preview.reason,
      });
      setSave((previous) =>
        saveFromProfile(grant.profile, { gyro: previous.gyro, drilled: previous.drilled }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The yard could not verify this sortie.";
      const status =
        error && typeof error === "object" && "status" in error
          ? Number((error as { status: unknown }).status)
          : 0;
      setClaimError(message);
      if (status === 400 || status === 404 || status === 409) {
        setPendingClaim(null);
        setActiveRun(null);
        try {
          sessionStorage.removeItem("wfm-pending-claim-v1");
        } catch {
          // The rejected run is also invalidated server-side.
        }
        setCargoLine("The server rejected this replay. No credits or campaign progress were awarded.");
      } else {
        setCargoLine("This local result is unverified. No credits or campaign progress were awarded.");
      }
      setGain(0);
    } finally {
      setClaimSubmitting(false);
    }
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
    if (offlineMode || !activeRun) {
      setResult(next);
      setGain(0);
      setCargoLine("Offline practice only. This sortie earns no credits or campaign progress.");
      setAdvance("");
      setPhase("debrief");
      return;
    }
    void submitClaim(activeRun.runId, replay.inputs, next);
  };

  if (profileStatus === "loading") {
    return (
      <main className="flex h-dvh items-center justify-center bg-void px-6 text-center">
        <p className="font-hud text-lg tracking-widest text-solar">CONNECTING TO PHOBOS YARD…</p>
      </main>
    );
  }

  if (profileStatus === "error") {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-void px-6 text-center">
        <p className="font-hud text-sm tracking-widest text-alert">PLAYER PROFILE UNAVAILABLE</p>
        <h1 className="font-hud text-4xl text-bone">No progress is stored on this device.</h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted">{profileError}</p>
        <button
          type="button"
          className="h-12 bg-solar px-6 font-hud tracking-widest text-void"
          onClick={() => setProfileRetry((value) => value + 1)}
        >
          RETRY CONNECTION
        </button>
      </main>
    );
  }

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
    const runConfig = activeRun?.config;
    const runGoal = runConfig?.goal ?? goal;
    const runFaction = runConfig?.faction ?? save.faction;
    return (
      <Suspense fallback={<ModuleLoading label="LOADING COMBAT SYSTEMS…" />}>
      <Arena
        key={`${activeRun?.runId ?? "offline"}-${sortie}-${save.scheme}`}
        shipId={runConfig?.shipId ?? save.ship}
        faction={runFaction}
        scheme={save.scheme}
        refit={runConfig?.refit ?? save.refit}
        shieldMk2={runConfig?.shieldMk2 ?? save.shieldMk2 ?? false}
        pace={runConfig?.pace ?? pace}
        goal={runGoal}
        disc={runConfig?.disc ?? active?.disc ?? "rust"}
        allyCount={runConfig?.allyCount ?? active?.allyCount ?? 4}
        foeCount={runConfig?.foeCount ?? active?.foeCount ?? 5}
        objective={
          (runConfig?.mission ?? active?.id) === "cage"
            ? runFaction === "ussf"
              ? "COVER THE CAGE"
              : "STOP THE CAGE"
            : (active?.objective ?? "HOLD TWO RELAYS")
        }
        tech={resolveArenaTech(runConfig, save.tech)}
        serverSeed={activeRun?.seed}
        gyro={save.gyro}
        drilled={save.drilled}
        onDrill={() => setSave((prev) => (prev.drilled ? prev : { ...prev, drilled: true }))}
        onDone={finish}
        onNetworkExit={(reason) => {
          try {
            if (onlineSession) sessionStorage.removeItem(`wfm-room-${onlineSession.roomId}`);
          } catch {
            // Keep the server-restart message visible even without browser storage.
          }
          setOnlineSession(null);
          joinSocketRef.current = null;
          setOnlineStatus(
            reason === "server_restart"
              ? "The match ended because the server restarted. No match rewards were issued. Create or join a new room."
              : "The previous match could not be restored after an interruption. No match rewards were issued. Create or join a new room.",
          );
          setOfflineAvailable(true);
          setResult(null);
          setPhase("brief");
          setShell(MenuState.MAIN_MENU);
        }}
        online={onlineSession ?? undefined}
      />
      </Suspense>
    );
  }

  if (phase === "debrief" && result) {
    const title =
      pendingClaim
        ? claimSubmitting
          ? "Verifying sortie"
          : "Result needs verification"
        : result.outcome === "win"
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
        <p data-testid="text-result-reason" className="text-sm leading-relaxed text-solar">
          {pendingClaim
            ? claimSubmitting
              ? "The yard is replaying the flight record before it awards credits or unlocks the next sortie."
              : claimError || "The server has not verified this result yet."
            : result.reason}
        </p>
        <p className="text-sm leading-relaxed text-muted">
          {pendingClaim
            ? "The combat summary is only a local preview until verification succeeds."
            : `${ship.name} came back with ${result.kills} kills and ${result.relays} relays. The hangar logged ${gain} credits. ${cargoLine || "No crate in the hold."} ${advance}`}
        </p>
        <p className="font-hud text-2xl text-solar">{save.credits} CR</p>
        {pendingClaim ? (
          <button
            type="button"
            disabled={claimSubmitting}
            className="h-12 bg-solar font-hud text-lg tracking-widest text-void disabled:opacity-50"
            onClick={() => void submitClaim(pendingClaim.runId, pendingClaim.inputs, pendingClaim.preview)}
          >
            {claimSubmitting ? "VERIFYING…" : "RETRY VERIFICATION"}
          </button>
        ) : (
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
        )}
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

  if (galaxyOpen) {
    return (
      <Suspense fallback={<ModuleLoading label="CHARTING THE THEATER…" />}>
        <GalaxyScreen
          onBack={() => setGalaxyOpen(false)}
          credits={save.credits}
          onCredits={syncCredits}
        />
      </Suspense>
    );
  }

  if (shell !== MenuState.HANGAR && shell !== MenuState.GAMEPLAY) {
    return (
      <div className="relative">
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
        refitDisabled={save.refit >= 5 || save.credits < cost || durable.blocked}
        onAction={act}
        onGalaxy={() => setGalaxyOpen(true)}
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
          setOfflineMode(true);
          setActiveRun(null);
          setOnlineStatus("Offline Strike · AI fills the wing. No rewards are recorded.");
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
        onRefit={() => void performRefit()}
      />
      {pendingClaim || campaignError || actionError ? (
        <aside className="fixed bottom-3 left-3 z-50 max-w-[min(92vw,32rem)] border border-alert/60 bg-void/95 p-3 shadow-xl">
          <p className="text-sm leading-relaxed text-bone">
            {pendingClaim
              ? "A sortie is waiting for server verification."
              : campaignError || actionError}
          </p>
          {pendingClaim ? (
            <button
              type="button"
              className="mt-2 h-10 bg-solar px-3 font-hud tracking-widest text-void"
              onClick={() => setPhase("debrief")}
            >
              RETURN TO VERIFICATION
            </button>
          ) : null}
        </aside>
      ) : null}
      </div>
    );
  }

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col px-4 pt-5">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-3">
      <header>
        <p className="font-hud text-sm tracking-widest text-solar">USSF VS THE ACCORD</p>
        <h1 className="font-hud text-5xl leading-none text-bone sm:text-6xl">WAR FOR MARS</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          The fleet that took Eon Dusk to Mars is gone. He is a prisoner of the Accord. Follow four sorties
          from a buried signal to the cage in the dust lane, or take the open skirmish.
        </p>
      </header>
      {campaignError || actionError ? (
        <p role="status" className="border border-alert/50 bg-alert/10 px-3 py-2 text-sm text-bone">
          {campaignError || actionError}
        </p>
      ) : null}
      {pendingClaim ? (
        <section className="border border-alert/50 bg-alert/10 px-3 py-3">
          <p className="font-hud text-sm tracking-widest text-solar">PENDING SORTIE VERIFICATION</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Retry the same replay before changing credits, cargo, refit, or starting another sortie.
          </p>
          <button
            type="button"
            className="mt-2 h-10 bg-solar px-3 font-hud tracking-widest text-void"
            onClick={() => setPhase("debrief")}
          >
            RETURN TO VERIFICATION
          </button>
        </section>
      ) : null}

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
      <DeploymentBriefing
        mission={active?.name ?? "Arcade Skirmish"}
        objective={active?.objective ?? "HOLD TWO RELAYS"}
        description={
          active?.brief
          ?? (save.pace === "strike"
            ? "A six-minute Strike against an AI-filled wing. Take the relays, pressure the enemy, and protect your integrity."
            : "A two-minute practice flight against an AI-filled wing. Learn the controls and contest the relays.")
        }
        goal={goal}
        pace={pace}
        scheme={save.scheme}
        gyro={save.gyro}
      />
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
      <section className="border border-bone/15 bg-panel/60">
        <button
          type="button"
          aria-expanded={archiveOpen}
          className="flex min-h-12 w-full items-center justify-between px-3 text-left"
          onClick={() => setArchiveOpen((open) => !open)}
        >
          <span className="font-hud text-sm tracking-widest text-solar">
            RECOVERED FLIGHT RECORDERS · {save.cleared}/4
          </span>
          <span className="text-muted">{archiveOpen ? "−" : "+"}</span>
        </button>
        {archiveOpen ? (
          <ol className="grid gap-2 px-3 pb-3">
            {RECOVERED_INTEL.filter((record) => save.cleared >= record.need).length ? (
              RECOVERED_INTEL.filter((record) => save.cleared >= record.need).map((record) => (
                <li key={record.from} className="border-t border-bone/10 pt-2">
                  <p className="font-hud text-xs tracking-widest text-solar">{record.from}</p>
                  <h2 className="mt-1 text-sm font-semibold text-bone">{record.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{record.text}</p>
                </li>
              ))
            ) : (
              <li className="border-t border-bone/10 pt-2 text-xs leading-relaxed text-muted">
                No recordings recovered. Complete the Contact sortie to decode the first signal.
              </li>
            )}
          </ol>
        ) : null}
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

      <Suspense fallback={<div role="status" className="mt-8 h-48 border border-bone/10 bg-panel/50" aria-label="Loading station market" />}>
        <MarketPanel onCredits={syncCredits} />
      </Suspense>
      {actionError ? (
        <p role="alert" className="border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-bone">
          {actionError}
        </p>
      ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-bone/15 bg-void py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-hud text-xl text-solar">{save.credits.toLocaleString()} CR</p>
          <button
            type="button"
            className="h-11 border border-bone/25 px-3 font-hud tracking-widest text-bone"
            onClick={() => act("BACK")}
          >
            MENU
          </button>
          <button
            type="button"
            disabled={actionBusy || durable.blocked || save.refit >= 5 || save.credits < cost}
            className="h-11 border border-solar px-3 font-hud tracking-widest text-solar disabled:border-bone/20 disabled:text-muted"
            onClick={() => void performRefit()}
          >
            {save.refit >= 5 ? "REFIT MAX" : `REFIT +6% · ${cost}`}
          </button>
        </div>
        <button
          type="button"
          disabled={startingRun || Boolean(pendingClaim)}
          className="h-14 bg-solar font-hud text-2xl tracking-widest text-void disabled:opacity-50"
          onClick={() => {
            setSortie((n) => n + 1);
            start();
          }}
        >
          {startingRun ? "AUTHORIZING…" : pendingClaim ? "VERIFY PENDING SORTIE" : "Start"}
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
