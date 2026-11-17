import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OpeningHistory } from "./OpeningHistory";

test("opening history is optional public context, not evidence or a deployment", () => {
  const html = renderToStaticMarkup(createElement(OpeningHistory));
  assert.match(html, /<details/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /not a serving military commander/);
  assert.match(html, /before the fleet was destroyed/);
  assert.match(html, /NO REWARDS/);
  assert.doesNotMatch(html, /<canvas|<button|iframe/);
});
