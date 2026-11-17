import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const projectId = "b66a7d5a-fe55-4c78-92c7-5547059cec7a";
const environmentId = "a2ca172d-5b22-44a8-aa97-8bcf3cad59c7";
const serviceId = "cc72500c-2e38-47c4-b8f5-c5d97fe17d8a";

export function validateEquipmentMigrationTarget(env) {
  if (env.RAILWAY_PROJECT_ID !== projectId ||
      env.RAILWAY_ENVIRONMENT_ID !== environmentId ||
      env.RAILWAY_SERVICE_ID !== serviceId) {
    throw new Error("Equipment migration is restricted to the authorized WFM staging API.");
  }
  if (!env.DATABASE_URL) throw new Error("Staging database configuration is unavailable.");
}

export async function migrateModularEquipment(env = process.env) {
  validateEquipmentMigrationTarget(env);
  const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
  const { Client } = require("pg");
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('wfm:equipment:migration:0009'))");
    // Verify the existing game schema without reading any player records.
    await client.query("SELECT user_id FROM player_progress LIMIT 0");
    await client.query(readFileSync(new URL("../lib/db/migrations/0009_modular_equipment.sql", import.meta.url), "utf8"));
    await client.query("SELECT user_id, revision FROM equipment_lockers LIMIT 0");
    await client.query("SELECT id, user_id, equipment_id, source_key, condition, ship_id, hardpoint_id, created_at FROM equipment_items LIMIT 0");
    const indexes = await client.query(`SELECT indexname FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname IN
      ('equipment_lockers_pkey','equipment_items_pkey','equipment_items_source_uq','equipment_items_mount_uq')
      AND indexdef LIKE '%UNIQUE%'`);
    if (indexes.rowCount !== 4) throw new Error("Equipment uniqueness safeguards are incomplete.");
    await client.query("COMMIT");
    console.log(JSON.stringify({ event: "wfm_equipment_migration", migration: "0009", environment: "staging", schemaReady: true, playerRecordsChanged: false }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateModularEquipment().catch(error => {
    const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,30}$/.test(error.code) ? error.code : "MIGRATION_REJECTED";
    // Never log connection strings, query parameters, credentials or stack traces.
    console.error(JSON.stringify({ event: "wfm_equipment_migration", environment: "staging", schemaReady: false, code }));
    process.exitCode = 1;
  });
}
