import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('native GenUXInput payload is accepted; local value changes are current, validated and leave the source intact', async () => {
  // Bundle inside the case so a missing bridge fails this assertion, not module load.
  const bundled = await build({
    entryPoints: ['docs/src/genux/runtime.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { createGenUXRuntime } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
  const runtime = createGenUXRuntime({ scopeId: 'native-scope' });
  runtime.beginRequest('native-request');
  const node = {
    id: 'root',
    component: 'GenUXInput',
    payload: { title: 'Name', native: { label: 'Name', value: 'Initial' } },
  };
  const accepted = runtime.applyBatch({
    requestId: 'native-request',
    sequence: 1,
    commands: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'records', catalogId: 'local://genux-cards/v1' },
      },
      { version: 'v0.9', updateComponents: { surfaceId: 'records', components: [node] } },
    ],
  });
  assert.equal(accepted.ok, true, accepted.error);
  const streaming = runtime.getSnapshot();
  assert.equal(streaming.surfaces[0].blocks.root.native.value, 'Initial');
  const { generation } = streaming.surfaces[0];
  assert.equal(
    runtime.changeNativeValue('records', 'root', 'Early', generation, streaming.revision).ok,
    false,
  );

  runtime.finishRequest('native-request', 'success');
  const ready = runtime.getSnapshot();
  assert.equal(ready.status, 'success');
  assert.equal(
    runtime.changeNativeValue('records', 'root', 'Changed', generation, ready.revision).ok,
    true,
  );
  const changed = runtime.getSnapshot();
  assert.equal(changed.surfaces[0].blocks.root.native.value, 'Changed');
  assert.equal(changed.surfaces[0].blocks.root.native.label, 'Name');
  assert.equal(changed.surfaces[0].components[0].payload.native.value, 'Initial');
  assert.deepEqual(node.payload.native, { label: 'Name', value: 'Initial' });

  assert.equal(
    runtime.changeNativeValue('records', 'root', 'Stale', generation, ready.revision).ok,
    false,
  );
  assert.equal(
    runtime.changeNativeValue('records', 'root', 'Stale', generation + 1, changed.revision).ok,
    false,
  );
  assert.equal(runtime.getSnapshot().surfaces[0].blocks.root.native.value, 'Changed');
  assert.equal(runtime.getSnapshot().revision, changed.revision);
});

