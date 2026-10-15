import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
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
// The review helper is the public core contract under test: when it is absent the
// test fails on that contract, not on a bundler resolution error.
const loadCore = async entry => {
  try {
    await access(entry);
  } catch {
    return {};
  }
  return load(entry);
};

test('action review binds actual draft differences and approves only a fresh explicit review', async () => {
  const core = await loadCore('docs/src/genui/action-review.ts');
  assert.equal(
    typeof core.captureActionReview,
    'function',
    'captureActionReview must be a public core export',
  );
  const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
  const { actionBindingJSON } = await load('docs/src/genui/actions/authorization.ts');
  const executed = [];
  const runtime = createGenUIRuntime({
    scopeId: 'review-scope',
    onAction(action) {
      executed.push(action);
    },
  });
  runtime.beginRequest('review-request');
  assert.equal(
    runtime.applyBatch({
      requestId: 'review-request',
      sequence: 1,
      commands: [
        {
          version: 'v0.9',
          createSurface: { surfaceId: 'review', catalogId: 'local://atlas-cards/v1' },
        },
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'review',
            path: '/state/note',
            value: {
              title: 'Review note',
              fields: [{ key: 'summary', label: 'Summary', value: 'Initial note', required: true }],
              action: { id: 'submit-review', label: 'Submit review', intent: 'create' },
            },
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'review',
            components: [
              {
                id: 'root',
                component: 'AtlasTaskSurface',
                children: ['orders', 'note'],
                payload: { title: 'Order review', intent: 'review' },
              },
              {
                id: 'orders',
                component: 'AtlasCollection',
                payload: {
                  title: 'Orders',
                  columns: [{ key: 'customer', label: 'Customer' }],
                  rows: [
                    { id: 'o1', customer: 'Ada' },
                    { id: 'o2', customer: 'Lin' },
                  ],
                },
              },
              { id: 'note', component: 'AtlasForm', payload: { path: '/state/note' } },
            ],
          },
        },
      ],
    }).ok,
    true,
  );
  runtime.finishRequest('review-request', 'success');
  assert.equal(
    runtime.patchField('review', 'note', 'summary', 'Customer delays confirmed').ok,
    true,
  );
  assert.equal(runtime.chooseValue('review', 'orders', ['o2']).ok, true);

  const snapshot = runtime.getSnapshot();
  const surface = snapshot.surfaces.find(item => item.id === 'review');
  const descriptor = {
    surfaceId: 'review',
    componentId: 'note',
    actionId: 'submit-review',
    baseRevision: snapshot.revision,
  };
  assert.equal(
    core.captureActionReview(snapshot, { ...descriptor, baseRevision: snapshot.revision - 1 }),
    null,
  );
  assert.equal(
    core.captureActionReview(snapshot, { ...descriptor, actionId: 'unregistered' }),
    null,
  );
  const review = core.captureActionReview(snapshot, descriptor);
  assert.ok(review, 'current registered action is reviewable');
  const { id, ...binding } = review.binding;
  assert.equal(typeof id, 'string');
  assert.ok(id.length);
  assert.deepEqual(binding, {
    scopeId: 'review-scope',
    surfaceId: 'review',
    componentId: 'note',
    actionId: 'submit-review',
    generation: surface.generation,
    revision: snapshot.revision,
    modelJSON: actionBindingJSON(surface.blocks.note),
    surfaceJSON: actionBindingJSON(surface),
  });
  // Host source before, canonical local state after; unchanged values are never listed.
  assert.ok(
    review.changes.some(
      change => change.before === 'Initial note' && change.after === 'Customer delays confirmed',
    ),
  );
  assert.ok(
    review.changes.some(
      change => isDeepStrictEqual(change.before, []) && isDeepStrictEqual(change.after, ['o2']),
    ),
  );
  assert.equal(review.changes.length, 2);
  assert.deepEqual(review.selectedRecordIds, ['o2']);
  assert.ok(Object.isFrozen(review.binding));

  const approvals = [];
  let cancels = 0;
  const harness = await mountPattern('default', 'docs/src/react/genui/HybridActionReview.tsx', {
    runtime,
    descriptor,
    onApprove(value) {
      approvals.push(value);
    },
    onCancel() {
      cancels++;
    },
  });
  try {
    const approve = () => buttonByText(harness.document, 'Approve reviewed action');
    const refresh = () => buttonByText(harness.document, 'Refresh review');
    const state = () =>
      harness.document.querySelector('[data-genui-action-review]')?.dataset.genuiActionReview;
    await harness.waitFor(() => approve() && state() === 'current', 'current review');
    assert.match(harness.document.body.textContent, /Initial note/);
    assert.match(harness.document.body.textContent, /Customer delays confirmed/);

    // A runtime change while the review is open makes the old approval inert.
    await harness.act(async () => {
      assert.equal(
        runtime.patchField('review', 'note', 'summary', 'Late shipment escalated').ok,
        true,
      );
    });
    await harness.waitFor(() => state() === 'stale', 'stale review');
    assert.equal(approve().disabled, true);
    await harness.click(approve());
    assert.equal(approvals.length, 0);

    await harness.click(refresh());
    await harness.waitFor(() => state() === 'current', 'explicitly refreshed review');
    assert.match(harness.document.body.textContent, /Late shipment escalated/);
    const latest = runtime.getSnapshot();
    const latestSurface = latest.surfaces.find(item => item.id === 'review');
    await harness.click(approve());
    assert.equal(approvals.length, 1);
    const [approval] = approvals;
    assert.equal(approval.approved, true);
    assert.equal(approval.revision, latest.revision);
    assert.equal(approval.generation, latestSurface.generation);
    assert.equal(approval.surfaceJSON, actionBindingJSON(latestSurface));
    assert.equal(approval.modelJSON, actionBindingJSON(latestSurface.blocks.note));
    // Approval is only the trusted callback: no runtime change, host execution or result.
    assert.equal(runtime.getSnapshot(), latest);
    assert.equal(executed.length, 0);
    assert.equal(latest.actionResult, null);
    assert.equal(cancels, 0);
  } finally {
    await harness.dispose();
  }
});

