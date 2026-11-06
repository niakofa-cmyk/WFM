import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HangarShip } from "./HangarShip";
import { SHIPS, type ShipId } from "./ships";

test("hangar display exposes the saved hull and accessible inspection instructions", () => {
  for (const ship of Object.keys(SHIPS) as ShipId[]) {
    const faction = SHIPS[ship].faction;
    const markup = renderToStaticMarkup(createElement(HangarShip, { ship, faction, isSaved: true }));

    assert.ok(markup.includes(`data-ship-id="${ship}"`));
    assert.ok(markup.includes(`Hangar display of saved ${SHIPS[ship].name} spacecraft`));
    assert.ok(markup.includes("DRAG TO INSPECT · SAVED HULL"));
    assert.ok(markup.includes('aria-label="Inspect ship components"'));
    assert.ok(markup.includes('aria-label="Presentation-only damage view"'));
    assert.ok(markup.includes('data-testid="hangar-view-engines"'));
    assert.ok(markup.includes('data-testid="hangar-view-weapons"'));
    assert.ok(markup.includes('data-testid="hangar-damage-critical"'));
  }
});

test("an unsaved armory hull is clearly labeled as a draft, not the saved profile loadout", () => {
  const ship: ShipId = "glide";
  const markup = renderToStaticMarkup(createElement(HangarShip, {
    ship,
    faction: SHIPS[ship].faction,
    isSaved: false,
  }));

  assert.ok(markup.includes(`Hangar display of unsaved ${SHIPS[ship].name} spacecraft`));
  assert.ok(markup.includes("DRAG TO INSPECT · UNSAVED PREVIEW"));
  assert.ok(!markup.includes("SAVED HULL</div>"));
});
