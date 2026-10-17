import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import dayjs from 'dayjs';
import { mountPattern } from './harness.mjs';

// Compare behaviour, not only the active locale name: mutating the existing English
// locale's weekStart keeps its name. A dedicated picker locale may still be registered.
const englishWeek = () => dayjs('2026-10-14').locale('en').startOf('week').format('YYYY-MM-DD');
const activeWeek = () => dayjs('2026-10-14').startOf('week').format('YYYY-MM-DD');
const unrelated = () => ({
  locale: dayjs.locale(),
  english: englishWeek(),
  active: activeWeek(),
});
const baseline = unrelated();

// Exactly one native fixture is mounted per Node test. Cleanup is registered before the
// temporary entry exists, runs once, and removes the entry even when disposal fails.
const cleanups = new WeakMap();
async function fixture(t, model, hostValue = null) {
  const file = `docs/tests/.date-time-${randomUUID()}.tsx`;
  let h;
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try {
      await h?.dispose();
    } finally {
      await unlink(file).catch(failure => {
        if (failure.code !== 'ENOENT') throw failure;
      });
    }
  };
  t.after(cleanup);
  // The parent owns value; every onChange is recorded so tests can prove exactly-once commits.
  await writeFile(
    file,
    `import{useState}from'react';import GenUXProvider from'../src/react/GenUXProvider';import{GenUXSizeContext}from'../src/react/GenUXSizeProfile';import GenUXDateTimePicker from'../src/react/GenUXDateTimePicker';const model=${JSON.stringify(model)};export default function Demo(){const[value,setValue]=useState(model.value);const[calls,setCalls]=useState([]);const[size,setSize]=useState('md');return <GenUXSizeContext.Provider value={size}><GenUXProvider><GenUXDateTimePicker id="when" model={{...model,value}} onChange={next=>{setValue(next);setCalls(list=>[...list,next])}}/><output data-value>{JSON.stringify(value)}</output><output data-calls>{JSON.stringify(calls)}</output><button type="button" data-host onClick={()=>setValue(${JSON.stringify(hostValue)})}>Host update</button><button type="button" data-size onClick={()=>setSize('lg')}>Large</button></GenUXProvider></GenUXSizeContext.Provider>}`,
    { flag: 'wx' },
  );
  h = await mountPattern('default', file);
  cleanups.set(h, cleanup);
  return h;
}
// Disposes a fixture inside its own test; the registered after-hook then has nothing left to do.
const dispose = h => cleanups.get(h)();

const calls = h => JSON.parse(h.document.querySelector('[data-calls]').textContent);
const current = h => JSON.parse(h.document.querySelector('[data-value]').textContent);
const field = h => h.document.querySelector('.ant-picker');
const input = h => field(h).querySelector('input');
const rangeInputs = h => [...field(h).querySelectorAll('input')];
const popup = h =>
  [...h.document.querySelectorAll('.ant-picker-dropdown')].find(
    node => !node.classList.contains('ant-picker-dropdown-hidden'),
  );
const cell = (h, title) => popup(h)?.querySelector(`td.ant-picker-cell-in-view[title="${title}"]`);
// The installed TimeColumn attaches its click handler to the LI itself.
const timeCell = (h, column, value) =>
  popup(h)
    ?.querySelectorAll('.ant-picker-time-panel-column')
    [column]?.querySelector(`li[data-value="${value}"]`);
const okButton = h => popup(h)?.querySelector('.ant-picker-ok button');
const presetItem = (h, label) =>
  [...(popup(h)?.querySelectorAll('.ant-picker-presets li') ?? [])].find(
    item => item.textContent.trim() === label,
  );
const isActive = element =>
  element.closest('.ant-picker-input').classList.contains('ant-picker-input-active');

