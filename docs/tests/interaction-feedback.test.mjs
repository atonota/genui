import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { mountPattern } from './harness.mjs';

const compiled = await build({
  stdin: {
    contents:
      "export {installInteractionFeedback} from './docs/src/interaction-feedback'; export {installDeferredFeedback} from './docs/src/deferred-feedback';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { installInteractionFeedback, installDeferredFeedback } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64')
);

function feedbackFixture(t) {
  const dom = new JSDOM(
    `<!doctype html><html><body><main>
    <button id="button">Continue</button><button id="second">Second action</button><a id="link" href="#target">Example</a>
    <label><span class="ant-checkbox"><input id="check" type="checkbox"></span>Choice</label>
    <label><span class="ant-radio"><input id="radio" type="radio"></span>Radio</label>
    <button id="switch" class="ant-switch" role="switch" aria-checked="false">Switch</button>
    <button id="busy" aria-busy="true">Processing</button>
    <button id="disabled" disabled>Disabled</button>
    <input id="readonly" readonly value="Copy me">
    <span id="slider" role="slider" tabindex="0" aria-valuenow="1"></span>
    <button id="optout" data-atlas-click-feedback="false">No effect</button>
    </main></body></html>`,
    { pretendToBeVisual: true },
  );
  const { document } = dom.window;
  const computedStyle = dom.window.getComputedStyle.bind(dom.window);
  const pseudoStyles = new WeakMap();
  dom.window.getComputedStyle = (node, pseudo) => {
    if (!pseudo) return computedStyle(node);
    // JSDOM does not render pseudo-elements. Model the actual paint owner,
    // separately from the root's edge/background and unresolved custom tokens.
    const style = document.createElement('span').style;
    style.content = 'none';
    Object.assign(style, pseudoStyles.get(node)?.[pseudo]);
    return style;
  };
  document.documentElement.style.setProperty('--motion-duration-click-feedback', '400ms');
  let reduced = false;
  const listeners = new Set();
  dom.window.matchMedia = () => ({
    get matches() {
      return reduced;
    },
    addEventListener(_event, listener) {
      listeners.add(listener);
    },
    removeEventListener(_event, listener) {
      listeners.delete(listener);
    },
  });
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 10,
    y: 10,
    left: 10,
    top: 10,
    right: 110,
    bottom: 58,
    width: 100,
    height: 48,
  });
  t.after(() => dom.window.close());
  return {
    window: dom.window,
    document,
    get(id) {
      return document.getElementById(id);
    },
    waves() {
      return document.querySelectorAll('[data-atlas-feedback="click"]');
    },
    pseudoStyle(node, pseudo, style) {
      pseudoStyles.set(node, { ...pseudoStyles.get(node), [pseudo]: style });
    },
    reduce() {
      reduced = true;
      for (const listener of listeners) listener();
    },
  };
}

function nativeFeedbackFixture(h) {
  h.document.documentElement.style.setProperty('--motion-duration-click-feedback', '400ms');
  h.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 10,
    y: 10,
    left: 10,
    top: 10,
    right: 110,
    bottom: 58,
    width: 100,
    height: 48,
  });
  return () => h.document.querySelectorAll('[data-atlas-feedback="click"]');
}

