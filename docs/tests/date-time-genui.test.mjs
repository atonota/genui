import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundled = await build({
  entryPoints: ['docs/src/genui/runtime.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { createGenUIRuntime } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
);
const catalog = 'local://atlas-cards/v1';
const publicCatalog = 'local://atlas-cards/public/v1';
const create = { version: 'v0.9', createSurface: { surfaceId: 'records', catalogId: catalog } };
const update = nodes => ({
  version: 'v0.9',
  updateComponents: { surfaceId: 'records', components: nodes },
});
const data = (path, value) => ({
  version: 'v0.9',
  updateDataModel: { surfaceId: 'records', path, value },
});
const shell = (...children) => ({
  id: 'root',
  component: 'AtlasTaskSurface',
  payload: { title: 'Schedule', intent: 'configure' },
  children,
});
const field = (id, dateTime) => ({ id, component: 'AtlasDateTime', payload: { dateTime } });
const bound = (id, path) => ({ id, component: 'AtlasDateTime', payload: { path } });
const choice = {
  id: 'choice',
  component: 'AtlasChoice',
  payload: {
    title: 'Duration',
    options: [
      { id: 'short', label: '30 minutes' },
      { id: 'long', label: '60 minutes' },
    ],
    value: 'short',
  },
};
const due = { kind: 'date', label: 'Due date', value: '2026-10-14' };
const surface = runtime => runtime.getSnapshot().surfaces[0];
const picker = (runtime, id = 'when') => surface(runtime).blocks[id].dateTime;
const source = (runtime, key = 'when') => surface(runtime).data.state[key].dateTime;
const receiving = (commands, options = {}) => {
  const runtime = createGenUIRuntime({ scopeId: 'date-scope', ...options });
  runtime.beginRequest('request-one');
  assert.equal(
    runtime.applyBatch({ requestId: 'request-one', sequence: 1, commands: [create, ...commands] })
      .ok,
    true,
  );
  return runtime;
};
const ready = (commands, options) => {
  const runtime = receiving(commands, options);
  runtime.finishRequest('request-one', 'success');
  assert.equal(runtime.getSnapshot().status, 'success');
  return runtime;
};
const stream = (runtime, requestId, commands) => {
  runtime.beginRequest(requestId);
  const result = runtime.applyBatch({ requestId, sequence: 1, commands });
  runtime.finishRequest(requestId, 'success');
  assert.equal(runtime.getSnapshot().status, 'success');
  return result;
};
const rejectsAtomically = (runtime, attempt) => {
  const before = runtime.getSnapshot();
  const result = attempt();
  const after = runtime.getSnapshot();
  assert.equal(result.ok, false);
  assert.equal(after.surfaces, before.surfaces);
  assert.equal(after.revision, before.revision);
  assert.equal(after.sequence, before.sequence);
  assert.deepEqual(after.history, before.history);
};

test('AtlasDateTime is a registered capability for every supported kind and precision', () => {
  const models = {
    date: due,
    empty: { kind: 'date', label: 'Follow-up', value: null },
    time: { kind: 'time', label: 'Start time', value: '09:30:00' },
    datetime: { kind: 'datetime', label: 'Meeting', value: '2026-10-14T09:30:00' },
    dates: { kind: 'date-range', label: 'Report', value: ['2026-10-01', '2026-10-07'] },
    times: { kind: 'time-range', label: 'Shift', value: ['09:00:00', '17:30:00'] },
    stay: {
      kind: 'datetime-range',
      label: 'Reservation',
      value: ['2026-10-14T09:00:00', '2026-10-15T17:00:00'],
    },
    many: {
      kind: 'date',
      label: 'Review days',
      multiple: true,
      value: ['2026-10-14', '2026-10-16'],
    },
    month: { kind: 'date', unit: 'month', label: 'Billing month', value: '2026-10-01' },
    week: { kind: 'date', unit: 'week', label: 'Sprint week', value: '2026-10-12' },
    quarter: { kind: 'date', unit: 'quarter', label: 'Quarter', value: '2026-10-01' },
  };
  const ids = Object.keys(models);
  const runtime = ready([
    data('/state/bound', { dateTime: models.datetime }),
    update([
      shell(...ids, 'linked'),
      ...ids.map(id => field(id, models[id])),
      bound('linked', '/state/bound'),
    ]),
  ]);
  for (const id of ids) assert.deepEqual(picker(runtime, id), models[id]);
  assert.deepEqual(picker(runtime, 'linked'), models.datetime);
});

test('invalid or unsafe date-time definitions reject atomically without evaluating accessors', () => {
  const invalid = [
    { ...due, value: '2026-02-29' },
    { ...due, value: '2026-10-32' },
    { kind: 'time', label: 'Start', value: '24:00:00' },
    { kind: 'datetime', label: 'Meeting', value: '2026-10-14T09:30:00Z' },
    { kind: 'date-range', label: 'Report', value: ['2026-10-07', '2026-10-01'] },
    { kind: 'date-range', label: 'Report', value: ['2026-10-01', null] },
    { kind: 'date-range', label: 'Report', value: '2026-10-01' },
    { ...due, multiple: true, value: ['2026-10-14', '2026-10-14'] },
    { kind: 'time', label: 'Start', multiple: true, value: ['09:00:00'] },
    { ...due, value: ['2026-10-14'] },
    { ...due, unit: 'month', value: '2026-10-14' },
    { ...due, minDate: '2026-10-15' },
    { ...due, value: '2026-10-17', disabledWeekdays: [0, 6] },
    { kind: 'week-range', label: 'Weeks', value: null },
    { ...due, onChange: 'alert(1)' },
    { ...due, value: new Date(0) },
  ];
  const payloads = [
    { dateTime: due, title: 'Extra' },
    {},
    { dateTime: { label: 'Due date', value: '2026-10-14' } },
  ];
  const attempts = [
    ...invalid.map(model => [update([shell('when', 'bad'), field('bad', model)])]),
    ...payloads.map(payload => [
      update([shell('when', 'bad'), { id: 'bad', component: 'AtlasDateTime', payload }]),
    ]),
    [
      data('/state/bad', { dateTime: invalid[0] }),
      update([shell('when', 'bad'), bound('bad', '/state/bad')]),
    ],
  ];
  for (const commands of attempts) {
    const runtime = receiving([update([shell('when'), field('when', due)])]);
    rejectsAtomically(runtime, () =>
      runtime.applyBatch({ requestId: 'request-one', sequence: 2, commands }),
    );
    assert.equal(runtime.getSnapshot().sequence, 1);
    assert.deepEqual(picker(runtime), due);
  }
  for (const wrap of [
    model => [update([shell('when', 'bad'), field('bad', model)])],
    model => [
      data('/state/bad', { dateTime: model }),
      update([shell('when', 'bad'), bound('bad', '/state/bad')]),
    ],
  ]) {
    let accessed = false;
    const model = { kind: 'date', label: 'Due date' };
    Object.defineProperty(model, 'value', {
      enumerable: true,
      get() {
        accessed = true;
        throw new Error('must not read');
      },
    });
    const runtime = receiving([update([shell('when'), field('when', due)])]);
    rejectsAtomically(runtime, () =>
      runtime.applyBatch({ requestId: 'request-one', sequence: 2, commands: wrap(model) }),
    );
    assert.equal(accessed, false);
  }
  assert.equal({}.polluted, undefined);
});

test('chooseDateTime edits a local draft, clears with null and keeps exact range and multiple shapes', () => {
  let calls = 0;
  const report = { kind: 'date-range', label: 'Report', value: ['2026-10-01', '2026-10-07'] };
  const many = { kind: 'date', label: 'Review days', multiple: true, value: ['2026-10-14'] };
  const runtime = ready(
    [
      update([
        shell('when', 'report', 'many'),
        field('when', due),
        field('report', report),
        field('many', many),
      ]),
    ],
    {
      onAction() {
        calls++;
      },
    },
  );
  const revision = runtime.getSnapshot().revision;
  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, true);
  assert.equal(picker(runtime).value, '2026-10-15');
  assert.ok(runtime.getSnapshot().revision > revision);
  assert.equal(runtime.chooseDateTime('records', 'when', null).ok, true);
  assert.equal(picker(runtime).value, null);
  assert.equal(picker(runtime).label, due.label);

  const range = ['2026-10-08', '2026-10-21'];
  assert.equal(runtime.chooseDateTime('records', 'report', range).ok, true);
  range.push('2026-10-30');
  assert.deepEqual(picker(runtime, 'report').value, ['2026-10-08', '2026-10-21']);
  assert.equal(runtime.chooseDateTime('records', 'report', null).ok, true);
  assert.equal(picker(runtime, 'report').value, null);

  const days = ['2026-10-14', '2026-10-16', '2026-10-21'];
  assert.equal(runtime.chooseDateTime('records', 'many', days).ok, true);
  days.pop();
  assert.deepEqual(picker(runtime, 'many').value, ['2026-10-14', '2026-10-16', '2026-10-21']);

  for (const [id, value] of [
    ['when', ['2026-10-15']],
    ['when', 20261015],
    ['when', { value: '2026-10-15' }],
    ['when', new Date(0)],
    ['report', '2026-10-08'],
    ['report', ['2026-10-08']],
    ['report', ['2026-10-08', '2026-10-09', '2026-10-10']],
    ['report', ['2026-10-21', '2026-10-08']],
    ['report', ['2026-10-08', null]],
    ['many', '2026-10-14'],
    ['many', ['2026-10-14', '2026-10-14']],
    ['many', ['2026-10-14', 'tomorrow']],
  ])
    rejectsAtomically(runtime, () => runtime.chooseDateTime('records', id, value));
  assert.equal(calls, 0);
});

test('chooseDateTime rejects accessor, cyclic and unsafe-key values at the action boundary', () => {
  const runtime = ready([
    update([
      shell('when', 'report', 'many'),
      field('when', due),
      field('report', { kind: 'date-range', label: 'Report', value: ['2026-10-01', '2026-10-07'] }),
      field('many', { kind: 'date', label: 'Review days', multiple: true, value: ['2026-10-14'] }),
    ]),
  ]);
  let reads = 0;
  const counted = (values, index) => {
    Object.defineProperty(values, index, {
      enumerable: true,
      configurable: true,
      get() {
        reads++;
        return '2026-10-16';
      },
    });
    return values;
  };
  const cycle = ['2026-10-14'];
  cycle.push(cycle);
  const keyed = ['2026-10-08', '2026-10-21'];
  Object.defineProperty(keyed, '__proto__', {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
    writable: true,
  });
  for (const [id, value] of [
    ['many', counted(['2026-10-14'], 1)],
    ['report', counted(['2026-10-08', '2026-10-21'], 0)],
    ['many', cycle],
    ['report', cycle],
    ['when', JSON.parse('{"__proto__":{"polluted":true}}')],
    ['report', keyed],
  ])
    rejectsAtomically(runtime, () => runtime.chooseDateTime('records', id, value));
  assert.equal(reads, 0);
  assert.equal({}.polluted, undefined);
  assert.equal([].polluted, undefined);
  assert.equal(picker(runtime).value, '2026-10-14');
  assert.deepEqual(picker(runtime, 'report').value, ['2026-10-01', '2026-10-07']);
  assert.deepEqual(picker(runtime, 'many').value, ['2026-10-14']);
});

test('calendar bounds, disabled days and precision anchors constrain local choices', () => {
  const window = {
    minDate: '2026-10-01',
    maxDate: '2026-10-31',
    disabledWeekdays: [0, 6],
    disabledDates: ['2026-10-20'],
  };
  const runtime = ready([
    update([
      shell('when', 'span', 'week', 'quarter'),
      field('when', { ...due, ...window }),
      field('span', { kind: 'date-range', label: 'Report', value: null, ...window }),
      field('week', { kind: 'date', unit: 'week', label: 'Sprint', value: null }),
      field('quarter', { kind: 'date', unit: 'quarter', label: 'Quarter', value: null }),
    ]),
  ]);
  for (const value of ['2026-09-30', '2026-11-02', '2026-10-17', '2026-10-18', '2026-10-20'])
    rejectsAtomically(runtime, () => runtime.chooseDateTime('records', 'when', value));
  assert.equal(picker(runtime).value, '2026-10-14');
  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, true);
  assert.equal(picker(runtime).value, '2026-10-15');

  rejectsAtomically(runtime, () =>
    runtime.chooseDateTime('records', 'span', ['2026-09-28', '2026-10-02']),
  );
  rejectsAtomically(runtime, () =>
    runtime.chooseDateTime('records', 'span', ['2026-10-05', '2026-11-02']),
  );
  assert.equal(runtime.chooseDateTime('records', 'span', ['2026-10-05', '2026-10-09']).ok, true);

  rejectsAtomically(runtime, () => runtime.chooseDateTime('records', 'week', '2026-10-14'));
  assert.equal(runtime.chooseDateTime('records', 'week', '2026-10-12').ok, true);
  rejectsAtomically(runtime, () => runtime.chooseDateTime('records', 'quarter', '2026-11-01'));
  assert.equal(runtime.chooseDateTime('records', 'quarter', '2026-07-01').ok, true);
});

