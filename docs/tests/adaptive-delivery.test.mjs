// Delivery and server-hint regressions (node:test, no browser matrix). Both cases bundle the real
// docs/src/adaptive modules with esbuild into a temporary directory outside the repository, like
// adaptive-policy.test.mjs: bare packages stay external, styles load empty, and the real layout
// chunks stay external so Node never runs a default loader. Controllers get injected per-profile
// loaders whose deferred promises the test settles in a chosen order. The server case also
// compiles the real adaptive stylesheet with sass and matches its unconditional rules in JSDOM;
// computed CSS, network and visual delivery checks remain with the browser gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspect, isDeepStrictEqual } from 'node:util';
import { build } from 'esbuild';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(testDirectory, '../..');
const ADAPTIVE_DIRECTORY = './docs/src/adaptive';
const STYLE_EXTENSIONS = Object.freeze(['.css', '.scss', '.sass', '.less']);
const PROFILES = Object.freeze(['phone', 'tablet', 'laptop', 'desktop', 'wide', 'living-room']);

// The public catalog slugs documented today; a new slug must arrive with an explicit contract.
const CATALOG_SLUGS = Object.freeze([
  'button',
  'input',
  'autocomplete',
  'cascader',
  'select',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'accordion',
  'form',
  'drawer',
  'pill',
  'dropdown',
  'pagination',
  'steps',
  'breadcrumb',
  'splitter',
  'card',
  'data-table',
  'collection-views',
  'record-details',
  'record-forms',
  'record-workspace',
  'toast',
  'alert',
  'notification',
  'modal',
  'popconfirm',
  'date-time',
  'empty-state',
  'avatar',
  'media',
  'content-patterns',
  'carousel',
  'upload',
  'rich-menu',
  'chart',
  'listy',
  'badge',
  'fab',
]);

const pick = (source, keys) => Object.fromEntries(keys.map(key => [key, source?.[key]]));
const show = value => inspect(value, { breakLength: Infinity, depth: 4 });

const runtimeImports = {
  name: 'adaptive-delivery-test-imports',
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => {
      if (args.kind === 'entry-point') return undefined;
      const file = args.path.split('?')[0];
      // DOM-free delivery tests ignore styles; production/style gates cover emitted CSS.
      if (STYLE_EXTENSIONS.some(extension => file.endsWith(extension)))
        return { path: args.path, namespace: 'ignored-style' };
      // Real layout chunks are never bundled or loaded here; injected loaders replace them.
      if (args.kind === 'dynamic-import' && file.startsWith('./layouts/'))
        return { path: args.path, external: true };
      if (args.path.startsWith('.') || path.isAbsolute(args.path)) return undefined;
      try {
        return { path: import.meta.resolve(args.path), external: true };
      } catch {
        return undefined;
      }
    });
    builder.onLoad({ filter: /.*/, namespace: 'ignored-style' }, () => ({
      contents: '',
      loader: 'js',
    }));
  },
};