// Focus the actual native input first, then click it, as verified by the native probe.
async function open(h, target = input(h)) {
  await h.act(async () => target.focus());
  await h.click(target);
  await h.waitFor(() => popup(h), 'native picker popup opens');
}
async function key(h, target, key, code) {
  await h.act(async () =>
    target.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key,
        keyCode: code,
        which: code,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
}
async function escape(h, target = input(h)) {
  await key(h, target, 'Escape', 27);
  await h.waitFor(() => !popup(h), 'Escape closes the popup');
}
function nameOf(h, element) {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy)
    return labelledBy
      .split(/\s+/)
      .map(id => h.document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
  if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');
  return (
    (element.id && h.document.querySelector(`label[for="${element.id}"]`)?.textContent.trim()) || ''
  );
}
function describedText(h, element) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(id => h.document.getElementById(id)?.textContent ?? '')
    .join(' ');
}
function assertRangeNames(h, label) {
  const [start, end] = rangeInputs(h);
  assert.match(nameOf(h, start), new RegExp(label));
  assert.match(nameOf(h, end), new RegExp(label));
  assert.notEqual(nameOf(h, start), nameOf(h, end), 'start and end are distinguishable');
}
async function clear(h) {
  const button = field(h).querySelector('.ant-picker-clear');
  assert.ok(button?.getAttribute('aria-label'), 'native clear control is named');
  await h.click(button);
}
async function unitCase(t, unit, value, title, expected) {
  const h = await fixture(t, { kind: 'date', label: 'Period', unit, value, needConfirm: false });
  await open(h);
  await h.click(cell(h, title));
  assert.deepEqual(calls(h), [expected], `${unit} anchor`);
  return h;
}

test('field is named, associates help and error, and reports the invalid state', async t => {
  const h = await fixture(t, {
    kind: 'date',
    label: 'Due date',
    value: null,
    help: 'Weekdays only',
    error: 'Choose a weekday',
    status: 'error',
  });
  assert.match(nameOf(h, input(h)), /Due date/);
  assert.equal(input(h).getAttribute('aria-invalid'), 'true');
  const described = describedText(h, input(h));
  assert.match(described, /Weekdays only/);
  assert.match(described, /Choose a weekday/);
});

test('date without confirmation commits once; hover, navigation and invalid typing never publish', async t => {
  const h = await fixture(t, {
    kind: 'date',
    label: 'Due date',
    value: '2026-10-14',
    needConfirm: false,
  });
  await open(h);
  assert.equal(okButton(h), null, 'no confirmation step');
  assert.ok(cell(h, '2026-10-14').classList.contains('ant-picker-cell-selected'));
  await h.act(async () =>
    cell(h, '2026-10-20').dispatchEvent(new h.window.MouseEvent('mouseover', { bubbles: true })),
  );
  await h.click(popup(h).querySelector('.ant-picker-header-next-btn'));
  await h.click(popup(h).querySelector('.ant-picker-header-prev-btn'));
  assert.deepEqual(calls(h), []);
  await h.type(input(h), '2026-02-30');
  await key(h, input(h), 'Enter', 13);
  assert.deepEqual(calls(h), []);
  assert.equal(current(h), '2026-10-14');
  await escape(h);
  await open(h);
  await h.click(cell(h, '2026-10-20'));
  assert.deepEqual(calls(h), ['2026-10-20']);
});

test('date with confirmation keeps a draft until OK publishes once', async t => {
  const h = await fixture(t, {
    kind: 'date',
    label: 'Due date',
    value: '2026-10-14',
    needConfirm: true,
  });
  await open(h);
  await h.click(cell(h, '2026-10-20'));
  assert.deepEqual(calls(h), [], 'selection is a draft');
  assert.equal(current(h), '2026-10-14');
  await h.click(okButton(h));
  assert.deepEqual(calls(h), ['2026-10-20']);
});

test('Escape discards a pending datetime draft, closes and keeps field focus', async t => {
  const h = await fixture(t, { kind: 'datetime', label: 'Starts', value: '2026-10-14T08:00:00' });
  await open(h);
  await h.click(cell(h, '2026-10-15'));
  await h.click(timeCell(h, 0, 9));
  assert.deepEqual(calls(h), [], 'datetime waits for confirmation');
  await escape(h);
  assert.equal(h.document.activeElement, input(h));
  assert.deepEqual(calls(h), []);
  assert.equal(current(h), '2026-10-14T08:00:00');
  await open(h);
  assert.ok(
    cell(h, '2026-10-14').classList.contains('ant-picker-cell-selected'),
    'draft was discarded',
  );
});

test('datetime publishes one canonical local wall time only after OK', async t => {
  const h = await fixture(t, { kind: 'datetime', label: 'Starts', value: '2026-10-14T08:00:00' });
  await open(h);
  await h.click(cell(h, '2026-10-15'));
  await h.click(timeCell(h, 0, 9));
  await h.click(timeCell(h, 1, 30));
  assert.deepEqual(calls(h), []);
  await h.click(okButton(h));
  assert.deepEqual(calls(h), ['2026-10-15T09:30:00']);
});

