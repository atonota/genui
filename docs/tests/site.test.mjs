import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { init, parse } from 'es-module-lexer';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = resolve(root, 'docs/dist');
const origin = 'https://atlas.invalid';
const demos = {
  button: ['ButtonDemo', 'WebButtonDemo'],
  input: ['InputDemo', 'WebInputDemo'],
  select: ['SelectDemo', 'WebSelectDemo'],
  checkbox: ['CheckboxDemo', 'WebCheckboxDemo'],
  radio: ['RadioDemo', 'WebRadioDemo'],
  switch: ['SwitchDemo', 'WebSwitchDemo'],
  slider: ['SliderDemo', 'default'],
  accordion: ['AccordionDemo', 'default'],
  form: ['FormDemo', 'default'],
  drawer: ['DrawerDemo', 'default'],
  pill: ['PillDemo', 'default'],
  card: ['CardDemo', 'default'],
  splitter: ['SplitterDemo', 'default'],
  breadcrumb: ['BreadcrumbDemo', 'default'],
  dropdown: ['DropdownDemo', 'default'],
  pagination: ['PaginationDemo', 'default'],
  steps: ['StepsDemo', 'default'],
  autocomplete: ['AutoCompleteDemo', 'default'],
  cascader: ['CascaderDemo', 'default'],
  'data-table': ['workspace/CollectionDemo', 'DataTableDemo'],
  'collection-views': ['workspace/CollectionDemo', 'default'],
  'record-details': ['workspace/RecordDetailsDemo', 'default'],
  'record-forms': ['workspace/RecordFormsDemo', 'default'],
  'record-workspace': ['workspace/kit/ConnectedWorkspace', 'default'],
};
const foundations = [
  '/',
  '/getting-started/',
  '/tokens/',
  '/decisions/',
  '/licenses/',
  '/documentation/',
];
const expectedRoutes = [
  ...foundations,
  '/color-system/',
  ...Object.keys(demos).map(slug => `/components/${slug}/`),
];

async function filesWithin(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(entry => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? filesWithin(path) : path;
      }),
    )
  ).flat();
}

const builtFiles = await filesWithin(dist);
const builtFileSet = new Set(builtFiles);
const pages = new Map(
  await Promise.all(
    expectedRoutes.map(async route => {
      const html = await readFile(resolve(dist, `.${route}index.html`), 'utf8');
      const window = new JSDOM(html, { url: origin + route }).window;
      return [route, { html, document: window.document }];
    }),
  ),
);

function localFile(url) {
  const pathname = decodeURIComponent(url.pathname);
  const path = resolve(dist, `.${pathname}`);
  assert.ok(path === dist || path.startsWith(dist + sep), `Asset escapes build: ${url.href}`);
  return path;
}

const stylesheets = new Map();
for (const { document } of pages.values()) {
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    const url = new URL(link.href);
    assert.equal(url.origin, origin, `Stylesheet must be local: ${link.href}`);
    stylesheets.set(url.pathname, await readFile(localFile(url), 'utf8'));
  }
}
const css = [...stylesheets.values()].join('\n');

