import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import postcss from 'postcss';
import { buttonByText, headerByText, mountPattern, selectOption } from './harness.mjs';

test('Magenta palette reaches the shared AntD Button renderer in every tone', async t => {
  for (const [tone, face, edge] of [
    ['middle', '#da037d', '#b3006b'],
    ['dark', '#b3006b', '#8c0059'],
    ['light', '#ff7dba', '#f250a1'],
    ['pastel', '#ffe6f0', '#ffa6cc'],
  ]) {
    await t.test(tone, async t => {
      const h = await mountPattern('default', 'docs/src/react/GenUXButton.tsx', {
        palette: 'magenta',
        tone,
      });
      t.after(() => h.dispose());
      const button = h.document.querySelector('.genux-button');
      assert.equal(button.style.getPropertyValue('--button-face'), face);
      assert.equal(button.style.getPropertyValue('--button-edge'), edge);
      for (const theme of ['dark', 'light']) {
        await h.act(async () => {
          h.document.documentElement.dataset.theme = theme;
          h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
        });
        assert.equal(h.document.querySelector('.genux-button'), button);
        assert.equal(button.style.getPropertyValue('--button-face'), face);
      }
    });
  }
});

test('GenUXButton invalid visual values fall back to the approved defaults', async t => {
  const h = await mountPattern('default', 'docs/src/react/GenUXButton.tsx', {
    size: 'middle',
    radius: '6',
    shadow: 'unknown',
    width: 'unknown',
  });
  t.after(() => h.dispose());
  const button = h.document.querySelector('.genux-button');
  assert.ok(button);
  assert.equal(button.style.minHeight, '3.5rem');
  assert.equal(button.style.getPropertyValue('--button-radius'), '5px');
  assert.equal(button.style.getPropertyValue('--button-shadow'), 'none');
  assert.equal(button.dataset.state, 'default');
  assert.equal(button.dataset.width, 'content');
  assert.equal(button.style.minWidth, '');
});

test('Button approved dimensions use canonical padding and native full-width behavior', async t => {
  const h = await mountPattern('default', 'docs/src/react/ButtonDimensions.tsx');
  t.after(() => h.dispose());
  assert.equal(h.document.querySelectorAll('.genux-demo').length, 1);
  const sizes = [...h.document.querySelectorAll('[data-approved-size] .genux-button')];
  assert.deepEqual(
    sizes.map(button => button.dataset.size),
    ['sm', 'md', 'lg'],
  );
  assert.deepEqual(
    sizes.map(button => button.style.minHeight),
    ['3rem', '3.5rem', '4rem'],
  );
  assert.deepEqual(
    sizes.map(button => button.style.paddingInline),
    ['1.5625rem', '1.875rem', '1.5rem'],
  );
  const widths = [...h.document.querySelectorAll('[data-approved-width] .genux-button')];
  assert.deepEqual(
    widths.map(button => button.dataset.width),
    ['content', 'wide', 'full'],
  );
  assert.equal(widths[0].style.minWidth, '');
  assert.equal(widths[1].style.minWidth, 'min(100%, 10.9375rem)');
  assert.equal(widths[2].classList.contains('ant-btn-block'), true);
  assert.equal(widths[0].classList.contains('ant-btn-block'), false);
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    for (const [index, button] of widths.entries())
      assert.equal(
        h.document.querySelectorAll('[data-approved-width] .genux-button')[index],
        button,
      );
  }
});

test('Button approved states share one provider and retain semantics and drafts across themes', async t => {
  const h = await mountPattern('default', 'docs/src/react/ButtonDemo.tsx');
  t.after(() => h.dispose());
  const cells = [...h.document.querySelectorAll('[data-approved-state]')];
  assert.deepEqual(
    cells.map(cell => cell.dataset.approvedState),
    ['default', 'hover', 'pressed', 'disabled', 'loading'],
  );
  assert.equal(h.document.querySelectorAll('.genux-demo').length, 1);
  const buttons = cells.map(cell => cell.querySelector('button'));
  const busyStates = new Set(['loading']);
  for (const button of buttons) {
    const state = button.dataset.state;
    const busy = busyStates.has(state);
    assert.equal(button.getAttribute('aria-busy'), String(busy), state);
    assert.equal(button.getAttribute('aria-disabled'), String(busy || state === 'disabled'), state);
    assert.equal(button.disabled, state === 'disabled', state);
    assert.equal(button.dataset.pressed, String(state === 'pressed'), state);
    assert.equal(
      Boolean(button.querySelector('.genux-button-progress[aria-hidden="true"]')),
      busy,
      state,
    );
    assert.ok(!button.querySelector('.anticon-loading'), `${state}: no default spinner`);
    if (busy) {
      assert.ok(
        button.classList.contains('ant-btn-loading'),
        'Native loading blocks repeat clicks',
      );
      assert.equal(button.querySelector('.ant-btn-icon')?.style.display, 'none');
    }
  }
  assert.equal(buttons.at(-1).textContent.trim(), 'Processing');
  const text = h.document.querySelector('#button-label');
  const preview = h.document.querySelector('.playground-preview .genux-button');
  await h.type(text, 'Korunan buton metni');
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(h.document.querySelector('.genux-demo').dataset.themeMode, mode);
    assert.equal(h.document.querySelector('#button-label'), text);
    assert.equal(preview.textContent.trim(), 'Korunan buton metni');
    for (const [index, button] of buttons.entries())
      assert.equal(h.document.querySelectorAll('[data-approved-state] button')[index], button);
  }
});

test('Input web number stepper composes real icon buttons and retains native editing and arrows', async t => {
  const h = await mountPattern('default', 'docs/src/react/InputDemo.tsx', {
    numberMode: 'spinner',
  });
  t.after(() => h.dispose());
  const input = h.document.querySelector('#input-number');
  assert.equal(input.getAttribute('role'), 'spinbutton');
  const owner = input.closest('.genux-number-stepper');
  assert.ok(owner, 'number actions must compose the shared icon button');
  const down = owner.querySelector('button[aria-label="Remove"]');
  const up = owner.querySelector('button[aria-label="Increase"]');
  assert.equal(owner.querySelectorAll('.ant-input-number-action').length, 0);
  assert.equal(owner.querySelectorAll('button button, [role="button"] button').length, 0);
  assert.ok(down.compareDocumentPosition(input) & h.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(input.compareDocumentPosition(up) & h.window.Node.DOCUMENT_POSITION_FOLLOWING);
  for (const [action, name] of [
    [down, 'trash'],
    [up, 'plus'],
  ]) {
    const svg = action.querySelector('svg[data-icon-library="phosphor"]');
    assert.equal(svg?.dataset.iconName, name);
    assert.equal(svg?.getAttribute('viewBox'), '0 0 256 256');
    assert.equal(svg?.getAttribute('aria-hidden'), 'true');
    assert.equal(svg?.getAttribute('focusable'), 'false');
    assert.ok(svg?.querySelector('path[d]'));
    assert.ok(action.classList.contains('genux-button'));
    assert.equal(action.textContent.trim(), '', 'no text-glyph icon');
  }
  const step = action => h.click(action);
  const key = async name => {
    await h.act(async () => {
      input.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: name, bubbles: true }));
    });
  };
  await step(down);
  assert.equal(input.value, '', 'trash clears the local example through onRemove');
  assert.equal(owner.querySelector('button[aria-label="Decrease"]').disabled, true);
  await step(up);
  assert.equal(input.value, '1');
  await key('ArrowDown');
  assert.equal(input.value, '1', 'ArrowDown at minimum must not invoke removal');
  await h.type(input, '7');
  await key('ArrowUp');
  assert.equal(input.value, '8');
  await key('ArrowDown');
  assert.equal(input.value, '7');
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(h.document.querySelector('#input-number'), input);
    assert.equal(input.value, '7');
  }
});

