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

test("current UI entry points retain their actual runtime and lifecycle owners", () => {
  const app = source("../App.tsx");
  const combatLab = source("../combat-lab.tsx");
  const orbitalBoot = source("./OrbitalBoot.tsx");
  const warApp = source("./WarApp.tsx");
  const arena = source("./Arena.tsx");
  const rustDisc = source("./RustDiscFlight.tsx");
  const expedition = source("./SectorExpedition.tsx");

  assert.match(app, /<Route path="\/flight">[\s\S]*?<RustDiscFlight/);
  assert.match(app, /<Route path="\/expedition">[\s\S]*?<SectorExpedition/);
  assert.match(combatLab, /createRoot\(document\.getElementById\("root"\)!\)/);
  assert.match(combatLab, /<OrbitalBoot standalone/);
  assert.match(orbitalBoot, /modeId="orbital-combat-lab" runtime=\{ORBITAL_RUNTIME_ID\}/);
  assert.match(orbitalBoot, /modeId="orbital-universe-local" runtime=\{ORBITAL_RUNTIME_ID\}/);
  assert.ok(warApp.includes("modeId={UNIVERSE_MODE_ID}"));
  assert.match(warApp, /resolveArenaModeId\(runConfig, Boolean\(onlineSession\), offlineMode\)/);
  assert.match(arena, /new THREE\.WebGLRenderer/);
  assert.match(arena, /createOrbitalRuntime\(modeDefinition, runtime\)/);
  assert.match(arena, /The canonical orbital runtime is not yet negotiated for this live room/);
  assert.match(rustDisc, /import\("\.\/three-flight-runtime"\)/);
  assert.match(rustDisc, /stepFlight\(state, tickInput, STEP, sector, RUST_DISC_LOCAL_RUNTIME\.runtimeId\)/);
  assert.match(expedition, /new WebSocket\(url\)/);
  assert.match(expedition, /parseSectorSnapshot/);
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
  assert.equal(coop.presentation.lifecycleOwner, "RustDiscFlight");
  assert.equal(ironEclipse.presentation.lifecycleOwner, "RustDiscFlight");
});
