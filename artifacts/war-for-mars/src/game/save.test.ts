import assert from "node:assert/strict";
import test from "node:test";
import type { GameProfile } from "@workspace/api-client-react";
import { loadDevicePreferences, saveFromProfile } from "./save";

test("browser storage can restore device preferences but cannot restore credits or campaign progress", () => {
  const storage = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });

  try {
    storage.set(
      "wfm-save-v1",
      JSON.stringify({ credits: 9_999_999, cleared: 4, refit: 5, mission: "cage" }),
    );
    storage.set(
      "wfm-device-v1",
      JSON.stringify({ gyro: true, drilled: true, credits: 9_999_999, cleared: 4 }),
    );
    const profile: GameProfile = {
      credits: 50,
      faction: "accord",
      shipId: "mandjet",
      scheme: "arc",
      refit: 0,
      prices: { salt: 40, iron: 70, dust: 110, resin: 55 },
      hold: null,
      paid: 0,
      pace: "practice",
      mission: "contact",
      cleared: 0,
      tech: null,
      drilled: false,
      revision: 3,
    };

    const preferences = loadDevicePreferences();
    const save = saveFromProfile(profile, preferences);
    assert.deepEqual(preferences, { gyro: true, drilled: true });
    assert.equal(save.credits, 50);
    assert.equal(save.cleared, 0);
    assert.equal(save.refit, 0);
    assert.equal(save.mission, "contact");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
