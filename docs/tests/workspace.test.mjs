import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';
import { mountPattern, selectOption } from './harness.mjs';

async function chooseView(h, label) {
  const desired = collectionModes.find(([, name]) => name === label)?.[0];
  if (h.document.querySelector('[data-collection-view]')?.dataset.collectionView === desired)
    return;
  const input = h.document.querySelector('#collection-view');
  await h.act(async () => {
    input
      .closest('.ant-select')
      .dispatchEvent(
        new h.window.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }),
      );
  });
  const visibleOption = [...h.document.querySelectorAll('.ant-select-item-option')].find(
    item => item.textContent.trim() === label,
  );
  if (visibleOption) {
    await h.click(visibleOption);
    return;
  }
  await h.act(async () => {
    input.focus();
    await delay(10);
  });
  const seen = new Set();
  for (let n = 0; n < 30; n++) {
    const activeId = input.getAttribute('aria-activedescendant');
    const active = h.document.getElementById(activeId);
    const text = active?.getAttribute('aria-label') ?? active?.textContent.trim();
    if (text === label) {
      await h.act(async () =>
        input.dispatchEvent(
          new h.window.KeyboardEvent('keydown', {
            key: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
          }),
        ),
      );
      await h.act(async () => {
        input.dispatchEvent(
          new h.window.KeyboardEvent('keyup', {
            key: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
          }),
        );
      });
      await h.waitFor(
        () => input.getAttribute('aria-expanded') === 'false',
        'view option committed: ' + label,
      );
      return;
    }
    if (seen.has(activeId)) break;
    seen.add(activeId);
    await h.act(async () =>
      input.dispatchEvent(
        new h.window.KeyboardEvent('keydown', {
          key: 'ArrowDown',
          keyCode: 40,
          which: 40,
          bubbles: true,
        }),
      ),
    );
  }
  assert.fail('View option unavailable: ' + label);
}

const compiled = await build({
  entryPoints: ['docs/src/data/workspace.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node24',
});
const model = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64')
);

test('workspace filtering, sorting and totals preserve zero, missing values and currency boundaries', () => {
  const records = model.initialRecords();
  assert.equal(records.length, 12);
  assert.notEqual(model.initialRecords()[0], records[0]);
  const zero = model.filterRecords(records, { minAmount: 0, maxAmount: 0 });
  assert.equal(zero.length, 1);
  assert.equal(zero[0].amount, 0);
  assert.equal(model.filterRecords(records, { query: 'istanbul' }).length, 4);
  assert.equal(model.filterRecords(records, { query: 'İSTANBUL' }).length, 4);
  for (const direction of ['asc', 'desc']) {
    const sorted = model.sortRecords(records, [{ field: 'amount', direction }]);
    assert.equal(sorted.at(-1).amount, null);
  }
  assert.deepEqual(
    model
      .currencyTotals(records)
      .map(total => total.currency)
      .sort(),
    ['EUR', 'USD'],
  );
  assert.notEqual(model.moneyText(0, 'USD', 'en'), model.moneyText(null, 'USD', 'en'));
  assert.equal(model.dateText('2026-02-31', 'en'), '—');
});

test('bulk changes distinguish unchanged, clear and set and exclude read-only records', () => {
  const records = model.initialRecords();
  const ids = [records[0].id, records[2].id];
  assert.equal(
    model.bulkUpdate(records, ids, { field: 'owner', mode: 'unchanged', value: '' }).appliedIds
      .length,
    0,
  );
  const clear = model.bulkUpdate(records, ids, { field: 'owner', mode: 'clear', value: '' });
  assert.equal(clear.records[0].owner, '');
  assert.equal(clear.records[2].owner, records[2].owner);
  assert.deepEqual(clear.excludedIds, [records[2].id]);
  const set = model.bulkUpdate(records, ids, { field: 'owner', mode: 'set', value: 'New owner' });
  assert.equal(set.records[0].owner, 'New owner');
  assert.equal(records[0].owner, 'Alex Reed', 'fixture remains immutable to callers');
});

test('collection examples preserve query and record identity when changing presentation', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/CollectionDemo.tsx');
  t.after(() => h.dispose());
  const search = h.document.querySelector('#collection-search');
  assert.ok(search, 'collection search must be available');
  await h.type(search, 'SP-26-0401');
  assert.match(h.document.body.textContent, /SP-26-0401/);
  await h.click(h.document.querySelector('#collection-desktop'));
  assert.equal(h.document.querySelector('#collection-search'), search);
  assert.equal(search.value, 'SP-26-0401');
  assert.ok(h.document.querySelector('.ant-table'), 'desktop table uses real Ant Design');
});

