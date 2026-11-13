import type { ScoutMemory, ScoutPoint } from "./patrol-awareness";

export type FleetRole = "command" | "escort" | "interceptor" | "missile-platform" | "recon";
export type FleetMember = {
  id: string;
  alive: boolean;
  hullFraction: number;
  commandCapable: boolean;
  communications: boolean;
  mobility: boolean;
  observation?: ScoutMemory;
};
export type LivingFleet = {
  version: 1;
  fleetId: string;
  faction: "ussf" | "accord";
  territoryId: string;
  commanderId: string | null;
  commandVesselId: string | null;
  ships: Array<{ id: string; role: FleetRole }>;
  formations: "screen" | "pursuit" | "dispersed";
  patrolRoute: string[];
  currentMission: "patrol" | "intercept" | "search" | "assist" | "withdraw" | "destroyed";
  threatLevel: number;
  detectionState: "clear" | "contact" | "searching";
  combatState: "idle" | "engaged" | "retreating" | "destroyed";
  lastContact: ScoutMemory | null;
  reinforcements: { requested: boolean; committed: number };
  retreatConditions: { minimumStrength: number; criticalHull: number };
};

export function newLivingFleet(
  fleetId: string, faction: LivingFleet["faction"], territoryId: string,
  patrolRoute: readonly string[], ships: LivingFleet["ships"],
): LivingFleet {
  const command = ships.find(ship => ship.role === "command")?.id ?? ships[0]?.id ?? null;
  return {
    version: 1, fleetId, faction, territoryId, commanderId: command ? `${command}:commander` : null,
    commandVesselId: command, ships: structuredClone(ships), formations: "screen",
    patrolRoute: [...patrolRoute], currentMission: "patrol", threatLevel: 0,
    detectionState: "clear", combatState: "idle", lastContact: null,
    reinforcements: { requested: false, committed: 0 },
    retreatConditions: { minimumStrength: .4, criticalHull: .25 },
  };
}

/** Only observed contacts are shared. A sensor report never supplies a hidden live pose. */
export function advanceLivingFleet(
  fleet: LivingFleet, members: readonly FleetMember[], now: number,
  engaged: boolean, assisting: boolean, committedReinforcements: number,
): void {
  const live = members.filter(member => member.alive);
  const commander = live.find(member => member.id === fleet.commandVesselId && member.commandCapable) ??
    live.filter(member => member.commandCapable).sort((a, b) => a.id.localeCompare(b.id))[0];
  fleet.commandVesselId = commander?.id ?? null;
  fleet.commanderId = commander ? `${commander.id}:commander` : null;
  const reports = live.filter(member => member.communications)
    .flatMap(member => member.observation ? [member.observation] : [])
    .filter(report => report.seenAt <= now && now - report.seenAt < 45)
    .sort((a, b) => b.seenAt - a.seenAt || a.actorId.localeCompare(b.actorId));
  if (commander?.communications && reports[0]) fleet.lastContact = structuredClone(reports[0]);
  if (fleet.lastContact && now - fleet.lastContact.seenAt >= 45) fleet.lastContact = null;
  fleet.detectionState = !fleet.lastContact ? "clear"
    : now - fleet.lastContact.seenAt < 1 ? "contact" : "searching";
  const strength = live.length / Math.max(1, fleet.ships.length);
  const averageHull = live.reduce((total, member) => total + member.hullFraction, 0) / Math.max(1, live.length);
  const withdraw = live.length > 0 && (strength < fleet.retreatConditions.minimumStrength ||
    averageHull < fleet.retreatConditions.criticalHull || !live.some(member => member.mobility));
  fleet.threatLevel = !live.length ? 0 : Math.min(1,
    (engaged || assisting ? .5 : fleet.lastContact ? .2 : 0) + (1 - strength) * .5);
  fleet.combatState = !live.length ? "destroyed" : withdraw ? "retreating" : engaged || assisting ? "engaged" : "idle";
  fleet.currentMission = !live.length ? "destroyed" : withdraw ? "withdraw"
    : assisting ? "assist" : engaged ? "intercept"
    : fleet.detectionState === "contact" ? "intercept"
    : fleet.lastContact ? "search" : "patrol";
  fleet.formations = withdraw ? "dispersed" : fleet.currentMission === "patrol" ? "screen" : "pursuit";
  fleet.reinforcements = {
    requested: Boolean(commander?.communications && engaged && fleet.threatLevel >= .65),
    committed: committedReinforcements,
  };
}

/** Formation offsets are local to the command vessel; recon screens ahead. */
export function formationOffset(role: FleetRole, index: number): ScoutPoint {
  const side = index % 2 === 0 ? -1 : 1;
  return {
    x: side * (35 + Math.floor(index / 2) * 22),
    y: side * 12,
    z: role === "recon" ? -110 : role === "missile-platform" ? 100 : 45,
  };
}

export function validLivingFleet(value: unknown): value is LivingFleet {
  if (!value || typeof value !== "object") return false;
  const f = value as LivingFleet;
  const ids = Array.isArray(f.ships) ? f.ships.map(ship => ship?.id) : [];
  const contact = f.lastContact;
  return f.version === 1 && typeof f.fleetId === "string" && typeof f.territoryId === "string" &&
    ["ussf", "accord"].includes(f.faction) && ids.every(id => typeof id === "string") &&
    new Set(ids).size === ids.length &&
    f.ships.every(ship => ["command", "escort", "interceptor", "missile-platform", "recon"].includes(ship.role)) &&
    (f.commandVesselId === null || ids.includes(f.commandVesselId)) &&
    f.commanderId === (f.commandVesselId ? `${f.commandVesselId}:commander` : null) &&
    Array.isArray(f.patrolRoute) && f.patrolRoute.every(id => typeof id === "string") &&
    ["screen", "pursuit", "dispersed"].includes(f.formations) &&
    ["patrol", "intercept", "search", "assist", "withdraw", "destroyed"].includes(f.currentMission) &&
    ["clear", "contact", "searching"].includes(f.detectionState) &&
    ["idle", "engaged", "retreating", "destroyed"].includes(f.combatState) &&
    Number.isFinite(f.threatLevel) && f.threatLevel >= 0 && f.threatLevel <= 1 &&
    typeof f.reinforcements?.requested === "boolean" &&
    Number.isSafeInteger(f.reinforcements.committed) && f.reinforcements.committed >= 0 &&
    Number.isFinite(f.retreatConditions?.minimumStrength) && f.retreatConditions.minimumStrength >= 0 &&
    f.retreatConditions.minimumStrength <= 1 && Number.isFinite(f.retreatConditions.criticalHull) &&
    f.retreatConditions.criticalHull >= 0 && f.retreatConditions.criticalHull <= 1 &&
    (contact === null || Boolean(contact && typeof contact.actorId === "string" &&
      ["tracking", "searching"].includes(contact.mode) && Number.isFinite(contact.seenAt) &&
      contact.position && [contact.position.x, contact.position.y, contact.position.z].every(Number.isFinite)));
}