test('only-icon Button inherits shared geometry, semantics and an accessible name', async t => {
  let calls = 0;
  const h = await mountPattern('default', 'docs/src/react/GenUXIconButton.tsx', {
    icon: 'plus',
    'aria-label': 'Increase',
    size: 'compact',
    radius: 'pill',
    onClick: () => calls++,
  });
  t.after(() => h.dispose());
  const button = h.document.querySelector('button');
  assert.ok(button.classList.contains('genux-button'));
  assert.equal(button.getAttribute('aria-label'), 'Increase');
  assert.equal(button.textContent.trim(), '');
  assert.equal(button.style.minHeight, '3rem');
  assert.equal(button.style.minWidth, '3rem');
  assert.equal(button.style.paddingInline, '0px');
  assert.equal(button.style.getPropertyValue('--button-radius'), '9999px');
  assert.equal(button.querySelector('svg').getAttribute('aria-hidden'), 'true');
  await h.click(button);
  assert.equal(calls, 1);
});

test('only-icon Button respects the native ConfigProvider disabled context', async t => {
  let calls = 0;
  const h = await mountPattern(
    'default',
    'docs/src/react/GenUXIconButton.tsx',
    {
      icon: 'trash',
      'aria-label': 'Remove',
      onClick: () => calls++,
    },
    { componentDisabled: true },
  );
  t.after(() => h.dispose());
  const button = h.document.querySelector('button');
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  await h.click(button);
  assert.equal(calls, 0);
});

test('quantity minimum is configurable and removal is separate from numeric decrement', async t => {
  const changes = [];
  let removals = 0;
  const h = await mountPattern('default', 'docs/src/react/NumberStepper.tsx', {
    defaultValue: 12,
    min: 12,
    max: 13,
    onChange: value => changes.push(value),
    onRemove: () => removals++,
  });
  t.after(() => h.dispose());
  const input = h.document.querySelector('input');
  const action = label => h.document.querySelector(`button[aria-label="${label}"]`);
  await h.click(action('Remove'));
  assert.equal(removals, 1);
  assert.deepEqual(changes, []);
  assert.equal(input.value, '12');
  await h.click(action('Increase'));
  assert.deepEqual(changes, [13]);
  assert.equal(action('Increase').disabled, true);
  assert.ok(action('Decrease').querySelector('svg[data-icon-name="minus"]'));
  await h.click(action('Decrease'));
  assert.deepEqual(changes, [13, 12]);
  assert.ok(action('Remove').querySelector('svg[data-icon-name="trash"]'));
  assert.equal(removals, 1);
});

test('external quantity buttons respect controlled values and exact decimal bounds', async t => {
  await t.test('controlled parent authority', async t => {
    const changes = [];
    const h = await mountPattern('default', 'docs/src/react/NumberStepper.tsx', {
      value: 12,
      min: 12,
      onChange: value => changes.push(value),
    });
    t.after(() => h.dispose());
    assert.equal(h.document.querySelector('button[aria-label="Remove"]').disabled, true);
    await h.click(h.document.querySelector('button[aria-label="Increase"]'));
    assert.deepEqual(changes, [13]);
    assert.equal(h.document.querySelector('input').value, '12');
  });
  await t.test('stringMode precision and maximum', async t => {
    const changes = [];
    const h = await mountPattern('default', 'docs/src/react/NumberStepper.tsx', {
      defaultValue: '0.1',
      min: '0.1',
      max: '0.3',
      step: '0.1',
      stringMode: true,
      onChange: value => changes.push(value),
    });
    t.after(() => h.dispose());
    const up = h.document.querySelector('button[aria-label="Increase"]');
    await h.click(up);
    await h.click(up);
    await h.click(up);
    assert.deepEqual(changes, ['0.2', '0.3']);
    assert.equal(up.disabled, true);
  });
  await t.test('explicit precision', async t => {
    const changes = [];
    const h = await mountPattern('default', 'docs/src/react/NumberStepper.tsx', {
      defaultValue: 1,
      step: '0.055',
      precision: 2,
      onChange: value => changes.push(value),
    });
    t.after(() => h.dispose());
    await h.click(h.document.querySelector('button[aria-label="Increase"]'));
    assert.deepEqual(changes, [1.06]);
  });
});

test('quantity actions stay blocked for disabled and read-only fields', async t => {
  for (const flag of ['disabled', 'readOnly']) {
    await t.test(flag, async t => {
      let calls = 0;
      const h = await mountPattern('default', 'docs/src/react/NumberStepper.tsx', {
        defaultValue: 1,
        [flag]: true,
        onChange: () => calls++,
        onRemove: () => calls++,
      });
      t.after(() => h.dispose());
      for (const button of h.document.querySelectorAll('button')) {
        assert.equal(button.disabled, true);
        await h.click(button);
      }
      assert.equal(calls, 0);
    });
  }
});

test('quantity explicit enabled override applies to both input and icon buttons', async t => {
  const h = await mountPattern(
    'default',
    'docs/src/react/NumberStepper.tsx',
    {
      defaultValue: 2,
      min: 1,
      disabled: false,
    },
    { componentDisabled: true },
  );
  t.after(() => h.dispose());
  const input = h.document.querySelector('input');
  assert.equal(input.disabled, false);
  const up = h.document.querySelector('button[aria-label="Increase"]');
  assert.equal(up.disabled, false);
  await h.click(up);
  assert.equal(input.value, '3');
});

test('Input native fallback retains AntD number controls', async t => {
  const h = await mountPattern('default', 'docs/src/react/InputDemo.tsx');
  t.after(() => h.dispose());
  const owner = h.document.querySelector('#input-number').closest('.ant-input-number');
  assert.ok(owner.classList.contains('ant-input-number-mode-input'));
  assert.equal(owner.querySelectorAll('svg[data-icon-library="phosphor"]').length, 0);
});