test('record details expose distinct presentation controls and actual record navigation', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordDetailsDemo.tsx');
  t.after(() => h.dispose());
  assert.ok(h.document.querySelector('#details-presentation'));
  const opener = h.document.querySelector('[data-record-open="SP-26-0401"]');
  assert.ok(opener);
  await h.click(opener);
  assert.ok(h.document.querySelector('#details-next'));
  await h.click(h.document.querySelector('#details-next'));
  assert.match(h.document.body.textContent, /SP-26-0402/);
});

test('record form organizations share mounted fields and authored drafts across locales', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordFormsDemo.tsx');
  t.after(() => h.dispose());
  const customer = h.document.querySelector('#record-form-customer');
  assert.ok(customer, 'shared customer field must be present');
  await h.type(customer, 'A user-authored customer');
  await h.click(h.document.querySelector('#forms-desktop'));
  assert.equal(h.document.querySelector('#record-form-customer'), customer);
  await h.act(async () => {
    customer.focus();
    await h.setLocale('tr');
  });
  assert.equal(customer.value, 'A user-authored customer');
  assert.equal(h.document.activeElement, customer);
});

const collectionModes = [
  ['table', 'Table'],
  ['list', 'List'],
  ['board', 'Board'],
  ['calendar', 'Calendar'],
  ['gantt', 'Gantt · date spans'],
  ['editable', 'Row editing'],
  ['grouped', 'Grouped table'],
  ['tree', 'Tree table'],
  ['pairs', 'Label and value'],
  ['compare', 'Comparison'],
  ['review', 'Review queue example'],
  ['bulk', 'Bulk edit example'],
];

test('collection modes share selection and distinguish empty, dated and editable records', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/CollectionDemo.tsx');
  t.after(() => h.dispose());
  await h.click(h.document.querySelector('#collection-select-visible'));
  for (const [value, label] of collectionModes) {
    await chooseView(h, label);
    assert.ok(h.document.querySelector(`[data-collection-view="${value}"]`), value);
    assert.match(
      h.document.querySelector('#collection-results').textContent,
      /12 selected records/,
    );
  }
  await chooseView(h, 'Calendar');
  assert.match(h.document.body.textContent, /1 undated records/);
  await h.click(h.document.querySelector('#collection-month-next'));
  assert.match(h.document.body.textContent, /November 2026/);
  assert.match(h.document.body.textContent, /No due dates in this month/);
  await chooseView(h, 'Row editing');
  assert.ok(h.document.querySelector('#collection-edit-SP-26-0403').disabled);
  await h.click(h.document.querySelector('#collection-edit-SP-26-0402'));
  const amount = h.document.querySelector('#collection-edit-amount');
  assert.equal(amount.value, '0');
  assert.equal(h.document.activeElement, amount);
  await h.type(amount, '-1');
  await h.submit(h.document.querySelector('#collection-editor'));
  assert.ok(h.document.querySelector('#collection-edit-error'));
  await h.type(amount, '');
  await h.submit(h.document.querySelector('#collection-editor'));
  assert.equal(h.document.querySelector('#collection-editor'), null);
  assert.match(h.document.body.textContent, /2 unknown amounts/);
  assert.equal(h.document.activeElement.id, 'collection-edit-SP-26-0402');
});

