import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectDirectory = fileURLToPath(new URL('../..', import.meta.url));
const modulePath = new URL(`./.date-time-model-${randomUUID()}.mjs`, import.meta.url);
let validate;

before(async () => {
  const compiled = await build({
    absWorkingDir: projectDirectory,
    stdin: {
      contents: "export * from './docs/src/data/date-time-model';",
      resolveDir: projectDirectory,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    packages: 'external',
    format: 'esm',
    platform: 'node',
  });
  await writeFile(modulePath, compiled.outputFiles[0].contents, { flag: 'wx' });
  ({ validateDateTimeModel: validate } = await import(modulePath.href));
});
after(() =>
  unlink(modulePath).catch(failure => {
    if (failure.code !== 'ENOENT') throw failure;
  }),
);

const model = (kind, value, extra = {}) => ({ kind, label: 'When', value, ...extra });
const date = (value, extra) => model('date', value, extra);
function accepts(input) {
  const result = validate(input);
  assert.deepEqual(result.value, input.value, `${JSON.stringify(input.value)} keeps its value`);
  return result;
}
function rejects(input, why) {
  assert.throws(() => validate(input), Error, why);
}

test('calendar dates accept leap days and reject rollover without coercion', () => {
  for (const value of ['2024-02-29', '2000-02-29', '2026-12-31', null]) accepts(date(value));
  for (const value of [
    '2025-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-10-1',
    '26-10-14',
    ' 2026-10-14',
    '2026/10/14',
    '2026-10-14T00:00:00',
    20261014,
    true,
  ])
    rejects(date(value), `date ${JSON.stringify(value)}`);
  const { value: _omitted, ...withoutValue } = date('2026-10-14');
  rejects(withoutValue, 'value is required; null is the empty state');
});

test('wall times and local date-times are explicit and never shifted to UTC', () => {
  for (const value of ['00:00:00', '23:59:59', '12:30:15']) accepts(model('time', value));
  for (const value of [
    '24:00:00',
    '12:60:00',
    '12:00:60',
    '8:00:00',
    '12:00',
    '12:00:00.000',
    '2026-10-14',
  ])
    rejects(model('time', value), `time ${value}`);
  // A wall time inside a DST gap is still a valid local value; the host resolves the zone.
  for (const value of ['2026-10-14T08:30:00', '2026-03-29T02:30:00', '2024-02-29T23:59:59'])
    accepts(model('datetime', value));
  for (const value of [
    '2026-10-14 08:00:00',
    '2026-10-14T08:00:00Z',
    '2026-10-14T08:00:00+03:00',
    '2026-10-14T08:00',
    '2026-02-30T08:00:00',
    '2026-10-14T24:00:00',
    '2026-10-14',
    '08:00:00',
  ])
    rejects(model('datetime', value), `datetime ${value}`);
  rejects(date('08:00:00'), 'date kind does not accept a time');
});

test('selection units require their canonical anchors, including range endpoints', () => {
  accepts(date('2026-10-14', { unit: 'date' }));
  accepts(date('2026-10-01', { unit: 'month' }));
  rejects(date('2026-10-14', { unit: 'month' }), 'month anchors on the first day');
  for (const value of ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01'])
    accepts(date(value, { unit: 'quarter' }));
  for (const value of ['2026-08-01', '2026-07-02'])
    rejects(date(value, { unit: 'quarter' }), `quarter ${value}`);
  accepts(date('2026-01-01', { unit: 'year' }));
  rejects(date('2026-06-01', { unit: 'year' }), 'year anchors on January 1');
  accepts(date('2026-10-12', { unit: 'week' }));
  for (const value of ['2026-10-14', '2026-10-11'])
    rejects(date(value, { unit: 'week' }), `week ${value} is not a Monday`);
  accepts(model('date-range', ['2026-01-01', '2026-03-01'], { unit: 'month' }));
  rejects(model('date-range', ['2026-01-01', '2026-03-15'], { unit: 'month' }), 'range end anchor');
  rejects(date('2026-10-14', { unit: 'decade' }), 'unknown unit');
  rejects(model('time', '08:00:00', { unit: 'month' }), 'time has no calendar unit');
  rejects(
    model('time-range', ['08:00:00', '09:00:00'], { unit: 'week' }),
    'time range has no calendar unit',
  );
  rejects(model('datetime', '2026-10-01T08:00:00', { unit: 'month' }), 'datetime is day precision');
});

test('ranges require exactly two complete ordered values or null', () => {
  for (const value of [['2026-10-01', '2026-10-14'], ['2026-10-14', '2026-10-14'], null])
    accepts(model('date-range', value));
  for (const value of [
    [],
    ['2026-10-14'],
    ['2026-10-01', '2026-10-02', '2026-10-03'],
    ['2026-10-14', null],
    [null, '2026-10-14'],
    [null, null],
    ['2026-10-14', '2026-10-01'],
    ['2026-10-01', '2026-02-30'],
    '2026-10-14',
  ])
    rejects(model('date-range', value), `date range ${JSON.stringify(value)}`);
  accepts(model('time-range', ['08:00:00', '17:30:00']));
  rejects(model('time-range', ['17:30:00', '08:00:00']), 'reversed time range');
  accepts(model('datetime-range', ['2026-10-14T09:00:00', '2026-10-16T11:00:00']));
  rejects(
    model('datetime-range', ['2026-10-14T11:00:00', '2026-10-14T09:00:00']),
    'reversed wall time',
  );
  rejects(
    model('datetime-range', ['2026-10-14', '2026-10-16T11:00:00']),
    'mixed precision endpoint',
  );
});

test('multiple selection is date-only, bounded and unique', () => {
  accepts(date(['2026-10-14', '2026-10-16'], { multiple: true }));
  accepts(date(null, { multiple: true }));
  rejects(date(['2026-10-14', '2026-10-14'], { multiple: true }), 'duplicate dates');
  rejects(date(['2026-10-14', '2026-02-30'], { multiple: true }), 'invalid member');
  rejects(date(['2026-10-14', '2026-10-16']), 'arrays need multiple');
  rejects(date('2026-10-14', { multiple: 'yes' }), 'multiple is boolean');
  rejects(model('time', ['08:00:00'], { multiple: true }), 'time is not multiple');
  rejects(model('datetime', ['2026-10-14T08:00:00'], { multiple: true }), 'no multiple showTime');
  rejects(
    model('date-range', ['2026-10-01', '2026-10-14'], { multiple: true }),
    'no multiple ranges',
  );
  const many = Array.from({ length: 300 }, (_, day) =>
    new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10),
  );
  rejects(date(many, { multiple: true }), 'multiple selection is bounded');
});

test('calendar restrictions validate values inclusively and their own configuration', () => {
  const bounds = { minDate: '2026-10-05', maxDate: '2026-10-28' };
  for (const value of ['2026-10-05', '2026-10-28', null]) accepts(date(value, bounds));
  rejects(date('2026-10-04', bounds), 'before minDate');
  rejects(date('2026-10-29', bounds), 'after maxDate');
  rejects(date(null, { minDate: '2026-10-28', maxDate: '2026-10-05' }), 'reversed bounds');
  rejects(date(null, { minDate: '2026-02-30' }), 'invalid minDate');
  rejects(date(null, { maxDate: '2026-10-28T00:00:00' }), 'maxDate is a date');
  rejects(date('2026-10-21', { disabledDates: ['2026-10-21'] }), 'disabled date');
  rejects(date(null, { disabledDates: ['2026-02-30'] }), 'invalid disabled date');
  accepts(date('2026-10-16', { disabledWeekdays: [0, 6] }));
  rejects(date('2026-10-17', { disabledWeekdays: [0, 6] }), 'Saturday is disabled');
  for (const weekday of [7, -1, 1.5, '6'])
    rejects(date(null, { disabledWeekdays: [weekday] }), `weekday ${weekday}`);
  rejects(model('date-range', ['2026-10-01', '2026-10-14'], bounds), 'range start out of bounds');
  rejects(model('datetime', '2026-10-04T23:00:00', bounds), 'datetime day before minDate');
  rejects(
    model('datetime', '2026-10-18T09:00:00', { disabledWeekdays: [0] }),
    'datetime on disabled weekday',
  );
  rejects(
    date(['2026-10-14', '2026-10-21'], { multiple: true, disabledDates: ['2026-10-21'] }),
    'multiple member disabled',
  );
  rejects(
    model('time', '08:00:00', { minDate: '2026-10-05' }),
    'restrictions apply to calendar kinds',
  );
  rejects(
    model('time-range', ['08:00:00', '09:00:00'], { disabledWeekdays: [0] }),
    'time range has no weekdays',
  );
});

test('native options accept only supported finite choices', () => {
  for (const minuteStep of [1, 5, 10, 15, 30]) accepts(model('time', '08:30:00', { minuteStep }));
  for (const minuteStep of [7, 0, 60, '15', Infinity])
    rejects(model('time', '08:30:00', { minuteStep }), `minuteStep ${minuteStep}`);
  for (const variant of ['filled', 'outlined', 'borderless', 'underlined'])
    accepts(date(null, { variant }));
  rejects(date(null, { variant: 'solid' }), 'unknown variant');
  for (const status of ['error', 'warning']) accepts(date(null, { status }));
  rejects(date(null, { status: 'success' }), 'unknown status');
  rejects(date(null, { disabled: 'true' }), 'boolean flag');
  rejects(date(null, { label: '' }), 'empty label');
  rejects(date(null, { label: 42 }), 'text label');
  rejects({ kind: 'date', value: null }, 'label is required');
  rejects(date(null, { help: 7 }), 'help is text');
  rejects(model('datetime-local', null), 'unknown kind');
  accepts(
    date(null, {
      presets: [{ label: 'Last week', value: '2026-10-07' }],
      cellNotes: [{ date: '2026-10-20', label: 'Review' }],
    }),
  );
  accepts(
    model('date-range', null, {
      presets: [{ label: 'Last 7 days', value: ['2026-10-08', '2026-10-14'] }],
    }),
  );
  rejects(
    model('date-range', null, { presets: [{ label: 'Today', value: '2026-10-14' }] }),
    'preset shape follows kind',
  );
  rejects(date(null, { presets: [{ label: 'Bad', value: '2026-02-30' }] }), 'invalid preset value');
  rejects(date(null, { presets: [{ value: '2026-10-07' }] }), 'preset label');
  rejects(
    date(null, { presets: [{ label: 'Extra', value: null, hint: 'x' }] }),
    'preset exact keys',
  );
  rejects(
    date(null, { cellNotes: [{ date: '2026-02-30', label: 'Review' }] }),
    'invalid note date',
  );
  rejects(date(null, { cellNotes: [{ date: '2026-10-20', label: 1 }] }), 'note label');
  rejects(
    date(null, { cellNotes: [{ date: '2026-10-20', label: 'Review', color: 'red' }] }),
    'note exact keys',
  );
});

test('JSON boundary rejects unknown keys, accessors, host values and cycles without evaluating getters', () => {
  rejects(date(null, { onChange: 'x' }), 'unknown property');
  rejects(date(null, { format: 'YYYY' }), 'unknown property');
  let touched = false;
  const accessor = date(null);
  Object.defineProperty(accessor, 'help', {
    enumerable: true,
    get() {
      touched = true;
      return 'Help';
    },
  });
  rejects(accessor, 'accessor');
  const nested = { label: 'Lazy' };
  Object.defineProperty(nested, 'value', {
    enumerable: true,
    get() {
      touched = true;
      return null;
    },
  });
  rejects(date(null, { presets: [nested] }), 'nested accessor');
  assert.equal(touched, false, 'getters are never evaluated');
  rejects(date(new Date(Date.UTC(2026, 9, 14))), 'Date value');
  rejects(date(null, { minDate: new Date(Date.UTC(2026, 9, 14)) }), 'Date bound');
  rejects(date(null, { presets: [{ label: 'Now', value: () => '2026-10-14' }] }), 'function value');
  rejects(date(null, { disabledDates: new Map() }), 'host collection');
  rejects(Object.assign(new (class Model {})(), date(null)), 'class instance');
  rejects({ ...date(null), [Symbol('kind')]: 'date' }, 'symbol key');
  rejects(
    JSON.parse('{"kind":"date","label":"When","value":null,"__proto__":{"disabled":true}}'),
    'unsafe key',
  );
  const notes = [];
  notes.push(notes);
  rejects(date(null, { cellNotes: notes }), 'cycle');
  rejects(model('time', null, { minuteStep: Number.NaN }), 'nonfinite');
  for (const root of [null, undefined, [], 'date', 1]) rejects(root, `root ${String(root)}`);
});

test('validation is deterministic, clock-independent and leaves frozen input untouched', () => {
  const freeze = value => {
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
    return value;
  };
  const input = freeze(
    model('date-range', ['2099-12-01', '2099-12-31'], {
      maxDate: '2100-01-01',
      presets: [{ label: 'December', value: ['2099-12-01', '2099-12-31'] }],
    }),
  );
  const snapshot = JSON.stringify(input);
  const RealDate = globalThis.Date;
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (!args.length) throw new Error('Validation read the system clock.');
      super(...args);
    }
    static now() {
      throw new Error('Validation read the system clock.');
    }
  };
  try {
    const first = validate(input);
    assert.deepEqual(first.value, ['2099-12-01', '2099-12-31']);
    assert.deepEqual(validate(input), first);
  } finally {
    globalThis.Date = RealDate;
  }
  assert.equal(JSON.stringify(input), snapshot);
});
