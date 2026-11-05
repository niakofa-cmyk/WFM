import { ORBITAL_RULES_VERSION } from "./flight";
import { ORBITAL_RUNTIME_ID } from "./runtime";

export type GameModeId =
  | "orbital-combat-lab"
  | "local-arena-practice"
  | "rust-disc-local"
  | "rust-disc-sector-coop"
  | "iron-eclipse"
  | "arcade-skirmish"
  | "campaign-sortie"
  | "campaign-contact"
  | "solo-flight"
  | "wing-competitive"
  | "wing-online"
  | "wing-private"
  | "wing-casual-ai"
  | "universe-navigation"
  | "fleet-warfare";

export type GameModeDefinition = {
  id: GameModeId;
  mission: string;
  environment: "orbital-arena" | "asteroid-sector" | "mars-and-space" | "arena" | "universe";
  players: { min: number; max: number; minimumHumans: number };
  ai: "none" | "mission" | "vacancy-fill";
  objectives: readonly string[];
  rules: readonly string[];
  rewardEligibility: "none" | "server-validated";
  authority: "local" | "server-replay" | "server-authoritative";
  simulation: {
    runtimeId: string;
    packages: readonly string[];
    migration: "canonical" | "partial" | "compatibility" | "navigation-only" | "planned";
  };
  /** Rendering is tracked separately so a shared simulation cannot hide a legacy scene. */
  presentation: {
    renderer: "arena-three-v1" | "rust-disc-three-v1" | "universe-ui-v1" | "not-implemented";
    lifecycleOwner: "Arena" | "RustDiscFlight" | "GalaxyScreen" | "none";
    migration: "current" | "compatibility" | "navigation-only" | "planned";
  };
};

/**
 * Source-backed inventory of current launches and planned destinations.
 * `migration` describes implementation evidence, not product intent.
 */