test('time honours minute steps and hidden seconds and publishes only after OK', async t => {
  const h = await fixture(t, {
    kind: 'time',
    label: 'Start time',
    value: '08:00:00',
    minuteStep: 15,
    showSeconds: false,
    needConfirm: true,
  });
  await open(h);
  assert.equal(
    popup(h).querySelectorAll('.ant-picker-time-panel-column').length,
    2,
    'no seconds column',
  );
  assert.deepEqual(
    [
      ...popup(h)
        .querySelectorAll('.ant-picker-time-panel-column')[1]
        .querySelectorAll('li[data-value]'),
    ].map(item => item.getAttribute('data-value')),
    ['0', '15', '30', '45'],
  );
  await h.click(timeCell(h, 0, 9));
  await h.click(timeCell(h, 1, 30));
  assert.deepEqual(calls(h), []);
  assert.equal(current(h), '08:00:00');
  await h.click(okButton(h));
  assert.deepEqual(calls(h), ['09:30:00']);
});

test('12-hour time displays a meridiem without changing the canonical value', async t => {
  const h = await fixture(t, {
    kind: 'time',
    label: 'Start time',
    value: '13:30:00',
    use12Hours: true,
  });
  assert.match(input(h).value, /pm/i);
  assert.equal(current(h), '13:30:00');
  assert.deepEqual(calls(h), []);
});

test('clear emits null exactly once', async t => {
  const h = await fixture(t, {
    kind: 'date',
    label: 'Due date',
    value: '2026-10-14',
  });
  await clear(h);
  assert.deepEqual(calls(h), [null]);
  assert.equal(current(h), null);
  assert.equal(popup(h), undefined, 'clearing does not open the picker');
});

test('read-only is focusable, named and selectable, and cannot open, clear or change', async t => {
  const h = await fixture(t, {
    kind: 'date',
    label: 'Signed on',
    value: '2026-10-14',
    readOnly: true,
  });
  const shown = h.document.querySelector('[aria-readonly="true"]');
  assert.ok(shown, 'read-only state is exposed');
  assert.match(nameOf(h, shown), /Signed on/);
  assert.ok(shown.tabIndex >= 0, 'read-only value remains focusable');
  assert.notEqual(shown.disabled, true, 'read-only text stays selectable');
  assert.match(shown.value ?? shown.textContent, /2026/);
  assert.equal(h.document.querySelector('.ant-picker-clear'), null);
  await h.act(async () => shown.focus());
  assert.equal(h.document.activeElement, shown);
  await h.click(shown);
  await key(h, shown, 'Enter', 13);
  await key(h, shown, 'ArrowDown', 40);
  await key(h, shown, 'Delete', 46);
  assert.equal(popup(h), undefined);
  assert.deepEqual(calls(h), []);
  assert.equal(current(h), '2026-10-14');
});

test('disabled retains its value and cannot open or change', async t => {
  const h = await fixture(t, {
    kind: 'date',
    label: 'Locked',
    value: '2026-10-14',
    disabled: true,
  });
  assert.equal(input(h).disabled, true);
  assert.notEqual(input(h).value, '');
  assert.equal(h.document.querySelector('.ant-picker-clear'), null);
  await h.click(field(h));
  assert.equal(popup(h), undefined);
  assert.equal(current(h), '2026-10-14');
  assert.deepEqual(calls(h), []);
});

test('bounds, unavailable dates and weekends constrain native cells; notes keep the origin cell', async t => {
  const h = await fixture(t, {
    kind: 'date',
    label: 'Review day',
    value: '2026-10-14',
    needConfirm: false,
    minDate: '2026-10-05',
    maxDate: '2026-10-28',
    disabledDates: ['2026-10-21'],
    disabledWeekdays: [0, 6],
    cellNotes: [{ date: '2026-10-20', label: 'Review' }],
  });
  await open(h);
  for (const title of ['2026-10-02', '2026-10-29', '2026-10-21', '2026-10-17', '2026-10-18'])
    assert.ok(
      cell(h, title).classList.contains('ant-picker-cell-disabled'),
      `${title} is unavailable`,
    );
  for (const title of ['2026-10-05', '2026-10-15', '2026-10-28'])
    assert.equal(
      cell(h, title).classList.contains('ant-picker-cell-disabled'),
      false,
      `${title} is available`,
    );
  const noted = cell(h, '2026-10-20');
  assert.equal(
    noted.querySelector('.ant-picker-cell-inner')?.textContent.trim(),
    '20',
    'origin node is kept',
  );
  assert.match(noted.textContent, /Review/);
  await h.click(cell(h, '2026-10-17'));
  assert.deepEqual(calls(h), []);
  await h.click(cell(h, '2026-10-15'));
  assert.deepEqual(calls(h), ['2026-10-15']);
});

