import type { MissileFitId, PrimaryWeaponFitId } from "@workspace/orbital-sim";

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
  | "glide"
  | "wasp"
  | "valiant"
  | "aegis"
  | "bastion"
  | "apep"
  | "sekhmet"
  | "garuda"
  | "vajra";
export type ShipAbilityId =
  | "solar-flare" | "wing-dive" | "vortex-camouflage" | "trinity-shift"
  | "quantum-lock" | "proximity-ward" | "ring-split" | "skip-reentry"
  | "vector-pursuit" | "adaptive-fire-control" | "aegis-intercept-grid" | "siege-configuration"
  | "void-veil" | "solar-cataclysm" | "phantom-swarm" | "thunder-veil";
export type PrimaryWeaponFit = PrimaryWeaponFitId;
export type MissileFit = MissileFitId;

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
  ability: ShipAbilityId;
  primaryFit: PrimaryWeaponFit;
  missileFit: MissileFit;
  missileAmmo: number;
  missileDamage: number;
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
    ability: "solar-flare",
    primaryFit: "heavy-beam",
    missileFit: "heavy-seeker",
    missileAmmo: 8,
    missileDamage: 58,
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
    ability: "wing-dive",
    primaryFit: "twin-pulse",
    missileFit: "interceptor",
    missileAmmo: 8,
    missileDamage: 58,
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
    ability: "vortex-camouflage",
    primaryFit: "torpedo-cannon",
    missileFit: "torpedo",
    missileAmmo: 8,
    missileDamage: 58,
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
    ability: "trinity-shift",
    primaryFit: "support-pulse",
    missileFit: "defense-seeker",
    missileAmmo: 8,
    missileDamage: 58,
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
    ability: "quantum-lock",
    primaryFit: "precision-cannon",
    missileFit: "precision-seeker",
    missileAmmo: 8,
    missileDamage: 58,
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
    ability: "proximity-ward",
    primaryFit: "escort-array",
    missileFit: "escort-seeker",
    missileAmmo: 8,
    missileDamage: 58,
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
    ability: "ring-split",
    primaryFit: "disruption-pulse",
    missileFit: "tracking-disruptor",
    missileAmmo: 8,
    missileDamage: 58,
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
    ability: "skip-reentry",
    primaryFit: "raider-pulse",
    missileFit: "light-seeker",
    missileAmmo: 8,
    missileDamage: 58,
  },
  wasp: {
    id: "wasp", name: "Wasp", faction: "ussf", role: "Advanced Interceptor",
    blurb: "High-response interceptor. Vector Pursuit tightens turns and adds controlled lateral thrust.",
    handling: 1.38, maxSpeed: 37, accel: 53, shield: 82, hull: 60,
    fireInterval: 0.115, shotDmg: 2.2, shotSpeed: 66, turnRate: 2.25, radius: 1.18,
    ultName: "Vector Pursuit", ultShort: "VECTOR", ultCd: 9,
    ability: "vector-pursuit", primaryFit: "interceptor-pulse", missileFit: "short-range-interceptor", missileAmmo: 10, missileDamage: 30,
  },
  valiant: {
    id: "valiant", name: "Valiant", faction: "ussf", role: "Multirole Fighter",
    blurb: "Balanced patrol fighter. Adaptive Fire Control trades a little impact for a short rapid-fire window.",
    handling: 0.98, maxSpeed: 27, accel: 40, shield: 102, hull: 80,
    fireInterval: 0.2, shotDmg: 3.8, shotSpeed: 62, turnRate: 2.15, radius: 1.36,
    ultName: "Adaptive Fire Control", ultShort: "ADAPT", ultCd: 11,
    ability: "adaptive-fire-control", primaryFit: "multirole-cannon", missileFit: "multirole-seeker", missileAmmo: 8, missileDamage: 50,
  },
  aegis: {
    id: "aegis", name: "Aegis", faction: "ussf", role: "Missile-Defense Escort",
    blurb: "Escort defense platform. Intercept Grid screens nearby allies against incoming missiles.",
    handling: 0.72, maxSpeed: 19, accel: 27, shield: 150, hull: 98,
    fireInterval: 0.24, shotDmg: 4, shotSpeed: 50, turnRate: 2.15, radius: 1.62,
    ultName: "Aegis Intercept Grid", ultShort: "GRID", ultCd: 14,
    ability: "aegis-intercept-grid", primaryFit: "point-defense-array", missileFit: "point-defense-interceptor", missileAmmo: 10, missileDamage: 32,
  },
  bastion: {
    id: "bastion", name: "Bastion", faction: "ussf", role: "Heavy Assault Gunship",
    blurb: "Armored forward gunship. Siege Configuration trades maneuverability for heavy cannon damage.",
    handling: 0.54, maxSpeed: 17, accel: 24, shield: 145, hull: 125,
    fireInterval: 0.58, shotDmg: 9.5, shotSpeed: 48, turnRate: 2.05, radius: 1.86,
    ultName: "Siege Configuration", ultShort: "SIEGE", ultCd: 14,
    ability: "siege-configuration", primaryFit: "assault-cannon", missileFit: "anti-capital-torpedo", missileAmmo: 6, missileDamage: 74,
  },
  apep: {
    id: "apep", name: "Apep", faction: "accord", role: "Stealth Hunter",
    blurb: "Recon hunter. Void Veil conceals the craft and disrupts a forward hostile sensor contact.",
    handling: 1.12, maxSpeed: 31, accel: 46, shield: 70, hull: 56,
    fireInterval: 0.23, shotDmg: 4.2, shotSpeed: 70, turnRate: 2.15, radius: 1.2,
    ultName: "Void Veil", ultShort: "VEIL", ultCd: 12,
    ability: "void-veil", primaryFit: "stealth-cannon", missileFit: "stealth-precision", missileAmmo: 6, missileDamage: 56,
  },
  sekhmet: {
    id: "sekhmet", name: "Sekhmet", faction: "accord", role: "Heavy Siege Gunship",
    blurb: "Slow siege hull. Solar Cataclysm charges a single armor-piercing forward energy lance.",
    handling: 0.5, maxSpeed: 16, accel: 22, shield: 150, hull: 124,
    fireInterval: 0.64, shotDmg: 11, shotSpeed: 54, turnRate: 2.05, radius: 1.88,
    ultName: "Solar Cataclysm", ultShort: "CATACLYSM", ultCd: 16,
    ability: "solar-cataclysm", primaryFit: "siege-lance", missileFit: "siege-missile", missileAmmo: 4, missileDamage: 76,
  },
  garuda: {
    id: "garuda", name: "Garuda", faction: "accord", role: "Swarm Interceptor",
    blurb: "Fast pursuit craft. Phantom Swarm releases a bounded salvo of independently guided attack drones.",
    handling: 1.4, maxSpeed: 36, accel: 53, shield: 72, hull: 55,
    fireInterval: 0.13, shotDmg: 2.4, shotSpeed: 70, turnRate: 2.2, radius: 1.16,
    ultName: "Phantom Swarm", ultShort: "SWARM", ultCd: 14,
    ability: "phantom-swarm", primaryFit: "swarm-pulse", missileFit: "swarm-pod", missileAmmo: 12, missileDamage: 28,
  },
  vajra: {
    id: "vajra", name: "Vajra", faction: "accord", role: "Tactical Warfare Support",
    blurb: "Electronic-warfare support craft. Thunder Veil disrupts hostile sensors and weapon timing nearby.",
    handling: 0.82, maxSpeed: 21, accel: 31, shield: 132, hull: 98,
    fireInterval: 0.24, shotDmg: 4.1, shotSpeed: 56, turnRate: 2.15, radius: 1.58,
    ultName: "Thunder Veil", ultShort: "THUNDER", ultCd: 14,
    ability: "thunder-veil", primaryFit: "electronic-pulse", missileFit: "ew-seeker", missileAmmo: 8, missileDamage: 44,
  },
};

