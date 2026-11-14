import { CINDER_STATION } from "./orbital-universe-session";
import { CINDER_ASTEROID_SECTOR, createFlight, type FlightSector, type FlightState } from "./flight-sector";
import type { ShipId } from "./ships";

/** Small local encounter seeded from the Cinder field; it has no server or reward contract. */
export const NATIVE_CINDER_SKIRMISH_WORLD: FlightSector = {
  ...CINDER_ASTEROID_SECTOR,
  id: "cinder-station-skirmish-v1",
  drone: { x: CINDER_STATION.x, y: CINDER_STATION.y, z: CINDER_STATION.z - 112 },
  droneHull: 72,
};

function placeAtCinderStationGate(flight: FlightState): FlightState {
  flight.position = {
    x: CINDER_STATION.x,
    y: CINDER_STATION.y,
    z: CINDER_STATION.z + CINDER_STATION.interactionRadius - 2,
  };
  flight.velocity = { x: 0, y: 0, z: 0 };
  flight.orientation = { x: 0, y: 0, z: 0, w: 1 };
  return flight;
}

export function createNativeCinderStationMooring(shipId: ShipId): FlightState {
  return placeAtCinderStationGate(createFlight(shipId, CINDER_ASTEROID_SECTOR));
}

/** Create a fresh native-only sortie just outside the physical station gate. */
export function createNativeCinderSkirmish(shipId: ShipId): FlightState {
  const flight = placeAtCinderStationGate(createFlight(shipId, NATIVE_CINDER_SKIRMISH_WORLD));
  flight.stage = "drone";
  flight.discoveries = 1;
  return flight;
}
