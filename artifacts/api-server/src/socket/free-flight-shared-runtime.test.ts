import assert from "node:assert/strict";
import test from "node:test";
import { isFreeFlightSnapshotV1, type FreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import type { FreeFlightSessionCheckpointV1, StoredFreeFlightCheckpoint } from "./free-flight-runtime";
import { createFreeFlightRuntime } from "./free-flight-runtime";
import {
  createFreeFlightSharedRuntime,
  type FreeFlightRedisBus,
  type FreeFlightSocket,
} from "./free-flight-shared-runtime";

type Listener = (message: string, channel: string) => void;

class FakeRedisHub {
  private readonly values = new Map<string, string>();
  private readonly counters = new Map<string, number>();
  private readonly subscriptions = new Map<FreeFlightRedisBus, Map<string, Listener>>();

  client(): FreeFlightRedisBus {
    const client: FreeFlightRedisBus = {
      get: async (key) => this.values.get(key) ?? null,
      eval: async (script, { keys, arguments: args }) => {
        if (script.includes('redis.call("EXISTS"')) {
          if (this.values.has(keys[0]!)) return null;
          const token = (this.counters.get(keys[1]!) ?? 0) + 1;
          this.counters.set(keys[1]!, token);
          this.values.set(keys[0]!, `${args[0]}|${token}`);
          return token;
        }
        if (script.includes("local existing")) {
          const old = this.values.get(keys[0]!);
          const next = args[0]!;
          if (!old) {
            this.values.set(keys[0]!, next);
            return 1;
          }
          const oldParts = old.split("|");
          const nextParts = next.split("|");
          if (oldParts[0] === nextParts[0] &&
              (oldParts[1] === nextParts[1] && oldParts[2] === nextParts[2] ||
                Number(oldParts[2]) < Number(nextParts[2]))) {
            this.values.set(keys[0]!, next);
            return 1;
          }
          return 0;
        }
        if (script.includes('redis.call("DEL"')) {
          if (this.values.get(keys[0]!) !== args[0]) return 0;
          this.values.delete(keys[0]!);
          return 1;
        }
        if (script.includes("PEXPIRE")) {
          return this.values.get(keys[0]!) === args[0] ? 1 : 0;
        }
        throw new Error("Unexpected Redis script in shared-runtime test.");
      },
      publish: async (channel, message) => {
        for (const [subscriber, patterns] of this.subscriptions) {
          for (const [pattern, listener] of patterns) {
            const matches = pattern.endsWith("*")
              ? channel.startsWith(pattern.slice(0, -1))
              : channel === pattern;
            if (matches) queueMicrotask(() => listener(message, channel));
          }
        }
        return 1;
      },
      pSubscribe: async (pattern, listener) => {
        let subscriptions = this.subscriptions.get(client);
        if (!subscriptions) {
          subscriptions = new Map();
          this.subscriptions.set(client, subscriptions);
        }
        subscriptions.set(pattern, listener);
      },
      pUnsubscribe: async (pattern) => {
        this.subscriptions.get(client)?.delete(pattern);
      },
      close: async () => {
        this.subscriptions.delete(client);
      },
    };
    return client;
  }
}

function socketHarness() {
  const packets: Record<string, any>[] = [];
  const socket: FreeFlightSocket = {
    readyState: 1,
    bufferedAmount: 0,
    send(data) { packets.push(JSON.parse(data)); },
    close() { this.readyState = 3; },
  };
  return { socket, packets };
}

const waitFor = async (predicate: () => boolean) => {
  for (let tries = 0; tries < 50; tries++) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
  }
  assert.ok(predicate(), "timed out waiting for shared-runtime delivery");
};

