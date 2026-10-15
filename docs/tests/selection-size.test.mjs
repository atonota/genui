import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import postcss from 'postcss';
import { mountPattern } from './harness.mjs';

for (const [entry, controlSelector] of [
  ['Checkbox', '.ant-checkbox-wrapper input'],
  ['Radio', '.ant-radio-wrapper input'],
  ['Switch', '#switch-notify'],
]) {
  test(`${entry} shares 32/40/50 selection sizes without replacing state or Button sizing`, async t => {
    const h = await mountPattern(`Web${entry}Demo`, `docs/src/react/${entry}Demo.tsx`, {
      documentation: true,
    });
    t.after(() => h.dispose());
    const owner = h.document.querySelector('.atlas-demo[data-size-profile]');
    const control = h.document.querySelector(controlSelector);
    await h.click(control);
    const selected = control.getAttribute('aria-checked') ?? control.checked;
    await h.click(h.document.querySelector('[data-tweaker-trigger]'));
    const options = [...h.document.querySelectorAll('[data-size-control] input')];
    assert.deepEqual(
      options.map(e => e.closest('label').textContent.trim()),
      ['Small · 32 px', 'Medium · 40 px', 'Large · 50 px'],
    );
    for (const [i, size] of ['sm', 'md', 'lg'].entries()) {
      await h.click(options[i]);
      assert.equal(owner.dataset.sizeProfile, size);
      assert.equal(
        owner.style.getPropertyValue('--atlas-selection-height'),
        [32, 40, 50][i] + 'px',
      );
      assert.equal(
        owner.style.getPropertyValue('--atlas-component-height'),
        [48, 56, 64][i] + 'px',
      );
      assert.equal(h.document.querySelector(controlSelector), control);
      assert.equal(control.getAttribute('aria-checked') ?? control.checked, selected);
    }
    await h.act(() => h.setLocale('tr'));
    assert.deepEqual(
      options.map(e => e.closest('label').textContent.trim()),
      ['Küçük · 32 px', 'Orta · 40 px', 'Büyük · 50 px'],
    );
    if (entry === 'Switch') {
      for (const [id, size] of [
        ['small', 'sm'],
        ['medium', 'md'],
        ['large', 'lg'],
      ])
        assert.equal(h.document.querySelector(`#switch-${id}`).dataset.selectionSize, size);
    }
  });
}

test('Checkbox geometry consumes the selection profile rather than Button minus 16 px', async () => {
  const css = await readFile('docs/src/styles/size-profiles.css', 'utf8');
  const owner = css.match(
    /\.atlas-demo\[data-size-profile\]\[data-atlas-appearance='docs'\]\s*\{([^}]+)\}/,
  )[1];
  assert.match(owner, /--checkbox-auto-size:\s*var\(--atlas-selection-height\)/);
  assert.match(css, /--checkbox-size:\s*var\(--checkbox-auto-size\)/);
});

