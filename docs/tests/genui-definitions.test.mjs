import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
async function module(path) {
  const result = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
  );
}
const definitions = await module('docs/src/genui/definitions.ts');
const { createGenUIRuntime } = await module('docs/src/genui/runtime.ts');

test('saved definitions contain structure/query bindings and no live record values', () => {
  for (const kind of ['sales', 'orders']) {
    const definition = definitions.createRecordedQueryDefinition(kind);
    assert.equal(definition.generationMode, 'schema');
    const serialized = JSON.stringify(definition);
    for (const value of ['2450000', '1240', 'Aster Workshop', 'record-one'])
      assert.ok(!serialized.includes(value));
    const store = definitions.createDefinitionStore({
      audience: 'panel',
      scopeId: 'host-one',
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });
    store.save(definition);
    assert.equal(store.list().length, 1);
    assert.match(store.getError(), /memory/);
    const copy = store.list();
    copy[0].title.en = 'mutated';
    assert.notEqual(store.list()[0].title.en, 'mutated');
    const embedded = structuredClone(definition);
    embedded.components = [
      {
        id: 'root',
        component: 'AtlasEntityCard',
        model: { id: 'record', kind: 'entity', title: 'Secret data' },
      },
    ];
    assert.throws(() => definitions.validateCardDefinition(embedded), /never record/);
  }
});

test('definition replay refreshes data without a model call; native host runtime validates the result', async () => {
  for (const kind of ['sales', 'orders']) {
    const runtime = createGenUIRuntime({ scopeId: 'saved-definition' });
    await definitions.renderCardDefinition(
      runtime,
      definitions.createRecordedQueryDefinition(kind),
      definitions.recordedQuerySource(),
      'definition-request',
    );
    assert.equal(runtime.getSnapshot().status, 'success');
    if (kind === 'sales')
      assert.equal(runtime.getSnapshot().surfaces[0].models.root.metric.value, 2450000);
    else assert.equal(runtime.getSnapshot().surfaces[0].blocks.orders.rows.length, 2);
  }
});

test('public query/definition hosts cannot elevate to panel tools, raw SQL, other catalogs or mutation', async () => {
  assert.throws(
    () =>
      definitions.validateQueryIntent(
        { toolId: 'orders.delayed', targetKey: 'orders', params: {} },
        'frontpage',
      ),
    /unavailable/,
  );
  assert.throws(
    () =>
      definitions.validateQueryIntent(
        {
          toolId: 'products.search',
          targetKey: 'products',
          params: { sql: 'SELECT * FROM private' },
        },
        'frontpage',
      ),
    /not registered/,
  );
  const runtime = createGenUIRuntime({ scopeId: 'public-host', audience: 'frontpage' });
  await assert.rejects(
    () =>
      definitions.renderCardDefinition(
        runtime,
        definitions.createRecordedQueryDefinition('sales'),
        definitions.recordedQuerySource('frontpage'),
        'definition-request',
      ),
    /elevate/,
  );
  const cyclic = definitions.createRecordedQueryDefinition('orders');
  cyclic.components[0].children = ['root'];
  assert.throws(() => definitions.validateCardDefinition(cyclic), /cyclic/);
});

test('Frappe bridge uses fixed panel/public whitelisted methods and forwards only validated query parameters', async () => {
  const calls = [];
  const { createFrappeQuerySource } = await module('docs/src/genui/adapters/frappe.ts');
  const source = createFrappeQuerySource({
    audience: 'frontpage',
    call: async (...args) => {
      calls.push(args);
      return { message: { products: [] } };
    },
  });
  assert.deepEqual(
    await source.run({
      toolId: 'products.search',
      params: { maxPrice: 1000, limit: 10 },
      targetKey: 'products',
    }),
    { products: [] },
  );
  assert.equal(calls[0][0], 'atlas_genui.api.run_public_query');
  assert.deepEqual(calls[0][1], {
    tool_id: 'products.search',
    parameters: { maxPrice: 1000, limit: 10 },
  });
  await assert.rejects(
    () =>
      source.run({ toolId: 'products.search', params: { tenant: 'other' }, targetKey: 'products' }),
    /not registered/,
  );
  assert.equal(calls.length, 1);
});

