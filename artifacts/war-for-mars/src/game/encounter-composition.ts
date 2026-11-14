import {
  isFreeFlightTacticalSnapshotV1,
  type FreeFlightTacticalFleetV1,
  type FreeFlightTacticalSnapshotV1,
} from "@workspace/orbital-sim";
import type { UniversePatrolEncounterNotice } from "./UniversePatrolEncounterPrompt";
import { SHIPS, type ShipId } from "./ships";

export type EncounterCompositionView = {
  fleet: FreeFlightTacticalFleetV1;
  beat: string;
  steps: Array<{ label: string; state: "complete" | "current" | "pending" }>;
  elements: string[];
  incomingWeapons: number;
  additionalFleetCount: number;
  commandStatus: "normal" | "damaged" | "lost" | "unreported";
};

export function readFreeFlightTacticalSnapshot(value: unknown): FreeFlightTacticalSnapshotV1 | null {
  return isFreeFlightTacticalSnapshotV1(value) ? value : null;
}

export function sameTacticalSnapshotContent(
  left: FreeFlightTacticalSnapshotV1 | null,
  right: FreeFlightTacticalSnapshotV1,
): boolean {
  return Boolean(left && left.sessionInstanceId === right.sessionInstanceId &&
    left.incomingHostileMissileCount === right.incomingHostileMissileCount &&
    JSON.stringify(left.fleets) === JSON.stringify(right.fleets));
}

/** Converts only fresh, server-reported fleet state into a concise battle arc. */
export function encounterCompositionView(
  snapshot: FreeFlightTacticalSnapshotV1 | null,
  contact: UniversePatrolEncounterNotice | null,
  previousFleetId?: string | null,
): EncounterCompositionView | null {
  if (!snapshot) return null;
  if (contact && contact.source !== "server-snapshot") return null;
  const fleet = (contact?.actorId ? snapshot.fleets.find((candidate) =>
    candidate.units.some((unit) => unit.actorId === contact.actorId),
  ) : undefined) ?? (previousFleetId
    ? snapshot.fleets.find((candidate) => candidate.fleetId === previousFleetId)
    : undefined);
  if (!fleet) return null;

  const completed = fleet.encounterPhase === "complete" || fleet.combatState === "destroyed" ||
    fleet.combatState === "retreating";
  if (!contact && !completed) return null;
  const active = fleet.encounterPhase === "active" || fleet.encounterPhase === "settling" ||
    fleet.encounterPhase === "settlement-unavailable" || fleet.combatState === "engaged";
  const distanceMeters = contact?.distanceMeters ?? Math.min(
    ...fleet.units.map((unit) => unit.distanceMeters),
  );
  const closing = distanceMeters <= 180;
  const beat = fleet.combatState === "destroyed"
    ? "FLEET DESTROYED"
    : fleet.combatState === "retreating"
      ? "FLEET WITHDRAWING"
      : fleet.encounterPhase === "complete"
        ? "BATTLE RESULTS SETTLED"
        : active
          ? "LIVE FLEET ENGAGEMENT"
          : closing
            ? "INTERCEPT RANGE"
            : "SENSOR CONTACT";
  const aliveUnits = fleet.units.filter((unit) => unit.alive);
  const roles = new Set(aliveUnits.map((unit) => unit.role));
  const elements = [
    roles.has("recon") ? "RECON ELEMENT" : null,
    roles.has("escort") || roles.has("interceptor") ? `${fleet.formation.toUpperCase()} SCREEN` : null,
    aliveUnits.some((unit) => /heavy|siege|gunship/i.test(SHIPS[unit.shipId as ShipId]?.role ?? ""))
      ? "HEAVY HULL" : null,
    snapshot.incomingHostileMissileCount > 0 ? `MISSILE TRACK ×${snapshot.incomingHostileMissileCount}` : null,
    active && fleet.alliedPilotCount > 0 ? `HUMAN WING ×${fleet.alliedPilotCount}` : null,
    active && fleet.alliedAiCount > 0 ? `AI SUPPORT ×${fleet.alliedAiCount}` : null,
    snapshot.fleets.filter((candidate => candidate.faction === fleet.faction)).length > 1
      ? "MULTIPLE HOSTILE FLEETS" : null,
  ].filter((item): item is string => Boolean(item));
  const command = fleet.units.find((unit) => unit.actorId === fleet.commandActorId);
  const commandStatus = fleet.commandActorId === null
    ? "unreported"
    : !command?.alive
      ? "lost"
      : command.hull / command.hullMax <= .35 || command.shield <= 0
        ? "damaged"
        : "normal";
  const steps: EncounterCompositionView["steps"] = [
    { label: "CONTACT", state: "complete" },
    { label: "CLOSE", state: closing ? "complete" : active || completed ? "complete" : "current" },
    { label: "BATTLE", state: active || completed ? "complete" : closing ? "current" : "pending" },
    { label: "OUTCOME", state: completed ? "complete" : active ? "current" : "pending" },
  ];
  return {
    fleet,
    beat,
    steps,
    elements,
    incomingWeapons: snapshot.incomingHostileMissileCount,
    additionalFleetCount: Math.max(0, snapshot.fleets.filter((candidate) =>
      candidate.faction === fleet.faction).length - 1),
    commandStatus,
  };
}
