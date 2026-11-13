import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { validateEquipmentMigrationTarget } from "./migrate-modular-equipment.mjs";

const staging = {
  RAILWAY_PROJECT_ID: "b66a7d5a-fe55-4c78-92c7-5547059cec7a",
  RAILWAY_ENVIRONMENT_ID: "a2ca172d-5b22-44a8-aa97-8bcf3cad59c7",
  RAILWAY_SERVICE_ID: "cc72500c-2e38-47c4-b8f5-c5d97fe17d8a",
  DATABASE_URL: "synthetic-test-only",
};
test("equipment migration rejects every unapproved project, environment, service and absent database configuration", () => {
  assert.doesNotThrow(() => validateEquipmentMigrationTarget(staging));
  for (const key of Object.keys(staging)) {
    assert.throws(() => validateEquipmentMigrationTarget({ ...staging, [key]: undefined }));
    if (key !== "DATABASE_URL") assert.throws(() => validateEquipmentMigrationTarget({ ...staging, [key]: "production" }));
  }
});
test("staging equipment DDL is additive and contains no player-data mutations or broad schema sync", () => {
  const sql = readFileSync(new URL("../lib/db/migrations/0009_modular_equipment.sql", import.meta.url), "utf8");
  assert.equal((sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length, 2);
  assert.equal((sql.match(/CREATE UNIQUE INDEX IF NOT EXISTS/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|UPDATE|DELETE|INSERT|ALTER)\b/i);
  const script = readFileSync(new URL("./migrate-modular-equipment.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(script, /drizzle-kit|push-force/);
  assert.match(script, /pg_advisory_xact_lock/);
  assert.match(script, /ROLLBACK/);
});