test('recorded product filters are combined and limit stable results after filtering', async () => {
  const source = definitions.recordedQuerySource('frontpage');
  const run = params => source.run({ toolId: 'products.search', targetKey: 'products', params });
  assert.deepEqual(
    (await run({ query: ' OFFICE ', category: 'office', maxPrice: 490, limit: 1 })).rows.map(
      row => row.id,
    ),
    ['record-two'],
  );
  assert.deepEqual(
    (await run({ query: 'Aster' })).rows.map(row => row.id),
    ['record-one'],
  );
  assert.deepEqual(
    (await run({ category: 'Packaging' })).rows.map(row => row.id),
    ['record-one'],
  );
  assert.deepEqual((await run({ query: 'Packaging', category: 'Office' })).rows, []);
  assert.deepEqual((await run({ maxPrice: 489 })).rows, []);
  assert.deepEqual((await run({ category: 'Unrecorded category' })).rows, []);
  assert.deepEqual(
    (await run({ limit: 1 })).rows.map(row => row.id),
    ['record-one'],
  );
  const shown = await run({});
  assert.ok(shown.columns.some(column => column.key === 'category'));
  assert.ok(shown.rows.every(row => typeof row.category === 'string'));
});

test('recorded delayed orders apply inclusive order date, customer and limit and support valid status grouping', async () => {
  const source = definitions.recordedQuerySource();
  const run = params => source.run({ toolId: 'orders.delayed', targetKey: 'orders', params });
  assert.deepEqual(
    (
      await run({ fromDate: '2026-10-05', customer: ' ATLAS ', groupBy: 'status', limit: 1 })
    ).rows.map(row => row.id),
    ['record-two'],
  );
  assert.deepEqual(
    (await run({ customer: 'Northwind' })).rows.map(row => row.id),
    ['record-one'],
  );
  assert.deepEqual((await run({ fromDate: '2026-10-06' })).rows, []);
  assert.deepEqual((await run({ customer: 'Unrecorded customer' })).rows, []);
  assert.deepEqual(
    (await run({ limit: 1 })).rows.map(row => row.id),
    ['record-one'],
  );
  const result = await run({ groupBy: 'status' });
  assert.equal(result.groupBy, 'status');
  for (const key of ['orderDate', 'customer', 'status'])
    assert.ok(result.columns.some(column => column.key === key));
  assert.ok(result.rows.every(row => typeof row.status === 'string'));
  assert.deepEqual(
    result.rows.map(({ id, name, supplier, amount }) => ({ id, name, supplier, amount })),
    [
      { id: 'record-one', name: 'Packaging materials', supplier: 'Aster Workshop', amount: 1240 },
      { id: 'record-two', name: 'Office equipment', supplier: 'Birch Studio', amount: 490 },
    ],
  );
  const runtime = createGenUIRuntime({ scopeId: 'status-query' });
  const definition = definitions.createRecordedQueryDefinition('orders');
  definition.queries[0].params = { groupBy: 'status' };
  await definitions.renderCardDefinition(runtime, definition, source, 'status-query-request');
  assert.equal(runtime.getSnapshot().status, 'success');
  assert.equal(runtime.getSnapshot().surfaces[0].blocks.orders.groupBy, 'status');
});

test('recorded queries return fresh snapshots, respect abort and do not relabel another period as sales data', async () => {
  const source = definitions.recordedQuerySource();
  const query = { toolId: 'orders.delayed', targetKey: 'orders', params: {} };
  const first = await source.run(query);
  first.rows[0].name = 'Changed by caller';
  assert.equal((await source.run(query)).rows[0].name, 'Packaging materials');
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    () => source.run(query, aborted.signal),
    error => error.name === 'AbortError',
  );
  const metric = await source.run({
    toolId: 'metrics.sales',
    targetKey: 'sales',
    params: { period: 'September 2026' },
  });
  assert.equal(metric.state, 'empty');
  assert.equal(metric.metric.value, null);
  assert.equal(metric.metric.period, 'September 2026');
});

test('query dates reject impossible calendar values', () => {
  for (const fromDate of ['2026-02-30', '2026-04-31', '2025-02-29'])
    assert.throws(
      () =>
        definitions.validateQueryIntent(
          { toolId: 'orders.delayed', targetKey: 'orders', params: { fromDate } },
          'panel',
        ),
      /date/i,
    );
  assert.equal(
    definitions.validateQueryIntent(
      { toolId: 'orders.delayed', targetKey: 'orders', params: { fromDate: '2024-02-29' } },
      'panel',
    ).params.fromDate,
    '2024-02-29',
  );
});
