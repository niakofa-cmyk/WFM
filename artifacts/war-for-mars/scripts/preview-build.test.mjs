import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const buildRoot = fileURLToPath(new URL('../dist/combat-lab/', import.meta.url));

test('Preview has a default entry identical to the standalone combat entry', async () => {
  const index = await readFile(path.join(buildRoot, 'index.html'), 'utf8');
  const standalone = await readFile(path.join(buildRoot, 'combat-lab.html'), 'utf8');
  assert.equal(index, standalone);
  assert.match(index, /type="module"/);
  assert.match(index, /<div id="root"><\/div>/);
});

test('Preview entry resources resolve inside the published build', async () => {
  const html = await readFile(path.join(buildRoot, 'index.html'), 'utf8');
  const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(resources.length >= 3);
  for (const resource of resources) {
    assert.ok(resource.startsWith('./'), `Expected relative resource: ${resource}`);
    const resolved = path.resolve(buildRoot, resource);
    const relative = path.relative(buildRoot, resolved);
    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative));
    await access(resolved);
  }
});
