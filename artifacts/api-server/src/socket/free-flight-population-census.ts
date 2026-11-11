import { createHash } from "node:crypto";
import type { FreeFlightRedisBus } from "./free-flight-shared-runtime";

export type PopulationSeatLease = Readonly<{
  userId: string;
  faction: "ussf" | "accord";
  leaseValue: string;
}>;

export type GlobalFlightPopulationCensus = Readonly<{
  capturedAt: number;
  activePilotsByFaction: Readonly<{ ussf: number; accord: number }>;
  total: number;
}>;

const PILOT_INDEX_KEY = "wfm:freeflight:population:v1:pilot-seen";
const PILOT_DATA_KEY = "wfm:freeflight:population:v1:pilot-data";
const FRESHNESS_MS = 20_000;
const REDIS_KEY_TTL_MS = 60_000;
const MAX_ACTIVE_PILOTS = 4_096;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

const UPSERT_PILOTS_SCRIPT = `
  local time = redis.call("TIME")
  local now = time[1] * 1000 + math.floor(time[2] / 1000)
  local cutoff = now - tonumber(ARGV[1])
  local stale = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", cutoff)
  for _, pilotHash in ipairs(stale) do
    redis.call("HDEL", KEYS[2], pilotHash)
    redis.call("ZREM", KEYS[1], pilotHash)
  end
  local entries = cjson.decode(ARGV[2])
  if type(entries) ~= "table" or #entries > tonumber(ARGV[3]) then return -1 end
  local written = 0
  for _, entry in ipairs(entries) do
    if type(entry) == "table" and
        type(entry.pilotHash) == "string" and
        string.match(entry.pilotHash, "^[a-f0-9]+$") and
        string.len(entry.pilotHash) == 64 and
        (entry.faction == "ussf" or entry.faction == "accord") and
        type(entry.leaseValue) == "string" and
        string.len(entry.leaseValue) > 0 and string.len(entry.leaseValue) <= 256 then
      local seatKey = "wfm:freeflight:user:" .. entry.pilotHash
      if redis.call("GET", seatKey) == entry.leaseValue then
        redis.call("HSET", KEYS[2], entry.pilotHash,
          cjson.encode({ faction = entry.faction, leaseValue = entry.leaseValue }))
        redis.call("ZADD", KEYS[1], now, entry.pilotHash)
        written = written + 1
      end
    end
  end
  redis.call("PEXPIRE", KEYS[1], ARGV[4])
  redis.call("PEXPIRE", KEYS[2], ARGV[4])
  return written
`;

const READ_CENSUS_SCRIPT = `
  local time = redis.call("TIME")
  local now = time[1] * 1000 + math.floor(time[2] / 1000)
  local cutoff = now - tonumber(ARGV[1])
  local stale = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", cutoff)
  for _, pilotHash in ipairs(stale) do
    redis.call("HDEL", KEYS[2], pilotHash)
    redis.call("ZREM", KEYS[1], pilotHash)
  end
  local pilots = redis.call("ZRANGEBYSCORE", KEYS[1], cutoff, "+inf")
  if #pilots > tonumber(ARGV[2]) then
    return cjson.encode({ ok = false, reason = "pilot_limit" })
  end
  local ussf = 0
  local accord = 0
  for _, pilotHash in ipairs(pilots) do
    local raw = redis.call("HGET", KEYS[2], pilotHash)
    local valid, entry = pcall(cjson.decode, raw or "")
    if valid and type(entry) == "table" and
        (entry.faction == "ussf" or entry.faction == "accord") and
        type(entry.leaseValue) == "string" and
        redis.call("GET", "wfm:freeflight:user:" .. pilotHash) == entry.leaseValue then
      if entry.faction == "ussf" then ussf = ussf + 1 else accord = accord + 1 end
    else
      redis.call("HDEL", KEYS[2], pilotHash)
      redis.call("ZREM", KEYS[1], pilotHash)
    end
  end
  return cjson.encode({
    ok = true,
    capturedAt = now,
    activePilotsByFaction = { ussf = ussf, accord = accord },
    total = ussf + accord
  })
`;

