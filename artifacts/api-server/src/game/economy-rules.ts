export type EconomyUpgrades = { shieldMk2: boolean; cargoExpansion: boolean; driveEfficiency: boolean };
export const cargoCapacity = (profile: Pick<EconomyUpgrades, "cargoExpansion">) => 100 + (profile.cargoExpansion ? 50 : 0);
export const cargoUsed = (inventory: { quantity: number }[]) => inventory.reduce((sum, item) => sum + item.quantity, 0);
export function cargoFits(before: number, after: number, capacity: number) {
  // Legacy over-capacity cargo is never deleted: allow sales and net-consuming services.
  return Number.isSafeInteger(after) && after >= 0 && (after <= capacity || after <= before);
}
export const installedUpgrades = (profile: EconomyUpgrades) => [
  ...(profile.shieldMk2 ? ["shield-mk2" as const] : []),
  ...(profile.cargoExpansion ? ["cargo-expansion" as const] : []),
  ...(profile.driveEfficiency ? ["drive-efficiency" as const] : []),
];
export const adjustedFare = (fare: number, efficient: boolean) => efficient ? Math.ceil(fare * .75) : fare;
