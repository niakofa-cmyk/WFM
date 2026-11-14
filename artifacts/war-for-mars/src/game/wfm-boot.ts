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
  // Selecting the Orbital runtime is not permission to deploy a pilot.
  // All account boots land in command; only the hangar gateway mounts flight.
  // Keep these arguments for compatibility with existing invite/chart callers.
  void primary;
  void accountChart;
  void search;
  return false;
}

export function accountBootMenu(primary: boolean, accountChart: boolean, search: string): "MAIN_MENU" | "TITLE" {
  return primary && !accountChart && !new URLSearchParams(search).get("room")?.trim()
    ? "MAIN_MENU"
    : "TITLE";
}
