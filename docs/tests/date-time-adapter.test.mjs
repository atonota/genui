import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { mountPattern } from './harness.mjs';

const imports = `import{useState}from'react';import dayjs from'dayjs';import GenUXProvider from'../src/react/GenUXProvider';import GenUXDateTime,{GenUXDateTimeRange}from'../src/react/GenUXDateTime';import{GenUXSizeContext}from'../src/react/GenUXSizeProfile';const reference=dayjs('2026-10-14');`;

async function fixture(t, body) {
  const file = `docs/tests/.date-time-${randomUUID()}.tsx`;
  await writeFile(file, imports + body);
  t.after(() => unlink(file));
  const h = await mountPattern('default', file);
  t.after(() => h.dispose());
  return h;
}

function field(h, label) {
  const node = [...h.document.querySelectorAll('.genux-date-time label')].find(
    element => element.textContent.trim() === label,
  );
  assert.ok(node, `${label} label`);
  const input = h.document.getElementById(node.htmlFor);
  assert.equal(input?.tagName, 'INPUT', `${label} label must name the native picker input`);
  return { root: node.closest('.genux-date-time'), input };
}
const cell = (popup, title) => popup.querySelector(`td.ant-picker-cell-in-view[title="${title}"]`);
const text = (h, name) => h.document.querySelector(`[data-${name}]`).textContent;
async function open(h, { root, input }) {
  await h.click(input);
  await h.waitFor(() => root.querySelector('.genux-date-time-popup'), 'native picker popup');
  return root.querySelector('.genux-date-time-popup');
}

test('labelled single date commits a native calendar day once and clears once', async t => {
  const h = await fixture(
    t,
    `export default function Demo(){const[value,setValue]=useState(null);const[calls,setCalls]=useState([]);return <GenUXProvider appearance="docs"><GenUXDateTime label="Delivery date" help="Choose one calendar day." defaultPickerValue={reference} value={value} onChange={next=>{setValue(next);setCalls(c=>[...c,next?next.format('YYYY-MM-DD'):null])}}/><output data-value>{value?value.format('YYYY-MM-DD'):''}</output><output data-calls>{JSON.stringify(calls)}</output></GenUXProvider>}`,
  );
  const delivery = field(h, 'Delivery date');
  assert.equal(delivery.root.getAttribute('role'), 'group');
  const popup = await open(h, delivery);
  assert.ok(popup.classList.contains('genux-control'));
  assert.ok(popup.querySelector('.ant-picker-date-panel'), 'native date panel');
  assert.equal(text(h, 'calls'), '[]');
  await h.click(cell(popup, '2026-10-15'));
  assert.equal(text(h, 'calls'), '["2026-10-15"]');
  assert.equal(text(h, 'value'), '2026-10-15');
  assert.equal(delivery.input.value, '2026-10-15');
  await h.click(delivery.root.querySelector('.ant-picker-clear'));
  assert.equal(text(h, 'calls'), '["2026-10-15",null]');
  assert.equal(delivery.input.value, '');
});

test('range waits for both native endpoints and a disabled range cannot open or commit', async t => {
  const h = await fixture(
    t,
    `export default function Demo(){const fmt=v=>v?v.map(d=>d?d.format('YYYY-MM-DD'):null):null;const[value,setValue]=useState(null);const[calls,setCalls]=useState([]);const[locked,setLocked]=useState([reference.subtract(13,'day'),reference.subtract(11,'day')]);const[lockedCalls,setLockedCalls]=useState(0);return <GenUXProvider appearance="docs"><GenUXDateTimeRange label="Stay dates" defaultPickerValue={[reference,reference]} value={value} onChange={next=>{setValue(next);setCalls(c=>[...c,fmt(next)])}}/><GenUXDateTimeRange label="Locked stay" disabled value={locked} onChange={next=>{setLocked(next);setLockedCalls(n=>n+1)}}/><output data-calls>{JSON.stringify(calls)}</output><output data-locked>{JSON.stringify(fmt(locked))}</output><output data-locked-calls>{lockedCalls}</output></GenUXProvider>}`,
  );
  const stay = field(h, 'Stay dates');
  const popup = await open(h, stay);
  assert.equal(popup.querySelectorAll('.ant-picker-date-panel').length, 2, 'native range panels');
  await h.click(cell(popup, '2026-10-05'));
  assert.equal(text(h, 'calls'), '[]', 'a start date alone must not commit');
  await h.click(cell(popup, '2026-10-09'));
  assert.equal(text(h, 'calls'), '[["2026-10-05","2026-10-09"]]');
  const [start, end] = stay.root.querySelectorAll('input');
  assert.equal(start.value, '2026-10-05');
  assert.equal(end.value, '2026-10-09');

  const locked = field(h, 'Locked stay');
  assert.equal(locked.input.disabled, true);
  await h.click(locked.root.querySelector('.ant-picker'));
  assert.equal(locked.root.querySelector('.genux-date-time-popup'), null);
  assert.equal(locked.input.value, '2026-10-01');
  assert.equal(text(h, 'locked'), '["2026-10-01","2026-10-03"]');
  assert.equal(text(h, 'locked-calls'), '0');
});

