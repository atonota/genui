import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
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
const catalog = 'local://genux-cards/v1';
const model = {
  id: 'record-one',
  kind: 'entity',
  title: 'Aster Workshop',
  primaryAction: { id: 'inspect', label: 'Inspect record', intent: 'inspect' },
};
const create = { version: 'v0.9', createSurface: { surfaceId: 'records', catalogId: catalog } };
const update = nodes => ({
  version: 'v0.9',
  updateComponents: { surfaceId: 'records', components: nodes },
});
const data = (path, value) => ({
  version: 'v0.9',
  updateDataModel: { surfaceId: 'records', path, value },
});
const baseline = () => {
  const runtime = createGenUXRuntime({ scopeId: 'test-scope' });
  runtime.beginRequest('request-one');
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-one',
      sequence: 1,
      commands: [create, update([{ id: 'root', component: 'GenUXEntityCard', model }])],
    }).ok,
    true,
  );
  return runtime;
};

test('validation rejects unsafe commands atomically and never evaluates accessors', () => {
  for (const bad of [
    [{ version: 'v0.8', deleteSurface: { surfaceId: 'records' } }],
    [data('/state/constructor/polluted', true)],
    [update([{ id: 'root', component: 'ArbitraryCode', model }])],
    [update([{ id: 'root', component: 'GenUXEntityCard', model, style: { width: 1 } }])],
    [update([{ id: 'root', component: 'GenUXEntityCard', model: { ...model, title: 9 } }])],
    [update([{ id: 'root', component: 'GenUXStack', children: ['root'] }])],
    [data('/state/new', true), update([{ id: 'other', component: 'Bad' }])],
    [
      update([
        {
          id: 'root',
          component: 'GenUXTaskSurface',
          payload: { title: 'Task', intent: 'query' },
          children: ['card'],
        },
        { id: 'card', component: 'GenUXEntityCard', model },
      ]),
    ],
  ]) {
    const runtime = baseline();
    const before = runtime.getSnapshot().surfaces;
    const result = runtime.applyBatch({ requestId: 'request-one', sequence: 2, commands: bad });
    assert.equal(result.ok, false);
    assert.equal(runtime.getSnapshot().surfaces, before);
    assert.equal(runtime.getSnapshot().sequence, 1);
  }
  let accessed = false;
  const value = {
    version: 'v0.9',
    updateDataModel: { surfaceId: 'records', path: '/state/x', value: {} },
  };
  Object.defineProperty(value.updateDataModel.value, 'secret', {
    enumerable: true,
    get() {
      accessed = true;
      throw new Error('must not read');
    },
  });
  assert.equal(
    baseline().applyBatch({ requestId: 'request-one', sequence: 2, commands: [value] }).ok,
    false,
  );
  assert.equal(accessed, false);
  assert.equal({}.polluted, undefined);
});

test('stale responses are pure no-ops; duplicate and out-of-order frames cannot commit', () => {
  const runtime = baseline();
  runtime.beginRequest('request-two');
  const snapshot = runtime.getSnapshot();
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-one',
      sequence: 2,
      commands: [data('/state/x', 'late')],
    }).ok,
    false,
  );
  assert.equal(runtime.getSnapshot(), snapshot);
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-two',
      sequence: 2,
      commands: [data('/state/x', 'skip')],
    }).ok,
    false,
  );
  assert.equal(runtime.getSnapshot().surfaces, snapshot.surfaces);
});

test('staged incomplete graphs preserve published data and recover on the next request', () => {
  const runtime = baseline();
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-one',
      sequence: 2,
      commands: [
        update([{ id: 'root', component: 'GenUXEntityCard', model: { path: '/state/card' } }]),
      ],
    }).ok,
    true,
  );
  assert.equal(runtime.getSnapshot().surfaces[0].models.root.title, model.title);
  runtime.finishRequest('request-one', 'success');
  assert.equal(runtime.getSnapshot().status, 'error');
  runtime.beginRequest('request-two');
  assert.equal(runtime.getSnapshot().surfaces[0].models.root.title, model.title);
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-two',
      sequence: 1,
      commands: [data('/state/note', 'fresh')],
    }).ok,
    true,
  );
  runtime.finishRequest('request-two', 'success');
  assert.equal(runtime.getSnapshot().status, 'success');
});

