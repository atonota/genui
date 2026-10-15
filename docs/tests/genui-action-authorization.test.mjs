import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

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

const form = {
  id: 'root',
  component: 'AtlasForm',
  payload: {
    title: 'Order review',
    fields: [{ key: 'note', label: 'Review note', value: 'Ready to ship', required: true }],
    action: { id: 'create-order', label: 'Create order', intent: 'create' },
  },
};

test('host action authorization denies by default and binds write intents to an exact trusted review', async () => {
  // The capability must be public from the current core index before any scenario runs.
  const core = await load('docs/src/genui/index.ts');
  assert.equal(typeof core.createActionAuthorization, 'function', 'core exports authorization');
  assert.equal(typeof core.createAuthorizedActionHandler, 'function', 'core exports the handler');
  const { createActionAuthorization, createAuthorizedActionHandler } = core;
  const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');

  let handle = () => {
    throw new Error('No handler installed.');
  };
  const runtime = createGenUIRuntime({
    scopeId: 'authz-scope',
    onAction: (action, model) => handle(action, model),
  });
  runtime.beginRequest('authz-request');
  assert.equal(
    runtime.applyBatch({
      requestId: 'authz-request',
      sequence: 1,
      commands: [
        {
          version: 'v0.9',
          createSurface: { surfaceId: 'orders', catalogId: 'local://atlas-cards/v1' },
        },
        { version: 'v0.9', updateComponents: { surfaceId: 'orders', components: [form] } },
      ],
    }).ok,
    true,
  );
  runtime.finishRequest('authz-request', 'success');

  const executed = [];
  const execute = context => {
    executed.push(context);
  };
  let key = 0;
  const dispatch = () =>
    runtime.dispatchAction({
      surfaceId: 'orders',
      componentId: 'root',
      actionId: 'create-order',
      baseRevision: runtime.getSnapshot().revision,
      idempotencyKey: `authz-${++key}`,
    });

  // No trusted authorize callback: denied before the host callback.
  handle = createAuthorizedActionHandler({
    authorization: createActionAuthorization({ runtime }),
    execute,
  });
  assert.equal(dispatch().ok, false);
  assert.equal(executed.length, 0);
  assert.equal(runtime.getSnapshot().actionResult, null);

  // A trusted allow alone does not execute a write intent without an approved review.
  let review;
  const lookups = [];
  handle = createAuthorizedActionHandler({
    authorization: createActionAuthorization({
      runtime,
      authorize: () => true,
      getReview: context => {
        lookups.push(context);
        return review;
      },
    }),
    execute,
  });
  assert.equal(dispatch().ok, false);
  assert.equal(executed.length, 0);
  const context = lookups.at(-1);
  assert.ok(context, 'review lookup receives the resolved context');
  const snapshot = runtime.getSnapshot();
  const surface = snapshot.surfaces.find(item => item.id === 'orders');
  assert.equal(context.scopeId, 'authz-scope');
  assert.equal(context.audience, 'panel');
  assert.equal(context.generation, surface.generation);
  assert.equal(context.revision, snapshot.revision);
  assert.equal(context.intent, 'create');
  assert.equal(context.reviewId, null);
  assert.ok(Object.isFrozen(context) && Object.isFrozen(context.model));
  // Bindings carry the actual validated model and the whole published surface.
  assert.deepEqual(JSON.parse(context.modelJSON), surface.blocks.root);
  assert.deepEqual(JSON.parse(context.surfaceJSON), surface);

  const binding = overrides => ({
    id: 'review-1',
    scopeId: 'authz-scope',
    surfaceId: 'orders',
    componentId: 'root',
    actionId: 'create-order',
    generation: surface.generation,
    revision: snapshot.revision,
    modelJSON: context.modelJSON,
    surfaceJSON: context.surfaceJSON,
    approved: true,
    ...overrides,
  });
  for (const fake of [
    { approved: false },
    { revision: snapshot.revision - 1 },
    { scopeId: 'other-scope' },
    { actionId: 'other-action' },
    { surfaceJSON: JSON.stringify({ ...surface, data: { state: { forged: true } } }) },
  ]) {
    review = binding(fake);
    assert.equal(dispatch().ok, false, `fake binding ${Object.keys(fake)[0]} is denied`);
    assert.equal(executed.length, 0);
  }

  // Trusted allow plus the exact approved binding runs the host callback once.
  review = binding({});
  assert.deepEqual(dispatch(), { ok: true });
  assert.equal(executed.length, 1);
  const [authorized] = executed;
  assert.equal(authorized.reviewId, 'review-1');
  assert.equal(authorized.intent, 'create');
  assert.equal(authorized.action.idempotencyKey, `authz-${key}`);
  assert.ok(Object.isFrozen(authorized));
  assert.notEqual(runtime.getSnapshot().actionResult, null);

  // A draft edit changes the reviewed surface: the earlier approval is stale.
  assert.equal(runtime.patchField('orders', 'root', 'note', 'Hold for customer').ok, true);
  assert.equal(dispatch().ok, false);
  review = binding({ revision: runtime.getSnapshot().revision });
  assert.equal(dispatch().ok, false);
  assert.equal(executed.length, 1);
});