test('Delegated click feedback preserves immediate activation, deduplicates nested installs and removes its transient', async t => {
  const h = feedbackFixture(t);
  let activations = 0;
  h.get('button').addEventListener('click', () => {
    activations += 1;
  });
  const firstClick = new h.window.MouseEvent('click', { bubbles: true, cancelable: true });
  h.get('button').dispatchEvent(firstClick);
  assert.equal(activations, 1);
  const disposeDocument = installInteractionFeedback(h.document, firstClick);
  assert.equal(
    activations,
    1,
    'first-event replay presents feedback without redispatching activation',
  );
  assert.equal(h.waves().length, 1, 'intent-loaded installation presents the first click');
  const disposeScope = installInteractionFeedback(h.document.querySelector('main'));
  t.after(disposeDocument);
  t.after(disposeScope);
  h.get('button').click();
  assert.equal(activations, 2, 'business activation does not wait for presentation');
  assert.equal(h.waves().length, 1);
  const wave = h.waves()[0];
  assert.equal(wave.getAttribute('aria-hidden'), 'true');
  wave.dispatchEvent(new h.window.Event('animationend'));
  assert.equal(h.waves().length, 0);
  const button = h.get('button');
  button.className = 'atlas-button';
  button.style.setProperty('--button-face', '#0080cc');
  button.style.borderTopColor = 'black';
  button.style.borderTopWidth = '0px';
  button.style.backgroundColor = 'transparent';
  h.pseudoStyle(button, '::before', { content: '""', backgroundColor: '#0080cc' });
  button.click();
  assert.equal(
    h.waves()[0].style.getPropertyValue('--click-feedback-color'),
    'rgb(0, 128, 204)',
    'pseudo-painted Atlas face owns the wave color',
  );
  h.waves()[0].dispatchEvent(new h.window.Event('animationend'));
  for (const id of ['radio', 'check', 'switch', 'slider']) {
    const control = h.get(id);
    const visual = control.closest('.ant-checkbox,.ant-radio') ?? control;
    visual.style.setProperty('--ant-color-primary', '#0080cc');
    control.click();
    assert.equal(
      h.waves()[0].style.getPropertyValue('--click-feedback-color'),
      '#0080cc',
      `${id} uses its semantic primary rather than an invisible border`,
    );
    h.waves()[0].dispatchEvent(new h.window.Event('animationend'));
  }
  h.get('link').style.color = '#005fa3';
  h.get('link').dispatchEvent(
    new h.window.MouseEvent('click', { bubbles: true, cancelable: true }),
  );
  assert.equal(
    h.waves()[0].style.getPropertyValue('--click-feedback-color'),
    h.window.getComputedStyle(h.get('link')).color,
    'links use their actual colored text',
  );
  h.waves()[0].dispatchEvent(new h.window.Event('animationend'));
  h.get('button').click();
  disposeScope();
  assert.equal(h.waves().length, 1, 'another registered owner remains active');
  disposeDocument();
  assert.equal(h.waves().length, 0);
  h.get('button').click();
  assert.equal(h.waves().length, 0, 'all delegated listeners were released');
  const deferred = feedbackFixture(t);
  let deferredActivations = 0;
  deferred.get('button').addEventListener('click', () => {
    deferredActivations++;
  });
  const stopDeferred = installDeferredFeedback(deferred.document);
  t.after(stopDeferred);
  assert.equal(deferred.waves().length, 0);
  deferred.get('button').click();
  assert.equal(
    deferredActivations,
    1,
    'first business action stays immediate during intent loading',
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(deferredActivations, 1, 'presentation replay never repeats the business action');
  assert.equal(deferred.waves().length, 1, 'the first click receives deferred feedback');
  stopDeferred();
  assert.equal(deferred.waves().length, 0);
});

test('Native label forwarding yields one wave and blocked/read-only/reduced-motion targets yield none', t => {
  const h = feedbackFixture(t);
  const dispose = installInteractionFeedback(h.document);
  t.after(dispose);
  h.get('check').closest('label').click();
  assert.equal(h.get('check').checked, true);
  assert.equal(h.waves().length, 1, 'label and forwarded native click share one target');
  h.waves()[0].dispatchEvent(new h.window.Event('animationcancel'));
  for (const id of ['busy', 'disabled', 'readonly', 'optout']) h.get(id).click();
  assert.equal(h.waves().length, 0);
  h.get('link').dispatchEvent(
    new h.window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }),
  );
  assert.equal(h.waves().length, 1, 'keyboard-generated click works without pointerdown');
  h.reduce();
  assert.equal(h.waves().length, 0, 'preference changes clear in-flight decoration');
  h.get('button').click();
  assert.equal(h.waves().length, 0);
});

test('Minified CSS duration tokens retain feedback and its finite cleanup deadline', t => {
  const h = feedbackFixture(t);
  const dispose = installInteractionFeedback(h.document);
  t.after(dispose);
  const deadlines = [];
  const setTimeout = h.window.setTimeout.bind(h.window);
  h.window.setTimeout = (callback, delay) => {
    deadlines.push({ callback, delay });
    return setTimeout(callback, delay);
  };
  for (const duration of ['.4s', '.4S', '400MS', '0.4s', '400ms']) {
    h.document.documentElement.style.setProperty('--motion-duration-click-feedback', duration);
    h.get('button').click();
    assert.equal(
      h.waves().length,
      1,
      `${duration} remains valid after production CSS minification`,
    );
    assert.equal(deadlines.at(-1).delay, 800, 'cleanup remains twice the resolved 400ms duration');
    deadlines.at(-1).callback();
    assert.equal(h.waves().length, 0, 'a missed animation event still removes decoration');
  }
  const validDeadlines = deadlines.length;
  for (const duration of [
    '0ms',
    '0s',
    '-.4s',
    '-400ms',
    'NaNs',
    'Infinityms',
    '400',
    '4px',
    '.s',
  ]) {
    h.document.documentElement.style.setProperty('--motion-duration-click-feedback', duration);
    h.get('button').click();
    assert.equal(h.waves().length, 0, `${duration} cannot start feedback`);
  }
  assert.equal(deadlines.length, validDeadlines, 'invalid tokens cannot schedule cleanup work');
});

