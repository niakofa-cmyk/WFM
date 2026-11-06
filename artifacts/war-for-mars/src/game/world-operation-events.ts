import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWorldOperationsQueryKey,
  getSubscribeWorldOperationEventsUrl,
} from "@workspace/api-client-react";
import type { OperationDirectoryResponse } from "@workspace/api-client-react";

export type OperationEventLinkState = "connecting" | "live" | "reconnecting" | "unavailable";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringFields(value: unknown, fields: readonly string[]): boolean {
  return isRecord(value) && fields.every((field) => typeof value[field] === "string");
}

/** Accept only the public directory shape consumed by the universe UI. */
export function parseOperationDirectorySnapshot(data: string): OperationDirectoryResponse | null {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.generatedAt !== "string") return null;
  if (!Array.isArray(value.locations) || !Array.isArray(value.operations) ||
      !Array.isArray(value.instances) || !Array.isArray(value.events)) return null;
  if (value.presence !== undefined && !Array.isArray(value.presence)) return null;
  if (value.presenceStatus !== undefined &&
      value.presenceStatus !== "available" && value.presenceStatus !== "unavailable") return null;

  const validLocations = value.locations.every((location) =>
    hasStringFields(location, ["id", "name", "worldLocationId", "kind", "sectorId"]) &&
    isRecord(location) &&
    isRecord(location.position) &&
    typeof location.position.x === "number" &&
    typeof location.position.y === "number" &&
    typeof location.position.z === "number",
  );
  const validOperations = value.operations.every((operation) =>
    hasStringFields(operation, [
      "id", "title", "description", "locationId", "experience", "runtimeId", "rulesetId",
      "visibility", "lifecycle", "access", "rewardPolicy",
    ]) &&
    isRecord(operation) &&
    typeof operation.teamSize === "number" &&
    typeof operation.capacity === "number",
  );
  const validInstances = value.instances.every((instance) =>
    hasStringFields(instance, [
      "id", "operationId", "locationId", "phase", "runtimeId", "rulesetId", "visibility",
      "registeredAt", "expiresAt",
    ]) &&
    isRecord(instance) &&
    typeof instance.currentPlayers === "number" &&
    typeof instance.capacity === "number",
  );
  const validEvents = value.events.every((event) =>
    hasStringFields(event, ["id", "kind", "locationId", "status", "title"]) &&
    isRecord(event) &&
    (event.operationInstanceId === undefined || event.operationInstanceId === null ||
      typeof event.operationInstanceId === "string"),
  );
  const validPresence = (value.presence ?? []).every((entry) =>
    hasStringFields(entry, ["locationId"]) &&
    isRecord(entry) &&
    typeof entry.activePilots === "number" &&
    Number.isInteger(entry.activePilots) &&
    (entry.activePilots as number) >= 0,
  );
  return validLocations && validOperations && validInstances && validEvents && validPresence
    ? value as unknown as OperationDirectoryResponse
    : null;
}

export function operationEventsUrl(apiBaseUrl: string | null | undefined, origin: string): string {
  const base = apiBaseUrl?.trim() || origin;
  return new URL(getSubscribeWorldOperationEventsUrl(), base).toString();
}

/**
 * Subscribe to the server's read-only public operation snapshots. Registration,
 * room membership and match changes remain on their existing authenticated APIs.
 */
export function useWorldOperationEvents(): OperationEventLinkState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<OperationEventLinkState>("connecting");

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      setState("unavailable");
      return;
    }

    let source: EventSource;
    try {
      source = new EventSource(
        operationEventsUrl(import.meta.env.VITE_API_BASE_URL, window.location.origin),
      );
    } catch {
      setState("unavailable");
      return;
    }

    source.onopen = () => setState("live");
    source.onerror = () => setState("reconnecting");
    source.addEventListener("operations.snapshot", (event) => {
      const snapshot = parseOperationDirectorySnapshot((event as MessageEvent<string>).data);
      if (!snapshot) return;
      queryClient.setQueryData(getGetWorldOperationsQueryKey(), snapshot);
      setState("live");
    });
    source.addEventListener("operations.unavailable", () => setState("unavailable"));

    return () => source.close();
  }, [queryClient]);

  return state;
}
