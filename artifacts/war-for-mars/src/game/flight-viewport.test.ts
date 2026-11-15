import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { attachFlightViewport, flightViewportRect } from "./flight-viewport";

test("phone flight uses the visible viewport instead of a taller layout rectangle", () => {
  const rect = flightViewportRect(803, 416, { width: 803, height: 360, offsetLeft: 0, offsetTop: 0 });
  assert.deepEqual(rect, { width: 803, height: 360, left: 0, top: 0 });
  assert.equal(rect.height / 2, 180, "reticle and camera must center in the visible screen");
});

test("browser chrome, viewport offsets, and unsupported viewport APIs remain bounded", () => {
  assert.deepEqual(flightViewportRect(803, 360, { width: 781, height: 280, offsetLeft: 11, offsetTop: 24 }),
    { width: 781, height: 280, left: 11, top: 24 });
  assert.deepEqual(flightViewportRect(1280, 720), { width: 1280, height: 720, left: 0, top: 0 });
  assert.deepEqual(flightViewportRect(803, 360, { width: 1024, height: 600, offsetLeft: -1, offsetTop: NaN }),
    { width: 803, height: 360, left: 0, top: 0 });
  assert.deepEqual(flightViewportRect(803, 360, { width: 0, height: NaN, offsetLeft: 0, offsetTop: 0 }),
    { width: 803, height: 360, left: 0, top: 0 });
});

test("resize, fullscreen, rotation, and viewport scrolling update one shared flight surface and clean up", () => {
  const viewport = Object.assign(new EventTarget(), { width: 803, height: 360, offsetLeft: 0, offsetTop: 0 });
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const host = Object.assign(new EventTarget(), {
    innerWidth: 803, innerHeight: 416, visualViewport: viewport, document: new EventTarget(),
    requestAnimationFrame: (fn: FrameRequestCallback) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  });
  const properties = new Map<string, string>();
  const stage = {
    dataset: {} as Record<string, string>,
    style: { width: "", height: "", left: "", top: "", position: "", setProperty: (key: string, value: string) => properties.set(key, value) },
    getAttribute: () => null, removeAttribute: () => {}, setAttribute: () => {},
  };
  const cleanup = attachFlightViewport(stage as unknown as HTMLElement, host as unknown as Window);
  assert.equal(stage.style.height, "360px");
  assert.equal(stage.dataset.compactViewport, "true");
  viewport.height = 280;
  viewport.dispatchEvent(new Event("resize"));
  assert.equal(stage.style.height, "280px");
  assert.equal(properties.get("--flight-viewport-height"), "280px");
  viewport.offsetTop = 24;
  viewport.dispatchEvent(new Event("scroll"));
  assert.equal(stage.style.top, "24px");
  viewport.height = 350;
  host.document.dispatchEvent(new Event("fullscreenchange"));
  assert.equal(stage.style.height, "350px");
  host.innerWidth = 360; host.innerHeight = 803;
  viewport.width = 360; viewport.height = 803;
  host.dispatchEvent(new Event("orientationchange"));
  assert.equal(stage.dataset.compactViewport, "false");
  host.innerHeight = 720;
  host.dispatchEvent(new Event("resize"));
  assert.equal(stage.style.height, "720px");
  cleanup();
  assert.equal(frames.size, 0);
  viewport.height = 100;
  viewport.dispatchEvent(new Event("resize"));
  assert.equal(stage.style.height, "720px", "unmounted listeners must not resize the arena");
  assert.equal(stage.dataset.compactViewport, undefined);
});

test("canvas, HUD, and touch-anywhere controls use the same arena bounds", () => {
  const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  const stick = readFileSync(new URL("./PilotFlightStick.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("./combat-lab.css", import.meta.url), "utf8");
  assert.match(arena, /ref=\{stageRef\}\s+data-testid="arena-stage"/);
  assert.match(arena, /attachFlightViewport\(stageRef\.current\)/);
  assert.match(arena, /observer\.observe\(canvas\)/);
  assert.match(stick, /height: "var\(--flight-viewport-height, 100dvh\)"/);
  assert.match(stick, /width: "calc\(var\(--flight-viewport-width, 100vw\) \* \.5\)"/);
  assert.match(css, /data-compact-viewport=true/);
});