test('Slider keyboard feedback measures the committed native value and position without delaying focus', async t => {
  const h = feedbackFixture(t);
  const dispose = installInteractionFeedback(h.document);
  t.after(dispose);
  const slider = h.get('slider');
  const bounds = slider.getBoundingClientRect();
  slider.getBoundingClientRect = () => ({
    ...bounds,
    left: 10 + Number(slider.getAttribute('aria-valuenow')),
  });
  slider.focus();
  slider.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') slider.setAttribute('aria-valuenow', '2');
  });
  slider.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(slider.getAttribute('aria-valuenow'), '2');
  assert.ok(h.document.activeElement === slider);
  await new Promise(resolve => h.window.requestAnimationFrame(resolve));
  assert.equal(h.waves().length, 1);
  assert.equal(h.waves()[0].style.left, '12px', 'the native key handler moves the measured handle');
  slider.remove();
  dispose();
  assert.equal(h.waves().length, 0);
});

test('Slider feedback follows presentation movement after immediate native commit and releases its frame loop', async t => {
  for (const finish of [
    'animationend',
    'animationcancel',
    'scroll',
    'resize',
    'reduce',
    'dispose',
    'remove',
  ]) {
    await t.test(finish, t => {
      const h = feedbackFixture(t);
      const frames = new Map();
      let frameId = 0;
      h.window.requestAnimationFrame = callback => {
        frames.set(++frameId, callback);
        return frameId;
      };
      h.window.cancelAnimationFrame = id => frames.delete(id);
      const paint = () => {
        const callbacks = [...frames.values()];
        frames.clear();
        for (const callback of callbacks) callback(16);
      };
      const dispose = installInteractionFeedback(h.document);
      t.after(dispose);
      const slider = h.get('slider');
      const bounds = slider.getBoundingClientRect();
      let visualLeft = 240;
      slider.getBoundingClientRect = () => ({ ...bounds, left: visualLeft });
      let changes = 0;
      slider.addEventListener('keydown', () => {
        slider.setAttribute('aria-valuenow', '1');
        changes++;
      });
      slider.focus();
      slider.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      assert.equal(
        slider.getAttribute('aria-valuenow'),
        '1',
        'the value commits before visual travel',
      );
      assert.equal(h.document.activeElement, slider);
      paint();
      assert.equal(h.waves().length, 1);
      assert.equal(
        h.waves()[0].style.left,
        '240px',
        'feedback begins at the current painted handle',
      );
      visualLeft = 136;
      paint();
      assert.equal(
        h.waves()[0].style.left,
        '136px',
        'feedback follows the ongoing position transition',
      );
      visualLeft = 32;
      paint();
      assert.equal(h.waves()[0].style.left, '32px', 'feedback reaches the final painted position');
      assert.equal(changes, 1, 'frame tracking never replays native input');
      if (finish === 'scroll')
        h.document.querySelector('main').dispatchEvent(new h.window.Event('scroll'));
      else if (finish === 'resize') h.window.dispatchEvent(new h.window.Event('resize'));
      else if (finish === 'reduce') h.reduce();
      else if (finish === 'dispose') dispose();
      else if (finish === 'remove') slider.remove();
      else h.waves()[0].dispatchEvent(new h.window.Event(finish));
      paint();
      assert.equal(h.waves().length, 0, 'the active decoration is removed');
      assert.equal(frames.size, 0, 'all geometry tracking frames are released');
      assert.equal(changes, 1);
    });
  }
});

test('Rapid Slider keyboard input coalesces final-position feedback and pending decoration remains disposable', async t => {
  for (const invalidation of ['none', 'scroll', 'resize', 'reduce', 'dispose', 'remove']) {
    await t.test(invalidation, async t => {
      const h = feedbackFixture(t);
      const dispose = installInteractionFeedback(h.document);
      t.after(dispose);
      const slider = h.get('slider');
      const bounds = slider.getBoundingClientRect();
      slider.getBoundingClientRect = () => ({
        ...bounds,
        left: 10 + Number(slider.getAttribute('aria-valuenow')),
      });
      slider.addEventListener('keydown', () => {
        slider.setAttribute(
          'aria-valuenow',
          String(Number(slider.getAttribute('aria-valuenow')) + 1),
        );
      });
      slider.focus();
      for (let index = 0; index < 3; index++) {
        slider.dispatchEvent(
          new h.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        );
      }
      assert.equal(
        slider.getAttribute('aria-valuenow'),
        '4',
        'all native input commits immediately',
      );
      assert.equal(h.document.activeElement, slider);
      assert.equal(h.waves().length, 0, 'only decoration waits for committed geometry');
      if (invalidation === 'scroll')
        h.document.querySelector('main').dispatchEvent(new h.window.Event('scroll'));
      else if (invalidation === 'resize') h.window.dispatchEvent(new h.window.Event('resize'));
      else if (invalidation === 'reduce') h.reduce();
      else if (invalidation === 'dispose') dispose();
      else if (invalidation === 'remove') slider.remove();
      await new Promise(resolve => h.window.requestAnimationFrame(resolve));
      assert.equal(h.waves().length, invalidation === 'none' ? 1 : 0);
      if (invalidation === 'none') assert.equal(h.waves()[0].style.left, '14px');
      assert.equal(slider.getAttribute('aria-valuenow'), '4', 'cleanup never undoes native input');
    });
  }
});

