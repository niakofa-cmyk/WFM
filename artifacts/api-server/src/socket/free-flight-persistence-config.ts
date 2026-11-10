type PersistenceEnvironment = Readonly<Record<string, string | undefined>>;

/** Validate rollout intent before opening Redis or creating checkpoint tables. */
export function freeFlightPersistenceConfig(env: PersistenceEnvironment, flightEnabled: boolean) {
  const shared = env.ORBITAL_FREE_FLIGHT_SHARED === "1";
  const required = env.ORBITAL_FREE_FLIGHT_REQUIRE_PERSISTENCE === "1";
  for (const key of ["ORBITAL_FREE_FLIGHT_SHARED", "ORBITAL_FREE_FLIGHT_REQUIRE_PERSISTENCE"]) {
    if (env[key] !== undefined && env[key] !== "0" && env[key] !== "1") {
      throw new Error(`${key} must be 0 or 1.`);
    }
  }
  if (required && !shared) {
    throw new Error("Persistent shared flight is required; process-local fallback is forbidden.");
  }
  if (shared && !flightEnabled) {
    throw new Error("Shared free flight requires the database-backed free-flight runtime.");
  }
  if (shared && env.NODE_ENV === "production" && env.WFM_FREE_FLIGHT_SHARED_ENV !== "staging") {
    throw new Error("Shared free flight is staging-only until separately approved.");
  }
  if (shared && !/^rediss?:\/\/[^\s]+$/.test(env.REDIS_URL ?? "")) {
    // Never interpolate credential-bearing configuration into an error.
    throw new Error("Shared free flight requires a configured Redis endpoint.");
  }
  return {
    shared,
    persistenceRequired: required,
    mode: shared ? "redis-fenced-shards" : "process-local",
  } as const;
}
