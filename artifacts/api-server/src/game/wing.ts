import { createMatch, step, type Craft, type Match, type StepInput } from "./sim";

export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;
export const MAX_PLAYERS = 10;
export const DISCONNECT_GRACE_MS = 5000;

const IDLE: StepInput = {
  throttle: 0,
  yaw: 0,
  strafe: 0,
  pitch: 0,
  fire: false,
  ult: false,
  lock: false,
  evade: 0,
  preset: null,
};

export type WingInput = StepInput & { seq: number };

export type JoinResult =
  | { ok: true; slotId: number; team: 0 | 1; reconnectToken: string }
  | { ok: false; reason: "full" | "session_lost" };

export type SlotSnapshot = {
  slotId: number;
  team: 0 | 1;
  connected: boolean;
  name: string | null;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  lastSeq: number;
};

export type WingSnapshot = {
  tick: number;
  time: number;
  players: SlotSnapshot[];
  match: Match;
};

type Slot = {
  slotId: number;
  team: 0 | 1;
  playerId: string | null;
  name: string | null;
  isConnected: boolean;
  lastPacketTime: number;
  reconnectToken: string | null;
  lastSeq: number;
  buffered: StepInput | null;
};

export function createWing(seed = 1) {
  const match = createMatch("mandjet", "accord", 0, "strike", {
    seed,
    allyCount: 4,
    foeCount: 5,
    goal: "disc",
    disc: "rust",
  });
  const slots: Slot[] = Array.from({ length: MAX_PLAYERS }, (_, slotId) => ({
    slotId,
    team: slotId < 5 ? 0 : 1,
    playerId: null,
    name: null,
    isConnected: false,
    lastPacketTime: 0,
    reconnectToken: null,
    lastSeq: 0,
    buffered: null,
  }));
  let tickCount = 0;

  function craftFor(slotId: number): Craft {
    if (slotId === 0) return match.player;
    if (slotId < 5) return match.allies[slotId - 1];
    return match.enemies[slotId - 5];
  }

  function token() {
    return globalThis.crypto.randomUUID();
  }

  function release(slot: Slot) {
    slot.playerId = null;
    slot.name = null;
    slot.isConnected = false;
    slot.reconnectToken = null;
    slot.buffered = null;
    slot.lastSeq = 0;
  }

  function expireDisconnected(now: number) {
    for (const slot of slots) {
      if (!slot.isConnected && slot.playerId !== null && now - slot.lastPacketTime > DISCONNECT_GRACE_MS) {
        release(slot);
      }
    }
  }

  function claim(slot: Slot, playerId: string, name: string, now: number): JoinResult {
    const reconnectToken = token();
    slot.playerId = playerId;
    slot.name = name;
    slot.isConnected = true;
    slot.lastPacketTime = now;
    slot.reconnectToken = reconnectToken;
    slot.buffered = null;
    slot.lastSeq = 0;
    return { ok: true, slotId: slot.slotId, team: slot.team, reconnectToken };
  }

  return {
    get match(): Match {
      return match;
    },
    get tickCount() {
      return tickCount;
    },
    join(playerId: string, name: string, reconnectToken?: string | null, now = Date.now()): JoinResult {
      if (reconnectToken) {
        const existing = slots.find((slot) => slot.reconnectToken === reconnectToken && slot.playerId !== null);
        if (existing) {
          if (existing.playerId !== playerId) return { ok: false, reason: "session_lost" };
          existing.isConnected = true;
          existing.lastPacketTime = now;
          existing.name = name;
          return { ok: true, slotId: existing.slotId, team: existing.team, reconnectToken: existing.reconnectToken ?? reconnectToken };
        }
      }
      const occupiedByPlayer = slots.find((slot) => slot.playerId === playerId);
      if (occupiedByPlayer) return { ok: false, reason: "session_lost" };
      const teamCounts = ([0, 1] as const).map(
        (team) => slots.filter((slot) => slot.team === team && slot.playerId !== null).length,
      );
      const firstTeam: 0 | 1 = teamCounts[0] <= teamCounts[1] ? 0 : 1;
      const open =
        slots.find((slot) => slot.team === firstTeam && slot.playerId === null) ??
        slots.find((slot) => slot.team === (firstTeam === 0 ? 1 : 0) && slot.playerId === null);
      if (open) return claim(open, playerId, name, now);
      const stale = slots.find((slot) => !slot.isConnected && now - slot.lastPacketTime > DISCONNECT_GRACE_MS);
      if (!stale) return { ok: false, reason: "full" };
      return claim(stale, playerId, name, now);
    },
    canReconnect(reconnectToken: string) {
      return slots.some((slot) => slot.reconnectToken === reconnectToken && slot.playerId !== null);
    },
    lastSeq(slotId: number) {
      return slots[slotId]?.lastSeq ?? 0;
    },
    expireDisconnected(now = Date.now()) {
      expireDisconnected(now);
    },
    disconnect(slotId: number, now = Date.now()) {
      const slot = slots[slotId];
      if (!slot || slot.playerId === null) return;
      slot.isConnected = false;
      slot.lastPacketTime = now;
      slot.buffered = null;
    },
    input(slotId: number, packet: WingInput, now = Date.now()) {
      const slot = slots[slotId];
      if (!slot?.isConnected) return;
      if (!Number.isFinite(packet.seq) || packet.seq <= slot.lastSeq) return;
      slot.lastPacketTime = now;
      slot.lastSeq = packet.seq;
      slot.buffered = {
        throttle: clamp(packet.throttle),
        yaw: clamp(packet.yaw),
        strafe: clamp(packet.strafe),
        pitch: clamp(packet.pitch),
        fire: packet.fire === true,
        ult: packet.ult === true,
        lock: packet.lock === true,
        evade: clamp(packet.evade),
        preset: packet.preset === 0 || packet.preset === 1 || packet.preset === 2 || packet.preset === 3 ? packet.preset : null,
      };
    },
    tick(now = Date.now()) {
      tickCount += 1;
      expireDisconnected(now);
      match.player.ai = !slots[0].isConnected;
      const lead = slots[0].isConnected ? (slots[0].buffered ?? IDLE) : IDLE;
      for (let slotId = 1; slotId < MAX_PLAYERS; slotId += 1) {
        const slot = slots[slotId];
        const craft = craftFor(slotId);
        craft.ai = !slot.isConnected;
        craft.human = slot.isConnected ? (slot.buffered ?? IDLE) : null;
      }
      step(match, lead, TICK_DT);
      for (const slot of slots) {
        if (!slot.buffered) continue;
        slot.buffered = { ...slot.buffered, ult: false, lock: false };
      }
    },
    snapshot(now = Date.now()): WingSnapshot {
      return {
        tick: tickCount,
        time: now,
        players: slots.map((slot) => {
          const craft = craftFor(slot.slotId);
          return {
            slotId: slot.slotId,
            team: slot.team,
            connected: slot.isConnected,
            name: slot.name,
            x: Math.round(craft.x * 10) / 10,
            z: Math.round(craft.z * 10) / 10,
            yaw: Math.round(craft.yaw * 1000) / 1000,
            hp: Math.max(0, Math.round(craft.shield + craft.hull)),
            lastSeq: slot.lastSeq,
          };
        }),
        match: structuredClone(match),
      };
    },
  };
}

function clamp(value: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}