test('Button feedback uses the painted pseudo face and preserves transparent foreground and selection fallbacks', t => {
  const h = feedbackFixture(t);
  const dispose = installInteractionFeedback(h.document);
  t.after(dispose);
  const button = h.get('button');
  button.style.setProperty('--button-face', '#0099ff');
  button.style.setProperty('--ant-color-primary', '#0099ff');
  button.style.backgroundColor = '#005580';
  button.style.color = '#242622';
  for (const className of ['atlas-button', 'ant-btn ant-btn-primary']) {
    button.className = className;
    for (const backgroundColor of ['#33adff', '#0083db']) {
      h.pseudoStyle(button, '::before', { content: '""', backgroundColor });
      button.click();
      assert.equal(
        h.waves()[0].style.getPropertyValue('--click-feedback-color'),
        backgroundColor === '#33adff' ? 'rgb(51, 173, 255)' : 'rgb(0, 131, 219)',
        `${className} uses its current hover/pressed face instead of its seed or root edge`,
      );
      h.waves()[0].dispatchEvent(new h.window.Event('animationend'));
    }
  }
  button.className = 'atlas-button ant-btn-variant-link';
  button.style.backgroundColor = 'transparent';
  button.style.color = '#005fa3';
  h.pseudoStyle(button, '::before', { content: 'none', backgroundColor: '#0099ff' });
  button.click();
  assert.equal(
    h.waves()[0].style.getPropertyValue('--click-feedback-color'),
    'rgb(0, 95, 163)',
    'an absent face cannot override a transparent action’s visible foreground',
  );
  h.waves()[0].dispatchEvent(new h.window.Event('animationend'));
  button.style.backgroundColor = '#005580';
  h.pseudoStyle(button, '::before', { content: '""', backgroundColor: 'white' });
  button.click();
  assert.equal(
    h.waves()[0].style.getPropertyValue('--click-feedback-color'),
    'rgb(0, 95, 163)',
    'a white face falls back to visible ink instead of the hidden lower edge',
  );
  h.waves()[0].dispatchEvent(new h.window.Event('animationend'));
  for (const id of ['check', 'radio', 'switch', 'slider']) {
    const control = h.get(id);
    const visual = control.closest('.ant-checkbox,.ant-radio') ?? control;
    visual.style.setProperty('--ant-color-primary', '#0099ff');
    visual.style.backgroundColor = '#33adff';
    control.click();
    assert.equal(
      h.waves()[0].style.getPropertyValue('--click-feedback-color'),
      'rgb(51, 173, 255)',
      `${id} uses its resolved selection paint before its seed`,
    );
    h.waves()[0].dispatchEvent(new h.window.Event('animationend'));
    for (const backgroundColor of ['white', 'transparent']) {
      visual.style.backgroundColor = backgroundColor;
      control.click();
      assert.equal(
        h.waves()[0].style.getPropertyValue('--click-feedback-color'),
        '#0099ff',
        `${id} retains its own seed when ${backgroundColor} cannot color the wave`,
      );
      h.waves()[0].dispatchEvent(new h.window.Event('animationend'));
    }
  }
});