test('read-only and disabled models keep their value and reject edits and clearing', () => {
  const runtime = ready([
    update([
      shell('locked', 'off'),
      field('locked', { ...due, readOnly: true }),
      field('off', { ...due, disabled: true }),
    ]),
  ]);
  for (const id of ['locked', 'off']) {
    rejectsAtomically(runtime, () => runtime.chooseDateTime('records', id, '2026-10-15'));
    rejectsAtomically(runtime, () => runtime.chooseDateTime('records', id, null));
    assert.equal(picker(runtime, id).value, '2026-10-14');
  }
});

test('wrong surfaces, component IDs and component types are rejected; chooseValue is not overloaded', () => {
  const runtime = ready([update([shell('when', 'choice'), field('when', due), choice])]);
  for (const [surfaceId, componentId] of [
    ['missing', 'when'],
    ['records', 'missing'],
    ['records', 'root'],
    ['records', 'choice'],
  ])
    rejectsAtomically(runtime, () => runtime.chooseDateTime(surfaceId, componentId, '2026-10-15'));
  rejectsAtomically(runtime, () => runtime.chooseValue('records', 'when', '2026-10-15'));
  assert.equal(surface(runtime).blocks.choice.value, 'short');
  assert.equal(picker(runtime).value, '2026-10-14');
});

