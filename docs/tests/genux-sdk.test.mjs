import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mountPattern, buttonByText, selectOption } from './harness.mjs';

let sdk;
test.before(async () => {
  if (process.env.GENUX_GENUX_DOM_FIXTURE === '1') return;
  const target = resolve(`docs/tests/.genux-sdk-${randomUUID()}.mjs`);
  try {
    const output = await build({
      stdin: {
        contents:
          "export * from './docs/src/genux/sdk/index.ts'; export { createGenUXRuntime } from './docs/src/genux/runtime.ts';",
        resolveDir: process.cwd(),
        loader: 'ts',
      },
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      write: false,
    });
    await writeFile(target, output.outputFiles[0].contents);
    sdk = await import(pathToFileURL(target).href);
  } finally {
    await unlink(target).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
});

test('native SDK transport and a bounded SSE transformer are public integration APIs', () => {
  assert.equal(typeof sdk.createGenUXTransport, 'function');
  assert.equal(typeof sdk.createSSETransform, 'function');
  assert.equal(typeof sdk.GenUXChatProvider, 'function');
});

const byteStream = (text, width = 1) =>
  new ReadableStream({
    start(controller) {
      const bytes = new TextEncoder().encode(text);
      for (let start = 0; start < bytes.length; start += width)
        controller.enqueue(bytes.slice(start, start + width));
      controller.close();
    },
  });
const collect = async stream => {
  const records = [];
  for await (const record of stream) records.push(record);
  return records;
};

function runtimeFixture(scopeId) {
  let snapshot = {
    scopeId,
    revision: 0,
    status: 'idle',
    requestId: null,
    sequence: 0,
    surfaces: [],
    events: [],
    error: null,
    actionResult: null,
    history: [],
  };
  const batches = [];
  return {
    batches,
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    beginRequest(requestId) {
      snapshot = { ...snapshot, requestId, sequence: 0, status: 'receiving' };
    },
    applyBatch(batch) {
      if (batch.requestId !== snapshot.requestId || batch.sequence !== snapshot.sequence + 1)
        return { ok: false, error: 'Stale or out-of-order request.' };
      batches.push(batch);
      snapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        sequence: batch.sequence,
        surfaces: [{ id: 'studio' }],
      };
      return { ok: true };
    },
    finishRequest(requestId, status, error) {
      if (requestId === snapshot.requestId)
        snapshot = { ...snapshot, status, error: error ?? null };
    },
  };
}

function nativePipeline(scopeId, options = {}) {
  const runtime = options.runtime ?? runtimeFixture(scopeId);
  const transport = sdk.createGenUXTransport({ scopeId, runtime, ...options });
  const provider = new sdk.GenUXChatProvider(transport);
  let message;
  // Native useXChat uses this same public injection contract. Hook behavior is
  // covered by the Lab's DOM case; this fixture isolates transport/request races.
  provider.injectRequest({
    onUpdate(chunk, responseHeaders) {
      message = provider.transformMessage({
        originMessage: message,
        chunk,
        chunks: [],
        status: 'updating',
        responseHeaders,
      });
      return message;
    },
    onSuccess() {
      return message;
    },
    onError() {},
  });
  const run = async scenario => {
    provider.request.run(transport.prepare(scenario));
    await provider.request.asyncHandler;
    return transport.getSnapshot();
  };
  return { runtime, transport, provider, run, message: () => message };
}

