import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Previous namespace identifiers, built from character codes like the helpers themselves.
const former = String.fromCharCode(97, 116, 108, 97, 115);
const formerPackage = String.fromCharCode(103, 101, 110, 117, 105);
const formerPascal = String.fromCharCode(65, 116, 108, 97, 115);
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Storage API only; no business hooks. Missing clear() makes any bulk wipe throw.
function fakeStorage(entries, { failWrites = false } = {}) {
  const items = new Map(entries);
  return {
    items,
    getItem: key => (items.has(key) ? items.get(key) : null),
    setItem(key, value) {
      if (failWrites) throw new Error('QuotaExceededError');
      items.set(key, String(value));
    },
    removeItem: key => {
      items.delete(key);
    },
  };
}

// Bundles real sources with esbuild; `contents` re-exports the modules a step needs.
async function compiled(contents) {
  const result = await build({
    absWorkingDir: projectDirectory,
    stdin: { contents, resolveDir: projectDirectory, loader: 'ts' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    loader: { '.css': 'empty' },
  });
  const source = Buffer.from(result.outputFiles[0].contents).toString('base64');
  return import(`data:text/javascript;base64,${source}`);
}

test('saved preferences move to the genux namespace without loss or renewal', async () => {
  const { formerNamespaceName, readMigratedItem } = await compiled(
    `export * from './docs/src/storage-migration.ts';`,
  );
  const savedAt = 1_760_000_000_000;
  const envelope = `{"format":"${former}-theme-builder","version":2,"savedAt":${savedAt},"expiresAt":${savedAt + RETENTION_MS},"recipe":{"version":1}}`;
  const local = fakeStorage([
    [`${former}-theme-builder-v1`, envelope],
    ['genux-theme', 'dark'],
    [`${former}-theme`, 'light'],
    [`${formerPackage}-package-manager`, 'pnpm'],
    [`${former}-unlisted`, 'keep'],
    ['unrelated', 'keep'],
  ]);

  // Exact bytes and the original expiry are copied, then the previous key is removed.
  assert.equal(readMigratedItem(local, 'genux-theme-builder-v1'), envelope);
  assert.equal(local.items.get('genux-theme-builder-v1'), envelope);
  assert.equal(
    JSON.parse(local.items.get('genux-theme-builder-v1')).expiresAt,
    savedAt + RETENTION_MS,
  );
  assert.equal(local.items.has(`${former}-theme-builder-v1`), false);
  // The copied envelope keeps its previous format name, which the store maps back.
  assert.equal(formerNamespaceName('genux-theme-builder'), `${former}-theme-builder`);
  // An existing canonical value wins; neither key is rewritten.
  assert.equal(readMigratedItem(local, 'genux-theme'), 'dark');
  assert.equal(local.items.get('genux-theme'), 'dark');
  assert.equal(local.items.get(`${former}-theme`), 'light');
  assert.equal(readMigratedItem(local, 'genux-package-manager'), 'pnpm');
  assert.equal(local.items.get('genux-package-manager'), 'pnpm');
  assert.equal(local.items.has(`${formerPackage}-package-manager`), false);
  // Keys outside the approved list neither migrate nor change.
  assert.equal(readMigratedItem(local, 'genux-unlisted'), null);
  assert.equal(local.items.get(`${former}-unlisted`), 'keep');
  assert.equal(local.items.get('unrelated'), 'keep');

  const session = fakeStorage([[`${former}-docs-nav-scroll`, '120']]);
  assert.equal(readMigratedItem(session, 'genux-docs-nav-scroll'), '120');
  assert.deepEqual([...session.items], [['genux-docs-nav-scroll', '120']]);

  // A failed write keeps the previous value and still serves it.
  const blocked = fakeStorage([[`${former}-locale`, 'tr']], { failWrites: true });
  assert.equal(readMigratedItem(blocked, 'genux-locale'), 'tr');
  assert.deepEqual([...blocked.items], [[`${former}-locale`, 'tr']]);

  // The classic builder helper keeps saved designs and locale with the same rules.
  const classic = {};
  runInNewContext(
    await readFile(resolve(projectDirectory, 'src/shared/storage-migration.js'), 'utf8'),
    classic,
  );
  const designs = JSON.stringify([{ name: 'Saved', config: {} }]);
  const classicLocal = fakeStorage([
    [`buton-${former}i-v1`, designs],
    ['unrelated', 'keep'],
  ]);
  assert.equal(classic.migratedStorageItem(classicLocal, 'buton-genuxi-v1'), designs);
  assert.deepEqual(
    [...classicLocal.items],
    [
      ['unrelated', 'keep'],
      ['buton-genuxi-v1', designs],
    ],
  );
  const classicBlocked = fakeStorage([[`${former}-locale`, 'tr']], { failWrites: true });
  assert.equal(classic.migratedStorageItem(classicBlocked, 'genux-locale'), 'tr');
  assert.deepEqual([...classicBlocked.items], [[`${former}-locale`, 'tr']]);

  // The real theme store and definition store, bundled from source, follow the same rules.
  const app = await compiled(
    [
      `export { getThemeBuilderSnapshot, initializeThemeBuilder, resetThemeBuilder } from './docs/src/theme-builder/store.ts';`,
      `export { createDefaultRecipe } from './docs/src/theme-builder/model.ts';`,
      `export { createDefinitionStore, createRecordedQueryDefinition } from './docs/src/genux/definitions.ts';`,
    ].join(' '),
  );
  const recipe = app.createDefaultRecipe();
  const now = Date.now();
  const wrap = format =>
    JSON.stringify({ format, version: 2, savedAt: now, expiresAt: now + RETENTION_MS, recipe });
  const page = { localStorage: null, addEventListener() {}, removeEventListener() {} };
  globalThis.window = page;
  globalThis.document = new JSDOM('<!doctype html><html><body></body></html>').window.document;
  try {
    // An explicit reset clears the canonical and the coexisting previous key, nothing else.
    page.localStorage = fakeStorage([
      ['genux-theme-builder-v1', wrap('genux-theme-builder')],
      [`${former}-theme-builder-v1`, wrap(`${former}-theme-builder`)],
      ['unrelated', 'keep'],
    ]);
    let release = app.initializeThemeBuilder();
    assert.deepEqual(app.getThemeBuilderSnapshot(), recipe);
    app.resetThemeBuilder();
    release();
    assert.deepEqual([...page.localStorage.items], [['unrelated', 'keep']]);
    release = app.initializeThemeBuilder();
    assert.equal(app.getThemeBuilderSnapshot(), null);
    release();

    // After a failed migration write the previous envelope still applies; a reset clears it.
    page.localStorage = fakeStorage(
      [[`${former}-theme-builder-v1`, wrap(`${former}-theme-builder`)]],
      { failWrites: true },
    );
    release = app.initializeThemeBuilder();
    assert.deepEqual(app.getThemeBuilderSnapshot(), recipe);
    assert.deepEqual(
      [...page.localStorage.items].map(([name]) => name),
      [`${former}-theme-builder-v1`],
    );
    app.resetThemeBuilder();
    release();
    assert.equal(page.localStorage.items.size, 0);
    release = app.initializeThemeBuilder();
    assert.equal(app.getThemeBuilderSnapshot(), null);
    release();
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }

  // Saved definitions keep every field; only previous catalog and component names are mapped.
  const current = app.createRecordedQueryDefinition('orders');
  const previous = JSON.stringify([
    {
      ...current,
      catalogId: current.catalogId.replace('genux-', `${former}-`),
      components: current.components.map(node => ({
        ...node,
        component: node.component.replace('GenUX', formerPascal),
      })),
    },
  ]);
  const definitionKey = scope => `genux-card-definitions-v1-panel-${scope}`;
  const formerKey = scope => `${former}-card-definitions-v1-panel-${scope}`;
  const open = (scopeId, entries, options) => {
    const storage = fakeStorage(entries, options);
    const store = app.createDefinitionStore({ audience: 'panel', scopeId, storage });
    return { items: storage.items, list: store.list(), error: store.getError() };
  };
  let opened = open('LocalScope', [[formerKey('LocalScope'), previous]]);
  assert.deepEqual(opened.list, [current]);
  assert.equal(opened.error, null);
  assert.equal(opened.items.get(definitionKey('LocalScope')), JSON.stringify([current]));
  assert.equal(opened.items.get(formerKey('LocalScope')), previous);
  // The documentation lab scope also reads its previous PascalCase scope.
  const labScope = 'GenUXReusableQueryCards';
  opened = open(labScope, [[formerKey(`${formerPascal}ReusableQueryCards`), previous]]);
  assert.deepEqual(opened.list, [current]);
  assert.equal(opened.items.get(definitionKey(labScope)), JSON.stringify([current]));
  // A canonical value wins, and a malformed one never falls back to the previous key.
  opened = open('LocalScope', [
    [definitionKey('LocalScope'), '[]'],
    [formerKey('LocalScope'), previous],
  ]);
  assert.deepEqual(opened.list, []);
  assert.equal(opened.items.get(definitionKey('LocalScope')), '[]');
  opened = open('LocalScope', [
    [definitionKey('LocalScope'), '{'],
    [formerKey('LocalScope'), previous],
  ]);
  assert.deepEqual(opened.list, []);
  assert.notEqual(opened.error, null);
  assert.equal(opened.items.get(definitionKey('LocalScope')), '{');
  // An invalid previous collection is neither copied nor removed.
  const invalid = previous.replace(`${formerPascal}Collection`, `${formerPascal}Unknown`);
  assert.notEqual(invalid, previous);
  opened = open('LocalScope', [[formerKey('LocalScope'), invalid]]);
  assert.deepEqual(opened.list, []);
  assert.notEqual(opened.error, null);
  assert.deepEqual([...opened.items], [[formerKey('LocalScope'), invalid]]);
  // A failed copy keeps the definitions in memory with the visible storage error.
  opened = open('LocalScope', [[formerKey('LocalScope'), previous]], { failWrites: true });
  assert.deepEqual(opened.list, [current]);
  assert.equal(opened.error, 'Definition kept in memory; browser storage is unavailable.');
  assert.deepEqual([...opened.items], [[formerKey('LocalScope'), previous]]);
});
