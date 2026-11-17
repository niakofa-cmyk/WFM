import { readInput, type Bus } from "./input";
import { toSectorFlightInput } from "./flight-control";
import type { FlightInput } from "./flight-sector";

/**
 * Adapt the existing offline pilot controls to the shared Orbital sector sim.
 * This adapter is local-preview only; the server and Wing wire contracts stay unchanged.
 */
export function readOrbitalPreviewInput(bus: Bus, at = Date.now()): FlightInput {
  const pilot = readInput(bus, at);
  const input = toSectorFlightInput(pilot);

  // Exploration lock is a held action in the sector sim, not Arena's one-shot lock pulse.
  input.lock = bus.keys.has("KeyR");

  // The network-safe adapter deliberately strips tactical intents. This local-only
  // preview converts its live circle-roll intent to the sector sim's continuous roll axis.
  const maneuver = pilot.maneuver;
  if (maneuver?.version === 1 && maneuver.kind === "barrel-roll-control") {
    input.roll = Math.max(-1, Math.min(1, input.roll + maneuver.input));
  }
  return input;
}