export const ROSTER: Record<Faction, ShipId[]> = {
  accord: ["mandjet", "shakuna", "sundara", "tripura", "apep", "sekhmet", "garuda", "vajra"],
  ussf: ["duskbreaker", "sentinel", "splitter", "glide", "wasp", "valiant", "aegis", "bastion"],
};

// Default legacy and Orbital-training opponents stay on the certified starter
// four until the expanded NPC roster receives its own balance pass.
export const AI_ROSTER: Record<Faction, ShipId[]> = {
  accord: ["mandjet", "shakuna", "sundara", "tripura"],
  ussf: ["duskbreaker", "sentinel", "splitter", "glide"],
};

// Orbital v4 is the first ruleset to field the specialist ships in normal AI
// wings. Earlier runs keep the certified starter roster for replay stability.
export const FLEET_AI_ROSTER: Record<Faction, ShipId[]> = {
  accord: ["mandjet", "shakuna", "apep", "garuda", "tripura", "sekhmet", "sundara", "vajra"],
  ussf: ["duskbreaker", "splitter", "wasp", "valiant", "sentinel", "aegis", "glide", "bastion"],
};

export function otherFaction(f: Faction): Faction {
  return f === "accord" ? "ussf" : "accord";
}

export function refitMul(level: number): number {
  return 1 + Math.max(0, Math.min(5, level)) * 0.06;
}
