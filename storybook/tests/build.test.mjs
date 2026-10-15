import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { test } from 'node:test';

const output = new URL('../../storybook-static/', import.meta.url);
const expected = [
  'Button',
  'Input',
  'Select',
  'Checkbox',
  'Radio',
  'Switch',
  'Accordion',
  'Form',
  'Drawer',
];

test('production index preserves every playground and exposes approved Button decisions', async () => {
  const index = JSON.parse(await readFile(new URL('index.json', output), 'utf8'));
  const stories = Object.values(index.entries).filter(entry => entry.type === 'story');
  const approved = [
    'components-button--approved-states',
    'components-button--approved-dimensions',
    'components-button--approved-visuals',
    'components-button--layered-flat-eight',
  ];
  const existing = stories.filter(entry => !approved.includes(entry.id));
  assert.equal(existing.length, expected.length);
  assert.deepEqual(
    existing.map(entry => entry.title.split('/').at(-1)).sort(),
    expected.toSorted(),
  );
  for (const component of expected)
    assert.equal(
      index.entries[
        `components-${component.toLowerCase()}--${component === 'Button' ? 'playground' : 'variants'}`
      ]?.type,
      'story',
    );
  assert.equal(stories.length, expected.length + approved.length);
  assert.equal(new Set(stories.map(entry => entry.id)).size, expected.length + approved.length);
  for (const id of approved) assert.equal(index.entries[id]?.type, 'story');
  for (const component of expected) {
    const story =
      index.entries[
        `components-${component.toLowerCase()}--${component === 'Button' ? 'playground' : 'variants'}`
      ];
    assert.equal(story.name, component === 'Button' ? 'Playground' : 'Variants');
  }
  for (const [id, name] of Object.entries({
    'components-button--approved-states': 'Approved states',
    'components-button--approved-dimensions': 'Approved sizes and widths',
    'components-button--approved-visuals': 'Approved appearances',
    'components-button--layered-flat-eight': 'Layered flat · 8 px',
  }))
    assert.equal(index.entries[id].name, name);
  assert.match(await readFile(new URL('index.html', output), 'utf8'), /<html lang="en">/);

  await access(new URL('index.html', output));
  await access(new URL('iframe.html', output));
});

test('production carries local Outfit assets and compiled preview', async () => {
  await access(new URL('atlas-assets/outfit-latin.woff2', output));
  await access(new URL('atlas-assets/outfit-latin-ext.woff2', output));
  const assets = await readdir(new URL('assets/', output));
  assert.ok(assets.some(name => name.endsWith('.css')));
  assert.ok(assets.some(name => name.endsWith('.js')));
  assert.ok(!assets.some(name => /\.(tsx?|jsx)$/.test(name)));
});