test('Switch shared sizing preserves immediate state, identity and disabled states across themes', async t => {
  const h = await mountPattern('WebSwitchDemo', 'docs/src/react/SwitchDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const owner = h.document.querySelector('.genux-demo[data-size-profile]');
  const preview = h.document.querySelector('[data-switch-preview]');
  const switches = [...preview.querySelectorAll('button[role="switch"]')];
  assert.equal(switches.length, 15);
  const toggle = h.document.querySelector('#switch-notify');
  const disabled = h.document.querySelector('#switch-disabled');
  const loading = h.document.querySelector('#switch-loading');
  const required = h.document.querySelector('#switch-required-on');
  assert.equal(toggle.getAttribute('aria-checked'), 'false');
  await h.click(toggle);
  assert.equal(toggle.getAttribute('aria-checked'), 'true');
  const tweaker = h.document.querySelector('[data-tweaker-trigger]');
  assert.equal(tweaker.getAttribute('aria-expanded'), 'false');
  await h.click(tweaker);
  assert.equal(tweaker.getAttribute('aria-expanded'), 'true');
  const options = [...owner.querySelectorAll('[data-size-control] input[type="radio"]')];
  assert.equal(options.length, 3);
  for (const [index, profile] of ['sm', 'md', 'lg'].entries()) {
    await h.click(options[index]);
    assert.equal(owner.dataset.sizeProfile, profile);
    assert.equal(
      owner.style.getPropertyValue('--genux-component-height'),
      [48, 56, 64][index] + 'px',
    );
    assert.equal(
      owner.style.getPropertyValue('--genux-selection-height'),
      [32, 40, 50][index] + 'px',
    );
    for (const [position, control] of switches.entries())
      assert.equal(preview.querySelectorAll('button[role="switch"]')[position], control);
  }
  await h.click(h.document.querySelector('button[aria-label="Close tweaker"]'));
  assert.equal(tweaker.getAttribute('aria-expanded'), 'false');
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
      disabled.click();
      loading.click();
      required.click();
      for (const [key, keyCode] of [
        ['ArrowLeft', 37],
        ['ArrowRight', 39],
        ['Enter', 13],
        [' ', 32],
      ])
        required.dispatchEvent(
          new h.window.KeyboardEvent('keydown', { key, keyCode, which: keyCode, bubbles: true }),
        );
    });
    assert.equal(disabled.getAttribute('aria-checked'), 'false');
    assert.equal(loading.getAttribute('aria-checked'), 'true');
    assert.equal(required.getAttribute('aria-checked'), 'true');
    assert.ok(disabled.disabled && loading.disabled && required.disabled);
    assert.equal(toggle.getAttribute('aria-checked'), 'true');
  }
  await h.click(toggle);
  assert.equal(toggle.getAttribute('aria-checked'), 'false');
});

test('Switch web content variants toggle immediately and preserve labels, nodes and state across locale changes', async t => {
  const h = await mountPattern('WebSwitchDemo', 'docs/src/react/SwitchDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const section = h.document.querySelector('[data-switch-content-examples]');
  assert.ok(section, 'the documentation shows text, number, icon and combined examples');
  const switches = [...section.querySelectorAll('button[role="switch"]')];
  assert.equal(switches.length, 8, 'each variant shows both starting states');
  for (const [index, control] of switches.entries()) {
    assert.equal(control.getAttribute('aria-checked'), String(index % 2 === 0));
    const nameIds = control.getAttribute('aria-labelledby').split(' ');
    assert.ok(nameIds.every(id => h.document.getElementById(id)?.textContent.trim()));
    const name = nameIds.map(id => h.document.getElementById(id).textContent).join(' ');
    const contents = [...control.querySelectorAll('.genux-switch-state')];
    assert.equal(contents.length, 2, 'both state contents stay mounted');
    assert.ok(contents.every(content => content.getAttribute('aria-hidden') === 'true'));
    await h.act(async () => control.click());
    assert.equal(control.getAttribute('aria-checked'), String(index % 2 !== 0));
    assert.equal(nameIds.map(id => h.document.getElementById(id).textContent).join(' '), name);
    assert.deepEqual([...control.querySelectorAll('.genux-switch-state')], contents);
  }
  const iconNames = [...section.querySelectorAll('svg')].map(icon => icon.dataset.iconName);
  assert.deepEqual(iconNames, [
    'check',
    'x',
    'check',
    'x',
    'smiley',
    'smiley-sad',
    'smiley',
    'smiley-sad',
  ]);
  await h.act(async () => {
    switches[6].focus();
    await h.setLocale('tr');
  });
  assert.match(section.textContent, /Mutlu/);
  assert.match(section.textContent, /Üzgün/);
  assert.match(section.textContent, /Başlangıçta açık/);
  assert.equal(h.document.activeElement, switches[6]);
  for (const [index, control] of switches.entries()) {
    assert.equal(section.querySelectorAll('button[role="switch"]')[index], control);
    assert.equal(control.getAttribute('aria-checked'), String(index % 2 !== 0));
  }
  await h.act(async () => h.setLocale('en'));
  assert.match(section.textContent, /Happy/);
  assert.match(section.textContent, /Sad/);
  const numeric = switches[2];
  await h.act(async () =>
    numeric.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        keyCode: 39,
        which: 39,
        bubbles: true,
      }),
    ),
  );
  assert.equal(numeric.getAttribute('aria-checked'), 'true');
  await h.act(async () =>
    numeric.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        keyCode: 37,
        which: 37,
        bubbles: true,
      }),
    ),
  );
  assert.equal(numeric.getAttribute('aria-checked'), 'false');
});

test('Switch default includes required-on alongside existing Storybook states without web controls', async t => {
  const h = await mountPattern('default', 'docs/src/react/SwitchDemo.tsx');
  t.after(() => h.dispose());
  assert.equal(Boolean(h.document.querySelector('[data-switch-preview]')), false);
  assert.equal(Boolean(h.document.querySelector('#switch-size')), false);
  assert.equal(h.document.querySelector('[data-switch-content-examples]'), null);
  assert.equal(h.document.querySelectorAll('.ant-select').length, 0);
  assert.deepEqual(
    [...h.document.querySelectorAll('button[role="switch"]')].map(item => ({
      id: item.id,
      checked: item.getAttribute('aria-checked'),
      disabled: item.disabled,
      small: item.classList.contains('ant-switch-small'),
    })),
    [
      { id: 'switch-notify', checked: 'false', disabled: false, small: false },
      { id: 'switch-small', checked: 'true', disabled: false, small: true },
      { id: 'switch-medium', checked: 'true', disabled: false, small: false },
      { id: 'switch-disabled', checked: 'false', disabled: true, small: false },
      { id: 'switch-loading', checked: 'true', disabled: true, small: false },
      { id: 'switch-required-on', checked: 'true', disabled: true, small: false },
    ],
  );
});

test('web segmented selection shares one capsule and keeps native selection across theme changes', async t => {
  const h = await mountPattern('default', 'docs/src/react/RadioDemo.tsx', {
    clusteredSegments: true,
  });
  t.after(() => h.dispose());
  const group = h.document.querySelector('.genux-segmented');
  assert.ok(group, 'related view choices share a native Segmented wrapper');
  assert.equal(group.getAttribute('role'), 'radiogroup');
  assert.equal(group.getAttribute('aria-label'), 'View');
  assert.equal(group.getAttribute('tabindex'), '-1', 'only native radios form the Tab stop');
  assert.equal(group.dataset.radius, 'pill');
  assert.equal(group.querySelectorAll('.ant-segmented-group').length, 1);
  assert.equal(group.querySelectorAll('.ant-radio-button-wrapper').length, 0);
  const css = postcss.parse(
    await readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8'),
  );
  let duration;
  let reducedDuration;
  css.walkRules(rule => {
    if (rule.selector === '.genux-demo .genux-segmented .ant-segmented-thumb-motion-appear-active')
      duration = rule.nodes.find(node => node.prop === 'transition-duration');
    if (rule.parent.type === 'atrule' && rule.parent.params.includes('prefers-reduced-motion'))
      reducedDuration ??= rule.nodes.find(node => node.prop === 'transition-duration');
  });
  assert.equal(duration?.value, 'var(--segmented-motion-duration)');
  assert.ok(!duration.important, 'native thumb timing must yield to reduced-motion priority');
  assert.equal(reducedDuration?.value, '0s');
  assert.ok(reducedDuration?.important);
  const radios = [...group.querySelectorAll('input[type="radio"][name="view"]')];
  assert.equal(radios.length, 3);
  assert.equal(radios[0].checked, true);
  await h.click(radios[1]);
  assert.equal(radios[1].checked, true);
  await h.act(async () => {
    radios[1].focus();
    radios[1].dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
  });
  assert.equal(
    radios[2].checked,
    true,
    'installed Segmented arrow handler changes the native checked state',
  );
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(h.document.querySelector('.genux-segmented'), group);
    assert.equal(group.querySelectorAll('input')[2], radios[2]);
    assert.equal(radios[2].checked, true);
  }
});