test('Virtual Select portal options receive feedback while disabled options keep their value', async t => {
  const h = await mountPattern('WebSelectDemo', 'docs/src/react/SelectDemo.tsx', {
    documentation: true,
  });
  const waves = nativeFeedbackFixture(h);
  const dispose = installInteractionFeedback(h.document);
  const settlePopup = () =>
    h.act(async () => {
      // Native Trigger alignment can queue a second paint after mounting or
      // closing its portal. Keep that work inside the awaited React lifecycle.
      await new Promise(resolve =>
        h.window.requestAnimationFrame(() => h.window.requestAnimationFrame(resolve)),
      );
    });
  t.after(async () => {
    dispose();
    await settlePopup();
    await h.dispose();
  });
  const input = h.document.getElementById('select-single');
  const control = input.closest('.ant-select');
  await h.act(() =>
    control.dispatchEvent(
      new h.window.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }),
    ),
  );
  await h.waitFor(() => input.getAttribute('aria-expanded') === 'true', 'Select popup opens');
  await settlePopup();
  const option = text =>
    [...h.document.querySelectorAll('.ant-select-item-option')].find(
      item => item.textContent.trim() === text,
    );
  const disabled = option('Archived');
  assert.equal(disabled.getAttribute('aria-disabled'), 'true');
  await h.click(disabled);
  assert.equal(waves().length, 0);
  assert.match(control.textContent, /Design/);
  const operations = option('Operations');
  assert.equal(operations.getAttribute('role'), null, 'real virtual option has no ARIA role');
  assert.equal(control.contains(operations), false, 'popup is a separate native portal');
  await h.click(operations);
  await h.waitFor(() => input.getAttribute('aria-expanded') === 'false', 'Select popup closes');
  await settlePopup();
  assert.match(control.textContent, /Operations/, 'native selection commits immediately');
  assert.equal(waves().length, 1, 'the actual visible virtual option owns one transient');
});

test('Native Slider rail, mark and handle interactions paint the final handle without repeating changes', async t => {
  const values = [];
  const h = await mountPattern('default', 'docs/src/react/AtlasSlider.tsx', {
    defaultValue: 20,
    marks: { 20: '20', 80: '80' },
    tooltip: { open: false },
    onChange: value => values.push(value),
    'aria-label': 'Feedback slider',
  });
  t.after(() => h.dispose());
  const waves = nativeFeedbackFixture(h);
  const dispose = installInteractionFeedback(h.document);
  t.after(dispose);
  const rail = h.document.querySelector('.ant-slider-rail');
  const handle = h.document.querySelector('[role="slider"]');
  handle.getBoundingClientRect = () => ({
    x: 10 + Number(handle.getAttribute('aria-valuenow')),
    y: 10,
    left: 10 + Number(handle.getAttribute('aria-valuenow')),
    top: 10,
    right: 42 + Number(handle.getAttribute('aria-valuenow')),
    bottom: 42,
    width: 32,
    height: 32,
  });
  const pointer = (target, type, pointerId = 1) => {
    const event = new h.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: 80,
      clientY: 20,
      button: 0,
    });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    target.dispatchEvent(event);
  };
  await h.act(() => {
    pointer(rail, 'pointerdown');
    rail.dispatchEvent(
      new h.window.MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 80,
        clientY: 20,
        button: 0,
      }),
    );
  });
  assert.equal(handle.getAttribute('aria-valuenow'), '70');
  assert.deepEqual(values, [70], 'native rail input commits before decoration');
  await h.act(() => {
    pointer(h.document, 'pointerup');
    h.document.dispatchEvent(new h.window.MouseEvent('mouseup', { bubbles: true }));
    rail.click();
  });
  assert.equal(waves().length, 1, 'rail release plus synthetic click produces one effect');
  assert.equal(waves()[0].style.width, '32px', 'feedback follows the handle, not the rail');
  assert.equal(waves()[0].style.left, '80px', 'the final native handle position is used');
  waves()[0].dispatchEvent(new h.window.Event('animationend'));
  const mark = [...h.document.querySelectorAll('.ant-slider-mark-text')].find(
    node => node.textContent === '80',
  );
  await h.click(mark);
  assert.deepEqual(values, [70, 80], 'mark activation remains a single native change');
  await h.waitFor(() => waves().length === 1, 'mark feedback follows native value commit');
  assert.equal(waves()[0].style.width, '32px');
  assert.equal(waves()[0].style.left, '90px');
  waves()[0].dispatchEvent(new h.window.Event('animationend'));
  handle.focus();
  await h.act(() => {
    pointer(handle, 'pointerdown', 2);
    pointer(h.document, 'pointerup', 2);
    handle.click();
  });
  assert.equal(waves().length, 1);
  assert.equal(h.document.activeElement, handle);
  assert.deepEqual(values, [70, 80], 'feedback never changes a Slider value');
  waves()[0].dispatchEvent(new h.window.Event('animationend'));
  await h.act(() => {
    handle.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        keyCode: 39,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.deepEqual(values, [70, 80, 81], 'native keyboard selection commits immediately');
  assert.equal(handle.getAttribute('aria-valuenow'), '81');
  assert.equal(h.document.activeElement, handle);
  await h.waitFor(() => waves().length === 1, 'keyboard feedback follows native commit');
  assert.equal(waves()[0].style.left, '91px', 'keyboard feedback measures the moved native handle');
});

