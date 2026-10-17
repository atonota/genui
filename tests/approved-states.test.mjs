import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { render } from '../tools/build.mjs';
import { setup } from './harness.mjs';

const model = await readFile(new URL('../src/model/decisions.js', import.meta.url), 'utf8');
const catalog = JSON.parse(
  vm.runInNewContext(
    model +
      '\nJSON.stringify({decisions:BUTTON_DECISIONS,experiments:BUTTON_EXPERIMENTS,states:BUTTON_VARIANTS.state,fallback:buttonStatus("unknown")})',
  ),
);

test('only the five explicitly approved button states are decisions', () => {
  assert.deepEqual(
    catalog.decisions.state_variants?.map(item => item.value),
    ['default', 'hover', 'pressed', 'disabled', 'loading'],
  );
  assert.deepEqual(
    catalog.experiments.state_variants.map(item => item.value),
    ['offline', 'warning', 'retry', 'success', 'error'],
  );
  assert.equal(catalog.states.length, 10);
  assert.equal(new Set(catalog.states.map(item => item.value)).size, 10);
  assert.equal(catalog.fallback.value, 'default');
  for (const value of ['loading']) {
    const state = catalog.states.find(item => item.value === value);
    assert.equal(state.busy, true);
    assert.equal(state.blocked, true);
  }
  assert.equal(catalog.states.find(item => item.value === 'loading').label, 'Processing');
  for (const removed of ['saving', 'syncing', 'queued'])
    assert.equal(
      catalog.states.some(item => item.value === removed),
      false,
    );
});

test('GenUX decisions render the approved states and retain busy/blocked semantics', async t => {
  const h = setup((await render()).html);
  t.after(h.close);
  const grid = h.el('decisionStateGrid');
  const buttons = [...grid.querySelectorAll('.btx')];
  assert.deepEqual(
    buttons.map(button => button.dataset.force),
    catalog.decisions.state_variants.map(state => state.value),
  );
  assert.deepEqual(
    [...grid.querySelectorAll('figcaption strong')].map(label => label.textContent),
    catalog.decisions.state_variants.map(state => state.label),
  );
  for (const value of ['loading']) {
    const button = buttons.find(item => item.dataset.force === value);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.equal(button.getAttribute('aria-disabled'), 'true');
  }
  assert.equal(buttons.find(item => item.dataset.force === 'disabled').disabled, true);
  h.click('themeToggle');
  assert.equal(h.doc.documentElement.dataset.theme, 'dark');
  assert.equal(grid.querySelectorAll('.btx').length, 5);
});
