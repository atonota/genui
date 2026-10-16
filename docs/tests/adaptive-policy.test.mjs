// Adaptive core regressions (node:test, no browser matrix). The first case reads the existing
// documentation AntD themes from the real bundled AtlasProvider: their responsive screen tokens
// must follow the shared adaptive policy instead of the AntD 576/992/1200 defaults. Only after
// that runtime assertion does the case load the new policy module, so the first failure is the
// theme behaviour, not a missing file. Bundles are written outside the repository; bare packages
// stay external and resolve from this directory like harness.mjs. Layout, CSS and visual checks
// remain with the browser gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(testDirectory, '../..');
const ADAPTIVE_DIRECTORY = './docs/src/adaptive';
const STYLE_EXTENSIONS = Object.freeze(['.css', '.scss', '.sass', '.less']);
// Layout entries read compiled CSS as an inline default export. Node never compiles Sass, so
// every style import yields this marked comment: it proves which text reaches SSR, not Sass.
const loadStyleFixture = args => ({
  contents: `export default ${JSON.stringify(
    `/* adaptive-test inline CSS fixture: ${path.basename(args.path.split('?')[0])}; Sass not compiled in Node */`,
  )};`,
  loader: 'js',
});

const FROZEN_POLICY = {
  version: 1,
  widths: {
    base: 320,
    widePhone: 480,
    smallTablet: 600,
    tablet: 768,
    laptop: 960,
    desktop: 1280,
    wideDesktop: 1600,
    ultraWide: 1920,
    expansive: 2560,
  },
  antd: { xs: 480, sm: 600, md: 768, lg: 960, xl: 1280, xxl: 1600, xxxl: 1920 },
  shortHeight: 480,
  verificationWidths: [320, 375, 430, 480, 599, 600, 768, 959, 960, 1279, 1280, 1600, 1920, 2560],
};

// AntD reads each band's min from its own edge and its max from the next edge minus one.
const ANTD_SCREEN_TOKENS = {
  screenXS: 480,
  screenXSMin: 480,
  screenXSMax: 599,
  screenSM: 600,
  screenSMMin: 600,
  screenSMMax: 767,
  screenMD: 768,
  screenMDMin: 768,
  screenMDMax: 959,
  screenLG: 960,
  screenLGMin: 960,
  screenLGMax: 1279,
  screenXL: 1280,
  screenXLMin: 1280,
  screenXLMax: 1599,
  screenXXL: 1600,
  screenXXLMin: 1600,
};

// Fractions stay on the inactive side of a min-width edge, exactly like CSS min-width.
const WIDTH_PROFILES = [
  [320, 'phone'],
  [375, 'phone'],
  [430, 'phone'],
  [480, 'phone'],
  [599, 'phone'],
  [599.98, 'phone'],
  [600, 'tablet'],
  [600.5, 'tablet'],
  [768, 'tablet'],
  [959, 'tablet'],
  [959.5, 'tablet'],
  [960, 'laptop'],
  [1279, 'laptop'],
  [1279.9, 'laptop'],
  [1280, 'desktop'],
  [1920, 'wide'],
  [2560, 'wide'],
];

const pick = (source, keys) => Object.fromEntries(keys.map(key => [key, source?.[key]]));

const runtimeImports = {
  name: 'adaptive-test-runtime-imports',
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => {
      if (args.kind === 'entry-point') return undefined;
      const file = args.path.split('?')[0];
      // DOM-free policy tests load the inline style fixture; production/style gates cover emitted CSS.
      if (STYLE_EXTENSIONS.some(extension => file.endsWith(extension)))
        return { path: args.path, namespace: 'ignored-style' };
      if (args.path.startsWith('.') || path.isAbsolute(args.path)) return undefined;
      try {
        return { path: import.meta.resolve(args.path), external: true };
      } catch {
        return undefined;
      }
    });
    builder.onLoad({ filter: /.*/, namespace: 'ignored-style' }, loadStyleFixture);
  },
};

// The JSDOM fixture keeps bare packages bare so its child process resolves them from this
// directory like harness.mjs; styles of dynamic profile entries become the inline fixture first.
const fixtureStyles = {
  name: 'adaptive-test-fixture-styles',
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, args =>
      STYLE_EXTENSIONS.some(extension => args.path.split('?')[0].endsWith(extension))
        ? { path: args.path, namespace: 'ignored-style' }
        : undefined,
    );
    builder.onLoad({ filter: /.*/, namespace: 'ignored-style' }, loadStyleFixture);
  },
};
const execFileAsync = promisify(execFile);