// Regression for an observed defect (explicit one-case exception to the frozen scope):
// assertPlainJSON accepted an array with a custom prototype and its final
// JSON.stringify invoked the inherited toJSON getter once.
test('assertPlainJSON rejects a custom-prototype array without evaluating its inherited toJSON accessor', async () => {
  const bundled = await build({
    entryPoints: ['docs/src/genux/policy.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { assertPlainJSON } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
  let getterCalls = 0;
  const prototype = Object.create(Array.prototype, {
    toJSON: {
      configurable: true,
      get() {
        getterCalls += 1;
        return () => [];
      },
    },
  });
  const input = Object.setPrototypeOf(['value'], prototype);
  assert.throws(() => assertPlainJSON(input), /Host objects are not accepted/);
  assert.equal(getterCalls, 0);
});

// Regression for an observed defect (explicit one-case exception to the frozen scope):
// loading a native schema before policy made the registry read that schema's definition
// before it was initialized, so validateComponent rejected a valid node as an unknown block.
test('validateComponent accepts a native GenUXInput node when the native schema module loads before policy', async () => {
  const bundled = await build({
    stdin: {
      contents:
        "export { definition } from './docs/src/genux/native/input.ts'; export { validateComponent } from './docs/src/genux/policy.ts';",
      resolveDir: process.cwd(),
      sourcefile: 'native-first-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { definition, validateComponent } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
  assert.equal(definition.name, 'GenUXInput');
  const node = {
    id: 'root',
    component: 'GenUXInput',
    payload: { title: 'Name', native: { label: 'Name', value: 'Initial' } },
  };
  const accepted = validateComponent(node);
  assert.equal(accepted.component, 'GenUXInput');
  assert.deepEqual(accepted.payload.native, { label: 'Name', value: 'Initial' });
});

// Regression for an observed defect (explicit one-case exception to the frozen scope):
// a local native value was keyed only to the serialized payload, so rebinding the same
// node to another record with identical JSON reapplied the old draft to that record.
test('a local native value does not follow its node to a different payload binding with identical host JSON', async () => {
  const bundled = await build({
    entryPoints: ['docs/src/genux/runtime.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { createGenUXRuntime } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
  const record = () => ({ title: 'Name', native: { label: 'Name', value: 'Initial' } });
  const runtime = createGenUXRuntime({ scopeId: 'native-scope' });
  runtime.beginRequest('first-request');
  const seeded = runtime.applyBatch({
    requestId: 'first-request',
    sequence: 1,
    commands: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'records', catalogId: 'local://genux-cards/v1' },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'records',
          path: '/state',
          value: { one: record(), two: record() },
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'records',
          components: [{ id: 'root', component: 'GenUXInput', payload: { path: '/state/one' } }],
        },
      },
    ],
  });
  assert.equal(seeded.ok, true, seeded.error);
  runtime.finishRequest('first-request', 'success');
  const ready = runtime.getSnapshot();
  assert.equal(ready.status, 'success');
  const { generation } = ready.surfaces[0];
  assert.equal(
    runtime.changeNativeValue('records', 'root', 'Draft', generation, ready.revision).ok,
    true,
  );
  assert.equal(runtime.getSnapshot().surfaces[0].blocks.root.native.value, 'Draft');

  runtime.beginRequest('second-request');
  const rebound = runtime.applyBatch({
    requestId: 'second-request',
    sequence: 1,
    commands: [
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'records',
          components: [{ id: 'root', component: 'GenUXInput', payload: { path: '/state/two' } }],
        },
      },
    ],
  });
  assert.equal(rebound.ok, true, rebound.error);
  runtime.finishRequest('second-request', 'success');
  const after = runtime.getSnapshot();
  assert.equal(after.status, 'success');
  const surface = after.surfaces[0];
  assert.equal(surface.generation, generation);
  assert.deepEqual(surface.components[0].payload, { path: '/state/two' });
  assert.equal(surface.blocks.root.native.value, 'Initial');
  assert.deepEqual(surface.data.state.two, record());
  assert.deepEqual(surface.data.state.one, record());
});

// Regression for an observed defect (explicit one-case exception to the frozen scope):
// the catalog imported every adapter eagerly, so a native widget's stylesheet was neither
// split into its own chunk nor delivered with that widget. Bundler asset ownership only;
// this does not prove browser network delivery or layout.
test('each native adapter is a lazy chunk whose static CSS closure owns its stylesheet', async () => {
  const { build: viteBuild } = await import('vite');
  const path = await import('node:path');
  const input = path.resolve('docs/src/react/genux/native-catalog.tsx');
  const result = await viteBuild({
    configFile: false,
    root: process.cwd(),
    publicDir: false,
    logLevel: 'silent',
    esbuild: { jsx: 'automatic' },
    build: {
      write: false,
      manifest: true,
      cssCodeSplit: true,
      minify: false,
      rollupOptions: {
        input,
        // Packages are outside the local asset ownership under test.
        external: id => !id.startsWith('.') && !path.isAbsolute(id) && !id.startsWith('\0'),
      },
    },
  });
  const output = [result].flat().flatMap(bundle => bundle.output);
  const asset = fileName => output.find(item => item.fileName === fileName);
  const manifestAsset = asset('.vite/manifest.json');
  assert.ok(manifestAsset, 'Vite emitted no .vite/manifest.json');
  const manifest = JSON.parse(String(manifestAsset.source));
  const entryOf = match => {
    const key = Object.keys(manifest).find(item => item.includes(match));
    return key && manifest[key];
  };
  // Static import closure only; dynamic imports are loaded on demand.
  const cssClosure = (chunk, seen = new Set()) => {
    const files = [...(chunk.css ?? [])];
    for (const key of chunk.imports ?? []) {
      if (seen.has(key)) continue;
      seen.add(key);
      files.push(...cssClosure(manifest[key], seen));
    }
    return [...new Set(files)];
  };
  const cssText = files => files.map(file => String(asset(file)?.source ?? '')).join('\n');

  const catalog = entryOf('genux/native-catalog.');
  assert.ok(catalog?.isEntry, 'native catalog is not a manifest entry');
  const cascader = entryOf('genux/native/cascader.');
  assert.equal(cascader?.isDynamicEntry, true, 'Cascader adapter is not a dynamic entry');
  const avatar = entryOf('genux/native/avatar.');
  assert.equal(avatar?.isDynamicEntry, true, 'Avatar adapter is not a dynamic entry');

  const cascaderCss = cssClosure(cascader);
  assert.match(cascaderCss.length ? cssText(cascaderCss) : '', /\.genux-cascader/);
  // Vite legitimately shares GenUXAvatar CSS with AvatarGroup through a static import.
  const avatarOwn = cssClosure(avatar);
  assert.match(cssText(avatarOwn), /\.genux-avatar/, 'Avatar static closure has no stylesheet');

  const catalogCss = cssClosure(catalog);
  assert.doesNotMatch(cssText(catalogCss), /\.genux-cascader/);
  for (const file of avatarOwn) {
    assert.equal(catalogCss.includes(file), false, `catalog entry eagerly loads ${file}`);
    assert.equal(cascaderCss.includes(file), false, `Cascader chunk loads Avatar ${file}`);
  }
});

// Regression for an observed defect (explicit one-case exception to the frozen scope):
// changeNativeValue validated each edit against the original host source, so a disabled
// option the host had selected could be removed locally and then selected again.
test('a disabled GenUXSelect option removed locally cannot be re-added by a later native edit', async () => {
  const bundled = await build({
    entryPoints: ['docs/src/genux/runtime.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { createGenUXRuntime } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
  const runtime = createGenUXRuntime({ scopeId: 'native-scope' });
  runtime.beginRequest('select-request');
  const accepted = runtime.applyBatch({
    requestId: 'select-request',
    sequence: 1,
    commands: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'records', catalogId: 'local://genux-cards/v1' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'records',
          components: [
            {
              id: 'root',
              component: 'GenUXSelect',
              payload: {
                title: 'Team',
                native: {
                  label: 'Team',
                  options: [
                    { id: 'design', label: 'Design' },
                    { id: 'archived', label: 'Archived', disabled: true },
                  ],
                  value: 'archived',
                },
              },
            },
          ],
        },
      },
    ],
  });
  assert.equal(accepted.ok, true, accepted.error);
  runtime.finishRequest('select-request', 'success');
  const ready = runtime.getSnapshot();
  assert.equal(ready.status, 'success');
  const { generation } = ready.surfaces[0];
  assert.equal(ready.surfaces[0].blocks.root.native.value, 'archived');

  const removed = runtime.changeNativeValue(
    'records',
    'root',
    'design',
    generation,
    ready.revision,
  );
  assert.equal(removed.ok, true, removed.error);
  const changed = runtime.getSnapshot();
  assert.equal(changed.surfaces[0].blocks.root.native.value, 'design');

  assert.equal(
    runtime.changeNativeValue('records', 'root', 'archived', generation, changed.revision).ok,
    false,
  );
  const after = runtime.getSnapshot();
  assert.equal(after.revision, changed.revision);
  assert.equal(after.surfaces[0].blocks.root.native.value, 'design');
  assert.equal(after.surfaces[0].components[0].payload.native.value, 'archived');
});

// Regression for an observed defect (explicit one-case exception to the frozen scope):
// the shared JSON guard accepted sparse arrays, so a multiple Select value of
// new Array(1) passed schema iteration and was stored, serializing as [null].
test('the shared JSON guard rejects sparse arrays, so a holed GenUXSelect selection is not accepted', async () => {
  const policy = await build({
    entryPoints: ['docs/src/genux/policy.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { assertPlainJSON } = await import(
    'data:text/javascript;base64,' + Buffer.from(policy.outputFiles[0].text).toString('base64')
  );
  assert.throws(() => assertPlainJSON(new Array(1)), /Sparse arrays are not accepted/);
  assert.throws(
    () => assertPlainJSON({ value: ['design', , 'operations'] }),
    /Sparse arrays are not accepted/,
  );
  assert.doesNotThrow(() => assertPlainJSON({ value: ['design', null, 'operations'] }));

  const bundled = await build({
    entryPoints: ['docs/src/genux/runtime.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { createGenUXRuntime } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
  const runtime = createGenUXRuntime({ scopeId: 'native-scope' });
  runtime.beginRequest('sparse-request');
  const accepted = runtime.applyBatch({
    requestId: 'sparse-request',
    sequence: 1,
    commands: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'records', catalogId: 'local://genux-cards/v1' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'records',
          components: [
            {
              id: 'root',
              component: 'GenUXSelect',
              payload: {
                title: 'Teams',
                native: {
                  label: 'Teams',
                  multiple: true,
                  options: [
                    { id: 'design', label: 'Design' },
                    { id: 'operations', label: 'Operations' },
                  ],
                  value: ['design'],
                },
              },
            },
          ],
        },
      },
    ],
  });
  assert.equal(accepted.ok, true, accepted.error);
  runtime.finishRequest('sparse-request', 'success');
  const ready = runtime.getSnapshot();
  const { generation } = ready.surfaces[0];
  assert.equal(
    runtime.changeNativeValue('records', 'root', new Array(1), generation, ready.revision).ok,
    false,
  );
  const after = runtime.getSnapshot();
  assert.equal(after.revision, ready.revision);
  assert.deepEqual(after.surfaces[0].blocks.root.native.value, ['design']);
});

// Regression for an observed defect (explicit one-case exception to the frozen scope):
// a rejected frame after a valid one left the stream finishable as success, so native
// edits were permitted on a surface that never received that frame.
test('finishing a stream as success with an unresolved rejected frame ends in error until a replacement frame is accepted', async () => {
  const bundled = await build({
    entryPoints: ['docs/src/genux/runtime.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { createGenUXRuntime } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
  const stream = (requestId, replace) => {
    const runtime = createGenUXRuntime({ scopeId: 'native-scope' });
    runtime.beginRequest(requestId);
    const first = runtime.applyBatch({
      requestId,
      sequence: 1,
      commands: [
        {
          version: 'v0.9',
          createSurface: { surfaceId: 'records', catalogId: 'local://genux-cards/v1' },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'records',
            components: [
              {
                id: 'root',
                component: 'GenUXInput',
                payload: { title: 'Name', native: { label: 'Name', value: 'Initial' } },
              },
            ],
          },
        },
      ],
    });
    assert.equal(first.ok, true, first.error);
    const rejected = runtime.applyBatch({
      requestId,
      sequence: 2,
      commands: [
        {
          version: 'v0.9',
          updateDataModel: { surfaceId: 'missing', path: '/state/note', value: 'x' },
        },
      ],
    });
    assert.equal(rejected.ok, false);
    if (replace) {
      const replacement = runtime.applyBatch({
        requestId,
        sequence: 2,
        commands: [
          {
            version: 'v0.9',
            updateDataModel: { surfaceId: 'records', path: '/state/note', value: 'x' },
          },
        ],
      });
      assert.equal(replacement.ok, true, replacement.error);
    }
    runtime.finishRequest(requestId, 'success');
    return runtime;
  };

  const unresolved = stream('rejected-request', false);
  const failed = unresolved.getSnapshot();
  assert.equal(failed.status, 'error');
  assert.ok(failed.error);
  assert.equal(
    unresolved.changeNativeValue(
      'records',
      'root',
      'Changed',
      failed.surfaces[0].generation,
      failed.revision,
    ).ok,
    false,
  );
  assert.equal(unresolved.getSnapshot().surfaces[0].blocks.root.native.value, 'Initial');

  const replaced = stream('replaced-request', true);
  const ready = replaced.getSnapshot();
  assert.equal(ready.status, 'success');
  assert.equal(
    replaced.changeNativeValue(
      'records',
      'root',
      'Changed',
      ready.surfaces[0].generation,
      ready.revision,
    ).ok,
    true,
  );
});

// Regression for an observed defect (explicit one-case exception to the frozen scope):
// the shared JSON guard accepted non-enumerable own properties, which Object.keys and
// structuredClone then dropped, so a hidden disabled: true left GenUXInput editable.
test('the shared JSON guard rejects non-enumerable own properties, so a hidden GenUXInput disabled flag is not dropped', async () => {
  const bundled = await build({
    stdin: {
      contents:
        "export { definition } from './docs/src/genux/native/input.ts'; export { assertPlainJSON, validateTaskBlock } from './docs/src/genux/policy.ts';",
      resolveDir: process.cwd(),
      sourcefile: 'nonenumerable-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { definition, assertPlainJSON, validateTaskBlock } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
  const hidden = () =>
    Object.defineProperty({ label: 'Name', value: 'Initial' }, 'disabled', {
      value: true,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  assert.throws(() => definition.parse(hidden()), /Non-enumerable properties are not accepted/);
  assert.throws(
    () => validateTaskBlock('GenUXInput', { title: 'Name', native: hidden() }),
    /Non-enumerable properties are not accepted/,
  );

  const visible = validateTaskBlock('GenUXInput', {
    title: 'Name',
    native: { label: 'Name', value: 'Initial', disabled: true },
  });
  assert.deepEqual(visible.native, { label: 'Name', value: 'Initial', disabled: true });
  assert.throws(
    () => definition.withValue(visible.native, 'Changed'),
    /GenUXInput is not editable/,
  );

  const hiddenIndex = Object.defineProperty(['design', 'operations'], '1', { enumerable: false });
  assert.throws(() => assertPlainJSON(hiddenIndex), /Non-enumerable properties are not accepted/);
  const named = Object.defineProperty(['design'], 'extra', { value: 'x', enumerable: false });
  assert.throws(() => assertPlainJSON(named));
  assert.doesNotThrow(() => assertPlainJSON({ value: ['design', 'operations'] }));
});
