import { worldEventRules } from "./world-event-rules";
export const clampStanding = (value: number) => Math.max(-100, Math.min(100, value));
export function requirements(locationId: string) {
  if (locationId === "outer-fringe") return { sector: "Outer Fringe", requiredTechTier: 2, requiredRep: 10 };
  if (locationId === "deep-nebula") return { sector: "Deep Nebula", requiredTechTier: 3, requiredRep: 50 };
  return { sector: "Alpha Core", requiredTechTier: 1, requiredRep: 0 };
}
export function gateReason(location: { id: string; unlockAfter: number }, cleared: number, tier: number, standing: number) {
  const required = requirements(location.id);
  if (cleared < location.unlockAfter) return `Clear ${location.unlockAfter} campaign sorties.`;
  if (tier < required.requiredTechTier) return `Hyperdrive tier ${required.requiredTechTier} required. Upgrade at Phobos.`;
  if (required.requiredRep > 0 && standing < required.requiredRep) return `${required.requiredRep} standing with your faction required.`;
  return null;
}
export function returnLane(origin: string, destination: string) {
  return (origin === "deep-nebula" && destination === "outer-fringe") || (origin === "outer-fringe" && destination === "phobos-yard");
}
export function routeFare(destinationId: string, fare: number, eventId: string) {
  return fare + (requirements(destinationId).requiredTechTier > 1 ? worldEventRules(eventId).remoteFare : 0);
}
