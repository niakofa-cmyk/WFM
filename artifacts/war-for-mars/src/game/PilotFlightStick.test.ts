import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PilotFlightStick } from "./PilotFlightStick";

test("floating Orbital sticks are full-side touch zones with an initially hidden touch marker", () => {
  const html = renderToStaticMarkup(createElement(PilotFlightStick, {
    label: "Left thumb flight",
    testId: "stick-flight",
    floatingSide: "left",
    onAxis: () => {},
  }));

  assert.match(html, /data-floating-side="left"/);
  assert.match(html, /data-active="false"/);
  assert.match(html, /pilot-flight-stick-zone/);
  assert.match(html, /pilot-flight-stick-visual/);
  assert.doesNotMatch(html, /rounded-full border border-bone\/30 bg-void\/25/);
});

test("right-half floating input remains a separate, accessible virtual stick", () => {
  const html = renderToStaticMarkup(createElement(PilotFlightStick, {
    label: "Right thumb aim",
    testId: "stick-aim",
    floatingSide: "right",
    description: "Aim and translate",
    onAxis: () => {},
  }));

  assert.match(html, /data-floating-side="right"/);
  assert.match(html, /aria-label="Right thumb aim stick\. Aim and translate/);
  assert.match(html, /data-testid="stick-aim"/);
});

test("fixed Orbital sticks keep visible on-screen guides by default", () => {
  const html = renderToStaticMarkup(createElement(PilotFlightStick, {
    label: "Left thumb flight",
    testId: "stick-flight",
    className: "pilot-rust-disc-stick",
    onAxis: () => {},
  }));

  assert.match(html, /pilot-rust-disc-stick/);
  assert.match(html, /pilot-flight-stick-visual-static/);
  assert.doesNotMatch(html, /data-floating-side=/);
});
