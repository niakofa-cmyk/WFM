import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  FREE_FLIGHT_TARGETING_V1,
  isFreeFlightSnapshotV1,
  isFreeFlightTargetState,
  type FreeFlightTargetState,
} from "@workspace/orbital-sim";
import { readExplorationReceipt } from "../game/exploration-encounter";
import type { UniversePatrolEncounter } from "../game/universe-patrols";
import { createFreeFlightRuntime } from "./free-flight-runtime";

type Packet = { type?: string; [key: string]: unknown };

test("shared targeting cycles hostile ships, holds selection through flight and reports server missile readiness", async () => {
  let now = Date.now();
  const contact: UniversePatrolEncounter = {
    patrolId: "target-lock-patrol001", locationId: "phobos-yard", faction: "ussf",
    callsign: "Lock test patrol", route: ["phobos-yard"], revision: 0,
    ships: [
      { id: "target-lock-ship001", hullId: "duskbreaker", name: "Duskbreaker", callsign: "ALPHA" },
      { id: "target-lock-ship002", hullId: "duskbreaker", name: "Duskbreaker", callsign: "BRAVO" },
    ],
  };
  const packets: Packet[] = [];
  const socket = {
    readyState: 1, bufferedAmount: 0,
    send: (value: string) => { packets.push(JSON.parse(value) as Packet); },
    close: () => {},
  };
  const userId = `lock-pilot-${randomUUID()}`;
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({
      sessionKey: "mars:target-lock-test", faction: "accord", shipId: "mandjet",
    }),
    resolveUniversePatrols: async (_userId, faction) => faction === "ussf" ? [contact] : [],
    reserveUniversePatrol: async () => contact,
    releaseUniversePatrol: async () => {},
    settleScoutEncounter: async receipt => {
      const resolved = readExplorationReceipt(receipt);
      return { status: "settled", awards: resolved.pilots.map(pilot => ({
        ...pilot, balanceAfter: pilot.credits, revision: 1,
      })) };
    },
  });
  try {
    await runtime.handle(socket, userId, {
      type: "freeflight_join", openingEncounter: true,
    });
    const joined = packets.find(packet => packet.type === "freeflight_joined")!;
    assert.equal((joined.targeting as { protocol: string }).protocol, FREE_FLIGHT_TARGETING_V1);
    assert.equal(packets.some(packet => packet.type === "freeflight_engagement_started"), true);
    const snapshot = packets.find(packet => packet.type === "freeflight_snapshot")!.snapshot;
    assert.equal(isFreeFlightSnapshotV1(snapshot), true);
    const alpha = `patrol-ship:${contact.ships[0]!.id}`;
    const bravo = `patrol-ship:${contact.ships[1]!.id}`;
    assert.equal((snapshot as { actors: Array<{ actorId: string }> }).actors.some(actor => actor.actorId === alpha), true);
    assert.equal((snapshot as { actors: Array<{ actorId: string }> }).actors.some(actor => actor.actorId === bravo), true);
    const seq = (joined.targeting as { nextSeq: number }).nextSeq;

    await runtime.handle(socket, userId, {
      type: "freeflight_target_cycle", protocol: FREE_FLIGHT_TARGETING_V1, seq,
    });
    let selection = packets.filter(packet => packet.type === "freeflight_target_state").at(-1)!
      .state as FreeFlightTargetState;
    assert.equal(isFreeFlightTargetState(selection), true);
    assert.equal(selection.targetActorId, alpha, "the first server-owned cycle selects a deterministic hostile");
    const selectedFirst = selection.targetActorId!;

    await runtime.handle(socket, userId, {
      type: "freeflight_target_cycle", protocol: FREE_FLIGHT_TARGETING_V1, seq: seq + 1,
    });
    assert.ok(packets.some(packet => packet.type === "error" &&
      packet.reason === "freeflight_target_cycle_rate_limited"));
    await new Promise(resolve => setTimeout(resolve, 130));
    await runtime.handle(socket, userId, {
      type: "freeflight_target_cycle", protocol: FREE_FLIGHT_TARGETING_V1, seq: seq + 1,
    });
    selection = packets.filter(packet => packet.type === "freeflight_target_state").at(-1)!
      .state as FreeFlightTargetState;
    assert.notEqual(selection.targetActorId, selectedFirst, "the second switch selects the other hostile");
    assert.equal(selection.targetActorId, bravo);

    const selected = selection.targetActorId;
    let inputSeq = 1;
    for (let tick = 0; tick < 18; tick++) {
      now += 34;
      await runtime.handle(socket, userId, {
        type: "freeflight_input", input: {
          version: 5, seq: inputSeq++, targetId: null, throttle: 0, yaw: 0, pitch: 0,
          strafe: .2, vertical: .1, roll: 0, fire: false, missile: false, boost: false,
          brake: false, inertial: false, aimAssist: false, countermeasure: false,
        },
      });
      runtime.advance(now);
    }
    selection = packets.filter(packet => packet.type === "freeflight_target_state").at(-1)!
      .state as FreeFlightTargetState;
    assert.equal(selection.targetActorId, selected, "aiming-neutral evasive translation holds the same enemy");
    assert.ok(selection.lockProgress >= 0 && selection.lockProgress <= 1,
      "the server reports a valid bounded missile lock while the pilot moves");
    assert.equal(selection.missileReady, false, "range and aiming rules still gate launch");

    await runtime.handle(socket, userId, {
      type: "freeflight_target_cycle", protocol: FREE_FLIGHT_TARGETING_V1, seq: seq + 1,
    });
    assert.ok(packets.some(packet => packet.type === "error" &&
      packet.reason === "invalid_freeflight_target_cycle"), "sequence replay cannot switch targets again");
    await runtime.handle(socket, userId, {
      type: "freeflight_target_cycle", protocol: FREE_FLIGHT_TARGETING_V1, seq: seq + 2, targetActorId: alpha,
    });
    assert.ok(packets.some(packet => packet.type === "error" &&
      packet.reason === "invalid_freeflight_target_cycle"), "clients cannot forge an arbitrary target ID");
  } finally {
    await runtime.close();
  }
});
