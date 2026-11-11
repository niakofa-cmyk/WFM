import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const buildRoot = fileURLToPath(new URL('../dist/public/', import.meta.url));
const workspaceRoot = path.resolve(buildRoot, '../../../..');

test('Legacy Combat Lab address returns to the single hangar entry', async () => {
  const main = await readFile(path.join(buildRoot, 'index.html'), 'utf8');
  const lab = await readFile(path.join(buildRoot, 'combat-lab.html'), 'utf8');
  assert.match(main, /WAR FOR MARS: INFINITE WAR/);
  assert.match(lab, /Return to Hangar/);
  assert.match(lab, /name="robots" content="noindex"/);
  assert.match(lab, /http-equiv="refresh" content="0;url=\.\/"/);
  assert.doesNotMatch(lab, /type="module"|<div id="root"/);
});

test('Combat Lab resources resolve inside the published static root', async () => {
  const html = await readFile(path.join(buildRoot, 'combat-lab.html'), 'utf8');
  const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(resources.length >= 2, 'Expected an icon and a link back to the hangar.');
  for (const resource of resources) {
    assert.ok(resource.startsWith('./'), `Expected relative resource: ${resource}`);
    const resolved = path.resolve(buildRoot, resource);
    const relative = path.relative(buildRoot, resolved);
    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative));
    await access(resolved);
  }
});

test('main app loads Three.js only after entering a 3D flight route', async () => {
  const report = JSON.parse(
    await readFile(path.join(workspaceRoot, 'generated-artifacts/wfm-bundle-audit.json'), 'utf8'),
  );
  const engine = report.chunks.find((chunk) => chunk.name === 'three-engine');
  const arena = report.chunks.find((chunk) => chunk.name === 'Arena');

  assert.ok(engine, 'Expected the separately bundled Three.js engine.');
  assert.ok(arena, 'Expected the deferred canonical flight renderer.');
  assert.equal(arena.initialStaticLoad, false);
  assert.equal(report.engineLoadedInInitialStaticGraph, false);
  assert.ok(
    report.initialStaticJavascriptGzipBytes <= 140 * 1024,
    'Main app initial JavaScript exceeded its 140 KiB gzip budget.',
  );
  assert.ok(engine.bytes <= 560_000, 'Three.js raw chunk exceeded its budget.');
  assert.ok(engine.gzipBytes <= 150 * 1024, 'Three.js gzip chunk exceeded its budget.');
  assert.ok(report.chunks.some((chunk) => chunk.dynamicImports.includes(arena.file)),
    'The canonical Arena should be requested dynamically.');
  assert.ok(
    arena.imports.includes(engine.file),
    'The deferred Arena should load the Three.js engine.',
  );
});

test('Legacy Combat Lab redirects without loading a separate game engine', async () => {
  const report = JSON.parse(
    await readFile(path.join(workspaceRoot, 'generated-artifacts/wfm-combat-lab-bundle-audit.json'), 'utf8'),
  );
  const engineChunks = report.chunks.filter((chunk) =>
    chunk.modules.some((module) => /(?:^|\/)node_modules\/three\//.test(module.id)),
  );

  assert.equal(engineChunks.length, 0, 'The compatibility redirect must not include a game engine.');
  assert.equal(report.engineLoadedInInitialStaticGraph, false);
  assert.ok(
    report.initialStaticJavascriptGzipBytes <= 140 * 1024,
    'Combat Lab initial JavaScript exceeded its 140 KiB gzip budget.',
  );
  assert.ok(
    engineChunks.every((chunk) => !chunk.initialStaticLoad),
    'A Three.js package chunk entered the Combat Lab initial static graph.',
  );
  assert.ok(
    engineChunks.reduce((total, chunk) => total + chunk.bytes, 0) <= 560_000,
    'Combat Lab Three.js chunks exceeded their aggregate raw budget.',
  );
  assert.ok(
    engineChunks.reduce((total, chunk) => total + chunk.gzipBytes, 0) <= 150 * 1024,
    'Combat Lab Three.js chunks exceeded their aggregate gzip budget.',
  );
});
