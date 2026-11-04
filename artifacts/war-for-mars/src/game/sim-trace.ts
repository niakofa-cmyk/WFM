// Replay tracing for cross-runtime determinism checks.
//
// The checksum covers every simulation field except the visual-only `fx` queue,
// hashing the exact IEEE-754 bits of each number. Two runtimes agree on a frame
// only when their complete simulation state is bit-identical.
//
// This file must stay byte-identical between the browser and the API server.

import { createMatch, relaysHeld, step, type Match, type MatchSetup, type Pace, type StepInput } from "./sim";
import type { Faction, PresetId, ShipId } from "./ships";

const bits = new Float64Array(1);
const words = new Uint32Array(bits.buffer);
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function mix(hash: number, word: number) {
  let h = hash;
  h = Math.imul(h ^ (word & 0xff), FNV_PRIME);
  h = Math.imul(h ^ ((word >>> 8) & 0xff), FNV_PRIME);
  h = Math.imul(h ^ ((word >>> 16) & 0xff), FNV_PRIME);
  h = Math.imul(h ^ (word >>> 24), FNV_PRIME);
  return h;
}

function hashValue(hash: number, value: unknown): number {
  if (typeof value === "number") {
    bits[0] = value;
    return mix(mix(mix(hash, 1), words[0]), words[1]);
  }
  if (typeof value === "boolean") return mix(hash, value ? 3 : 2);
  if (value === null) return mix(hash, 4);
  if (value === undefined) return mix(hash, 5);
  if (typeof value === "string") {
    let h = mix(hash, 6);
    for (let i = 0; i < value.length; i++) h = mix(h, value.charCodeAt(i));
    return mix(h, value.length);
  }
  if (Array.isArray(value)) {
    let h = mix(hash, 7);
    for (const item of value) h = hashValue(h, item);
    return mix(h, value.length);
  }
  if (typeof value === "object") {
    let h = mix(hash, 8);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (key === "fx") continue;
      h = hashValue(hashValue(h, key), (value as Record<string, unknown>)[key]);
    }
    return h;
  }
  return mix(hash, 9);
}

/** Bit-exact checksum of all simulation state, excluding visual effects. */
export function matchChecksum(match: Match) {
  return hashValue(FNV_OFFSET, match) >>> 0;
}

export type TraceConfig = {
  shipId: ShipId;
  faction: Faction;
  refit: number;
  pace: Pace;
  setup: MatchSetup;
};

export type ReplayTrace = {
  /** checksums[0] is the initial state; checksums[n] is the state after input n. */
  checksums: number[];
  framesApplied: number;
  terminalFrame: number | null;
  outcome: Match["over"];
  kills: number;
  relays: number;
};

/** Replays inputs exactly as the reward server adjudicates them: fixed 1/60 s steps, stopping at the terminal frame. */
export function traceReplay(config: TraceConfig, inputs: StepInput[], dt = 1 / 60): ReplayTrace {
  const match = createMatch(config.shipId, config.faction, config.refit, config.pace, config.setup);
  const checksums = [matchChecksum(match)];
  let framesApplied = 0;
  for (const input of inputs) {
    if (match.over) break;
    step(match, input, dt);
    framesApplied += 1;
    checksums.push(matchChecksum(match));
  }
  return {
    checksums,
    framesApplied,
    terminalFrame: match.over ? framesApplied : null,
    outcome: match.over,
    kills: match.kills,
    relays: relaysHeld(match),
  };
}

/** Index of the first differing checksum, or -1 when the shared prefix and lengths agree. */
export function firstDivergence(a: readonly number[], b: readonly number[]) {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : shared;
}

/** Deterministic synthetic pilot used by regression tests and the cross-runtime gate. */
export function syntheticInputs(seed: number, frames: number): StepInput[] {
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const inputs: StepInput[] = [];
  let throttle = 1;
  let yaw = 0;
  let strafe = 0;
  for (let i = 0; i < frames; i++) {
    if (i % 45 === 0) {
      throttle = next() < 0.8 ? 1 : next() < 0.5 ? 0 : -0.5;
      yaw = Math.round((next() * 2 - 1) * 4) / 4;
      strafe = next() < 0.2 ? (next() < 0.5 ? -1 : 1) : 0;
    }
    const previous = inputs[inputs.length - 1];
    // One-shot controls always include a release frame, as reward validation requires.
    const ult = next() < 0.004 && !previous?.ult;
    const lock = next() < 0.01 && !previous?.lock;
    const evade = next() < 0.003 && !previous?.evade ? (next() < 0.5 ? -1 : 1) : 0;
    const preset = next() < 0.002 && previous?.preset == null ? (Math.floor(next() * 4) as PresetId) : null;
    inputs.push({ throttle, yaw, strafe, pitch: 0, fire: next() < 0.7, ult, lock, evade, preset });
  }
  return inputs;
}
