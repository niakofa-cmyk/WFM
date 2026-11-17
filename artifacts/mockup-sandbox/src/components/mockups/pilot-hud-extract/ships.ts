export type Faction = "ussf" | "accord";
export type ShipId = "sekhmet" | "duskbreaker";

export const SHIPS: Record<ShipId, { name: string }> = {
  sekhmet: { name: "Sekhmet" },
  duskbreaker: { name: "Duskbreaker" },
};
