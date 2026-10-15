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
const until = async (predicate, description) => {
  for (let turn = 0; turn < 100 && !predicate(); turn++)
    await new Promise(resolve => setImmediate(resolve));
  assert.ok(predicate(), description);
};

// Mock host unit proof only: it does not certify a backend, server authorization or live service.
test('action outcomes commit only on a verified receipt bound to the reviewed surface', async () => {
  const core = await load('docs/src/genui/index.ts');
  assert.equal(
    typeof core.createActionOutcomeController,
    'function',
    'core createActionOutcomeController export is missing',
  );
  const { createActionOutcomeController } = await load('docs/src/genui/actions/outcomes.ts');

  const scopeId = 'outcome-scope';
  const model = Object.freeze({ title: 'Order review', fields: [] });
  let authorizations = 0;
  const authorization = {
    authorize(action, value) {
      authorizations++;
      return Object.freeze({
        action: Object.freeze({ ...action }),
        model: value,
        scopeId,
        audience: 'panel',
        generation: 1,
        revision: action.baseRevision,
        intent: 'create',
        modelJSON: JSON.stringify(value),
        surfaceJSON: JSON.stringify({
          surfaceId: action.surfaceId,
          revision: action.baseRevision,
          blocks: { [action.componentId]: value },
        }),
        reviewId: null,
      });
    },
  };
  const action = (actionId, idempotencyKey) => ({
    surfaceId: 'orders',
    componentId: 'root',
    actionId,
    baseRevision: 4,
    idempotencyKey,
  });
  const receiptFor = (context, operationId, binding = context.surfaceJSON) => ({
    scopeId: context.scopeId,
    surfaceId: context.action.surfaceId,
    componentId: context.action.componentId,
    actionId: context.action.actionId,
    idempotencyKey: context.action.idempotencyKey,
    operationId,
    binding,
    state: 'committed',
  });

  // The durable host reservation lives outside the controller and survives a reload.
  const host = { reservations: new Map(), claims: 0, executes: [], authorizedAtExecute: [] };
  const claim = async context => {
    host.claims++;
    const key = context.action.idempotencyKey;
    const prior = host.reservations.get(key);
    if (prior) return prior.receipt ? { ...prior } : { operationId: prior.operationId };
    const reservation = { operationId: `op-${host.reservations.size + 1}` };
    host.reservations.set(key, reservation);
    return { operationId: reservation.operationId };
  };
  let release;
  let respond = () => undefined;
  const execute = async (context, operationId) => {
    host.executes.push(operationId);
    host.authorizedAtExecute.push(authorizations);
    await new Promise(resolve => {
      release = resolve;
    });
    const receipt = respond(context, operationId);
    if (receipt?.binding === context.surfaceJSON)
      host.reservations.get(context.action.idempotencyKey).receipt = receipt;
    return receipt;
  };
  // Accepts everything, so binding/identity rejection must come from the controller.
  const verifyReceipt = () => true;
  const options = { authorization, claim, execute, verifyReceipt };

  const controller = createActionOutcomeController(options);
  let notifications = 0;
  const unsubscribe = controller.subscribe(() => notifications++);

  const forged = action('approve-order', 'key-forged');
  const first = controller.submit(forged, model);
  const pending = controller.getSnapshot();
  assert.deepEqual(
    pending.map(item => [item.key, item.status, item.operationId]),
    [['key-forged', 'pending', null]],
  );
  assert.ok(Object.isFrozen(pending) && Object.isFrozen(pending[0]));
  assert.ok(notifications > 0);
  assert.equal(host.executes.length, 0);
  await until(() => host.executes.length === 1, 'host execution starts after claim');
  assert.equal(host.authorizedAtExecute[0], 2, 'authorized before claim and rechecked');

  assert.equal((await controller.submit(forged, model)).status, 'pending');
  const sibling = await controller.submit(action('approve-order', 'key-forged-2'), model);
  assert.equal(sibling.status, 'failed');
  assert.equal(sibling.operationId, null);
  assert.equal(host.claims, 1);
  assert.equal(host.executes.length, 1);

  // A fulfilled callback whose receipt names another payload is not a commit.
  respond = (context, operationId) => receiptFor(context, operationId, '{"surfaceId":"orders"}');
  release();
  const forgedOutcome = await first;
  assert.equal(forgedOutcome.status, 'unknown');
  assert.equal(forgedOutcome.operationId, 'op-1');
  assert.equal(forgedOutcome.receipt, undefined);
  const blocked = await controller.submit(action('approve-order', 'key-forged-3'), model);
  assert.equal(blocked.status, 'failed');
  assert.equal(host.claims, 1);
  assert.equal(host.executes.length, 1, 'no automatic retry');

  respond = (context, operationId) => receiptFor(context, operationId);
  const create = action('create-order', 'key-create');
  const committed = controller.submit(create, model);
  await until(() => host.executes.length === 2, 'second host execution starts');
  release();
  const success = await committed;
  assert.equal(success.status, 'succeeded');
  assert.equal(success.operationId, 'op-2');
  assert.deepEqual(success.receipt, receiptFor(authorization.authorize(create, model), 'op-2'));
  assert.equal((await controller.submit(create, model)).status, 'succeeded');
  assert.equal(host.executes.length, 2);
  unsubscribe();
  controller.dispose();

  // After a reload the host replays its verified receipt; execution is skipped.
  const reloaded = createActionOutcomeController(options);
  const replay = await reloaded.submit(create, model);
  assert.equal(replay.status, 'succeeded');
  assert.equal(replay.operationId, 'op-2');
  assert.equal(host.executes.length, 2);
  reloaded.dispose();
});

