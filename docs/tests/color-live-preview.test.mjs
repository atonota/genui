import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern, selectOption } from './harness.mjs';

const entry = 'docs/src/react/color/ColorSystemDemo.tsx';
const field = (h, text) => {
  const label = [...h.document.querySelectorAll('label')].find(n => n.textContent.trim() === text);
  return h.document.getElementById(label.htmlFor);
};

test('live families include distinct Buttons/Pills, fields and selection handles and preserve all drafts', async t => {
  const h = await mountPattern('default', entry, { documentation: true });
  t.after(() => h.dispose());
  const families = [...h.document.querySelectorAll('[data-color-family-preview]')];
  assert.equal(families.length, 6);
  assert.ok(h.document.querySelector('[role="radiogroup"][aria-label="Preview priority"]'));
  for (const family of families) {
    const toggle = family.querySelector('[role="switch"]');
    assert.match(toggle.getAttribute('aria-label'), /^Enabled for /);
    assert.match(toggle.closest('label').textContent, /Enabled/);
  }

  assert.ok(
    families.every(
      f =>
        f.querySelectorAll('.color-preview-button').length >= 1 &&
        f.querySelectorAll('.atlas-pill').length >= 2,
    ),
  );
  assert.equal(new Set(families.map(f => f.dataset.seedHex)).size, 6);
  const first = families[0],
    input = first.querySelector('input.ant-input');
  const select = first.querySelector('.ant-select input');
  const check = first.querySelector('input[type=checkbox]');
  await h.type(input, 'Keep family draft');
  await selectOption(h, select, 'Engineering');
  await h.click(check);
  const slider = first.querySelector('[role=slider]');
  await h.act(() =>
    slider.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        keyCode: 39,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  const value = slider.getAttribute('aria-valuenow');
  const assertRetained = () => {
    const current = h.document.querySelector('[data-color-family-preview="offset-0"]');
    assert.equal(current, first, 'the live family owner remains connected');
    assert.equal(current.isConnected, true);
    assert.equal(current.querySelector('input.ant-input'), input);
    assert.equal(current.querySelector('.ant-select input'), select);
    assert.equal(current.querySelector('input[type=checkbox]'), check);
    assert.equal(current.querySelector('[role=slider]'), slider);
    assert.equal(input.value, 'Keep family draft');
    assert.equal(check.checked, true);
    assert.equal(slider.getAttribute('aria-valuenow'), value);
  };
  const before = families.map(f => f.dataset.seedHex);
  await h.type(field(h, 'Whiteness · percent'), '75');
  await h.type(field(h, 'Blackness · percent'), '5');
  assert.ok(families.every((f, index) => f.dataset.seedHex !== before[index]));
  assertRetained();
  assert.equal(first.querySelector('input.ant-input'), input);
  assert.equal(input.value, 'Keep family draft');
  assert.equal(first.querySelector('.ant-select input'), select);
  assert.match(first.querySelector('.ant-select').textContent, /Engineering/);
  assert.equal(check.checked, true);
  assert.equal(slider.getAttribute('aria-valuenow'), value);
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  const sizes = [...h.document.querySelectorAll('[data-size-control] input[type=radio]')];
  for (const option of sizes) {
    await h.click(option);
    assertRetained();
    assert.equal(first.querySelector('input.ant-input'), input);
    assert.equal(input.value, 'Keep family draft');
    assert.equal(check.checked, true);
    assert.equal(slider.getAttribute('aria-valuenow'), value);
  }
  // Functional field icons follow the exact painted field, including neutral colors.
  await h.type(field(h, 'Whiteness · percent'), '40');
  await h.type(field(h, 'Blackness · percent'), '60');
  for (const family of families) {
    const fieldInput = family.querySelector('input.ant-input');
    const selectRoot = family.querySelector('.ant-select');
    assert.equal(
      selectRoot.style.getPropertyValue('--ant-color-icon'),
      fieldInput.style.getPropertyValue('--ink'),
    );
    assert.equal(
      selectRoot.style.getPropertyValue('--ant-color-icon-hover'),
      fieldInput.style.getPropertyValue('--ink'),
    );
  }
  const modes = h.document.querySelectorAll('.color-palette input[type=radio]');
  await h.click(modes[1]);
  assertRetained();
  assert.equal(input.value, 'Keep family draft');
  assert.equal(check.checked, true);
  assert.equal(slider.getAttribute('aria-valuenow'), value);
  await h.act(() => h.setLocale('tr'));
  assertRetained();
  assert.equal(input.value, 'Keep family draft');
  assert.equal(first.querySelector('input.ant-input'), input);
});