test('Native range keyboard crossing decorates the endpoint focused after sorted values commit', async t => {
  for (const entry of [
    { key: 'End', keyCode: 35, index: 0, values: [76, 100], focused: 1, left: '110px' },
    { key: 'Home', keyCode: 36, index: 1, values: [0, 24], focused: 0, left: '10px' },
  ]) {
    await t.test(entry.key, async t => {
      const values = [];
      const h = await mountPattern('default', 'docs/src/react/AtlasSlider.tsx', {
        range: true,
        allowCross: true,
        defaultValue: [24, 76],
        tooltip: { open: false },
        onChange: value => values.push(value),
      });
      t.after(() => h.dispose());
      const waves = nativeFeedbackFixture(h);
      const dispose = installInteractionFeedback(h.document);
      t.after(dispose);
      const handles = [...h.document.querySelectorAll('[role="slider"]')];
      for (const handle of handles) {
        const bounds = handle.getBoundingClientRect();
        handle.getBoundingClientRect = () => ({
          ...bounds,
          left: 10 + Number(handle.getAttribute('aria-valuenow')),
          width: 32,
          height: 32,
        });
      }
      await h.act(() => {
        handles[entry.index].focus();
        handles[entry.index].dispatchEvent(
          new h.window.KeyboardEvent('keydown', {
            key: entry.key,
            keyCode: entry.keyCode,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      assert.deepEqual(values, [entry.values], 'native crossing emits one immediate sorted change');
      assert.deepEqual(
        handles.map(handle => Number(handle.getAttribute('aria-valuenow'))),
        entry.values,
      );
      assert.equal(
        h.document.activeElement,
        handles[entry.focused],
        'native focus follows the moved value',
      );
      await h.waitFor(() => waves().length === 1, 'crossing feedback follows native commit');
      assert.equal(
        waves()[0].style.left,
        entry.left,
        'the moved endpoint owns the wave, not its former index',
      );
      assert.deepEqual(values, [entry.values], 'decoration does not repeat or undo crossing');
    });
  }
});

test('Rapid native range crossings retain one wave and tracker per Slider owner', async t => {
  const values = [];
  const h = await mountPattern('default', 'docs/src/react/AtlasSlider.tsx', {
    range: true,
    allowCross: true,
    defaultValue: [24, 76],
    tooltip: { open: false },
    onChange: value => values.push(value),
  });
  t.after(() => h.dispose());
  const waves = nativeFeedbackFixture(h);
  const frames = new Map();
  let frameId = 0;
  h.window.requestAnimationFrame = callback => {
    frames.set(++frameId, callback);
    return frameId;
  };
  h.window.cancelAnimationFrame = id => frames.delete(id);
  const paint = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(16);
  };
  const owner = h.document.querySelector('.ant-slider');
  const handles = [...owner.querySelectorAll('[role="slider"]')];
  for (const handle of handles) {
    const bounds = handle.getBoundingClientRect();
    handle.getBoundingClientRect = () => ({
      ...bounds,
      left: 10 + Number(handle.getAttribute('aria-valuenow')),
    });
  }
  const otherOwner = h.document.createElement('div');
  otherOwner.className = 'ant-slider';
  otherOwner.innerHTML = '<span role="slider" tabindex="0" aria-valuenow="20"></span>';
  h.document.body.append(otherOwner);
  const other = otherOwner.firstElementChild;
  const bounds = other.getBoundingClientRect();
  other.getBoundingClientRect = () => ({ ...bounds, left: 500 });
  const disposeRange = installInteractionFeedback(owner);
  const disposeOther = installInteractionFeedback(otherOwner);
  t.after(disposeRange);
  t.after(disposeOther);
  other.click();
  const independentWave = waves()[0];
  const key = async (target, name, keyCode) => {
    await h.act(() => {
      target.focus();
      target.dispatchEvent(
        new h.window.KeyboardEvent('keydown', {
          key: name,
          keyCode,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    paint();
  };
  await key(handles[0], 'End', 35);
  assert.equal(h.document.activeElement, handles[1]);
  assert.equal(waves().length, 2, 'separate Sliders retain independent waves');
  assert.equal(frames.size, 2, 'each active Slider has one tracking frame');
  const previous = [...waves()].find(wave => wave !== independentWave);
  await key(handles[1], 'Home', 36);
  assert.deepEqual(
    values,
    [
      [76, 100],
      [0, 76],
    ],
    'both native crossings commit once without waiting',
  );
  assert.equal(h.document.activeElement, handles[0]);
  assert.equal(waves().length, 2, 'the second crossing replaces its Slider’s previous wave');
  assert.equal(previous.isConnected, false, 'the former endpoint transient is removed');
  assert.equal(independentWave.isConnected, true, 'the other Slider remains independent');
  assert.equal(frames.size, 2, 'the replaced endpoint’s tracking frame is cancelled');
  disposeRange();
  assert.equal(waves().length, 1, 'scope cleanup uses the actual active target');
  assert.equal(waves()[0], independentWave);
  assert.equal(frames.size, 1);
  disposeOther();
  assert.equal(waves().length, 0);
  assert.equal(frames.size, 0);
});

test('Native range midpoint rail input decorates the handle selected by Slider, including reverse direction', async t => {
  for (const reverse of [false, true]) {
    await t.test(reverse ? 'reverse range' : 'forward range', async t => {
      const values = [];
      const h = await mountPattern('default', 'docs/src/react/AtlasSlider.tsx', {
        range: true,
        reverse,
        defaultValue: [24, 76],
        tooltip: { open: false },
        onChange: value => values.push(value),
      });
      t.after(() => h.dispose());
      const waves = nativeFeedbackFixture(h);
      const dispose = installInteractionFeedback(h.document);
      t.after(dispose);
      const rail = h.document.querySelector('.ant-slider-rail');
      const handles = [...h.document.querySelectorAll('[role="slider"]')];
      for (const handle of handles) {
        handle.getBoundingClientRect = () => {
          const value = Number(handle.getAttribute('aria-valuenow'));
          const left = 10 + (reverse ? 100 - value : value) - 16;
          return {
            x: left,
            y: 10,
            left,
            top: 10,
            right: left + 32,
            bottom: 42,
            width: 32,
            height: 32,
          };
        };
      }
      const pointer = (target, type) => {
        const event = new h.window.MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: 60,
          clientY: 20,
          button: 0,
        });
        Object.defineProperty(event, 'pointerId', { value: 1 });
        target.dispatchEvent(event);
      };
      await h.act(() => {
        pointer(rail, 'pointerdown');
        rail.dispatchEvent(
          new h.window.MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 60,
            clientY: 20,
            button: 0,
          }),
        );
      });
      assert.deepEqual(values, [[24, 50]], 'the native tie-break selects the last range handle');
      assert.equal(h.document.activeElement, handles[1], 'native Slider owns active-handle focus');
      await h.act(() => {
        pointer(h.document, 'pointerup');
        h.document.dispatchEvent(new h.window.MouseEvent('mouseup', { bubbles: true }));
      });
      assert.equal(waves().length, 1, 'release yields one handle transient');
      assert.equal(waves()[0].style.left, '44px', 'feedback uses the final native active handle');
      await h.click(rail);
      assert.equal(waves().length, 1, 'the synthetic click cannot decorate a different handle');
      assert.deepEqual(values, [[24, 50]], 'decoration never repeats the native value change');
    });
  }
});

test('Native date popup cells receive feedback and disabled dates remain blocked', async t => {
  const values = [];
  const h = await mountPattern('DateField', 'docs/src/react/workspace/kit/Fields.tsx', {
    value: '2026-10-14',
    open: true,
    disabledDate: date => date.date() === 15,
    onChange: value => values.push(value),
  });
  t.after(() => h.dispose());
  const waves = nativeFeedbackFixture(h);
  const dispose = installInteractionFeedback(h.document);
  t.after(dispose);
  const cell = day => h.document.querySelector(`.ant-picker-cell[title="2026-10-${day}"]`);
  await h.waitFor(() => cell('16'), 'native date popup is present');
  assert.ok(cell('15').classList.contains('ant-picker-cell-disabled'));
  await h.click(cell('15'));
  assert.deepEqual(values, []);
  assert.equal(waves().length, 0);
  await h.click(cell('16'));
  assert.deepEqual(values, ['2026-10-16'], 'native date selection commits immediately');
  assert.equal(waves().length, 1);
});

test('Dynamic native and menu actions share feedback without enabling blocked actions', t => {
  const h = feedbackFixture(t);
  const dispose = installInteractionFeedback(h.document);
  t.after(dispose);
  const portal = h.document.createElement('section');
  portal.innerHTML = `
    <input id="native-button" type="button" value="Run">
    <input id="native-submit" type="submit" value="Save">
    <input id="native-reset" type="reset" value="Reset">
    <span id="menu" role="menuitem" tabindex="0">Menu action</span>
    <span id="menu-check" role="menuitemcheckbox" aria-checked="false">Checked action</span>
    <span id="menu-radio" role="menuitemradio" aria-checked="false">Radio action</span>
    <span id="tree" role="treeitem" tabindex="0">Tree action</span>
    <span id="menu-disabled" role="menuitem" aria-disabled="true">Disabled action</span>
    <span id="menu-busy" role="menuitem" aria-busy="true">Busy action</span>
    <div class="ant-slider ant-slider-disabled"><div id="disabled-rail" class="ant-slider-rail"></div></div>
  `;
  h.document.body.append(portal);
  for (const id of [
    'native-button',
    'native-submit',
    'native-reset',
    'menu',
    'menu-check',
    'menu-radio',
    'tree',
  ]) {
    h.get(id).click();
    assert.equal(h.waves().length, 1, `${id} receives one transient after dynamic insertion`);
    h.waves()[0].dispatchEvent(new h.window.Event('animationend'));
  }
  for (const id of ['menu-disabled', 'menu-busy', 'disabled-rail']) h.get(id).click();
  assert.equal(h.waves().length, 0);
});

test('Deferred loading retains rapid completed actions and never replays business events', async t => {
  const h = feedbackFixture(t);
  const dispose = installDeferredFeedback(h.document);
  t.after(dispose);
  const counts = { button: 0, second: 0 };
  for (const id of Object.keys(counts)) {
    const target = h.get(id);
    target.addEventListener('click', () => counts[id]++);
    for (const name of ['pointerdown', 'pointerup', 'click'])
      target.dispatchEvent(new h.window.MouseEvent(name, { bubbles: true, cancelable: true }));
  }
  assert.deepEqual(counts, { button: 1, second: 1 }, 'both native actions are immediate');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(counts, { button: 1, second: 1 }, 'presentation does not redispatch actions');
  assert.equal(h.waves().length, 2, 'both completed actions survive optional module loading');
  dispose();
  assert.equal(h.waves().length, 0, 'all replay decoration remains disposable');
});

test('Deferred loading drops stale presentation after scroll or resize while keeping later actions', async t => {
  for (const name of ['scroll', 'resize']) {
    await t.test(name, async t => {
      const h = feedbackFixture(t);
      const dispose = installDeferredFeedback(h.document);
      t.after(dispose);
      let activations = 0;
      h.get('button').addEventListener('click', () => activations++);
      h.get('button').click();
      assert.equal(activations, 1, 'the original business action completes immediately');
      const changed = name === 'scroll' ? h.document.querySelector('main') : h.window;
      changed.dispatchEvent(new h.window.Event(name));
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(h.waves().length, 0, 'pre-layout-change feedback is not replayed');
      assert.equal(activations, 1, 'invalidation does not repeat business activation');
      h.get('button').click();
      assert.equal(h.waves().length, 1, 'a fresh action still receives normal feedback');
      assert.equal(activations, 2);
      dispose();
      changed.dispatchEvent(new h.window.Event(name));
      h.get('second').click();
      assert.equal(h.waves().length, 0, 'the disposed loader and controller stay inactive');
    });
  }
});

test('Read-only input and stepper stay selectable/focusable while their actions remain blocked', async t => {
  const h = await mountPattern('WebInputDemo', 'docs/src/react/InputDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const field = h.document.getElementById('input-readonly');
  assert.equal(field.readOnly, true);
  assert.equal(field.disabled, false);
  await h.act(() => {
    field.focus();
    field.select();
  });
  assert.ok(h.document.activeElement === field);
  assert.equal(field.selectionStart, 0);
  assert.equal(field.selectionEnd, field.value.length);
  assert.match(
    h.document.getElementById(field.getAttribute('aria-describedby')).textContent,
    /select and copy/,
  );
  assert.ok(
    field.closest('.ant-input-affix-wrapper').querySelector('[data-icon-name="lock-simple"]'),
  );
  const quantity = h.document.getElementById('input-readonly-number');
  assert.equal(quantity.readOnly, true);
  assert.equal(quantity.disabled, false);
  for (const button of quantity.closest('.atlas-number-stepper').querySelectorAll('button')) {
    assert.equal(button.disabled, true);
    await h.click(button);
  }
  assert.equal(quantity.value, '42');
});

test('Radio double and triple choices reuse the wrapped master with native single selection', async t => {
  const h = await mountPattern('WebRadioDemo', 'docs/src/react/RadioDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const groups = h.document.querySelectorAll('.atlas-button-group');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].getAttribute('data-button-group-count'), '3');
  assert.equal(groups[1].getAttribute('data-button-group-count'), '2');
  for (const group of groups) {
    const radios = group.querySelectorAll('input[type="radio"]');
    await h.click(radios[1]);
    assert.equal([...radios].filter(input => input.checked).length, 1);
    assert.equal(radios[1].checked, true);
  }
});