test('stream status and frontpage audience guard date-time edits', () => {
  const streaming = receiving([update([shell('when'), field('when', due)])]);
  rejectsAtomically(streaming, () => streaming.chooseDateTime('records', 'when', '2026-10-15'));
  streaming.finishRequest('request-one', 'success');
  assert.equal(streaming.chooseDateTime('records', 'when', '2026-10-15').ok, true);

  for (const status of ['error', 'aborted']) {
    const runtime = ready([update([shell('when'), field('when', due)])]);
    runtime.beginRequest('request-two');
    rejectsAtomically(runtime, () => runtime.chooseDateTime('records', 'when', '2026-10-15'));
    runtime.finishRequest('request-two', status);
    assert.equal(runtime.getSnapshot().status, status);
    rejectsAtomically(runtime, () => runtime.chooseDateTime('records', 'when', '2026-10-15'));
    assert.equal(picker(runtime).value, '2026-10-14');
  }

  const publicCreate = {
    version: 'v0.9',
    createSurface: { surfaceId: 'records', catalogId: publicCatalog },
  };
  for (const commands of [
    [publicCreate, update([shell('when'), field('when', due)])],
    [
      publicCreate,
      data('/state/when', { dateTime: due }),
      update([shell('when'), bound('when', '/state/when')]),
    ],
  ]) {
    const runtime = createGenUIRuntime({ scopeId: 'public-scope', audience: 'frontpage' });
    runtime.beginRequest('request-one');
    assert.equal(runtime.applyBatch({ requestId: 'request-one', sequence: 1, commands }).ok, false);
    assert.equal(runtime.getSnapshot().surfaces.length, 0);
    runtime.finishRequest('request-one', 'success');
    assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, false);
  }
});

