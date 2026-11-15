import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { GetReadinessResponse } from "@workspace/api-zod";
import { createHealthRouter } from "./health";
import {
  checkPlayerProfileSchema, verifyPlayerProfileColumns, checkProfileInitializationPrivileges,
} from "../lib/profile-readiness";

test.after(() => pool.end());

function hasSqlState(code: string) {
  return (error: unknown): boolean => {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.code === code || e.cause?.code === code;
  };
}

test("connectivity, schema and initialization privileges are reported separately while liveness stays healthy", async () => {
  let failure: string | null = null;
  let calls: string[] = [];
  const probe = (name: string) => async () => {
    calls.push(name);
    if (failure === name) throw new Error("Synthetic database detail must not reach a public response");
  };
  const app = express().use(createHealthRouter({
    databaseConnectivity: probe("databaseConnectivity"),
    profileSchema: probe("profileSchema"),
    profileInitializationPrivileges: probe("profileInitializationPrivileges"),
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const live = await fetch(`${base}/healthz`);
    assert.equal(live.status, 200);
    assert.deepEqual(calls, []);
    const ready = await fetch(`${base}/readyz`);
    assert.equal(ready.status, 200);
    const passed = { databaseConnectivity: true, profileSchema: true, profileInitializationPrivileges: true };
    assert.deepEqual(await ready.json(), { status: "ready", database: true, checks: passed });
    const cases = [
      { failure: "databaseConnectivity", expected: { databaseConnectivity: false, profileSchema: null, profileInitializationPrivileges: null } },
      { failure: "profileSchema", expected: { databaseConnectivity: true, profileSchema: false, profileInitializationPrivileges: null } },
      { failure: "profileInitializationPrivileges", expected: { databaseConnectivity: true, profileSchema: true, profileInitializationPrivileges: false } },
    ];
    for (const c of cases) {
      failure = c.failure;
      calls = [];
      const unavailable = await fetch(`${base}/readyz`);
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), {
        status: "unavailable", database: c.expected.databaseConnectivity, checks: c.expected,
      });
      const before = [...calls];
      assert.equal((await fetch(`${base}/healthz`)).status, 200);
      assert.deepEqual(calls, before, "liveness must never touch database probes");
      assert.equal(calls.at(-1), failure, "later probes must stay unattempted");
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});

test("a reachable database with no resolvable profile table fails readiness", async () => {
  await assert.rejects(db.transaction(async tx => {
    await tx.execute(sql`set local search_path = pg_catalog`);
    await tx.execute(sql`select 1`); // This old readiness probe incorrectly passes.
    await assert.rejects(checkPlayerProfileSchema(tx), /profile_relation_not_in_expected_schema/);
    await verifyPlayerProfileColumns(tx);
  }, { accessMode: "read only" }), hasSqlState("42P01"));
});

test("a partial profile table also fails readiness without modifying real player records", async () => {
  await assert.rejects(db.transaction(async tx => {
    await tx.execute(sql`create temporary table player_progress (user_id text primary key) on commit drop`);
    await assert.rejects(checkPlayerProfileSchema(tx), /profile_relation_not_in_expected_schema/);
    await verifyPlayerProfileColumns(tx);
  }), hasSqlState("42703"));
});

test("the complete profile schema passes in a read-only transaction without loading player rows", async () => {
  await db.transaction(async tx => {
    await checkPlayerProfileSchema(tx);
    await checkProfileInitializationPrivileges(tx);
  }, { accessMode: "read only" });
});

test("a complete shadow profile table cannot masquerade as the intended public relation", async () => {
  await db.transaction(async tx => {
    await tx.execute(sql`create temporary table player_progress (like public.player_progress) on commit drop`);
    await verifyPlayerProfileColumns(tx);
    await assert.rejects(checkPlayerProfileSchema(tx), /profile_relation_not_in_expected_schema/);
  });
});

test("missing or unknown initialization grants are not treated as a successful permission check", async () => {
  for (const can_initialize of [false, null, undefined]) {
    const reader = { execute: async () => ({ rows: [{ can_initialize }] }) } as unknown as Pick<typeof db, "execute">;
    await assert.rejects(checkProfileInitializationPrivileges(reader), /profile_initialization_privileges_unavailable/);
  }
});

test("older connectivity-only responses remain parseable but do not gain invented profile evidence", () => {
  const old = GetReadinessResponse.parse({ status: "ready", database: true });
  assert.equal(old.checks, undefined);
});