async function bundleAndImport(label, contents) {
  const directory = await mkdtemp(path.join(tmpdir(), `atlas-adaptive-${label}-`));
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

const loadAdaptive = () =>
  bundleAndImport(
    'policy',
    [
      `export * as policy from '${ADAPTIVE_DIRECTORY}/policy.ts';`,
      `export * as environment from '${ADAPTIVE_DIRECTORY}/environment.ts';`,
      `export { default as policyJson } from '${ADAPTIVE_DIRECTORY}/policy.json';`,
    ].join(' '),
  );

test('docs AntD themes follow the shared breakpoints; the policy resolves profiles and inputs independently', async () => {
  assert.equal(typeof globalThis.window, 'undefined', 'the node test must start without window');
  const provider = await bundleAndImport(
    'provider',
    `export { atlasDocsTheme, atlasDocsDarkTheme } from './docs/src/react/AtlasProvider.tsx';`,
  );
  for (const name of ['atlasDocsTheme', 'atlasDocsDarkTheme']) {
    const screens = pick(provider[name]?.token, Object.keys(ANTD_SCREEN_TOKENS));
    assert.deepStrictEqual(
      screens,
      ANTD_SCREEN_TOKENS,
      `${name}.token screens ${JSON.stringify(screens)} must follow the shared adaptive policy (sm 600, lg 960, xl 1280 with min/max), not the AntD 576/992/1200 defaults`,
    );
  }

  const { policy, policyJson } = await loadAdaptive();
  assert.equal(
    typeof globalThis.window,
    'undefined',
    'importing AtlasProvider and the adaptive policy must neither need nor create window',
  );
  assert.equal(
    typeof globalThis.document,
    'undefined',
    'adaptive imports must not create document',
  );
  assert.deepStrictEqual(
    policyJson,
    FROZEN_POLICY,
    'policy.json must hold the frozen shared contract',
  );
  const { resolveAdaptive, serverEnvironment, adaptiveBreakpointTokens } = policy;
  assert.equal(typeof resolveAdaptive, 'function', 'policy must export resolveAdaptive');
  assert.ok(
    adaptiveBreakpointTokens && typeof adaptiveBreakpointTokens === 'object',
    'policy must export adaptiveBreakpointTokens',
  );
  assert.ok(Object.isFrozen(serverEnvironment), 'serverEnvironment must be frozen');
  assert.deepStrictEqual(
    pick(serverEnvironment, [
      'width',
      'height',
      'visualWidth',
      'visualHeight',
      'coarse',
      'fine',
      'hover',
      'anyHover',
      'forcedColors',
      'saveData',
      'activeInput',
    ]),
    {
      width: 320,
      height: 480,
      visualWidth: 320,
      visualHeight: 480,
      coarse: false,
      fine: false,
      hover: false,
      anyHover: false,
      forcedColors: false,
      saveData: null,
      activeInput: 'unknown',
    },
    'the SSR environment is a conservative 320x480 snapshot that assumes no capabilities',
  );

  const failures = [];
  const expect = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const adapt = (environment, options) => {
    try {
      return resolveAdaptive(environment, options);
    } catch (error) {
      failures.push(
        `resolveAdaptive(${JSON.stringify(environment)}, ${JSON.stringify(options)}) threw ${error.message}`,
      );
      return {};
    }
  };
  const at = (width, height, extra = {}) =>
    Object.freeze({
      ...serverEnvironment,
      width,
      height,
      visualWidth: width,
      visualHeight: height,
      fine: true,
      hover: true,
      anyHover: true,
      ...extra,
    });
  const touch = { coarse: true, fine: false, hover: false, anyHover: false, activeInput: 'touch' };

  const server = adapt(serverEnvironment);
  expect(
    server.layout === 'phone',
    `the SSR environment resolved ${server.layout}; expected phone`,
  );
  expect(
    Array.isArray(server.inputLayers) &&
      !server.inputLayers.includes('coarse') &&
      !server.inputLayers.includes('precision'),
    `the SSR environment must not assume input layers; got ${JSON.stringify(server.inputLayers)}`,
  );

  for (const [width, layout] of WIDTH_PROFILES) {
    const actual = adapt(at(width, 900)).layout;
    expect(actual === layout, `web width ${width} resolved ${actual}; expected ${layout}`);
  }
  for (const [below, edge] of [
    [599, 600],
    [959, 960],
    [1279, 1280],
  ]) {
    const lower = adapt(at(below, 900)).band;
    const upper = adapt(at(edge, 900)).band;
    expect(
      typeof upper === 'string' && lower !== upper,
      `band must change between ${below} (${lower}) and ${edge} (${upper})`,
    );
  }
  for (const [edge, fraction] of [
    [600, 600.5],
    [959, 959.5],
  ]) {
    const whole = adapt(at(edge, 900)).band;
    const part = adapt(at(fraction, 900)).band;
    expect(
      whole === part,
      `fractional width ${fraction} band ${part} must equal ${edge} band ${whole}`,
    );
  }

  // ProductSurface is explicit: a 1920 web screen, even driven by a remote, is never TV.
  for (const extra of [{}, { activeInput: 'remote' }]) {
    const web = adapt(at(1920, 1080, extra)).layout;
    expect(
      web === 'wide',
      `web 1920 ${JSON.stringify(extra)} resolved ${web}; expected wide, never living-room`,
    );
  }
  const explicitWeb = adapt(at(1920, 1080), { surface: 'web' }).layout;
  expect(
    explicitWeb === 'wide',
    `explicit web surface at 1920 resolved ${explicitWeb}; expected wide`,
  );
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
  ]) {
    const tv = adapt(at(width, height, { activeInput: 'remote' }), {
      surface: 'living-room',
    }).layout;
    expect(tv === 'living-room', `living-room surface at ${width}x${height} resolved ${tv}`);
  }

  // A locked phone rotated to landscape keeps the phone journey; only orientation data change.
  const rotated = adapt(at(844, 390, touch), { lockedProfile: 'phone' });
  expect(
    rotated.layout === 'phone' &&
      rotated.orientation === 'landscape' &&
      rotated.shortHeight === true,
    `locked phone at 844x390 resolved ${JSON.stringify(pick(rotated, ['layout', 'orientation', 'shortHeight']))}`,
  );
  const upright = adapt(at(390, 844, touch), { lockedProfile: 'phone' });
  expect(
    upright.layout === 'phone' &&
      upright.orientation === 'portrait' &&
      upright.shortHeight === false,
    `locked phone at 390x844 resolved ${JSON.stringify(pick(upright, ['layout', 'orientation', 'shortHeight']))}`,
  );

  // A virtual keyboard or pinch zoom shrinks the usable area only; the profile never flips.
  const phone = at(390, 844, touch);
  const closed = adapt(phone);
  const open = adapt(Object.freeze({ ...phone, visualHeight: 470 }));
  expect(
    open.layout === closed.layout && open.band === closed.band,
    `visual viewport shrink changed ${closed.layout}/${closed.band} to ${open.layout}/${open.band}`,
  );
  expect(
    open.usableWidth === 390 && open.usableHeight === 470,
    `keyboard-open usable area is ${open.usableWidth}x${open.usableHeight}; expected 390x470`,
  );
  const zoomed = adapt(Object.freeze({ ...at(1280, 800), visualWidth: 640, visualHeight: 400 }));
  expect(
    zoomed.layout === 'desktop' && zoomed.usableWidth === 640 && zoomed.usableHeight === 400,
    `pinch zoom resolved ${JSON.stringify(pick(zoomed, ['layout', 'usableWidth', 'usableHeight']))}`,
  );

  // Input layers are additive and independent of the layout profile.
  const layers = environment => adapt(environment).inputLayers ?? [];
  const hybrid = layers(at(1280, 800, { coarse: true }));
  expect(
    hybrid.includes('coarse') && hybrid.includes('precision'),
    `coarse+fine must add both coarse and precision layers; got ${JSON.stringify(hybrid)}`,
  );
  const touchOnly = layers(at(390, 844, touch));
  expect(
    touchOnly.includes('coarse') && !touchOnly.includes('precision'),
    `touch only must add coarse without precision; got ${JSON.stringify(touchOnly)}`,
  );
  const mouseOnly = layers(at(1280, 800));
  expect(
    mouseOnly.includes('precision') && !mouseOnly.includes('coarse'),
    `mouse only must add precision without coarse; got ${JSON.stringify(mouseOnly)}`,
  );
  const touchDesktop = adapt(at(1280, 800, touch)).layout;
  expect(
    touchDesktop === 'desktop',
    `a coarse screen at 1280 resolved ${touchDesktop}; capabilities must not pick the profile`,
  );

  // Coarse-only short viewports keep the width profile: a keyboard-resized tablet or a touch
  // laptop is not a phone. Only an explicit lock selects the phone journey.
  for (const [width, height, layout] of [
    [768, 300, 'tablet'],
    [1280, 400, 'desktop'],
  ]) {
    const short = adapt(at(width, height, touch)).layout;
    expect(
      short === layout,
      `coarse-only ${width}x${height} resolved ${short}; expected ${layout}, never an inferred phone`,
    );
  }
  const keyboardResized = adapt(Object.freeze({ ...at(768, 300, touch), visualHeight: 260 }));
  expect(
    keyboardResized.layout === 'tablet' &&
      keyboardResized.orientation === 'landscape' &&
      keyboardResized.shortHeight === true &&
      keyboardResized.usableHeight === 260,
    `keyboard-resized tablet resolved ${JSON.stringify(pick(keyboardResized, ['layout', 'orientation', 'shortHeight', 'usableHeight']))}; expected tablet, landscape, short, usable height 260`,
  );
  const unlockedRotated = adapt(at(844, 390, touch)).layout;
  const lockedRotated = adapt(at(844, 390, touch), { lockedProfile: 'phone' }).layout;
  expect(
    unlockedRotated === 'tablet' && lockedRotated === 'phone',
    `844x390 touch resolved ${unlockedRotated} unlocked and ${lockedRotated} locked; expected tablet by width and phone only when locked`,
  );

  // A living-room lock never overrides the web surface; only the explicit surface makes TV.
  for (const options of [
    { lockedProfile: 'living-room' },
    { surface: 'web', lockedProfile: 'living-room' },
  ]) {
    const webLock = adapt(at(1920, 1080), options);
    expect(
      webLock.layout === 'wide' && !(webLock.inputLayers ?? []).includes('spatial'),
      `${JSON.stringify(options)} at 1920 resolved ${webLock.layout} ${JSON.stringify(webLock.inputLayers)}; expected wide without spatial`,
    );
  }
  const tvOverLock = adapt(at(1920, 1080), { surface: 'living-room', lockedProfile: 'phone' });
  expect(
    tvOverLock.layout === 'living-room' && (tvOverLock.inputLayers ?? []).includes('spatial'),
    `explicit living-room surface with a phone lock resolved ${tvOverLock.layout}; the explicit surface must win`,
  );
  const keyboardTablet = adapt(at(768, 1024, { ...touch, activeInput: 'keyboard' }));
  const unknownTablet = adapt(at(768, 1024, { ...touch, activeInput: 'unknown' }));
  expect(
    isDeepStrictEqual(keyboardTablet, unknownTablet),
    `keyboard use must not change layout or layers: ${JSON.stringify(keyboardTablet)} vs ${JSON.stringify(unknownTablet)}`,
  );

  const frozen = at(1024, 768);
  expect(
    isDeepStrictEqual(adapt(frozen), adapt(frozen)),
    'resolveAdaptive must be pure for the same input',
  );

  // Request-time hints validate the lock against the explicit surface before resolving.
  const { loadServerAdaptive, resolveServerAdaptive } = await bundleAndImport(
    'server',
    `export { loadServerAdaptive, resolveServerAdaptive } from '${ADAPTIVE_DIRECTORY}/server.ts';`,
  );
  for (const hints of [
    { width: 1920, height: 1080, lockedProfile: 'living-room' },
    { width: 1920, height: 1080, surface: 'web', lockedProfile: 'living-room' },
  ]) {
    const hosted = resolveServerAdaptive(hints);
    expect(
      hosted.options.lockedProfile === undefined && hosted.resolution.layout === 'wide',
      `server hints ${JSON.stringify(hints)} admitted ${JSON.stringify(hosted.options)} and resolved ${hosted.resolution.layout}; expected no TV lock and wide`,
    );
  }
  const hostedTv = resolveServerAdaptive({
    width: 1920,
    height: 1080,
    surface: 'living-room',
    lockedProfile: 'living-room',
  });
  expect(
    hostedTv.resolution.layout === 'living-room' &&
      hostedTv.resolution.inputLayers.includes('spatial'),
    `server hints with the living-room surface resolved ${hostedTv.resolution.layout}; expected living-room with spatial`,
  );

  // Journey continuity is stateful host data: the pure width resolver above stays stateless, and
  // the reducer keeps an established phone only across a reciprocal rotation.
  const { advanceJourney, journeyOptions } = policy;
  expect(typeof advanceJourney === 'function', 'policy must export advanceJourney');
  expect(typeof journeyOptions === 'function', 'policy must export journeyOptions');
  if (typeof advanceJourney === 'function' && typeof journeyOptions === 'function') {
    const walk = (steps, options, input = touch) => {
      let journey = null;
      return steps.split(' ').map(step => {
        const [width, height] = step.split('x').map(Number);
        const environment = at(width, height, input);
        journey = advanceJourney(journey, environment, options);
        return adapt(environment, journeyOptions(journey, options)).layout;
      });
    };
    for (const [steps, expected, options] of [
      ['390x844 844x390 390x844', 'phone phone phone'],
      ['390x844 844x390 844x200', 'phone phone phone'],
      ['390x844 844x390 900x390', 'phone phone tablet'],
      ['390x844 390x300', 'phone phone'],
      // A keyboard shrinks the phone's height, then it rotates while the keyboard stays open.
      ['390x844 390x300 844x200', 'phone phone phone'],
      // Repeated rotations with the keyboard open keep the established portrait reference.
      ['390x844 390x300 844x200 390x300 844x200', 'phone phone phone phone phone'],
      ['768x300', 'tablet'],
      ['1280x400', 'desktop'],
      ['844x390', 'tablet'],
      ['320x900 600x900', 'phone tablet'],
      ['390x844 844x390', 'phone tablet', { continuity: 'reset' }],
      ['390x844 844x390', 'tablet tablet', { lockedProfile: 'tablet' }],
    ]) {
      const actual = walk(steps, options).join(' ');
      expect(
        actual === expected,
        `journey ${steps} ${JSON.stringify(options ?? {})} resolved ${actual}; expected ${expected}`,
      );
    }
    const widths = policyJson.verificationWidths;
    for (const order of [widths, [...widths].reverse()]) {
      const actual = walk(order.map(width => `${width}x900`).join(' '), undefined, {}).join(' ');
      const byWidth = order.map(width => adapt(at(width, 900)).layout).join(' ');
      expect(
        actual === byWidth,
        `constant-height resize over ${order.join(' ')} resolved ${actual}; expected ${byWidth}`,
      );
    }
    const settled = advanceJourney(null, at(390, 844, touch));
    expect(
      advanceJourney(settled, at(390, 844, touch)) === settled,
      'an unchanged read must return the previous journey so a stateful host settles',
    );
  }

  // Shell options are the context of its whole subtree: a TV Shell in a web provider makes
  // descendants TV, the inverse makes them web, and a Shell keeps the inherited lock.
  const React = (await import('react')).default;
  // `server` above is the SSR resolution; the React server renderer gets its own binding.
  const reactSSR = await import('react-dom/server');
  const renderToString = reactSSR.renderToString ?? reactSSR.default.renderToString;
  const ui = await bundleAndImport(
    'shell',
    [
      `export { default as AdaptiveProvider, useAdaptive } from './docs/src/react/AdaptiveProvider.tsx';`,
      `export { default as AdaptiveShell } from './docs/src/react/AdaptiveShell.tsx';`,
    ].join(' '),
  );
  const h = React.createElement;
  const Probe = () => {
    const { surface, resolution } = ui.useAdaptive();
    return h('output', null, `probe:${surface}/${resolution.layout};`);
  };
  for (const [providerOptions, shellOptions, expected] of [
    [{ surface: 'web' }, { surface: 'living-room' }, 'living-room/living-room'],
    [{ surface: 'living-room' }, { surface: 'web' }, 'web/wide'],
    [{ surface: 'living-room' }, undefined, 'living-room/living-room'],
    [{ lockedProfile: 'phone' }, { surface: 'web' }, 'web/phone'],
    // Plain SSR: no options anywhere keeps the initial snapshot and the web surface.
    [undefined, undefined, 'web/wide'],
  ]) {
    let actual;
    try {
      const html = renderToString(
        h(
          ui.AdaptiveProvider,
          { options: providerOptions, initialEnvironment: at(1920, 1080) },
          h(ui.AdaptiveShell, { options: shellOptions }, h(Probe)),
        ),
      );
      actual = html.split('probe:')[1]?.split(';')[0];
      // Without server layout data the Shell keeps the shared baseline and inlines no profile CSS.
      expect(
        !html.includes('data-adaptive-layout-style') && html.includes('data-layout="baseline"'),
        `Shell without initialLayout in provider ${JSON.stringify(providerOptions)} inlined profile CSS or left the baseline: ${html}`,
      );
    } catch (error) {
      actual = `threw ${error.message}`;
    }
    expect(
      actual === expected,
      `Shell ${JSON.stringify(shellOptions)} in provider ${JSON.stringify(providerOptions)} gave descendants ${actual}; expected ${expected}`,
    );
  }

  // Request-time SSR inlines the resolved profile only: loadServerAdaptive reads the literal
  // layout registry and the Shell renders that CSS text as a sibling of its unchanged root. The
  // text is the Node style fixture, so this proves selection and delivery, not Sass output.
  expect(typeof loadServerAdaptive === 'function', 'server must export loadServerAdaptive');
  if (typeof loadServerAdaptive === 'function') {
    const seeded = async hints => {
      try {
        return await loadServerAdaptive(hints);
      } catch (error) {
        failures.push(`loadServerAdaptive(${JSON.stringify(hints)}) threw ${error.message}`);
        return undefined;
      }
    };
    const renderSeeded = (hosted, initialLayout) => {
      try {
        return renderToString(
          h(
            ui.AdaptiveProvider,
            { options: hosted.options, initialEnvironment: hosted.environment },
            h(ui.AdaptiveShell, { initialLayout }, h(Probe)),
          ),
        );
      } catch (error) {
        failures.push(`seeded Shell SSR threw ${error.message}`);
        return '';
      }
    };
    const desktopHints = { width: 1280, height: 800 };
    const desktop = await seeded(desktopHints);
    expect(
      typeof globalThis.window === 'undefined' && typeof globalThis.document === 'undefined',
      'loading the server layout must neither need nor create window or document',
    );
    const desktopLayout = desktop?.initialLayout;
    expect(
      isDeepStrictEqual(
        pick(desktop, ['environment', 'options', 'resolution']),
        resolveServerAdaptive(desktopHints),
      ) &&
        isDeepStrictEqual(Object.keys(desktopLayout ?? {}).sort(), [
          'className',
          'cssText',
          'navigation',
          'profile',
        ]) &&
        isDeepStrictEqual(JSON.parse(JSON.stringify(desktopLayout ?? null)), desktopLayout) &&
        desktopLayout.profile === 'desktop' &&
        typeof desktopLayout.className === 'string' &&
        desktopLayout.className.trim() !== '' &&
        typeof desktopLayout.cssText === 'string' &&
        desktopLayout.cssText.trim() !== '',
      `server hints ${JSON.stringify(desktopHints)} gave initialLayout ${JSON.stringify(desktopLayout)}; expected plain desktop data with compiled CSS text`,
    );
    if (desktopLayout?.profile === 'desktop') {
      const html = renderSeeded(desktop, desktopLayout);
      const root = `<div class="adaptive-shell ${desktopLayout.className}" data-adaptive-shell=""`;
      const style = `<style data-adaptive-layout-style="desktop">${desktopLayout.cssText}</style>`;
      expect(
        html.includes(`<div class="adaptive-shell-host">${style}${root}`) &&
          html.split('data-adaptive-layout-style').length === 2 &&
          html.includes('data-layout="desktop"') &&
          html.includes(`data-navigation="${desktopLayout.navigation}"`) &&
          html.includes('probe:web/desktop;'),
        `seeded desktop SSR must render one selected style beside the root with desktop metadata inside the host; got ${html}`,
      );
    }
    const tv = await seeded({
      width: 1920,
      height: 1080,
      surface: 'living-room',
      lockedProfile: 'living-room',
    });
    expect(
      tv?.initialLayout?.profile === 'living-room',
      `living-room server hints gave initialLayout ${JSON.stringify(tv?.initialLayout)}; expected living-room`,
    );
    if (tv?.initialLayout) {
      // A TV seed in a web Shell at 1920 never makes TV by width: it is ignored entirely.
      const html = renderSeeded(
        resolveServerAdaptive({ width: 1920, height: 1080 }),
        tv.initialLayout,
      );
      expect(
        !html.includes('data-adaptive-layout-style') &&
          html.includes('<div class="adaptive-shell" data-adaptive-shell=""') &&
          html.includes('data-layout="baseline"') &&
          html.includes('data-navigation="drawer"') &&
          html.includes('probe:web/wide;'),
        `a living-room initialLayout in a web Shell at 1920 must be ignored, keeping the baseline; got ${html}`,
      );
    }
  }

  // Nested Shells share one bubbling keydown: after an inner Shell handled Back, or for an
  // auto-repeat, the outer onBack must not run again. A real React CSR mount through
  // harness.mjs runs in a child process, so this window-free process never caches a
  // DOM-enabled React. Untrusted JSDOM keys only: no physical remote proof, styles ignored.
  // A second mount of the same fixture holds an open phone drawer: composing or modified
  // Escape/Back stays with the platform, while a plain Back closes the drawer before onBack.
  const backId = randomUUID();
  const backFixture = `docs/tests/.adaptive-back-fixture-${backId}.mjs`;
  const backScript = path.join(testDirectory, `.adaptive-back-${backId}.mjs`);
  // Expected [child onBack calls, parent onBack calls, defaultPrevented].
  const BACK_CASES = [
    { key: 'GoBack', expected: [1, 0, true] },
    { key: 'BrowserBack', expected: [1, 0, true] },
    { key: 'GoBack', repeat: true, expected: [0, 0, false] },
    { key: 'GoBack', prevented: true, expected: [0, 0, true] },
    { key: 'GoBack', childHandles: false, expected: [1, 1, true] },
  ];
  // Drawer results are [onBack calls, defaultPrevented, drawer open afterwards].
  const DRAWER_IGNORED = {
    composingEscape: { key: 'Escape', isComposing: true },
    modifierEscape: { key: 'Escape', ctrlKey: true },
    modifierBack: { key: 'GoBack', altKey: true },
  };
  const DRAWER_EXPECTED = {
    layout: 'phone',
    navigation: 'drawer',
    composingEscape: [0, false, true],
    modifierEscape: [0, false, true],
    modifierBack: [0, false, true],
    escape: [0, true, false],
    backClosesDrawer: [0, true, false],
    backAfterClose: [1, true, false],
  };
  try {
    await build({
      absWorkingDir: projectDirectory,
      stdin: {
        contents: [
          `import { createElement as h } from 'react';`,
          `import AdaptiveProvider from './docs/src/react/AdaptiveProvider.tsx';`,
          `import AdaptiveShell from './docs/src/react/AdaptiveShell.tsx';`,
          `const shell = (probe, side, children) => h(AdaptiveShell, { onBack: () => {`,
          `  probe[side] += 1;`,
          `  return side === 'parent' || probe.childHandles;`,
          `} }, children);`,
          `export const NestedBack = ({ probe }) => h(AdaptiveProvider, null, shell(probe, 'parent',`,
          `  shell(probe, 'child', h('button', { id: 'adaptive-back-target', type: 'button' }, 'Back'))));`,
          `export const DrawerBack = ({ probe }) => h(AdaptiveProvider, { options: { lockedProfile: 'phone' } }, h(AdaptiveShell, {`,
          `  onBack: () => { probe.back += 1; return true; },`,
          `  navigation: h('button', { id: 'adaptive-drawer-item', type: 'button' }, 'Item'),`,
          `}, h('button', { id: 'adaptive-drawer-main', type: 'button' }, 'Main')));`,
        ].join('\n'),
        resolveDir: projectDirectory,
        sourcefile: 'adaptive-back-fixture.js',
        loader: 'js',
      },
      bundle: true,
      packages: 'external',
      plugins: [fixtureStyles],
      outfile: path.join(projectDirectory, backFixture),
      write: true,
      format: 'esm',
      platform: 'node',
      target: 'node24',
      jsx: 'automatic',
      loader: { '.json': 'json' },
      logLevel: 'silent',
    });
    await writeFile(
      backScript,
      [
        `import { mountPattern } from './harness.mjs';`,
        `const probe = { child: 0, parent: 0, childHandles: true };`,
        `const harness = await mountPattern('NestedBack', ${JSON.stringify(backFixture)}, { probe });`,
        `const results = [];`,
        `try {`,
        `  const target = harness.document.getElementById('adaptive-back-target');`,
        `  for (const { key, repeat = false, prevented = false, childHandles = true } of ${JSON.stringify(BACK_CASES)}) {`,
        `    Object.assign(probe, { child: 0, parent: 0, childHandles });`,
        `    if (prevented) target.addEventListener('keydown', event => event.preventDefault(), { once: true });`,
        `    const event = new harness.window.KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true });`,
        `    await harness.act(async () => { target.dispatchEvent(event); });`,
        `    results.push([probe.child, probe.parent, event.defaultPrevented]);`,
        `  }`,
        `} finally {`,
        `  await harness.dispose();`,
        `}`,
        `const drawerProbe = { back: 0 };`,
        `const drawerHarness = await mountPattern('DrawerBack', ${JSON.stringify(backFixture)}, { probe: drawerProbe });`,
        `const drawer = {};`,
        `try {`,
        `  const { document, window } = drawerHarness;`,
        `  const settle = () => drawerHarness.act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });`,
        `  const shell = () => document.querySelector('[data-adaptive-shell]');`,
        `  for (let step = 0; step < 400 && shell()?.getAttribute('data-layout') !== 'phone'; step++) await settle();`,
        `  drawer.layout = shell()?.getAttribute('data-layout') ?? null;`,
        `  drawer.navigation = shell()?.getAttribute('data-navigation') ?? null;`,
        `  const item = document.getElementById('adaptive-drawer-item');`,
        `  const main = document.getElementById('adaptive-drawer-main');`,
        `  const toggle = shell()?.querySelector('.adaptive-shell-bar [aria-controls]');`,
        `  const isOpen = () => shell()?.getAttribute('data-nav-open') === 'true';`,
        `  const open = async () => { if (!isOpen()) await drawerHarness.act(async () => { toggle.click(); }); };`,
        `  const press = async (target, init) => {`,
        `    drawerProbe.back = 0;`,
        `    const event = new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });`,
        `    await drawerHarness.act(async () => { target.dispatchEvent(event); });`,
        `    return [drawerProbe.back, event.defaultPrevented, isOpen()];`,
        `  };`,
        `  for (const [name, init] of Object.entries(${JSON.stringify(DRAWER_IGNORED)})) {`,
        `    await open();`,
        `    drawer[name] = await press(item, init);`,
        `  }`,
        `  await open();`,
        `  drawer.escape = await press(item, { key: 'Escape' });`,
        `  await open();`,
        `  drawer.backClosesDrawer = await press(item, { key: 'GoBack' });`,
        `  drawer.backAfterClose = await press(main, { key: 'GoBack' });`,
        `} finally {`,
        `  await drawerHarness.dispose();`,
        `}`,
        `process.stdout.write(JSON.stringify({ nested: results, drawer }), () => process.exit(0));`,
      ].join('\n'),
      { flag: 'wx' },
    );
    const { stdout } = await execFileAsync(process.execPath, [backScript], {
      cwd: testDirectory,
      timeout: 20_000,
    });
    const { nested, drawer } = JSON.parse(stdout.trim().split('\n').at(-1));
    BACK_CASES.forEach(({ expected, ...backCase }, index) =>
      expect(
        isDeepStrictEqual(nested?.[index], expected),
        `nested Shell Back ${JSON.stringify(backCase)} gave [child, parent, defaultPrevented] ${JSON.stringify(nested?.[index])}; expected ${JSON.stringify(expected)}`,
      ),
    );
    for (const [name, expected] of Object.entries(DRAWER_EXPECTED))
      expect(
        isDeepStrictEqual(drawer?.[name], expected),
        `open phone drawer ${name} ${JSON.stringify(DRAWER_IGNORED[name] ?? {})} gave ${JSON.stringify(drawer?.[name])}; expected ${JSON.stringify(expected)} as [onBack calls, defaultPrevented, drawer open]`,
      );
  } catch (error) {
    failures.push(`nested Shell Back mount failed: ${error.stderr || error.message}`);
  } finally {
    await rm(path.join(projectDirectory, backFixture), { force: true });
    await rm(backScript, { force: true });
  }

  // Inside AtlasProvider an AdaptiveShell's effective surface owns its popups: the native popup
  // default (ConfigProvider getPopupContainer) is that Shell's own themed body portal, registered
  // to the Shell controller. Real AdaptiveProvider + AtlasProvider + AdaptiveShell under
  // StrictMode in a JSDOM child: a TV Shell beside a web Shell in a web provider, and a web Shell
  // inside a TV Shell in a TV provider. One remote ArrowRight between two buttons appended to the
  // returned container moves focus and opens the central ringless mode on TV portals only.
  // Untrusted JSDOM keys with stubbed rects: no physical remote or visual proof.
  const portalFixture = `docs/tests/.adaptive-portal-fixture-${backId}.mjs`;
  const portalScript = path.join(testDirectory, `.adaptive-portal-${backId}.mjs`);
  const TV_PRESS = {
    surface: 'living-room',
    portal: true,
    moved: true,
    prevented: true,
    modality: 'keyboard',
  };
  const WEB_PRESS = {
    surface: 'web',
    portal: true,
    moved: false,
    prevented: false,
    modality: 'pointer',
  };
  const PORTAL_EXPECTED = {
    tvAttached: true,
    distinct: true,
    tvOwns: true,
    outerOwns: true,
    outerExcludesInner: true,
    tv: TV_PRESS,
    web: WEB_PRESS,
    outer: TV_PRESS,
    inner: WEB_PRESS,
    switchedWeb: { stable: true, shell: 'web', owned: 0, press: WEB_PRESS },
    switchedBack: { attached: true, stable: true, owned: 1, press: TV_PRESS },
    shellPortals: 4,
  };
  try {
    await build({
      absWorkingDir: projectDirectory,
      stdin: {
        contents: [
          `import { createElement as h, StrictMode, useContext, useState } from 'react';`,
          `import { ConfigProvider } from 'antd';`,
          `import AdaptiveProvider from './docs/src/react/AdaptiveProvider.tsx';`,
          `import AdaptiveShell from './docs/src/react/AdaptiveShell.tsx';`,
          `import AtlasProvider from './docs/src/react/AtlasProvider.tsx';`,
          `import { getSpatialPortalsFor } from './docs/src/input-modality.ts';`,
          `const Probe = ({ probe, name }) => {`,
          `  probe.containers[name] = useContext(ConfigProvider.ConfigContext).getPopupContainer;`,
          `  return h('button', { id: 'portal-' + name + '-trigger', type: 'button' }, name);`,
          `};`,
          `export const PortalComposition = ({ probe }) => {`,
          `  const [tvSurface, setTvSurface] = useState('living-room');`,
          `  const [shells, setShells] = useState(true);`,
          `  Object.assign(probe, { setTvSurface, setShells, getSpatialPortalsFor });`,
          `  const at = name => h(Probe, { probe, name });`,
          `  return h(StrictMode, null,`,
          `    h(AdaptiveProvider, { options: { surface: 'web' } }, h(AtlasProvider, null, shells && h('div', null,`,
          `      h(AdaptiveShell, { options: { surface: tvSurface } }, at('tv'), h('input', { id: 'portal-tv-field', defaultValue: '' })),`,
          `      h(AdaptiveShell, null, at('web'))))),`,
          `    h(AdaptiveProvider, { options: { surface: 'living-room' } }, h(AtlasProvider, null, shells && h(AdaptiveShell, null,`,
          `      at('outer'), h(AdaptiveShell, { options: { surface: 'web' } }, at('inner'))))));`,
          `};`,
        ].join('\n'),
        resolveDir: projectDirectory,
        sourcefile: 'adaptive-portal-fixture.js',
        loader: 'js',
      },
      bundle: true,
      packages: 'external',
      plugins: [fixtureStyles],
      outfile: path.join(projectDirectory, portalFixture),
      write: true,
      format: 'esm',
      platform: 'node',
      target: 'node24',
      jsx: 'automatic',
      loader: { '.json': 'json' },
      logLevel: 'silent',
    });
    await writeFile(
      portalScript,
      [
        `import { mountPattern } from './harness.mjs';`,
        `const probe = { containers: {} };`,
        `const harness = await mountPattern('PortalComposition', ${JSON.stringify(portalFixture)}, { probe });`,
        `const checks = {};`,
        `try {`,
        `  const { document, window } = harness;`,
        `  const settle = () => harness.act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });`,
        `  const until = async check => { for (let step = 0; step < 400 && !check(); step++) await settle(); return check(); };`,
        `  const shellOf = name => document.getElementById('portal-' + name + '-trigger')?.closest('[data-adaptive-shell]') ?? null;`,
        `  const surfaceOf = node => node?.closest('[data-adaptive-surface]')?.getAttribute('data-adaptive-surface') ?? null;`,
        `  const tvAttached = () => ['tv', 'outer'].every(name => shellOf(name)?.getAttribute('data-layout') === 'living-room');`,
        `  const bodyPortals = () => Array.from(document.body.children).filter(node => node.matches('[data-atlas-portal]')).length;`,
        `  const ownedBy = name => probe.getSpatialPortalsFor(shellOf(name));`,
        `  const pointer = () => document.dispatchEvent(new window.Event('pointerdown'));`,
        `  const press = async name => {`,
        `    const container = probe.containers[name]?.();`,
        `    if (!container) return { missing: name };`,
        `    const [first, second] = [0, 100].map(left => {`,
        `      const button = document.createElement('button');`,
        `      const rect = { left, top: 0, right: left + 40, bottom: 40, x: left, y: 0, width: 40, height: 40 };`,
        `      Object.assign(button, { type: 'button', getBoundingClientRect: () => rect, getClientRects: () => [rect] });`,
        `      return button;`,
        `    });`,
        `    await harness.act(async () => { container.append(first, second); });`,
        `    await settle();`,
        `    pointer();`,
        `    first.focus();`,
        `    const event = new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });`,
        `    await harness.act(async () => { first.dispatchEvent(event); });`,
        `    const result = { surface: surfaceOf(container), portal: container.matches('[data-atlas-portal]'), moved: document.activeElement === second, prevented: event.defaultPrevented, modality: document.documentElement.dataset.inputModality };`,
        `    await harness.act(async () => { first.remove(); second.remove(); });`,
        `    pointer();`,
        `    return result;`,
        `  };`,
        `  checks.tvAttached = await until(tvAttached);`,
        `  const portalsBefore = bodyPortals();`,
        `  const containers = ['tv', 'web', 'outer', 'inner'].map(name => probe.containers[name]?.() ?? null);`,
        `  const [tv, , outer, inner] = containers;`,
        `  checks.distinct = !containers.includes(null) && new Set(containers).size === 4;`,
        `  checks.tvOwns = ownedBy('tv').length === 1 && ownedBy('tv')[0] === tv;`,
        `  checks.outerOwns = ownedBy('outer').length === 1 && ownedBy('outer')[0] === outer;`,
        `  checks.outerExcludesInner = !ownedBy('outer').includes(inner);`,
        `  for (const name of ['tv', 'web', 'outer', 'inner']) checks[name] = await press(name);`,
        `  const trigger = document.getElementById('portal-tv-trigger');`,
        `  const field = document.getElementById('portal-tv-field');`,
        `  field.value = 'kept';`,
        `  const stable = () => document.getElementById('portal-tv-trigger') === trigger && document.getElementById('portal-tv-field') === field && field.value === 'kept';`,
        `  await harness.act(async () => { probe.setTvSurface('web'); });`,
        `  checks.switchedWeb = { stable: stable(), shell: surfaceOf(shellOf('tv')), owned: ownedBy('tv').length, press: await press('tv') };`,
        `  await harness.act(async () => { probe.setTvSurface('living-room'); });`,
        `  const attached = await until(tvAttached);`,
        `  checks.switchedBack = { attached, stable: stable(), owned: ownedBy('tv').length, press: await press('tv') };`,
        `  await harness.act(async () => { probe.setShells(false); });`,
        `  await settle();`,
        `  checks.shellPortals = portalsBefore - bodyPortals();`,
        `} finally {`,
        `  await harness.dispose();`,
        `}`,
        `process.stdout.write(JSON.stringify(checks), () => process.exit(0));`,
      ].join('\n'),
      { flag: 'wx' },
    );
    const { stdout } = await execFileAsync(process.execPath, [portalScript], {
      cwd: testDirectory,
      timeout: 30_000,
    });
    const checks = JSON.parse(stdout.trim().split('\n').at(-1));
    for (const [name, expected] of Object.entries(PORTAL_EXPECTED))
      expect(
        isDeepStrictEqual(checks[name], expected),
        `Shell portal composition ${name} gave ${JSON.stringify(checks[name])}; expected ${JSON.stringify(expected)}`,
      );
  } catch (error) {
    failures.push(`Shell portal composition failed: ${error.stderr || error.message}`);
  } finally {
    await rm(path.join(projectDirectory, portalFixture), { force: true });
    await rm(portalScript, { force: true });
  }

  assert.deepStrictEqual(failures, [], `adaptive policy regressions: ${failures.join(' ; ')}`);
});

