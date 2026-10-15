import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { mountPattern } from './harness.mjs';

async function fixture(t) {
  const file = `docs/tests/.steps-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `import {useState} from 'react';import AtlasProvider from '../src/react/AtlasProvider';import AtlasSteps from '../src/react/AtlasSteps';
  export default function Demo(){const[current,setCurrent]=useState(0);const[calls,setCalls]=useState(0);return <AtlasProvider appearance="docs"><AtlasSteps label="Setup steps" orientation="vertical" current={current} onChange={i=>{setCurrent(i);setCalls(n=>n+1)}} items={[{key:'name',title:'Name',content:'Choose a name'},{key:'restricted',title:'Restricted',disabled:true},{key:'review',title:'Review'}]}/><output>{calls}</output></AtlasProvider>}`,
  );
  const h = await mountPattern('default', file);
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  return h;
}

test('native step activation updates once, exposes current and disabled semantics and skips blocked focus destinations', async t => {
  const h = await fixture(t);
  const items = [...h.document.querySelectorAll('.ant-steps-item')];
  assert.equal(items[0].getAttribute('aria-current'), 'step');
  assert.equal(items[1].getAttribute('aria-disabled'), 'true');
  assert.equal(items[1].getAttribute('role'), 'button');
  items[0].focus();
  await h.act(() =>
    items[0].dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    ),
  );
  assert.equal(h.document.activeElement, items[2]);
  assert.equal(
    h.document.querySelector('output').textContent,
    '0',
    'arrows move focus without changing selection',
  );
  await h.act(() =>
    items[2].dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    ),
  );
  assert.equal(items[2].getAttribute('aria-current'), 'step');
  assert.equal(h.document.querySelector('output').textContent, '1');
  await h.click(items[2]);
  await h.click(items[1]);
  assert.equal(h.document.querySelector('output').textContent, '1');
  await h.act(() =>
    items[2].dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
    ),
  );
  assert.equal(h.document.activeElement, items[0]);
  await h.act(() =>
    items[0].dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    ),
  );
  assert.equal(h.document.activeElement, items[2]);
});

test('container and short-viewport adaptation preserve the native step nodes and keyboard focus', async t => {
  const h = await mountPattern('default', 'docs/src/react/AtlasSteps.tsx', {
    label: 'Adaptive steps',
    current: 1,
    onChange: () => {},
    items: [
      { key: 'a', title: 'Details' },
      { key: 'b', title: 'Review' },
      { key: 'c', title: 'Ready' },
    ],
  });
  t.after(() => h.dispose());
  const owner = h.document.querySelector('.atlas-steps');
  const item = h.document.querySelectorAll('.ant-steps-item')[1];
  let revealed = 0;
  item.scrollIntoView = () => revealed++;
  let width = 639;
  owner.getBoundingClientRect = () => ({ width, height: 200 });
  item.focus();
  const measure = async (next, height = 800) => {
    width = next;
    h.window.innerHeight = height;
    await h.act(() => h.window.dispatchEvent(new h.window.Event('resize')));
  };
  await measure(639);
  assert.equal(owner.dataset.stepsOrientation, 'vertical');
  await measure(640);
  assert.equal(owner.dataset.stepsOrientation, 'horizontal');
  await measure(641);
  assert.equal(owner.dataset.stepsOrientation, 'horizontal');
  await measure(844, 390);
  assert.equal(
    owner.dataset.stepsOrientation,
    'vertical',
    'a short landscape viewport keeps the stacked journey',
  );
  assert.equal(h.document.querySelectorAll('.ant-steps-item')[1], item);
  assert.equal(h.document.activeElement, item);
  assert.ok(revealed >= 2, 'layout changes keep the focused step within view');
  assert.equal(h.document.querySelectorAll('[aria-current="step"]').length, 1);
});

test('global disabled blocks all native activation while error and explicit item status stay readable', async t => {
  let calls = 0;
  const h = await mountPattern('default', 'docs/src/react/AtlasSteps.tsx', {
    label: 'Blocked review',
    current: 1,
    status: 'error',
    disabled: true,
    onChange: () => calls++,
    items: [
      { key: 'a', title: 'Details' },
      { key: 'b', title: 'Review', content: 'Missing confirmation' },
      { key: 'c', title: 'Ready', status: 'finish' },
    ],
  });
  t.after(() => h.dispose());
  const items = [...h.document.querySelectorAll('.ant-steps-item')];
  for (const item of items) {
    assert.equal(item.getAttribute('aria-disabled'), 'true');
    assert.equal(item.tabIndex, -1);
    await h.click(item);
  }
  assert.equal(calls, 0);
  assert.match(items[1].textContent, /Step needs attention/);
  assert.match(items[2].textContent, /Finished step/);
  assert.equal(items[1].getAttribute('aria-current'), 'step');
});