test('bulk preview freezes exact targets and invalidates when the operation changes', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/CollectionDemo.tsx');
  t.after(() => h.dispose());
  await h.click(h.document.querySelector('#collection-select-visible'));
  await chooseView(h, 'Bulk edit example');
  await selectOption(h, h.document.querySelector('#collection-bulk-mode'), 'Clear value');
  assert.ok(h.document.querySelector('#collection-bulk-apply').disabled);
  await h.click(h.document.querySelector('#collection-bulk-preview'));
  assert.match(
    h.document.querySelector('.collection-bulk-preview').textContent,
    /11 editable targets/,
  );
  assert.match(h.document.querySelector('.collection-bulk-preview').textContent, /SP-26-0403/);
  assert.match(
    h.document.querySelector('.collection-bulk-preview').textContent,
    /1 read-only records excluded/,
  );
  await selectOption(h, h.document.querySelector('#collection-bulk-field'), 'City');
  assert.equal(h.document.querySelector('.collection-bulk-preview'), null);
  assert.ok(h.document.querySelector('#collection-bulk-apply').disabled);
  await h.click(h.document.querySelector('#collection-bulk-preview'));
  await h.click(h.document.querySelector('#collection-bulk-apply'));
  assert.match(h.document.body.textContent, /11 records updated locally/);
  await h.type(h.document.querySelector('#collection-search'), 'SP-26-0403');
  assert.match(
    h.document.querySelector('#collection-results').textContent,
    /11 selected records are outside/,
  );
  await chooseView(h, 'Label and value');
  assert.match(h.document.querySelector('.collection-pairs-list').textContent, /Berlin/);
  await h.click(h.document.querySelector('#collection-open-SP-26-0403'));
  assert.match(h.document.querySelector('.collection-detail').textContent, /Cedar Office/);
});

test('filters combine with AND and preserve zero as an amount boundary', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/CollectionDemo.tsx');
  t.after(() => h.dispose());
  await h.click(h.document.querySelector('#collection-filters'));
  await h.type(h.document.querySelector('#collection-min'), '0');
  await h.type(h.document.querySelector('#collection-max'), '0');
  assert.match(
    h.document.querySelector('#collection-results').textContent,
    /1 of 12 loaded records/,
  );
  await h.click(h.document.querySelector('#collection-status-pending'));
  assert.match(
    h.document.querySelector('#collection-results').textContent,
    /0 of 12 loaded records/,
  );
  await h.click(h.document.querySelector('#collection-status-all'));
  await h.type(h.document.querySelector('#collection-min'), '1');
  assert.match(h.document.body.textContent, /keep the minimum at or below the maximum/);
});

test('detail drafts stay keyed by record and validate before local commit', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordDetailsDemo.tsx');
  t.after(() => h.dispose());
  const opener = h.document.querySelector('[data-record-open="SP-26-0401"]');
  await h.click(opener);
  await h.click(h.document.querySelector('#details-edit'));
  const customer = h.document.querySelector('#details-customer');
  assert.equal(h.document.activeElement, customer);
  await h.type(customer, 'Draft customer');
  await h.click(h.document.querySelector('#details-next'));
  await h.click(h.document.querySelector('#details-previous'));
  assert.equal(h.document.querySelector('#details-customer').value, 'Draft customer');
  await h.type(h.document.querySelector('#details-customer'), '');
  await h.submit(h.document.querySelector('.workspace-detail-form'));
  assert.ok(h.document.querySelector('#details-customer-error'));
  assert.equal(h.document.activeElement.id, 'details-customer');
  await h.type(h.document.querySelector('#details-customer'), 'Saved local customer');
  await h.submit(h.document.querySelector('.workspace-detail-form'));
  assert.match(
    h.document.querySelector('[data-details-record]').textContent,
    /Saved local customer/,
  );
  assert.equal(h.document.activeElement.id, 'details-edit');
  await h.click(h.document.querySelector('#details-next'));
  await h.click(h.document.querySelector('#details-next'));
  assert.equal(
    h.document.querySelector('[data-details-record]').dataset.detailsRecord,
    'SP-26-0403',
  );
  assert.ok(h.document.querySelector('#details-edit').disabled);
  await h.click(h.document.querySelector('#details-close'));
  assert.equal(h.document.activeElement, opener);
});

test('native detail overlays expose one dialog and retain a draft through close and reopen', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordDetailsDemo.tsx');
  t.after(() => h.dispose());
  await selectOption(h, h.document.querySelector('#details-presentation'), 'Modal');
  await h.click(h.document.querySelector('[data-record-open="SP-26-0401"]'));
  assert.equal(h.document.querySelectorAll('[role="dialog"]').length, 1);
  assert.equal(h.document.querySelectorAll('[data-details-record]').length, 1);
  await h.click(h.document.querySelector('#details-edit'));
  await h.type(h.document.querySelector('#details-notes'), 'Retained overlay note');
  await h.click(h.document.querySelector('#details-close'));
  await h.waitFor(() => !h.document.querySelector('[data-details-record]'), 'native overlay exit');
  await selectOption(h, h.document.querySelector('#details-presentation'), 'Bottom sheet');
  await h.click(h.document.querySelector('[data-record-open="SP-26-0401"]'));
  assert.equal(h.document.querySelectorAll('[data-details-record]').length, 1);
  assert.equal(h.document.querySelector('#details-notes').value, 'Retained overlay note');
});

