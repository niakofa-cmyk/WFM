import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const { Client } = createRequire(new URL("../lib/db/package.json", import.meta.url))("pg");
const migration = readFileSync(
  new URL("../lib/db/repairs/initialize-fresh-production.sql", import.meta.url), "utf8",
);
const body = migration.split("-- BEGIN GENERATED SCHEMA\n")[1]
  .split("-- END GENERATED SCHEMA")[0].trim();
const guard = migration.match(/DO \$guard\$[\s\S]*?\$guard\$;/)[0];

test("fresh initialization matches the current Drizzle schema exactly", () => {
  const result = spawnSync("pnpm", [
    "--filter", "@workspace/db", "exec", "drizzle-kit", "export",
    "--dialect", "postgresql", "--schema", "./src/schema/index.ts",
  ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, "Drizzle schema export must succeed");
  assert.equal(body, result.stdout.trim());
  assert.doesNotMatch(migration, /^\s*(DROP|TRUNCATE|DELETE|UPDATE|INSERT|GRANT)\b/im);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /SET LOCAL search_path = public, pg_catalog/);
  assert.match(migration, /COMMIT;\s*$/);
});

// Development only. No Railway SSH or production connection is used here.
// Every test transaction rolls back, including successful schema creation.
async function withDevelopmentTransaction(run) {
  assert.notEqual(process.env.RAILWAY_ENVIRONMENT_NAME, "production");
  assert.ok(process.env.DATABASE_URL, "Development DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
  });
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await run(client);
  } finally {
    try { await client.query("ROLLBACK"); } finally { await client.end(); }
  }
}

test("the production guard refuses an existing or incorrectly named database", async () => {
  await withDevelopmentTransaction(async (client) => {
    await assert.rejects(client.query(guard), (error) =>
      error.code === "P0001" &&
      /requires the approved railway database|Database is not empty/.test(error.message));
  });
});

test("fresh schema supports profile initialization and game constraints", async () => {
  await withDevelopmentTransaction(async (client) => {
    const schema = `wfm_bootstrap_${randomUUID().replaceAll("-", "")}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    // Never resolve existing public game tables during this isolated test.
    await client.query(`SET LOCAL search_path = "${schema}", pg_catalog`);
    await client.query(body.replaceAll('"public".', `"${schema}".`));

    const tables = await client.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema=$1",
      [schema],
    );
    assert.equal(tables.rows[0].count, 22);
    const columns = await client.query("SELECT * FROM player_progress LIMIT 0");
    assert.equal(columns.fields.length, 22);

    const profileId = "schema-test-pilot";
    const inserted = await client.query(
      "INSERT INTO player_progress(user_id) VALUES ($1) RETURNING credits,revision,inventory_migrated",
      [profileId],
    );
    assert.deepEqual(inserted.rows[0], {
      credits: 90, revision: 0, inventory_migrated: false,
    });
    const duplicate = await client.query(
      "INSERT INTO player_progress(user_id) VALUES ($1) ON CONFLICT DO NOTHING",
      [profileId],
    );
    assert.equal(duplicate.rowCount, 0);
    await client.query("INSERT INTO equipment_lockers(user_id) VALUES ($1)", [profileId]);
    await client.query("INSERT INTO player_world_state(user_id) VALUES ($1)", [profileId]);
    await client.query(
      "INSERT INTO player_inventory(user_id,good_id) VALUES ($1,$2)",
      [profileId, "iron"],
    );

    await client.query("SAVEPOINT invalid_inventory");
    await assert.rejects(
      client.query("UPDATE player_inventory SET quantity=-1 WHERE user_id=$1", [profileId]),
      (error) => error.code === "23514",
    );
    await client.query("ROLLBACK TO SAVEPOINT invalid_inventory");

    await client.query("SAVEPOINT invalid_mount");
    await assert.rejects(
      client.query(
        `INSERT INTO equipment_items(user_id,equipment_id,source_key,ship_id)
         VALUES ($1,$2,$3,$4)`,
        [profileId, "test-equipment", "test-source", "mandjet"],
      ),
      (error) => error.code === "23514",
    );
    await client.query("ROLLBACK TO SAVEPOINT invalid_mount");
  });
});
