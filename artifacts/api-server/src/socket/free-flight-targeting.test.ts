import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  FREE_FLIGHT_ASSIST_V1,
  FREE_FLIGHT_TARGETING_V1,
  isFreeFlightSnapshotV1,
  isFreeFlightTargetState,
  rotate,
  type FreeFlightSnapshotV1,
  type FreeFlightTargetState,
} from "@workspace/orbital-sim";
import { readExplorationReceipt } from "../game/exploration-encounter";
import type { UniversePatrolEncounter } from "../game/universe-patrols";
import { createFreeFlightRuntime } from "./free-flight-runtime";

type Packet = { type?: string; [key: string]: unknown };

test("two pilots acquire a full missile lock on one enemy while moving and switch charge independently", async () => {
  let now = Date.now();
  const realNow = Date.now;
  Date.now = () => now;
  const contact: UniversePatrolEncounter = {
    patrolId: "paired-lock-patrol001", locationId: "phobos-yard", faction: "ussf",
    callsign: "Paired lock patrol", route: ["phobos-yard"], revision: 0,
    ships: [1, 2].map(index => ({
      id: `paired-lock-ship00${index}`, hullId: "duskbreaker",
      name: "Duskbreaker", callsign: `TARGET ${index}`,
    })),
  };
  const packets: Packet[][] = [[], []];
  const sockets = packets.map(received => ({
    readyState: 1, bufferedAmount: 0,
    send: (value: string) => { received.push(JSON.parse(value)); },
    close: () => {},
  }));
  const users = ["paired-lock-lead", "paired-lock-wing"];
  const frame = (index: number) => {
    const snapshot = packets[index]!.filter(packet =>
      isFreeFlightSnapshotV1(packet.snapshot)).at(-1)?.snapshot;
    assert.ok(isFreeFlightSnapshotV1(snapshot));
    return snapshot as FreeFlightSnapshotV1;
  };
  const selection = (index: number) => {
    const state = packets[index]!.filter(packet =>
      packet.type === "freeflight_target_state").at(-1)?.state;
    assert.ok(isFreeFlightTargetState(state));
    return state;
  };
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({
      sessionKey: "mars:paired-lock", faction: "accord", shipId: "mandjet",
    }),
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => contact,
    releaseUniversePatrol: async () => {},
    settleScoutEncounter: async () => {
      assert.fail("nonlethal lock acquisition must not settle an encounter");
    },
    patrolSpawnDistanceMeters: 30,
  });
  try {
    for (let index = 0; index < 2; index++) {
      await runtime.handle(sockets[index]!, users[index]!, {
        type: "freeflight_join", openingEncounter: true,
      });
    }
    await runtime.handle(sockets[1]!, users[1]!, {
      type: "freeflight_engage", targetActorId: `patrol-ship:${contact.ships[0]!.id}`,
    });
    for (let index = 0; index < 2; index++) {
      await runtime.handle(sockets[index]!, users[index]!, {
        type: "freeflight_target_nearest", protocol: FREE_FLIGHT_TARGETING_V1, seq: 1,
      });
    }
    const commonTarget = selection(0).targetActorId;
    assert.ok(commonTarget);
    if (selection(1).targetActorId !== commonTarget) {
      now += 150;
      await runtime.handle(sockets[1]!, users[1]!, {
        type: "freeflight_target_cycle", protocol: FREE_FLIGHT_TARGETING_V1, seq: 2,
      });
    }
    assert.equal(selection(1).targetActorId, commonTarget);
    const starts = [0, 1].map(index => {
      const snapshot = frame(index);
      return snapshot.actors.find(actor => actor.actorId === snapshot.ownActorId)!.position;
    });
    const bounded = (value: number) => Math.max(-1, Math.min(1, value));
    let seq = 0;
    for (; seq < 600 && ![0, 1].every(index => selection(index).missileReady);) {
      seq++;
      now += 34;
      for (let index = 0; index < 2; index++) {
        const snapshot = frame(index);
        const own = snapshot.actors.find(actor => actor.actorId === snapshot.ownActorId)!;
        const target = snapshot.actors.find(actor => actor.actorId === commonTarget)!;
        assert.ok(own.alive && target.alive);
        const q = own.orientation;
        const local = rotate([-q.x, -q.y, -q.z, q.w],
          target.position.x - own.position.x, target.position.y - own.position.y,
          target.position.z - own.position.z);
        await runtime.handle(sockets[index]!, users[index]!, {
          type: "freeflight_input", input: {
            version: 5, seq, targetId: null, throttle: 0,
            yaw: bounded(Math.atan2(-local.x, -local.z) * 2.1),
            pitch: bounded(Math.atan2(local.y, Math.hypot(local.x, local.z)) * 2.1),
            strafe: .12, vertical: .06, roll: 0, fire: false, missile: false,
            boost: false, brake: false, inertial: false, aimAssist: false, countermeasure: false,
          },
        });
      }
      runtime.advance(now);
      for (let index = 0; index < 2; index++) {
        assert.equal(selection(index).targetActorId, commonTarget,
          "normal maneuvering cannot silently replace either pilot's selection");
      }
    }
    for (let index = 0; index < 2; index++) {
      assert.equal(selection(index).lockProgress, 1, `pilot ${index} acquires full lock`);
      assert.equal(selection(index).missileReady, true);
      const snapshot = frame(index);
      const end = snapshot.actors.find(actor => actor.actorId === snapshot.ownActorId)!.position;
      assert.ok(Math.hypot(end.x - starts[index]!.x, end.y - starts[index]!.y,
        end.z - starts[index]!.z) > .1, "lock acquisition includes actual ship translation");
    }
    now += 150;
    await runtime.handle(sockets[0]!, users[0]!, {
      type: "freeflight_target_cycle", protocol: FREE_FLIGHT_TARGETING_V1, seq: 2,
    });
    assert.notEqual(selection(0).targetActorId, commonTarget);
    assert.equal(selection(0).lockProgress, 0);
    assert.equal(selection(0).missileReady, false);
    assert.equal(selection(1).targetActorId, commonTarget);
    assert.equal(selection(1).lockProgress, 1, "another pilot's switch cannot clear this pilot's charge");
    const firedBefore = packets.map(received =>
      received.filter(packet => packet.type === "freeflight_weapon_fired").length);
    now += 34;
    for (let index = 0; index < 2; index++) {
      await runtime.handle(sockets[index]!, users[index]!, {
        type: "freeflight_input", input: {
          version: 5, seq: seq + 1, targetId: null, throttle: 0, yaw: 0, pitch: 0,
          strafe: 0, vertical: 0, roll: 0, fire: false, missile: true, boost: false,
          brake: false, inertial: false, aimAssist: false, countermeasure: false,
        },
      });
    }
    runtime.advance(now);
    const ownIds = [0, 1].map(index => frame(index).ownActorId);
    const newShots = packets[0]!.filter(packet =>
      packet.type === "freeflight_weapon_fired").slice(firedBefore[0]);
    assert.equal(newShots.some(packet => packet.sourceActorId === ownIds[0]), false,
      "the switched pilot cannot launch using the old target's charge");
    assert.equal(newShots.some(packet => packet.sourceActorId === ownIds[1]), true,
      "the other pilot can launch with its independently maintained lock");
  } finally {
    await runtime.close();
    Date.now = realNow;
  }
});

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
    const frame = snapshot as { actors: Array<{
      actorId: string; own: boolean; position: { x: number; y: number; z: number };
    }> };
    const own = frame.actors.find(actor => actor.own)!;
    const nearest = frame.actors.filter(actor => actor.actorId === alpha || actor.actorId === bravo)
      .sort((a, b) => Math.hypot(a.position.x - own.position.x, a.position.y - own.position.y,
        a.position.z - own.position.z) - Math.hypot(b.position.x - own.position.x,
        b.position.y - own.position.y, b.position.z - own.position.z) ||
        a.actorId.localeCompare(b.actorId))[0]!.actorId;
    assert.equal(selection.targetActorId, nearest, "selection starts with the closest eligible hostile in 3D");
    assert.equal((joined.targeting as { nearest: boolean }).nearest, true);
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
    assert.equal(selection.targetActorId, selectedFirst === alpha ? bravo : alpha);

    await new Promise(resolve => setTimeout(resolve, 130));
    await runtime.handle(socket, userId, {
      type: "freeflight_target_nearest", protocol: FREE_FLIGHT_TARGETING_V1, seq: seq + 2,
    });
    selection = packets.filter(packet => packet.type === "freeflight_target_state").at(-1)!
      .state as FreeFlightTargetState;
    assert.equal(selection.targetActorId, nearest, "NEAR returns directly to the nearest hostile");
    assert.equal(selection.lockProgress, 0, "switching clears the previous target's missile charge");

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