test('draft edits survive unrelated model updates; readonly fields reject edits; deletion recreates a new lifecycle', () => {
  const runtime = createGenUXRuntime({ scopeId: 'draft-scope' });
  runtime.beginRequest('request-one');
  const form = {
    id: 'form-one',
    kind: 'form',
    title: 'Review',
    fields: [
      { key: 'note', label: 'Note', value: 'Original' },
      { key: 'source', label: 'Source', value: 'ERP', readOnly: true },
    ],
  };
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-one',
      sequence: 1,
      commands: [
        create,
        update([{ id: 'root', component: 'GenUXPurposeCard', model: { path: '/state/card' } }]),
        data('/state/card', form),
      ],
    }).ok,
    true,
  );
  assert.equal(runtime.patchField('records', 'root', 'note', 'User draft').ok, true);
  assert.equal(runtime.patchField('records', 'root', 'source', 'forged').ok, false);
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-one',
      sequence: 2,
      commands: [data('/state/unrelated', 'changed')],
    }).ok,
    true,
  );
  assert.equal(runtime.getSnapshot().surfaces[0].models.root.fields[0].value, 'User draft');
  const generation = runtime.getSnapshot().surfaces[0].generation;
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-one',
      sequence: 3,
      commands: [
        { version: 'v0.9', deleteSurface: { surfaceId: 'records' } },
        create,
        update([{ id: 'root', component: 'GenUXEntityCard', model }]),
      ],
    }).ok,
    true,
  );
  assert.equal(runtime.getSnapshot().surfaces[0].generation, generation + 1);
  assert.deepEqual(runtime.getSnapshot().surfaces[0].draftFields, {});
});

test('actions require current capability/revision, deduplicate and never replay a failed host callback', () => {
  const runtime = baseline();
  runtime.finishRequest('request-one', 'success');
  const action = {
    surfaceId: 'records',
    componentId: 'root',
    actionId: 'inspect',
    baseRevision: runtime.getSnapshot().revision,
    idempotencyKey: 'once',
  };
  assert.equal(runtime.dispatchAction({ ...action, actionId: 'delete-server' }).ok, false);
  assert.equal(runtime.dispatchAction({ ...action, baseRevision: 0 }).ok, false);
  assert.equal(runtime.dispatchAction(action).ok, true);
  assert.equal(runtime.dispatchAction(action).ok, false);
  let calls = 0;
  const failing = createGenUXRuntime({
    scopeId: 'failure-scope',
    onAction() {
      calls++;
      throw new Error('unknown outcome');
    },
  });
  failing.beginRequest('request-one');
  failing.applyBatch({
    requestId: 'request-one',
    sequence: 1,
    commands: [create, update([{ id: 'root', component: 'GenUXEntityCard', model }])],
  });
  failing.finishRequest('request-one', 'success');
  const request = { ...action, baseRevision: failing.getSnapshot().revision };
  assert.equal(failing.dispatchAction(request).ok, false);
  assert.equal(failing.dispatchAction(request).ok, false);
  assert.equal(calls, 1);
});

test('public audience cannot use panel catalogs or mutable cards and does not authorize a server', () => {
  const runtime = createGenUXRuntime({ scopeId: 'public-scope', audience: 'frontpage' });
  runtime.beginRequest('request-one');
  assert.equal(
    runtime.applyBatch({ requestId: 'request-one', sequence: 1, commands: [create] }).ok,
    false,
  );
  const publicCreate = {
    version: 'v0.9',
    createSurface: { surfaceId: 'records', catalogId: 'local://genux-cards/public/v1' },
  };
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-one',
      sequence: 1,
      commands: [
        publicCreate,
        update([
          {
            id: 'root',
            component: 'GenUXEntityCard',
            model: {
              ...model,
              primaryAction: { id: 'change', label: 'Change price', intent: 'create' },
            },
          },
        ]),
      ],
    }).ok,
    false,
  );
  assert.equal(runtime.getSnapshot().surfaces.length, 0);
});

