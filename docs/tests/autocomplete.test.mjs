import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { mountPattern } from './harness.mjs';

async function fixture(t) {
  const file = `docs/tests/.autocomplete-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `import{useState}from'react';import GenUXProvider from'../src/react/GenUXProvider';import GenUXAutoComplete from'../src/react/GenUXAutoComplete';const items=[{key:'archived',value:'Archived',title:'Archived',description:'Unavailable resource',disabled:true},{key:'card',value:'Card',title:'Card',description:'Entity summaries',group:{key:'components',label:'Components'}},{key:'guide',value:'Design guide',title:'Design guide',description:'Shared tokens',group:{key:'guides',label:'Guides'}}];export default function Demo(){const[value,setValue]=useState('');const[selected,setSelected]=useState([]);return <GenUXProvider appearance="docs"><GenUXAutoComplete label="Find resources" value={value} onChange={setValue} items={items} onSelect={item=>setSelected(v=>[...v,item.key])}/><output data-selections>{JSON.stringify(selected)}</output></GenUXProvider>}`,
  );
  const h = await mountPattern('default', file);
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  return h;
}

test('rich local suggestions filter without constraining free text and keep empty results nonselectable', async t => {
  const h = await fixture(t);
  const input = h.document.querySelector('input[role="combobox"]');
  await h.type(input, 'no such resource');
  await h.click(input);
  assert.equal(input.value, 'no such resource');
  assert.match(h.document.body.textContent, /No suggestions match/);
  assert.equal(h.document.querySelectorAll('[role="option"]').length, 0);
  assert.equal(h.document.querySelector('[data-selections]').textContent, '[]');
});

async function key(h, input, key, code, extra = {}) {
  await h.act(async () =>
    input.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key,
        keyCode: code,
        which: code,
        bubbles: true,
        cancelable: true,
        ...extra,
      }),
    ),
  );
}
test('native keyboard navigation preserves draft until explicit selection and Escape retains input focus', async t => {
  const h = await fixture(t);
  const input = h.document.querySelector('input[role="combobox"]');
  await h.type(input, 'car');
  await h.click(input);
  await h.act(async () => input.focus());
  await key(h, input, 'ArrowDown', 40);
  assert.equal(input.value, 'car');
  assert.ok(input.getAttribute('aria-activedescendant'));
  await key(h, input, 'Enter', 13);
  assert.equal(input.value, 'Card');
  assert.equal(h.document.querySelector('[data-selections]').textContent, '["card"]');
  assert.equal(
    input.closest('.ant-select').querySelectorAll('.genux-autocomplete-result').length,
    0,
    'rich popup rows must not be rendered in the single-line field',
  );
  await h.type(input, 'des');
  await h.click(input);
  await key(h, input, 'Escape', 27);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal(input.value, 'des');
  assert.equal(h.document.activeElement, input);
});
test('IME Enter does not select an active suggestion; normal Enter can commit after composition', async t => {
  const h = await fixture(t);
  const input = h.document.querySelector('input[role="combobox"]');
  await h.type(input, 'car');
  await h.click(input);
  await key(h, input, 'ArrowDown', 40);
  await h.act(async () =>
    input.dispatchEvent(new h.window.CompositionEvent('compositionstart', { bubbles: true })),
  );
  await key(h, input, 'Enter', 13, { isComposing: true });
  assert.equal(input.value, 'car');
  assert.equal(h.document.querySelector('[data-selections]').textContent, '[]');
  await h.act(async () =>
    input.dispatchEvent(
      new h.window.CompositionEvent('compositionend', { bubbles: true, data: 'car' }),
    ),
  );
  await key(h, input, 'Enter', 13);
  assert.equal(input.value, 'Card');
  assert.equal(h.document.querySelector('[data-selections]').textContent, '["card"]');
});
test('native clear button keeps activation keys uncancelled and clears without selecting a result', async t => {
  const h = await fixture(t);
  const input = h.document.querySelector('input[role="combobox"]');
  await h.type(input, 'custom');
  const clear = h.document.querySelector('button[aria-label="Clear value"]');
  assert.ok(clear);
  const enter = new h.window.KeyboardEvent('keydown', {
    key: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });
  await h.act(async () => {
    clear.focus();
    clear.dispatchEvent(enter);
  });
  assert.equal(enter.defaultPrevented, false);
  // JSDOM does not perform the browser's native Enter-to-click default action.
  await h.click(clear);
  assert.equal(input.value, '');
  assert.equal(h.document.querySelector('[data-selections]').textContent, '[]');
});

test('disabled suggestions explain unavailability and cannot be selected', async t => {
  const h = await fixture(t);
  const input = h.document.querySelector('input[role="combobox"]');
  await h.type(input, 'arch');
  await h.click(input);
  const option = h.document.querySelector('[role="option"]');
  assert.equal(option.getAttribute('aria-disabled'), 'true');
  assert.match(option.textContent, /Unavailable/);
  await h.click(option);
  assert.equal(input.value, 'arch');
  assert.equal(h.document.querySelector('[data-selections]').textContent, '[]');
});
