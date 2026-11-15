import { SHIPS, type ShipId } from "./ships";

/** Read a cosmetic/offline training preset; it never becomes profile authority. */
export function parseTrainingShipPreset(search: string): ShipId | null {
  const candidate = new URLSearchParams(search).get("ship");
  return candidate && Object.prototype.hasOwnProperty.call(SHIPS, candidate)
    ? candidate as ShipId
    : null;
}

/** A server-provided expedition seat always wins over a local URL preset. */
export function resolveInitialTrainingShip(search: string, serverShip?: ShipId | null): ShipId {
  if (serverShip && Object.prototype.hasOwnProperty.call(SHIPS, serverShip)) return serverShip;
  return parseTrainingShipPreset(search) ?? "glide";
}