test("a server-issued nearby wing call joins the same encounter without a new patrol reservation", async () => {
  const contact: UniversePatrolEncounter = {
    patrolId: "assist-call-patrol001", locationId: "phobos-yard", faction: "accord",
    callsign: "Phobos Intercept", route: ["phobos-yard"], revision: 0,
    ships: [{ id: "assist-call-ship001", hullId: "duskbreaker", name: "Duskbreaker", callsign: "HOSTILE ONE" }],
  };
  const leadPackets: Packet[] = [];
  const wingPackets: Packet[] = [];
  const socketFor = (packets: Packet[]) => ({
    readyState: 1, bufferedAmount: 0,
    send: (value: string) => { packets.push(JSON.parse(value) as Packet); },
    close: () => {},
  });
  const lead = socketFor(leadPackets);
  const wing = socketFor(wingPackets);
  let reservations = 0;
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({
      sessionKey: "mars:assist-call-test", faction: "ussf", shipId: "glide",
    }),
    resolveUniversePatrols: async (_userId, faction) => faction === "accord" ? [contact] : [],
    reserveUniversePatrol: async () => { reservations += 1; return contact; },
    releaseUniversePatrol: async () => {},
    settleScoutEncounter: async () => ({ status: "settled", awards: [] }),
    patrolSpawnDistanceMeters: 30,
  });
  try {
    await runtime.handle(lead, "assist-call-lead", { type: "freeflight_join" });
    await runtime.handle(lead, "assist-call-lead", {
      type: "freeflight_engage", targetActorId: `patrol-ship:${contact.ships[0]!.id}`,
    });
    assert.ok(leadPackets.some(packet => packet.type === "freeflight_engagement_started"));
    assert.equal(reservations, 1);

    await runtime.handle(wing, "assist-call-wing", { type: "freeflight_join" });
    const negotiation = leadPackets.find(packet => packet.type === "freeflight_joined")!;
    assert.deepEqual(negotiation.assistance, { protocol: FREE_FLIGHT_ASSIST_V1 });
    await runtime.handle(lead, "assist-call-lead", {
      type: "freeflight_assist_call", protocol: FREE_FLIGHT_ASSIST_V1,
    });
    const delivered = leadPackets.filter(packet => packet.type === "freeflight_assist_call_result").at(-1)!;
    const actorSummary = (packets: Packet[]) => {
      const snapshot = packets.find(packet => packet.type === "freeflight_joined")?.snapshot as
        { actors?: Array<{ actorId: string; kind: string; faction: string; position: unknown }> } | undefined;
      return snapshot?.actors?.map(({ actorId, kind, faction, position }) =>
        ({ actorId, kind, faction, position }));
    };
    assert.equal(delivered.delivered, 1, JSON.stringify({
      delivered, leadActors: actorSummary(leadPackets), wingActors: actorSummary(wingPackets),
    }));
    const request = wingPackets.find(packet => packet.type === "freeflight_assist_request")!;
    assert.equal(request.patrolCallsign, contact.callsign);
    assert.equal(typeof request.callId, "string");
    assert.equal(wingPackets.some(packet => packet.type === "freeflight_engagement_started"), false,
      "a call alerts the nearby pilot but does not force them into the fight");

    await runtime.handle(wing, "assist-call-wing", {
      type: "freeflight_assist_response", protocol: FREE_FLIGHT_ASSIST_V1,
      callId: request.callId, accept: true,
    });
    const joined = wingPackets.find(packet => packet.type === "freeflight_engagement_started")!;
    assert.equal(joined.assistance, true);
    assert.equal(joined.encounterId,
      leadPackets.find(packet => packet.type === "freeflight_engagement_started")!.encounterId);
    assert.equal(reservations, 1, "the helper joins the existing server-owned reservation");
    assert.ok(leadPackets.some(packet => packet.type === "freeflight_assist_call_update" &&
      packet.status === "accepted"));
    assert.ok(leadPackets.some(packet => packet.type === "freeflight_ally_joined" &&
      packet.participantCount === 2));
  } finally {
    await runtime.close();
  }
});