test('form modes preserve one field tree, stable line identities and read-only actions', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordFormsDemo.tsx');
  t.after(() => h.dispose());
  const customer = h.document.querySelector('#record-form-customer');
  await h.type(customer, 'Retained author draft');
  const firstLine = h.document.querySelector('[data-line-id]');
  const firstProduct = firstLine.querySelector('input[id$="-product"]');
  for (const label of [
    'Single-page form',
    'Multi-step form',
    'Sectioned form',
    'Tabbed form',
    'Accordion form',
    'Order document with lines',
  ]) {
    await selectOption(h, h.document.querySelector('#record-form-mode'), label);
    assert.equal(h.document.querySelector('#record-form-customer'), customer);
    assert.equal(customer.value, 'Retained author draft');
    assert.equal(h.document.querySelectorAll('#record-form-customer').length, 1);
    assert.equal(h.document.querySelector('[data-line-id]'), firstLine);
  }
  await h.click(h.document.querySelector('#record-form-add-line'));
  assert.equal(h.document.querySelectorAll('[data-line-id]').length, 2);
  assert.equal(
    h.document.querySelector('[data-line-id]').querySelector('input[id$="-product"]'),
    firstProduct,
  );
  await h.click(h.document.querySelector('#record-form-readonly'));
  assert.ok(customer.disabled);
  assert.ok(h.document.querySelector('#record-form-add-line').disabled);
  assert.ok(h.document.querySelector('#record-form-submit').disabled);
});

test('form validation reveals the first invalid group and simulated failures retain authored values', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordFormsDemo.tsx');
  t.after(() => h.dispose());
  await h.type(h.document.querySelector('#record-form-customer'), 'Example customer');
  await h.type(h.document.querySelector('#record-form-email'), 'person@example.com');
  await h.type(h.document.querySelector('#record-form-due'), '');
  await h.click(h.document.querySelector('#record-form-submit'));
  await h.waitFor(
    () => h.document.activeElement.id === 'record-form-due',
    'invalid hidden date focus',
  );
  assert.equal(
    h.document.querySelector('[data-form-group="payment"]').getAttribute('aria-hidden'),
    'false',
  );
  await h.type(h.document.querySelector('#record-form-due'), '2026-10-20');
  await selectOption(h, h.document.querySelector('#record-form-billing-method'), 'Invoice');
  await h.click(h.document.querySelector('#record-form-submit'));
  await h.waitFor(
    () => h.document.activeElement.id === 'record-form-payment-terms',
    'conditional required field focus',
  );
  await h.type(h.document.querySelector('#record-form-payment-terms'), 'Net 30');
  await h.click(h.document.querySelector('#record-form-simulate-error'));
  await h.click(h.document.querySelector('#record-form-submit'));
  await h.waitFor(
    () => /Simulated save error/.test(h.document.querySelector('#record-form-result').textContent),
    'simulated failure',
  );
  assert.equal(h.document.querySelector('#record-form-payment-terms').value, 'Net 30');
  await h.click(h.document.querySelector('#record-form-simulate-error'));
  await h.click(h.document.querySelector('#record-form-submit'));
  await h.waitFor(
    () =>
      /Validated local preview/.test(h.document.querySelector('#record-form-result').textContent),
    'validated preview',
  );
  assert.match(h.document.querySelector('#record-form-result').textContent, /Not supplied/);
  assert.match(
    h.document.querySelector('.record-form-draft-status').textContent,
    /Unsaved local draft/,
  );
});

test('an unfinished row draft cannot be overwritten by another edit action', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/CollectionDemo.tsx');
  t.after(() => h.dispose());
  await chooseView(h, 'Row editing');
  await h.click(h.document.querySelector('#collection-edit-SP-26-0401'));
  await h.type(h.document.querySelector('#collection-edit-notes'), 'Do not lose this draft');
  await h.click(h.document.querySelector('#collection-edit-SP-26-0401'));
  assert.equal(h.document.querySelector('#collection-edit-notes').value, 'Do not lose this draft');
  await h.click(h.document.querySelector('#collection-edit-SP-26-0402'));
  assert.equal(h.document.querySelector('#collection-edit-notes').value, 'Do not lose this draft');
  assert.match(h.document.querySelector('#collection-editor').textContent, /SP-26-0401/);
});

