import { RUST_DISC_SECTOR, type FlightSector, type FlightState, type FlightInput, type Vector3 } from "./flight-sector";
import type { ShipId } from "./ships";

export const SECTOR_PROTOCOL_VERSION = 1;
export const SECTOR_STEP = 1 / 60;
export const SECTOR_MARS = { position: { x: 0, y: -700, z: -1800 }, radius: 600 };
export type SectorMissionId = "rust-disc" | "mars-approach" | "pale-beacons" | "iron-eclipse";
export type IronEclipseSubsystemId = "point-defense" | "shield-array" | "reactor";
export type IronEclipseOrder = "attack" | "defend" | "escort" | "regroup";
export type IronEclipsePhase = "engage" | "capital" | "extract" | "complete" | "failed";
export type IronEclipseSubsystem = {
  id: IronEclipseSubsystemId; label: string; position: Vector3;
  hull: number; maxHull: number; disabled: boolean;
};
export type IronEclipseWingUnit = {
  id: string; shipId: ShipId; position: Vector3;
  hull: number; maxHull: number; connected: boolean;
};
export type IronEclipseSnapshot = {
  phase: IronEclipsePhase;
  target: IronEclipseSubsystemId | null;
  order: IronEclipseOrder;
  capitalPosition: Vector3;
  subsystems: IronEclipseSubsystem[];
  wing: IronEclipseWingUnit[];
  objectives: {
    primary: "pending" | "complete" | "missed";
    shieldArray: "pending" | "complete" | "missed";
    wingSurvival: "pending" | "complete" | "missed";
  };
};
export type SectorMission = {
  id: SectorMissionId; title: string; description: string; prerequisite: SectorMissionId | null;
  sector: FlightSector;
};
export const IRON_ECLIPSE_SUBSYSTEMS = [
  { id: "point-defense", label: "POINT DEFENSE", maxHull: 120, offset: { x: -26, y: 9, z: 12 } },
  { id: "shield-array", label: "SHIELD ARRAY", maxHull: 140, offset: { x: 20, y: 13, z: -4 } },
  { id: "reactor", label: "REACTOR", maxHull: 180, offset: { x: 0, y: -8, z: -15 } },
] as const;
export const IRON_ECLIPSE_WING = [
  { id: "sable-one", shipId: "glide", offset: { x: -20, y: 8, z: 64 } },
  { id: "sable-two", shipId: "shakuna", offset: { x: 0, y: 12, z: 78 } },
  { id: "sable-three", shipId: "sentinel", offset: { x: 20, y: 8, z: 64 } },
] as const satisfies readonly { id: string; shipId: ShipId; offset: { x: number; y: number; z: number } }[];
export const SECTOR_MISSIONS: readonly SectorMission[] = [
  {
    id: "rust-disc", title: "Rust Disc · Relay Recovery", prerequisite: null,
    description: "Recover the damaged relay, neutralize its sentinel together, then extract. Opens the route to Mars.",
    sector: { ...RUST_DISC_SECTOR, id: "rust-disc-expedition-v1", radius: 3000, planet: SECTOR_MARS },
  },
  {
    id: "mars-approach", title: "Mars Approach · Orbital Survey", prerequisite: "rust-disc",
    description: "Fly beyond the debris belt to scan the physical Mars globe and recover its orbital navigation beacon. Surface landing is not part of this flight.",
    sector: {
      ...RUST_DISC_SECTOR, id: "mars-approach-v1", radius: 3000, planet: SECTOR_MARS,
      relay: { x: 0, y: 100, z: -1100 }, extraction: { x: 250, y: 160, z: -1350 },
      drone: { x: 0, y: 140, z: -1250 }, droneHull: 0,
    },
  },
  {
    id: "pale-beacons", title: "Pale Beacons · Unknown Signal", prerequisite: "mars-approach",
    description: "Trace an unclassified signal beyond the orbital network, clear the signal guardian and bring the discovery home.",
    sector: {
      ...RUST_DISC_SECTOR, id: "pale-beacons-v1", radius: 3000, planet: SECTOR_MARS,
      relay: { x: 850, y: 270, z: -900 }, extraction: { x: 1050, y: 350, z: -1350 },
      drone: { x: 950, y: 300, z: -1150 }, droneHull: 96,
    },
  },
  {
    id: "iron-eclipse", title: "Operation Iron Eclipse", prerequisite: null,
    description: "Hold vector through orbital fire, direct a three-ship AI wing, disable the capital ship’s point defense, and strike its reactor before extraction.",
    sector: {
      ...RUST_DISC_SECTOR, id: "iron-eclipse-v1", radius: 3000, planet: SECTOR_MARS,
      relay: { x: 0, y: 30, z: 80 }, extraction: { x: 180, y: 110, z: -980 },
      drone: { x: 0, y: 70, z: -460 }, droneHull: 120,
    },
  },
];
export function sectorMission(id: unknown): SectorMission | undefined {
  return SECTOR_MISSIONS.find(mission => mission.id === id);
}
export type SectorProgress = {
  completed: SectorMissionId[];
  persistenceAvailable: boolean;
};
export type SectorSettlement = {
  status: "not_started" | "pending" | "recorded" | "unavailable" | "not_eligible";
  reason: string; replayed?: boolean;
};
export type SectorPilotSnapshot = {
  slot: number; shipId: ShipId; connected: boolean; ready: boolean; flight: FlightState;
};
export type SectorCommandRequest =
  | { type: "sector_command"; order: "attack" }
  | { type: "sector_command"; order: "defend" | "escort"; targetSlot: number }
  | { type: "sector_command"; order: "regroup" };
export type IronEclipseCommandRequest =
  | { type: "iron_eclipse_order"; order: IronEclipseOrder }
  | { type: "iron_eclipse_target"; target: IronEclipseSubsystemId };
export type SectorTacticalCommand =
  | { order: "attack"; target: "drone"; targetSlot: null; issuedBySlot: number; issuedAtTick: number }
  | { order: "defend" | "escort" | "regroup"; target: "pilot"; targetSlot: number; issuedBySlot: number; issuedAtTick: number };
export type SectorSnapshot = {
  type: "sector_snapshot"; version: 1; roomCode: string; missionId: SectorMissionId;
  phase: "lobby" | "active" | "complete" | "interrupted" | "failed"; tick: number;
  ownSlot: number; hostSlot: number; pilots: SectorPilotSnapshot[];
  progress: SectorProgress; settlement: SectorSettlement;
  capabilities?: { vectorDrift: boolean; tacticalCommands?: boolean; ironEclipse?: boolean };
  command?: SectorTacticalCommand | null;
  operation?: IronEclipseSnapshot;
};
export type SectorClientPacket =
  | { type: "sector_join"; version: 1; shipId: ShipId; publicListing?: boolean }
  | { type: "sector_ready"; ready: boolean }
  | { type: "sector_launch" }
  | { type: "sector_input"; seq: number; input: FlightInput }
  | { type: "sector_ping"; nonce: number }
  | SectorCommandRequest
  | IronEclipseCommandRequest
  | { type: "sector_retry" };
