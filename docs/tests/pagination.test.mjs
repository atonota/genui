import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { mountPattern, buttonByText, selectOption } from './harness.mjs';
const output = await build({
  entryPoints: ['docs/src/data/pagination.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { paginationItems, paginationState, pageForSize, parsePageJump } = await import(
  'data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64')
);
const pages = (current, count) =>
  paginationItems(current, count)
    .filter(item => item.kind === 'page')
    .map(item => item.page);

test('page windows always retain both boundary pairs once, with honest noninteractive gaps', () => {
  assert.deepEqual(pages(42, 50), [1, 2, 41, 42, 43, 49, 50]);
  assert.deepEqual(
    paginationItems(42, 50).filter(item => item.kind === 'gap'),
    [
      { kind: 'gap', from: 3, to: 40 },
      { kind: 'gap', from: 44, to: 48 },
    ],
  );
  for (let count = 0; count <= 12; count++)
    for (let current = 1; current <= Math.max(1, count); current++) {
      const visible = pages(current, count);
      assert.equal(new Set(visible).size, visible.length);
      assert.ok(visible.every(page => page >= 1 && page <= count));
      for (const endpoint of [1, 2, count - 1, count].filter(page => page >= 1 && page <= count))
        assert.ok(visible.includes(endpoint));
      for (const item of paginationItems(current, count))
        if (item.kind === 'gap')
          assert.ok(item.to > item.from, 'a single missing page is shown, not omitted');
    }
  assert.deepEqual(pages(1, 1), [1]);
  assert.deepEqual(pages(2, 2), [1, 2]);
  assert.deepEqual(pages(5, 9), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(
    paginationItems(500000000, Number.MAX_SAFE_INTEGER).length <= 9,
    'large collections do not allocate one item per page',
  );
});

test('bounds, empty results, invalid input and page-size changes keep a truthful item range', () => {
  assert.deepEqual(paginationState(42, 500, 10), {
    current: 42,
    total: 500,
    pageSize: 10,
    pages: 50,
    start: 411,
    end: 420,
  });
  assert.equal(pageForSize(paginationState(42, 500, 10), 20), 21);
  assert.deepEqual(paginationState(99, 0, 10), {
    current: 1,
    total: 0,
    pageSize: 10,
    pages: 0,
    start: 0,
    end: 0,
  });
  assert.equal(paginationState(-9, 501, 10).current, 1);
  assert.equal(paginationState(90, 501, 10).end, 501);
  assert.equal(paginationState(NaN, Infinity, 0).pages, 0);
  for (const value of ['', '-1', '0', '1.5', '2e1', '51', '999999999999999999999999'])
    assert.equal(parsePageJump(value, 50), null);
  assert.equal(parsePageJump(' 42 ', 50), 42);
});

async function fixture(t, body) {
  const file = `docs/tests/.pagination-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `import {useState} from 'react'; import GenUXProvider from '../src/react/GenUXProvider'; import GenUXPagination from '../src/react/GenUXPagination'; ${body}`,
  );
  const h = await mountPattern('default', file);
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  return h;
}
const named = (h, label) => h.document.querySelector(`button[aria-label="${label}"]`);

test('controlled endpoint actions update once and focus remains on the reached page', async t => {
  const h = await fixture(
    t,
    `export default function Demo(){const [current,setCurrent]=useState(42);const [calls,setCalls]=useState(0);return <GenUXProvider appearance="docs"><GenUXPagination current={current} total={500} pageSize={10} onChange={page=>{setCurrent(page);setCalls(n=>n+1)}}/><output>{calls}</output></GenUXProvider>}`,
  );
  assert.deepEqual(
    [...h.document.querySelectorAll('[data-pagination-page]')].map(el =>
      Number(el.dataset.paginationPage),
    ),
    [1, 2, 41, 42, 43, 49, 50],
  );
  assert.equal(h.document.querySelectorAll('button[aria-current="page"]').length, 1);
  assert.equal(h.document.querySelectorAll('.genux-pagination-gap button').length, 0);
  const last = named(h, 'Last page');
  last.focus();
  await h.click(last);
  assert.equal(h.document.activeElement, h.document.querySelector('[aria-current="page"]'));
  assert.equal(h.document.querySelector('[aria-current="page"]').textContent, '50');
  assert.equal(last.disabled, true);
  await h.click(h.document.querySelector('[aria-current="page"]'));
  assert.equal(h.document.querySelector('output').textContent, '1');
  await h.click(named(h, 'First page'));
  assert.equal(named(h, 'Previous page').disabled, true);
  assert.equal(h.document.querySelector('output').textContent, '2');
});

test('quick jump validates explicitly, commits once and never creates or submits a nested form', async t => {
  const h = await fixture(
    t,
    `export default function Demo(){const [current,setCurrent]=useState(42);const [calls,setCalls]=useState(0);return <GenUXProvider appearance="docs"><form onSubmit={e=>{e.preventDefault();throw new Error('Unexpected outer submit')}}><GenUXPagination current={current} total={500} pageSize={10} onChange={page=>{setCurrent(page);setCalls(n=>n+1)}}/><output>{calls}</output></form></GenUXProvider>}`,
  );
  assert.equal(h.document.querySelectorAll('form').length, 1);
  const input = h.document.querySelector('input[aria-label="Go to page"]');
  await h.type(input, '51');
  await h.click(buttonByText(h.document, 'Go'));
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.match(
    h.document.getElementById(input.getAttribute('aria-describedby')).textContent,
    /1 to 50/,
  );
  assert.equal(h.document.querySelector('output').textContent, '0');
  await h.type(input, '12');
  const event = new h.window.KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  });
  await h.act(() => input.dispatchEvent(event));
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.document.querySelector('output').textContent, '1');
  assert.equal(h.document.querySelector('[aria-current="page"]').textContent, '12');
  assert.equal(input.getAttribute('aria-invalid'), null);
});

test('branded page-size selection preserves the visible record and leaves an unfinished jump intact', async t => {
  const h = await fixture(
    t,
    `export default function Demo(){const [current,setCurrent]=useState(42);const [size,setSize]=useState(10);return <GenUXProvider appearance="docs"><GenUXPagination current={current} total={500} pageSize={size} onChange={(page,nextSize)=>{setCurrent(page);setSize(nextSize)}}/></GenUXProvider>}`,
  );
  const input = h.document.querySelector('input[aria-label="Go to page"]');
  await h.type(input, '12');
  await selectOption(
    h,
    h.document.querySelector('input[aria-label="Items per page"]'),
    '20 / page',
  );
  assert.equal(h.document.querySelector('[aria-current="page"]').textContent, '21');
  assert.match(h.document.querySelector('[role="status"]').textContent, /401–420 of 500/);
  assert.equal(h.document.querySelector('input[aria-label="Go to page"]'), input);
  assert.equal(input.value, '12');
  await h.act(() => h.setLocale('tr'));
  assert.equal(input.value, '12');
  assert.ok(h.document.querySelector('input[aria-label="Sayfaya git"]'));
});

test('zero and disabled results expose no active navigation or editable jumps', async t => {
  for (const props of [{ total: 0 }, { total: 500, disabled: true }]) {
    let calls = 0;
    const h = await mountPattern('default', 'docs/src/react/GenUXPagination.tsx', {
      current: 42,
      pageSize: 10,
      onChange: () => calls++,
      ...props,
    });
    for (const button of h.document.querySelectorAll('button')) {
      assert.equal(button.disabled, true);
      await h.click(button);
    }
    assert.equal(h.document.querySelector('input[aria-label="Go to page"]').disabled, true);
    assert.equal(calls, 0);
    if (props.total === 0)
      assert.equal(h.document.querySelectorAll('[data-pagination-page]').length, 0);
    await h.dispose();
  }
});

test('an invalid jump is hidden while results are empty and retained when results return', async t => {
  const h = await fixture(
    t,
    `export default function Demo(){const [total,setTotal]=useState(500);return <GenUXProvider appearance="docs"><button onClick={()=>setTotal(0)}>Empty results</button><button onClick={()=>setTotal(500)}>Restore results</button><GenUXPagination current={42} total={total} pageSize={10} onChange={()=>{}}/></GenUXProvider>}`,
  );
  const input = h.document.querySelector('input[aria-label="Go to page"]');
  await h.type(input, '51');
  await h.click(buttonByText(h.document, 'Go'));
  assert.match(h.document.querySelector('[role="alert"]').textContent, /1 to 50/);
  await h.click(buttonByText(h.document, 'Empty results'));
  assert.equal(input.value, '51');
  assert.equal(input.disabled, true);
  assert.equal(input.getAttribute('aria-invalid'), null);
  assert.equal(h.document.querySelector('[role="alert"]'), null);
  await h.click(buttonByText(h.document, 'Restore results'));
  assert.equal(input.value, '51');
  assert.equal(input.disabled, false);
  assert.match(h.document.querySelector('[role="alert"]').textContent, /1 to 50/);
});

test('all five surfaces use existing GenUXButton types with one semantic current page', async t => {
  const h = await fixture(
    t,
    `const types=['solid','outline','tint','text','link'] as const; export default function Demo(){return <GenUXProvider appearance="docs">{types.map(type=><section key={type} data-type={type}><GenUXPagination current={4} total={80} pageSize={10} onChange={()=>{}} buttonType={type} activeButtonType={type} showSizeChanger={false} showQuickJumper={false}/></section>)}</GenUXProvider>}`,
  );
  for (const section of h.document.querySelectorAll('[data-type]')) {
    const type = section.dataset.type;
    assert.equal(section.querySelectorAll('button[aria-current="page"]').length, 1);
    assert.equal(section.querySelector('[aria-current="page"]').dataset.fill, type);
    assert.ok(
      [...section.querySelectorAll('button')].every(
        button => button.classList.contains('genux-button') && button.dataset.fill === type,
      ),
    );
    assert.equal(
      section.querySelectorAll('[data-page-current="true"] .genux-pagination-current-marker')
        .length,
      1,
    );
  }
});