test('local choices never mutate the source binding and survive unrelated updates and new requests', () => {
  const host = { dateTime: { ...due } };
  const runtime = ready([
    data('/state/when', host),
    update([shell('when'), bound('when', '/state/when')]),
  ]);
  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, true);
  assert.equal(picker(runtime).value, '2026-10-15');
  assert.deepEqual(surface(runtime).data.state.when, { dateTime: due });
  assert.equal(host.dateTime.value, '2026-10-14');
  rejectsAtomically(runtime, () => runtime.chooseDateTime('records', 'when', '2026-02-30'));

  runtime.beginRequest('request-two');
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-two',
      sequence: 1,
      commands: [data('/state/unrelated', true)],
    }).ok,
    true,
  );
  assert.equal(picker(runtime).value, '2026-10-15');
  assert.equal(source(runtime).value, '2026-10-14');
  runtime.finishRequest('request-two', 'success');

  runtime.beginRequest('request-three');
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-three',
      sequence: 1,
      commands: [
        update([
          {
            id: 'root',
            component: 'AtlasTaskSurface',
            payload: { path: '/state/missing' },
            children: ['when'],
          },
        ]),
      ],
    }).ok,
    true,
  );
  runtime.finishRequest('request-three', 'success');
  assert.equal(runtime.getSnapshot().status, 'error');
  assert.equal(picker(runtime).value, '2026-10-15');
  runtime.beginRequest('request-four');
  assert.equal(picker(runtime).value, '2026-10-15');
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-four',
      sequence: 1,
      commands: [data('/state/note', 'fresh')],
    }).ok,
    true,
  );
  runtime.finishRequest('request-four', 'success');
  assert.equal(picker(runtime).value, '2026-10-15');
  assert.equal(source(runtime).value, '2026-10-14');
  assert.equal(runtime.chooseDateTime('records', 'when', null).ok, true);
  assert.equal(picker(runtime).value, null);
});

