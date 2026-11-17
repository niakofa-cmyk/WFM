import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.DATABASE_URL;
const isDisposableLocalPopulationDb = (() => {
  if (!databaseUrl) return false;
  try {
    const url = new URL(databaseUrl);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname) &&
      url.pathname === "/wfm_population_test";
  } catch {
    return false;
  }
})();

test("Postgres serializes population epochs and never restores a removed casualty", {
  skip: !isDisposableLocalPopulationDb,
}, async () => {
  const [{ applyUniversePopulationEpoch }, { applyUniversePatrolOutcomeInTransaction }, {
    db, pool, universePatrolsTable, universePopulationEpochsTable, universePopulationStateTable,
  }, { eq, sql }] =
    await Promise.all([
      import("./universe-population-balancer"),
      import("./universe-patrols"),
      import("@workspace/db"),
      import("drizzle-orm"),
    ]);
  try {
    await db.execute(sql`
      TRUNCATE TABLE universe_population_epochs,
        universe_population_state,
        universe_patrols
    `);
    const now = new Date();
    const accordMajority = {
      capturedAt: now.getTime(),
      activePilotsByFaction: { ussf: 0, accord: 10 },
      total: 10,
    };
    const concurrent = await Promise.all([
      applyUniversePopulationEpoch(accordMajority, {
        now, maximumHostileShare: 0.9,
      }),
      applyUniversePopulationEpoch(accordMajority, {
        now, maximumHostileShare: 0.9,
      }),
    ]);
    const applied = concurrent.filter((result) => result.status === "applied");
    assert.equal(applied.length, 1);
    assert.equal(concurrent.filter((result) => result.status === "cadence").length, 1);
    assert.equal(applied[0]?.status === "applied" ? applied[0].faction : null, "ussf");

    const [damagedRoster] = await db.select({
      patrolId: universePatrolsTable.patrolId,
      shipRoster: universePatrolsTable.shipRoster,
    }).from(universePatrolsTable)
      .where(eq(universePatrolsTable.faction, "ussf"))
      .limit(1);
    assert.ok(damagedRoster && damagedRoster.shipRoster.length > 0);
    const destroyedShipId = damagedRoster.shipRoster[0]!.id;
    await db.update(universePatrolsTable)
      .set({ shipRoster: damagedRoster.shipRoster.slice(1) })
      .where(eq(universePatrolsTable.patrolId, damagedRoster.patrolId));

    const later = new Date(now.getTime() + 5 * 60_000 + 1);
    const ussfMajority = await applyUniversePopulationEpoch({
      capturedAt: later.getTime(),
      activePilotsByFaction: { ussf: 10, accord: 0 },
      total: 10,
    }, { now: later, maximumHostileShare: 0.9 });
    assert.equal(ussfMajority.status, "applied");
    if (ussfMajority.status === "applied") assert.equal(ussfMajority.faction, "accord");

    const allRosters = await db.select({
      shipRoster: universePatrolsTable.shipRoster,
    }).from(universePatrolsTable);
    assert.ok(!allRosters.some((row) =>
      row.shipRoster.some((ship) => ship.id === destroyedShipId)));

    const [hostileFleet] = await db.select().from(universePatrolsTable)
      .where(eq(universePatrolsTable.faction, "ussf")).limit(1);
    const [friendlyFleet] = await db.select().from(universePatrolsTable)
      .where(eq(universePatrolsTable.faction, "accord")).limit(1);
    assert.ok(hostileFleet?.shipRoster.length && friendlyFleet?.shipRoster.length);
    const hostileLoss = hostileFleet.shipRoster[0]!;
    const friendlyLoss = friendlyFleet.shipRoster[0]!;
    const encounterId = randomUUID();
    await db.update(universePatrolsTable).set({
      activeEncounterId: encounterId,
      encounterLeaseExpiresAt: new Date(later.getTime() + 60_000),
    }).where(eq(universePatrolsTable.patrolId, hostileFleet.patrolId));
    await db.transaction((tx) => applyUniversePatrolOutcomeInTransaction(tx, {
      patrolId: hostileFleet.patrolId,
      encounterId,
      destroyedActorIds: [`patrol-ship:${hostileLoss.id}`],
      alliedPatrolCasualties: [{
        patrolId: friendlyFleet.patrolId,
        faction: "accord",
        destroyedActorIds: [`patrol-ship:${friendlyLoss.id}`],
      }],
    }));
    const [settledHostile] = await db.select().from(universePatrolsTable)
      .where(eq(universePatrolsTable.patrolId, hostileFleet.patrolId));
    const [settledFriendly] = await db.select().from(universePatrolsTable)
      .where(eq(universePatrolsTable.patrolId, friendlyFleet.patrolId));
    assert.equal(settledHostile?.activeEncounterId, null);
    assert.ok(!settledHostile?.shipRoster.some((ship) => ship.id === hostileLoss.id));
    assert.ok(!settledFriendly?.shipRoster.some((ship) => ship.id === friendlyLoss.id));

    const [state] = await db.select().from(universePopulationStateTable);
    const receipts = await db.select().from(universePopulationEpochsTable);
    assert.equal(state?.epoch, 2);
    assert.deepEqual(receipts.map((receipt) => receipt.epoch).sort(), [1, 2]);
    assert.equal(new Set(receipts.flatMap((receipt) => receipt.patrolIds)).size,
      receipts.reduce((sum, receipt) => sum + receipt.patrolIds.length, 0));
  } finally {
    await pool.end();
  }
});
