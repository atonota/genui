import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transform } from 'esbuild';
import { buttonByText, mountPattern } from './harness.mjs';

test('Splitter has one discoverable Layout page and documents the shared and native contracts', async () => {
  const source = await readFile(new URL('../src/data/catalog.ts', import.meta.url), 'utf8');
  const compiled = await transform(source, { loader: 'ts', format: 'esm' });
  const { components } = await import(
    'data:text/javascript;base64,' + Buffer.from(compiled.code).toString('base64')
  );
  const items = components.filter(component => component.slug === 'splitter');
  assert.equal(items.length, 1);
  const splitter = items[0];
  assert.equal(splitter.category, 'Layout');
  assert.equal(splitter.sourceUrl, 'https://ant.design/components/splitter/');
  assert.ok(splitter.api.some(row => row.property === 'GenUXSplitter.panels'));
  assert.ok(splitter.nativeApi.some(row => row.property === 'orientation'));
  assert.ok(splitter.examples.length >= 2);
});

test('Splitter examples group a persistent browser and editor with contextual workspace links', async t => {
  const h = await mountPattern('default', 'docs/src/react/SplitterDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('[data-splitter-catalog]');
  assert.ok(catalog);
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.deepEqual(
    sections.map(section => section.id),
    ['splitter-explore', 'splitter-compose', 'splitter-workspaces'],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  assert.equal(catalog.querySelectorAll('[data-genux-splitter]').length, 2);
  assert.equal(catalog.querySelectorAll('a[href^="/components/"]').length, 5);
  const note = catalog.querySelector('#splitter-review-note');
  await h.type(note, 'Persistent review note');
  const separator = catalog.querySelector('[role="separator"]');
  const before = Number(separator.getAttribute('aria-valuenow'));
  await h.click(buttonByText(catalog, 'More space for Records'));
  assert.ok(Number(separator.getAttribute('aria-valuenow')) > before);
  assert.equal(catalog.querySelector('#splitter-review-note'), note);
  assert.equal(note.value, 'Persistent review note');
  await h.click(buttonByText(catalog, 'Balance panels'));
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  await h.click(h.document.querySelectorAll('[data-size-control] input[type="radio"]')[0]);
  assert.equal(catalog.querySelector('#splitter-review-note'), note);
  await h.act(() => h.setLocale('tr'));
  assert.equal(note.value, 'Persistent review note');
  assert.equal(catalog.querySelector('#splitter-review-note'), note);
  assert.match(catalog.querySelector('[role="separator"]').getAttribute('aria-label'), /Kayıtlar/);
});