test('bound source changes reconcile the local override by the date-time contract', () => {
  const start = (model = due) => {
    const runtime = ready([
      data('/state/when', { dateTime: model }),
      data('/state/other', { dateTime: model }),
      update([shell('when'), bound('when', '/state/when')]),
    ]);
    return runtime;
  };

  let runtime = start();
  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, true);
  const relabeled = { ...due, label: 'Teslim tarihi', maxDate: '2026-10-31' };
  assert.equal(
    stream(runtime, 'request-two', [data('/state/when', { dateTime: relabeled })]).ok,
    true,
  );
  assert.deepEqual(picker(runtime), { ...relabeled, value: '2026-10-15' });
  assert.deepEqual(source(runtime), relabeled);

  runtime = start();
  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, true);
  const chosen = runtime.getSnapshot().revision;
  const moved = { ...due, value: '2026-10-21' };
  assert.equal(stream(runtime, 'request-two', [data('/state/when', { dateTime: moved })]).ok, true);
  assert.deepEqual(picker(runtime), moved);
  assert.equal(stream(runtime, 'request-three', [data('/state/note', 'fresh')]).ok, true);
  assert.equal(picker(runtime).value, '2026-10-21');
  assert.equal(runtime.restoreRevision(chosen).ok, true);
  assert.equal(picker(runtime).value, '2026-10-15');
  assert.equal(source(runtime).value, '2026-10-14');

  runtime = start();
  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, true);
  assert.equal(stream(runtime, 'request-two', [update([bound('when', '/state/other')])]).ok, true);
  assert.deepEqual(picker(runtime), due);
  assert.equal(stream(runtime, 'request-three', [update([bound('when', '/state/when')])]).ok, true);
  assert.deepEqual(picker(runtime), due);

  for (const [initial, next] of [
    [
      { kind: 'date', label: 'Follow-up', value: null },
      { kind: 'datetime', label: 'Follow-up', value: null },
    ],
    [
      { ...due, value: '2026-10-01' },
      { ...due, unit: 'month', value: '2026-10-01' },
    ],
    [
      { ...due, value: '2026-10-01' },
      { ...due, multiple: true, value: ['2026-10-01'] },
    ],
  ]) {
    runtime = start(initial);
    assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, true);
    assert.equal(
      stream(runtime, 'request-two', [data('/state/when', { dateTime: next })]).ok,
      true,
    );
    assert.deepEqual(picker(runtime), next);
    assert.deepEqual(source(runtime), next);
  }

  runtime = start();
  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-20').ok, true);
  const blocked = { ...due, disabledDates: ['2026-10-20'] };
  assert.equal(
    stream(runtime, 'request-two', [data('/state/when', { dateTime: blocked })]).ok,
    true,
  );
  assert.deepEqual(picker(runtime), blocked);
  rejectsAtomically(runtime, () => runtime.chooseDateTime('records', 'when', '2026-10-20'));

  for (const model of [
    { ...due, value: '2026-02-30' },
    { ...due, minDate: '2026-10-15' },
  ]) {
    runtime = start();
    assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-16').ok, true);
    runtime.beginRequest('request-two');
    rejectsAtomically(runtime, () =>
      runtime.applyBatch({
        requestId: 'request-two',
        sequence: 1,
        commands: [data('/state/note', 'fresh'), data('/state/when', { dateTime: model })],
      }),
    );
    runtime.finishRequest('request-two', 'success');
    assert.equal(picker(runtime).value, '2026-10-16');
    assert.deepEqual(source(runtime), due);
    assert.equal(surface(runtime).data.state.note, undefined);
  }
});