test("two socket instances share one authoritative shard and restore it after owner restart", async () => {
  const hub = new FakeRedisHub();
  const stored = new Map<string, StoredFreeFlightCheckpoint>();
  const admission = async () => ({
    sessionKey: "mars:phobos-yard", faction: "ussf" as const, shipId: "sentinel" as const,
  });
  const checkpointCallbacks = {
    load: async (sessionKey: string) => stored.get(sessionKey) ?? null,
    save: async (
      sessionKey: string,
      snapshot: FreeFlightSessionCheckpointV1,
      fencingToken: number,
      checkpointSequence: number,
    ) => {
      const previous = stored.get(sessionKey);
      if (previous && (previous.fencingToken > fencingToken ||
          previous.fencingToken === fencingToken &&
          previous.checkpointSequence >= checkpointSequence)) return false;
      stored.set(sessionKey, {
        stateVersion: 1, fencingToken, checkpointSequence, snapshot,
      });
      return true;
    },
  };
  const ownerLocal = createFreeFlightRuntime({
    resolveAdmission: admission,
    loadCheckpoint: checkpointCallbacks.load,
    saveCheckpoint: checkpointCallbacks.save,
    retainEncounterReservationsOnClose: true,
  });
  const proxyLocal = createFreeFlightRuntime({
    resolveAdmission: admission,
    loadCheckpoint: checkpointCallbacks.load,
    saveCheckpoint: checkpointCallbacks.save,
    retainEncounterReservationsOnClose: true,
  });
  const owner = await createFreeFlightSharedRuntime({
    runtime: ownerLocal, bus: hub.client(), resolveAdmission: admission,
    instanceId: "11111111-1111-4111-8111-111111111111",
  });
  const proxy = await createFreeFlightSharedRuntime({
    runtime: proxyLocal, bus: hub.client(), resolveAdmission: admission,
    instanceId: "22222222-2222-4222-8222-222222222222",
  });
  const pilotA = socketHarness();
  const pilotB = socketHarness();
  try {
    await owner.handle(pilotA.socket, "shared-pilot-a", { type: "freeflight_join" });
    const joinA = pilotA.packets.find((packet) => packet.type === "freeflight_joined")!;
    assert.ok(joinA);
    const snapshotA = joinA.snapshot as FreeFlightSnapshotV1;

    await proxy.handle(pilotB.socket, "shared-pilot-b", { type: "freeflight_join" });
    await waitFor(() => pilotB.packets.some((packet) => packet.type === "freeflight_joined"));
    const joinB = pilotB.packets.find((packet) => packet.type === "freeflight_joined")!;
    const snapshotB = joinB.snapshot as FreeFlightSnapshotV1;
    assert.equal(snapshotB.sessionInstanceId, snapshotA.sessionInstanceId);
    assert.ok(snapshotB.actors.some((actor) => actor.callsign === "WING PILOT"));

    await owner.close();
    await waitFor(() => pilotB.socket.readyState !== 1);
    const recovered = socketHarness();
    await proxy.handle(recovered.socket, "shared-pilot-a", { type: "freeflight_join" });
    const recoveredJoin = recovered.packets.find((packet) => packet.type === "freeflight_joined")!;
    assert.ok(recoveredJoin);
    const recoveredSnapshot = recoveredJoin.snapshot as FreeFlightSnapshotV1;
    assert.equal(recoveredSnapshot.sessionInstanceId, snapshotA.sessionInstanceId);
    assert.equal(recoveredSnapshot.ownActorId, snapshotA.ownActorId);
    assert.equal(isFreeFlightSnapshotV1(recoveredSnapshot), true);
  } finally {
    await Promise.all([owner.close(), proxy.close()]);
  }
});

