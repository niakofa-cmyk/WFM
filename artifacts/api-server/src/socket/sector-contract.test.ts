import assert from "node:assert/strict";
import test from "node:test";
import {
  ORBITAL_RUNTIME_ID,
  ORBITAL_SECTOR_SIMULATION_CONTRACT,
  ORBITAL_WEAPON_RUNTIME_ID,
  orbitalRuntimeForSectorProtocol,
  SECTOR_COMPAT_PROTOCOL_VERSION,
  SECTOR_ORBITAL_PROTOCOL_VERSION,
} from "@workspace/orbital-sim";

test("co-op protocol v2 dispatches exactly the orbital rules advertised in its handshake", () => {
  assert.equal(ORBITAL_SECTOR_SIMULATION_CONTRACT.runtimeId, ORBITAL_WEAPON_RUNTIME_ID);
  assert.equal(
    orbitalRuntimeForSectorProtocol(SECTOR_ORBITAL_PROTOCOL_VERSION),
    ORBITAL_SECTOR_SIMULATION_CONTRACT.runtimeId,
  );
});

test("co-op compatibility protocol keeps its established server runtime", () => {
  assert.equal(
    orbitalRuntimeForSectorProtocol(SECTOR_COMPAT_PROTOCOL_VERSION),
    ORBITAL_RUNTIME_ID,
  );
});