test('date range without confirmation keeps a half selection as draft and commits a complete pair', async t => {
  const h = await fixture(t, {
    kind: 'date-range',
    label: 'Stay',
    value: ['2026-10-05', '2026-10-09'],
    needConfirm: false,
  });
  assertRangeNames(h, 'Stay');
  const [start] = rangeInputs(h);
  await open(h, start);
  await h.click(cell(h, '2026-10-12'));
  assert.deepEqual(calls(h), [], 'half range is not published');
  assert.deepEqual(current(h), ['2026-10-05', '2026-10-09']);
  await escape(h, h.document.activeElement);
  assert.deepEqual(calls(h), []);
  assert.deepEqual(current(h), ['2026-10-05', '2026-10-09']);
  await open(h, rangeInputs(h)[0]);
  await h.click(cell(h, '2026-10-12'));
  await h.click(cell(h, '2026-10-20'));
  assert.deepEqual(calls(h), [['2026-10-12', '2026-10-20']]);
});

test('time range confirms the start, activates the native end, then publishes one ordered pair and clears', async t => {
  const h = await fixture(t, {
    kind: 'time-range',
    label: 'Opening hours',
    value: ['08:00:00', '12:00:00'],
    needConfirm: true,
  });
  assertRangeNames(h, 'Opening hours');
  const [start, end] = rangeInputs(h);
  await open(h, start);
  assert.ok(isActive(start), 'start field is active');
  await h.click(timeCell(h, 0, 9));
  assert.deepEqual(calls(h), [], 'start draft is not published');
  await h.click(okButton(h));
  assert.deepEqual(calls(h), [], 'a confirmed start alone is a partial range');
  await h.waitFor(
    () => isActive(rangeInputs(h)[1]) && h.document.activeElement === rangeInputs(h)[1],
    'native end field becomes active',
  );
  assert.equal(rangeInputs(h)[1], end);
  assert.ok(popup(h), 'popup stays open for the end');
  await h.click(timeCell(h, 0, 17));
  assert.deepEqual(calls(h), [], 'end draft is not published');
  await h.click(okButton(h));
  assert.deepEqual(calls(h), [['09:00:00', '17:00:00']]);
  assert.deepEqual(current(h), ['09:00:00', '17:00:00']);
  await clear(h);
  assert.deepEqual(calls(h), [['09:00:00', '17:00:00'], null]);
  assert.equal(current(h), null);
});

test('datetime range confirms each end and publishes canonical local wall times once, then clears', async t => {
  const h = await fixture(t, {
    kind: 'datetime-range',
    label: 'Reservation',
    value: ['2026-10-14T09:00:00', '2026-10-16T11:00:00'],
    needConfirm: true,
  });
  assertRangeNames(h, 'Reservation');
  const [start] = rangeInputs(h);
  await open(h, start);
  await h.click(cell(h, '2026-10-15'));
  await h.click(timeCell(h, 0, 10));
  assert.deepEqual(calls(h), [], 'start draft is not published');
  await h.click(okButton(h));
  assert.deepEqual(calls(h), [], 'a confirmed start alone is a partial range');
  await h.waitFor(
    () => isActive(rangeInputs(h)[1]) && h.document.activeElement === rangeInputs(h)[1],
    'native end field becomes active',
  );
  await h.click(cell(h, '2026-10-20'));
  await h.click(timeCell(h, 0, 12));
  assert.deepEqual(calls(h), [], 'end draft is not published');
  assert.deepEqual(current(h), ['2026-10-14T09:00:00', '2026-10-16T11:00:00']);
  await h.click(okButton(h));
  assert.deepEqual(calls(h), [['2026-10-15T10:00:00', '2026-10-20T12:00:00']]);
  await clear(h);
  assert.deepEqual(calls(h), [['2026-10-15T10:00:00', '2026-10-20T12:00:00'], null]);
  assert.equal(current(h), null);
});