async function bundleAndImport(label, contents) {
  const directory = await mkdtemp(path.join(tmpdir(), `genux-adaptive-${label}-`));
  const outfile = path.join(directory, 'bundle.mjs');
  try {
    await build({
      absWorkingDir: projectDirectory,
      stdin: {
        contents,
        resolveDir: projectDirectory,
        sourcefile: `adaptive-${label}-entry.ts`,
        loader: 'ts',
      },
      bundle: true,
      packages: 'external',
      plugins: [runtimeImports],
      outfile,
      write: true,
      format: 'esm',
      platform: 'node',
      target: 'node24',
      jsx: 'automatic',
      loader: { '.json': 'json' },
      logLevel: 'silent',
    });
    return await import(pathToFileURL(outfile).href);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

const layoutModule = profile =>
  Object.freeze({ profile, className: `genux-layout-${profile}`, navigation: 'drawer' });

// One literal loader per profile; each call records itself and waits for the test to settle it.
function recordingLoaders() {
  const calls = [];
  const requests = [];
  const loaders = Object.fromEntries(
    PROFILES.map(profile => [
      profile,
      () => {
        const request = deferred();
        calls.push(profile);
        requests.push({ profile, ...request });
        return request.promise;
      },
    ]),
  );
  const latest = profile => requests.findLast(entry => entry.profile === profile);
  return { loaders, calls, latest };
}

const snap = (status, requested, active, loaded, extra = {}) => ({
  status,
  requested,
  active,
  loaded,
  ...extra,
});
const settle = () => new Promise(resolve => setImmediate(resolve));

function genuxNames(value) {
  let list = [];
  if (value instanceof Map) list = [...value.keys()];
  else if (value instanceof Set) list = [...value];
  else if (Array.isArray(value))
    list = value.map(item => (typeof item === 'string' ? item : item?.name));
  else if (value && typeof value === 'object') list = Object.keys(value);
  return list.length > 0 && list.every(item => typeof item === 'string' && /^GenUX[A-Z]/.test(item))
    ? list
    : undefined;
}

// The runtime GenUX names are the largest GenUX-only collection the contracts module exports.
const genuxNamesFrom = contracts =>
  Object.values(contracts)
    .map(genuxNames)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];

test('delivery controller imports only on select, lets the newest choice win and stops after dispose', async () => {
  const unhandled = [];
  const onUnhandled = reason => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    const { DeliveryController, baselineDelivery, layoutLoaders } = await bundleAndImport(
      'delivery',
      `export { DeliveryController, baselineDelivery, layoutLoaders } from '${ADAPTIVE_DIRECTORY}/delivery.ts';`,
    );
    assert.equal(
      typeof globalThis.window,
      'undefined',
      'importing delivery must neither need nor create window',
    );
    assert.deepStrictEqual(
      Object.keys(layoutLoaders).sort(),
      [...PROFILES].sort(),
      'every layout profile has one lazy loader',
    );
    assert.ok(
      Object.values(layoutLoaders).every(loader => typeof loader === 'function'),
      'default loaders stay uncalled functions',
    );
    assert.deepStrictEqual(
      baselineDelivery,
      snap('baseline', 'phone', null, []),
      'the pre-hydration snapshot holds no layout module',
    );

    // A new controller imports nothing; detached accessors suit useSyncExternalStore.
    const first = recordingLoaders();
    const controller = new DeliveryController(first.loaders);
    const { getSnapshot, subscribe } = controller;
    assert.strictEqual(
      getSnapshot(),
      baselineDelivery,
      'a new controller reports the shared baseline snapshot',
    );
    assert.deepStrictEqual(first.calls, [], 'constructing a controller must not import a layout');
    assert.equal(controller.module(null), undefined, 'no module answers the baseline');
    assert.equal(controller.module('phone'), undefined, 'no module exists before select()');
    let notified = 0;
    const unsubscribe = subscribe(() => {
      notified += 1;
    });

    // The same profile in flight shares one import; the newest select owns activation.
    const phone = layoutModule('phone');
    const olderPhone = controller.select('phone');
    const newerPhone = controller.select('phone');
    assert.deepStrictEqual(
      first.calls,
      ['phone'],
      'a repeated select of an in-flight profile reuses its import',
    );
    assert.deepStrictEqual(
      getSnapshot(),
      snap('loading', 'phone', null, []),
      'the baseline stays while phone loads',
    );
    first.latest('phone').resolve(phone);
    assert.equal(await olderPhone, false, 'a superseded select never reports activation');
    assert.equal(await newerPhone, true, 'the newest select reports activation');
    assert.deepStrictEqual(getSnapshot(), snap('ready', 'phone', 'phone', ['phone']));
    assert.strictEqual(getSnapshot(), getSnapshot(), 'the ready snapshot is stable');
    assert.strictEqual(controller.module('phone'), phone, 'module() returns the resolved layout');
    assert.ok(notified > 0, 'subscribers hear loading and ready');
    assert.equal(await controller.select('phone'), true, 'a loaded profile activates again');
    assert.deepStrictEqual(first.calls, ['phone'], 'a loaded profile is never imported twice');
    unsubscribe();
    const heard = notified;
    const quietTablet = controller.select('tablet');
    first.latest('tablet').resolve(layoutModule('tablet'));
    assert.equal(await quietTablet, true);
    assert.equal(notified, heard, 'an unsubscribed listener is not notified');

    // Rapid phone -> desktop where desktop answers first: the late phone answer cannot take over.
    const desktop = layoutModule('desktop');
    const rapid = recordingLoaders();
    const racing = new DeliveryController(rapid.loaders);
    const toPhone = racing.select('phone');
    const toDesktop = racing.select('desktop');
    assert.deepStrictEqual(rapid.calls, ['phone', 'desktop']);
    rapid.latest('desktop').resolve(desktop);
    assert.equal(await toDesktop, true, 'desktop, the newest choice, becomes active');
    rapid.latest('phone').resolve(phone);
    assert.equal(await toPhone, false, 'the late phone import reports no activation');
    assert.deepStrictEqual(
      racing.getSnapshot(),
      snap('ready', 'desktop', 'desktop', ['desktop', 'phone']),
      'the late phone import is recorded as loaded but never becomes active',
    );
    assert.strictEqual(
      racing.module('phone'),
      phone,
      'the late module stays available for a later select',
    );

    // The current layout stays while the next loads; a cached newer choice beats the late import.
    const toLaptop = racing.select('laptop');
    assert.deepStrictEqual(
      racing.getSnapshot(),
      snap('loading', 'laptop', 'desktop', ['desktop', 'phone']),
      'desktop stays active while laptop loads',
    );
    assert.equal(await racing.select('desktop'), true, 'a cached profile activates at once');
    rapid.latest('laptop').resolve(layoutModule('laptop'));
    assert.equal(await toLaptop, false, 'the late laptop import reports no activation');
    assert.deepStrictEqual(
      racing.getSnapshot(),
      snap('ready', 'desktop', 'desktop', ['desktop', 'phone', 'laptop']),
      'a late import cannot overwrite the cached newer choice',
    );

    // A failure keeps the current layout, reports the error and is evicted for a manual retry.
    const toWide = racing.select('wide');
    rapid.latest('wide').reject(new Error('wide chunk failed'));
    assert.equal(await toWide, false, 'a failed import resolves false instead of rejecting');
    assert.deepStrictEqual(
      racing.getSnapshot(),
      snap('error', 'wide', 'desktop', ['desktop', 'phone', 'laptop'], {
        error: 'wide chunk failed',
      }),
      'a failed import keeps desktop active and reports the error',
    );
    assert.equal(racing.module('wide'), undefined, 'a failed import has no module');
    await settle();
    assert.deepStrictEqual(
      rapid.calls.filter(profile => profile === 'wide'),
      ['wide'],
      'nothing retries on its own',
    );
    const retried = racing.retry();
    assert.deepStrictEqual(
      rapid.calls.filter(profile => profile === 'wide'),
      ['wide', 'wide'],
      'retry starts a fresh import after the failed one is evicted',
    );
    assert.deepStrictEqual(
      racing.getSnapshot(),
      snap('loading', 'wide', 'desktop', ['desktop', 'phone', 'laptop']),
      'retry clears the previous error while it loads',
    );
    rapid.latest('wide').resolve(layoutModule('wide'));
    assert.equal(await retried, true, 'the manual retry activates wide');
    assert.deepStrictEqual(
      racing.getSnapshot(),
      snap('ready', 'wide', 'wide', ['desktop', 'phone', 'laptop', 'wide']),
    );

    // Answers arrive out of order while desktop is still pending: no earlier choice takes over.
    const order = recordingLoaders();
    const ordered = new DeliveryController(order.loaders);
    const early = ordered.select('phone');
    const middle = ordered.select('tablet');
    const last = ordered.select('desktop');
    order.latest('phone').resolve(phone);
    order.latest('tablet').reject(new Error('tablet chunk failed'));
    assert.equal(await early, false, 'an early phone answer reports no activation');
    assert.equal(await middle, false, 'a superseded failure resolves false');
    assert.deepStrictEqual(
      ordered.getSnapshot(),
      snap('loading', 'desktop', null, ['phone']),
      'superseded answers neither activate nor report an error',
    );
    order.latest('desktop').resolve(desktop);
    assert.equal(await last, true, 'the newest choice activates when it arrives');
    assert.deepStrictEqual(
      ordered.getSnapshot(),
      snap('ready', 'desktop', 'desktop', ['phone', 'desktop']),
    );

    // After dispose, late answers and new requests change nothing and nobody is notified.
    const late = recordingLoaders();
    const disposed = new DeliveryController(late.loaders);
    let disposedCalls = 0;
    disposed.subscribe(() => {
      disposedCalls += 1;
    });
    const lateTv = disposed.select('living-room');
    const lateLaptop = disposed.select('laptop');
    const frozen = disposed.getSnapshot();
    const heardBefore = disposedCalls;
    disposed.dispose();
    assert.doesNotThrow(() => disposed.dispose(), 'dispose is idempotent');
    late.latest('living-room').resolve(layoutModule('living-room'));
    late.latest('laptop').reject(new Error('laptop chunk failed'));
    assert.equal(await lateTv, false, 'a late answer after dispose reports no activation');
    assert.equal(await lateLaptop, false, 'a late failure after dispose resolves false');
    assert.equal(
      await disposed.select('phone'),
      false,
      'a disposed controller refuses new selections',
    );
    assert.equal(await disposed.retry(), false, 'a disposed controller refuses retry');
    const lateUnsubscribe = disposed.subscribe(() => {
      disposedCalls += 1;
    });
    assert.equal(
      typeof lateUnsubscribe,
      'function',
      'subscribe after dispose still returns a callback',
    );
    lateUnsubscribe();
    assert.deepStrictEqual(
      late.calls,
      ['living-room', 'laptop'],
      'a disposed controller imports nothing more',
    );
    assert.strictEqual(
      disposed.getSnapshot(),
      frozen,
      'late answers never change a disposed snapshot',
    );
    assert.equal(disposedCalls, heardBefore, 'listeners are released on dispose');
    assert.equal(
      disposed.module('living-room'),
      undefined,
      'a late module is not recorded after dispose',
    );

    await settle();
    assert.deepStrictEqual(unhandled.map(String), [], 'no import promise may reject unhandled');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('server hints fall back to the SSR baseline and every GenUX component and catalog slug keeps a contract', async () => {
  assert.equal(typeof globalThis.window, 'undefined', 'the server test must start without window');
  const { server, policy, coverage, genuxContracts } = await bundleAndImport(
    'server',
    [
      `export * as server from '${ADAPTIVE_DIRECTORY}/server.ts';`,
      `export * as policy from '${ADAPTIVE_DIRECTORY}/policy.ts';`,
      `export * as coverage from '${ADAPTIVE_DIRECTORY}/component-coverage.ts';`,
      `export * as genuxContracts from './docs/src/genux/contracts';`,
    ].join(' '),
  );
  assert.equal(
    typeof globalThis.window,
    'undefined',
    'server and coverage imports must neither need nor create window',
  );
  assert.equal(
    typeof globalThis.document,
    'undefined',
    'server and coverage imports must not create document',
  );
  const { resolveServerAdaptive } = server;
  const { serverEnvironment } = policy;

  const failures = [];
  const expect = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const adapt = hints => {
    try {
      return resolveServerAdaptive(hints);
    } catch (error) {
      failures.push(`resolveServerAdaptive(${show(hints)}) threw ${error.message}`);
      return { environment: {}, options: {}, resolution: {} };
    }
  };
  const summary = result => ({
    options: result.options,
    ...pick(result.resolution, [
      'layout',
      'orientation',
      'shortHeight',
      'usableWidth',
      'usableHeight',
    ]),
    inputLayers: [...(result.resolution?.inputLayers ?? [])],
  });
  const BASELINE = {
    options: {},
    layout: 'phone',
    orientation: 'portrait',
    shortHeight: false,
    usableWidth: 320,
    usableHeight: 480,
    inputLayers: [],
  };
  const expectBaseline = (hints, label) => {
    const result = adapt(hints);
    expect(
      isDeepStrictEqual(result.environment, serverEnvironment) &&
        isDeepStrictEqual(summary(result), BASELINE),
      `${label} ${show(hints)} resolved ${show(summary(result))}; expected the conservative SSR baseline`,
    );
  };
  const dimensions = (width, height) => ({
    ...serverEnvironment,
    width,
    height,
    visualWidth: width,
    visualHeight: height,
  });

  // Missing, malformed or non-finite widths are unknown: the host gets the 320x480 baseline.
  expectBaseline(undefined, 'no hints');
  expectBaseline({}, 'empty hints');
  for (const width of [
    undefined,
    null,
    '',
    '   ',
    'abc',
    'NaN',
    'Infinity',
    '1e400',
    '-1',
    '0',
    NaN,
    Infinity,
    -Infinity,
    -600,
    0,
    true,
    {},
  ]) {
    expectBaseline(
      { width, height: 900, surface: 'tv', lockedProfile: 'mobile' },
      'malformed hints',
    );
  }

  // Finite CSS widths, numeric or plain numeric strings, change dimensions only.
  for (const [width, height, layout] of [
    [1280, 800, 'desktop'],
    ['1280', '800', 'desktop'],
    ['599.5', undefined, 'phone'],
    ['600', '960', 'tablet'],
    ['1920', '1080', 'wide'],
  ]) {
    const result = adapt({ width, height });
    const expected = dimensions(Number(width), height === undefined ? 480 : Number(height));
    expect(
      isDeepStrictEqual(result.environment, expected),
      `hints ${show({ width, height })} produced ${show(result.environment)}; only dimensions may change`,
    );
    expect(
      result.resolution.layout === layout && isDeepStrictEqual(result.options, {}),
      `hints ${show({ width, height })} resolved ${show(summary(result))}; expected web ${layout}`,
    );
  }
  for (const height of [null, 'x', NaN, Infinity, -1, 0]) {
    const { environment, resolution } = adapt({ width: '1280', height });
    expect(
      environment.height === 480 &&
        environment.visualHeight === 480 &&
        resolution.layout === 'desktop',
      `malformed height ${show(height)} produced ${show(environment)}; expected the 480 baseline height`,
    );
  }

  // A wide width alone is web; only the trusted host may declare the living-room surface.
  const tvLike = {
    width: 1920,
    height: 1080,
    userAgent: 'Mozilla/5.0 (SMART-TV; Tizen)',
    activeInput: 'remote',
    coarse: true,
  };
  const web = adapt(tvLike);
  expect(
    web.resolution.layout === 'wide' &&
      isDeepStrictEqual(web.environment, dimensions(1920, 1080)) &&
      !web.resolution.inputLayers?.includes('spatial'),
    `1920 web hints with TV-like extras resolved ${show(summary(web))}; expected wide web with no assumed input`,
  );
  const explicitWeb = adapt({ width: 1920, height: 1080, surface: 'web' });
  expect(
    explicitWeb.resolution.layout === 'wide' &&
      isDeepStrictEqual(explicitWeb.options, { surface: 'web' }),
    `explicit web at 1920 resolved ${show(summary(explicitWeb))}; expected wide`,
  );
  for (const surface of ['tv', 'TV', 'Living-Room', ' living-room', 'living_room', true, 1, {}]) {
    const result = adapt({ width: 1920, height: 1080, surface });
    expect(
      result.resolution.layout === 'wide' &&
        isDeepStrictEqual(result.options, {}) &&
        !result.resolution.inputLayers?.includes('spatial'),
      `invalid surface ${show(surface)} resolved ${show(summary(result))}; expected wide web`,
    );
  }
  const tv = adapt({ surface: 'living-room' });
  expect(
    tv.resolution.layout === 'living-room' &&
      tv.resolution.inputLayers?.includes('spatial') &&
      isDeepStrictEqual(tv.options, { surface: 'living-room' }) &&
      isDeepStrictEqual(tv.environment, serverEnvironment),
    `explicit living-room resolved ${show(summary(tv))}; expected living-room with the spatial layer`,
  );
  const tvLocked = adapt({
    width: '1920',
    height: '1080',
    surface: 'living-room',
    lockedProfile: 'desktop',
  });
  expect(
    tvLocked.resolution.layout === 'living-room',
    `explicit living-room with a locked desktop resolved ${show(summary(tvLocked))}; living-room must win`,
  );

  // Only a known profile may lock the layout.
  const locked = adapt({ width: 1280, height: 800, lockedProfile: 'phone' });
  expect(
    locked.resolution.layout === 'phone' &&
      isDeepStrictEqual(locked.options, { lockedProfile: 'phone' }),
    `a locked phone at 1280 resolved ${show(summary(locked))}; expected phone`,
  );
  for (const lockedProfile of ['mobile', 'Phone', 'tv', 'living_room', 3, null]) {
    const result = adapt({ width: 1280, height: 800, lockedProfile });
    expect(
      result.resolution.layout === 'desktop' && isDeepStrictEqual(result.options, {}),
      `invalid locked profile ${show(lockedProfile)} resolved ${show(summary(result))}; expected desktop`,
    );
  }

  const hints = Object.freeze({
    width: '1280',
    height: '800',
    surface: 'web',
    lockedProfile: 'tablet',
  });
  const once = adapt(hints);
  const twice = adapt(hints);
  expect(isDeepStrictEqual(once, twice), 'resolveServerAdaptive must be pure for the same hints');
  expect(Object.isFrozen(once.resolution), 'the server resolution is frozen');
  assert.deepStrictEqual(failures, [], `server hint regressions: ${failures.join(' ; ')}`);

  // Coverage fails closed against the runtime GenUX names and the documented catalog slugs.
  const {
    ADAPTIVE_COMPONENT_COVERAGE,
    DOC_SLUG_COVERAGE,
    assertAdaptiveCoverage,
    adaptiveContractFor,
  } = coverage;
  const names = genuxNamesFrom(genuxContracts);
  assert.ok(
    names,
    `docs/src/genux/contracts must export the runtime GenUX component names; exports: ${Object.keys(genuxContracts).join(', ')}`,
  );
  assert.equal(names.length, 61, `expected the 61 current GenUX components; got ${names.length}`);
  assert.equal(
    Object.keys(ADAPTIVE_COMPONENT_COVERAGE).length,
    61,
    'every current GenUX component keeps an adaptive contract',
  );
  assert.deepStrictEqual(
    Object.keys(DOC_SLUG_COVERAGE).sort(),
    [...CATALOG_SLUGS].sort(),
    'all 41 documented catalog slugs keep coverage',
  );
  assert.doesNotThrow(
    () => assertAdaptiveCoverage(names, CATALOG_SLUGS),
    'the runtime names and catalog slugs are fully covered',
  );
  assert.throws(
    () => assertAdaptiveCoverage([...names, 'GenUXFutureWidget'], CATALOG_SLUGS),
    /missing GenUX component: GenUXFutureWidget/,
    'a new GenUX component without a contract must fail',
  );
  assert.throws(
    () => assertAdaptiveCoverage(names.slice(1), CATALOG_SLUGS),
    /extra GenUX component/,
    'a contract for a removed component must fail',
  );
  assert.throws(
    () => assertAdaptiveCoverage([...names, names[0]], CATALOG_SLUGS),
    /duplicate GenUX component/,
    'a duplicated component name must fail',
  );
  assert.throws(
    () => assertAdaptiveCoverage(names, [...CATALOG_SLUGS, 'future-slug']),
    /missing catalog slug: future-slug/,
    'a new catalog slug without coverage must fail',
  );
  assert.throws(
    () => adaptiveContractFor('GenUXFutureWidget'),
    /No adaptive contract/,
    'unknown names never fall back',
  );

  // The generic choice renders the registered AntD Select, so its contract is a fluid combobox.
  const choice = adaptiveContractFor('GenUXChoice');
  assert.deepStrictEqual(
    {
      family: choice.family,
      containerBehavior: choice.containerBehavior,
      composite: choice.inputContract.composite,
    },
    { family: 'choice', containerBehavior: 'fluid-fill', composite: 'combobox' },
    'GenUXChoice renders the registered AntD Select: a fluid-fill combobox, not a wrap-flow group',
  );

  // Coarse hit regions follow the trusted runtime root's input layer in the compiled stylesheet,
  // without a demo or target wrapper. JSDOM evaluates no media queries, so only unconditional
  // top-level rules count; a precision-only root stays unsized and artwork keeps its geometry.
  const { compile } = await import('sass');
  const { JSDOM } = await import('jsdom');
  const { css } = compile(path.join(projectDirectory, 'docs/src/styles/adaptive-components.scss'));
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  try {
    const { document } = dom.window;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    const coarseRules = [...document.styleSheets[0].cssRules].filter(
      rule =>
        typeof rule.selectorText === 'string' &&
        rule.style.getPropertyValue('min-block-size').trim() === 'var(--adaptive-coarse-target)',
    );
    assert.ok(coarseRules.length > 0, 'the compiled stylesheet keeps unconditional coarse rules');
    const sizedBy = element =>
      coarseRules
        .filter(rule => {
          try {
            return element.matches(rule.selectorText);
          } catch (error) {
            failures.push(`selector ${rule.selectorText} threw ${error.message}`);
            return false;
          }
        })
        .map(rule => rule.selectorText);
    const runtimeRoot = layers => {
      const root = document.createElement('div');
      root.className = 'genux-genux-runtime';
      root.dataset.adaptiveInputLayers = layers;
      root.innerHTML = [
        '<form class="ant-form">',
        '<label class="ant-checkbox-wrapper"><span class="ant-checkbox"></span>Archived</label>',
        '<label class="ant-radio-wrapper"><span class="ant-radio"></span>Proposal</label>',
        '<div class="ant-list-item">DocType Template</div>',
        '</form>',
      ].join('');
      document.body.append(root);
      return root;
    };
    const coarse = runtimeRoot('coarse');
    const precision = runtimeRoot('precision');
    for (const name of ['ant-checkbox-wrapper', 'ant-radio-wrapper', 'ant-list-item']) {
      expect(
        sizedBy(coarse.querySelector(`.${name}`)).length > 0,
        `.${name} under a coarse .genux-genux-runtime root gets no coarse min-block-size`,
      );
      const matched = sizedBy(precision.querySelector(`.${name}`));
      expect(
        matched.length === 0,
        `.${name} under a precision-only runtime root matched ${show(matched)}`,
      );
    }
    for (const name of ['ant-checkbox', 'ant-radio']) {
      const matched = sizedBy(coarse.querySelector(`.${name}`));
      expect(matched.length === 0, `.${name} artwork matched ${show(matched)}; it keeps its size`);
    }
    assert.deepStrictEqual(failures, [], `coarse target regressions: ${failures.join(' ; ')}`);
  } finally {
    dom.window.close();
  }
});