test('native XStream handles fragmented UTF-8, CRLF and multiline SSE with bounded frames', async () => {
  const { XStream } = await import('@ant-design/x-sdk');
  const text =
    ': comment\r\nid: first\r\ndata: {"sequence":1,\r\ndata: "commands":[],"label":"İstanbul"}\r\n\r\ndata: {"sequence":2,"commands":[]}\n\n';
  const records = await collect(
    XStream({ readableStream: byteStream(text), transformStream: sdk.createSSETransform(7) }),
  );
  assert.equal(records.length, 2);
  assert.equal(records[0].hostEpoch, 7);
  assert.equal(JSON.parse(records[0].data).label, 'İstanbul');
  assert.equal(JSON.parse(records[1].data).sequence, 2);
  await assert.rejects(
    collect(
      XStream({
        readableStream: byteStream('data: too-long\n\n'),
        transformStream: sdk.createSSETransform(1, {
          maxBytes: 100,
          maxFrameBytes: 8,
          maxFrames: 2,
        }),
      }),
    ),
    /frame size limit/,
  );
  await assert.rejects(
    collect(
      XStream({
        readableStream: byteStream('data: a\n\ndata: b\n\n'),
        transformStream: sdk.createSSETransform(1, {
          maxBytes: 100,
          maxFrameBytes: 30,
          maxFrames: 1,
        }),
      }),
    ),
    /frame limit/,
  );
});

test('native XRequest/provider exercises genuine recorded SSE and JSON responses', async t => {
  const pipeline = nativePipeline('native-recorded');
  t.after(() => pipeline.transport.dispose());
  const first = await pipeline.run('overview');
  assert.equal(first.status, 'success');
  assert.equal(first.acceptedFrames, 1);
  assert.equal(pipeline.runtime.batches[0].commands.length, 3);
  assert.equal(
    pipeline.runtime.batches[0].commands[0].createSurface.catalogId,
    'local://genux-cards/v1',
  );
  const json = await pipeline.run('json');
  assert.equal(json.status, 'success');
  assert.equal(json.acceptedFrames, 1);
  assert.equal(pipeline.runtime.batches.length, 2);
  assert.equal(pipeline.message().role, 'assistant');
});

test('cancel is safe before first run and cancels a real in-flight recorded stream', async t => {
  const pipeline = nativePipeline('cancel');
  t.after(() => pipeline.transport.dispose());
  assert.doesNotThrow(() => pipeline.transport.cancel());
  pipeline.provider.request.run(pipeline.transport.prepare('slow'));
  await delay(20);
  assert.equal(pipeline.transport.getSnapshot().acceptedFrames, 1);
  pipeline.transport.cancel();
  await pipeline.provider.request.asyncHandler;
  assert.equal(pipeline.transport.getSnapshot().status, 'aborted');
  const count = pipeline.runtime.batches.length;
  await delay(30);
  assert.equal(pipeline.runtime.batches.length, count);
  assert.equal(pipeline.provider.request.isRequesting, false);
});

test('host timeout aborts the source and explicit retry succeeds with a new epoch', async t => {
  const pipeline = nativePipeline('timeout', { timeoutMs: 30 });
  t.after(() => pipeline.transport.dispose());
  const first = await pipeline.run('timeout');
  assert.equal(first.status, 'error');
  assert.match(first.error, /timed out/);
  assert.equal(pipeline.provider.request.isRequesting, false);
  const retry = await pipeline.run('refresh');
  assert.equal(retry.status, 'success');
  assert.equal(retry.epoch, first.epoch + 1);
  assert.notEqual(retry.requestId, first.requestId);
});

test('failed and malformed requests keep the last accepted runtime instead of publishing partial commands', async t => {
  const pipeline = nativePipeline('invalid');
  t.after(() => pipeline.transport.dispose());
  await pipeline.run('overview');
  const accepted = pipeline.runtime.batches.length;
  assert.equal((await pipeline.run('failure')).status, 'error');
  const malformed = await pipeline.run('malformed');
  assert.equal(malformed.status, 'error');
  assert.match(malformed.error, /invalid command envelope/);
  assert.equal(pipeline.runtime.batches.length, accepted);
  assert.equal(pipeline.runtime.getSnapshot().surfaces.length, 1);
});