test('node removal and surface recreation prune overrides; revision restore brings back local choices', () => {
  const runtime = ready([
    data('/state/when', { dateTime: due }),
    update([shell('when'), bound('when', '/state/when')]),
  ]);
  const start = runtime.getSnapshot().revision;
  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, true);
  const chosen = runtime.getSnapshot().revision;
  assert.equal(runtime.chooseDateTime('records', 'when', null).ok, true);

  assert.equal(runtime.restoreRevision(chosen).ok, true);
  assert.equal(runtime.getSnapshot().status, 'success');
  assert.equal(picker(runtime).value, '2026-10-15');
  assert.deepEqual(source(runtime), due);
  assert.equal(runtime.restoreRevision(start).ok, true);
  assert.equal(picker(runtime).value, '2026-10-14');
  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-16').ok, true);
  assert.equal(picker(runtime).value, '2026-10-16');

  runtime.beginRequest('request-two');
  assert.equal(
    runtime.applyBatch({ requestId: 'request-two', sequence: 1, commands: [update([shell()])] }).ok,
    true,
  );
  assert.equal(surface(runtime).blocks.when, undefined);
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-two',
      sequence: 2,
      commands: [update([shell('when'), bound('when', '/state/when')])],
    }).ok,
    true,
  );
  assert.equal(picker(runtime).value, '2026-10-14');
  runtime.finishRequest('request-two', 'success');

  assert.equal(runtime.chooseDateTime('records', 'when', '2026-10-15').ok, true);
  const generation = surface(runtime).generation;
  runtime.beginRequest('request-three');
  assert.equal(
    runtime.applyBatch({
      requestId: 'request-three',
      sequence: 1,
      commands: [
        { version: 'v0.9', deleteSurface: { surfaceId: 'records' } },
        create,
        data('/state/when', { dateTime: due }),
        update([shell('when'), bound('when', '/state/when')]),
      ],
    }).ok,
    true,
  );
  assert.equal(surface(runtime).generation, generation + 1);
  assert.equal(picker(runtime).value, '2026-10-14');
});
