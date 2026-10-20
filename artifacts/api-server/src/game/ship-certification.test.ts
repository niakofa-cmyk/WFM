import assert from "node:assert/strict";
import test from "node:test";
import { formatShipCertification, runShipCertification } from "./ship-certification";

test("ship certification covers all eight ships and opposing role groups", () => {
  const rows = runShipCertification({ seeds: 1, durationSeconds: 10 });
  assert.equal(rows.length, 8);
  assert.deepEqual(rows.map((row) => row.shipId).sort(), [
    "duskbreaker",
    "glide",
    "mandjet",
    "sentinel",
    "shakuna",
    "splitter",
    "sundara",
    "tripura",
  ]);

  for (const row of rows) {
    assert.equal(row.matches, 8);
    assert.ok(Number.isFinite(row.winRate));
    assert.ok(Number.isFinite(row.avgDamageDealt));
    assert.ok(Number.isFinite(row.avgDamageReceived));
    assert.ok(Number.isFinite(row.avgFirstLifeSeconds));
    assert.ok(Number.isFinite(row.alivePercent));
    assert.ok(row.timeTo90PercentSpeed > 0);
    assert.ok(row.handlingTurnDegreesPerSecond > 0);
    assert.ok(row.abilityEffect.length > 12);
  }

  const report = formatShipCertification(rows, 1, 10);
  assert.match(report, /Results by opposing role/);
  assert.match(report, /Mandjet/);
  assert.match(report, /Sentinel-G/);
  assert.match(report, /Seed cohort:\*\* 0–0/);
  assert.match(report, /1v1 scripted-pilot diagnostic/);
});
