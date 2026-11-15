import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PLAYER_ID_SCOPED_TABLES,
  remapSyntheticPlayerRows,
} from "./player-id-remap-contract.mjs";

const schemaFiles = [
  new URL("../lib/db/src/schema/progression.ts", import.meta.url),
  new URL("../lib/db/src/schema/universe.ts", import.meta.url),
  new URL("../lib/db/src/schema/economy-rejections.ts", import.meta.url),
];

function playerIdTablesInSchema(source) {
  const declarations = [
    ...source.matchAll(/pgTable\(\s*["']([^"']+)["']/g),
  ];
  return declarations.flatMap((declaration, index) => {
    const start = declaration.index;
    const nextStart = declarations[index + 1]?.index ?? source.length;
    const definition = source.slice(start, nextStart);
    return /userId:\s*text\(["']user_id["']\)/.test(definition)
      ? [declaration[1]]
      : [];
  });
}

test("the synthetic contract enumerates every schema table keyed by player ID", async () => {
  const schemas = await Promise.all(
    schemaFiles.map((file) => readFile(file, "utf8")),
  );
  const discovered = schemas.flatMap(playerIdTablesInSchema).sort();

  assert.deepEqual(
    [...PLAYER_ID_SCOPED_TABLES].sort(),
    discovered,
  );
});

test("synthetic mapping updates all nine table rows and preserves other fields", () => {
  const rowsByTable = Object.fromEntries(
    PLAYER_ID_SCOPED_TABLES.map((table) => [
      table,
      [
        { rowKey: `${table}-a`, userId: "synthetic-old-a", revision: 3 },
        { rowKey: `${table}-b`, userId: "synthetic-old-b", revision: 7 },
      ],
    ]),
  );
  const original = structuredClone(rowsByTable);

  const remapped = remapSyntheticPlayerRows(rowsByTable, {
    "synthetic-old-a": "synthetic-new-a",
    "synthetic-old-b": "synthetic-new-b",
  });

  for (const table of PLAYER_ID_SCOPED_TABLES) {
    assert.deepEqual(remapped[table], [
      { rowKey: `${table}-a`, userId: "synthetic-new-a", revision: 3 },
      { rowKey: `${table}-b`, userId: "synthetic-new-b", revision: 7 },
    ]);
  }
  assert.deepEqual(rowsByTable, original);
});

test("synthetic mapping fails closed when any stored player ID is unmapped", () => {
  const rowsByTable = Object.fromEntries(
    PLAYER_ID_SCOPED_TABLES.map((table) => [
      table,
      [{ rowKey: table, userId: "synthetic-unmapped-id" }],
    ]),
  );
  const original = structuredClone(rowsByTable);

  assert.throws(
    () => remapSyntheticPlayerRows(rowsByTable, {}),
    { message: "Synthetic identity map is incomplete for player_progress." },
  );
  assert.deepEqual(rowsByTable, original);
});

test("synthetic mapping rejects many-to-one account merges", () => {
  const rowsByTable = Object.fromEntries(
    PLAYER_ID_SCOPED_TABLES.map((table) => [table, []]),
  );

  assert.throws(
    () =>
      remapSyntheticPlayerRows(rowsByTable, {
        "synthetic-old-a": "synthetic-new-account",
        "synthetic-old-b": "synthetic-new-account",
      }),
    { message: "Synthetic identity map must be one-to-one." },
  );
});

test("synthetic mapping rejects missing tables and unknown tables", () => {
  const completeEmptyTables = Object.fromEntries(
    PLAYER_ID_SCOPED_TABLES.map((table) => [table, []]),
  );

  const missingTable = { ...completeEmptyTables };
  delete missingTable.economy_rejections;
  assert.throws(
    () => remapSyntheticPlayerRows(missingTable, {}),
    { message: "Synthetic input is missing a player-ID table." },
  );

  assert.throws(
    () =>
      remapSyntheticPlayerRows(
        { ...completeEmptyTables, unrelated_table: [] },
        {},
      ),
    { message: "Synthetic input contains an unknown player-ID table." },
  );
});

test("synthetic mapping errors do not expose the unmapped player ID", () => {
  const rowsByTable = Object.fromEntries(
    PLAYER_ID_SCOPED_TABLES.map((table) => [
      table,
      [{ userId: "synthetic-private-id" }],
    ]),
  );
  let error;

  try {
    remapSyntheticPlayerRows(rowsByTable, {});
  } catch (caught) {
    error = caught;
  }

  assert.ok(error instanceof Error);
  assert.equal(error.message.includes("synthetic-private-id"), false);
});
