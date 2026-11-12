import assert from "node:assert/strict";
import test from "node:test";
import { enterMobileGameFullscreen, exitMobileGameFullscreen } from "./mobile-game-fullscreen";

function fakeDocument(requestFullscreen?: (options?: FullscreenOptions) => Promise<void>, active = false) {
  const requests: FullscreenOptions[] = [];
  let exitCount = 0;
  const doc = {
    fullscreenElement: active ? {} as Element : null,
    documentElement: {
      requestFullscreen: requestFullscreen
        ? (options?: FullscreenOptions) => {
          requests.push(options ?? {});
          return requestFullscreen(options);
        }
        : undefined,
    },
    exitFullscreen: async () => { exitCount += 1; },
  };
  return { doc, requests, get exitCount() { return exitCount; } };
}

test("hangar fullscreen hides browser navigation UI and requests landscape", async () => {
  const fake = fakeDocument(async () => undefined);
  const locked: string[] = [];
  const screen = { orientation: { lock: async (value: "landscape") => { locked.push(value); } } };

  assert.equal(await enterMobileGameFullscreen(fake.doc, screen), true);
  assert.deepEqual(fake.requests, [{ navigationUI: "hide" }]);
  assert.deepEqual(locked, ["landscape"]);
});

test("fullscreen denial or unsupported browsers remain playable without a false success", async () => {
  const unsupported = fakeDocument();
  assert.equal(await enterMobileGameFullscreen(unsupported.doc, {}), false);

  const denied = fakeDocument(async () => { throw new Error("fullscreen denied"); });
  const locked: string[] = [];
  assert.equal(await enterMobileGameFullscreen(denied.doc, {
    orientation: { lock: async (value) => { locked.push(value); } },
  }), false);
  assert.deepEqual(locked, []);
});

test("existing fullscreen is reused and leaving the universe exits it and unlocks orientation", async () => {
  const active = fakeDocument(async () => undefined, true);
  const unlocked: string[] = [];
  const screen = { orientation: { unlock: () => { unlocked.push("unlocked"); } } };

  assert.equal(await enterMobileGameFullscreen(active.doc, screen), true);
  assert.deepEqual(active.requests, []);
  exitMobileGameFullscreen(active.doc, screen);
  await Promise.resolve();
  assert.equal(active.exitCount, 1);
  assert.deepEqual(unlocked, ["unlocked"]);
});