test("simultaneous first joins create only one session checkpoint load", async () => {
  const hub = new FakeRedisHub();
  let checkpointLoads = 0;
  const admission = async () => ({
    sessionKey: "mars:rust-disc", faction: "ussf" as const, shipId: "sentinel" as const,
  });
  const local = createFreeFlightRuntime({
    resolveAdmission: admission,
    loadCheckpoint: async () => {
      checkpointLoads += 1;
      await new Promise((resolve) => setTimeout(resolve, 12));
      return null;
    },
  });
  const shared = await createFreeFlightSharedRuntime({
    runtime: local,
    bus: hub.client(),
    resolveAdmission: admission,
    instanceId: "33333333-3333-4333-8333-333333333333",
  });
  const first = socketHarness();
  const second = socketHarness();
  try {
    await Promise.all([
      shared.handle(first.socket, "pilot-first", { type: "freeflight_join" }),
      shared.handle(second.socket, "pilot-second", { type: "freeflight_join" }),
    ]);
    await waitFor(() => first.packets.some((packet) => packet.type === "freeflight_joined") &&
      second.packets.some((packet) => packet.type === "freeflight_joined"));
    const firstSnapshot = first.packets.find((packet) => packet.type === "freeflight_joined")!
      .snapshot as FreeFlightSnapshotV1;
    const secondSnapshot = second.packets.find((packet) => packet.type === "freeflight_joined")!
      .snapshot as FreeFlightSnapshotV1;
    assert.equal(checkpointLoads, 1);
    assert.equal(firstSnapshot.sessionInstanceId, secondSnapshot.sessionInstanceId);
  } finally {
    await shared.close();
  }
});

