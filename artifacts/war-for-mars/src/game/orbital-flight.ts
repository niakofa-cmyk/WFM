import { integrateSpatialFlight } from "@workspace/orbital-sim";
import { SHIPS } from "./ships";
import type { Craft, Match, StepInput } from "./sim";

export { newFlight, rotate } from "@workspace/orbital-sim";
export type { Quaternion, OrbitalFlight, FlightInput } from "@workspace/orbital-sim";

export function integrateFlight(craft: Craft, input: StepInput, dt: number, speedMul: number, match: Match) {
  integrateSpatialFlight(craft, input, dt, speedMul, match.rocks, SHIPS[craft.ship]);
}