class FakeTarget {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!listener) return;
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }
  dispatchEvent(event) {
    this.dispatch(event.type, event);
    return true;
  }
  dispatch(type, detail = {}) {
    const event = { ...detail, type, target: this, currentTarget: this };
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      if (typeof listener === 'function') listener.call(this, event);
      else listener.handleEvent(event);
    }
  }
  get listenerCount() {
    let count = 0;
    for (const set of this.listeners.values()) count += set.size;
    return count;
  }
}

function queryMatches(media, state) {
  const query = media.split(' ').join('').toLowerCase();
  if (query.includes('(any-hover:none)')) return !state.anyHover;
  if (query.includes('(any-hover:hover)') || query.includes('(any-hover)')) return state.anyHover;
  if (query.includes('(hover:none)')) return !state.hover;
  if (query.includes('(hover:hover)') || query.includes('(hover)')) return state.hover;
  if (query.includes('pointer:coarse')) return state.coarse;
  if (query.includes('pointer:fine')) return state.fine;
  if (query.includes('prefers-reduced-motion:reduce')) return state.reducedMotion;
  if (query.includes('prefers-reduced-motion:no-preference')) return !state.reducedMotion;
  if (query.includes('forced-colors:active')) return state.forcedColors;
  if (query.includes('forced-colors:none')) return !state.forcedColors;
  return false;
}

