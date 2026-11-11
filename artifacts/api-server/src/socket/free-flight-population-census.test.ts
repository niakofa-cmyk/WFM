import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { FreeFlightRedisBus } from "./free-flight-shared-runtime";
import {
  FREE_FLIGHT_POPULATION_CENSUS_LIMITS,
  FREE_FLIGHT_POPULATION_CENSUS_LUA,
  populationSeatEntries,
  publishPopulationSeats,
  readGlobalFlightPopulationCensus,
  type PopulationSeatLease,
} from "./free-flight-population-census";

class FakePopulationRedis {
  now = 100_000;
  readonly seats = new Map<string, string>();
  readonly seen = new Map<string, number>();
  readonly data = new Map<string, { faction: "ussf" | "accord"; leaseValue: string }>();

  client(): FreeFlightRedisBus {
    return {
      get: async (key) => this.seats.get(key) ?? null,
      eval: async (script, { arguments: args }) => {
        if (script === FREE_FLIGHT_POPULATION_CENSUS_LUA.upsertPilots) {
          const freshness = Number(args[0]);
          const entries = JSON.parse(args[1]!) as Array<{
            pilotHash: string; faction: "ussf" | "accord"; leaseValue: string;
          }>;
          this.prune(freshness);
          if (entries.length > FREE_FLIGHT_POPULATION_CENSUS_LIMITS.maximumPilots) return -1;
          let written = 0;
          for (const entry of entries) {
            const seatKey = `wfm:freeflight:user:${entry.pilotHash}`;
            if (this.seats.get(seatKey) !== entry.leaseValue) continue;
            this.data.set(entry.pilotHash, {
              faction: entry.faction,
              leaseValue: entry.leaseValue,
            });
            this.seen.set(entry.pilotHash, this.now);
            written += 1;
          }
          return written;
        }
        if (script === FREE_FLIGHT_POPULATION_CENSUS_LUA.read) {
          this.prune(Number(args[0]));
          let ussf = 0;
          let accord = 0;
          for (const [hash, entry] of this.data) {
            if (this.seats.get(`wfm:freeflight:user:${hash}`) !== entry.leaseValue) {
              this.data.delete(hash);
              this.seen.delete(hash);
            } else if (entry.faction === "ussf") ussf += 1;
            else accord += 1;
          }
          return JSON.stringify({
            ok: true,
            capturedAt: this.now,
            activePilotsByFaction: { ussf, accord },
            total: ussf + accord,
          });
        }
        throw new Error("Unexpected census Lua script.");
      },
      publish: async () => 0,
      pSubscribe: async () => {},
      pUnsubscribe: async () => {},
      close: async () => {},
    };
  }

  setLease(userId: string, value: string) {
    const hash = createHash("sha256").update(userId).digest("hex");
    this.seats.set(`wfm:freeflight:user:${hash}`, value);
  }

  private prune(freshnessMs: number) {
    for (const [hash, observedAt] of this.seen) {
      if (observedAt < this.now - freshnessMs) {
        this.seen.delete(hash);
        this.data.delete(hash);
      }
    }
  }
}

const pilot = (userId: string, faction: "ussf" | "accord", leaseValue: string): PopulationSeatLease =>
  ({ userId, faction, leaseValue });

test("cross-owner census counts a live account once and fences an old seat owner", async () => {
  const redis = new FakePopulationRedis();
  const bus = redis.client();
  redis.setLease("pilot-a", "new-owner/fence-2");
  redis.setLease("pilot-b", "owner-b/fence-1");

  assert.equal(await publishPopulationSeats(bus, [
    pilot("pilot-a", "ussf", "old-owner/fence-1"),
  ]), 0);
  assert.equal(await publishPopulationSeats(bus, [
    pilot("pilot-a", "ussf", "new-owner/fence-2"),
    pilot("pilot-b", "accord", "owner-b/fence-1"),
  ]), 2);
  const census = await readGlobalFlightPopulationCensus(bus);
  assert.deepEqual(census, {
    capturedAt: 100_000,
    activePilotsByFaction: { ussf: 1, accord: 1 },
    total: 2,
  });
  assert.ok(![...redis.data.keys()].includes("pilot-a"));
  assert.ok(!JSON.stringify([...redis.data.values()]).includes("pilot-a"));
});

test("stale seats and released authenticated leases leave the active census immediately", async () => {
  const redis = new FakePopulationRedis();
  const bus = redis.client();
  redis.setLease("pilot-a", "owner-a/fence-1");
  await publishPopulationSeats(bus, [pilot("pilot-a", "accord", "owner-a/fence-1")]);
  redis.seats.clear();
  assert.deepEqual((await readGlobalFlightPopulationCensus(bus)).activePilotsByFaction,
    { ussf: 0, accord: 0 });

  redis.setLease("pilot-b", "owner-b/fence-1");
  await publishPopulationSeats(bus, [pilot("pilot-b", "ussf", "owner-b/fence-1")]);
  redis.now += FREE_FLIGHT_POPULATION_CENSUS_LIMITS.freshnessMs + 1;
  assert.equal((await readGlobalFlightPopulationCensus(bus)).total, 0);
});

test("seat snapshots deduplicate identical samples and reject conflicting ownership", () => {
  assert.equal(populationSeatEntries([
    pilot("same", "ussf", "same-lease"),
    pilot("same", "ussf", "same-lease"),
  ]).length, 1);
  assert.throws(() => populationSeatEntries([
    pilot("same", "ussf", "lease-a"),
    pilot("same", "accord", "lease-b"),
  ]), /Conflicting active pilot census seat/);
});
