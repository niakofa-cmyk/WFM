import type { TechId } from "./campaign";

type ServerRunConfig = { tech: TechId | null };

export function resolveArenaTech(
  serverConfig: ServerRunConfig | null | undefined,
  savedTech: TechId | null,
): TechId | null {
  return serverConfig ? serverConfig.tech : savedTech;
}
