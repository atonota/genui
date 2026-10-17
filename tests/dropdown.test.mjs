import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const bundle = await readFile(new URL('../src/vendor/dropdowns.js', import.meta.url), 'utf8');
const options = [
  { value: 'red', label: 'Kırmızı' },
  { value: 'blue', label: 'Mavi' },
  { value: 'green', label: 'Yeşil', disabled: true },
  { value: 'yellow', label: 'Sarı' },
];

async function setup(config = {}) {
  const dom = new JSDOM(
    '<!doctype html><html lang="tr"><body><p id="help">Yardım</p></body></html>',
    {
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    },
  );
  const win = dom.window;
  // JSDOM has no layout, CSS.escape, or scrolling implementation.
  // These shims permit DOM/state tests; they do not simulate a real browser.
  win.CSS ||= {};
  win.CSS.escape ||= value => String(value).replace(/[^\w-]/g, char => `\\${char}`);
  win.HTMLElement.prototype.scrollIntoView = () => {};
  win.HTMLElement.prototype.scrollTo = () => {};
  win.eval(bundle);
  const changes = [];
  const dropdown = win.GenUXDropdowns.create({
    id: 'demo',
    label: 'Renk',
    options,
    value: [],
    descriptionId: 'help',
    onChange: value => changes.push([...value]),
    ...config,
  });
  win.document.body.append(dropdown.root);
  const tick = () => new Promise(resolve => win.setTimeout(resolve, 45));
  await tick();
  return {
    dom,
    win,
    dropdown,
    changes,
    tick,
    destroy() {
      dropdown.destroy();
      win.close();
    },
  };
}

