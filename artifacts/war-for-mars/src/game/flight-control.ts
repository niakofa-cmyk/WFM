/**
 * Compatibility import path for existing UI callers. The contract and all
 * mode adapters now belong to the shared engine, not a browser-only module.
 */
export {
  neutralFlightControls,
  normalizeFlightControls,
  toOrbitalPilotStepInput,
  toOrbitalStepInput,
  toSectorFlightInput,
  type FlightControlFrame,
} from "@workspace/orbital-sim";