test('malformed transport actively cancels an otherwise unending source stream', async t => {
  let cancelled = 0;
  const pipeline = nativePipeline('reject-source', {
    transport: {
      endpoint: '/trusted-stream',
      fetch: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: INVALID\n\n'));
            },
            cancel() {
              cancelled += 1;
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    },
  });
  t.after(() => pipeline.transport.dispose());
  assert.equal((await pipeline.run('malformed')).status, 'error');
  await delay(0);
  assert.equal(
    cancelled,
    1,
    'a validation failure must stop the source instead of only changing UI status',
  );
});

test('signal cancellation retains its contract without AbortSignal.any capability', async t => {
  const native = AbortSignal.any;
  AbortSignal.any = undefined;
  t.after(() => {
    AbortSignal.any = native;
  });
  const pipeline = nativePipeline('signal-fallback');
  t.after(() => pipeline.transport.dispose());
  pipeline.provider.request.run(pipeline.transport.prepare('slow'));
  await delay(15);
  pipeline.transport.cancel();
  await pipeline.provider.request.asyncHandler;
  assert.equal(pipeline.transport.getSnapshot().status, 'aborted');
  assert.equal(pipeline.provider.request.isRequesting, false);
});

test('old request frames cannot commit to a new epoch or another session', async t => {
  const a = nativePipeline('session-a');
  const b = nativePipeline('session-b');
  t.after(() => {
    a.transport.dispose();
    b.transport.dispose();
  });
  const first = a.transport.prepare('overview');
  const oldEpoch = a.transport.getSnapshot().epoch;
  a.transport.cancel();
  a.transport.prepare('refresh');
  assert.throws(
    () => a.transport.accept({ hostEpoch: oldEpoch, data: '{"sequence":1,"commands":[]}' }),
    /previous recorded request/,
  );
  a.transport.cancel();
  const [aResult, bResult] = await Promise.all([a.run('overview'), b.run('overview')]);
  assert.equal(aResult.status, 'success');
  assert.equal(bResult.status, 'success');
  assert.notEqual(aResult.requestId, bResult.requestId);
  assert.ok(a.runtime.batches.every(batch => batch.requestId === aResult.requestId));
  assert.ok(b.runtime.batches.every(batch => batch.requestId === bResult.requestId));
  assert.notEqual(first.requestId, aResult.requestId);
});

