import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShipIllustration } from "./ShipIllustration";
import { ROSTER, SHIPS, type ShipId } from "./ships";

const render = (ship: ShipId, caption = true, grid = true) =>
  renderToStaticMarkup(createElement(ShipIllustration, { ship, caption, grid }));

test("every selectable hull renders its own named, accessible illustration", () => {
  const roster = [...ROSTER.accord, ...ROSTER.ussf];
  assert.equal(new Set(roster).size, 8);
  for (const ship of roster) {
    const markup = render(ship);
    assert.ok(markup.includes(`data-ship-id="${ship}"`));
    assert.ok(markup.includes(`aria-label="${SHIPS[ship].name} hull illustration"`));
    assert.ok(markup.includes('role="img"'));
    assert.ok(markup.includes("HULL ILLUSTRATION"));
  }
});

test("all eight hulls have different geometry, not merely different names", () => {
  const shapes = Object.keys(SHIPS).map((id) =>
    render(id as ShipId, false, false)
      .match(/<(?:path|rect|circle|ellipse)\b[^>]*>/g)?.join(""),
  );
  assert.ok(shapes.every(Boolean));
  assert.equal(new Set(shapes).size, 8);
});

test("illustrations take faction color from code-owned ship definitions", () => {
  for (const [faction, roster] of Object.entries(ROSTER)) {
    for (const ship of roster) {
      assert.equal(SHIPS[ship].faction, faction);
      assert.ok(render(ship).includes(
        faction === "accord" ? "var(--color-spectral)" : "var(--color-solar)",
      ));
    }
  }
});

test("compact illustrations need no external asset, WebGL or animation", () => {
  for (const id of Object.keys(SHIPS)) {
    const markup = render(id as ShipId, false, false);
    assert.ok(!markup.includes("<figcaption"));
    assert.ok(!markup.includes("<line"));
    assert.doesNotMatch(markup, /<(?:canvas|image|animate|filter)\b|href=|https?:/);
  }
});