class FakeMediaQueryList extends FakeTarget {
  constructor(media, state) {
    super();
    this.media = media;
    this.state = state;
    this.onchange = null;
  }
  get matches() {
    return queryMatches(this.media, this.state);
  }
  addListener(listener) {
    this.addEventListener('change', listener);
  }
  removeListener(listener) {
    this.removeEventListener('change', listener);
  }
  dispatch(type, detail = {}) {
    const event = { matches: this.matches, media: this.media, ...detail };
    super.dispatch(type, event);
    if (type === 'change' && typeof this.onchange === 'function') this.onchange({ ...event, type });
  }
  get listenerCount() {
    return super.listenerCount + (typeof this.onchange === 'function' ? 1 : 0);
  }
}

// A minimal injected Window: live viewport, visual viewport, media and save-data signals.
function createFakeWindow(initial) {
  const state = { ...initial };
  const queries = [];
  const view = new FakeTarget();
  const visualViewport = new FakeTarget();
  const document = new FakeTarget();
  const connection = new FakeTarget();
  const documentElement = {};
  const live = (target, entries) => {
    for (const [name, read] of Object.entries(entries))
      Object.defineProperty(target, name, { configurable: true, enumerable: true, get: read });
  };
  live(view, { innerWidth: () => state.width, innerHeight: () => state.height });
  live(visualViewport, {
    width: () => state.visualWidth,
    height: () => state.visualHeight,
    scale: () => 1,
    offsetLeft: () => 0,
    offsetTop: () => 0,
  });
  live(documentElement, { clientWidth: () => state.width, clientHeight: () => state.height });
  live(connection, { saveData: () => state.saveData });
  Object.assign(document, { documentElement, defaultView: view, visibilityState: 'visible' });
  Object.assign(view, {
    window: view,
    self: view,
    document,
    visualViewport,
    navigator: { connection },
    devicePixelRatio: 1,
    matchMedia(media) {
      const list = new FakeMediaQueryList(media, state);
      queries.push(list);
      return list;
    },
    requestAnimationFrame: callback => setTimeout(() => callback(performance.now()), 0),
    cancelAnimationFrame: handle => clearTimeout(handle),
    setTimeout,
    clearTimeout,
  });
  const targets = () => [view, visualViewport, document, connection, ...queries];
  return {
    view,
    listeners: () => targets().reduce((sum, target) => sum + target.listenerCount, 0),
    update(patch = {}) {
      Object.assign(state, patch);
      view.dispatch('resize');
      visualViewport.dispatch('resize');
      visualViewport.dispatch('scroll');
      for (const list of [...queries]) list.dispatch('change');
      connection.dispatch('change');
    },
  };
}