test('moving a board record transfers focus to its new status control', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/CollectionDemo.tsx');
  t.after(() => h.dispose());
  await chooseView(h, 'Board');
  const input = h.document.querySelector('#collection-status-SP-26-0401');
  await h.act(async () => input.focus());
  await selectOption(h, input, 'Approved');
  const moved = h.document.querySelector('#collection-status-SP-26-0401');
  assert.notEqual(moved, input, 'the board record moved to another column');
  assert.ok(h.document.activeElement === moved, 'focus follows the moved board record');
});

test('currency totals represent unsupported individual and aggregate cents as unknown', () => {
  const record = model.initialRecords()[0];
  assert.equal(model.currencyTotals([{ ...record, amount: 1e308 }])[0].amount, null);
  assert.equal(
    model.currencyTotals([
      { ...record, amount: 60000000000000 },
      { ...record, id: 'other', amount: 60000000000000 },
    ])[0].amount,
    null,
  );
});

test('inline navigation and collection actions restore a connected focus target', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordDetailsDemo.tsx');
  t.after(() => h.dispose());
  await selectOption(h, h.document.querySelector('#details-presentation'), 'Inline disclosure');
  await h.click(h.document.querySelector('[data-record-open="SP-26-0401"]'));
  await h.act(async () => h.document.querySelector('#details-next').focus());
  await h.click(h.document.querySelector('#details-next'));
  assert.equal(h.document.activeElement.id, 'details-record-title');
  assert.equal(
    h.document.querySelector('[data-details-record]').dataset.detailsRecord,
    'SP-26-0402',
  );
});

test('review completion and disconnected detail triggers have stable focus fallbacks', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/CollectionDemo.tsx');
  t.after(() => h.dispose());
  await chooseView(h, 'Review queue example');
  const approve = [...h.document.querySelectorAll('button')].find(
    button => button.textContent.trim() === 'Approve SP-26-0401',
  );
  await h.act(async () => approve.focus());
  await h.click(approve);
  assert.equal(h.document.activeElement.id, 'collection-review-heading');
  await chooseView(h, 'Table');
  await h.click(h.document.querySelector('#collection-desktop'));
  await h.click(h.document.querySelector('#collection-open-SP-26-0401'));
  await h.type(h.document.querySelector('#collection-search'), 'SP-26-0402');
  await h.act(async () => h.document.querySelector('#collection-detail-back').focus());
  await h.click(h.document.querySelector('#collection-detail-back'));
  assert.equal(h.document.activeElement.id, 'collection-search');
});

test('desktop tree expands with the shared Atlas control rather than native focus borders', async t => {
  const h = await mountPattern('DataTableDemo', 'docs/src/react/workspace/CollectionDemo.tsx');
  t.after(() => h.dispose());
  await selectOption(h, h.document.querySelector('#collection-view'), 'Tree table');
  const expand = h.document.querySelector('button[aria-label="Collapse children SP-26-0401"]');
  assert.ok(expand?.classList.contains('atlas-button'));
  assert.equal(h.document.querySelector('.ant-table-row-expand-icon'), null);
  await h.click(expand);
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
});

test('composed form line overflow prevents a validated preview', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordFormsDemo.tsx');
  t.after(() => h.dispose());
  await h.click(h.document.querySelector('#forms-desktop'));
  await h.type(h.document.querySelector('#record-form-customer'), 'Range example');
  await h.type(h.document.querySelector('#record-form-email'), 'range@example.com');
  await h.type(h.document.querySelector('input[id$="-quantity"]'), '90000000000000');
  await h.type(h.document.querySelector('input[id$="-price"]'), '100');
  await h.click(h.document.querySelector('#record-form-submit'));
  await h.waitFor(
    () =>
      /Correct the indicated fields/.test(
        h.document.querySelector('#record-form-result').textContent,
      ),
    'composed amount validation',
  );
  assert.doesNotMatch(
    h.document.querySelector('#record-form-result').textContent,
    /Validated local preview/,
  );
});