test('Switch content width resolves the scaled icon size on its own owner', async () => {
  const css = await readFile('docs/src/styles/web.css', 'utf8');
  assert.match(
    css,
    /\.live-preview \.atlas-demo \.atlas-switch-with-content\.css-var-atlas-docs\s*\{\s*--switch-content-width:\s*var\(--switch-content-icon-size\)/,
  );
});

test('Switch hit extension and keyboard focus use independent pseudo elements', async () => {
  const css = await readFile('docs/src/styles/web.css', 'utf8');
  const shared = await readFile('docs/src/styles/components.css', 'utf8');
  assert.match(shared, /\.ant-switch:focus-visible::before\s*\{/);
  assert.match(
    css,
    /\.live-preview \.atlas-demo \.ant-switch\.css-var-atlas-docs::after,\s*\.theme-toggle::before\s*\{/,
  );
  assert.doesNotMatch(
    css,
    /\.live-preview \.atlas-demo \.ant-switch::before,\s*\.theme-toggle::before/,
  );
});

test('Switch loading icon scales and centers within the derived thumb', async () => {
  const sheet = postcss.parse(await readFile('docs/src/styles/web.css', 'utf8'));
  const selector =
    ':root[data-theme] .live-preview .atlas-demo .ant-switch.css-var-atlas-docs .ant-switch-loading-icon';
  const rules = [];
  sheet.walkRules(rule => {
    if (rule.selectors.some(value => value.replace(/\s+/g, ' ').trim() === selector))
      rules.push(rule);
  });
  assert.equal(rules.length, 1);
  const declarations = Object.fromEntries(rules[0].nodes.map(decl => [decl.prop, decl.value]));
  assert.equal(declarations['font-size'], 'var(--switch-content-icon-size)');
  assert.equal(
    declarations.top.replace(/\s/g, ''),
    'calc((var(--switch-handle-size)-var(--switch-content-icon-size))/2)',
  );
});

test('selection dimensions and unlabeled hit widths stay owned by docs in nested approved previews', async t => {
  const fixture = `docs/tests/.selection-owner-${randomUUID()}.tsx`;
  await writeFile(
    fixture,
    `import AtlasProvider from '../src/react/AtlasProvider';
import {Checkbox,Radio,Switch} from 'antd';
function Controls(){return <><Checkbox aria-label="Select record"/><Radio aria-label="Choose record"/><Switch aria-label="Enable record"/></>;}
export default function Fixture(){return <div className="live-preview"><AtlasProvider appearance="docs"><Controls/><AtlasProvider appearance="approved"><Controls/></AtlasProvider></AtlasProvider></div>;}`,
  );
  t.after(() => unlink(fixture));
  const h = await mountPattern('default', fixture);
  t.after(() => h.dispose());
  await h.act(() => {
    h.document.documentElement.dataset.theme = 'light';
  });
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  await h.click(h.document.querySelectorAll('[data-size-control] input')[2]);
  const docsOwner = h.document.querySelector('[data-atlas-appearance="docs"][data-size-profile]');
  const approvedOwner = docsOwner.querySelector(
    '.atlas-demo[data-size-profile]:not([data-atlas-appearance])',
  );
  assert.equal(docsOwner.dataset.sizeProfile, 'lg');
  assert.equal(approvedOwner.dataset.sizeProfile, 'lg');
  const profile = postcss.parse(await readFile('docs/src/styles/size-profiles.css', 'utf8'));
  const ownerDeclarations = owner => {
    const result = {};
    profile.walkRules(rule => {
      if (rule.parent.type === 'root' && rule.selectors.some(selector => owner.matches(selector)))
        rule.walkDecls(decl => {
          result[decl.prop] = decl.value;
        });
    });
    return result;
  };
  assert.equal(ownerDeclarations(docsOwner)['--radio-size'], 'var(--atlas-selection-height)');
  assert.equal(ownerDeclarations(docsOwner)['--switch-height'], 'var(--atlas-selection-height)');
  assert.equal(ownerDeclarations(approvedOwner)['--radio-size'], 'var(--atlas-handle-size)');
  assert.equal(
    ownerDeclarations(approvedOwner)['--switch-height'],
    'var(--atlas-component-height)',
  );
  const web = postcss.parse(await readFile('docs/src/styles/web.css', 'utf8'));
  const proportionalRules = [];
  const hitRules = [];
  web.walkRules(rule => {
    if (
      rule.nodes.some(
        decl => decl.prop === '--switch-content-icon-size' && decl.value.includes('0.5'),
      )
    )
      proportionalRules.push(rule);
    if (
      rule.nodes.some(decl => decl.prop === 'min-inline-size' && decl.value === 'var(--target-min)')
    )
      hitRules.push(rule);
  });
  for (const [owner, expected] of [
    [docsOwner, true],
    [approvedOwner, false],
  ]) {
    const control = owner.querySelector('.ant-switch');
    assert.equal(
      proportionalRules.some(rule => rule.selectors.some(selector => control.matches(selector))),
      expected,
    );
    for (const kind of ['checkbox', 'radio']) {
      const wrapper = owner.querySelector(`.ant-${kind}-wrapper`);
      assert.ok(wrapper, `${kind} without text must retain its semantic label wrapper`);
      assert.equal(
        hitRules.some(rule => rule.selectors.some(selector => wrapper.matches(selector))),
        expected,
      );
    }
  }
});
