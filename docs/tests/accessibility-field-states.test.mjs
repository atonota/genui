import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern } from './harness.mjs';

test(
  'documentation Input error state exposes invalid semantics and its message while warnings remain warnings',
  { timeout: 5000 },
  async t => {
    const h = await mountPattern('WebInputDemo', 'docs/src/react/InputDemo.tsx', {
      documentation: true,
    });
    t.after(() => h.dispose());
    const error = h.document.querySelector('.ant-form-item-has-error input');
    const warning = h.document.querySelector('.ant-form-item-has-warning input');
    assert.ok(error && warning, 'the actual Input state examples must be rendered');
    assert.equal(error.getAttribute('aria-invalid'), 'true');
    const description = error.getAttribute('aria-describedby');
    assert.ok(description, 'the error state retains its visible message association');
    assert.match(h.document.getElementById(description).textContent, /Enter a valid email address/);
    assert.notEqual(warning.getAttribute('aria-invalid'), 'true');
    await h.type(error, 'authored@example.test');
    assert.equal(error.value, 'authored@example.test');
    assert.equal(
      error.getAttribute('aria-invalid'),
      'true',
      'a static invalid-state preview remains explicitly invalid',
    );
  },
);

test(
  'documentation Select error state exposes invalid semantics without promoting its warning to an error',
  { timeout: 5000 },
  async t => {
    const h = await mountPattern('WebSelectDemo', 'docs/src/react/SelectDemo.tsx', {
      documentation: true,
    });
    t.after(() => h.dispose());
    const error = h.document.querySelector('#select-error');
    const warning = h.document.querySelector('#select-warning');
    assert.equal(error.getAttribute('role'), 'combobox');
    assert.equal(error.getAttribute('aria-invalid'), 'true');
    assert.equal(error.getAttribute('aria-describedby'), 'select-error-help');
    assert.match(h.document.getElementById('select-error-help').textContent, /Check the selection/);
    assert.notEqual(warning.getAttribute('aria-invalid'), 'true');
  },
);

test(
  'record-detail search uses the shared localized clear purpose and restores its controlled value and focus',
  { timeout: 5000 },
  async t => {
    const h = await mountPattern('default', 'docs/src/react/workspace/RecordDetailsDemo.tsx', {
      documentation: true,
    });
    t.after(async () => {
      await h.act(() => h.setLocale('en'));
      await h.dispose();
    });
    const input = h.document.querySelector('#details-search');
    for (const locale of ['en', 'tr']) {
      await h.act(() => h.setLocale(locale));
      await h.type(input, 'unmatched-accessibility-query');
      assert.equal(input.value, 'unmatched-accessibility-query');
      const clear = input
        .closest('.ant-input-affix-wrapper')
        .querySelector('button.ant-input-clear-icon');
      assert.ok(clear, 'the existing allowClear consumer retains its native button');
      assert.equal(clear.disabled, false);
      assert.equal(clear.tabIndex, 0);
      assert.equal(
        clear.querySelector('[role="img"]').getAttribute('aria-label'),
        locale === 'en' ? 'Clear value' : 'Değeri temizle',
      );
      await h.act(async () => clear.focus());
      await h.click(clear);
      assert.equal(input.value, '', 'clearing updates the caller-owned search state');
      assert.ok(h.document.activeElement === input, 'clearing returns focus to the search input');
    }
  },
);

test(
  'adding the clear icon helper does not enable clearing on unrelated documentation inputs',
  { timeout: 5000 },
  async t => {
    const h = await mountPattern('WebInputDemo', 'docs/src/react/InputDemo.tsx', {
      documentation: true,
    });
    t.after(() => h.dispose());
    const input = h.document.querySelector('#input-password');
    await h.type(input, 'retained-value');
    assert.ok(
      input.closest('.ant-input-affix-wrapper').querySelector('.ant-input-clear-icon') === null,
    );
    assert.equal(input.value, 'retained-value');
  },
);