function pilotHash(userId: string): string {
  if (!userId || userId.length > 256) throw new Error("Invalid active pilot identity.");
  return createHash("sha256").update(userId).digest("hex");
}

function validCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function populationSeatEntries(
  seats: readonly PopulationSeatLease[],
): Array<{ pilotHash: string; faction: "ussf" | "accord"; leaseValue: string }> {
  if (seats.length > MAX_ACTIVE_PILOTS) throw new Error("Active pilot census exceeds its bound.");
  const distinct = new Map<string, { pilotHash: string; faction: "ussf" | "accord"; leaseValue: string }>();
  for (const seat of seats) {
    const hash = pilotHash(seat.userId);
    if ((seat.faction !== "ussf" && seat.faction !== "accord") ||
        !seat.leaseValue || seat.leaseValue.length > 256) {
      throw new Error("Invalid active pilot census seat.");
    }
    const previous = distinct.get(hash);
    if (previous && (previous.faction !== seat.faction ||
        previous.leaseValue !== seat.leaseValue)) {
      throw new Error("Conflicting active pilot census seat.");
    }
    distinct.set(hash, { pilotHash: hash, faction: seat.faction, leaseValue: seat.leaseValue });
  }
  return [...distinct.values()].sort((left, right) =>
    left.pilotHash.localeCompare(right.pilotHash));
}

export async function publishPopulationSeats(
  bus: FreeFlightRedisBus,
  seats: readonly PopulationSeatLease[],
): Promise<number> {
  const entries = populationSeatEntries(seats);
  const result = await bus.eval(UPSERT_PILOTS_SCRIPT, {
    keys: [PILOT_INDEX_KEY, PILOT_DATA_KEY],
    arguments: [
      String(FRESHNESS_MS),
      JSON.stringify(entries),
      String(MAX_ACTIVE_PILOTS),
      String(REDIS_KEY_TTL_MS),
    ],
  });
  const written = Number(result);
  if (!Number.isSafeInteger(written) || written < 0 || written > entries.length) {
    throw new Error("Shared pilot census write was rejected.");
  }
  return written;
}

export async function readGlobalFlightPopulationCensus(
  bus: FreeFlightRedisBus,
): Promise<GlobalFlightPopulationCensus> {
  const result = await bus.eval(READ_CENSUS_SCRIPT, {
    keys: [PILOT_INDEX_KEY, PILOT_DATA_KEY],
    arguments: [String(FRESHNESS_MS), String(MAX_ACTIVE_PILOTS)],
  });
  if (typeof result !== "string") throw new Error("Shared pilot census read failed.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(result);
  } catch {
    throw new Error("Shared pilot census returned invalid data.");
  }
  if (!parsed || typeof parsed !== "object" || !("ok" in parsed) ||
      parsed.ok !== true || !("capturedAt" in parsed) ||
      !("activePilotsByFaction" in parsed) || !("total" in parsed)) {
    throw new Error("Shared pilot census is unavailable or exceeded its capacity.");
  }
  const payload = parsed as {
    capturedAt: unknown;
    activePilotsByFaction: { ussf?: unknown; accord?: unknown } | null;
    total: unknown;
  };
  const factions = payload.activePilotsByFaction;
  if (!validCount(payload.capturedAt) || !factions ||
      !validCount(factions.ussf) || !validCount(factions.accord) ||
      !validCount(payload.total) || payload.total !== factions.ussf + factions.accord) {
    throw new Error("Shared pilot census has an invalid shape.");
  }
  return {
    capturedAt: payload.capturedAt,
    activePilotsByFaction: { ussf: factions.ussf, accord: factions.accord },
    total: payload.total,
  };
}

export const FREE_FLIGHT_POPULATION_CENSUS_LIMITS = {
  freshnessMs: FRESHNESS_MS,
  maximumPilots: MAX_ACTIVE_PILOTS,
} as const;

export const FREE_FLIGHT_POPULATION_CENSUS_LUA = {
  upsertPilots: UPSERT_PILOTS_SCRIPT,
  read: READ_CENSUS_SCRIPT,
} as const;