export const GAME_MODE_DEFINITIONS = [
  {
    id: "orbital-combat-lab",
    mission: "Offline combat and flight training",
    environment: "orbital-arena",
    players: { min: 1, max: 1, minimumHumans: 1 },
    ai: "mission",
    objectives: ["destroy-targets", "flight-practice"],
    rules: ["offline", "no-rewards", "fixed-step-orbital-rules"],
    rewardEligibility: "none",
    authority: "local",
    simulation: {
      runtimeId: ORBITAL_RUNTIME_ID,
      packages: ["@workspace/orbital-sim", "Arena"],
      migration: "canonical",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "local-arena-practice",
    mission: "Local Arena practice",
    environment: "orbital-arena",
    players: { min: 1, max: 1, minimumHumans: 1 },
    ai: "mission",
    objectives: ["practice-objective"],
    rules: ["offline", "no-rewards"],
    rewardEligibility: "none",
    authority: "local",
    simulation: {
      runtimeId: ORBITAL_RUNTIME_ID,
      packages: ["@workspace/orbital-sim", "Arena"],
      migration: "canonical",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "rust-disc-local",
    mission: "Rust Disc relay, drone, and extraction flight",
    environment: "asteroid-sector",
    players: { min: 1, max: 1, minimumHumans: 1 },
    ai: "mission",
    objectives: ["relay-discovery", "disable-drone", "reach-extraction"],
    rules: ["offline", "no-rewards", "bounded-training-sector"],
    rewardEligibility: "none",
    authority: "local",
    simulation: {
      runtimeId: ORBITAL_RUNTIME_ID,
      packages: ["@workspace/orbital-sim", "RustDiscFlight operation adapter"],
      migration: "canonical",
    },
    presentation: { renderer: "rust-disc-three-v1", lifecycleOwner: "RustDiscFlight", migration: "compatibility" },
  },
  {
    id: "rust-disc-sector-coop",
    mission: "Server-run Rust Disc sector operations",
    environment: "asteroid-sector",
    players: { min: 1, max: 8, minimumHumans: 1 },
    ai: "mission",
    objectives: ["server-sector-objectives", "validated-debrief"],
    rules: ["authenticated", "server-authoritative", "room-scoped"],
    rewardEligibility: "server-validated",
    authority: "server-authoritative",
    simulation: {
      runtimeId: ORBITAL_RUNTIME_ID,
      packages: ["@workspace/orbital-sim", "server-authoritative sector operation adapter"],
      migration: "canonical",
    },
    presentation: { renderer: "rust-disc-three-v1", lifecycleOwner: "RustDiscFlight", migration: "compatibility" },
  },
  {
    id: "iron-eclipse",
    mission: "Squadron operation against a capital ship",
    environment: "asteroid-sector",
    players: { min: 1, max: 8, minimumHumans: 1 },
    ai: "mission",
    objectives: ["squadron-orders", "capital-subsystems", "extraction"],
    rules: ["authenticated", "server-authoritative", "host-command-permissions"],
    rewardEligibility: "server-validated",
    authority: "server-authoritative",
    simulation: {
      runtimeId: ORBITAL_RUNTIME_ID,
      packages: ["@workspace/orbital-sim", "server-authoritative sector operation adapter", "iron-eclipse"],
      migration: "canonical",
    },
    presentation: { renderer: "rust-disc-three-v1", lifecycleOwner: "RustDiscFlight", migration: "compatibility" },
  },
  {
    id: "arcade-skirmish",
    mission: "Local arcade combat",
    environment: "arena",
    players: { min: 1, max: 1, minimumHumans: 1 },
    ai: "mission",
    objectives: ["mode-specific-arena-objective"],
    rules: ["offline", "no-server-rewards"],
    rewardEligibility: "none",
    authority: "local",
    simulation: {
      runtimeId: "surface-v1",
      packages: ["sim", "Arena"],
      migration: "compatibility",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "campaign-sortie",
    mission: "Legacy-pinned campaign sortie",
    environment: "arena",
    players: { min: 1, max: 1, minimumHumans: 1 },
    ai: "mission",
    objectives: ["server-issued-sortie-objective"],
    rules: ["issued-run-runtime-pinned", "server-replay-before-settlement"],
    rewardEligibility: "server-validated",
    authority: "server-replay",
    simulation: {
      runtimeId: "surface-v1",
      packages: ["sim", "progression"],
      migration: "compatibility",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "campaign-contact",
    mission: "Orbital Contact campaign operation",
    environment: "orbital-arena",
    players: { min: 1, max: 1, minimumHumans: 1 },
    ai: "mission",
    objectives: ["contact-objective", "server-replay-settlement"],
    rules: ["issued-run-runtime-pinned", "server-replay-before-settlement"],
    rewardEligibility: "server-validated",
    authority: "server-replay",
    simulation: {
      runtimeId: ORBITAL_RUNTIME_ID,
      packages: ["@workspace/orbital-sim", "Arena", "progression"],
      migration: "canonical",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "solo-flight",
    mission: "Local Solo Flight practice",
    environment: "arena",
    players: { min: 1, max: 1, minimumHumans: 1 },
    ai: "none",
    objectives: ["flight-practice"],
    rules: ["offline", "no-rewards"],
    rewardEligibility: "none",
    authority: "local",
    simulation: {
      runtimeId: "surface-v1",
      packages: ["sim", "Arena"],
      migration: "compatibility",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "wing-competitive",
    mission: "Ranked 5v5 Wing warfront",
    environment: "arena",
    players: { min: 10, max: 10, minimumHumans: 10 },
    ai: "none",
    objectives: ["team-objective", "server-owned-match-result"],
    rules: ["authenticated", "balanced-five-versus-five", "reward-gates-preserved"],
    rewardEligibility: "server-validated",
    authority: "server-authoritative",
    simulation: {
      runtimeId: "surface-v1",
      packages: ["Wing socket", "sim", "rewards"],
      migration: "compatibility",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "wing-online",
    mission: "Authenticated live Wing room",
    environment: "arena",
    players: { min: 1, max: 10, minimumHumans: 1 },
    ai: "vacancy-fill",
    objectives: ["room-mode-specific-objective"],
    rules: ["private-and-ai-fill-never-reward", "competitive-requires-ten-humans"],
    rewardEligibility: "server-validated",
    authority: "server-authoritative",
    simulation: {
      runtimeId: "surface-v1",
      packages: ["Wing socket", "sim", "rewards"],
      migration: "compatibility",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "wing-private",
    mission: "Private Wing room",
    environment: "arena",
    players: { min: 1, max: 10, minimumHumans: 1 },
    ai: "vacancy-fill",
    objectives: ["private-room-match"],
    rules: ["authenticated-room", "no-wing-credits"],
    rewardEligibility: "none",
    authority: "server-authoritative",
    simulation: {
      runtimeId: "surface-v1",
      packages: ["Wing socket", "sim"],
      migration: "compatibility",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "wing-casual-ai",
    mission: "Casual AI-fill Wing match",
    environment: "arena",
    players: { min: 1, max: 10, minimumHumans: 1 },
    ai: "vacancy-fill",
    objectives: ["casual-match"],
    rules: ["authenticated-queue", "no-rank", "no-rewards"],
    rewardEligibility: "none",
    authority: "server-authoritative",
    simulation: {
      runtimeId: "surface-v1",
      packages: ["Wing socket", "sim"],
      migration: "compatibility",
    },
    presentation: { renderer: "arena-three-v1", lifecycleOwner: "Arena", migration: "current" },
  },
  {
    id: "universe-navigation",
    mission: "Discover and approach universe operations",
    environment: "universe",
    players: { min: 1, max: 1, minimumHumans: 1 },
    ai: "none",
    objectives: ["discover-operation", "approach-destination"],
    rules: ["operation-directory-is-not-a-combat-session"],
    rewardEligibility: "none",
    authority: "server-authoritative",
    simulation: {
      runtimeId: "universe-navigation-v1",
      packages: ["GalaxyScreen", "world-operation-directory"],
      migration: "navigation-only",
    },
    presentation: { renderer: "universe-ui-v1", lifecycleOwner: "GalaxyScreen", migration: "navigation-only" },
  },
  {
    id: "fleet-warfare",
    mission: "Future universe-scale fleet operation",
    environment: "mars-and-space",
    players: { min: 10, max: 10, minimumHumans: 10 },
    ai: "mission",
    objectives: ["future-fleet-objectives"],
    rules: ["not-shipped", "must-use-canonical-runtime"],
    rewardEligibility: "server-validated",
    authority: "server-authoritative",
    simulation: {
      runtimeId: ORBITAL_RUNTIME_ID,
      packages: ["@workspace/orbital-sim"],
      migration: "planned",
    },
    presentation: { renderer: "not-implemented", lifecycleOwner: "none", migration: "planned" },
  },
] as const satisfies readonly GameModeDefinition[];

const modesById = new Map<GameModeId, GameModeDefinition>(
  GAME_MODE_DEFINITIONS.map((mode) => [mode.id, mode]),
);

export function getGameModeDefinition(id: GameModeId): GameModeDefinition {
  const definition = modesById.get(id);
  if (!definition) throw new Error(`Unknown game mode: ${id}`);
  return definition;
}

export type OrbitalRuntimeSession = {
  runtimeId: typeof ORBITAL_RUNTIME_ID;
  rulesVersion: typeof ORBITAL_RULES_VERSION;
  modeId: GameModeId;
  authority: GameModeDefinition["authority"];
  rewardEligibility: GameModeDefinition["rewardEligibility"];
};

/**
 * The canonical gameplay bootstrap. Compatibility modes cannot silently enter
 * Orbital as if their objectives and authority had already migrated.
 */
export function createOrbitalRuntime(mode: GameModeDefinition): OrbitalRuntimeSession {
  if (mode.simulation.runtimeId !== ORBITAL_RUNTIME_ID || mode.simulation.migration !== "canonical") {
    throw new Error(`Mode ${mode.id} is not ready for canonical Orbital launch.`);
  }
  if (mode.authority === "local" && mode.rewardEligibility !== "none") {
    throw new Error(`Local mode ${mode.id} cannot settle server-owned rewards.`);
  }
  return Object.freeze({
    runtimeId: ORBITAL_RUNTIME_ID,
    rulesVersion: ORBITAL_RULES_VERSION,
    modeId: mode.id,
    authority: mode.authority,
    rewardEligibility: mode.rewardEligibility,
  });
}
