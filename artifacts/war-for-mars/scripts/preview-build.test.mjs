import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const buildRoot = fileURLToPath(new URL('../dist/public/', import.meta.url));
const workspaceRoot = path.resolve(buildRoot, '../../../..');

test('Static build includes the standalone offline Combat Lab beside the main app', async () => {
  const main = await readFile(path.join(buildRoot, 'index.html'), 'utf8');
  const lab = await readFile(path.join(buildRoot, 'combat-lab.html'), 'utf8');
  assert.match(main, /WAR FOR MARS: INFINITE WAR/);
  assert.match(lab, /Combat Lab/);
  assert.match(lab, /name="robots" content="noindex"/);
  assert.match(lab, /type="module"/);
  assert.match(lab, /<div id="root"><\/div>/);
});

test('Combat Lab resources resolve inside the published static root', async () => {
  const html = await readFile(path.join(buildRoot, 'combat-lab.html'), 'utf8');
  const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(resources.length >= 3, 'Expected generated script, stylesheet, and icon resources.');
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
  const rustDisc = report.chunks.find((chunk) => chunk.name === 'RustDiscFlight');

  assert.ok(engine, 'Expected the separately bundled Three.js engine.');
  assert.ok(rustDisc, 'Expected a separately bundled Rust Disc flight route.');
  assert.equal(report.engineLoadedInInitialStaticGraph, false);
  assert.ok(
    report.initialStaticJavascriptGzipBytes <= 140 * 1024,
    'Main app initial JavaScript exceeded its 140 KiB gzip budget.',
  );
  assert.ok(engine.bytes <= 560_000, 'Three.js raw chunk exceeded its budget.');
  assert.ok(engine.gzipBytes <= 150 * 1024, 'Three.js gzip chunk exceeded its budget.');
  assert.ok(!rustDisc.imports.includes(engine.file), 'Rust Disc briefing eagerly imports Three.js.');
  assert.ok(
    rustDisc.dynamicImports.includes(engine.file),
    'Rust Disc should request Three.js dynamically when flight starts.',
  );
});

test('Combat Lab keeps its 3D engine out of the document initial graph', async () => {
  const report = JSON.parse(
    await readFile(path.join(workspaceRoot, 'generated-artifacts/wfm-combat-lab-bundle-audit.json'), 'utf8'),
  );
  const engine = report.chunks.find((chunk) => chunk.name === 'three-engine');

  assert.ok(engine, 'Expected a separately bundled Three.js engine for Combat Lab.');
  assert.equal(report.engineLoadedInInitialStaticGraph, false);
  assert.ok(
    report.initialStaticJavascriptGzipBytes <= 140 * 1024,
    'Combat Lab initial JavaScript exceeded its 140 KiB gzip budget.',
  );
  assert.ok(engine.bytes <= 560_000, 'Combat Lab Three.js raw chunk exceeded its budget.');
  assert.ok(engine.gzipBytes <= 150 * 1024, 'Combat Lab Three.js gzip chunk exceeded its budget.');
});
