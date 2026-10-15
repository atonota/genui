import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import { mountPattern } from './harness.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(testDirectory, '../..');
const stylesheet = resolve(testDirectory, '../src/styles/interaction-feedback.css');

// Selectors come from the shipped stylesheet and are matched against DOM nodes.
// This is source/DOM evidence only; JSDOM does not compute cascaded cursors.
async function readonlyCursorSelectors() {
  const root = postcss.parse(await readFile(stylesheet, 'utf8'), { from: stylesheet });
  const selectors = [];
  root.walkDecls('cursor', declaration => {
    if (!declaration.value.includes('--readonly-cursor')) return;
    const rule = declaration.parent;
    assert.equal(rule.type, 'rule', 'the read-only cursor is declared by a selector rule');
    assert.notEqual(
      rule.parent.type,
      'rule',
      'nested selectors would need resolution before DOM matching',
    );
    selectors.push(...rule.selectors);
  });
  assert.ok(selectors.length > 0, 'the stylesheet still declares a read-only cursor');
  return selectors;
}

const selectors = await readonlyCursorSelectors();
const locks = element => selectors.some(selector => element.matches(selector));
const describe = node => `<${node.localName} class="${node.getAttribute('class') ?? ''}">`;

const fixtureSource = `import { Cascader, DatePicker, Input, InputNumber, Select, TreeSelect } from 'antd';

const options = [
  { value: 'design', label: 'Design' },
  { value: 'operations', label: 'Operations' },
];

export function ReadonlyCursorFixture({
  onSelectChange,
}: {
  onSelectChange: (value: string) => void;
}) {
  return (
    <div>
      <Select id="cursor-select" options={options} defaultValue="design" onChange={onSelectChange} />
      <Select id="cursor-select-disabled" options={options} defaultValue="design" disabled />
      <TreeSelect id="cursor-tree-select" treeData={[{ value: 'design', title: 'Design' }]} />
      <Cascader id="cursor-cascader" options={options} />
      <DatePicker id="cursor-date" inputReadOnly />
      <Input id="cursor-input" readOnly value="Istanbul" />
      <Input id="cursor-affix" readOnly value="Istanbul" suffix={<span>Locked</span>} />
      <Input.TextArea id="cursor-textarea" readOnly value="Note" />
      <InputNumber id="cursor-number" readOnly value={42} />
      <InputNumber id="cursor-number-disabled" readOnly disabled value={42} />
      <Input id="cursor-editable" defaultValue="Editable" />
      <Input id="cursor-disabled" readOnly disabled value="Unavailable" />
    </div>
  );
}
`;