test('native range preset commits a complete pair once', async t => {
  const h = await fixture(t, {
    kind: 'date-range',
    label: 'Report period',
    value: ['2026-10-01', '2026-10-07'],
    presets: [{ label: 'Last 7 days', value: ['2026-10-08', '2026-10-14'] }],
  });
  await open(h, rangeInputs(h)[0]);
  await h.click(presetItem(h, 'Last 7 days'));
  assert.deepEqual(calls(h), [['2026-10-08', '2026-10-14']]);
});

test('native single preset commits once', async t => {
  const h = await fixture(t, {
    kind: 'date',
    label: 'Due date',
    value: '2026-10-14',
    presets: [{ label: 'A week ago', value: '2026-10-07' }],
  });
  await open(h);
  await h.click(presetItem(h, 'A week ago'));
  assert.deepEqual(calls(h), ['2026-10-07']);
});

test('week presentation starts on Monday per instance and emits the Monday anchor', async t => {
  const selectedWeek = h =>
    [...popup(h).querySelectorAll('tr.ant-picker-week-panel-row-selected td[title]')]
      .map(item => item.getAttribute('title'))
      .filter(title => /^\d{4}-\d{2}-\d{2}$/.test(title));
  const h = await fixture(t, {
    kind: 'date',
    label: 'Period',
    unit: 'week',
    value: '2026-10-12',
    needConfirm: false,
  });
  assert.deepEqual(unrelated(), baseline, 'mounting leaves existing Day.js locales untouched');
  await open(h);
  assert.deepEqual(selectedWeek(h), [
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
    '2026-10-18',
  ]);
  await h.click(cell(h, '2026-10-22'));
  assert.deepEqual(calls(h), ['2026-10-19']);
  assert.deepEqual(unrelated(), baseline, 'selection leaves existing Day.js locales untouched');
  await h.act(() => h.setLocale('tr'));
  assert.deepEqual(unrelated(), baseline, 'locale change stays per instance');
  await open(h);
  assert.deepEqual(selectedWeek(h), [
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
  ]);
  await dispose(h);
  assert.deepEqual(unrelated(), baseline, 'disposal leaves existing Day.js locales untouched');
});

test('month selection emits the first-day anchor', async t => {
  await unitCase(t, 'month', '2026-10-01', '2026-12', '2026-12-01');
});

test('quarter selection emits the quarter-start anchor', async t => {
  await unitCase(t, 'quarter', '2026-10-01', '2026-Q3', '2026-07-01');
});

test('year selection emits the January 1 anchor', async t => {
  await unitCase(t, 'year', '2026-01-01', '2028', '2028-01-01');
});

test('multiple dates wait for confirmation and publish one unique set', async t => {
  const h = await fixture(t, {
    kind: 'date',
    label: 'Days off',
    value: ['2026-10-14'],
    multiple: true,
    needConfirm: true,
  });
  await open(h);
  await h.click(cell(h, '2026-10-16'));
  assert.deepEqual(calls(h), []);
  await h.click(okButton(h));
  assert.equal(calls(h).length, 1);
  assert.deepEqual([...calls(h)[0]].sort(), ['2026-10-14', '2026-10-16']);
});

test('host updates, size and locale changes keep the same native field and value', async t => {
  const h = await fixture(
    t,
    { kind: 'datetime', label: 'Starts', value: '2026-10-14T08:00:00' },
    '2026-11-02T10:00:00',
  );
  const nativeInput = input(h);
  await h.click(h.document.querySelector('[data-host]'));
  assert.deepEqual(calls(h), [], 'controlled host update is not echoed');
  await open(h);
  assert.ok(cell(h, '2026-11-02').classList.contains('ant-picker-cell-selected'));
  assert.equal(okButton(h).textContent.trim(), 'OK');
  await escape(h);
  await h.click(h.document.querySelector('[data-size]'));
  assert.ok(field(h).classList.contains('ant-picker-large'));
  await h.act(() => h.setLocale('tr'));
  assert.equal(input(h), nativeInput, 'field is not remounted');
  assert.equal(current(h), '2026-11-02T10:00:00');
  await open(h);
  assert.ok(cell(h, '2026-11-02').classList.contains('ant-picker-cell-selected'));
  assert.equal(okButton(h).textContent.trim(), 'Tamam');
  assert.deepEqual(calls(h), []);
});
