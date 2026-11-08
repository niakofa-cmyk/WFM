import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getGameModeDefinition,
  LEGACY_SURFACE_RUNTIME_ID,
  ORBITAL_RUNTIME_ID,
  ORBITAL_SECTOR_SIMULATION_CONTRACT,
  ORBITAL_WEAPON_RUNTIME_ID,
  orbitalRuntimeForSectorProtocol,
  SECTOR_ORBITAL_PROTOCOL_VERSION,
} from "@workspace/orbital-sim";
import { resolveArenaModeId, resolveArenaRuntime } from "./arena-config";

const source = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

test("the public flight entry points use Orbital and legacy scenes are retired", () => {
  const app = source("../App.tsx");
  const combatLab = source("../combat-lab.tsx");
  const orbitalBoot = source("./OrbitalBoot.tsx");
  const arena = source("./Arena.tsx");
  const rustDisc = source("./RustDiscFlight.tsx");

  assert.match(app, /<Route path="\/flight">[\s\S]*?<OrbitalBoot standalone/);
  assert.match(app, /<Route path="\/play">[\s\S]*?<OrbitalBoot standalone/);
  assert.match(app, /CO-OP FLIGHT RETIRED/);
  assert.doesNotMatch(app, /<WarApp|<RustDiscFlight|<SectorExpedition|<SoloFlight/);
  assert.match(combatLab, /createRoot\(document\.getElementById\("root"\)!\)/);
  assert.match(combatLab, /<OrbitalBoot standalone/);
  assert.match(orbitalBoot, /if \(mode === "universe"\)[\s\S]*?<OrbitalFlightPreview/);
  assert.match(orbitalBoot, /nativeDestinationAvailable/);
  assert.match(arena, /LEGACY COMBAT RETIRED/);
  assert.match(rustDisc, /LEGACY SECTOR FLIGHT RETIRED/);
  for (const file of [app, combatLab, orbitalBoot, arena, rustDisc]) {
    assert.doesNotMatch(file, /from ["']three["']|import\(["']three["']\)/);
  }
});

test("Arena launch resolution keeps live Wing and pinned campaign authority on their declared runtimes", () => {
  assert.equal(resolveArenaModeId(undefined, false), "local-arena-practice");
  assert.equal(resolveArenaRuntime(undefined, false), ORBITAL_RUNTIME_ID);
  assert.equal(resolveArenaModeId(undefined, true), "wing-online");
  assert.equal(resolveArenaRuntime(undefined, true), LEGACY_SURFACE_RUNTIME_ID);

  const contactRun = { mission: "contact", tech: null, flightModel: ORBITAL_RUNTIME_ID };
  assert.equal(resolveArenaModeId(contactRun, false), "campaign-contact");
  assert.equal(resolveArenaRuntime(contactRun, false), ORBITAL_RUNTIME_ID);

  const legacyRun = { mission: "beacon", tech: null, flightModel: LEGACY_SURFACE_RUNTIME_ID };
  assert.equal(resolveArenaModeId(legacyRun, false), "campaign-sortie");
  assert.equal(resolveArenaRuntime(legacyRun, false), LEGACY_SURFACE_RUNTIME_ID);
});

test("co-op mode metadata is not mistaken for the negotiated wire runtime", () => {
  const coop = getGameModeDefinition("rust-disc-sector-coop");
  const ironEclipse = getGameModeDefinition("iron-eclipse");
  assert.equal(coop.simulation.runtimeId, ORBITAL_RUNTIME_ID);
  assert.equal(ironEclipse.simulation.runtimeId, ORBITAL_RUNTIME_ID);
  assert.equal(ORBITAL_SECTOR_SIMULATION_CONTRACT.runtimeId, ORBITAL_WEAPON_RUNTIME_ID);
  assert.equal(orbitalRuntimeForSectorProtocol(SECTOR_ORBITAL_PROTOCOL_VERSION), ORBITAL_WEAPON_RUNTIME_ID);
  assert.notEqual(coop.simulation.runtimeId, ORBITAL_SECTOR_SIMULATION_CONTRACT.runtimeId);
  assert.equal(coop.presentation.lifecycleOwner, "none");
  assert.equal(ironEclipse.presentation.lifecycleOwner, "none");
  assert.equal(coop.presentation.migration, "retired");
  assert.equal(ironEclipse.presentation.migration, "retired");
});