test('Read-only cursor excludes enabled native selection triggers and keeps true read-only entry locked', async () => {
  const entry = `docs/tests/.readonly-cursor-${randomUUID()}.tsx`;
  const fixture = resolve(projectDirectory, entry);
  const values = [];
  let h;
  await writeFile(fixture, fixtureSource, { flag: 'wx' });
  try {
    h = await mountPattern('ReadonlyCursorFixture', entry, {
      onSelectChange: value => values.push(value),
    });
    h.document.body.setAttribute('data-atlas-surface', 'docs');
    const byId = id => {
      const element = h.document.getElementById(id);
      assert.ok(element, `${id} is rendered`);
      return element;
    };

    for (const id of [
      'cursor-select',
      'cursor-select-disabled',
      'cursor-tree-select',
      'cursor-cascader',
      'cursor-date',
    ]) {
      const input = byId(id);
      assert.equal(input.readOnly, true, `${id} uses a native read-only selection input`);
      const owner = input.closest('.ant-select, .ant-picker');
      assert.ok(owner, `${id} has a native trigger`);
      for (const node of [owner, ...owner.querySelectorAll('*')])
        assert.equal(locks(node), false, `${id} ${describe(node)} keeps its selection cursor`);
    }

    for (const id of ['cursor-input', 'cursor-affix', 'cursor-textarea', 'cursor-number']) {
      const field = byId(id);
      assert.equal(field.readOnly, true);
      assert.equal(field.disabled, false);
      assert.equal(locks(field), true, `${id} keeps the read-only cursor`);
    }
    assert.equal(
      locks(byId('cursor-number').closest('.ant-input-number')),
      true,
      'readonly number wrapper locks',
    );
    const disabledNumber = byId('cursor-number-disabled');
    assert.equal(locks(disabledNumber), false, 'disabled number input does not lock');
    assert.equal(
      locks(disabledNumber.closest('.ant-input-number')),
      false,
      'disabled number wrapper does not lock',
    );
    const affix = byId('cursor-affix').closest('.ant-input-affix-wrapper');
    assert.ok(affix, 'the suffixed read-only Input has an affix surface');
    assert.equal(locks(affix), true, 'the affix surface around a read-only value stays locked');
    assert.equal(locks(byId('cursor-editable')), false, 'editable text entry is never locked');
    const disabled = byId('cursor-disabled');
    assert.equal(disabled.disabled, true);
    assert.equal(locks(disabled), false, 'a disabled field cannot acquire the read-only lock');

    const select = byId('cursor-select');
    const control = select.closest('.ant-select');
    await h.act(async () => {
      control.dispatchEvent(
        new h.window.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    await h.waitFor(() => select.getAttribute('aria-expanded') === 'true', 'Select popup opens');
    assert.equal(locks(select), false, 'the open combobox keeps its selection cursor');
    const option = () =>
      [...h.document.querySelectorAll('.ant-select-item-option')].find(
        item => item.textContent.trim() === 'Operations',
      );
    await h.waitFor(() => option(), 'Select option Operations');
    await h.click(option());
    await h.waitFor(() => select.getAttribute('aria-expanded') === 'false', 'Select popup closes');
    assert.deepEqual(values, ['operations'], 'the native choice commits once');
    assert.match(control.textContent, /Operations/);
    assert.equal(locks(select), false);
  } finally {
    try {
      if (h) {
        // Trigger alignment can queue paints after closing; settle inside act.
        try {
          await h.act(async () => {
            await new Promise(resolve =>
              h.window.requestAnimationFrame(() => h.window.requestAnimationFrame(resolve)),
            );
          });
        } finally {
          await h.dispose();
        }
      }
    } finally {
      await unlink(fixture);
    }
  }
});

test('Explicit aria-readonly comboboxes lock while disabled read-only fields do not', t => {
  const dom = new JSDOM(
    `<!doctype html><html><body data-atlas-surface="docs"><main>
    <div class="ant-select"><div class="ant-select-selector">
      <input id="readonly-combobox" role="combobox" readonly aria-readonly="true" aria-expanded="false">
    </div></div>
    <input id="semantic-readonly" role="combobox" aria-readonly="true" aria-expanded="false">
    <input id="semantic-enabled" role="combobox" aria-readonly="false" aria-expanded="false">
    <input id="plain-readonly" readonly value="Copy me">
    <input id="disabled-readonly" readonly disabled value="Unavailable">
    <textarea id="disabled-readonly-text" readonly disabled>Unavailable</textarea>
    <span id="disabled-affix" class="ant-input-affix-wrapper ant-input-affix-wrapper-disabled"><input id="disabled-affix-input" readonly disabled></span>
    <fieldset disabled><input id="fieldset-readonly" readonly value="Unavailable"></fieldset>
    </main></body></html>`,
  );
  t.after(() => dom.window.close());
  const get = id => dom.window.document.getElementById(id);
  assert.equal(locks(get('readonly-combobox')), true, 'an explicitly read-only combobox locks');
  assert.equal(locks(get('semantic-readonly')), true, 'semantic-only readonly combobox locks');
  assert.equal(locks(get('semantic-enabled')), false, 'enabled semantic combobox does not lock');
  assert.equal(locks(get('plain-readonly')), true, 'a plain read-only value locks');
  for (const id of [
    'disabled-readonly',
    'disabled-readonly-text',
    'disabled-affix',
    'disabled-affix-input',
    'fieldset-readonly',
  ])
    assert.equal(locks(get(id)), false, `${id} keeps its disabled cursor`);
});
