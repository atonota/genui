import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const root = fileURLToPath(new URL('../../', import.meta.url));
const result = await build({
  entryPoints: [resolve(root, 'docs/src/i18n.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node24',
});
const moduleUrl =
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64');
let instance = 0;

async function environment(t) {
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><body>
    <h1 data-i18n="Language">Language</h1>
    <input data-i18n-placeholder="Search" placeholder="Search" aria-label="Language" data-i18n-aria-label="Language">
    <p data-i18n="Unknown message">Unknown message</p>
  </body></html>`,
    { url: 'https://atlas.test/' },
  );
  const saved = new Map();
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    Event: dom.window.Event,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  }
  t.after(() => {
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { window: dom.window, i18n: await import(moduleUrl + '#' + ++instance) };
}

test('English is the deterministic default; Turkish changes text without replacing focused inputs', async t => {
  const { window, i18n } = await environment(t);
  const input = window.document.querySelector('input');
  input.value = 'Draft that must survive';
  input.focus();
  input.setSelectionRange(2, 9);
  let notifications = 0;
  const unsubscribe = i18n.subscribeLocale(() => notifications++);
  assert.equal(i18n.getLocaleSnapshot(), 'en');
  assert.equal(i18n.getServerLocaleSnapshot(), 'en');
  assert.equal(i18n.translate('Language'), 'Language');
  await i18n.setLocale('tr');
  assert.equal(i18n.getLocaleSnapshot(), 'tr');
  assert.equal(window.document.querySelector('h1').textContent, 'Dil');
  assert.equal(input.getAttribute('aria-label'), 'Dil');
  assert.equal(input.placeholder, 'Arama');
  assert.equal(window.document.querySelector('p').textContent, 'Unknown message');
  assert.equal(i18n.translate('Draft {count}', { count: 3 }), 'Draft 3');
  assert.equal(i18n.translate('Record workspace'), 'Kayıt çalışma alanı');
  assert.equal(
    i18n.translate('Amount'),
    'Tutar',
    'Color previews preserve monetary workspace terminology',
  );
  assert.equal(i18n.translate('Preview amount'), 'Önizleme miktarı');
  assert.equal(i18n.translate('Underlying Ant Design API'), 'Alttaki Ant Design API’si');
  for (const message of ['constructor', 'toString', '__proto__'])
    assert.equal(i18n.translate(message), message);
  assert.equal(window.localStorage.getItem(i18n.LOCALE_STORAGE_KEY), 'tr');
  assert.equal(window.document.activeElement, input);
  assert.equal(window.document.querySelector('input'), input);
  assert.equal(input.value, 'Draft that must survive');
  assert.deepEqual([input.selectionStart, input.selectionEnd], [2, 9]);
  assert.equal(i18n.formatNumber(1234.5), new Intl.NumberFormat('tr').format(1234.5));
  await i18n.setLocale('en');
  assert.equal(input.placeholder, 'Search');
  assert.equal(window.document.activeElement, input);
  assert.equal(notifications, 2);
  unsubscribe();
  await i18n.setLocale('en');
  assert.equal(notifications, 2);
});

test('search normalization preserves English component identifiers and Turkish labels', async t => {
  const { i18n } = await environment(t);
  for (const value of ['Input', 'input', 'INPUT', 'İNPUT', 'ınput']) {
    assert.equal(i18n.normalizeSearch(value), 'input');
  }
  assert.equal(i18n.normalizeSearch('Mühendislik'), 'muhendislik');
  assert.equal(i18n.normalizeSearch('  Çalışma alanı '), 'calisma alani');
});

test('latest language choice wins during lazy loading; storage failure keeps language switching usable', async t => {
  const { window, i18n } = await environment(t);
  const pending = i18n.setLocale('tr');
  await i18n.setLocale('en');
  await pending;
  assert.equal(i18n.getLocaleSnapshot(), 'en');
  window.localStorage.setItem(i18n.LOCALE_STORAGE_KEY, 'tr');
  await i18n.restoreLocale();
  assert.equal(i18n.getLocaleSnapshot(), 'tr');
  Object.defineProperty(window, 'localStorage', {
    get() {
      throw new Error('Storage blocked');
    },
  });
  await assert.doesNotReject(i18n.setLocale('en'));
  await assert.doesNotReject(i18n.restoreLocale());
  assert.equal(i18n.getLocaleSnapshot(), 'en');
});

test('skip-link target owns one immediate, non-surrounding focus marker', async () => {
  const css = await readFile(resolve(root, 'docs/src/styles/docs.css'), 'utf8');
  assert.match(
    css,
    /main:focus-visible h1\s*\{[^}]*text-decoration:\s*underline;[^}]*text-decoration-thickness:\s*var\(--focus-marker\)/,
  );
});