async function waitFor(predicate, description, timeout = 1000) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= end) throw new Error(`Timed out: ${description}`);
    await delay(5);
  }
}

const PHONE_WINDOW = Object.freeze({
  width: 390,
  height: 844,
  visualWidth: 390,
  visualHeight: 844,
  coarse: true,
  fine: false,
  hover: false,
  anyHover: false,
  reducedMotion: false,
  forcedColors: false,
  saveData: true,
});

test('environment store reads an injected window with stable snapshots and clean subscriptions', async () => {
  assert.equal(
    typeof globalThis.window,
    'undefined',
    'the store test must run without a global window',
  );
  const { policy, environment } = await loadAdaptive();
  const { serverEnvironment, resolveAdaptive } = policy;
  const { EnvironmentStore, getEnvironmentStore } = environment;

  // SSR: no view. useSyncExternalStore receives these methods detached.
  const { getSnapshot, getServerSnapshot, subscribe } = new EnvironmentStore();
  assert.strictEqual(
    getSnapshot(),
    getSnapshot(),
    'detached getSnapshot must return one stable snapshot',
  );
  assert.strictEqual(getServerSnapshot(), getServerSnapshot(), 'getServerSnapshot must be stable');
  assert.deepStrictEqual(
    getSnapshot(),
    serverEnvironment,
    'a store without a view reports the SSR environment',
  );
  const unsubscribeServer = subscribe(() => {});
  assert.equal(
    typeof unsubscribeServer,
    'function',
    'subscribe must return an unsubscribe callback',
  );
  unsubscribeServer();
  assert.deepStrictEqual(
    getEnvironmentStore().getSnapshot(),
    serverEnvironment,
    'getEnvironmentStore without a window must stay SSR-safe',
  );

  const hinted = Object.freeze({
    ...serverEnvironment,
    width: 1280,
    height: 800,
    visualWidth: 1280,
    visualHeight: 800,
    fine: true,
    hover: true,
    anyHover: true,
  });
  const hintedStore = new EnvironmentStore(undefined, hinted);
  assert.deepStrictEqual(
    hintedStore.getServerSnapshot(),
    hinted,
    'a supplied request-time snapshot is the server snapshot',
  );
  assert.strictEqual(
    hintedStore.getServerSnapshot(),
    hintedStore.getServerSnapshot(),
    'the hinted server snapshot is stable',
  );

  const fake = createFakeWindow(PHONE_WINDOW);
  const other = createFakeWindow(PHONE_WINDOW);
  const store = getEnvironmentStore(fake.view);
  assert.ok(
    store instanceof EnvironmentStore,
    'getEnvironmentStore must return an EnvironmentStore',
  );
  assert.strictEqual(getEnvironmentStore(fake.view), store, 'one store per window');
  assert.notStrictEqual(
    getEnvironmentStore(other.view),
    store,
    'another window gets its own store',
  );
  assert.deepStrictEqual(
    store.getServerSnapshot(),
    serverEnvironment,
    'a browser store keeps the conservative server snapshot so hydration matches SSR',
  );

  const first = store.getSnapshot();
  assert.strictEqual(store.getSnapshot(), first, 'getSnapshot must be stable before any change');
  assert.deepStrictEqual(
    pick(first, [
      'width',
      'height',
      'visualWidth',
      'visualHeight',
      'coarse',
      'fine',
      'hover',
      'anyHover',
      'saveData',
      'activeInput',
    ]),
    {
      width: 390,
      height: 844,
      visualWidth: 390,
      visualHeight: 844,
      coarse: true,
      fine: false,
      hover: false,
      anyHover: false,
      saveData: true,
      activeInput: 'unknown',
    },
    'the snapshot reads the injected window and never infers an active input',
  );

  const baseline = fake.listeners();
  let first_calls = 0;
  let second_calls = 0;
  const unsubscribeFirst = store.subscribe(() => {
    first_calls += 1;
  });
  const single = fake.listeners();
  assert.ok(single > baseline, 'subscribing must listen to the injected window signals');
  const unsubscribeSecond = store.subscribe(() => {
    second_calls += 1;
  });
  assert.equal(
    fake.listeners(),
    single,
    'a second subscriber shares the window listeners instead of duplicating them',
  );

  fake.update();
  await delay(20);
  assert.strictEqual(
    store.getSnapshot(),
    first,
    'an unchanged environment keeps the snapshot identity',
  );

  fake.update({ visualHeight: 470 });
  await waitFor(
    () => store.getSnapshot().visualHeight === 470,
    'visual viewport shrink reaches the snapshot',
  );
  const shrunk = store.getSnapshot();
  assert.strictEqual(store.getSnapshot(), shrunk, 'the updated snapshot is stable');
  assert.equal(shrunk.height, 844, 'a visual viewport shrink leaves the layout viewport height');
  assert.ok(first_calls > 0 && second_calls > 0, 'every subscriber is notified of a change');
  assert.equal(
    resolveAdaptive(shrunk).layout,
    resolveAdaptive(first).layout,
    'the keyboard-open snapshot keeps the profile',
  );
  assert.equal(
    resolveAdaptive(shrunk).usableHeight,
    470,
    'the keyboard-open snapshot shrinks the usable height',
  );

  fake.update({ fine: true, anyHover: true });
  await waitFor(
    () => store.getSnapshot().fine === true,
    'a fine pointer joining reaches the snapshot',
  );
  const hybrid = store.getSnapshot();
  assert.equal(hybrid.coarse, true, 'the coarse pointer stays when a fine pointer joins');
  assert.equal(hybrid.activeInput, 'unknown', 'pointer capabilities never imply an active input');
  const layers = resolveAdaptive(hybrid).inputLayers;
  assert.ok(
    layers.includes('coarse') && layers.includes('precision'),
    `hybrid layers must be additive; got ${JSON.stringify(layers)}`,
  );

  unsubscribeFirst();
  await delay(20);
  const stopped = first_calls;
  const before = second_calls;
  fake.update({ width: 844, height: 390, visualWidth: 844, visualHeight: 390 });
  await waitFor(() => store.getSnapshot().width === 844, 'rotation reaches the snapshot');
  await waitFor(() => second_calls > before, 'the remaining subscriber is notified');
  assert.equal(first_calls, stopped, 'an unsubscribed callback is not notified');
  // A stateful host carries the journey across store snapshots: the rotated phone stays a
  // phone, while the pure resolver alone resolves the same 844x390 snapshot as a tablet.
  const { advanceJourney, journeyOptions } = policy;
  assert.equal(typeof advanceJourney, 'function', 'policy must export advanceJourney');
  const rotatedSnapshot = store.getSnapshot();
  const carried = [first, shrunk, hybrid, rotatedSnapshot].reduce(
    (journey, snapshot) => advanceJourney(journey, snapshot),
    null,
  );
  assert.equal(resolveAdaptive(rotatedSnapshot).layout, 'tablet', 'width alone gives a tablet');
  assert.equal(
    resolveAdaptive(rotatedSnapshot, journeyOptions(carried)).layout,
    'phone',
    'the rotated store snapshot keeps the established phone journey',
  );
  assert.doesNotThrow(() => unsubscribeFirst(), 'unsubscribe must be idempotent');
  unsubscribeSecond();
  assert.equal(
    fake.listeners(),
    baseline,
    'the last unsubscribe removes every window, viewport and media listener',
  );
});