test('every highlighted code token is readable against its actual panel surface in both themes', async () => {
  const compiled = await build({
    stdin: {
      contents:
        "export {contrastRatio} from './docs/src/data/color-system';export {docsAccessibleThemeColors} from './docs/src/data/accessibility';",
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { contrastRatio, docsAccessibleThemeColors } = await import(
    'data:text/javascript;base64,' +
      Buffer.from(compiled.outputFiles[0].contents).toString('base64')
  );
  const failures = [];
  let count = 0;
  for (const [route, { document }] of pages)
    for (const span of document.querySelectorAll('.astro-code span[style]')) {
      if (!span.textContent.trim()) continue;
      count++;
      for (const mode of ['light', 'dark']) {
        let ink = span.style.getPropertyValue(mode === 'light' ? 'color' : '--shiki-dark');
        if (ink.startsWith('rgb'))
          ink =
            '#' +
            ink
              .match(/\d+/g)
              .map(v => Number(v).toString(16).padStart(2, '0'))
              .join('');
        if (!ink) continue;
        assert.match(ink, /^#[\da-f]{6}$/i, `${route}: unsupported syntax color`);
        const ratio = contrastRatio(ink, docsAccessibleThemeColors[mode].panel);
        if (ratio < 4.5)
          failures.push(`${mode} ${route} ${span.textContent.slice(0, 25)}: ${ratio.toFixed(4)}:1`);
      }
    }
  assert.ok(count > 3000, 'check actual emitted tokens across all documentation pages');
  assert.deepEqual(failures, []);
});

test('Select reserves one stable affix slot without native hover content reflow', async () => {
  const { document } = pages.get('/components/select/');
  const select = document.querySelector('#select-single').closest('.ant-select');
  assert.ok(select.querySelector(':scope > .ant-select-clear'));
  assert.ok(select.querySelector(':scope > .ant-select-suffix'));
  const scoped = postcss.parse(
    document.querySelector('style[data-atlas-theme-tokens]').textContent,
  );
  const margins = [];
  scoped.walkDecls('--ant-select-show-arrow-padding-inline-end', node => margins.push(node.value));
  assert.equal(margins.length, 2, 'both SSR themes own the native hover margin token');
  assert.ok(
    margins.every(value => /^0(?:px|rem)?$/.test(value)),
    'hover must not reduce content width',
  );
  const shared = postcss.parse(
    await readFile(resolve(root, 'docs/src/styles/components.css'), 'utf8'),
  );
  let slot;
  shared.walkRules(rule => {
    if (
      rule.selector.replace(/\s+/g, ' ') ===
      '.atlas-demo .ant-select :is(.ant-select-clear, .ant-select-suffix)'
    )
      slot = rule;
  });
  assert.ok(slot, 'clear and suffix share the same absolute geometry owner');
  const values = Object.fromEntries(slot.nodes.map(node => [node.prop, node.value]));
  assert.equal(values.position, 'absolute');
  assert.equal(values.width, 'var(--control-affix-size)');
  assert.equal(values.height, 'var(--control-affix-size)');
  assert.equal(values['inset-inline-end'], 'var(--control-affix-inset)');
  assert.match(
    values.transform,
    /translateY\(-50%\).*translateZ\(0\)/,
    'preserve native clear compositing while centering',
  );
  let keyboardSwap;
  shared.walkRules(rule => {
    if (
      rule.selector.replace(/\s+/g, ' ') ===
      '.atlas-demo .ant-select:has(> .ant-select-clear:focus-visible) > .ant-select-suffix'
    )
      keyboardSwap = rule;
  });
  assert.equal(
    keyboardSwap?.nodes.find(node => node.prop === 'opacity')?.value,
    '0',
    'keyboard clear focus must not paint both icons in the same slot',
  );
});

test('every page exposes an accessible theme switch and restores dark preference before paint', () => {
  for (const [route, { document }] of pages) {
    const toggle = document.querySelector('[data-theme-toggle]');
    assert.ok(toggle, `${route}: theme switch missing`);
    assert.equal(toggle.getAttribute('role'), 'switch');
    assert.equal(toggle.getAttribute('aria-label'), 'Dark theme');
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    const icons = [...toggle.querySelectorAll('svg[data-icon-library="phosphor"]')];
    assert.deepEqual(
      icons.map(icon => icon.dataset.iconName),
      ['sun', 'moon'],
      `${route}: theme icons`,
    );
    assert.ok(icons.every(icon => icon.getAttribute('aria-hidden') === 'true'));
    assert.ok(toggle.querySelector('.theme-toggle-thumb'), `${route}: moving switch thumb`);
    assert.equal(
      toggle.querySelector('[data-theme-label]'),
      null,
      'icons replace the old state text',
    );
    const bootstrap = document.querySelector('head script[data-theme-bootstrap]')?.textContent;
    assert.ok(bootstrap, `${route}: before-paint theme bootstrap missing`);
    const dom = new JSDOM('<!doctype html><html></html>', {
      url: origin + route,
      runScripts: 'outside-only',
    });
    dom.window.localStorage.setItem('atlas-theme', 'dark');
    vm.runInContext(bootstrap, dom.getInternalVMContext());
    assert.equal(dom.window.document.documentElement.dataset.theme, 'dark');
    assert.equal(dom.window.document.documentElement.style.colorScheme, 'dark');
    const control = dom.window.document.createElement('button');
    control.setAttribute('data-theme-toggle', '');
    control.setAttribute('aria-checked', 'false');
    dom.window.document.documentElement.append(control);
    const sync = document.querySelector('script[data-theme-control-bootstrap]')?.textContent;
    assert.ok(
      sync,
      `${route}: the parsed switch synchronizes its name/role/value before the module loads`,
    );
    vm.runInContext(sync, dom.getInternalVMContext());
    assert.equal(control.getAttribute('aria-checked'), 'true');
    dom.window.document.documentElement.dataset.theme = 'light';
    vm.runInContext(sync, dom.getInternalVMContext());
    assert.equal(control.getAttribute('aria-checked'), 'false');
    dom.window.close();
  }
});

test('every production page ships both accessibility theme roles and declared names for its controls', () => {
  let count = 0;
  for (const [route, { document }] of pages) {
    const roles = document.querySelector('[data-docs-accessibility]')?.textContent;
    assert.match(roles ?? '', /:root\[data-theme='light'\]/, `${route}: light accessibility roles`);
    assert.match(roles ?? '', /:root\[data-theme='dark'\]/, `${route}: dark accessibility roles`);
    for (const control of document.querySelectorAll(
      'button,input:not([type="hidden"]),select,textarea,[role="slider"],[role="combobox"],[role="switch"],[role="tab"]',
    )) {
      if (control.closest('[hidden],[inert],[aria-hidden="true"]')) continue;
      const refs = (control.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
      assert.ok(
        refs.every(id => document.getElementById(id)),
        `${route}: unresolved accessible name reference`,
      );
      const name =
        control.getAttribute('aria-label')?.trim() ||
        refs
          .map(id => document.getElementById(id)?.textContent)
          .join(' ')
          .trim() ||
        [...(control.labels ?? [])]
          .map(label => label.textContent)
          .join(' ')
          .trim() ||
        (control.matches('button,[role="tab"]')
          ? control.textContent.trim() ||
            [...control.querySelectorAll('[role="img"][aria-label]')]
              .filter(icon => !icon.closest('[aria-hidden="true"]'))
              .map(icon => icon.getAttribute('aria-label'))
              .join(' ')
          : '') ||
        control.getAttribute('title')?.trim();
      assert.ok(name, `${route}: ${control.tagName}#${control.id} has no declared name`);
      count++;
    }
  }
  assert.ok(count > 500, 'check every emitted control, not a sample');
});

test('production output contains every documentation route and useful semantic HTML', () => {
  const actualRoutes = builtFiles
    .filter(path => path.endsWith(`${sep}index.html`))
    .map(
      path =>
        '/' +
        relative(dist, path)
          .replaceAll(sep, '/')
          .replace(/index\.html$/, ''),
    );
  assert.deepEqual(actualRoutes.sort(), [...expectedRoutes].sort());
  for (const [route, { document }] of pages) {
    assert.equal(document.documentElement.lang, 'en', route);
    assert.equal(document.querySelectorAll('main').length, 1, route);
    assert.equal(document.querySelectorAll('h1').length, 1, route);
    assert.ok(document.title.trim(), route);
    assert.ok(document.querySelector('meta[name="description"]')?.content.trim(), route);
    assert.match(
      document.querySelector('meta[name="viewport"]')?.content ?? '',
      /width=device-width/,
    );
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(ids).size, ids.length, `${route}: duplicate IDs`);
    assert.ok(document.querySelector('a[href="#content"]'), `${route}: skip link missing`);
  }
});

test('every documentation route exposes permanent navigation without a collapse control, including without JavaScript', () => {
  for (const [route, { document }] of pages) {
    const navigation = document.getElementById('navigation');
    assert.ok(navigation, route);
    assert.equal(navigation.tagName, 'DIV', `${route}: static navigation container`);
    assert.equal(navigation.querySelector('details, summary, button, [aria-expanded]'), null);
    assert.equal(navigation.closest('[hidden], [inert], details'), null);
    assert.equal(
      navigation.querySelector('.navigation-title').textContent.trim(),
      'Component library',
    );
    assert.ok(navigation.querySelector('nav[aria-label="Documentation"] #component-search'));
    assert.ok(navigation.querySelector('a[href="/components/form/"]'));
  }
});

test('documentation search keeps Input discoverable in both languages without losing focus', async t => {
  const layout = await readFile(resolve(root, 'docs/src/layouts/DocsLayout.astro'), 'utf8');
  const controller = layout.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(controller);
  const bundled = await build({
    stdin: {
      contents: controller + "\nexport { setLocale as testSetLocale } from '../i18n';",
      resolveDir: resolve(root, 'docs/src/layouts'),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
  });
  const dom = new JSDOM(pages.get('/').html, { url: origin });
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
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
  const search = window.document.querySelector('#component-search');
  const inputEntry = window.document.querySelector('a[href="/components/input/"]').closest('li');
  search.focus();
  for (const locale of ['en', 'tr']) {
    await module.testSetLocale(locale);
    for (const query of ['input', 'Input', 'INPUT', 'ınput']) {
      search.value = query;
      search.dispatchEvent(new window.Event('input'));
      assert.equal(inputEntry.hidden, false, `${locale}: ${query}`);
      assert.equal(window.document.querySelector('#search-status').hidden, true);
      assert.equal(window.document.activeElement, search);
    }
    search.value = 'Drawer';
    search.dispatchEvent(new window.Event('input'));
    assert.equal(
      window.document.querySelector('a[href="/components/drawer/"]').closest('li').hidden,
      false,
    );
  }
});

test('every internal navigation link, fragment and declared production resource resolves', () => {
  let checkedLinks = 0;
  for (const [route, { document }] of pages) {
    for (const anchor of document.querySelectorAll('a[href]')) {
      const url = new URL(anchor.href);
      if (url.origin !== origin) continue;
      const targetRoute = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
      const target = pages.get(targetRoute);
      assert.ok(target, `${route}: unresolved internal page ${url.pathname}`);
      if (url.hash) {
        assert.ok(
          target.document.getElementById(decodeURIComponent(url.hash.slice(1))),
          `${route}: unresolved fragment ${url.pathname}${url.hash}`,
        );
      }
      checkedLinks++;
    }
    for (const element of document.querySelectorAll(
      'script[src], link[href], img[src], astro-island',
    )) {
      const attributes = element.matches('astro-island')
        ? ['component-url', 'renderer-url']
        : [element.matches('link') ? 'href' : 'src'];
      for (const attribute of attributes) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        const url = new URL(value, origin + route);
        assert.equal(url.origin, origin, `${route}: remote runtime resource ${value}`);
        assert.ok(builtFileSet.has(localFile(url)), `${route}: missing resource ${value}`);
      }
    }
  }
  assert.ok(checkedLinks >= expectedRoutes.length * 10, 'Navigation coverage unexpectedly empty');
});

test('each component page declares exactly its expected React island', () => {
  for (const [slug, [moduleName, exportName]] of Object.entries(demos)) {
    const { document } = pages.get(`/components/${slug}/`);
    const islands = [...document.querySelectorAll('astro-island')];
    assert.equal(islands.length, 1, slug);
    const island = islands[0];
    assert.match(
      island.getAttribute('component-url') ?? '',
      new RegExp(`/_astro/${moduleName.split('/').at(-1)}\\.[^/]+\\.js$`),
    );
    assert.equal(island.getAttribute('component-export'), exportName, slug);
    assert.equal(island.getAttribute('client'), 'load', slug);
    assert.ok(island.hasAttribute('ssr'), `${slug}: server-rendered fallback missing`);
    assert.ok(island.textContent.trim(), `${slug}: empty server-rendered preview`);
    assert.match(island.getAttribute('renderer-url') ?? '', /\/_astro\/client\.[^/]+\.js$/);
    assert.ok(document.querySelector('#api tbody tr'), `${slug}: API reference missing`);
    assert.ok(
      document.querySelectorAll('#code pre code').length >= 2,
      `${slug}: copyable examples missing`,
    );
  }
});

test('copyable multiple and tags examples search visible labels', () => {
  const document = pages.get('/components/select/').document;
  const controls = [...document.querySelectorAll('#code pre code')]
    .flatMap(code => [...code.textContent.matchAll(/<Select(?:<[^>]+>)?([\s\S]*?)\/>/g)])
    .map(match => match[1])
    .filter(attributes => /mode="(?:multiple|tags)"/.test(attributes));
  assert.equal(controls.length, 2);
  for (const attributes of controls)
    assert.match(attributes, /showSearch=\{\{\s*optionFilterProp:\s*'label'\s*\}\}/);
});

test('web SSR quantity field ships shared trash and plus buttons before hydration', async () => {
  const { document } = pages.get('/components/input/');
  const input = document.querySelector('#input-number');
  const owner = input.closest('.atlas-number-stepper');
  assert.ok(owner);
  const down = owner.querySelector('button[aria-label="Remove"]');
  const up = owner.querySelector('button[aria-label="Increase"]');
  assert.ok(down.compareDocumentPosition(input) & 4, 'remove action precedes the numeric input');
  assert.ok(input.compareDocumentPosition(up) & 4, 'plus follows the numeric input');
  assert.equal(down.querySelector('svg')?.getAttribute('data-icon-name'), 'trash');
  assert.equal(up.querySelector('svg')?.getAttribute('data-icon-name'), 'plus');
  assert.equal(owner.querySelectorAll('svg[data-icon-library="phosphor"]').length, 2);
  assert.equal(owner.querySelectorAll('.anticon').length, 0);
  assert.equal(owner.textContent.trim(), '', 'icons contain no keyboard glyphs');
  assert.equal(
    owner.querySelectorAll('.ant-input-number-action, button button, [role="button"] button')
      .length,
    0,
  );
  assert.ok(document.querySelector('[data-icon-button-examples]') === null);
  const buttons = pages.get('/components/button/').document;
  assert.equal(buttons.querySelectorAll('[data-icon-button-examples] .atlas-button').length, 3);
  assert.equal(buttons.querySelectorAll('[data-icon-radius-examples] .atlas-button').length, 8);
  const shared = postcss.parse(
    await readFile(resolve(root, 'docs/src/styles/components.css'), 'utf8'),
  );
  let marker;
  shared.walkRules(rule => {
    const selector = rule.selector.replace(/\s+/g, ' ');
    if (
      selector.endsWith('.atlas-demo .atlas-icon-button:focus-visible .atlas-button-content::after')
    ) {
      assert.ok(
        selector.startsWith(":root:not([data-input-modality='pointer'])"),
        'pointer focus must not leave the keyboard marker visible',
      );
      marker = rule.nodes.find(node => node.prop === 'background')?.value;
    }
  });
  assert.equal(marker, 'currentColor', 'icon focus marker shares the readable button foreground');
});

test('web keeps fields visible instead of hiding a duplicate framed variant', () => {
  for (const slug of ['input', 'select']) {
    const { document } = pages.get(`/components/${slug}/`);
    assert.equal(document.querySelectorAll('[data-field-variant="outlined"]').length, 0);
    const section = document
      .querySelector(`label[for="${slug}-filled"]`)
      ?.closest('.example-block');
    assert.ok(section, `${slug}: surface examples missing`);
    assert.equal(
      section.querySelectorAll(`#${slug}-filled`).length,
      1,
      `${slug}: the named filled control remains visible exactly once`,
    );
    assert.deepEqual(
      [...section.querySelectorAll('label')].map(label => label.textContent.trim()),
      ['Filled'],
    );
    assert.equal(document.querySelectorAll('.field-surface-control').length, 0);
    assert.doesNotMatch(
      document.querySelector('main').textContent,
      /borderless|underlined|outlined/i,
    );
  }
});

test('web checkbox mark has a reversible, delay-free motion contract without changing Storybook', async () => {
  const sheet = postcss.parse(await readFile(resolve(root, 'docs/src/styles/web.css'), 'utf8'));
  const rules = [];
  sheet.walkRules(rule => rules.push(rule));
  const mark = rules.find(rule =>
    rule.selector.includes('.ant-checkbox:not(.ant-checkbox-indeterminate)::after'),
  );
  assert.ok(mark, 'AntD 6 checkmark needs a web-only rule shared by both toggle directions');
  const properties = Object.fromEntries(mark.nodes.map(node => [node.prop, node.value]));
  assert.equal(properties.opacity, '0');
  assert.equal(properties['transition-delay'], 'var(--motion-delay)');
  assert.equal(properties['transition-property'], 'opacity, transform');
  assert.equal(properties['transition-duration'], 'var(--checkbox-mark-duration)');
  assert.equal(properties['transition-timing-function'], 'var(--motion-easing)');
  assert.notEqual(properties.display, 'none', 'mark must remain drawable on exit');
  assert.notEqual(properties.visibility, 'hidden', 'mark must remain drawable on exit');
  assert.doesNotMatch(properties.transform, /rotate/, 'Phosphor SVG is already correctly oriented');
  const checked = rules.find(rule =>
    rule.selector.includes('.ant-checkbox-checked:not(.ant-checkbox-indeterminate)::after'),
  );
  assert.ok(checked);
  assert.equal(checked.nodes.find(node => node.prop === 'opacity')?.value, '1');
  assert.ok(
    !checked.nodes.some(node => node.prop.startsWith('transition')),
    'entry and exit share timing without a checked-only delay',
  );
  const tokens = rules.find(rule => rule.selector === '.live-preview');
  const duration = tokens.nodes.find(node => node.prop === '--checkbox-mark-duration')?.value;
  assert.equal(duration, 'var(--motion-duration-mark)');
  const shared = postcss.parse(
    await readFile(resolve(root, 'docs/src/styles/components.css'), 'utf8'),
  );
  let reducedMark = false;
  shared.walkAtRules('media', media => {
    if (media.params !== '(prefers-reduced-motion: reduce)') return;
    media.walkRules(rule => {
      if (!rule.selectors.includes('.atlas-demo *::after')) return;
      reducedMark = rule.nodes.some(
        node => node.prop === 'transition-duration' && node.value === '0s' && node.important,
      );
    });
  });
  assert.ok(reducedMark, 'reduced motion removes the mark transition');
  const story = await readFile(resolve(root, 'storybook/Checkbox.stories.tsx'), 'utf8');
  assert.match(story, /import CheckboxDemo from ['"]\.\.\/docs\/src\/react\/CheckboxDemo['"]/);
  assert.doesNotMatch(story, /WebCheckboxDemo|atlasSharedPreview/);
});

test('web checkbox box has a 32px floor, capability sizing and the canonical Phosphor SVG', async () => {
  const data = JSON.parse(await readFile(resolve(root, 'docs/src/data/atlas.json'), 'utf8'));
  const svgSource = await readFile(resolve(root, 'docs/src/assets/phosphor/check.svg'), 'utf8');
  const svg = new JSDOM(svgSource, { contentType: 'image/svg+xml' });
  try {
    const sourceIcon = data.icons.phosphor.icons.check;
    assert.equal(svg.window.document.documentElement.getAttribute('viewBox'), sourceIcon.viewBox);
    assert.deepEqual(
      [...svg.window.document.querySelectorAll('path')].map(path => path.getAttribute('d')),
      sourceIcon.paths.map(path => path.d),
    );
  } finally {
    svg.window.close();
  }
  const sheet = postcss.parse(await readFile(resolve(root, 'docs/src/styles/web.css'), 'utf8'));
  const rules = [];
  sheet.walkRules(rule => rules.push(rule));
  const declarations = rule => Object.fromEntries(rule.nodes.map(node => [node.prop, node.value]));
  const tokens = Object.assign(
    {},
    ...rules
      .filter(rule => rule.selectors.includes('.live-preview') && rule.parent.type === 'root')
      .map(declarations),
  );
  assert.match(tokens['--checkbox-min-size'], /max\(32px,\s*2rem\)/);
  const owner = declarations(
    rules.find(rule => rule.selector === '.live-preview .atlas-demo .ant-checkbox'),
  );
  for (const dimension of ['width', 'height']) {
    assert.equal(owner[dimension], 'var(--checkbox-size)');
    assert.equal(owner[`min-${dimension}`], 'var(--checkbox-min-size)');
  }
  assert.equal(owner['border-radius'], 'var(--checkbox-radius)');
  const touch = rules.find(rule => rule.parent.params === '(any-pointer: coarse)');
  assert.ok(touch, 'touch/hybrid capability must adjust auto size');
  assert.match(declarations(touch)['--checkbox-auto-size'], /max\(44px,\s*2\.75rem\)/);
  const check = declarations(
    rules.find(rule =>
      rule.selector.includes('.ant-checkbox:not(.ant-checkbox-indeterminate)::after'),
    ),
  );
  assert.match(check.mask, /phosphor\/check\.svg/);
  assert.match(check['-webkit-mask'], /phosphor\/check\.svg/);
  assert.equal(check.border, '0');
  assert.equal(check['background-color'], 'var(--ant-color-white)');
  const disabled = declarations(
    rules.find(rule =>
      rule.selector.includes('.ant-checkbox-disabled:not(.ant-checkbox-indeterminate)::after'),
    ),
  );
  assert.equal(disabled['background-color'], 'var(--ant-color-text-disabled)');
  const { document } = pages.get('/components/checkbox/');
  const tweaker = document.querySelector('[data-tweaker-trigger]');
  assert.equal(tweaker?.getAttribute('aria-expanded'), 'false');
  assert.equal(document.querySelector('.atlas-size-options,#checkbox-size,#checkbox-radius'), null);
  assert.ok(document.querySelector('[data-checkbox-preview]'));
});

test('web radio selection paints a token-colored underline and reserves a 32px visible circle', async () => {
  const sheet = postcss.parse(await readFile(resolve(root, 'docs/src/styles/web.css'), 'utf8'));
  const rules = [];
  sheet.walkRules(rule => rules.push(rule));
  const declarations = rule => Object.fromEntries(rule.nodes.map(node => [node.prop, node.value]));
  const owner = rules.find(rule => rule.selector === '.live-preview .atlas-demo .ant-radio');
  assert.ok(owner, 'visible radio circle requires sizing independent of hit area');
  const box = declarations(owner);
  for (const dimension of ['width', 'height']) {
    assert.equal(box[dimension], 'var(--radio-size)');
    assert.equal(box[`min-${dimension}`], 'var(--radio-min-size)');
  }
  const tokens = Object.assign(
    {},
    ...rules
      .filter(rule => rule.selectors.includes('.live-preview') && rule.parent.type === 'root')
      .map(declarations),
  );
  assert.match(tokens['--radio-min-size'], /max\(32px,\s*2rem\)/);
  const selected = rules.find(rule =>
    rule.selector.includes('.ant-radio-wrapper:has(input:checked) > span:last-child'),
  );
  assert.ok(selected, 'native checked state must control the label underline');
  assert.equal(declarations(selected)['text-decoration-line'], 'underline');
  assert.equal(declarations(selected)['text-decoration-color'], 'var(--radio-selected-color)');
  const wrapper = declarations(
    rules.find(rule => rule.selector === '.live-preview .atlas-demo .ant-radio-wrapper'),
  );
  assert.equal(wrapper['--radio-selected-color'], 'var(--ant-radio-radio-bg-color)');
  const hover = rules.find(
    rule =>
      rule.selector ===
      '.live-preview .atlas-demo .ant-radio-wrapper:hover:not(.ant-radio-wrapper-disabled)',
  );
  assert.equal(declarations(hover)['--radio-selected-color'], 'var(--ant-color-primary-hover)');
  const disabled = rules.find(
    rule => rule.selector === '.live-preview .atlas-demo .ant-radio-wrapper-disabled',
  );
  assert.equal(
    declarations(disabled)['--radio-selected-color'],
    'var(--ant-radio-dot-color-disabled)',
  );
  const focused = rules.find(rule =>
    rule.selector.includes('.ant-radio-wrapper:has(input:focus-visible)::before'),
  );
  assert.ok(focused, 'keyboard focus must remain distinct from the persistent selection underline');
  assert.equal(declarations(focused)['background-color'], 'var(--focus-color)');
  assert.equal(declarations(focused).position, 'absolute', 'focus marker must not shift layout');
});

test('web switch geometry overrides the actual first-paint theme variables', async () => {
  const sheet = postcss.parse(await readFile(resolve(root, 'docs/src/styles/web.css'), 'utf8'));
  let owner;
  sheet.walkRules(rule => {
    if (rule.nodes.some(node => node.prop === '--ant-switch-handle-size')) owner = rule;
  });
  const { document } = pages.get('/components/switch/');
  const themes = postcss.parse(
    document.querySelector('style[data-atlas-theme-tokens]').textContent,
  );
  let compared = 0;
  const specificity = selector => (selector.match(/\.|\[|:root\b/g) || []).length;
  themes.walkRules(rule => {
    if (!rule.nodes.some(node => node.prop === '--ant-switch-handle-size')) return;
    for (const selector of rule.selectors) {
      assert.ok(
        specificity(owner.selector) > specificity(selector),
        'web geometry must override both SSR themes',
      );
      compared++;
    }
  });
  assert.equal(compared, 2);
});

test('web switch track has a 32px floor and native geometry scales with capability and size', async () => {
  const sheet = postcss.parse(await readFile(resolve(root, 'docs/src/styles/web.css'), 'utf8'));
  const rules = [];
  sheet.walkRules(rule => rules.push(rule));
  const declarations = rule => Object.fromEntries(rule.nodes.map(node => [node.prop, node.value]));
  const tokens = Object.assign(
    {},
    ...rules
      .filter(rule => rule.selectors.includes('.live-preview') && rule.parent.type === 'root')
      .map(declarations),
  );
  const compact = value => value?.replace(/\s+/g, '');
  assert.match(tokens['--switch-min-height'] ?? '', /max\(32px,\s*2rem\)/);
  assert.equal(tokens['--switch-auto-height'], 'var(--switch-min-height)');
  assert.equal(tokens['--switch-height'], 'var(--switch-auto-height)');
  assert.match(tokens['--switch-track-padding'] ?? '', /max\(4px,\s*0?\.25rem\)/);
  assert.equal(
    compact(tokens['--switch-handle-shadow']),
    '02px6pxrgba(var(--shadow-ink),calc(var(--shadow-contact-alpha)*2))',
  );
  const rootRules = rules.filter(
    rule =>
      rule.selectors.includes('.live-preview .atlas-demo .ant-switch') ||
      rule.selectors.includes(':root[data-theme] .live-preview .atlas-demo .ant-switch') ||
      rule.selectors.includes(
        ':root[data-theme] .live-preview .atlas-demo .ant-switch.css-var-atlas-docs',
      ),
  );
  assert.ok(rootRules.length, 'visible track must be sized independently of label hit area');
  const track = Object.assign({}, ...rootRules.map(declarations));
  assert.equal(
    compact(track['--switch-visible-height']),
    'max(var(--switch-min-height),var(--switch-height))',
  );
  assert.equal(compact(track['--switch-track-width']), 'calc(var(--switch-visible-height)*2)');
  assert.equal(compact(track['--switch-track-padding']), 'calc(var(--switch-visible-height)*0.1)');
  assert.equal(
    compact(track['--switch-handle-size']),
    'calc(var(--switch-visible-height)-var(--switch-track-padding)*2)',
  );
  for (const name of ['--switch-visible-height', '--switch-track-width', '--switch-handle-size'])
    assert.equal(
      tokens[name],
      undefined,
      `${name}: derived geometry must resolve at the switch owner`,
    );
  for (const prop of ['height', 'min-height', 'line-height'])
    assert.equal(track[prop], 'var(--switch-visible-height)');
  assert.equal(track['min-width'], 'var(--switch-track-width)');
  for (const [name, alias] of [
    ['track-height', 'switch-visible-height'],
    ['track-height-sm', 'switch-visible-height'],
    ['track-min-width', 'switch-track-width'],
    ['track-min-width-sm', 'switch-track-width'],
    ['track-padding', 'switch-track-padding'],
    ['handle-size', 'switch-handle-size'],
    ['handle-size-sm', 'switch-handle-size'],
  ])
    assert.equal(track[`--ant-switch-${name}`], `var(--${alias})`, name);
  for (const name of [
    'inner-min-margin',
    'inner-min-margin-sm',
    'inner-max-margin',
    'inner-max-margin-sm',
  ])
    assert.match(track[`--ant-switch-${name}`] ?? '', /var\(--switch-handle-size\)/, name);
  assert.equal(track['--ant-switch-handle-shadow'], 'var(--switch-handle-shadow)');
  const touch = rules.find(
    rule =>
      compact(rule.parent.params) === '(any-pointer:coarse)' &&
      rule.nodes.some(node => node.prop === '--switch-auto-height'),
  );
  assert.ok(touch, 'coarse/hybrid input must change auto track height');
  assert.match(declarations(touch)['--switch-auto-height'], /max\(44px,\s*2\.75rem\)/);
  const route = await readFile(resolve(root, 'docs/src/pages/components/[slug].astro'), 'utf8');
  assert.match(
    route,
    /import\s*\{\s*WebSwitchDemo\s+as\s+SwitchDemo\s*\}\s*from\s*['"]\.\.\/\.\.\/react\/SwitchDemo['"]/,
  );
});

test('production pages scope fast Button feedback to documentation, including portal actions', async () => {
  const motion = JSON.parse(await readFile(resolve(root, 'docs/src/data/motion.json'), 'utf8'));
  for (const [route, { document }] of pages)
    assert.equal(document.body.dataset.atlasSurface, 'docs', route);
  let token;
  let adapter;
  postcss.parse(css).walkRules(rule => {
    rule.walkDecls('--motion-duration-button-feedback', declaration => {
      token = declaration.value;
    });
    if (
      rule.selector.includes('data-atlas-surface') &&
      rule.selector.includes('.atlas-button') &&
      rule.nodes.some(node => node.prop === '--button-duration')
    )
      adapter = rule;
  });
  assert.match(token, /^\d*\.?\d+(?:ms|s)$/);
  const emittedMs = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
  assert.ok(Math.abs(emittedMs - motion.durationMs['button-feedback']) < 0.000001);
  assert.ok(adapter, 'production CSS must retain the docs-only owner');
  for (const prop of ['--button-duration', '--press-duration', '--release-duration']) {
    const declaration = adapter.nodes.find(node => node.prop === prop);
    assert.equal(declaration?.value, 'var(--motion-duration-button-feedback)');
    assert.ok(declaration.important, 'production adapter must beat inline renderer defaults');
  }
});

test('web switch on and off share reversible motion and perceptible hover without changing Storybook', async () => {
  const sheet = postcss.parse(await readFile(resolve(root, 'docs/src/styles/web.css'), 'utf8'));
  const rules = [];
  sheet.walkRules(rule => rules.push(rule));
  const declarations = rule => Object.fromEntries(rule.nodes.map(node => [node.prop, node.value]));
  const tokens = Object.assign(
    {},
    ...rules
      .filter(rule => rule.selectors.includes('.live-preview') && rule.parent.type === 'root')
      .map(declarations),
  );
  assert.equal(tokens['--switch-motion-duration'], 'var(--motion-duration-selection)');
  assert.equal(
    tokens['--switch-on-hover-color'],
    undefined,
    'hover color must resolve inside the AntD token scope',
  );
  assert.equal(tokens['--switch-hover-shadow'], 'var(--shadow-soft)');
  const darkHover = rules.find(rule =>
    rule.selector.includes(":root[data-theme='dark'] .live-preview .atlas-demo .ant-switch"),
  );
  assert.equal(
    declarations(darkHover)['--switch-on-hover-color'],
    'var(--ant-color-primary-hover)',
    'dark checked hover brightens instead of darkening toward the resting red',
  );
  const properties = new Map([
    ['.live-preview .atlas-demo .ant-switch', 'background-color, opacity, box-shadow'],
    ['.live-preview .atlas-demo .ant-switch .ant-switch-handle', 'inset-inline-start, transform'],
    [
      '.live-preview .atlas-demo .ant-switch .ant-switch-handle::before',
      'inset-inline-start, inset-inline-end, background-color, box-shadow',
    ],
  ]);
  for (const [selector, expected] of properties) {
    const matched = rules.filter(
      rule =>
        rule.selectors.includes(selector) ||
        (selector === '.live-preview .atlas-demo .ant-switch' &&
          rule.selectors.includes(':root[data-theme] .live-preview .atlas-demo .ant-switch')),
    );
    assert.ok(matched.length, selector);
    const styles = Object.assign({}, ...matched.map(declarations));
    assert.equal(styles['transition-property'], expected, selector);
    assert.equal(styles['transition-duration'], 'var(--switch-motion-duration)', selector);
    assert.equal(styles['transition-delay'], 'var(--motion-delay)', selector);
    assert.equal(styles['transition-timing-function'], 'var(--motion-easing)', selector);
    if (selector.endsWith('.ant-switch')) {
      assert.equal(styles['--ant-motion-duration-mid'], 'var(--switch-motion-duration)');
      assert.equal(styles['--switch-on-hover-color'], 'var(--ant-color-primary-active)');
    }
    if (selector.endsWith('.ant-switch-handle')) {
      assert.equal(styles['inset-inline-start'], 'var(--switch-track-padding)');
      assert.equal(styles.transform, 'translateX(0)');
    }
  }
  const checkedHandle = rules.find(
    rule =>
      rule.selector.includes('.ant-switch-checked') &&
      rule.selector.includes('.ant-switch-handle') &&
      !rule.selector.includes('.ant-switch-rtl') &&
      !rule.selector.includes('::before'),
  );
  assert.ok(
    checkedHandle,
    'checked endpoint must not depend on stale handle width during resizing',
  );
  assert.equal(
    declarations(checkedHandle)['inset-inline-start'].replace(/\s+/g, ''),
    'calc(100%-var(--switch-track-padding))',
  );
  assert.equal(declarations(checkedHandle).transform, 'translateX(-100%)');
  const rtlHandle = rules.find(
    rule =>
      rule.selector.includes('.ant-switch-checked') &&
      rule.selector.includes('.ant-switch-rtl') &&
      rule.selector.includes('.ant-switch-handle') &&
      !rule.selector.includes('::before'),
  );
  assert.ok(rtlHandle, 'logical checked endpoint needs the opposite handle transform in RTL');
  assert.equal(declarations(rtlHandle).transform, 'translateX(100%)');
  for (const rule of rules.filter(rule => rule.selector.includes('.ant-switch-checked')))
    assert.ok(
      !rule.nodes.some(node => node.prop.startsWith('transition')),
      'checked state must not replace reverse timing',
    );
  const enabled = rules.find(
    rule =>
      rule.selector.includes('.ant-switch') &&
      !rule.selector.includes(':hover') &&
      rule.nodes.some(node => node.prop === 'opacity' && node.value === 'var(--opacity-rest)'),
  );
  assert.ok(enabled && /:not\(\.ant-switch-disabled\)/.test(enabled.selector));
  const hoverRules = rules.filter(
    rule => rule.selector.includes('.ant-switch') && rule.selector.includes(':hover'),
  );
  assert.ok(hoverRules.length >= 2, 'both generic and checked hover need explicit feedback');
  for (const rule of hoverRules) {
    assert.equal(rule.parent.params.replace(/\s+/g, ''), '(any-hover:hover)');
    assert.match(rule.selector.replace(/\s+/g, ''), /:not\(\.ant-switch-disabled\)/);
    assert.match(rule.selector.replace(/\s+/g, ''), /:not\(\.ant-switch-loading\)/);
  }
  const hover = hoverRules.find(rule => declarations(rule).opacity === 'var(--opacity-hover)');
  assert.ok(hover && !hover.selector.includes('.ant-switch-checked'), 'on/off share hover opacity');
  assert.equal(declarations(hover)['box-shadow'], 'var(--switch-hover-shadow)');
  const onHover = hoverRules.find(rule => rule.selector.includes('.ant-switch-checked'));
  assert.equal(declarations(onHover).background, 'var(--switch-on-hover-color)');
  const shared = postcss.parse(
    await readFile(resolve(root, 'docs/src/styles/components.css'), 'utf8'),
  );
  let reducedDuration = false;
  shared.walkAtRules('media', media => {
    if (media.params !== '(prefers-reduced-motion: reduce)') return;
    media.walkRules(rule => {
      if (!rule.selectors.includes('.atlas-demo *::before')) return;
      reducedDuration = rule.nodes.some(
        node => node.prop === 'transition-duration' && node.value === '0s' && node.important,
      );
    });
  });
  assert.ok(reducedDuration, 'reduced motion must suppress switch/handle transitions');
  const story = await readFile(resolve(root, 'storybook/Switch.stories.tsx'), 'utf8');
  assert.match(story, /import SwitchDemo from ['"]\.\.\/docs\/src\/react\/SwitchDemo['"]/);
  assert.doesNotMatch(story, /WebSwitchDemo|atlasSharedPreview/);
});

test('web field box models reserve equal border space in normal, error and warning states', () => {
  // JSDOM checks computed CSS declarations, not physical browser rectangles.
  const properties = [
    'boxSizing',
    'height',
    'minHeight',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    ...['Top', 'Right', 'Bottom', 'Left'].flatMap(side => [
      `border${side}Width`,
      `border${side}Style`,
    ]),
  ];
  for (const [slug, ids] of [
    ['input', ['input-filled', 'input-search', 'input-password', 'input-number', 'input-note']],
    ['select', ['select-single', 'select-multiple', 'select-filled']],
  ]) {
    const { html } = pages.get(`/components/${slug}/`);
    const { window } = new JSDOM(html);
    const { document } = window;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    try {
      for (const mode of ['light', 'dark']) {
        document.documentElement.dataset.theme = mode;
        for (const id of ids) {
          const input = document.getElementById(id);
          const owner =
            input.closest('.ant-input-affix-wrapper, .ant-input-number, .ant-select') || input;
          const prefix =
            ['ant-input-affix-wrapper', 'ant-input-number', 'ant-select'].find(name =>
              owner.classList.contains(name),
            ) || 'ant-input';
          const snapshot = () => {
            const computed = window.getComputedStyle(owner);
            return Object.fromEntries(properties.map(property => [property, computed[property]]));
          };
          const normal = snapshot();
          assert.equal(normal.boxSizing, 'border-box', `${mode}: ${id}`);
          for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
            assert.equal(normal[`border${side}Style`], 'solid', `${mode}: ${id} ${side}`);
            assert.ok(normal[`border${side}Width`], `${mode}: ${id} ${side} reserves width`);
            assert.notEqual(normal[`border${side}Width`], '0px');
          }
          for (const status of ['error', 'warning']) {
            const className = `${prefix}-status-${status}`;
            owner.classList.add(className);
            assert.deepEqual(
              snapshot(),
              normal,
              `${mode}: ${id} ${status} changes no box-model declaration`,
            );
            owner.classList.remove(className);
          }
          assert.deepEqual(
            snapshot(),
            normal,
            `${mode}: ${id} recovers normal geometry declarations`,
          );
        }
      }
    } finally {
      window.close();
    }
  }
});

test('component production import graphs keep unrelated demo and form runtimes separate', async () => {
  // Reachability in emitted modules; actual network/hydration still needs browser evidence.
  await init();
  const parsedModules = new Map();
  async function importGraph(entry) {
    const visited = new Set();
    async function visit(url) {
      assert.equal(url.origin, origin, `Remote module import: ${url.href}`);
      if (visited.has(url.pathname)) return;
      visited.add(url.pathname);
      const path = localFile(url);
      assert.ok(builtFileSet.has(path), `Unresolved module: ${url.pathname}`);
      let imports = parsedModules.get(path);
      if (!imports) {
        [imports] = parse(await readFile(path, 'utf8'), url.pathname);
        parsedModules.set(path, imports);
      }
      for (const imported of imports) {
        if (imported.type === 'import-meta' || imported.typeOnly || imported.probablyTypeOnly)
          continue;
        assert.ok(
          imported.specifier && !imported.glob,
          `${url.pathname}: unanalyzable runtime import`,
        );
        assert.match(
          imported.specifier,
          /^(?:\.{1,2}\/|\/)/,
          `${url.pathname}: bare runtime import`,
        );
        await visit(new URL(imported.specifier, url));
      }
    }
    await visit(new URL(entry, origin));
    return visited;
  }
  const demoNames = Object.values(demos).map(([name]) => name.split('/').at(-1));
  for (const [slug, [ownName]] of Object.entries(demos)) {
    const island = pages.get(`/components/${slug}/`).document.querySelector('astro-island');
    const graph = await importGraph(island.getAttribute('component-url'));
    for (const path of graph) {
      const name = path.split('/').at(-1).split('.')[0];
      assert.ok(
        name === ownName.split('/').at(-1) || !demoNames.includes(name),
        `${slug}: loads unrelated demo module ${path}`,
      );
      if (slug === 'accordion') {
        assert.ok(
          ![
            'Patterns',
            'FormExamples',
            'DrawerExamples',
            'form',
            'useForm',
            'input',
            'select',
          ].includes(name),
          `Accordion unnecessarily loads form/input/select runtime: ${path}`,
        );
      }
    }
  }
});

test('server-rendered component previews include their Ant Design theme CSS before hydration', () => {
  for (const slug of Object.keys(demos)) {
    const { document } = pages.get(`/components/${slug}/`);
    const serverStyles = [...document.head.querySelectorAll('style[data-css-hash]')];
    assert.ok(
      serverStyles.length > 0,
      `${slug}: extracted Ant Design SSR styles missing from head`,
    );
    const themeCss = serverStyles.map(style => style.textContent).join('\n');
    assert.match(
      themeCss,
      /\.css-var-atlas-docs\b/,
      `${slug}: stable documentation theme selector missing`,
    );
    assert.match(
      themeCss,
      /--ant-color-primary\s*:\s*#0099ff\b/i,
      `${slug}: primary theme token missing`,
    );
    assert.ok(
      document.querySelector('astro-island [data-atlas-appearance="docs"] .css-var-atlas-docs'),
      `${slug}: rendered controls do not use the extracted theme key`,
    );
  }
});

test('every component ships one initially closed Tweaker opener and its scoped settings styles', async () => {
  // Discover emitted component routes so a new catalog entry cannot omit Tweaker.
  const componentPages = builtFiles.filter(
    path => path.startsWith(resolve(dist, 'components') + sep) && path.endsWith(sep + 'index.html'),
  );
  assert.ok(componentPages.length >= Object.keys(demos).length);
  for (const path of componentPages) {
    const route = '/' + relative(dist, dirname(path)).split(sep).join('/') + '/';
    const slug = route;
    const document =
      pages.get(route)?.document ?? new JSDOM(await readFile(path, 'utf8')).window.document;
    const triggers = document.querySelectorAll('[data-tweaker-trigger]');
    assert.equal(triggers.length, 1, `${slug}: one shared settings opener`);
    assert.equal(triggers[0].getAttribute('aria-expanded'), 'false');
    assert.equal(triggers[0].getAttribute('aria-haspopup'), 'dialog');
    assert.equal(triggers[0].getAttribute('aria-label'), 'Open tweaker');
    assert.equal(document.querySelector('.button-playground .playground-controls'), null);
    const linkedCss = (
      await Promise.all(
        [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
          readFile(localFile(new URL(link.href, origin)), 'utf8'),
        ),
      )
    ).join('\n');
    const css =
      linkedCss +
      [...document.querySelectorAll('style')].map(style => style.textContent).join('\n');
    assert.equal(
      document
        .querySelector('[data-tweaker-trigger]')
        .closest('[data-atlas-appearance="docs"]')
        .style.getPropertyValue('--atlas-tweaker-width'),
      '400px',
      `${slug}: shared viewport-bounded panel token`,
    );
    assert.match(
      css,
      /\.atlas-tweaker-trigger\{[^}]*position:fixed/,
      `${slug}: stable edge opener`,
    );
    assert.match(css, /inset-block-start:50%/, `${slug}: middle of right edge`);
  }
});

test('every component ships scoped light and dark AntD variables before hydration', () => {
  for (const slug of Object.keys(demos)) {
    const { document } = pages.get(`/components/${slug}/`);
    const themeStyles = [...document.head.querySelectorAll('style[data-atlas-theme-tokens]')];
    assert.ok(themeStyles.length > 0, `${slug}: static two-theme token CSS missing`);
    const declarations = { light: [], dark: [] };
    for (const style of themeStyles) {
      assert.equal(style.hasAttribute('data-css-hash'), false, `${slug}: runtime-owned CSS hash`);
      assert.equal(
        style.hasAttribute('data-token-hash'),
        false,
        `${slug}: runtime-owned token hash`,
      );
      const sheet = postcss.parse(style.textContent);
      sheet.walkRules(rule => {
        for (const selector of rule.selectors) {
          const scoped = selector.match(/^:root\[data-theme=(['"])(light|dark)\1\]\s+(.+)$/);
          assert.ok(scoped, `${slug}: unscoped theme selector ${selector}`);
          assert.ok(
            !selector.includes('data-ant-cssinjs-cache-path'),
            `${slug}: CSS-in-JS cache map included in static tokens`,
          );
          for (const declaration of rule.nodes) {
            assert.equal(declaration.type, 'decl', `${slug}: non-declaration in token rule`);
            assert.ok(
              declaration.prop.startsWith('--'),
              `${slug}: non-variable ${declaration.prop} in token CSS`,
            );
            declarations[scoped[2]].push({
              selector: scoped[3],
              property: declaration.prop,
              value: declaration.value,
            });
          }
        }
      });
      sheet.walkDecls(declaration => {
        assert.ok(declaration.prop.startsWith('--'), `${slug}: non-variable declaration`);
        assert.equal(declaration.parent.type, 'rule', `${slug}: declaration outside token rule`);
      });
    }
    const assertToken = (mode, property, expected, component = false) => {
      const matching = declarations[mode].filter(
        declaration =>
          declaration.property === property &&
          (component
            ? declaration.selector !== '.css-var-atlas-docs'
            : declaration.selector === '.css-var-atlas-docs'),
      );
      assert.ok(matching.length > 0, `${slug}: ${mode} ${property} missing`);
      for (const declaration of matching)
        assert.equal(declaration.value, expected, `${slug}: ${mode} ${property}`);
    };
    assertToken('dark', '--ant-color-border', '#858585');
    assertToken('dark', '--ant-color-text', '#f2f2f2');
    assertToken('dark', '--ant-color-bg-container', '#2c2c2c');
    assertToken('dark', '--ant-color-text-placeholder', '#b8b8b8');
    assertToken('light', '--ant-color-border', '#747166');
    assertToken('light', '--ant-color-text', '#242622');
    assertToken('light', '--ant-color-primary', '#0099ff');
    assertToken('dark', '--ant-color-primary', '#0099ff');
    if (slug === 'input') {
      assertToken('dark', '--ant-input-hover-border-color', 'transparent', true);
      assertToken('dark', '--ant-input-active-border-color', 'transparent', true);
    }
    if (slug === 'form') assertToken('dark', '--ant-form-label-color', '#f2f2f2', true);
  }
});

test('foundation pages keep only the bounded vanilla controller, without React hydration', async () => {
  await init();
  for (const route of foundations) {
    const { document } = pages.get(route);
    assert.equal(document.querySelectorAll('astro-island').length, 0, route);
    assert.equal(
      document.querySelectorAll('style[data-atlas-theme-tokens]').length,
      0,
      `${route}: unnecessary component theme token CSS`,
    );
    assert.equal(
      document.querySelectorAll('style[data-css-hash]').length,
      0,
      `${route}: unnecessary React CSS-in-JS output`,
    );
    assert.equal(document.querySelectorAll('link[rel="modulepreload"]').length, 0, route);
    const modules = [...document.querySelectorAll('script[src]')];
    assert.equal(modules.length, 1, `${route}: only the shared navigation/theme controller`);
    const entry = new URL(modules[0].src);
    assert.match(entry.pathname, /\/_astro\/DocsLayout\.[^/]+\.js$/);
    const visited = new Set();
    const deferred = new Set();
    let initialBytes = 0;
    async function inspect(url) {
      if (visited.has(url.pathname)) return;
      visited.add(url.pathname);
      const source = await readFile(localFile(url), 'utf8');
      initialBytes += Buffer.byteLength(source);
      assert.doesNotMatch(source, /react-dom|astro-island|useSyncExternalStore/, route);
      for (const imported of parse(source)[0]) {
        if (imported.type === 'import-meta') continue;
        assert.ok(imported.specifier, `${route}: unanalyzable controller import`);
        const dependency = new URL(imported.specifier, url);
        assert.equal(dependency.origin, origin);
        if (imported.type === 'dynamic') deferred.add(dependency.pathname);
        else await inspect(dependency);
      }
    }
    await inspect(entry);
    assert.ok(deferred.size > 0, `${route}: Turkish messages must load on demand`);
    for (const path of deferred)
      assert.ok(!visited.has(path), `${route}: deferred language data in initial graph`);
    assert.ok(
      initialBytes <= 8192,
      `${route}: shared vanilla controller exceeds its 8 KiB uncompressed budget (${initialBytes})`,
    );
    assert.deepEqual(
      [...document.querySelectorAll('[data-locale-button]')].map(
        button => button.dataset.localeButton,
      ),
      ['en', 'tr'],
    );
    for (const script of document.querySelectorAll('script')) {
      // Shared navigation/copy enhancements are intentionally small inline vanilla JS.
      assert.doesNotMatch(
        script.textContent,
        /astro-island|astro:load|renderer-url|react-dom|\bimport\s*(?:\(|['"{*])/i,
        route,
      );
    }
  }
});

test('documentation shell ships exact blue brand roles independently of shared preset samples', () => {
  for (const [route, { document }] of pages) {
    const source = document.head.querySelector('style[data-docs-brand-tokens]')?.textContent;
    assert.ok(source, `${route}: documentation brand must be ready before paint`);
    const primary = [];
    const foreground = [];
    postcss.parse(source).walkDecls('--docs-brand-primary', node => primary.push(node.value));
    postcss.parse(source).walkDecls('--docs-brand-on-primary', node => foreground.push(node.value));
    assert.deepEqual(primary, ['#0099ff', '#0099ff']);
    assert.deepEqual(foreground, ['#000000', '#000000']);
  }
  const { document } = pages.get('/components/button/');
  const defaultAction = document.querySelector('.atlas-button[data-docs-brand-default="true"]');
  assert.ok(defaultAction, 'documentation must actually use its default brand');
  assert.match(defaultAction.getAttribute('style'), /--button-face:\s*#0099ff/i);
  const explicitRed = document.querySelector('.atlas-button[data-color-preset="red"]');
  assert.ok(explicitRed, 'explicit Color-system sample must retain its own identity');
  assert.match(explicitRed.getAttribute('style'), /--button-face:\s*#E61A1A/i);
  const setup = pages.get('/getting-started/').document.querySelector('main').textContent;
  assert.match(setup, /<AtlasProvider appearance="docs">/);
  assert.match(setup, /<AtlasButton text="Save" \/>/);
  assert.doesNotMatch(setup, /className="atlas-button"/);
});

test('Color system ships its own island and keeps dynamic preview tokens out of static theme overrides', () => {
  const { document } = pages.get('/color-system/');
  const islands = [...document.querySelectorAll('astro-island')];
  assert.equal(islands.length, 1);
  assert.match(islands[0].getAttribute('component-url'), /ColorSystemDemo/);
  assert.equal(islands[0].getAttribute('component-export'), 'default');
  assert.ok(document.querySelector('head style[data-css-hash]'));
  assert.ok(document.querySelector('.css-var-atlas-color-preview'));
  const staticTokens = document.querySelector('style[data-atlas-theme-tokens]')?.textContent;
  assert.ok(staticTokens?.includes('.css-var-atlas'), 'outer brand still has first-paint tokens');
  assert.doesNotMatch(staticTokens, /\.css-var-atlas-color-preview\b/);
  assert.doesNotMatch(staticTokens, /\.css-var-atlas-color-family-/);
  assert.equal(document.querySelectorAll('[data-color-family-preview]').length, 6);
  const firstPaint = [...document.head.querySelectorAll('style[data-css-hash]')]
    .map(style => style.textContent)
    .join('\n');
  assert.match(firstPaint, /\.css-var-atlas-color-preview\b/);
  assert.match(firstPaint, /\.css-var-atlas-color-family-offset-0\b/);
  assert.ok(document.querySelector('a[aria-current="page"][href="/color-system/"]'));
});

test('Slider master CSS is owned by Slider, Color and inspector routes with native labeled handles in SSR', async () => {
  for (const [route, { document }] of pages) {
    const sources = await Promise.all(
      [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
        readFile(localFile(new URL(link.href)), 'utf8'),
      ),
    );
    assert.equal(
      sources.join('\n').includes('--slider-visible-thumb-size'),
      route === '/components/slider/' ||
        route === '/color-system/' ||
        route === '/components/record-workspace/',
      route,
    );
  }
  const { document } = pages.get('/components/slider/');
  assert.equal(document.querySelectorAll('[data-slider-example]').length, 6);
  assert.ok(document.querySelector('[role="slider"][aria-label="Range start"]'));
  assert.ok(document.querySelector('.ant-slider-vertical [role="slider"]'));
});

test('Color system feature CSS is delivered only by its owning route', async () => {
  for (const [route, { document }] of pages) {
    const sources = await Promise.all(
      [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
        readFile(localFile(new URL(link.href)), 'utf8'),
      ),
    );
    assert.equal(
      sources.join('\n').includes('.color-system-lab'),
      route === '/color-system/',
      route,
    );
  }
});

test('production serves the exact licensed Outfit fonts through local stylesheet URLs', async () => {
  const assets = builtFiles.filter(path => path.endsWith('.woff2'));
  const canonicalFonts = ['outfit-latin.woff2', 'outfit-latin-ext.woff2'];
  assert.equal(assets.length, canonicalFonts.length);
  const fontUrls = [...css.matchAll(/url\((['"]?)([^)'"\s]+\.woff2)\1\)/g)].map(match => match[2]);
  assert.equal(new Set(fontUrls).size, canonicalFonts.length);
  for (const name of canonicalFonts) {
    const base = name.replace('.woff2', '');
    const asset = assets.find(path => new RegExp(`${base}\\.[^.]+\\.woff2$`).test(path));
    assert.ok(asset, `Missing built font: ${name}`);
    const [actual, canonical] = await Promise.all([
      readFile(asset),
      readFile(resolve(root, 'src/assets', name)),
    ]);
    assert.equal(actual.subarray(0, 4).toString(), 'wOF2');
    const sha = bytes => createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha(actual), sha(canonical), name);
    assert.ok(
      fontUrls.some(value => {
        const url = new URL(value, origin + [...stylesheets.keys()][0]);
        assert.equal(url.origin, origin, `Remote font: ${value}`);
        return localFile(url) === asset;
      }),
      `${name}: CSS does not reference built font`,
    );
  }
});

test('generated documentation decisions and experiments equal their canonical model', async () => {
  const source = (
    await Promise.all(
      ['decisions.js', 'palettes.js', 'icons.js'].map(name =>
        readFile(resolve(root, 'src/model', name), 'utf8'),
      ),
    )
  ).join('\n');
  const canonical = JSON.parse(
    vm.runInNewContext(
      source +
        '\nJSON.stringify({ decisions: COMPONENT_DECISIONS, experiments: BUTTON_EXPERIMENTS, palettes: PALETTES, tones: TONE_PALETTES, icons: ICON_CATALOG })',
      Object.create(null),
      { timeout: 1000 },
    ),
  );
  const generated = JSON.parse(await readFile(resolve(root, 'docs/src/data/atlas.json'), 'utf8'));
  for (const [key, value] of Object.entries(canonical))
    assert.deepEqual(generated[key], value, key);
  const compiledPresets = await build({
    entryPoints: [resolve(root, 'docs/src/data/button-palette.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { buttonColorPresets } = await import(
    'data:text/javascript;base64,' +
      Buffer.from(compiledPresets.outputFiles[0].contents).toString('base64')
  );
  const cells = [...pages.get('/tokens/').document.querySelectorAll('[data-token-preset]')];
  assert.equal(cells.length, 24);
  assert.equal(cells.filter(cell => cell.dataset.tokenPreset === 'purple').length, 1);
  assert.equal(
    cells.some(cell => cell.dataset.tokenPreset === 'violet-magenta'),
    false,
  );
  for (const [index, preset] of buttonColorPresets.entries()) {
    assert.equal(cells[index].dataset.tokenPreset, preset.value);
    assert.equal(cells[index].querySelector('code').textContent, preset.color);
    assert.ok(cells[index].querySelector('.swatch').getAttribute('style').includes(preset.color));
  }
  const decisionText = pages.get('/decisions/').document.querySelector('main').textContent;
  for (const variant of canonical.decisions.buttons.radius_variants)
    assert.ok(decisionText.includes(variant.label));
  for (const variant of canonical.decisions.buttons.size_variants)
    assert.ok(decisionText.includes(`${variant.height_px} px`));
  for (const variant of canonical.decisions.buttons.width_variants)
    assert.ok(decisionText.includes(variant.label));
  for (const variant of canonical.decisions.buttons.state_variants)
    assert.ok(decisionText.includes(variant.label), `Approved state missing: ${variant.label}`);
});

test('published licenses retain complete canonical font and icon notices', async () => {
  const generated = JSON.parse(await readFile(resolve(root, 'docs/src/data/atlas.json'), 'utf8'));
  const fontSource = await readFile(resolve(root, 'src/styles/fonts.css'), 'utf8');
  const fontLicense = fontSource.match(/\/\*([\s\S]*?)\*\//)?.[1].trim();
  assert.match(fontLicense ?? '', /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.equal(generated.outfitLicense, fontLicense);
  const notices = [...pages.get('/licenses/').document.querySelectorAll('pre code')].map(
    element => element.textContent,
  );
  assert.ok(notices.includes(fontLicense), 'Complete Outfit license missing from production HTML');
  for (const library of Object.values(generated.icons)) {
    // HTML parsing normalizes CRLF to LF; this must not be mistaken for a lost notice.
    assert.ok(
      notices.includes(library.license.replaceAll('\r\n', '\n')),
      `Complete ${library.label} notice missing`,
    );
  }
});

test('static documentation typography uses native pixels, 14px minimum and Outfit Regular400', () => {
  postcss
    .parse(css)
    .walkDecls(declaration =>
      assert.doesNotMatch(
        declaration.value,
        /-?\d*\.?\d+rem\b/,
        'documentation build emits pixel dimensions',
      ),
    );
  postcss.parse(css).walkDecls('font-size', declaration => {
    if (declaration.parent.selectors.some(selector => selector === 'html' || selector === ':root'))
      assert.match(
        declaration.value,
        /^(?:100%|inherit|unset|revert(?:-layer)?)$/,
        'root size stays user-controlled',
      );
    if (/^\d+(?:\.\d+)?px$/.test(declaration.value))
      assert.ok(parseFloat(declaration.value) >= 14, 'authored readable text is at least14px');
  });
  for (const [route, { document }] of pages) {
    const source = document.querySelector('style[data-docs-typography]')?.textContent;
    assert.ok(source, `${route}: typography must be available before hydration`);
    let tokens;
    postcss.parse(source).walkRules(rule => {
      if (rule.selectors.includes("body[data-atlas-surface='docs']"))
        tokens = Object.fromEntries(
          rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]),
        );
    });
    assert.equal(tokens['--text'], '14px', route);
    assert.equal(tokens['--text-large'], '16px', route);
    assert.equal(Number(tokens['--line-height']) * 14, 22, route);
    assert.equal(tokens['--font-weight-body'], '400', route);
    assert.equal(tokens['--font-weight-min'], '300', route);
    assert.equal(tokens['--font-weight-light'], '300', route);
    assert.equal(tokens['--font-weight-label'], '400', route);
    assert.match(tokens['--font-body'], /^Outfit,/, route);
    assert.equal(document.documentElement.style.fontSize, '', `${route}: inline root override`);
  }
  // Source/production checks do not establish computed fonts or rendered geometry.
});

test('workspace feature CSS is linked only by the owning documentation routes', async () => {
  const owners = new Map([
    ['data-table', '.collection-toolbar'],
    ['collection-views', '.collection-toolbar'],
    ['record-details', '.workspace-details'],
    ['record-forms', '.record-form-demo'],
    ['record-workspace', '.kit-connected-inspector'],
  ]);
  for (const [route, { document }] of pages) {
    const sources = await Promise.all(
      [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
        readFile(localFile(new URL(link.href)), 'utf8'),
      ),
    );
    const pageCss = sources.join('\n');
    const slug = route.split('/')[2];
    if (owners.has(slug)) {
      assert.ok(pageCss.includes('.workspace-lab'), route + ': shared workspace styles missing');
      assert.ok(pageCss.includes(owners.get(slug)), route + ': own feature styles missing');
      for (const marker of new Set(owners.values()))
        if (marker !== owners.get(slug))
          assert.ok(!pageCss.includes(marker), route + ': unrelated workspace feature CSS');
    } else assert.ok(!pageCss.includes('.workspace-lab'), route + ': unnecessary workspace CSS');
  }
});

test('connected workspace ships one themed consumer and distinguishes Atlas props from native settings', () => {
  const { document } = pages.get('/components/record-workspace/');
  assert.equal(document.querySelectorAll('.atlas-demo').length, 1);
  assert.ok(document.querySelector('[data-workspace="connected-kit"]'));
  assert.ok(document.querySelector('[data-connected-schema="orders"]'));
  assert.match(document.querySelector('#api').textContent, /RecordCollection<R>/);
  for (const slug of ['data-table', 'collection-views', 'record-forms', 'record-details']) {
    const api = pages.get(`/components/${slug}/`).document.querySelector('#api');
    const tables = [...api.querySelectorAll('table')];
    assert.equal(tables.length, 2, `${slug}: Atlas and AntD APIs must remain separate`);
    assert.match(api.textContent, /Underlying Ant Design API/);
    assert.match(tables[0].textContent, /RecordCollection|RecordForm|RecordDisplay/);
    assert.doesNotMatch(tables[0].textContent, /destroyOnHidden|Form\.form|rowSelection/);
  }
  const detailApi = pages.get('/components/record-details/').document.querySelector('#api');
  assert.match(detailApi.textContent, /false \(AntD\); true \(example\)/);
});

test('documentation outer layout uses available width without a desktop content cap', async () => {
  const sheet = postcss.parse(await readFile(resolve(root, 'docs/src/styles/docs.css'), 'utf8'));
  const selectors = new Set(['.docs-header', '.docs-shell', '.docs-footer', 'main']);
  const seen = new Set();
  sheet.walkRules(rule => {
    for (const selector of rule.selectors) {
      if (!selectors.has(selector)) continue;
      seen.add(selector);
      for (const declaration of rule.nodes)
        if (
          declaration.type === 'decl' &&
          ['max-width', 'max-inline-size'].includes(declaration.prop)
        ) {
          assert.ok(
            ['none', '100%'].includes(declaration.value),
            selector + ': finite outer width cap ' + declaration.value,
          );
        }
    }
  });
  assert.deepEqual(seen, selectors);
  assert.ok(
    sheet.toString().includes('minmax(0, 1fr)'),
    'fluid grid track must retain its overflow-safe minimum',
  );
});

test('Button catalog ships one linked reading order and its layout CSS only on its route', () => {
  for (const [route, { document }] of pages) {
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
      stylesheets.get(new URL(link.href).pathname),
    );
    assert.equal(
      sheets.some(source => source.includes('.button-catalog-section')),
      route === '/components/button/',
      route + ': Button layout stylesheet ownership',
    );
  }
  const document = pages.get('/components/button/').document;
  const catalog = document.querySelector('[data-button-catalog]');
  assert.ok(catalog, 'organized examples exist in SSR, before hydration');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  const targets = [...catalog.querySelectorAll('nav a')].map(link => link.hash);
  assert.equal(sections.length, 5);
  assert.deepEqual(
    targets,
    sections.map(section => '#' + section.id),
  );
  assert.equal(document.querySelectorAll('.playground-preview').length, 1);
  assert.equal(sections[4].querySelectorAll('[data-approved-axis="palette"]').length, 24);
});

test('Data entry catalogs ship unique example anchors and their layout CSS only on owning routes', () => {
  const slugs = ['input', 'select', 'checkbox', 'radio', 'switch', 'slider', 'form'];
  for (const [route, { document }] of pages) {
    const ownsLayout = slugs.some(slug => route === `/components/${slug}/`);
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
      stylesheets.get(new URL(link.href).pathname),
    );
    assert.equal(
      sheets.some(source => source.includes('.data-entry-section')),
      ownsLayout,
      route + ': Data entry layout ownership',
    );
    const catalog = document.querySelector('[data-entry-catalog]');
    assert.equal(Boolean(catalog), ownsLayout, route + ': SSR composition boundary');
    if (!catalog) continue;
    const sections = [...catalog.querySelectorAll(':scope > section')];
    assert.deepEqual(
      [...catalog.querySelectorAll(':scope > nav a')].map(n => n.hash),
      sections.map(n => '#' + n.id),
    );
    for (const section of sections) {
      assert.equal(document.querySelectorAll('#' + section.id).length, 1);
      assert.ok(document.getElementById(section.getAttribute('aria-labelledby')));
    }
  }
});

test('workspace SSR status and currency Pills have stable distinct colors across collection routes', () => {
  let shared;
  for (const route of ['/components/data-table/', '/components/collection-views/']) {
    const document = pages.get(route).document;
    const statuses = new Map();
    for (const pill of document.querySelectorAll('[data-collection-view] .atlas-pill')) {
      const text = pill.textContent.trim();
      const color = pill.getAttribute('data-pill-color');
      if (statuses.has(text)) assert.equal(color, statuses.get(text), route + ': equal status');
      statuses.set(text, color);
    }
    assert.equal(statuses.size, 4);
    assert.equal(new Set(statuses.values()).size, 4, route + ': distinct statuses');
    const totals = [...document.querySelectorAll('.atlas-pill')]
      .filter(pill => /^(USD|EUR):/.test(pill.textContent.trim()))
      .map(pill => pill.getAttribute('data-pill-color'));
    assert.equal(totals.length, 2);
    assert.equal(
      new Set([...statuses.values(), ...totals]).size,
      6,
      route + ': distinct currencies',
    );
    if (shared) assert.deepEqual(statuses, shared);
    shared = statuses;
  }
});

test('Pill catalog owns its CSS, renders linked SSR sections and defers random colors until client commit', () => {
  for (const [route, { document }] of pages) {
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
      stylesheets.get(new URL(link.href).pathname),
    );
    assert.equal(
      sheets.some(source => source.includes('.pill-section')),
      route === '/components/pill/',
      route + ': Pill layout ownership',
    );
  }
  const document = pages.get('/components/pill/').document;
  const catalog = document.querySelector('.pill-catalog');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.equal(sections.length, 6);
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  for (const section of sections) {
    assert.equal(document.querySelectorAll('#' + section.id).length, 1);
    assert.ok(document.getElementById(section.getAttribute('aria-labelledby')));
  }
  const automatic = [...catalog.querySelectorAll('[data-pill-automatic] .atlas-pill')];
  assert.equal(automatic.length, 3);
  assert.ok(
    automatic.every(pill => !pill.hasAttribute('data-pill-color')),
    'random values are absent from SSR and initial hydration',
  );
  assert.ok(automatic.every(pill => pill.dataset.pillVariant === 'filled'));
});

test('Card catalog owns its purpose layout and ships useful Entity/Metric SSR before optional GenUI', () => {
  for (const [route, { document }] of pages) {
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
      stylesheets.get(new URL(link.href).pathname),
    );
    assert.equal(
      sheets.some(source => source.includes('.card-section')),
      route === '/components/card/',
      route + ': Card catalog CSS ownership',
    );
  }
  const document = pages.get('/components/card/').document;
  const catalog = document.querySelector('[data-card-preview]');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.deepEqual(
    sections.map(section => section.id),
    ['card-foundations', 'card-catalog', 'card-interactions', 'card-states', 'card-genui'],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  for (const section of sections) {
    assert.equal(document.querySelectorAll('#' + section.id).length, 1);
    assert.ok(document.getElementById(section.getAttribute('aria-labelledby')));
  }
  assert.equal(catalog.querySelector('#card-catalog').dataset.purposeCount, '23');
  assert.equal(catalog.querySelector('#card-catalog').dataset.recipeCount, '37');
  assert.ok(catalog.querySelector('[data-card-main] .atlas-card[data-card-kind="entity"]'));
  assert.ok(catalog.querySelector('#card-foundations .atlas-card[data-card-kind="metric"]'));
  assert.ok(catalog.querySelector('#card-interactions input'));
  assert.equal(catalog.querySelectorAll('.atlas-card .atlas-card').length, 0, 'no nested Card');
  assert.equal(
    catalog.querySelectorAll('.atlas-genui-runtime').length,
    0,
    'optional GenUI runtime is absent from SSR',
  );
  assert.ok(
    [...catalog.querySelectorAll('button')].some(button =>
      button.textContent.includes('Open GenUI lab'),
    ),
  );
});

test('Splitter and Breadcrumb assets stay with their owning routes and retain native SSR structure', async () => {
  const workspace = new Set([
    'data-table',
    'collection-views',
    'record-details',
    'record-forms',
    'record-workspace',
  ]);
  for (const [route, { document }] of pages) {
    const css = (
      await Promise.all(
        [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
          readFile(localFile(new URL(link.href)), 'utf8'),
        ),
      )
    ).join('\n');
    const slug = route.match(/^\/components\/([^/]+)\/$/)?.[1];
    assert.equal(
      css.includes('.atlas-dropdown-trigger'),
      slug === 'dropdown',
      route + ': Dropdown master asset',
    );
    assert.equal(
      css.includes('.dropdown-catalog'),
      slug === 'dropdown',
      route + ': Dropdown catalog asset',
    );
    assert.equal(
      css.includes('--splitter-gutter:'),
      slug === 'splitter' || workspace.has(slug),
      route + ': shared Splitter asset',
    );
    assert.equal(
      css.includes('.splitter-catalog'),
      slug === 'splitter',
      route + ': Splitter catalog asset',
    );
    assert.equal(
      css.includes('.atlas-breadcrumb-nav'),
      slug === 'breadcrumb',
      route + ': Breadcrumb asset',
    );
    assert.equal(
      css.includes('.breadcrumb-catalog'),
      slug === 'breadcrumb',
      route + ': Breadcrumb catalog asset',
    );
    if (slug === 'splitter' || workspace.has(slug)) {
      const native = document.querySelector('[data-atlas-splitter] .ant-splitter');
      assert.ok(native, route + ': native Splitter first paint');
      assert.equal(native.querySelectorAll(':scope > .ant-splitter-panel').length, 2);
      assert.equal(native.closest('[data-atlas-splitter]').dataset.splitterOrientation, 'vertical');
    }
  }
  const breadcrumb = pages.get('/components/breadcrumb/').document;
  assert.equal(breadcrumb.querySelectorAll('.ant-breadcrumb[aria-label]').length, 2);
  assert.equal(
    breadcrumb.querySelectorAll('.atlas-breadcrumb-current[aria-current="page"]').length,
    2,
  );
  assert.ok(breadcrumb.querySelector('button[aria-haspopup="menu"]'));
});

test('optional GenUI remains outside initial Card/workspace graphs and preload hints', async () => {
  await init();
  const lab = builtFiles.find(path => /GenUICardLab\.[^/]+\.js$/.test(path));
  assert.ok(lab, 'the optional native SDK lab is built');
  const labUrl = '/' + relative(dist, lab).split(sep).join('/');
  for (const slug of ['card', 'data-table', 'collection-views', 'record-workspace']) {
    const document = pages.get(`/components/${slug}/`).document;
    const island = document.querySelector('astro-island');
    const visited = new Set();
    const deferred = new Set();
    async function walk(url) {
      if (visited.has(url.pathname)) return;
      visited.add(url.pathname);
      for (const imported of parse(await readFile(localFile(url), 'utf8'))[0]) {
        if (imported.type === 'import-meta') continue;
        assert.ok(imported.specifier, 'analyzable built import');
        const next = new URL(imported.specifier, url);
        if (imported.type === 'dynamic') deferred.add(next.pathname);
        else await walk(next);
      }
    }
    await walk(new URL(island.getAttribute('component-url'), origin));
    assert.ok(!visited.has(labUrl), `${slug}: SDK lab is absent from initial static graph`);
    assert.equal(deferred.has(labUrl), slug === 'card', `${slug}: only Card owns the deferred lab`);
    for (const hint of document.querySelectorAll('link[rel="modulepreload"],link[rel="prefetch"]'))
      assert.notEqual(new URL(hint.href).pathname, labUrl, 'the optional lab is not preloaded');
  }
});

test('Pagination SSR retains boundary pairs and owns its catalog while workspace shares the master', async () => {
  for (const [route, { document }] of pages) {
    const sheets = (
      await Promise.all(
        [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
          readFile(localFile(new URL(link.href)), 'utf8'),
        ),
      )
    ).join('\n');
    assert.equal(
      sheets.includes('.atlas-pagination-current-marker'),
      ['/components/pagination/', '/components/record-workspace/'].includes(route),
      route + ': pagination master ownership',
    );
    assert.equal(
      sheets.includes('.pagination-catalog'),
      route === '/components/pagination/',
      route + ': pagination catalog ownership',
    );
  }
  const document = pages.get('/components/pagination/').document;
  const primary = document.querySelector('[data-pagination-primary]');
  assert.deepEqual(
    [...primary.querySelectorAll('[data-pagination-page]')].map(node => node.textContent),
    ['1', '2', '41', '42', '43', '49', '50'],
  );
  assert.equal(primary.querySelectorAll('[aria-current="page"]').length, 1);
  assert.match(primary.querySelector('[role="status"]').textContent, /411–420 of 500/);
  for (const name of ['First page', 'Previous page', 'Next page', 'Last page'])
    assert.ok(primary.querySelector(`button[aria-label="${name}"]`));
  assert.equal(document.querySelectorAll('[data-pagination-surface]').length, 5);
  assert.equal(
    document.querySelectorAll('select').length,
    0,
    'page-size control uses the branded native AntD popup',
  );
  assert.equal(
    document.querySelector('[data-tweaker-trigger]').getAttribute('aria-expanded'),
    'false',
  );
});

test('Steps SSR keeps a mobile-first sequence and owns only its native skin and catalog assets', async () => {
  for (const [route, { document }] of pages) {
    const sheets = (
      await Promise.all(
        [...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
          readFile(localFile(new URL(link.href)), 'utf8'),
        ),
      )
    ).join('\n');
    assert.equal(
      sheets.includes('.atlas-steps-sr-status'),
      route === '/components/steps/',
      route + ': Steps master ownership',
    );
    assert.equal(
      sheets.includes('.steps-catalog'),
      route === '/components/steps/',
      route + ': Steps catalog ownership',
    );
  }
  const document = pages.get('/components/steps/').document;
  const primary = document.querySelector('[data-steps-primary]');
  assert.ok(primary.querySelector('.ant-steps.ant-steps-vertical'));
  assert.equal(primary.querySelectorAll('[aria-current="step"]').length, 1);
  assert.equal(primary.querySelectorAll('.ant-steps-item').length, 3);
  for (const id of ['steps-setup', 'steps-layouts', 'steps-recovery', 'steps-navigation'])
    assert.ok(document.getElementById(id));
  assert.ok(document.querySelector('[data-steps-workspace-name]'));
  assert.equal(
    document.querySelector('[data-tweaker-trigger]').getAttribute('aria-expanded'),
    'false',
  );
  assert.equal(document.querySelectorAll('select').length, 0);
});

test('AutoComplete SSR keeps labeled editable fields and owns its master and catalog assets', () => {
  for (const [route, { document }] of pages) {
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map(link => stylesheets.get(new URL(link.href).pathname))
      .join('\n');
    assert.equal(
      sheets.includes('.atlas-autocomplete-result'),
      route === '/components/autocomplete/',
      route + ': AutoComplete master ownership',
    );
    assert.equal(
      sheets.includes('.autocomplete-catalog'),
      route === '/components/autocomplete/',
      route + ': AutoComplete catalog ownership',
    );
  }
  const document = pages.get('/components/autocomplete/').document;
  const catalog = document.querySelector('[data-autocomplete-catalog]');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.deepEqual(
    sections.map(section => section.id),
    [
      'autocomplete-discover',
      'autocomplete-patterns',
      'autocomplete-recovery',
      'autocomplete-availability',
    ],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  const fields = [...catalog.querySelectorAll('[data-autocomplete-field]')];
  assert.equal(fields.length, 7);
  for (const field of fields) {
    const input = field.querySelector('input[role="combobox"]');
    assert.ok(input, 'One native editable combobox');
    assert.equal(field.querySelector('label').htmlFor, input.id);
    for (const id of input.getAttribute('aria-describedby').split(' '))
      assert.ok(document.getElementById(id), 'Linked guidance exists before hydration');
  }
  const invalid = document.querySelector('[data-autocomplete-example="error"]');
  assert.equal(invalid.querySelector('input').getAttribute('aria-invalid'), 'true');
  assert.match(invalid.querySelector('[role="alert"]').textContent, /Enter a complete address/);
  const disabled = document.querySelector('[data-autocomplete-example="disabled"]');
  assert.equal(disabled.querySelector('input').disabled, true);
  assert.equal(disabled.querySelector('input').value, 'Atlas Studio');
  assert.match(disabled.textContent, /Team assignment is unavailable/);
  assert.equal(document.querySelectorAll('select').length, 0);
  assert.equal(
    document.querySelector('[data-tweaker-trigger]').getAttribute('aria-expanded'),
    'false',
  );
  assert.equal(document.querySelector('[data-autocomplete-context]').dataset.selectedKey, '');
  assert.equal(document.querySelector('[data-autocomplete-context] a'), null);
});