test('trusted host fetch is injectable and owns the configured endpoint without a network call', async t => {
  let calls = 0;
  let signal;
  const pipeline = nativePipeline('trusted-host', {
    transport: {
      endpoint: '/trusted-configured-endpoint',
      fetch: async (url, options) => {
        calls += 1;
        assert.equal(url, '/trusted-configured-endpoint');
        signal = options.signal;
        return new Response('{"sequence":1,"commands":[]}', {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
  t.after(() => pipeline.transport.dispose());
  assert.equal((await pipeline.run('json')).status, 'success');
  assert.equal(calls, 1);
  assert.ok(signal instanceof AbortSignal);
});

test('native recorded SDK pipeline commits real runtime cards and preserves edited fields during unrelated updates', async t => {
  const runtime = sdk.createGenUXRuntime({ scopeId: 'SDKAcceptance' });
  const pipeline = nativePipeline('SDKAcceptance', { runtime });
  t.after(() => pipeline.transport.dispose());
  assert.equal((await pipeline.run('overview')).status, 'success');
  const initial = runtime.getSnapshot();
  assert.equal(initial.surfaces.length, 1);
  assert.equal(initial.surfaces[0].models.entity.kind, 'entity');
  assert.equal(initial.surfaces[0].models.metric.metric.value, 24);
  assert.equal(runtime.patchField('studio', 'note', 'note', 'My preserved draft').ok, true);
  assert.equal((await pipeline.run('refresh')).status, 'success');
  assert.equal(runtime.getSnapshot().surfaces[0].models.metric.metric.value, 21);
  assert.equal(runtime.getSnapshot().surfaces[0].models.note.fields[0].value, 'My preserved draft');
  const generation = runtime.getSnapshot().surfaces[0].generation;
  assert.equal((await pipeline.run('recreate')).status, 'success');
  assert.equal(runtime.getSnapshot().surfaces[0].generation, generation + 1);
  assert.equal(
    runtime.getSnapshot().surfaces[0].models.note.fields[0].value,
    'Prepare the next review.',
  );
});

test('the real Lab uses native chat/session hooks, preserves the mounted draft through a slow stream and isolates session CRUD', async t => {
  if (process.env.GENUX_GENUX_DOM_FIXTURE !== '1') {
    // Native SDK imports ReactDOM through util. Isolate the real DOM fixture so
    // React's browser capability detection runs after harness DOM installation.
    const childEnvironment = { ...process.env, GENUX_GENUX_DOM_FIXTURE: '1' };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const child = spawnSync(
      process.execPath,
      ['--test', '--test-name-pattern=the real Lab', fileURLToPath(import.meta.url)],
      { env: childEnvironment, encoding: 'utf8', timeout: 22000 },
    );
    assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
    assert.match(child.stdout, /tests 1/);
    return;
  }
  const h = await mountPattern('default', 'docs/src/react/genux/GenUXCardLab.tsx');
  t.after(() => h.dispose());
  const lab = h.document.querySelector('[data-genux-lab]');
  const run = () => buttonByText(lab, 'Run recorded stream');
  const status = () => lab.querySelector('[data-genux-run-status]')?.dataset.genuxRunStatus;
  await h.waitFor(() => run() && !run().disabled, 'native SDK message initialization');
  await h.click(run());
  await h.waitFor(() => status() === 'success', 'recorded native request completes');
  const note = () => {
    const label = [...lab.querySelectorAll('label')].find(label =>
      label.textContent.trim().startsWith('Workspace note'),
    );
    return label ? h.document.getElementById(label.htmlFor) : null;
  };
  const input = note();
  assert.ok(input);
  await h.type(input, 'Preserved session draft');
  const scenario = lab.querySelector('input[aria-label="Recorded scenario"]');
  await selectOption(h, scenario, 'Slow update · keep editing');
  await h.click(run());
  await h.waitFor(
    () =>
      status() === 'receiving' &&
      lab.querySelector('[data-card-metric-value]')?.textContent === '24',
    'first recorded frame keeps the editable Card mounted',
  );
  await h.type(input, 'Still editing during stream');
  await h.act(() => {
    input.focus();
    input.setSelectionRange(7, 7);
  });
  await h.waitFor(() => status() === 'success', 'second recorded frame completes', 4000);
  assert.equal(note(), input);
  assert.equal(input.value, 'Still editing during stream');
  assert.equal(h.document.activeElement, input);
  assert.equal(input.selectionStart, 7);
  assert.equal(lab.querySelector('[data-card-metric-value]').textContent, '21');
  const nativeMessageCount = () => lab.querySelectorAll('.genux-message-list li').length;
  assert.equal(nativeMessageCount(), 4);
  await h.click(buttonByText(lab, 'Reload response'));
  await h.waitFor(() => status() === 'success', 'native SDK reload completes', 4000);
  assert.equal(
    nativeMessageCount(),
    4,
    'onReload updates an existing response instead of adding another user request',
  );
  await h.type(lab.querySelector('input[placeholder="Name this local session"]'), 'Planning');
  assert.ok(buttonByText(lab.querySelector('nav'), 'Planning'));
  await h.click(buttonByText(lab, 'Add session'));
  await h.waitFor(
    () => status() === 'idle' && !run().disabled,
    'new independent native SDK session',
  );
  assert.equal(lab.querySelectorAll('[data-genux-card]').length, 0);
  await h.click(run());
  await h.waitFor(() => status() === 'success', 'second session recorded request');
  assert.equal(note().value, 'Prepare the next review.');
  await h.click(buttonByText(lab.querySelector('nav'), 'Planning'));
  assert.equal(note().value, 'Still editing during stream');
  await h.click(buttonByText(lab, 'Remove active session'));
  await h.waitFor(
    () => !buttonByText(lab.querySelector('nav'), 'Planning'),
    'native session removal clears the retained key',
  );
  assert.equal(note().value, 'Prepare the next review.');
  await h.click(buttonByText(lab, 'Add session'));
  await h.waitFor(
    () => status() === 'idle' && !run().disabled,
    'removed upstream key is safely reused',
  );
  assert.equal(nativeMessageCount(), 0);
  assert.equal(lab.querySelectorAll('[data-genux-card]').length, 0);
  await selectOption(
    h,
    lab.querySelector('input[aria-label="Recorded scenario"]'),
    'Orders · query to review',
  );
  await h.click(run());
  await h.waitFor(
    () => lab.querySelector('tr[data-row-key="order-one"] input[type="checkbox"]'),
    'query stage paints real recorded orders',
  );
  await h.click(lab.querySelector('tr[data-row-key="order-one"] input[type="checkbox"]'));
  await h.waitFor(
    () =>
      [...lab.querySelectorAll('label')].some(label =>
        label.textContent.startsWith('Order review note'),
      ),
    'draft form appears after grouping',
    3500,
  );
  const draftInput = [...lab.querySelectorAll('label')]
    .find(label => label.textContent.startsWith('Order review note'))
    .querySelector('input');
  assert.ok(draftInput);
  await h.type(draftInput, 'Keep this task draft');
  await h.act(() => {
    draftInput.focus();
    draftInput.setSelectionRange(4, 4);
  });
  assert.equal(buttonByText(lab, 'Review local order draft').disabled, true);
  await h.waitFor(() => status() === 'success', 'all five task transactions complete', 5000);
  assert.equal(
    [...lab.querySelectorAll('label')]
      .find(label => label.textContent.startsWith('Order review note'))
      .querySelector('input'),
    draftInput,
  );
  assert.equal(draftInput.value, 'Keep this task draft');
  assert.equal(draftInput.selectionStart, 4);
  assert.equal(h.document.activeElement, draftInput);
  assert.equal(
    lab.querySelector('tr[data-row-key="order-one"] input[type="checkbox"]').checked,
    true,
  );
  assert.equal(
    lab.querySelectorAll('[data-genux-card]').length,
    1,
    'one Task Card contains blocks rather than nested Cards',
  );
  assert.match(lab.querySelector('tr[data-row-key="order-four"]').textContent, /520/);
  await h.type(draftInput, '');
  await h.click(buttonByText(lab, 'Review local order draft'));
  const validation = lab.querySelector('.genux-session [role="alert"]');
  assert.ok(
    validation,
    'a rejected local Review exposes an accessible visible error outside collapsed evidence',
  );
  assert.equal(validation.textContent, 'Complete the required fields before continuing.');
  assert.equal(validation.closest('[aria-hidden="true"], [inert]'), null);
  assert.equal(draftInput.getAttribute('aria-invalid'), 'true');
  assert.equal(
    h.document.getElementById(draftInput.getAttribute('aria-describedby')).textContent,
    'This field is required.',
  );
  await h.click(lab.querySelector('tr[data-row-key="order-two"] input[type="checkbox"]'));
  assert.equal(
    lab.querySelector('tr[data-row-key="order-one"] input[type="checkbox"]').checked,
    true,
    'selecting Birch keeps the existing Aster group selection',
  );
  assert.equal(
    lab.querySelector('tr[data-row-key="order-two"] input[type="checkbox"]').checked,
    true,
  );
  await h.click(lab.querySelector('tr[data-row-key="order-one"] input[type="checkbox"]'));
  assert.equal(
    lab.querySelector('tr[data-row-key="order-two"] input[type="checkbox"]').checked,
    true,
    'clearing one group does not clear another group',
  );
  await h.type(draftInput, 'Keep this task draft');
  await h.click(buttonByText(lab, 'Review local order draft'));
  assert.match(lab.querySelector('[data-genux-run-status]').textContent, /Local result only/);
  const queries = lab.querySelector('[data-genux-query-lab]');
  const messagesBeforeQueries = nativeMessageCount();
  await h.click(buttonByText(queries, 'Save query definition'));
  const storageKey = Object.keys(h.window.localStorage).find(key =>
    key.startsWith('genux-card-definitions-v1-panel-'),
  );
  assert.ok(storageKey);
  let definitions = JSON.parse(h.window.localStorage.getItem(storageKey));
  assert.equal(definitions[0].queries[0].toolId, 'orders.delayed');
  assert.equal(JSON.stringify(definitions).includes('Keep this task draft'), false);
  assert.equal(
    JSON.stringify(definitions).includes('"rows"'),
    false,
    'storage contains query bindings, not record snapshots',
  );
  await h.click(buttonByText(queries, 'Render saved query'));
  await h.waitFor(
    () => queries.querySelector('tr[data-row-key="record-one"]'),
    'saved query executes its recorded source without SDK/model request',
  );
  assert.equal(nativeMessageCount(), messagesBeforeQueries);
  assert.equal(queries.querySelectorAll('[data-genux-card]').length, 1);
  await selectOption(
    h,
    queries.querySelector('input[aria-label="Query definition to save"]'),
    'Monthly sales query',
  );
  await h.click(buttonByText(queries, 'Save query definition'));
  definitions = JSON.parse(h.window.localStorage.getItem(storageKey));
  assert.equal(definitions.length, 2);
  assert.equal(JSON.stringify(definitions).includes('2450000'), false);
  await h.click(buttonByText(queries, 'Render saved query'));
  await h.waitFor(
    () => queries.querySelector('[data-card-metric-value]'),
    'saved metric query renders fresh recorded data',
  );
  assert.equal(
    queries.querySelectorAll('[data-genux-card]').length,
    1,
    'changing query definitions replaces only the separate preview owner',
  );
  assert.equal(nativeMessageCount(), messagesBeforeQueries);
  assert.equal(
    draftInput.value,
    'Keep this task draft',
    'query replay never replaces the active stream draft',
  );
});

test('the real native bridge separates surface actions, rejects stale painted meaning and exposes supplied field errors', async () => {
  if (process.env.GENUX_GENUX_DOM_FIXTURE !== '1') {
    const childEnvironment = { ...process.env, GENUX_GENUX_DOM_FIXTURE: '1' };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const child = spawnSync(
      process.execPath,
      ['--test', '--test-name-pattern=the real native bridge', fileURLToPath(import.meta.url)],
      { env: childEnvironment, encoding: 'utf8', timeout: 10000 },
    );
    assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
    assert.match(child.stdout, /tests 1/);
    return;
  }
  const entry = `docs/tests/.genux-review-${randomUUID()}.tsx`;
  await writeFile(
    entry,
    `
    import { useState } from 'react';
    import GenUXSurface from '../src/react/genux/GenUXSurface';
    import { createGenUXRuntime } from '../src/genux/runtime';
    import { GENUX_CARD_CATALOG_ID } from '../src/genux/contracts';
    export default function BridgeFixture() {
      const [executions, setExecutions] = useState<string[]>([]);
      const [error, setError] = useState('');
      const [owner] = useState(() => {
        const paused = { value: false };
        const runtime = createGenUXRuntime({ scopeId: 'BridgeReview', onAction: action => setExecutions(current => [...current, action.surfaceId]) });
        runtime.beginRequest('InitialReview');
        const commands = ['first', 'second'].flatMap(id => [
          { version: 'v0.9', createSurface: { surfaceId: id, catalogId: GENUX_CARD_CATALOG_ID } },
          { version: 'v0.9', updateComponents: { surfaceId: id, components: [{ id: 'root', component: 'GenUXPurposeCard', model: { id: id + '-model', kind: 'summary', title: id, primaryAction: { id: 'inspect-record', label: 'Inspect ' + id, intent: 'inspect' } } }] } },
        ]);
        commands.push(
          { version: 'v0.9', createSurface: { surfaceId: 'validation', catalogId: GENUX_CARD_CATALOG_ID } },
          { version: 'v0.9', updateComponents: { surfaceId: 'validation', components: [
            { id: 'root', component: 'GenUXTaskSurface', payload: { title: 'Validation', intent: 'draft' }, children: ['form'] },
            { id: 'form', component: 'GenUXForm', payload: { title: 'Supplied field error', fields: [{ key: 'note', label: 'Order review note', value: 'bad', error: 'Use a complete note.', required: true }] } },
          ] } },
        );
        const accepted = runtime.applyBatch({ requestId: 'InitialReview', sequence: 1, commands });
        if (!accepted.ok) throw new Error(accepted.error);
        runtime.finishRequest('InitialReview', 'success');
        const presentation = { ...runtime, subscribe: (listener: () => void) => runtime.subscribe(() => { if (!paused.value) listener(); }) };
        return { runtime, presentation, paused };
      });
      const changeWithoutPaint = () => {
        // Freeze only presentation delivery to model the real commit-to-paint gap.
        // The trusted runtime remains current and must reject the old UI meaning.
        owner.paused.value = true;
        owner.runtime.beginRequest('ChangedReview');
        owner.runtime.applyBatch({ requestId: 'ChangedReview', sequence: 1, commands: [{ version: 'v0.9', updateComponents: { surfaceId: 'first', components: [{ id: 'root', component: 'GenUXPurposeCard', model: { id: 'first-model', kind: 'summary', title: 'Changed first', primaryAction: { id: 'inspect-record', label: 'Changed meaning', intent: 'review' } } }] } }] });
        owner.runtime.finishRequest('ChangedReview', 'success');
      };
      return <main><GenUXSurface runtime={owner.presentation} /><button onClick={changeWithoutPaint}>Commit changed meaning without paint</button><button onClick={() => setError(owner.runtime.getSnapshot().error ?? '')}>Read host rejection</button><output data-executions>{JSON.stringify(executions)}</output><output data-rejection>{error}</output></main>;
    }
  `,
  );
  let h;
  try {
    h = await mountPattern('default', entry);
    await h.waitFor(
      () => buttonByText(h.document, 'Inspect first') && buttonByText(h.document, 'Inspect second'),
      'both native surfaces finish mounting',
    );
    const input = [...h.document.querySelectorAll('label')]
      .find(label => label.textContent.startsWith('Order review note'))
      .querySelector('input');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(
      h.document.getElementById(input.getAttribute('aria-describedby')).textContent,
      'Use a complete note.',
    );
    await h.act(() => h.setLocale('tr'));
    assert.match(input.closest('label').textContent, /Sipariş inceleme notu/);
    await h.act(() => h.setLocale('en'));
    await h.click(buttonByText(h.document, 'Inspect first'));
    await h.click(buttonByText(h.document, 'Inspect second'));
    assert.deepEqual(JSON.parse(h.document.querySelector('[data-executions]').textContent), [
      'first',
      'second',
    ]);
    const paintedAction = buttonByText(h.document, 'Inspect first');
    await h.click(buttonByText(h.document, 'Commit changed meaning without paint'));
    assert.equal(
      paintedAction.textContent.trim(),
      'Inspect first',
      'fixture retains the actual old painted action',
    );
    await h.click(paintedAction);
    assert.deepEqual(
      JSON.parse(h.document.querySelector('[data-executions]').textContent),
      ['first', 'second'],
      'the previous UI cannot execute the changed action meaning',
    );
    await h.click(buttonByText(h.document, 'Read host rejection'));
    assert.equal(
      h.document.querySelector('[data-rejection]').textContent,
      'Action refers to a stale Card revision.',
    );
  } finally {
    if (h) await h.dispose();
    await unlink(entry);
  }
});
