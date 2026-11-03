import { absorbArmor } from "@workspace/orbital-sim";
import type { Craft } from "./sim";

// Shields are resolved by the existing damage path before armor receives spillover.
export function armorSpill(craft: Craft, incoming: number) {
  if (!craft.space) return incoming;
  return absorbArmor(craft.space, incoming);
}