// A completed panel stream whose note form registers a reviewable create action.
const publishReviewSurface = (runtime, components) => {
  runtime.beginRequest('review-request');
  const result = runtime.applyBatch({
    requestId: 'review-request',
    sequence: 1,
    commands: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'review', catalogId: 'local://atlas-cards/v1' },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'review',
          path: '/state/note',
          value: {
            title: 'Review note',
            fields: [{ key: 'summary', label: 'Summary', value: 'Initial note', required: true }],
            action: { id: 'submit-review', label: 'Submit review', intent: 'create' },
          },
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'review',
          components: [
            {
              id: 'root',
              component: 'AtlasTaskSurface',
              children: [...components.map(component => component.id), 'note'],
              payload: { title: 'Order review', intent: 'review' },
            },
            ...components,
            { id: 'note', component: 'AtlasForm', payload: { path: '/state/note' } },
          ],
        },
      },
    ],
  });
  runtime.finishRequest('review-request', 'success');
  return result;
};
const noteDescriptor = snapshot => ({
  surfaceId: 'review',
  componentId: 'note',
  actionId: 'submit-review',
  baseRevision: snapshot.revision,
});
const reviewSurface = snapshot => snapshot.surfaces.find(item => item.id === 'review');

test('an approved captured review authorizes only its exact current action', async () => {
  const core = await load('docs/src/genui/action-review.ts');
  const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
  const { createActionAuthorization } = await load('docs/src/genui/actions/authorization.ts');
  const runtime = createGenUIRuntime({ scopeId: 'review-scope' });
  assert.equal(publishReviewSurface(runtime, []).ok, true);
  assert.equal(
    runtime.patchField('review', 'note', 'summary', 'Customer delays confirmed').ok,
    true,
  );
  const snapshot = runtime.getSnapshot();
  const review = core.captureActionReview(snapshot, noteDescriptor(snapshot));
  assert.ok(review, 'current registered action is reviewable');
  // The same explicit approval the review UI hands to the trusted host.
  const approved = Object.freeze({ ...review.binding, approved: true });
  const authorization = createActionAuthorization({
    runtime,
    authorize: () => true,
    getReview: () => approved,
  });
  const request = current => ({
    ...noteDescriptor(current),
    idempotencyKey: `review-${current.revision}`,
  });
  const context = authorization.authorize(request(snapshot), reviewSurface(snapshot).blocks.note);
  assert.equal(context.reviewId, approved.id);
  assert.equal(context.modelJSON, approved.modelJSON);
  assert.equal(context.surfaceJSON, approved.surfaceJSON);

  // A later local change makes the previously approved binding stale.
  assert.equal(runtime.patchField('review', 'note', 'summary', 'Late shipment escalated').ok, true);
  const latest = runtime.getSnapshot();
  assert.throws(
    () => authorization.authorize(request(latest), reviewSurface(latest).blocks.note),
    /review binding does not match/,
  );
});

test('a review never displays a password but keeps its exact protected binding', async () => {
  const core = await load('docs/src/genui/action-review.ts');
  const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
  const { actionBindingJSON } = await load('docs/src/genui/actions/authorization.ts');
  const runtime = createGenUIRuntime({ scopeId: 'review-scope' });
  assert.equal(
    publishReviewSurface(runtime, [
      {
        id: 'password',
        component: 'AtlasPasswordInput',
        payload: { title: 'Password', native: { label: 'Password', value: 'Initial-secret-7' } },
      },
    ]).ok,
    true,
  );
  const published = runtime.getSnapshot();
  assert.equal(
    runtime.changeNativeValue(
      'review',
      'password',
      'Rotated-secret-9',
      reviewSurface(published).generation,
      published.revision,
    ).ok,
    true,
  );
  assert.equal(
    runtime.patchField('review', 'note', 'summary', 'Customer delays confirmed').ok,
    true,
  );
  const snapshot = runtime.getSnapshot();
  const surface = reviewSurface(snapshot);
  const descriptor = noteDescriptor(snapshot);
  const review = core.captureActionReview(snapshot, descriptor);
  assert.ok(review, 'current registered action is reviewable');
  const secret = /Initial-secret-7|Rotated-secret-9/;
  assert.doesNotMatch(JSON.stringify(review.changes), secret);
  assert.ok(review.changes.some(change => change.sensitive === true && change.changed === true));
  assert.ok(
    review.changes.some(
      change => change.before === 'Initial note' && change.after === 'Customer delays confirmed',
    ),
  );
  // The protected value stays only in the exact canonical binding for the authorizer.
  assert.equal(review.binding.modelJSON, actionBindingJSON(surface.blocks.note));
  assert.equal(review.binding.surfaceJSON, actionBindingJSON(surface));
  assert.match(review.binding.surfaceJSON, /Rotated-secret-9/);

  const harness = await mountPattern('default', 'docs/src/react/genui/HybridActionReview.tsx', {
    runtime,
    descriptor,
    onApprove() {},
    onCancel() {},
  });
  try {
    await harness.waitFor(
      () =>
        harness.document.querySelector('[data-genui-action-review]')?.dataset.genuiActionReview ===
        'current',
      'current review',
    );
    assert.match(harness.document.body.textContent, /Customer delays confirmed/);
    assert.match(harness.document.body.textContent, /Changed/);
    assert.doesNotMatch(harness.document.documentElement.outerHTML, secret);
  } finally {
    await harness.dispose();
  }
});
