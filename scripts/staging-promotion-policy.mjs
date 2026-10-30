// Keep this list explicit; unrelated or legacy metadata is not an implicit gate.
export const REQUIRED_STAGING_ENVIRONMENT_CHECKS = Object.freeze([
  "separateRepl",
  "separateStagingDatabase",
  "stagingOnlyAuthentication",
  "productionDataUntouched",
]);

export function requiredEnvironmentFailures(environment) {
  return REQUIRED_STAGING_ENVIRONMENT_CHECKS
    .filter((key) => environment?.[key] !== true)
    .map((key) => `environment.${key} must be confirmed true.`);
}
