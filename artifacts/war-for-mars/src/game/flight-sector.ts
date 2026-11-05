import { SHIPS, type ShipId } from "./ships";
import {
  canAcquireSectorTarget,
  createSectorFlight,
  NEUTRAL_SECTOR_FLIGHT_INPUT,
  removeHostileSectorProjectilesInPlace,
  sectorFlightForward,
  sectorFlightObjective,
  sectorVectorLength,
  stepSectorFlight,
  sphereSweepTime,
  type SectorFlightInput,
  type SectorFlightRuntime,
  type SectorFlightState,
  type SectorFlightWorld,
  type SectorProjectile,
  type SectorRotation,
  type SectorRock as OrbitalSectorRock,
  type SectorVector3 as OrbitalVector3,
} from "@workspace/orbital-sim";

export type Vector3 = OrbitalVector3;
export type Rotation = SectorRotation;
export type FlightInput = SectorFlightInput;
export type FlightMotionRuntime = SectorFlightRuntime;
export type SectorRock = OrbitalSectorRock;
export type FlightSector = SectorFlightWorld;
export type FlightProjectile = SectorProjectile;
export type FlightState = SectorFlightState<ShipId>;
export const NEUTRAL_FLIGHT_INPUT = NEUTRAL_SECTOR_FLIGHT_INPUT;
export const vectorLength = sectorVectorLength;
export const flightForward = sectorFlightForward;
export const sphereHit = sphereSweepTime;
export const removeHostileProjectilesInPlace = removeHostileSectorProjectilesInPlace;

export const RUST_DISC_SECTOR: FlightSector = {
  id: "rust-disc-flight-v1", version: 1, radius: 460,
  relay: { x: 0, y: 32, z: -110 },
  extraction: { x: 100, y: 20, z: -160 },
  rocks: [
    [-42, 3, -20, 16], [35, 12, -60, 12], [-32, 48, -130, 15],
    [45, -15, -155, 19], [-65, 22, -195, 24], [58, 65, -240, 18],
    [115, -28, -85, 26], [-115, -30, -90, 30], [10, 85, -100, 13],
    [130, 70, -260, 34], [-145, 50, -240, 28], [18, -80, -210, 25],
    [170, 0, 30, 28], [-160, 90, 45, 32], [35, 125, -330, 35],
  ].map(([x, y, z, radius], i) => ({
    id: `rock-${i}`, position: { x: x!, y: y!, z: z! }, radius: radius!,
  })) as SectorRock[],
};

/** Specialist legacy-flight circuit located at Cinder Ring in the shared universe. */
export const CINDER_ASTEROID_SECTOR: FlightSector = {
  id: "cinder-asteroid-flight-v1",
  version: 1,
  radius: 900,
  relay: { x: 210, y: 55, z: -350 },
  extraction: { x: -210, y: 65, z: -390 },
  drone: { x: 0, y: 45, z: -540 },
  droneHull: 72,
  rocks: [
    ...RUST_DISC_SECTOR.rocks,
    { id: "cinder-core", position: { x: 0, y: 0, z: -720 }, radius: 112 },
    { id: "cinder-fragment-a", position: { x: 175, y: 130, z: -640 }, radius: 42 },
    { id: "cinder-fragment-b", position: { x: -190, y: -90, z: -760 }, radius: 54 },
    { id: "cinder-fragment-c", position: { x: 75, y: -180, z: -520 }, radius: 35 },
  ],
};

export function createFlight(shipId: ShipId = "glide", sector: FlightSector = RUST_DISC_SECTOR): FlightState {
  return createSectorFlight(shipId, sector);
}
export function flightObjective(
  state: FlightState,
  sector: FlightSector = RUST_DISC_SECTOR,
): { label: string; position: Vector3 } {
  return sectorFlightObjective(state, sector);
}
export function canLock(state: FlightState, sector: FlightSector = RUST_DISC_SECTOR): boolean {
  return canAcquireSectorTarget(state, sector);
}
export function stepFlight(
  state: FlightState,
  input: FlightInput,
  seconds: number,
  sector: FlightSector = RUST_DISC_SECTOR,
  runtime: FlightMotionRuntime = "sector-motion-v1",
): void {
  stepSectorFlight(state, input, seconds, sector, SHIPS[state.shipId], runtime);
}
