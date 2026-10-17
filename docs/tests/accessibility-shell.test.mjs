import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import { mountPattern } from './harness.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const layout = await readFile(resolve(root, 'docs/src/layouts/DocsLayout.astro'), 'utf8');
const header = layout.match(/<header\b[^>]*class="docs-header"[^>]*>[\s\S]*?<\/header>/)?.[0];
const controller = layout.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(header, 'the test uses the actual documentation header');
assert.ok(controller, 'the test uses the actual documentation controller');
const compiled = await build({
  stdin: {
    contents:
      controller +
      "\nexport { setLocale as testSetLocale } from '../i18n';export { docsAccessibleThemeColors as testThemeColors } from '../data/accessibility';export { contrastRatio as testContrastRatio } from '../data/color-system';",
    resolveDir: resolve(root, 'docs/src/layouts'),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node24',
});

let instance = 0;
async function shell(t, content = '') {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${header}${content}</body></html>`, {
    url: 'https://genux.test/',
  });
  const { window } = dom;
  const matchMedia = query => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
  window.matchMedia = matchMedia;
  const saved = new Map();
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    navigator: window.navigator,
    Event: window.Event,
    matchMedia,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  }
  t.after(() => {
    window.dispatchEvent(new window.Event('pagehide'));
    window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const module = await import(
    'data:text/javascript;base64,' +
      Buffer.from(compiled.outputFiles[0].text).toString('base64') +
      '#' +
      ++instance
  );
  return { window, module };
}

test('language accessible names retain their visible EN/TR labels in English and Turkish', async t => {
  const { window, module } = await shell(t);
  const buttons = [...window.document.querySelectorAll('[data-locale-button]')];
  assert.deepEqual(
    buttons.map(button => button.textContent.trim()),
    ['EN', 'TR'],
  );
  buttons[1].focus();
  for (const locale of ['en', 'tr', 'en']) {
    await module.testSetLocale(locale);
    assert.equal(window.document.documentElement.lang, locale);
    for (const button of buttons) {
      const visibleLabel = button.textContent.trim();
      const accessibleName = button.getAttribute('aria-label') ?? '';
      assert.ok(
        accessibleName.toUpperCase().includes(visibleLabel.toUpperCase()),
        `${locale}: accessible name “${accessibleName}” must include visible label “${visibleLabel}”`,
      );
      assert.match(
        accessibleName,
        locale === 'tr'
          ? button.dataset.localeButton === 'en'
            ? /İngilizce/
            : /Türkçe/
          : button.dataset.localeButton === 'en'
            ? /English/
            : /Turkish/,
        `${locale}: the language name remains expanded and localized`,
      );
      assert.equal(
        button.getAttribute('aria-pressed'),
        String(button.dataset.localeButton === locale),
      );
      assert.equal(
        window.document.querySelector(`[data-locale-button="${button.dataset.localeButton}"]`),
        button,
      );
    }
    assert.equal(window.document.activeElement, buttons[1], 'language updates retain focus');
  }
});

test('navigation search placeholder consumes readable docs colors outside the live preview', async t => {
  const navigationSearch = layout.match(/<label class="nav-search">[\s\S]*?<\/label>/)?.[0];
  assert.ok(navigationSearch, 'the test uses the actual navigation search markup');
  const { window, module } = await shell(t, navigationSearch);
  const input = window.document.querySelector('#component-search');
  assert.ok(input);
  assert.equal(input.closest('.live-preview'), null);
  const sheets = await Promise.all(
    ['docs', 'web', 'docs-accessibility'].map(async name =>
      postcss.parse(await readFile(resolve(root, `docs/src/styles/${name}.css`), 'utf8')),
    ),
  );
  const matchingValue = (property, placeholder = false) => {
    let value;
    for (const sheet of sheets)
      sheet.walkRules(rule => {
        if (rule.selector.includes('::placeholder') !== placeholder) return;
        if (!input.matches(rule.selector.replaceAll('::placeholder', ''))) return;
        rule.walkDecls(property, declaration => {
          value = declaration.value;
        });
      });
    return value;
  };
  window.document.body.dataset.genuxSurface = 'docs';
  for (const mode of ['light', 'dark']) {
    window.document.documentElement.dataset.theme = mode;
    const colors = module.testThemeColors[mode];
    for (const focused of [false, true]) {
      if (focused) input.focus();
      else input.blur();
      assert.equal(matchingValue('color', true), 'var(--ink)');
      assert.equal(matchingValue('opacity', true), 'var(--docs-placeholder-opacity)');
      assert.equal(matchingValue('background'), 'var(--field-bg)');
      const paint =
        '#' +
        colors.ink
          .slice(1)
          .match(/../g)
          .map((hex, index) =>
            Math.round(
              parseInt(hex, 16) * 0.75 +
                parseInt(colors.fieldBg.slice(1).match(/../g)[index], 16) * 0.25,
            )
              .toString(16)
              .padStart(2, '0'),
          )
          .join('');
      const ratio = module.testContrastRatio(paint, colors.fieldBg);
      assert.ok(ratio >= 4.5, `${mode}/${focused ? 'focus' : 'rest'}: ${ratio.toFixed(4)} <4.5`);
    }
  }
  window.document.body.removeAttribute('data-genux-surface');
  assert.equal(matchingValue('color', true), undefined, 'approved consumers keep their styling');
  assert.equal(matchingValue('opacity', true), undefined);
});

test('documentation hint and tab styles follow native ownership across nested approved controls and portals', async t => {
  const dom =
    new JSDOM(`<body data-genux-surface="docs"><div class="live-preview"><div class="genux-demo" data-genux-appearance="docs">
    <input id="docs-input" class="ant-input css-var-genux-docs"/>
    <span class="ant-input-affix-wrapper css-var-genux-docs"><input id="docs-inner" class="ant-input"/></span>
    <div class="genux-demo" data-genux-appearance="approved">
      <input id="approved-input" class="ant-input css-var-genux"/>
      <span class="ant-input-affix-wrapper css-var-genux"><input id="approved-inner" class="ant-input"/></span>
      <div class="ant-tabs css-var-genux"><span id="approved-bar" class="ant-tabs-ink-bar"></span></div>
    </div>
    <div class="ant-tabs css-var-genux-docs"><span id="docs-bar" class="ant-tabs-ink-bar"></span></div>
  </div></div><div class="genux-demo genux-tweaker-panel"><input id="portal-input" class="ant-input css-var-genux-docs"/></div></body>`);
  t.after(() => dom.window.close());
  const sheet = postcss.parse(
    await readFile(resolve(root, 'docs/src/styles/docs-accessibility.css'), 'utf8'),
  );
  sheet.walkDecls(declaration => {
    assert.ok(
      !['--placeholder-opacity', '--placeholder-active-opacity'].includes(declaration.prop),
      'docs must not override inherited approved placeholder aliases',
    );
  });
  const value = (id, property, { placeholder = true, hover = false } = {}) => {
    let result;
    sheet.walkRules(rule => {
      if (rule.parent.type === 'atrule' || rule.selector.includes('::placeholder') !== placeholder)
        return;
      if (!hover && rule.selector.includes(':hover')) return;
      const selector = rule.selector.replaceAll('::placeholder', '').replaceAll(':hover', '');
      if (dom.window.document.getElementById(id).matches(selector))
        rule.walkDecls(property, declaration => {
          result = declaration.value;
        });
    });
    return result;
  };
  for (const id of ['docs-input', 'docs-inner', 'portal-input']) {
    assert.equal(value(id, 'opacity'), 'var(--docs-placeholder-opacity)', id);
    assert.equal(
      value(id, 'opacity', { hover: true }),
      'var(--docs-placeholder-hover-opacity)',
      id,
    );
  }
  for (const id of ['approved-input', 'approved-inner'])
    assert.equal(
      value(id, 'opacity', { hover: true }),
      undefined,
      `${id}: approved appearance is isolated`,
    );
  assert.equal(value('docs-bar', 'display', { placeholder: false }), 'none');
  assert.equal(value('approved-bar', 'display', { placeholder: false }), undefined);
  assert.equal(
    value('docs-input', 'transition-property', { placeholder: false }),
    'var(--docs-input-transition-properties)',
  );
});

test('open searchable native Select values stay opaque without obscuring typed search or other consumers', async t => {
  const file = `docs/tests/.a11y-select-opacity-${randomUUID()}.tsx`;
  await writeFile(
    resolve(root, file),
    `import {useState} from 'react';import {ConfigProvider,Select} from 'antd';import GenUXProvider from '../src/react/GenUXProvider';
const options=[{value:'design',label:'Design'},{value:'engineering',label:'Engineering'}];
export default function Probe(){const[search,setSearch]=useState('');return <GenUXProvider appearance="docs"><Select id="opaque-docs" open showSearch value="design" searchValue={search} onSearch={setSearch} options={options}/><Select id="opaque-nonsearch" open showSearch={false} value="design" options={options}/><Select id="opaque-disabled" open showSearch disabled value="design" options={options}/><ConfigProvider theme={{cssVar:{key:'css-var-genux-color-preview'}}}><Select id="opaque-preview" open showSearch value="design" options={options}/></ConfigProvider><GenUXProvider appearance="approved"><Select id="opaque-approved" open showSearch value="design" options={options}/></GenUXProvider></GenUXProvider>}`,
  );
  let h;
  try {
    h = await mountPattern('default', file);
  } catch (error) {
    await unlink(resolve(root, file));
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(resolve(root, file));
  });
  h.document.body.dataset.genuxSurface = 'docs';
  const css = postcss.parse(
    await readFile(resolve(root, 'docs/src/styles/docs-accessibility.css'), 'utf8'),
  );
  const content = id =>
    h.document.getElementById(id).closest('.ant-select').querySelector('.ant-select-content');
  const authoredOpacity = node => {
    let value;
    css.walkRules(rule => {
      if (rule.selector.includes('::') || !node.matches(rule.selector)) return;
      rule.walkDecls('opacity', declaration => {
        value = declaration.value;
      });
    });
    return value;
  };
  const resolvedOpacity = node =>
    Number(authoredOpacity(node) ?? (h.window.getComputedStyle(node).opacity || 1));
  for (const mode of ['light', 'dark']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    for (const id of ['opaque-docs', 'opaque-preview', 'opaque-nonsearch']) {
      const selected = content(id);
      assert.ok(selected.closest('.ant-select-open.ant-select-single'));
      assert.ok(selected.classList.contains('ant-select-content-has-value'));
      assert.match(selected.textContent, /Design/);
      assert.equal(resolvedOpacity(selected), 1, `${mode}/${id}: readable selected value`);
    }
    for (const id of ['opaque-disabled', 'opaque-approved'])
      assert.equal(authoredOpacity(content(id)), undefined, `${id}: outside the docs override`);
  }
  const search = h.document.getElementById('opaque-docs');
  await h.type(search, 'engi');
  assert.equal(search.value, 'engi');
  const searched = content('opaque-docs');
  assert.ok(searched.classList.contains('ant-select-content-has-search-value'));
  assert.equal(resolvedOpacity(searched), 1, 'the search input keeps its opaque parent');
  assert.equal(Number(h.window.getComputedStyle(search).opacity || 1), 1);
  h.document.body.removeAttribute('data-genux-surface');
  assert.equal(authoredOpacity(content('opaque-docs')), undefined, 'the rule stays docs-only');
});

test('each code block announces localized clipboard success and failure without moving focus', async t => {
  const { window, module } = await shell(
    t,
    ['const first = 1;', 'const second = 2;']
      .map(
        code => `<details class="code-disclosure" open>
        <summary>Usage code</summary>
        <div class="code-block">
          <button class="copy-code" type="button" data-copy data-i18n="Copy code">Copy code</button>
          <pre><code>${code}</code></pre>
        </div>
      </details>`,
      )
      .join(''),
  );
  const blocks = [...window.document.querySelectorAll('.code-block')];
  const buttons = blocks.map(block => block.querySelector('[data-copy]'));
  const statuses = blocks.map(block => block.querySelector('[role="status"]'));
  for (const [index, status] of statuses.entries()) {
    assert.ok(status, 'each code block mounts its status before copying');
    assert.ok(status.id, 'each copy result has a stable association target');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(status.getAttribute('aria-atomic'), 'true');
    assert.ok(status.getAttribute('aria-label'), 'the status has an accessible name');
    assert.ok(
      (buttons[index].getAttribute('aria-describedby') ?? '').split(/\s+/).includes(status.id),
      'a copy action is associated with its own result',
    );
    assert.equal(status.textContent, '');
  }
  assert.notEqual(statuses[0].id, statuses[1].id, 'different code blocks have distinct results');
  for (const locale of ['en', 'tr']) {
    await module.testSetLocale(locale);
    const copied = [];
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        async writeText(value) {
          copied.push(value);
        },
      },
    });
    buttons[0].focus();
    buttons[0].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(copied, [blocks[0].querySelector('code').textContent]);
    assert.equal(statuses[0].textContent, locale === 'tr' ? 'Kopyalandı' : 'Copied');
    assert.equal(window.document.activeElement, buttons[0]);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        async writeText() {
          throw new Error('Clipboard unavailable');
        },
      },
    });
    buttons[1].focus();
    buttons[1].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(
      statuses[1].textContent,
      locale === 'tr' ? 'Kopyalamak için kodu seç' : 'Select the code to copy',
    );
    assert.equal(statuses[0].textContent, locale === 'tr' ? 'Kopyalandı' : 'Copied');
    assert.equal(window.document.activeElement, buttons[1]);
    for (const [index, status] of statuses.entries()) {
      assert.equal(blocks[index].querySelector('[role="status"]'), status);
      assert.equal(
        status.getAttribute('aria-label'),
        locale === 'tr' ? 'Kod kopyalama durumu' : 'Code copy status',
      );
    }
  }
});
