export type Faction = "accord" | "ussf";
export type Scheme = "arc" | "strafe";
export type PresetId = 0 | 1 | 2 | 3;

export type ShipId =
  | "mandjet"
  | "shakuna"
  | "sundara"
  | "tripura"
  | "duskbreaker"
  | "sentinel"
  | "splitter"
  | "glide";

export type ShipDef = {
  id: ShipId;
  name: string;
  faction: Faction;
  role: string;
  blurb: string;
  handling: number;
  maxSpeed: number;
  accel: number;
  shield: number;
  hull: number;
  fireInterval: number;
  shotDmg: number;
  shotSpeed: number;
  turnRate: number;
  radius: number;
  ultName: string;
  ultShort: string;
  ultCd: number;
};

export const PRESET_PIPS: Record<PresetId, [number, number, number]> = {
  0: [2, 2, 2],
  1: [1, 4, 1],
  2: [1, 1, 4],
  3: [4, 1, 1],
};

export const PRESET_NAME = ["BAL", "WEP", "DEF", "ENG"] as const;

export const SHIPS: Record<ShipId, ShipDef> = {
  mandjet: {
    id: "mandjet",
    name: "Mandjet",
    faction: "accord",
    role: "Vanguard",
    blurb: "Solar juggernaut. Slow nose, heavy beam, a flare that clears the cone ahead.",
    handling: 0.55,
    maxSpeed: 18,
    accel: 26,
    shield: 160,
    hull: 110,
    fireInterval: 0.18,
    shotDmg: 3.6,
    shotSpeed: 74,
    turnRate: 2.15,
    radius: 1.75,
    ultName: "Solar Flare",
    ultShort: "FLARE",
    ultCd: 8,
  },
  shakuna: {
    id: "shakuna",
    name: "Shakuna",
    faction: "accord",
    role: "Hunter",
    blurb: "Bird interceptor. Lives on the turn. Wing Dive cuts whoever is in the path.",
    handling: 1.35,
    maxSpeed: 36,
    accel: 52,
    shield: 70,
    hull: 52,
    fireInterval: 0.11,
    shotDmg: 2.2,
    shotSpeed: 64,
    turnRate: 2.15,
    radius: 1.2,
    ultName: "Wing Dive",
    ultShort: "DIVE",
    ultCd: 7,
  },
  sundara: {
    id: "sundara",
    name: "Sundara",
    faction: "accord",
    role: "Striker",
    blurb: "Needle bomber. Cloak, then the next torpedo crits. Lock a target and it homes.",
    handling: 0.85,
    maxSpeed: 24,
    accel: 34,
    shield: 84,
    hull: 64,
    fireInterval: 1.15,
    shotDmg: 22,
    shotSpeed: 30,
    turnRate: 2.15,
    radius: 1.25,
    ultName: "Vortex Camouflage",
    ultShort: "CLOAK",
    ultCd: 10,
  },
  tripura: {
    id: "tripura",
    name: "Tripura",
    faction: "accord",
    role: "Support",
    blurb: "Three rings. Trinity Shift freezes enemy thrust nearby. It does not freeze guns.",
    handling: 0.75,
    maxSpeed: 20,
    accel: 30,
    shield: 120,
    hull: 86,
    fireInterval: 0.25,
    shotDmg: 4.2,
    shotSpeed: 52,
    turnRate: 2.15,
    radius: 1.6,
    ultName: "Trinity Shift",
    ultShort: "SHIFT",
    ultCd: 11,
  },
  duskbreaker: {
    id: "duskbreaker",
    name: "Duskbreaker",
    faction: "ussf",
    role: "Striker",
    blurb: "OTV-C frame. Quantum Lock marks a target and thickens your shots for a few seconds.",
    handling: 0.95,
    maxSpeed: 26,
    accel: 40,
    shield: 100,
    hull: 78,
    fireInterval: 0.21,
    shotDmg: 4.4,
    shotSpeed: 60,
    turnRate: 2.15,
    radius: 1.4,
    ultName: "Quantum Lock",
    ultShort: "LOCK",
    ultCd: 11,
  },
  sentinel: {
    id: "sentinel",
    name: "Sentinel-G",
    faction: "ussf",
    role: "Support",
    blurb: "GSSAP frame. Proximity Ward reseals your shields and shrugs the next hits.",
    handling: 0.7,
    maxSpeed: 17,
    accel: 24,
    shield: 150,
    hull: 90,
    fireInterval: 0.29,
    shotDmg: 4.8,
    shotSpeed: 48,
    turnRate: 2.15,
    radius: 1.55,
    ultName: "Proximity Ward",
    ultShort: "WARD",
    ultCd: 12,
  },
  splitter: {
    id: "splitter",
    name: "Splitter Ring",
    faction: "ussf",
    role: "Hunter",
    blurb: "ESPA frame. Ring Split throws the hostile wing off their locks.",
    handling: 1,
    maxSpeed: 25,
    accel: 38,
    shield: 92,
    hull: 68,
    fireInterval: 0.18,
    shotDmg: 3.6,
    shotSpeed: 58,
    turnRate: 2.15,
    radius: 1.45,
    ultName: "Ring Split",
    ultShort: "SPLIT",
    ultCd: 9,
  },
  glide: {
    id: "glide",
    name: "Glide Knife",
    faction: "ussf",
    role: "Raider",
    blurb: "HTV frame. Skip Reentry is untargetable, then a ram. Miss it and the gun is thin.",
    handling: 1.15,
    maxSpeed: 34,
    accel: 46,
    shield: 62,
    hull: 48,
    fireInterval: 0.2,
    shotDmg: 3.6,
    shotSpeed: 66,
    turnRate: 2.15,
    radius: 1.15,
    ultName: "Skip Reentry",
    ultShort: "RAM",
    ultCd: 12,
  },
};

export const ROSTER: Record<Faction, ShipId[]> = {
  accord: ["mandjet", "shakuna", "sundara", "tripura"],
  ussf: ["duskbreaker", "sentinel", "splitter", "glide"],
};

export function otherFaction(f: Faction): Faction {
  return f === "accord" ? "ussf" : "accord";
}

export function refitMul(level: number): number {
  return 1 + Math.max(0, Math.min(5, level)) * 0.06;
}
