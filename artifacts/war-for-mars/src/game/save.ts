import { type SortieId, type TechId } from "./campaign";
import { basePrices, type GoodId } from "./market";
import { type Faction, type Scheme, type ShipId } from "./ships";
import type { Pace } from "./sim";
import type { GameProfile } from "@workspace/api-client-react";

const DEVICE_KEY = "wfm-device-v1";

export type DevicePreferences = { gyro: boolean; drilled: boolean };

export type Save = {
  v: 1;
  credits: number;
  ship: ShipId;
  faction: Faction;
  scheme: Scheme;
  refit: number;
  prices: Record<GoodId, number>;
  hold: GoodId | null;
  paid: number;
  pace: Pace;
  gyro: boolean;
  drilled: boolean;
  mission: SortieId;
  cleared: number;
  tech: TechId | null;
};

export function defaultSave(): Save {
  return {
    v: 1,
    credits: 90,
    ship: "mandjet",
    faction: "accord",
    scheme: "arc",
    refit: 0,
    prices: basePrices(),
    hold: null,
    paid: 0,
    pace: "practice",
    gyro: false,
    drilled: false,
    mission: "contact",
    cleared: 0,
    tech: null,
  };
}

export function loadDevicePreferences(): DevicePreferences {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return { gyro: false, drilled: false };
    const value = JSON.parse(raw) as Partial<DevicePreferences>;
    return { gyro: value.gyro === true, drilled: value.drilled === true };
  } catch {
    return { gyro: false, drilled: false };
  }
}

export function writeDevicePreferences(preferences: DevicePreferences) {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(preferences));
  } catch {
    // Device preferences are optional; progression remains on the server.
  }
}

export function saveFromProfile(profile: GameProfile, device = loadDevicePreferences()): Save {
  return {
    v: 1,
    credits: profile.credits,
    ship: profile.shipId,
    faction: profile.faction,
    scheme: profile.scheme,
    refit: profile.refit,
    prices: profile.prices,
    hold: profile.hold,
    paid: profile.paid,
    pace: profile.pace,
    gyro: device.gyro,
    drilled: profile.drilled || device.drilled,
    mission: profile.mission,
    cleared: profile.cleared,
    tech: profile.tech,
  };
}

export function refitCost(level: number): number {
  return 120 * (level + 1);
}
