/** Development is usable immediately; external environments require reviewed rollout. */
export function equipmentEnabled(env: Record<string, string | undefined> = process.env) {
  return env.WFM_MODULAR_EQUIPMENT_ENABLED === "1" ||
    env.NODE_ENV === "development" && env.WFM_MODULAR_EQUIPMENT_ENABLED !== "0";
}