test('new workspace translations preserve literal messages and parameter names', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const ts = await import('typescript');
  const dictionaries = await Promise.all(
    [
      'docs/src/locales/tr/workspace.json',
      'docs/src/locales/tr/docs.json',
      'docs/src/locales/tr/react.json',
      'docs/src/locales/tr/kit-core.json',
      'docs/src/locales/tr/kit-collections.json',
      'docs/src/locales/tr/kit-records.json',
      'docs/src/locales/tr/kit-docs.json',
      'src/i18n/tr.json',
    ].map(async file => JSON.parse(await readFile(file, 'utf8'))),
  );
  const messages = Object.assign({}, ...dictionaries);
  const keys = new Set();
  const strings = node => {
    if (ts.isStringLiteral(node)) keys.add(node.text);
    else if (ts.isConditionalExpression(node)) {
      strings(node.whenTrue);
      strings(node.whenFalse);
    }
  };
  const files = (await readdir('docs/src/react/workspace'))
    .filter(file => file.endsWith('.tsx'))
    .map(file => 'docs/src/react/workspace/' + file);
  for (const file of [...files, 'docs/src/data/workspace.ts']) {
    const source = ts.createSourceFile(
      file,
      await readFile(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = node => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 't' &&
        node.arguments[0]
      )
        strings(node.arguments[0]);
      if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'label')
        strings(node.initializer);
      if (ts.isJsxAttribute(node) && node.name.text === 'title' && node.initializer) {
        if (ts.isJsxExpression(node.initializer) && node.initializer.expression)
          strings(node.initializer.expression);
        else strings(node.initializer);
      }
      if (
        ts.isVariableDeclaration(node) &&
        node.name.getText(source).endsWith('LABELS') &&
        node.initializer
      ) {
        let object = node.initializer;
        if (ts.isAsExpression(object)) object = object.expression;
        if (ts.isObjectLiteralExpression(object))
          for (const property of object.properties)
            if (ts.isPropertyAssignment(property)) strings(property.initializer);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  keys.delete('USD');
  keys.delete('EUR');
  for (const key of keys)
    assert.ok(messages[key]?.trim(), 'Missing Turkish workspace message: ' + key);
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [key, value] of Object.entries(dictionaries[0]))
    assert.deepEqual(placeholders(value), placeholders(key), key);
});

test('filter-removing board mutations and row saves focus the stable search fallback', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/CollectionDemo.tsx');
  t.after(() => h.dispose());
  const search = h.document.querySelector('#collection-search');
  await h.type(search, 'SP-26-0401');
  await h.click(h.document.querySelector('#collection-filters'));
  await h.click(h.document.querySelector('#collection-status-pending'));
  await h.click(h.document.querySelector('.ant-drawer-close'));
  await chooseView(h, 'Board');
  const status = h.document.querySelector('#collection-status-SP-26-0401');
  await h.act(async () => status.focus());
  await selectOption(h, status, 'Approved');
  assert.equal(h.document.activeElement.id, 'collection-search');
  await h.click(h.document.querySelector('#collection-clear-filters'));
  await h.type(search, 'SP-26-0401');
  await h.click(h.document.querySelector('#collection-filters'));
  await h.click(h.document.querySelector('[id="collection-owner-Alex Reed"]'));
  await h.click(h.document.querySelector('.ant-drawer-close'));
  await chooseView(h, 'Row editing');
  await h.click(h.document.querySelector('#collection-edit-SP-26-0401'));
  await h.type(h.document.querySelector('#collection-edit-owner'), 'Changed owner');
  await h.submit(h.document.querySelector('#collection-editor'));
  assert.equal(h.document.activeElement.id, 'collection-search');
});

test('non-modal detail closure preserves the mounted draft under an inert disclosure', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordDetailsDemo.tsx');
  t.after(() => h.dispose());
  await h.click(h.document.querySelector('[data-record-open="SP-26-0401"]'));
  await h.click(h.document.querySelector('#details-edit'));
  const customer = h.document.querySelector('#details-customer');
  await h.type(customer, 'Persistent disclosure draft');
  await h.click(h.document.querySelector('#details-close'));
  assert.ok(customer.isConnected, 'exit must retain the mounted draft');
  assert.equal(customer.closest('.workspace-disclosure').getAttribute('aria-hidden'), 'true');
  assert.ok(customer.closest('.workspace-disclosure').hasAttribute('inert'));
  await h.click(h.document.querySelector('[data-record-open="SP-26-0401"]'));
  assert.ok(h.document.querySelector('#details-customer') === customer);
  assert.equal(customer.value, 'Persistent disclosure draft');
});