test('quarter value survives an inherited size change and a moment waits for native confirmation', async t => {
  const h = await fixture(
    t,
    `export default function Demo(){const[size,setSize]=useState('md');const[quarter,setQuarter]=useState(null);const[moment,setMoment]=useState(null);const[momentCalls,setMomentCalls]=useState(0);return <GenUXProvider appearance="docs"><GenUXSizeContext.Provider value={size}><button type="button" data-grow onClick={()=>setSize('lg')}>Large</button><GenUXDateTime label="Reporting quarter" mode="quarter" defaultPickerValue={reference} value={quarter} onChange={setQuarter}/><GenUXDateTime label="Meeting start" mode="moment" defaultPickerValue={reference} value={moment} onChange={next=>{setMoment(next);setMomentCalls(n=>n+1)}}/></GenUXSizeContext.Provider><output data-quarter>{quarter?quarter.format('YYYY-[Q]Q'):''}</output><output data-moment>{moment?moment.format('YYYY-MM-DD'):''}</output><output data-moment-calls>{momentCalls}</output></GenUXProvider>}`,
  );
  const quarter = field(h, 'Reporting quarter');
  assert.equal(quarter.root.dataset.size, 'md');
  const quarterPopup = await open(h, quarter);
  assert.ok(quarterPopup.querySelector('.ant-picker-quarter-panel'), 'native quarter panel');
  await h.click(cell(quarterPopup, '2026-Q4'));
  assert.equal(text(h, 'quarter'), '2026-Q4');
  const shown = quarter.input.value;
  assert.match(shown, /Q4/);
  await h.click(h.document.querySelector('[data-grow]'));
  assert.equal(quarter.root.dataset.size, 'lg');
  assert.ok(quarter.root.querySelector('.ant-picker').classList.contains('ant-picker-large'));
  assert.equal(field(h, 'Reporting quarter').input, quarter.input, 'size change must not remount');
  assert.equal(quarter.input.value, shown);
  assert.equal(text(h, 'quarter'), '2026-Q4');

  const meeting = field(h, 'Meeting start');
  const momentPopup = await open(h, meeting);
  assert.ok(momentPopup.querySelector('.ant-picker-date-panel'), 'native date panel');
  assert.ok(momentPopup.querySelector('.ant-picker-time-panel'), 'native time panel');
  await h.click(cell(momentPopup, '2026-10-15'));
  assert.equal(text(h, 'moment-calls'), '0', 'a moment commits only after native OK');
  await h.click(momentPopup.querySelector('.ant-picker-ok button'));
  assert.equal(text(h, 'moment-calls'), '1');
  assert.equal(text(h, 'moment'), '2026-10-15');
});

test('Working hours demo range publishes an ordered HH:mm:ss pair only after both native confirmations and clears', async t => {
  const h = await mountPattern('default', 'docs/src/react/DateTimeDemo.tsx');
  t.after(() => h.dispose());
  const hours = field(h, 'Working hours');
  assert.equal(hours.root.dataset.genuxDateTime, 'time');
  const result = [...h.document.querySelectorAll('output')].find(
    output => output.getAttribute('for') === hours.input.id,
  );
  assert.ok(result, 'the existing Example output names the field');
  assert.equal(result.textContent, 'Nothing selected');
  const [start, end] = hours.root.querySelectorAll('input');
  assert.equal(start, hours.input);
  const pick = async (...values) => {
    const popup = hours.root.querySelector('.genux-date-time-popup');
    const columns = popup.querySelectorAll('.ant-picker-time-panel-column');
    assert.equal(columns.length, 3, 'native hour, minute and second columns');
    for (const [index, value] of values.entries()) {
      const label = String(value).padStart(2, '0');
      const cell = [...columns[index].querySelectorAll('.ant-picker-time-panel-cell')].find(
        item => item.textContent.trim() === label,
      );
      assert.ok(cell, `${label} native time cell`);
      await h.click(cell);
    }
  };
  const confirm = () =>
    h.click(hours.root.querySelector('.genux-date-time-popup .ant-picker-ok button'));
  await open(h, hours);
  await pick(9, 15, 30);
  assert.equal(result.textContent, 'Nothing selected', 'start cells alone must not commit');
  await confirm();
  assert.equal(result.textContent, 'Nothing selected', 'a confirmed start alone must not commit');
  await h.waitFor(() => h.document.activeElement === end, 'native end field becomes active');
  assert.ok(hours.root.querySelector('.genux-date-time-popup'), 'popup stays open for the end');
  await pick(17, 30, 45);
  assert.equal(
    result.textContent,
    'Nothing selected',
    'end cells must not commit before native OK',
  );
  await confirm();
  assert.equal(result.textContent, '09:15:30 to 17:30:45');
  assert.equal(start.value, '09:15:30');
  assert.equal(end.value, '17:30:45');
  await h.click(hours.root.querySelector('.ant-picker-clear'));
  assert.equal(result.textContent, 'Nothing selected');
  assert.equal(start.value, '');
  assert.equal(end.value, '');
});