test('a host review policy can add review but cannot waive the mandatory write review', async () => {
  const { createActionAuthorization, createAuthorizedActionHandler } =
    await load('docs/src/genui/index.ts');
  const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
  let handle = () => {
    throw new Error('No handler installed.');
  };
  const runtime = createGenUIRuntime({
    scopeId: 'waive-scope',
    onAction: (action, model) => handle(action, model),
  });
  runtime.beginRequest('waive-request');
  assert.equal(
    runtime.applyBatch({
      requestId: 'waive-request',
      sequence: 1,
      commands: [
        {
          version: 'v0.9',
          createSurface: { surfaceId: 'orders', catalogId: 'local://atlas-cards/v1' },
        },
        { version: 'v0.9', updateComponents: { surfaceId: 'orders', components: [form] } },
      ],
    }).ok,
    true,
  );
  runtime.finishRequest('waive-request', 'success');

  const executed = [];
  const lookups = [];
  let review;
  handle = createAuthorizedActionHandler({
    authorization: createActionAuthorization({
      runtime,
      authorize: () => true,
      requiresReview: () => false,
      getReview: context => {
        lookups.push(context);
        return review;
      },
    }),
    execute: context => {
      executed.push(context);
    },
  });
  let key = 0;
  const dispatch = () =>
    runtime.dispatchAction({
      surfaceId: 'orders',
      componentId: 'root',
      actionId: 'create-order',
      baseRevision: runtime.getSnapshot().revision,
      idempotencyKey: `waive-${++key}`,
    });

  // A false host review policy on a create intent still requires an approved binding.
  assert.equal(dispatch().ok, false);
  assert.equal(executed.length, 0);
  const context = lookups.at(-1);
  assert.ok(context, 'the mandatory write review is looked up');
  review = {
    id: 'review-write',
    scopeId: 'waive-scope',
    surfaceId: 'orders',
    componentId: 'root',
    actionId: 'create-order',
    generation: context.generation,
    revision: context.revision,
    modelJSON: context.modelJSON,
    surfaceJSON: context.surfaceJSON,
    approved: true,
  };
  assert.deepEqual(dispatch(), { ok: true });
  assert.equal(executed.length, 1);
  assert.equal(executed[0].reviewId, 'review-write');
});

test('create and review readiness includes required native values and typed native drafts', async () => {
  const { createActionAuthorization, createAuthorizedActionHandler } =
    await load('docs/src/genui/index.ts');
  const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
  let handle = () => {
    throw new Error('No handler installed.');
  };
  const runtime = createGenUIRuntime({
    scopeId: 'ready-scope',
    onAction: (action, model) => handle(action, model),
  });
  const accountForm = {
    title: 'Account draft',
    fields: [
      { key: 'name', label: 'Account name', kind: 'text', required: true },
      { key: 'owner', label: 'Owner', kind: 'text' },
    ],
    record: { id: 'account-1', name: 'Aster Labs', owner: 'Ada Lovelace' },
    value: { id: 'account-1', name: 'Aster Labs', owner: 'Ada Lovelace' },
  };
  runtime.beginRequest('ready-request');
  assert.equal(
    runtime.applyBatch({
      requestId: 'ready-request',
      sequence: 1,
      commands: [
        {
          version: 'v0.9',
          createSurface: { surfaceId: 'notes', catalogId: 'local://atlas-cards/v1' },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'notes',
            components: [
              { id: 'root', component: 'AtlasStack', children: ['note', 'account'] },
              {
                id: 'note',
                component: 'AtlasInput',
                payload: {
                  title: 'Dispatch note',
                  native: { label: 'Dispatch note', value: '', required: true },
                  action: { id: 'review-note', label: 'Review note', intent: 'review' },
                },
              },
              {
                id: 'account',
                component: 'AtlasRecordForm',
                payload: { title: 'Account draft', native: accountForm },
              },
            ],
          },
        },
      ],
    }).ok,
    true,
  );
  runtime.finishRequest('ready-request', 'success');
  assert.equal(runtime.getSnapshot().status, 'success');

  const authorization = createActionAuthorization({ runtime, authorize: () => true });
  const executed = [];
  handle = createAuthorizedActionHandler({
    authorization,
    execute: context => {
      executed.push(context);
    },
  });
  let key = 0;
  const action = () => ({
    surfaceId: 'notes',
    componentId: 'note',
    actionId: 'review-note',
    baseRevision: runtime.getSnapshot().revision,
    idempotencyKey: `ready-${++key}`,
  });
  const block = () => runtime.getSnapshot().surfaces[0].blocks.note;
  const edit = (componentId, value) => {
    const snapshot = runtime.getSnapshot();
    return runtime.changeNativeValue(
      'notes',
      componentId,
      value,
      snapshot.surfaces[0].generation,
      snapshot.revision,
    );
  };

  // An empty required native input blocks authorization and dispatch before any host write.
  assert.throws(() => authorization.authorize(action(), block()), /required native fields/);
  assert.equal(runtime.dispatchAction(action()).ok, false);
  assert.equal(executed.length, 0);
  assert.equal(runtime.getSnapshot().actionResult, null);

  // A valid local edit makes the same action available.
  assert.equal(edit('note', 'Ship today').ok, true);
  assert.deepEqual(runtime.dispatchAction(action()), { ok: true });
  assert.equal(executed.length, 1);

  // A schema-allowed but domain-invalid native form draft blocks it again.
  assert.equal(edit('account', { id: 'account-1', name: '', owner: 'Ada Lovelace' }).ok, true);
  assert.throws(() => authorization.authorize(action(), block()), /required native fields/);
  assert.equal(runtime.dispatchAction(action()).ok, false);
  assert.equal(executed.length, 1);
});
