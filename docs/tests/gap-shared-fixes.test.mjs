import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('native actions and label-less choices keep an immediate single-edge keyboard marker', async () => {
  const sheet = postcss.parse(await source('../src/styles/components.css'));
  const rules = [];
  sheet.walkRules(rule => rules.push(rule));
  const action = rules.find(
    rule =>
      rule.selector.includes('.ant-btn:not(:has(.genux-button-content))') &&
      rule.selector.includes(':focus-visible') &&
      rule.selector.includes('::before'),
  );
  const choice = rules.find(
    rule =>
      rule.selector.includes('.ant-checkbox-wrapper:not(:has(> span:nth-child(2)))') &&
      rule.selector.includes(':focus-visible'),
  );
  assert.ok(action, 'native Button consumers have an immediate decorative marker');
  assert.ok(choice, 'label-less Checkbox is not reliant on an absent text underline');
  for (const rule of [action, choice]) {
    assert.ok(
      rule.nodes.some(node => node.prop === 'background' && node.value === 'var(--focus-color)'),
    );
    assert.equal(
      rule.nodes.some(node => /^(outline|box-shadow|transition)$/.test(node.prop)),
      false,
    );
  }
});

test('reduced motion reaches branded portals outside the provider subtree', async () => {
  const sheet = postcss.parse(await source('../src/styles/components.css'));
  const selectors = [];
  sheet.walkAtRules('media', media => {
    if (!media.params.includes('prefers-reduced-motion: reduce')) return;
    media.walkRules(rule => {
      if (
        rule.nodes.some(
          node => node.prop === 'transition-duration' && node.value === '0s' && node.important,
        )
      )
        selectors.push(rule.selector);
    });
  });
  for (const portal of [
    'ant-modal',
    'ant-drawer',
    'ant-tooltip',
    'ant-popover',
    'ant-picker-dropdown',
  ])
    assert.ok(
      selectors.some(selector => selector.includes(`.${portal}`)),
      portal,
    );
});

test('all nested providers share one document modality subscription and clean up the last owner', async t => {
  const compiled = await build({
    entryPoints: ['docs/src/input-modality.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const module = await import(
    'data:text/javascript;base64,' +
      Buffer.from(compiled.outputFiles[0].contents).toString('base64')
  );
  const dom = new JSDOM('<html><body></body></html>');
  const previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => {
    globalThis.document = previous;
    dom.window.close();
  });
  const added = [];
  const removed = [];
  const doc = dom.window.document;
  const add = doc.addEventListener.bind(doc),
    remove = doc.removeEventListener.bind(doc);
  doc.addEventListener = (type, ...args) => {
    added.push(type);
    add(type, ...args);
  };
  doc.removeEventListener = (type, ...args) => {
    removed.push(type);
    remove(type, ...args);
  };
  let calls = 0;
  const first = module.subscribeInputModality(() => calls++),
    second = module.subscribeInputModality(() => calls++);
  assert.equal(added.filter(type => type === 'pointerdown').length, 1);
  assert.equal(added.filter(type => type === 'keydown').length, 1);
  doc.dispatchEvent(new dom.window.Event('pointerdown'));
  assert.equal(module.getInputModalitySnapshot(), 'pointer');
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab' }));
  assert.equal(module.getInputModalitySnapshot(), 'keyboard');
  assert.equal(calls, 4);
  first();
  assert.equal(removed.filter(type => type === 'keydown').length, 0);
  second();
  assert.equal(removed.filter(type => type === 'keydown').length, 1);
});
