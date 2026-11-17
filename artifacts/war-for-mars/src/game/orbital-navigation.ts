import type { OperationDirectoryResponse, WorldState } from "@workspace/api-client-react";

export type NavigationOperation = {
  id: string;
  title: string;
  runtimeId: string;
  experience: string;
  access: string;
  publicSessions: number;
  activePlayers: number;
};

export type NavigationDestination = {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  status: "current" | "available" | "locked";
  label: string;
  description: string;
  services: string[];
  cost: number | null;
  canTravel: boolean;
  canOpen: boolean;
  reason: string;
  operations: NavigationOperation[];
};

/** Projects server state only. Selecting a chart marker never moves the pilot. */
export function connectedDestinations(
  world: Pick<WorldState, "currentLocation" | "locations" | "routes">,
  directory: OperationDirectoryResponse | undefined,
  credits: number,
  blocked: boolean,
  now = Date.now(),
): NavigationDestination[] {
  return world.locations.map((location) => {
    const here = location.id === world.currentLocation;
    const route = world.routes.find((entry) => entry.destinationId === location.id);
    const canTravel = !blocked && !here && location.unlocked &&
      Boolean(route?.available) && credits >= (route?.costCredits ?? Infinity);
    const siteIds = new Set(directory?.locations
      .filter((site) => site.worldLocationId === location.id).map((site) => site.id));
    const operations = location.unlocked ? (directory?.operations ?? [])
      .filter((operation) => siteIds.has(operation.locationId) && operation.visibility === "public")
      .map((operation) => {
        const sessions = (directory?.instances ?? []).filter((instance) =>
          instance.operationId === operation.id && instance.locationId === operation.locationId &&
          instance.visibility === "public" && ["assembling", "ready", "active"].includes(instance.phase) &&
          Date.parse(instance.expiresAt) > now,
        );
        return {
          id: operation.id, title: operation.title, runtimeId: operation.runtimeId,
          experience: operation.experience, access: operation.access,
          publicSessions: sessions.length,
          activePlayers: sessions.reduce((total, instance) => total + instance.currentPlayers, 0),
        };
      }) : [];
    return {
      id: location.id, name: location.name, kind: location.kind,
      x: location.x, y: location.y,
      status: here ? "current" : location.unlocked ? "available" : "locked",
      label: here ? "YOUR CONFIRMED LOCATION" : location.unlocked ? "SERVER DESTINATION" : "LOCKED",
      description: location.description, services: location.services,
      cost: route?.costCredits ?? null, canTravel,
      canOpen: !blocked && here && location.unlocked,
      reason: blocked ? "Live server confirmation required. Navigation actions are disabled."
        : here ? "Already here. Open the destination controls below; entry is checked by the server."
        : !location.unlocked ? location.lockReason || "Destination locked."
        : !route?.available ? "No available route from your current location."
        : credits < route.costCredits ? "Insufficient credits for this route."
        : "Travel changes your saved location and charges the displayed route cost after server approval.",
      operations,
    };
  });
}

/** This is a UI handoff, never a room, queue, registration or reward authorization. */
export function operationControlTarget(experience: string, operationId: string, cinderSurface: string): string {
  if (experience === "competitive") {
    return cinderSurface === "approach-entry"
      ? "panel-cinder-ring-approach-entry" : "screen-asteroid-arena-hub";
  }
  return `card-operation-${operationId}`;
}