test('select keyboard selection skips disabled values and keeps named semantics', async () => {
  const ctx = await setup();
  try {
    const trigger = ctx.dropdown.root.querySelector('[role=combobox]');
    assert.equal(trigger.getAttribute('aria-describedby'), 'help');
    assert.equal(
      ctx.win.document.getElementById(trigger.getAttribute('aria-labelledby')).textContent,
      'Renk',
    );
    trigger.focus();
    trigger.dispatchEvent(
      new ctx.win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await ctx.tick();
    const list = ctx.dropdown.root.querySelector('[role=listbox]');
    assert.equal(list.hidden, false);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    list.dispatchEvent(
      new ctx.win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    list.dispatchEvent(
      new ctx.win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await ctx.tick();
    assert.equal(list.querySelector('[data-highlighted]').dataset.value, 'yellow');
    list.dispatchEvent(
      new ctx.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await ctx.tick();
    assert.deepEqual([...ctx.dropdown.getValue()], ['yellow']);
    assert.deepEqual(ctx.changes.at(-1), ['yellow']);
    assert.equal(list.hidden, true);
    assert.equal(ctx.win.document.activeElement, trigger);
    const native = ctx.dropdown.root.querySelector('select');
    assert.ok(native.hidden);
    assert.equal(native.value, 'yellow');
  } finally {
    ctx.destroy();
  }
});

test('searchable multiple filters, announces empty results, removes chips, and preserves values on disable', async () => {
  const ctx = await setup({ searchable: true, multiple: true, value: ['red'], clearable: true });
  try {
    const input = ctx.dropdown.root.querySelector('input[role=combobox]');
    input.focus();
    input.value = 'zzz';
    input.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
    await ctx.tick();
    assert.ok(ctx.dropdown.root.querySelector('.ff-empty').textContent.includes('bulunamadı'));
    assert.equal(ctx.dropdown.root.querySelectorAll('[role=option]').length, 0);
    input.value = 'mavi';
    input.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
    await ctx.tick();
    assert.equal(ctx.dropdown.root.querySelectorAll('[role=option]').length, 1);
    ctx.dropdown.root.querySelector('[role=option]').click();
    await ctx.tick();
    assert.deepEqual([...ctx.dropdown.getValue()], ['red', 'blue']);
    assert.equal(ctx.dropdown.root.querySelectorAll('.ff-chip').length, 2);
    ctx.dropdown.root.querySelector('.ff-chip button').click();
    await ctx.tick();
    assert.deepEqual([...ctx.dropdown.getValue()], ['blue']);
    ctx.dropdown.setDisabled(true);
    await ctx.tick();
    assert.equal(input.disabled, true);
    assert.deepEqual([...ctx.dropdown.getValue()], ['blue']);
    assert.equal(ctx.dropdown.root.querySelector('[role=listbox]').hidden, true);
    ctx.dropdown.setDisabled(false);
    ctx.dropdown.setValue(['yellow']);
    await ctx.tick();
    assert.equal(input.disabled, false);
    assert.deepEqual([...ctx.dropdown.getValue()], ['yellow']);
  } finally {
    ctx.destroy();
  }
});

test('readonly controls cannot change through trigger, clear, or chip actions', async () => {
  for (const searchable of [false, true]) {
    const ctx = await setup({
      searchable,
      multiple: true,
      value: ['red'],
      readOnly: true,
      clearable: true,
    });
    try {
      ctx.dropdown.root.querySelector('button').click();
      await ctx.tick();
      assert.equal(ctx.dropdown.root.querySelector('[role=listbox]').hidden, true);
      assert.deepEqual([...ctx.dropdown.getValue()], ['red']);
      assert.ok(
        [...ctx.dropdown.root.querySelectorAll('.ff-chip button')].every(node => node.disabled),
      );
      assert.ok(ctx.dropdown.root.querySelector('.ff-clear').disabled);
    } finally {
      ctx.destroy();
    }
  }
});

test('Escape and outside focus close the panel without deleting values; destroy detaches listener behavior', async () => {
  const ctx = await setup({ value: ['red'] });
  try {
    const trigger = ctx.dropdown.root.querySelector('[role=combobox]');
    trigger.click();
    await ctx.tick();
    ctx.dropdown.root.querySelector('[role=listbox]').dispatchEvent(
      new ctx.win.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await ctx.tick();
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    trigger.click();
    await ctx.tick();
    const outside = ctx.win.document.createElement('button');
    outside.textContent = 'Sonraki';
    ctx.win.document.body.append(outside);
    outside.focus();
    await ctx.tick();
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.deepEqual([...ctx.dropdown.getValue()], ['red']);
    ctx.dropdown.destroy();
    trigger.click();
    await ctx.tick();
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  } finally {
    ctx.destroy();
  }
});

test('single searchable keyboard selection and clear keep native form values synchronized', async () => {
  const ctx = await setup({ searchable: true, clearable: true, invalid: true, name: 'color' });
  try {
    const input = ctx.dropdown.root.querySelector('input[role=combobox]');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(input.getAttribute('aria-describedby'), 'help');
    const form = ctx.win.document.createElement('form');
    ctx.win.document.body.append(form);
    form.append(ctx.dropdown.root);
    input.focus();
    input.value = 'mavi';
    input.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
    await ctx.tick();
    input.dispatchEvent(
      new ctx.win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await ctx.tick();
    input.dispatchEvent(
      new ctx.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await ctx.tick();
    assert.deepEqual([...ctx.dropdown.getValue()], ['blue']);
    assert.equal(input.value, 'Mavi');
    assert.equal(new ctx.win.FormData(form).get('color'), 'blue');
    ctx.dropdown.root.querySelector('.ff-clear').click();
    await ctx.tick();
    assert.deepEqual([...ctx.dropdown.getValue()], []);
    assert.equal(input.value, '');
    assert.equal(new ctx.win.FormData(form).get('color'), null);
  } finally {
    ctx.destroy();
  }
});

test('grouped selection exposes labelled groups and form reset restores both modes', async () => {
  for (const searchable of [false, true]) {
    const ctx = await setup({
      searchable,
      value: ['red'],
      options: options.map((item, index) => ({
        ...item,
        group: index < 2 ? 'Ana renkler' : 'Diğerleri',
      })),
    });
    try {
      const groups = ctx.dropdown.root.querySelectorAll('[role=group]');
      assert.equal(groups.length, 2);
      assert.equal(
        ctx.win.document.getElementById(groups[0].getAttribute('aria-labelledby')).textContent,
        'Ana renkler',
      );
      const form = ctx.win.document.createElement('form');
      ctx.win.document.body.append(form);
      form.append(ctx.dropdown.root);
      ctx.dropdown.setValue(['blue']);
      await ctx.tick();
      form.reset();
      await ctx.tick();
      assert.deepEqual([...ctx.dropdown.getValue()], ['red']);
    } finally {
      ctx.destroy();
    }
  }
});

test('mount can be delayed and pre-mount values survive; create rejects invalid option keys', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const win = dom.window;
  win.eval(bundle);
  const dropdown = win.GenUXDropdowns.create({ id: 'late', label: 'Renk', options, value: [] });
  try {
    dropdown.setValue(['blue']);
    await new Promise(resolve => win.setTimeout(resolve, 20));
    win.document.body.append(dropdown.root);
    await new Promise(resolve => win.setTimeout(resolve, 45));
    assert.deepEqual([...dropdown.getValue()], ['blue']);
    assert.equal(dropdown.root.querySelector('.ff-choice-text').textContent, 'Mavi');
    assert.throws(() =>
      win.GenUXDropdowns.create({
        id: 'bad',
        label: 'Renk',
        options: [{ value: '', label: 'Boş' }],
      }),
    );
    assert.throws(() =>
      win.GenUXDropdowns.create({ id: 'bad', label: 'Renk', options: [options[0], options[0]] }),
    );
  } finally {
    dropdown.destroy();
    win.close();
  }
});

test('select typeahead chooses the matching value and Tab is not trapped', async () => {
  const ctx = await setup();
  try {
    const trigger = ctx.dropdown.root.querySelector('[role=combobox]');
    trigger.focus();
    trigger.dispatchEvent(
      new ctx.win.KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }),
    );
    await ctx.tick();
    assert.deepEqual([...ctx.dropdown.getValue()], ['yellow']);
    trigger.click();
    await ctx.tick();
    const list = ctx.dropdown.root.querySelector('[role=listbox]');
    const tab = new ctx.win.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    list.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented, false);
  } finally {
    ctx.destroy();
  }
});

test('search Escape closes without changing selected values and outside pointer dismisses', async () => {
  const ctx = await setup({ searchable: true, value: ['red'] });
  try {
    const input = ctx.dropdown.root.querySelector('input[role=combobox]');
    input.focus();
    input.click();
    await ctx.tick();
    assert.equal(input.getAttribute('aria-expanded'), 'true');
    input.dispatchEvent(
      new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await ctx.tick();
    assert.equal(input.getAttribute('aria-expanded'), 'false');
    assert.deepEqual([...ctx.dropdown.getValue()], ['red']);
    input.click();
    await ctx.tick();
    const outside = ctx.win.document.createElement('button');
    outside.textContent = 'Dışarı';
    ctx.win.document.body.append(outside);
    // JSDOM has no PointerEvent constructor; the library receives the standard
    // pointerdown event fields through MouseEvent's event model.
    const down = new ctx.win.MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    Object.defineProperty(down, 'pointerType', { value: 'mouse' });
    outside.dispatchEvent(down);
    await ctx.tick();
    assert.equal(input.getAttribute('aria-expanded'), 'false');
    assert.deepEqual([...ctx.dropdown.getValue()], ['red']);
  } finally {
    ctx.destroy();
  }
});

test('destroy cancels behavior even when a library transition was already queued', async () => {
  const ctx = await setup();
  const liveRegions = () => ctx.win.document.querySelectorAll('[aria-live]').length;
  try {
    const trigger = ctx.dropdown.root.querySelector('[role=combobox]');
    trigger.click();
    ctx.dropdown.destroy();
    await ctx.tick();
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(liveRegions(), 0);
    const original = ctx.win.document.activeElement;
    trigger.click();
    await ctx.tick();
    assert.equal(ctx.win.document.activeElement, original);
  } finally {
    ctx.destroy();
  }
});