test("different canonical locations keep independent live spatial shards", async () => {
  const hub = new FakeRedisHub();
  const admissions = new Map([
    ["pilot-near", "mars:phobos-yard"],
    ["pilot-far", "mars:rust-disc"],
  ]);
  const admission = async (userId: string) => ({
    sessionKey: admissions.get(userId)!,
    faction: "ussf" as const,
    shipId: "sentinel" as const,
  });
  const firstRuntime = createFreeFlightRuntime({ resolveAdmission: admission });
  const secondRuntime = createFreeFlightRuntime({ resolveAdmission: admission });
  const first = await createFreeFlightSharedRuntime({
    runtime: firstRuntime, bus: hub.client(), resolveAdmission: admission,
    instanceId: "44444444-4444-4444-8444-444444444444",
  });
  const second = await createFreeFlightSharedRuntime({
    runtime: secondRuntime, bus: hub.client(), resolveAdmission: admission,
    instanceId: "55555555-5555-4555-8555-555555555555",
  });
  const near = socketHarness();
  const far = socketHarness();
  try {
    await Promise.all([
      first.handle(near.socket, "pilot-near", { type: "freeflight_join" }),
      second.handle(far.socket, "pilot-far", { type: "freeflight_join" }),
    ]);
    const nearSnapshot = near.packets.find((packet) => packet.type === "freeflight_joined")!
      .snapshot as FreeFlightSnapshotV1;
    const farSnapshot = far.packets.find((packet) => packet.type === "freeflight_joined")!
      .snapshot as FreeFlightSnapshotV1;
    assert.notEqual(nearSnapshot.sessionInstanceId, farSnapshot.sessionInstanceId);
    assert.equal(nearSnapshot.actors.some((actor) => actor.callsign === "WING PILOT"), false);
    assert.equal(farSnapshot.actors.some((actor) => actor.callsign === "WING PILOT"), false);
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});

test("one pilot account cannot hold active seats in two spatial shards", async () => {
  const hub = new FakeRedisHub();
  let sessionKey = "mars:phobos-yard";
  const admission = async () => ({
    sessionKey, faction: "ussf" as const, shipId: "sentinel" as const,
  });
  const firstRuntime = createFreeFlightRuntime({ resolveAdmission: admission });
  const secondRuntime = createFreeFlightRuntime({ resolveAdmission: admission });
  const first = await createFreeFlightSharedRuntime({
    runtime: firstRuntime, bus: hub.client(), resolveAdmission: admission,
    instanceId: "66666666-6666-4666-8666-666666666666",
  });
  const second = await createFreeFlightSharedRuntime({
    runtime: secondRuntime, bus: hub.client(), resolveAdmission: admission,
    instanceId: "77777777-7777-4777-8777-777777777777",
  });
  const firstSeat = socketHarness();
  const duplicateSeat = socketHarness();
  try {
    await first.handle(firstSeat.socket, "same-account", { type: "freeflight_join" });
    assert.ok(firstSeat.packets.some((packet) => packet.type === "freeflight_joined"));
    sessionKey = "mars:rust-disc";
    await second.handle(duplicateSeat.socket, "same-account", { type: "freeflight_join" });
    assert.ok(duplicateSeat.packets.some((packet) =>
      packet.type === "error" && packet.reason === "freeflight_session_already_active",
    ));
    assert.equal(duplicateSeat.socket.readyState, 3);
    assert.equal(firstSeat.socket.readyState, 1);
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});

test("reading a lease does not extend the local simulation deadline", async () => {
  const hub = new FakeRedisHub();
  let now = 0;
  const admission = async () => ({
    sessionKey: "mars:rust-disc", faction: "ussf" as const, shipId: "sentinel" as const,
  });
  const local = createFreeFlightRuntime({ resolveAdmission: admission });
  const shared = await createFreeFlightSharedRuntime({
    runtime: local, bus: hub.client(), resolveAdmission: admission, now: () => now,
  });
  const pilot = socketHarness();
  try {
    await shared.handle(pilot.socket, "lease-pilot", { type: "freeflight_join" });
    assert.equal(shared.sessionCount, 1);
    now = 14_900;
    await shared.handle(pilot.socket, "lease-pilot", { type: "freeflight_join" });
    now = 15_001;
    shared.advance();
    assert.equal(shared.sessionCount, 0);
    assert.equal(pilot.socket.readyState, 3);
  } finally {
    await shared.close();
  }
});

test("a pending renewal and late success cannot keep an expired owner simulating", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const hub = new FakeRedisHub();
  const bus = hub.client();
  const originalEval = bus.eval;
  let finishRenewal: ((value: number) => void) | undefined;
  bus.eval = (script, options) => script.includes("PEXPIRE")
    ? new Promise<number>((resolve) => { finishRenewal = resolve; })
    : originalEval(script, options);
  let now = 0;
  const admission = async () => ({
    sessionKey: "mars:rust-disc", faction: "ussf" as const, shipId: "sentinel" as const,
  });
  const local = createFreeFlightRuntime({ resolveAdmission: admission });
  const shared = await createFreeFlightSharedRuntime({
    runtime: local, bus, resolveAdmission: admission, now: () => now,
  });
  const pilot = socketHarness();
  try {
    await shared.handle(pilot.socket, "pending-lease-pilot", { type: "freeflight_join" });
    now = 4_000;
    t.mock.timers.tick(4_000);
    assert.ok(finishRenewal, "renewal must be in flight");
    now = 15_001;
    shared.advance();
    assert.equal(shared.sessionCount, 0);
    assert.equal(pilot.socket.readyState, 3);
    finishRenewal(1);
    await Promise.resolve();
    await Promise.resolve();
    shared.advance();
    assert.equal(shared.sessionCount, 0, "late renewal cannot revive the old owner");
    assert.equal(shared.pilotCount, 0);
  } finally {
    finishRenewal?.(0);
    await shared.close();
  }
});

test("a checkpoint load completing after lease loss cannot create an orphan session", async () => {
  const hub = new FakeRedisHub();
  let now = 0;
  let finishLoad: (() => void) | undefined;
  const admission = async () => ({
    sessionKey: "mars:rust-disc", faction: "ussf" as const, shipId: "sentinel" as const,
  });
  const local = createFreeFlightRuntime({
    resolveAdmission: admission,
    loadCheckpoint: () => new Promise<null>((resolve) => {
      finishLoad = () => resolve(null);
    }),
  });
  const shared = await createFreeFlightSharedRuntime({
    runtime: local, bus: hub.client(), resolveAdmission: admission, now: () => now,
  });
  const pilot = socketHarness();
  try {
    const joining = shared.handle(pilot.socket, "slow-checkpoint-pilot", { type: "freeflight_join" });
    await waitFor(() => Boolean(finishLoad));
    now = 15_001;
    shared.advance();
    finishLoad!();
    await joining;
    shared.advance();
    assert.equal(shared.sessionCount, 0);
    assert.equal(shared.pilotCount, 0);
    assert.equal(pilot.socket.readyState, 3);
    assert.equal(pilot.packets.some(packet => packet.type === "freeflight_joined"), false);
  } finally {
    finishLoad?.();
    await shared.close();
  }
});
