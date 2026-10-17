import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { buttonByText, mountPattern } from './harness.mjs';

const load = async entry => {
  const bundled = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
};

const catalogId = 'local://genux-cards/v1';
const rows = ['ord-1', 'ord-2', 'ord-3', 'ord-4', 'ord-5'].map((id, index) => ({
  id,
  customer: `Customer ${index + 1}`,
  total: (index + 1) * 120,
}));
const collection = selection => ({
  title: 'Recorded orders',
  columns: [
    { key: 'customer', label: 'Customer' },
    { key: 'total', label: 'Total', format: 'number' },
  ],
  rows,
  selection,
});

test('selected-record context comes only from current selected rows and Prepare is explicit', async () => {
  // RED as an assertion: the public core helper must exist before the widget is exercised.
  const core = existsSync('docs/src/genux/hybrid-context.ts')
    ? await load('docs/src/genux/hybrid-context.ts')
    : {};
  assert.equal(
    typeof core.getSelectionContext,
    'function',
    'getSelectionContext is a public core export',
  );
  const { getSelectionContext, isSelectionContextCurrent } = core;
  const { createGenUXRuntime } = await load('docs/src/genux/runtime.ts');

  const runtime = createGenUXRuntime({ scopeId: 'hybrid-context' });
  runtime.beginRequest('context-request');
  assert.equal(
    runtime.applyBatch({
      requestId: 'context-request',
      sequence: 1,
      commands: [
        { version: 'v0.9', createSurface: { surfaceId: 'orders', catalogId } },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'orders',
            components: [
              { id: 'root', component: 'GenUXStack', children: ['orders-table'] },
              {
                id: 'orders-table',
                component: 'GenUXCollection',
                payload: collection(['ord-2', 'ord-4']),
              },
              // Not reachable from root: its selection must never become context.
              { id: 'archive', component: 'GenUXCollection', payload: collection(['ord-1']) },
            ],
          },
        },
      ],
    }).ok,
    true,
  );
  assert.equal(getSelectionContext(runtime.getSnapshot()), null, 'no context while receiving');
  runtime.finishRequest('context-request', 'success');

  const seeded = runtime.getSnapshot();
  const context = getSelectionContext(seeded);
  assert.deepEqual(context, {
    scopeId: 'hybrid-context',
    revision: seeded.revision,
    selections: [
      {
        surfaceId: 'orders',
        generation: 1,
        componentId: 'orders-table',
        recordIds: ['ord-2', 'ord-4'],
      },
    ],
  });

  // IDs are verified against actual records, not trusted from the selection list.
  const surface = seeded.surfaces[0];
  const forged = {
    ...seeded,
    surfaces: [
      {
        ...surface,
        blocks: {
          ...surface.blocks,
          'orders-table': { ...surface.blocks['orders-table'], selection: ['ghost', 'ord-2'] },
        },
      },
    ],
  };
  assert.deepEqual(getSelectionContext(forged).selections[0].recordIds, ['ord-2']);

  const prepared = [];
  const harness = await mountPattern('default', 'docs/src/react/genux/HybridQuickBar.tsx', {
    runtime,
    onPrepare(value) {
      prepared.push(value);
    },
  });
  try {
    const { document } = harness;
    assert.equal(document.querySelector('[data-hybrid-scope]').textContent, 'hybrid-context');
    assert.equal(document.querySelector('[data-hybrid-selection-count]').textContent, '2');
    assert.match(document.body.textContent, /no model or server/);
    assert.equal(prepared.length, 0, 'rendering alone never prepares');

    const button = buttonByText(document, 'Prepare selected records');
    assert.ok(button, 'native GenUX Prepare button');
    await harness.click(button);
    assert.deepEqual(prepared, [context]);
    const after = runtime.getSnapshot();
    assert.equal(after.revision, seeded.revision, 'Prepare does not change the runtime');
    assert.equal(after.status, 'success');
    assert.equal(after.requestId, seeded.requestId, 'Prepare sends no request');
    assert.deepEqual(after.surfaces[0].blocks['orders-table'].selection, ['ord-2', 'ord-4']);

    // Changing the canonical selection retires the earlier context.
    await harness.act(async () => {
      assert.equal(runtime.chooseValue('orders', 'orders-table', ['ord-5']).ok, true);
    });
    await harness.waitFor(
      () => document.querySelector('[data-hybrid-selection-count]').textContent === '1',
      'count follows the current selection',
    );
    const changed = runtime.getSnapshot();
    assert.equal(isSelectionContextCurrent(changed, context), false);
    assert.notEqual(getSelectionContext(changed).revision, context.revision);
    await harness.click(buttonByText(document, 'Prepare selected records'));
    assert.equal(prepared.length, 2);
    assert.deepEqual(prepared[1].selections[0].recordIds, ['ord-5']);
    assert.equal(prepared[1].revision, changed.revision);

    await harness.act(async () => {
      assert.equal(runtime.chooseValue('orders', 'orders-table', []).ok, true);
    });
    await harness.waitFor(
      () => buttonByText(document, 'Prepare selected records').disabled,
      'Prepare is unavailable without a selection',
    );
    assert.equal(getSelectionContext(runtime.getSnapshot()), null);
    await harness.click(buttonByText(document, 'Prepare selected records'));
    assert.equal(prepared.length, 2);
  } finally {
    await harness.dispose();
  }
});