test('Radio web selection underline follows native checked state without remounting', async t => {
  const h = await mountPattern('default', 'docs/src/react/RadioDemo.tsx');
  t.after(() => h.dispose());
  h.document.querySelector('#root').classList.add('live-preview');
  const style = h.document.createElement('style');
  style.textContent = await readFile(new URL('../src/styles/web.css', import.meta.url), 'utf8');
  h.document.head.append(style);
  const radios = [...h.document.querySelectorAll('input[name="team"]')];
  const disabled = [...h.document.querySelectorAll('input[name="locked-team"]')];
  const views = [...h.document.querySelectorAll('input[name="view"]')];
  const labels = inputs => inputs.map(input => input.closest('label').textContent.trim());
  assert.deepEqual(
    labels(disabled),
    ['Design', 'Engineering', 'Operations'],
    'default/Storybook disabled labels are English',
  );
  assert.deepEqual(
    labels(views),
    ['List', 'Table', 'Calendar'],
    'default/Storybook button-radio labels are English',
  );
  const line = input =>
    h.window.getComputedStyle(input.closest('.ant-radio-wrapper').querySelector('.ant-radio-label'))
      .textDecorationLine;
  assert.equal(radios[0].checked, true);
  assert.equal(line(radios[0]), 'underline');
  assert.notEqual(line(radios[1]), 'underline');
  await h.click(radios[1]);
  assert.equal(radios[0].checked, false);
  assert.equal(radios[1].checked, true);
  assert.notEqual(line(radios[0]), 'underline');
  assert.equal(line(radios[1]), 'underline');
  await h.act(async () => radios[1].focus());
  assert.equal(h.document.activeElement, radios[1]);
  assert.equal(line(radios[1]), 'underline', 'focus must not erase selected underline');
  await h.act(async () => radios[0].focus());
  assert.notEqual(line(radios[0]), 'underline', 'unchecked focus uses the separate edge marker');
  assert.equal(line(radios[1]), 'underline');
  const before = disabled.map(input => input.checked);
  await h.click(disabled[1]);
  assert.deepEqual(
    disabled.map(input => input.checked),
    before,
  );
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(h.document.querySelectorAll('input[name="team"]')[1], radios[1]);
    assert.equal(radios[1].checked, true);
    assert.equal(line(radios[1]), 'underline');
  }
  await h.click(views[1]);
  for (const locale of ['tr', 'en']) {
    await h.act(async () => h.setLocale(locale));
    assert.deepEqual(
      labels(disabled),
      locale === 'tr'
        ? ['Tasarım', 'Mühendislik', 'Operasyon']
        : ['Design', 'Engineering', 'Operations'],
    );
    assert.deepEqual(
      labels(views),
      locale === 'tr' ? ['Liste', 'Tablo', 'Takvim'] : ['List', 'Table', 'Calendar'],
    );
    assert.equal(h.document.querySelectorAll('input[name="view"]')[1], views[1]);
    assert.equal(views[1].value, 'Tablo', 'locale does not rewrite machine values');
    assert.equal(views[1].checked, true);
    assert.equal(h.document.querySelectorAll('input[name="team"]')[1], radios[1]);
    assert.equal(radios[1].checked, true);
    assert.deepEqual(
      disabled.map(input => input.checked),
      before,
    );
  }
});

test('Checkbox shared profiles and corner changes preserve native selection across themes', async t => {
  const h = await mountPattern('WebCheckboxDemo', 'docs/src/react/CheckboxDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const owner = h.document.querySelector('.genux-demo[data-size-profile]');
  const tweaker = h.document.querySelector('[data-tweaker-trigger]');
  assert.equal(tweaker.getAttribute('aria-expanded'), 'false');
  await h.click(tweaker);
  assert.equal(tweaker.getAttribute('aria-expanded'), 'true');
  const options = [...owner.querySelectorAll('[data-size-control] input[type="radio"]')];
  assert.equal(options.length, 3);
  const radius = h.document.querySelector('#checkbox-radius');
  const preview = h.document.querySelector('[data-checkbox-preview]');
  const design = h.document.querySelectorAll('input[type="checkbox"]')[1];
  assert.equal(design.checked, true);
  await h.click(options[2]);
  assert.equal(owner.dataset.sizeProfile, 'lg');
  await selectOption(h, radius, '100% · Pill');
  assert.equal(preview.style.getPropertyValue('--checkbox-radius'), '9999px');
  await h.click(h.document.querySelector('button[aria-label="Close tweaker"]'));
  assert.equal(tweaker.getAttribute('aria-expanded'), 'false');
  await h.click(design);
  assert.equal(design.checked, false);
  await h.click(tweaker);
  assert.equal(tweaker.getAttribute('aria-expanded'), 'true');
  assert.equal(h.document.querySelector('#checkbox-radius'), radius);
  assert.equal(owner.querySelectorAll('[data-size-control] input[type="radio"]')[0], options[0]);
  await h.click(options[0]);
  await selectOption(h, radius, '0 px');
  assert.equal(owner.dataset.sizeProfile, 'sm');
  assert.equal(preview.style.getPropertyValue('--checkbox-radius'), '0px');
  await h.click(h.document.querySelector('button[aria-label="Close tweaker"]'));
  assert.equal(tweaker.getAttribute('aria-expanded'), 'false');
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(h.document.querySelectorAll('input[type="checkbox"]')[1], design);
    assert.equal(design.checked, false);
  }
});

test('Checkbox default keeps the Storybook demo free of web appearance controls', async t => {
  const h = await mountPattern('default', 'docs/src/react/CheckboxDemo.tsx');
  t.after(() => h.dispose());
  assert.equal(h.document.querySelectorAll('.ant-select').length, 0);
  assert.equal(h.document.querySelector('[data-checkbox-preview]'), null);
});

test('Checkbox toggles native state immediately and keeps the drawable owner mounted', async t => {
  const h = await mountPattern('default', 'docs/src/react/CheckboxDemo.tsx');
  t.after(() => h.dispose());
  const inputs = [...h.document.querySelectorAll('input[type="checkbox"]')];
  const all = inputs[0];
  const design = inputs[1];
  const owner = design.closest('.ant-checkbox');
  const disabled = inputs.filter(input => input.disabled);
  const disabledStates = disabled.map(input => input.checked);
  assert.equal(design.checked, true);
  assert.equal(all.indeterminate, true);
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    await h.click(design);
    assert.equal(design.checked, false);
    assert.equal(owner.classList.contains('ant-checkbox-checked'), false);
    assert.equal(all.indeterminate, false);
    assert.equal(h.document.querySelector('[role="status"]').textContent, '0 teams selected.');
    await h.click(design);
    assert.equal(design.checked, true);
    assert.equal(owner.classList.contains('ant-checkbox-checked'), true);
    assert.equal(all.indeterminate, true);
    assert.equal(h.document.querySelector('[role="status"]').textContent, '1 teams selected.');
    assert.equal(design.closest('.ant-checkbox'), owner);
    assert.ok(owner.isConnected, 'same pseudo-element owner survives both directions');
    for (const input of disabled) await h.click(input);
    assert.deepEqual(
      disabled.map(input => input.checked),
      disabledStates,
    );
  }
});

