export type MainRendererParityEvidence = {
  everyProductionSurfaceMigrated: boolean;
  combatAndMissionBehaviorPassed: boolean;
  deterministicClientServerParityPassed: boolean;
  stationEntryAndTransitionParityPassed: boolean;
  hangarAndShipInspectionParityPassed: boolean;
  mobileDeviceLifecyclePassed: boolean;
  targetDevicePerformanceAccepted: boolean;
  repeatedResourceAndMemoryChecksPassed: boolean;
  compatibilityRollbackExercised: boolean;
};

const REQUIRED_EVIDENCE: readonly (keyof MainRendererParityEvidence)[] = [
  "everyProductionSurfaceMigrated",
  "combatAndMissionBehaviorPassed",
  "deterministicClientServerParityPassed",
  "stationEntryAndTransitionParityPassed",
  "hangarAndShipInspectionParityPassed",
  "mobileDeviceLifecyclePassed",
  "targetDevicePerformanceAccepted",
  "repeatedResourceAndMemoryChecksPassed",
  "compatibilityRollbackExercised",
];

/** Fail closed: one local renderer demo cannot authorize retiring main Arena. */
export function mayRetireCompatibilityRenderer(evidence: MainRendererParityEvidence): boolean {
  return REQUIRED_EVIDENCE.every((key) => evidence[key] === true);
}

/** Evidence not yet demonstrated in this repository; keep the old renderer active. */
export const CURRENT_MAIN_RENDERER_EVIDENCE: MainRendererParityEvidence = {
  everyProductionSurfaceMigrated: false,
  combatAndMissionBehaviorPassed: false,
  deterministicClientServerParityPassed: false,
  stationEntryAndTransitionParityPassed: false,
  hangarAndShipInspectionParityPassed: false,
  mobileDeviceLifecyclePassed: false,
  targetDevicePerformanceAccepted: false,
  repeatedResourceAndMemoryChecksPassed: false,
  compatibilityRollbackExercised: false,
};
