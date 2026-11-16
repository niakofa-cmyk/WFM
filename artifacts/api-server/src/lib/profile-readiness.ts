import { getTableName, sql, getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { db, playerProgressTable } from "@workspace/db";

type ProfileReader = Pick<typeof db, "execute" | "select">;
const schema = getTableConfig(playerProgressTable).schema ?? "public";
const table = getTableName(playerProgressTable);
const expectedRelation = `${schema}.${table}`;
const resolvedRelation = getTableConfig(playerProgressTable).schema ? expectedRelation : table;
const columns = Object.values(getTableColumns(playerProgressTable)).map(column => column.name);

export async function checkDatabaseConnectivity(): Promise<void> {
  await db.execute(sql`select 1`);
}

export async function verifyPlayerProfileColumns(reader: Pick<typeof db, "select">): Promise<void> {
  // Derive the actual column list from Drizzle. Never fetch a player row.
  await reader.select().from(playerProgressTable).limit(0);
}

export async function checkPlayerProfileSchema(reader?: ProfileReader): Promise<void> {
  if (!reader) {
    await db.transaction(tx => checkPlayerProfileSchema(tx), { accessMode: "read only" });
    return;
  }
  // A same-named table in a different schema must not pass the readiness probe.
  const result = await reader.execute(sql`select coalesce(
    to_regclass(${resolvedRelation}) = to_regclass(${expectedRelation}), false
  ) as intended_relation`);
  if (result.rows[0]?.intended_relation !== true) {
    throw new Error("profile_relation_not_in_expected_schema");
  }
  await verifyPlayerProfileColumns(reader);
}

export async function checkProfileInitializationPrivileges(
  reader: Pick<typeof db, "execute"> = db,
): Promise<void> {
  // The ORM insert names all profile columns (DEFAULT for omitted values).
  // SELECT privileges are already checked by LIMIT 0; initialization also
  // requires USAGE on the schema and INSERT on every named column.
  const result = await reader.execute(sql`select coalesce(
    has_schema_privilege(${schema}, 'USAGE') and
    bool_and(has_column_privilege(to_regclass(${expectedRelation}), required.name, 'INSERT')),
    false
  ) as can_initialize
  from unnest(array[${sql.join(columns.map(name => sql`${name}`), sql`, `)}]::text[])
    as required(name)`);
  if (result.rows[0]?.can_initialize !== true) {
    throw new Error("profile_initialization_privileges_unavailable");
  }
}