test('Pill master uses native Tag closing and a labelled Phosphor X without nested controls', async t => {
  let closes = 0;
  const h = await mountPattern('default', 'docs/src/react/GenUXPill.tsx', {
    children: 'Istanbul workspace',
    radius: 'pill',
    closable: true,
    closeLabel: 'Remove Istanbul tag',
    onClose: event => {
      event.preventDefault();
      closes += 1;
    },
  });
  t.after(() => h.dispose());
  const pill = h.document.querySelector('.genux-pill');
  assert.ok(pill?.classList.contains('ant-tag'), 'master pill uses the installed native Tag');
  assert.equal(pill.style.getPropertyValue('--pill-radius'), '9999px');
  const close = pill.querySelector('.genux-pill-close');
  assert.ok(close);
  assert.equal(close.getAttribute('role'), 'button');
  assert.equal(close.getAttribute('tabindex'), '0');
  assert.equal(close.getAttribute('aria-label'), 'Remove Istanbul tag');
  assert.ok(close.querySelector('svg[data-icon-library="phosphor"][data-icon-name="x"] path[d]'));
  assert.equal(close.querySelector('svg').getAttribute('aria-hidden'), 'true');
  assert.equal(close.querySelectorAll('button, [role="button"]').length, 0);
  await h.click(close);
  assert.equal(closes, 1);
  assert.equal(
    pill.classList.contains('ant-tag-hidden'),
    false,
    'native preventDefault cancels removal',
  );
  await h.act(async () => {
    close.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.equal(closes, 2, 'native Tag handles keyboard activation');
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(h.document.querySelector('.genux-pill'), pill);
    assert.equal(pill.querySelector('.genux-pill-close'), close);
  }
});

test('Pill demo reuses every canonical Button radius and retains native disabled closing', async t => {
  const h = await mountPattern('default', 'docs/src/react/PillDemo.tsx');
  t.after(() => h.dispose());
  const radius = h.document.querySelector('#pill-radius');
  assert.ok(radius);
  const data = JSON.parse(
    await readFile(new URL('../src/data/genux.json', import.meta.url), 'utf8'),
  );
  const pills = [...h.document.querySelectorAll('.genux-pill')];
  assert.ok(pills.length >= 3, 'basic, removable and disabled examples share the master');
  for (const option of data.decisions.buttons.radius_variants) {
    await selectOption(h, radius, option.label);
    for (const [index, pill] of pills.entries()) {
      assert.equal(h.document.querySelectorAll('.genux-pill')[index], pill);
      assert.equal(pill.style.getPropertyValue('--pill-radius'), option.css);
    }
  }
  const disabled = h.document.querySelector('.genux-pill.ant-tag-disabled');
  assert.ok(disabled);
  const disabledClose = disabled.querySelector('.genux-pill-close');
  assert.equal(disabledClose.getAttribute('aria-disabled'), 'true');
  assert.equal(disabledClose.getAttribute('tabindex'), '-1');
  await h.click(disabledClose);
  assert.equal(disabled.classList.contains('ant-tag-hidden'), false);
});

test('Select web selected tags compose the master Pill and preserve native removal and Backspace', async t => {
  const h = await mountPattern('WebSelectDemo', 'docs/src/react/SelectDemo.tsx');
  t.after(() => h.dispose());
  const multiple = h.document.querySelector('#select-multiple');
  const owner = multiple.closest('.ant-select');
  const pills = [...owner.querySelectorAll('.genux-pill')];
  assert.deepEqual(
    pills.map(pill => pill.querySelector('.genux-pill-label').textContent),
    ['Design', 'Engineering'],
  );
  await h.act(async () => multiple.focus());
  const close = pills[0].querySelector('.genux-pill-close');
  await h.act(async () => {
    const event = new h.window.MouseEvent('mousedown', { bubbles: true, cancelable: true });
    close.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true, 'tag mouse down preserves Select focus');
  });
  await h.click(close);
  assert.deepEqual(
    [...owner.querySelectorAll('.genux-pill-label')].map(node => node.textContent),
    ['Engineering'],
  );
  assert.equal(
    multiple.getAttribute('aria-expanded'),
    'false',
    'closing a pill must not open the dropdown',
  );
  assert.equal(h.document.activeElement, multiple);
  assert.equal(owner.querySelector('.genux-pill'), pills[1], 'other selected values stay mounted');
  const tags = h.document.querySelector('#select-tags');
  const tagOwner = tags.closest('.ant-select');
  await h.type(tags, 'Yeni etiket');
  await h.act(async () => {
    tags.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await h.waitFor(
    () => tagOwner.querySelector('.genux-pill-label')?.textContent === 'Yeni etiket',
    'native tag entry creates a master Pill',
  );
  await h.type(tags, '');
  // Native BaseSelect prevents accidental removal for 250ms after submitting search text.
  await h.act(async () => {
    await new Promise(resolve => setTimeout(resolve, 260));
  });
  await h.act(async () => {
    tags.focus();
    tags.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Backspace',
        keyCode: 8,
        which: 8,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await h.waitFor(
    () => tagOwner.querySelectorAll('.genux-pill').length === 0,
    'native Backspace removes the last tag',
  );
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(h.document.querySelector('#select-multiple'), multiple);
    assert.equal(owner.querySelector('.genux-pill'), pills[1]);
  }
  const keyboardClose = pills[1].querySelector('.genux-pill-close');
  await h.act(async () => {
    keyboardClose.focus();
    keyboardClose.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.equal(owner.querySelectorAll('.genux-pill').length, 0);
  assert.equal(
    multiple.getAttribute('aria-expanded'),
    'false',
    'Pill keyboard removal must not open Select',
  );
  assert.equal(
    h.document.activeElement,
    multiple,
    'keyboard removal returns focus through the public Select ref',
  );
});

test('Select multiple and tags search visible English and Turkish labels without remounting', async t => {
  const h = await mountPattern('WebSelectDemo', 'docs/src/react/SelectDemo.tsx');
  t.after(() => h.dispose());
  const multiple = h.document.getElementById('select-multiple');
  const tags = h.document.getElementById('select-tags');
  const owner = multiple.closest('.ant-select');
  const tagOwner = tags.closest('.ant-select');
  const initial = [...owner.querySelectorAll('.genux-pill')];
  for (const [locale, operations, engineering] of [
    ['en', 'Operations', 'Engineering'],
    ['tr', 'Operasyon', 'Mühendislik'],
  ]) {
    await h.act(async () => h.setLocale(locale));
    assert.equal(h.document.getElementById('select-multiple'), multiple);
    assert.equal(h.document.getElementById('select-tags'), tags);
    assert.equal(
      owner.querySelectorAll('.genux-pill')[1],
      initial[1],
      'locale changes keep the selected value and Pill instance',
    );
    assert.equal(initial[1].querySelector('.genux-pill-label').textContent, engineering);
    if (tagOwner.querySelector('.genux-pill')) {
      assert.equal(tagOwner.querySelector('.genux-pill-label').textContent, engineering);
      await h.click(tagOwner.querySelector('.genux-pill-close'));
    }
    for (const [input, label] of [
      [multiple, operations],
      [tags, engineering],
    ]) {
      await h.act(async () =>
        input
          .closest('.ant-select')
          .dispatchEvent(new h.window.MouseEvent('mousedown', { bubbles: true, cancelable: true })),
      );
      await h.type(input, label);
      const visibleOptions = () => {
        const list = h.document.getElementById(input.getAttribute('aria-controls') ?? '');
        const popup = list?.closest('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
        return [...(popup?.querySelectorAll('.ant-select-item-option') ?? [])];
      };
      await h.waitFor(
        () => visibleOptions().some(option => option.textContent.trim() === label),
        'visible translated option',
      );
      const matching = visibleOptions().filter(option => option.textContent.trim() === label);
      assert.equal(
        matching.length,
        1,
        'an existing visible label must not produce a second new-tag option',
      );
      await h.click(matching[0]);
      await h.act(async () =>
        input.dispatchEvent(
          new h.window.KeyboardEvent('keydown', {
            key: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
          }),
        ),
      );
    }
    assert.equal(tagOwner.querySelectorAll('.genux-pill').length, 1);
    assert.equal(tagOwner.querySelector('.genux-pill-label').textContent, engineering);
  }
  await h.type(tags, 'My custom team');
  await h.act(async () =>
    tags.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await h.waitFor(
    () => tagOwner.querySelectorAll('.genux-pill').length === 2,
    'custom user tag is added',
  );
  const custom = [...tagOwner.querySelectorAll('.genux-pill')].find(
    pill => pill.querySelector('.genux-pill-label').textContent === 'My custom team',
  );
  assert.ok(custom);
  for (const locale of ['en', 'tr']) {
    await h.act(async () => h.setLocale(locale));
    assert.ok(custom.isConnected, 'locale preserves the custom tag instance and value');
    assert.equal(
      custom.querySelector('.genux-pill-label').textContent,
      'My custom team',
      'user text is not translated or overwritten',
    );
    assert.equal(tagOwner.querySelectorAll('.genux-pill').length, 2);
  }
});

test('Select native fallback retains AntD tags', async t => {
  const h = await mountPattern('default', 'docs/src/react/SelectDemo.tsx');
  t.after(() => h.dispose());
  const owner = h.document.querySelector('#select-multiple').closest('.ant-select');
  assert.equal(owner.querySelectorAll('.ant-select-selection-item').length, 2);
  assert.equal(h.document.querySelectorAll('.genux-pill').length, 0);
  assert.equal(owner.querySelectorAll('svg[data-icon-name="x"]').length, 0);
});

test('Select input modality preserves selection across pointer and keyboard', async t => {
  const h = await mountPattern('default', 'docs/src/react/SelectDemo.tsx');
  t.after(() => h.dispose());
  const provider = h.document.querySelector('.genux-demo');
  const input = h.document.querySelector('#select-single');
  const control = input.closest('.ant-select');
  const key = async (name, code) => {
    await h.act(async () => {
      input.dispatchEvent(
        new h.window.KeyboardEvent('keydown', {
          key: name,
          code: name,
          keyCode: code,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  };
  assert.equal(provider.dataset.inputModality, 'keyboard');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  await h.act(async () => {
    control.dispatchEvent(new h.window.Event('pointerdown', { bubbles: true }));
    control.dispatchEvent(
      new h.window.MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
  });
  await h.waitFor(() => input.getAttribute('aria-expanded') === 'true', 'Pointer opens Select');
  assert.equal(provider.dataset.inputModality, 'pointer');
  const option = [...h.document.querySelectorAll('.ant-select-item-option')].find(
    item => item.textContent.trim() === 'Operations',
  );
  assert.ok(option, 'Real AntD popup option is available');
  await h.act(async () => {
    option.dispatchEvent(new h.window.Event('pointerdown', { bubbles: true }));
  });
  await h.click(option);
  await h.waitFor(
    () => input.getAttribute('aria-expanded') === 'false',
    'Pointer choice closes Select',
  );
  assert.equal(provider.dataset.inputModality, 'pointer');
  assert.match(control.textContent, /Operations/);
  for (const modifier of ['Shift', 'Meta', 'Control', 'Alt']) {
    await key(modifier, 0);
    assert.equal(provider.dataset.inputModality, 'pointer', modifier);
  }
  await h.act(async () => {
    h.document.body.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        keyCode: 9,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.equal(
    provider.dataset.inputModality,
    'keyboard',
    'Tab outside provider restores keyboard mode',
  );
  await key('ArrowDown', 40);
  await h.waitFor(() => input.getAttribute('aria-expanded') === 'true', 'Keyboard opens Select');
  assert.equal(provider.dataset.inputModality, 'keyboard');
  await key('Escape', 27);
  await h.waitFor(() => input.getAttribute('aria-expanded') === 'false', 'Escape closes Select');
  assert.equal(provider.dataset.inputModality, 'keyboard');
  assert.equal(h.document.querySelector('#select-single'), input);
  assert.match(control.textContent, /Operations/);
});

test('Input filled fields preserve typed drafts across theme changes', async t => {
  const h = await mountPattern('default', 'docs/src/react/InputDemo.tsx');
  t.after(() => h.dispose());
  const provider = h.document.querySelector('.genux-demo');
  const search = h.document.querySelector('#input-search');
  const note = h.document.querySelector('#input-note');
  await h.type(search, 'Korunan arama');
  await h.type(note, 'Korunan not');
  assert.ok(!h.document.querySelector('.field-surface-control'), 'Surface chooser is removed');
  assert.ok(!h.document.querySelector('#input-outlined'), 'Outlined input is removed');
  for (const mode of ['light', 'dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(provider.dataset.themeMode, mode);
    assert.equal(h.document.querySelector('#input-search'), search);
    assert.equal(h.document.querySelector('#input-note'), note);
    assert.equal(search.value, 'Korunan arama');
    assert.equal(note.value, 'Korunan not');
    const fields = [
      ...h.document.querySelectorAll('.ant-input, .ant-input-affix-wrapper, .ant-input-number'),
    ].filter(
      element =>
        !element.matches('input.ant-input') || !element.closest('.ant-input-affix-wrapper'),
    );
    assert.ok(fields.length >= 9, 'Base, specialized and status inputs are present');
    for (const field of fields)
      assert.ok(
        field.classList.contains(
          field.matches('.ant-input-number') ? 'ant-input-number-filled' : 'ant-input-filled',
        ),
        `${mode}: ${field.className}`,
      );
  }
  for (const locale of ['tr', 'en']) {
    await h.act(async () => h.setLocale(locale));
    assert.equal(h.document.querySelector('#input-search'), search);
    assert.equal(h.document.querySelector('#input-note'), note);
    assert.equal(search.value, 'Korunan arama');
    assert.equal(note.value, 'Korunan not');
    assert.equal(search.placeholder, locale === 'tr' ? 'Aranacak sözcük' : 'Search term');
  }
});

test('Select filled fields preserve selection across theme changes', async t => {
  const h = await mountPattern('default', 'docs/src/react/SelectDemo.tsx');
  t.after(() => h.dispose());
  const provider = h.document.querySelector('.genux-demo');
  const input = h.document.querySelector('#select-single');
  await selectOption(h, input, 'Operations');
  assert.ok(!h.document.querySelector('.field-surface-control'), 'Surface chooser is removed');
  assert.ok(!h.document.querySelector('#select-outlined'), 'Outlined Select is removed');
  for (const mode of ['light', 'dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(provider.dataset.themeMode, mode);
    assert.equal(h.document.querySelector('#select-single'), input);
    assert.match(input.closest('.ant-select').textContent, /Operations/);
    const fields = [...h.document.querySelectorAll('.ant-select')];
    assert.ok(fields.length >= 8, 'Single, multiple, tags and status selects are present');
    for (const field of fields)
      assert.ok(field.classList.contains('ant-select-filled'), `${mode}: ${field.className}`);
  }
});

test('Accordion: single, multiple, disabled and nested state follow AntD semantics', async t => {
  const h = await mountPattern('AccordionExamples');
  t.after(() => h.dispose());
  const section = id => h.document.getElementById(id).closest('section');
  const single = section('accordion-single');
  const purpose = headerByText(single, 'When to use it?');
  const keyboard = headerByText(single, 'Keyboard use');
  assert.equal(purpose.getAttribute('aria-expanded'), 'true');
  assert.equal(keyboard.getAttribute('aria-expanded'), 'false');

  await h.act(async () => {
    purpose.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.equal(
    purpose.getAttribute('aria-expanded'),
    'true',
    'Space repeat must not toggle an accordion header again',
  );
  await h.act(async () => {
    purpose.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.equal(purpose.getAttribute('aria-expanded'), 'false');
  await h.click(keyboard);
  assert.equal(purpose.getAttribute('aria-expanded'), 'false');
  assert.equal(keyboard.getAttribute('aria-expanded'), 'true');
  await h.act(async () => {
    purpose.focus();
    purpose.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.equal(purpose.getAttribute('aria-expanded'), 'true');
  assert.equal(keyboard.getAttribute('aria-expanded'), 'false');

  const multiple = section('accordion-multiple');
  const multiplePurpose = headerByText(multiple, 'When to use it?');
  const multipleKeyboard = headerByText(multiple, 'Keyboard use');
  const multipleState = headerByText(multiple, 'Preserving content state');
  assert.equal(multiplePurpose.getAttribute('aria-expanded'), 'true');
  assert.equal(multipleKeyboard.getAttribute('aria-expanded'), 'true');
  await h.click(multipleState);
  assert.equal(multiplePurpose.getAttribute('aria-expanded'), 'true');
  assert.equal(multipleKeyboard.getAttribute('aria-expanded'), 'true');
  assert.equal(multipleState.getAttribute('aria-expanded'), 'true');

  const disabled = headerByText(section('accordion-disabled'), 'Unavailable section');
  assert.equal(disabled.getAttribute('aria-disabled'), 'true');
  await h.click(disabled);
  assert.equal(disabled.getAttribute('aria-expanded'), 'false');
  await h.act(async () => {
    disabled.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.equal(disabled.getAttribute('aria-expanded'), 'false');

  const nested = section('accordion-nested');
  const outer = headerByText(nested, 'Notification settings');
  await h.click(headerByText(nested, 'Channels'));
  const checkbox = nested.querySelector('input[type="checkbox"]');
  assert.equal(checkbox.checked, true);
  await h.click(checkbox);
  await h.click(outer);
  await h.click(outer);
  assert.equal(nested.querySelector('input[type="checkbox"]').checked, false);
});

test('Form: invalid submission is blocked, valid submission is local, and reset clears state', async t => {
  const h = await mountPattern('FormExamples');
  t.after(() => h.dispose());
  const form = h.document.getElementById('profile-example');
  const result = h.document.querySelector('.form-result');
  await h.submit(form);
  await h.waitFor(() => form.textContent.includes('Enter your full name.'), 'Required form error');
  assert.equal(result.textContent, '');
  assert.ok(form.textContent.includes('Enter your email address.'));
  assert.ok(form.textContent.includes('Choose a team.'));

  const name = form.querySelector('input[id$="fullName"]');
  const email = form.querySelector('input[id$="email"]');
  await h.type(name, 'Ada Kullanıcı');
  await h.type(email, 'gecersiz-adres');
  await selectOption(h, form.querySelector('[role="combobox"]'), 'Design');
  await h.submit(form);
  await h.waitFor(
    () => form.textContent.includes('Provide a valid email address.'),
    'Email form error',
  );
  assert.equal(result.textContent, '');

  await h.type(email, 'ada@example.com');
  await h.submit(form);
  await h.waitFor(() => result.textContent.includes('Ada Kullanıcı'), 'Local form result');
  assert.match(result.textContent, /no data was sent/);
  await h.waitFor(
    () => form.querySelectorAll('.ant-form-item-explain-error').length === 0,
    'Old form errors clear',
  );
  assert.equal(form.querySelectorAll('.ant-form-item-explain-error').length, 0);
  await h.click(buttonByText(form, 'Reset'));
  assert.equal(form.querySelector('input[id$="fullName"]').value, '');
  assert.equal(form.querySelector('input[id$="email"]').value, '');
  assert.equal(result.textContent, '');
});

test('Form: layout changes preserve edits and disabled/loading previews are explicit', async t => {
  const h = await mountPattern('FormExamples');
  t.after(() => h.dispose());
  const form = h.document.getElementById('profile-example');
  await h.type(form.querySelector('input[id$="fullName"]'), 'Korunan taslak');
  const layout = h.document.querySelector('.form-layout-control [role=combobox]');
  await selectOption(h, layout, 'Horizontal');
  assert.ok(form.classList.contains('genux-form-horizontal'));
  assert.equal(form.querySelector('input[id$="fullName"]').value, 'Korunan taslak');
  await selectOption(h, layout, 'Inline');
  assert.ok(form.classList.contains('genux-form-inline'));
  assert.equal(form.querySelector('input[id$="fullName"]').value, 'Korunan taslak');
  const toggle = [...h.document.querySelectorAll('label')]
    .find(label => label.textContent.trim() === 'Disable form')
    .querySelector('input');
  await h.click(toggle);
  assert.equal(form.querySelector('input[id$="fullName"]').disabled, true);
  assert.equal(buttonByText(form, 'Validate').disabled, true);
  await h.click(toggle);
  assert.equal(form.querySelector('input[id$="fullName"]').disabled, false);
  const preview = [...h.document.querySelectorAll('label')]
    .find(label => label.textContent.trim() === 'Show pending state')
    .querySelector('input');
  await h.click(preview);
  assert.ok(buttonByText(h.document, 'Processing').classList.contains('ant-btn-loading'));
  assert.match(
    h.document.getElementById('form-pending-title').parentElement.textContent,
    /It starts no network request or save operation/,
  );
});

test('Drawer: Escape closes, returns focus, and reopening preserves edits', async t => {
  const h = await mountPattern('DrawerExamples');
  t.after(() => h.dispose());
  const trigger = buttonByText(h.document, 'Open panel');
  await h.act(async () => {
    trigger.focus();
  });
  await h.click(trigger);
  await h.waitFor(() => h.document.querySelector('[role="dialog"]'), 'Drawer dialog');
  const dialog = h.document.querySelector('[role="dialog"]');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  await h.type(dialog.querySelector('input'), 'Kalıcı yerel taslak');
  await h.type(dialog.querySelector('textarea'), 'Kapatınca korunan not');
  await h.act(async () => {
    dialog.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await h.waitFor(() => !h.document.querySelector('.ant-drawer-open'), 'Escape closes drawer');
  await h.waitFor(() => h.document.activeElement === trigger, 'Drawer focus returns');
  await h.click(trigger);
  await h.waitFor(() => h.document.querySelector('.ant-drawer-open'), 'Drawer reopens');
  assert.equal(h.document.querySelector('[role="dialog"] input').value, 'Kalıcı yerel taslak');
  assert.equal(h.document.querySelector('[role="dialog"] textarea').value, 'Kapatınca korunan not');
  await h.click(h.document.querySelector('[aria-label="Close panel"]'));
  await h.waitFor(() => !h.document.querySelector('.ant-drawer-open'), 'Labelled close button');
});

test('Drawer: all placement values work and local form validates before completion', async t => {
  const h = await mountPattern('DrawerExamples');
  t.after(() => h.dispose());
  const trigger = buttonByText(h.document, 'Open panel');
  const placement = h.document.querySelector('[role="combobox"]');
  for (const [label, value] of [
    ['Right', 'right'],
    ['Left', 'left'],
    ['Top', 'top'],
    ['Bottom', 'bottom'],
  ]) {
    await selectOption(h, placement, label);
    await h.act(async () => {
      trigger.focus();
    });
    await h.click(trigger);
    await h.waitFor(() => h.document.querySelector('.ant-drawer-open'), `${value} drawer opens`);
    assert.ok(h.document.querySelector(`.ant-drawer-${value}`));
    await h.click(buttonByText(h.document.querySelector('[role="dialog"]'), 'Close'));
    await h.waitFor(() => !h.document.querySelector('.ant-drawer-open'), `${value} drawer closes`);
  }
  await h.click(trigger);
  await h.waitFor(() => h.document.querySelector('.ant-drawer-open'), 'Drawer opens for form');
  const form = h.document.querySelector('[role="dialog"] form');
  await h.submit(form);
  await h.waitFor(() => form.textContent.includes('Enter a draft title.'), 'Drawer required error');
  assert.ok(h.document.querySelector('.ant-drawer-open'));
  assert.equal(h.document.querySelector('.form-result').textContent, '');
  await h.type(form.querySelector('input'), 'Yerel örnek');
  await h.click(buttonByText(h.document.querySelector('[role="dialog"]'), 'Validate locally'));
  await h.waitFor(
    () => !h.document.querySelector('.ant-drawer-open'),
    'Valid drawer submit closes',
  );
  assert.match(
    h.document.querySelector('.form-result').textContent,
    /Draft “Yerel örnek” validated locally/,
  );
});

test('Screenshot retries a failed source after switching back from another source', async t => {
  // Temporary caller that owns src; it checks the React failure lifecycle, not network loading.
  const name = `.screenshot-fixture-${randomUUID()}.tsx`;
  const fixture = new URL(`./${name}`, import.meta.url);
  await writeFile(
    fixture,
    `import { useState } from 'react';
import GenUXScreenshot from '../src/react/GenUXScreenshot';

export default function ScreenshotSourceFixture() {
  const [src, setSrc] = useState('/a.png');
  return (
    <>
      <button type="button" onClick={() => setSrc('/a.png')}>Show A</button>
      <button type="button" onClick={() => setSrc('/b.png')}>Show B</button>
      <GenUXScreenshot
        src={src}
        alt="Recorded example"
        caption="Recorded example"
        width={1440}
        height={1000}
      />
    </>
  );
}
`,
    { flag: 'wx' },
  );
  t.after(() => unlink(fixture));
  const h = await mountPattern('default', `docs/tests/${name}`);
  t.after(() => h.dispose());
  const figure = () => h.document.querySelector('.genux-screenshot');
  const image = () => h.document.querySelector('.genux-screenshot img');
  const first = image();
  assert.equal(first?.getAttribute('src'), '/a.png');
  await h.act(async () => {
    first.dispatchEvent(new h.window.Event('error'));
  });
  assert.equal(image(), null);
  assert.equal(figure().dataset.screenshotState, 'unavailable');
  assert.match(figure().textContent, /Screenshot unavailable/);
  await h.click(buttonByText(h.document, 'Show B'));
  assert.equal(image()?.getAttribute('src'), '/b.png');
  assert.equal(figure().dataset.screenshotState, 'available');
  await h.click(buttonByText(h.document, 'Show A'));
  const again = image();
  assert.equal(again?.getAttribute('src'), '/a.png', 'returning to A starts a fresh attempt');
  assert.notEqual(again, first);
  assert.equal(figure().dataset.screenshotState, 'available');
});

test('Popconfirm honours defaultOpen, cancels once on Escape and returns focus to the trigger', async t => {
  // Temporary caller that owns the trigger; it checks the open lifecycle, not visual layering.
  const name = `.popconfirm-fixture-${randomUUID()}.tsx`;
  const fixture = new URL(`./${name}`, import.meta.url);
  await writeFile(
    fixture,
    `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import { GenUXFeedbackScope, GenUXPopconfirm } from '../src/react/GenUXFeedback';

export default function PopconfirmOpenFixture() {
  const [cancels, setCancels] = useState(0);
  const [confirms, setConfirms] = useState(0);
  return (
    <GenUXProvider>
      <GenUXFeedbackScope>
        <GenUXPopconfirm
          defaultOpen
          title="Archive this draft?"
          onCancel={() => setCancels(count => count + 1)}
          onConfirm={() => setConfirms(count => count + 1)}
        >
          <button type="button">Archive draft</button>
        </GenUXPopconfirm>
        <output data-cancels>{cancels}</output>
        <output data-confirms>{confirms}</output>
      </GenUXFeedbackScope>
    </GenUXProvider>
  );
}
`,
    { flag: 'wx' },
  );
  t.after(() => unlink(fixture));
  const h = await mountPattern('default', `docs/tests/${name}`);
  t.after(() => h.dispose());
  const trigger = buttonByText(h.document, 'Archive draft');
  assert.ok(trigger);
  const count = key => h.document.querySelector(`[data-${key}]`).textContent;
  const shown = () => {
    const popup = h.document.querySelector('.genux-popconfirm');
    return popup && !popup.classList.contains('ant-popover-hidden') ? popup : null;
  };
  const initial = shown();
  assert.ok(initial, 'defaultOpen shows the popup without a click');
  assert.match(initial.textContent, /Archive this draft\?/);
  assert.notEqual(h.document.activeElement, trigger);
  await h.act(async () => {
    h.document.body.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await h.waitFor(() => !shown(), 'Escape closes Popconfirm');
  assert.equal(count('cancels'), '1');
  assert.equal(count('confirms'), '0', 'Escape never confirms');
  assert.equal(h.document.activeElement, trigger, 'focus returns to the trigger');
  await h.click(trigger);
  await h.waitFor(shown, 'trigger reopens Popconfirm');
  await h.click(buttonByText(shown(), 'Confirm'));
  assert.equal(count('confirms'), '1', 'only the explicit confirm action confirms');
  assert.equal(count('cancels'), '1');
});
