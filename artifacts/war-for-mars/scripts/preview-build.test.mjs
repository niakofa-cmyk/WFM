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

test('main app and standalone Combat Lab contain no Three.js modules', async () => {
  for (const reportName of ['wfm-bundle-audit.json', 'wfm-combat-lab-bundle-audit.json']) {
    const report = JSON.parse(
      await readFile(path.join(workspaceRoot, 'generated-artifacts', reportName), 'utf8'),
    );
    assert.equal(report.renderer, 'Orbital-owned WebGL2');
    assert.deepEqual(report.forbiddenThreeModules, [], `${reportName} must not contain Three.js modules.`);
    assert.ok(
      report.chunks.every((chunk) =>
        chunk.modules.every((module) => !/node_modules\/three(?:\/|$)/.test(module.id)),
      ),
      `${reportName} contains a Three.js module.`,
    );
    assert.ok(
      report.initialStaticJavascriptGzipBytes <= 140 * 1024,
      `${reportName} initial JavaScript exceeded its 140 KiB gzip budget.`,
    );
  }
});