test('a cached outcome is reused only for the exact freshly authorized context', async () => {
  const { createActionOutcomeController } = await load('docs/src/genui/actions/outcomes.ts');
  const state = { scopeId: 'cache-scope', payload: 'v1', deny: false };
  const model = Object.freeze({ title: 'Order review', fields: [] });
  const authorization = {
    authorize(action, value) {
      if (state.deny) throw new Error('Action authorization denied.');
      return Object.freeze({
        action: Object.freeze({ ...action }),
        model: value,
        scopeId: state.scopeId,
        audience: 'panel',
        generation: 1,
        revision: action.baseRevision,
        intent: 'create',
        modelJSON: JSON.stringify(value),
        surfaceJSON: JSON.stringify({ surfaceId: action.surfaceId, payload: state.payload }),
        reviewId: null,
      });
    },
  };
  const host = { claims: 0, executes: 0 };
  const controller = createActionOutcomeController({
    authorization,
    claim: async () => ({ operationId: `op-cache-${++host.claims}` }),
    execute: async (context, operationId) => {
      host.executes++;
      return {
        scopeId: context.scopeId,
        surfaceId: context.action.surfaceId,
        componentId: context.action.componentId,
        actionId: context.action.actionId,
        idempotencyKey: context.action.idempotencyKey,
        operationId,
        binding: context.surfaceJSON,
        state: 'committed',
      };
    },
    verifyReceipt: () => true,
  });
  const submission = (baseRevision = 4) => ({
    surfaceId: 'orders',
    componentId: 'root',
    actionId: 'create-order',
    baseRevision,
    idempotencyKey: 'key-cache',
  });
  const refusedFor = async (label, input = submission()) => {
    const outcome = await controller.submit(input, model);
    assert.equal(outcome.status, 'failed', label);
    assert.equal(outcome.operationId, null, label);
    assert.equal(outcome.receipt, undefined, label);
  };

  const success = await controller.submit(submission(), model);
  assert.equal(success.status, 'succeeded');
  assert.equal(await controller.submit(submission(), model), success, 'exact resubmission');

  // The same key after a scope, surface payload or revision change is not the cached commit.
  state.scopeId = 'other-scope';
  await refusedFor('changed scope');
  state.scopeId = 'cache-scope';
  state.payload = 'v2';
  await refusedFor('changed surface binding');
  state.payload = 'v1';
  await refusedFor('changed revision', submission(5));
  state.deny = true;
  await refusedFor('authorization denied for a cached key');
  state.deny = false;

  assert.equal(host.claims, 1, 'no claim replay');
  assert.equal(host.executes, 1, 'no execute replay');
  assert.deepEqual(controller.getSnapshot(), [success], 'the original receipt is kept');
  assert.equal(await controller.submit(submission(), model), success, 'unchanged cache reuse');
  controller.dispose();
});
