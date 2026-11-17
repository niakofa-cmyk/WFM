import type { OrbitalRulesVersion } from "./flight";

export type OrbitalMatchOutcome = "win" | "loss" | null;

/**
 * Resolve terminal combat state once for client and server. The tolerance
 * accounts only for floating-point accumulation at an exact fixed-step limit;
 * it does not advance simulation or permit an extra replay frame.
 */
export function resolveOrbitalMatchOutcome(input: {
  playerAlive: boolean;
  livingEnemies: number;
  elapsedSeconds: number;
  timeLimitSeconds: number;
  rulesVersion?: OrbitalRulesVersion;
}): OrbitalMatchOutcome {
  if (!input.playerAlive) return "loss";
  if (input.livingEnemies === 0) return "win";
  const boundaryTolerance = input.rulesVersion === undefined
    ? 0
    : Math.max(1, Math.abs(input.timeLimitSeconds)) * Number.EPSILON * 512;
  return input.elapsedSeconds + boundaryTolerance >= input.timeLimitSeconds ? "loss" : null;
}
