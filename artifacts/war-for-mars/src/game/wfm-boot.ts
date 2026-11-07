/** Presentation rollout only. Never selects a replay or network runtime. */
export function resolveWfmBoot(search: string, enabled = true): "orbital" | "compatibility" {
  return !enabled || new URLSearchParams(search).get("boot") === "compatibility"
    ? "compatibility"
    : "orbital";
}

export function enterOrbitalOnAccountBoot(
  primary: boolean,
  accountChart: boolean,
  search: string,
): boolean {
  // Invite links must reach the existing authoritative lobby, not local flight.
  return primary && !accountChart && !new URLSearchParams(search).get("room")?.trim();
}