test('delete then restore then update rebuilds native lifetime accounting coherently', () => {
  const runtime = baseline();
  const revision = runtime.getSnapshot().revision;
  const generation = runtime.getSnapshot().surfaces[0].generation;
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-one',
      sequence: 2,
      commands: [{ version: 'v0.9', deleteSurface: { surfaceId: 'records' } }],
    }).ok,
    true,
  );
  assert.equal(runtime.getSnapshot().surfaces.length, 0);
  assert.equal(runtime.restoreRevision(revision).ok, true);
  assert.ok(runtime.getSnapshot().surfaces[0].generation > generation);
  runtime.beginRequest('request-two');
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-two',
      sequence: 1,
      commands: [
        update([
          {
            id: 'root',
            component: 'GenUXEntityCard',
            model: { ...model, title: 'Restored and updated' },
          },
        ]),
      ],
    }).ok,
    true,
  );
  assert.equal(runtime.getSnapshot().surfaces[0].models.root.title, 'Restored and updated');
});

test('error Cards allow only an explicitly registered retry, once per action key', () => {
  let calls = 0;
  const runtime = createGenUXRuntime({
    scopeId: 'retry-scope',
    onAction() {
      calls++;
    },
  });
  runtime.beginRequest('retry-request');
  assert.equal(
    runtime.applyBatch({
      requestId: 'retry-request',
      sequence: 1,
      commands: [
        create,
        update([
          {
            id: 'root',
            component: 'GenUXEntityCard',
            model: {
              ...model,
              state: 'error',
              primaryAction: { id: 'recover', intent: 'retry', label: 'Retry' },
              secondaryActions: [model.primaryAction],
            },
          },
        ]),
      ],
    }).ok,
    true,
  );
  runtime.finishRequest('retry-request', 'success');
  const request = {
    surfaceId: 'records',
    componentId: 'root',
    actionId: 'recover',
    baseRevision: runtime.getSnapshot().revision,
    idempotencyKey: 'recover-once',
  };
  assert.equal(
    runtime.dispatchAction({ ...request, actionId: 'inspect', idempotencyKey: 'inspect-error' }).ok,
    false,
  );
  assert.equal(runtime.dispatchAction(request).ok, true);
  assert.equal(runtime.dispatchAction(request).ok, false);
  assert.equal(calls, 1);
});

test('task selection copies caller arrays before unrelated updates materialize them', () => {
  const runtime = createGenUXRuntime({ scopeId: 'immutable-scope' });
  runtime.beginRequest('immutable-request');
  const nodes = [
    {
      id: 'root',
      component: 'GenUXTaskSurface',
      payload: { title: 'Review', intent: 'query' },
      children: ['table', 'choice'],
    },
    {
      id: 'table',
      component: 'GenUXCollection',
      payload: {
        title: 'Rows',
        columns: [{ key: 'name', label: 'Name' }],
        rows: [
          { id: 'one', name: 'One' },
          { id: 'two', name: 'Two' },
        ],
        selection: [],
      },
    },
    {
      id: 'choice',
      component: 'GenUXChoice',
      payload: {
        title: 'Choices',
        options: [
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
        ],
        multiple: true,
        value: [],
      },
    },
  ];
  assert.equal(
    runtime.applyBatch({
      requestId: 'immutable-request',
      sequence: 1,
      commands: [create, update(nodes)],
    }).ok,
    true,
  );
  const table = ['one'];
  const choice = ['two'];
  assert.equal(runtime.chooseValue('records', 'table', table).ok, true);
  assert.equal(runtime.chooseValue('records', 'choice', choice).ok, true);
  table.push('two');
  choice.push('one');
  assert.equal(
    runtime.applyBatch({
      requestId: 'immutable-request',
      sequence: 2,
      commands: [data('/state/unrelated', true)],
    }).ok,
    true,
  );
  assert.deepEqual(runtime.getSnapshot().surfaces[0].blocks.table.selection, ['one']);
  assert.deepEqual(runtime.getSnapshot().surfaces[0].blocks.choice.value, ['two']);
});
