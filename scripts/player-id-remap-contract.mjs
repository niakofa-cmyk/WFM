/**
 * Synthetic-only contract helper.
 *
 * This module does not access a database, Clerk, secrets, or real user data.
 * It is not an importer or a Production/staging migration command.
 */
export const PLAYER_ID_SCOPED_TABLES = Object.freeze([
  "player_progress",
  "strike_runs",
  "progression_events",
  "player_inventory",
  "market_transactions",
  "player_world_state",
  "world_discoveries",
  "player_quests",
  "economy_rejections",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Apply an explicitly supplied one-to-one identity map to synthetic rows.
 * Missing mappings and account merges fail closed; error messages contain no IDs.
 */
export function remapSyntheticPlayerRows(rowsByTable, oldToNewUserId) {
  if (!isRecord(rowsByTable) || !isRecord(oldToNewUserId)) {
    throw new Error("Synthetic player rows and identity map must be objects.");
  }

  const unexpectedTables = Object.keys(rowsByTable).filter(
    (table) => !PLAYER_ID_SCOPED_TABLES.includes(table),
  );
  if (unexpectedTables.length > 0) {
    throw new Error("Synthetic input contains an unknown player-ID table.");
  }

  const destinations = new Set();
  for (const [oldId, newId] of Object.entries(oldToNewUserId)) {
    if (!oldId.trim() || typeof newId !== "string" || !newId.trim()) {
      throw new Error("Synthetic identity map contains an empty ID.");
    }
    if (destinations.has(newId)) {
      throw new Error("Synthetic identity map must be one-to-one.");
    }
    destinations.add(newId);
  }

  const remapped = {};
  for (const table of PLAYER_ID_SCOPED_TABLES) {
    if (!Object.hasOwn(rowsByTable, table) || !Array.isArray(rowsByTable[table])) {
      throw new Error("Synthetic input is missing a player-ID table.");
    }

    remapped[table] = rowsByTable[table].map((row) => {
      if (!isRecord(row) || typeof row.userId !== "string" || !row.userId.trim()) {
        throw new Error("Synthetic row has no valid player ID.");
      }
      if (!Object.hasOwn(oldToNewUserId, row.userId)) {
        throw new Error(`Synthetic identity map is incomplete for ${table}.`);
      }
      return { ...row, userId: oldToNewUserId[row.userId] };
    });
  }

  return remapped;
}
