import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

async function bundle(entry) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(`../src/genui/${entry}`, import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    logLevel: 'silent',
  });
  const text = result.outputFiles[0].text;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
  );
  return { text, module };
}

test('core query port is backend-neutral and Frappe is an explicit optional adapter', async () => {
  const core = await bundle('index.ts');
  assert.equal(Object.hasOwn(core.module, 'createFrappeQuerySource'), false);
  assert.equal(core.text.includes('atlas_genui.api'), false);

  const { module: adapter } = await bundle('adapters/frappe.ts');
  const calls = [];
  const source = adapter.createFrappeQuerySource({
    audience: 'panel',
    call: async (method, args, signal) => {
      calls.push({ method, args, signal });
      return { message: { rows: [{ id: 'one' }] } };
    },
  });
  assert.equal(source.mode, 'host');
  assert.equal(source.audience, 'panel');
  const controller = new AbortController();
  const data = await source.run(
    { toolId: 'metrics.sales', params: { period: 'October 2026' }, targetKey: 'sales' },
    controller.signal,
  );
  assert.deepEqual(data, { rows: [{ id: 'one' }] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'atlas_genui.api.run_panel_query');
  assert.deepEqual(calls[0].args, {
    tool_id: 'metrics.sales',
    parameters: { period: 'October 2026' },
  });
  assert.equal(calls[0].signal, controller.signal);
});
