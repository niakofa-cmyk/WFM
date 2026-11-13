import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as THREE from "./three-flight-runtime";
import {
  readSharedFlightImpact, createSharedFlightImpactEffects, createSharedFlightImpactQueue,
} from "./shared-flight-impact-effects";

const hit = (overrides: Record<string, unknown> = {}) => ({
  type: "freeflight_weapon_event", eventId: "impact:1", targetActorId: "enemy:1",
  to: { x: 10, y: 20, z: 30 }, shieldDamage: 0, hullDamage: 12,
  destroyed: false, ...overrides,
});
test("only validated authoritative contacts select shield, hull, world or destruction visuals", () => {
  assert.equal(readSharedFlightImpact(hit())?.kind, "hull");
  assert.equal(readSharedFlightImpact(hit({ subsystemDisabled: true }))?.kind, "subsystem");
  assert.equal(readSharedFlightImpact(hit({ subsystemDisabled: true, destroyed: true }))?.kind, "destruction");
  assert.equal(readSharedFlightImpact(hit({ shieldDamage: 12, hullDamage: 0 }))?.kind, "shield");
  assert.equal(readSharedFlightImpact(hit({ destroyed: true }))?.kind, "destruction");
  assert.equal(readSharedFlightImpact(hit({ type: "freeflight_world_impact" }))?.kind, "world");
  for (const bad of [hit({ hullDamage: -1 }), hit({ shieldDamage: NaN }),
    hit({ destroyed: "true" }), hit({ hullDamage: 0 }), hit({ to: { x: Infinity, y: 0, z: 0 } }),
    hit({ targetActorId: "" }), hit({ type: "client_destroy_claim" })])
    assert.equal(readSharedFlightImpact(bad), null);
});
test("contacts without launch tracers render once; queues and lifetime stay bounded", () => {
  const queue = createSharedFlightImpactQueue();
  assert.equal(queue.push(hit({ destroyed: true }), 100), true);
  assert.equal(queue.push(hit({ destroyed: true }), 100), false);
  assert.equal(queue.push(hit({ destroyed: true, eventId: "impact:2" }), 100), false);
  assert.equal(queue.drain(200).length, 1);
  assert.equal(queue.drain(201).length, 0);
  for (let i = 0; i < 200; i++) queue.push(hit({ eventId: `hit:${i}` }), 500);
  assert.equal(queue.drain(501).length, 48);
  queue.push(hit({ eventId: "old:hit" }), 500);
  assert.equal(queue.drain(1600).length, 0);
  queue.clear();
  assert.equal(queue.push(hit({ destroyed: true }), 1700), true);
  for (let i = 0; i < 100; i++) queue.push(hit({ eventId: `cover:${i}` }), 1700);
  assert.ok(queue.drain(1701).some(p => p.kind === "destruction"),
    "sustained firing cannot evict a pending explosion");
});
test("pooled explosion survives ship removal, expands in 3D, rebases and disposes every resource", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 500);
  const effects = createSharedFlightImpactEffects(scene);
  assert.equal(scene.children.length, 12);
  effects.emit(readSharedFlightImpact(hit({ destroyed: true }))!, { x: 10, y: 20.9, z: 30 }, 100);
  effects.update(300, camera);
  const blast = scene.children.find(c => c.visible)! as THREE.Group;
  assert.equal(blast.userData.kind, "destruction");
  assert.equal(blast.children.length, 3, "core, camera-facing shock ring and 3D debris/sparks");
  assert.ok(blast.children[0]!.scale.x > 1);
  const sparks = blast.children[2] as THREE.Points;
  assert.ok(sparks.geometry.getAttribute("position").getY(0) !== 0);
  for (let i = 0; i < 100; i++)
    effects.emit(readSharedFlightImpact(hit({ type: "freeflight_world_impact", eventId: `wall:${i}` }))!,
      { x: 50, y: 0, z: 0 }, 350);
  effects.update(400, camera, p => ({ x: p.x - 512, y: p.y + .9, z: p.z }));
  assert.equal(blast.position.x, -502, "floating origin must not move the explosion's absolute location");
  effects.update(1500, camera);
  assert.equal(scene.children.some(c => c.visible), false);
  let disposed = 0;
  sparks.geometry.addEventListener("dispose", () => { disposed++; });
  effects.dispose();
  assert.equal(disposed, 1);
  assert.equal(scene.children.length, 0);
});
test("shared Arena connects contacts, damage controllers and cleanup without requiring a tracer", () => {
  const source = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  assert.match(source, /freeFlightImpactQueueRef\.current\.push\(packet/);
  assert.match(source, /entry\.damage\.update\(actor\.hull, actor\.hullMax\)/);
  assert.match(source, /sharedImpactEffects\.emit\(impact/);
  assert.match(source, /sharedImpactEffects\.dispose\(\)/);
});
