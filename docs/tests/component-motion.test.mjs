import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import { fabMotionFailures, validateFabMotionOwner } from '../../tools/fab-motion-guard.mjs';

const files = [
  'genux-splitter.css',
  'genux-breadcrumb.css',
  'breadcrumb-catalog.css',
  'splitter-catalog.css',
  'card-catalog.css',
  'genux-dropdown.css',
  'dropdown-catalog.css',
  'genux-card.css',
  'genux-card-lab.css',
  'genux-runtime.css',
  'genux-pagination.css',
  'pagination-catalog.css',
  'genux-steps.css',
  'steps-catalog.css',
  'genux-autocomplete.css',
  'autocomplete-catalog.css',
  'genux-cascader.css',
  'cascader-catalog.css',
  'genux-selection-variants.css',
  'genux-feedback.css',
  'genux-drawer-extensions.css',
  'genux-date-time.css',
  'genux-media.css',
  'genux-screenshot.css',
  'genux-content-patterns.css',
  'genux-carousel.css',
  'genux-upload.css',
  'genux-rich-menu.css',
  'genux-chart.css',
  'kit-identity.css',
  'genux-fab.css',
];
function motionFailures(source) {
  const failures = [];
  postcss.parse(source).walkDecls(declaration => {
    let reduced = false;
    for (let parent = declaration.parent; parent; parent = parent.parent)
      if (
        parent.type === 'atrule' &&
        parent.name === 'media' &&
        /prefers-reduced-motion:\s*reduce/.test(parent.params)
      )
        reduced = true;
    if (reduced) return;
    const { prop, value } = declaration;
    if (prop === 'transition-timing-function' && value !== 'var(--motion-easing)')
      failures.push(prop);
    if (
      prop === 'transition-duration' &&
      value !== 'var(--transition-duration)' &&
      !/^var\(--motion-duration-[\w-]+\)$/.test(value)
    )
      failures.push(prop);
    if (prop === 'transition-delay' && value !== 'var(--motion-delay)') failures.push(prop);
    if (
      prop === 'animation' &&
      (!value.includes('var(--motion-easing)') || !/var\(--motion-duration-[\w-]+\)/.test(value))
    )
      failures.push(prop);
    if (prop === 'transition' && value !== 'var(--control-transition)') failures.push(prop);
  });
  return failures;
}

test('new Splitter, Breadcrumb and changed Card layers consume central positive symmetric motion', async () => {
  await validateFabMotionOwner();
  const motion = JSON.parse(
    await readFile(new URL('../src/data/motion.json', import.meta.url), 'utf8'),
  );
  assert.equal(motion.easing, 'cubic-bezier(0.65, 0, 0.35, 1)');
  assert.equal(motion.delayMs, 0);
  // FAB press feedback resolves to the central 116.667 ms button-feedback token; the master press/release
  // aliases the guard accepts are bound to that same token by docs web.css.
  assert.equal(motion.durationMs['button-feedback'], 116.667);
  const pressRoles = new Map();
  for (const file of ['genux-motion.css', 'web.css'])
    postcss
      .parse(await readFile(new URL('../src/styles/' + file, import.meta.url), 'utf8'))
      .walkDecls(
        /^--(motion-duration-button-feedback|press-duration|release-duration)$/,
        declaration =>
          pressRoles.set(declaration.prop, [
            ...(pressRoles.get(declaration.prop) ?? []),
            declaration.value,
          ]),
      );
  assert.deepEqual(Object.fromEntries(pressRoles), {
    '--motion-duration-button-feedback': ['116.667ms'],
    '--press-duration': ['var(--motion-duration-button-feedback)'],
    '--release-duration': ['var(--motion-duration-button-feedback)'],
  });
  const aliases = postcss.parse(
    await readFile(new URL('../src/styles/docs.css', import.meta.url), 'utf8'),
  );
  let aliasFound = false;
  aliases.walkDecls('--transition-duration', declaration => {
    let reduced = false;
    for (let parent = declaration.parent; parent; parent = parent.parent)
      if (
        parent.type === 'atrule' &&
        parent.name === 'media' &&
        /prefers-reduced-motion:\s*reduce/.test(parent.params)
      )
        reduced = true;
    if (reduced) {
      assert.equal(declaration.value, '0ms');
      return;
    }
    assert.equal(declaration.value, 'var(--motion-duration-standard)');
    aliasFound = true;
  });
  assert.ok(aliasFound, 'the Card duration alias resolves to the central standard token');
  for (const duration of Object.values(motion.durationMs))
    assert.ok(Number.isFinite(duration) && duration > 0);
  for (const file of files) {
    const source = await readFile(new URL('../src/styles/' + file, import.meta.url), 'utf8');
    assert.deepEqual(
      file === 'genux-fab.css' ? fabMotionFailures(source) : motionFailures(source),
      [],
      file,
    );
  }
});

test('component motion gate rejects local, asymmetric and zero normal motion while retaining the reduced-motion exception', () => {
  for (const declaration of [
    'transition-timing-function:ease-out',
    'transition-timing-function:linear',
    'transition-duration:0ms',
    'transition-duration:200ms',
    'transition-delay:50ms',
    'animation:fade 1s linear',
    'transition:all 1s ease',
  ])
    assert.ok(motionFailures('.new-component{' + declaration + '}').length, declaration);
  for (const source of [
    '.genux-fab{--fab-duration:0s}',
    '.genux-fab{--fab-easing:cubic-bezier(0.76, 0, 0.24, 1)}',
    '.genux-fab{--fab-delay:60s}',
    '.genux-fab{transition:none}',
    '.genux-fab{animation:none}',
    '.genux-fab{transition-property:all}',
    '.genux-fab{transition-property:none}',
    '.genux-fab{transition:all var(--motion-duration-standard) var(--motion-easing)}',
    '.genux-fab{transition:var(--motion-duration-standard) var(--motion-easing)}',
    '.genux-fab{transition-duration:var(--motion-duration-invented)}',
    '.genux-fab{--motion-easing:linear;transition:opacity var(--motion-duration-standard) var(--motion-easing)}',
    '.genux-fab{--motion-duration-standard:0ms;transition:opacity var(--motion-duration-standard) var(--motion-easing)}',
    '@media(prefers-reduced-motion:reduce){.genux-fab{--motion-duration-standard:0ms}}',
    '.genux-fab-action-button::before{--press-duration:0ms;transition:inset var(--press-duration) var(--motion-easing)}',
    '.genux-fab-action{--fab-order-index:999!important}',
    '@media not (prefers-reduced-motion:reduce){.genux-fab{transition-duration:0ms}}',
    '.genux-fab .genux-fab-action > .genux-fab-action-button::before{transition:inset var(--motion-duration-button) var(--motion-easing)}',
    '.genux-fab .genux-fab-action > .genux-fab-action-button::before{transition:inset var(--motion-duration-standard) var(--motion-easing)}',
    '.genux-fab .genux-fab-action > .genux-fab-action-button:active::before{transition-duration:var(--motion-duration-standard)}',
  ])
    assert.ok(fabMotionFailures(source).length, source);
  assert.deepEqual(
    motionFailures(
      '@media(prefers-reduced-motion:reduce){.new-component{transition-duration:0ms;animation:none}}',
    ),
    [],
  );
  assert.deepEqual(
    motionFailures(
      '.new-component{transition-duration:var(--motion-duration-standard);transition-timing-function:var(--motion-easing);transition-delay:var(--motion-delay)}',
    ),
    [],
  );
  assert.deepEqual(
    fabMotionFailures(
      '.genux-fab{--fab-open-duration:var(--motion-duration-standard);--fab-close-duration:var(--motion-duration-standard);--fab-duration:var(--fab-open-duration);--fab-easing:var(--motion-easing);--fab-stagger:var(--motion-delay);--fab-delay:var(--motion-delay)}' +
        '.genux-fab[data-fab-state=closing]{--fab-duration:var(--fab-close-duration)}' +
        '.genux-fab[data-fab-sequence=staggered] .genux-fab-action{--fab-delay:calc(var(--fab-stagger) * var(--fab-order-index, 0));transition:opacity var(--fab-duration) var(--fab-easing) var(--fab-delay)}' +
        '.genux-fab .genux-fab-action > .genux-fab-action-button::before{transition:inset var(--motion-duration-button-feedback) var(--motion-easing),transform var(--fab-duration) var(--fab-easing) var(--fab-delay)}' +
        '.genux-fab .genux-fab-action > .genux-fab-action-button:active::before{transition-duration:var(--press-duration), var(--fab-duration)}' +
        '@media(prefers-reduced-motion:reduce){.genux-fab{--fab-duration:0s!important;--fab-delay:0s!important}}',
    ),
    [],
  );
});

async function loadFabModel() {
  const { outputFiles } = await build({
    stdin: {
      contents: `export * from './options.ts'; export * from './geometry.ts';`,
      resolveDir: fileURLToPath(new URL('../src/fab/', import.meta.url)),
      sourcefile: 'fab-model-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    logLevel: 'silent',
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
  );
}

test('FAB model keeps ID-only uniqueness, unit custom origins, radial angular gaps, the arc contract, edge overlap and a TV scroll menu', async () => {
  const { normalizeFabOptions, validateFabActions, layoutFab, placeFabTrigger } =
    await loadFabModel();

  // Equal labels in different groups are valid; IDs stay unique, labels non-empty and the action limit binding.
  const shared = validateFabActions([
    { id: 'share-file', label: 'Share', group: 'file' },
    { id: 'share-link', label: 'Share', group: 'link' },
  ]);
  assert.deepEqual(
    shared.map(action => action.id),
    ['share-file', 'share-link'],
  );
  assert.throws(
    () =>
      validateFabActions([
        { id: 'same', label: 'One' },
        { id: 'same', label: 'Two' },
      ]),
    RangeError,
  );
  assert.throws(() => validateFabActions([{ id: 'blank', label: ' ' }]), TypeError);
  assert.throws(
    () =>
      validateFabActions(Array.from({ length: 65 }, (_, i) => ({ id: `a${i}`, label: 'Same' }))),
    RangeError,
  );

  // customOrigin is a 0..1 fraction of the trigger box; outside values are rejected instead of clamped.
  for (const customOrigin of [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0.25, y: 0.75 },
  ])
    assert.deepEqual(
      { ...normalizeFabOptions({ motion: { customOrigin } }).motion.customOrigin },
      customOrigin,
    );
  for (const customOrigin of [
    { x: -0.01, y: 0.5 },
    { x: 0.5, y: 1.01 },
    { x: -200, y: 200 },
  ])
    assert.throws(
      () => normalizeFabOptions({ motion: { customOrigin } }),
      RangeError,
      `${customOrigin.x},${customOrigin.y}`,
    );
  // A together sequence keeps the configured stagger; only its effective delay is zero.
  assert.equal(
    normalizeFabOptions({ motion: { sequence: 'together', stagger: 100 } }).motion.stagger,
    100,
  );

  // Every radial layout honours angularGap as a minimum separation; uniform steps below it leave the dial.
  const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
  const trigger = { x: 472, y: 472, width: 56, height: 56 };
  const actions = count =>
    Array.from({ length: count }, (_, i) => ({ id: `action-${i + 1}`, width: 40, height: 40 }));
  const dial = (layout, count, angularGap) =>
    layoutFab({
      bounds,
      trigger,
      actions: actions(count),
      options: normalizeFabOptions({ layout, arc: { angularGap } }),
    });
  for (const [layout, count, step] of [
    ['circle', 4, 90],
    ['semi-circle', 3, 90],
    ['quarter-circle', 2, 90],
  ]) {
    assert.equal(
      dial(layout, count, 0).mode,
      'dial',
      `${layout}: ${step} degree steps fit without a gap`,
    );
    assert.equal(dial(layout, count, step).mode, 'dial', `${layout}: a ${step} degree gap is met`);
    const crowded = dial(layout, count, step + 30);
    assert.notEqual(
      crowded.mode,
      'dial',
      `${layout}: ${step} degree steps cannot meet a ${step + 30} degree gap`,
    );
    assert.equal(crowded.collision, true, `${layout}: the gap fallback is reported`);
  }
  // RTL reflects every fixed radial action, by ID, across the trigger's vertical axis instead of only its heading.
  const centers = geometry =>
    new Map(geometry.positions.map(p => [p.id, { x: p.x + p.width / 2, y: p.y + p.height / 2 }]));
  for (const [layout, count] of [
    ['circle', 4],
    ['semi-circle', 3],
    ['quarter-circle', 2],
  ]) {
    const writing = rtl =>
      layoutFab({
        bounds,
        trigger,
        actions: actions(count),
        options: normalizeFabOptions({ layout }),
        rtl,
      });
    const ltr = writing(false);
    const flipped = writing(true);
    assert.equal(ltr.mode, 'dial', `${layout}: LTR keeps the dial`);
    assert.equal(flipped.mode, 'dial', `${layout}: RTL keeps the dial`);
    const left = centers(ltr);
    const right = centers(flipped);
    assert.deepEqual([...right.keys()], [...left.keys()], `${layout}: RTL keeps every action ID`);
    assert.equal(
      new Set([...left.values()].map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)).size,
      count,
      `${layout}: every action, including both arc endpoints, has its own slot`,
    );
    assert.ok(
      [...left.values()].some(p => Math.abs(p.x - 500) > 1),
      `${layout}: the reflection is not trivial`,
    );
    for (const [id, point] of left) {
      const reflected = right.get(id);
      assert.ok(
        Math.abs(reflected.x - (1000 - point.x)) < 1e-6 && Math.abs(reflected.y - point.y) < 1e-6,
        `${layout} ${id}: RTL (${reflected.x}, ${reflected.y}) mirrors LTR (${point.x}, ${point.y})`,
      );
    }
  }

  // The exported geometry boundary validates the arc contract of a directly supplied FabConfig.
  const defaults = normalizeFabOptions();
  const circle = arc => ({ ...defaults, layout: 'circle', arc: { ...defaults.arc, ...arc } });
  for (const arc of [{ radius: -10 }, { radius: 0 }, { angularGap: -5 }, { angularGap: 361 }])
    assert.throws(
      () => layoutFab({ bounds, trigger, actions: actions(3), options: circle(arc) }),
      RangeError,
      JSON.stringify(arc),
    );
  const explicit = layoutFab({
    bounds,
    trigger,
    actions: actions(3),
    options: circle({ radius: 150 }),
  });
  assert.equal(explicit.radius, 150, 'an explicit radius that fits is kept');
  assert.equal(
    explicit.collision,
    false,
    'a kept radius is not reported as a collision adjustment',
  );

  // Header and footer overlap straddle an internal reference edge, but the whole trigger stays usable inside the padded
  // bounds: a reference edge at or beyond the padded inset clamps the trigger inside instead of clipping it.
  const surface = { x: 0, y: 0, width: 400, height: 800 };
  const place = (edge, anchor) =>
    placeFabTrigger({
      bounds: surface,
      anchor,
      width: 56,
      height: 56,
      options: normalizeFabOptions({ edge, anchor: anchor ? 'element' : 'container' }),
    });
  assert.equal(
    place('header-overlap').y,
    8,
    'container header overlap stays inside the padded top',
  );
  assert.equal(
    place('footer-overlap').y,
    736,
    'container footer overlap stays inside the padded bottom',
  );
  const bar = { x: 0, y: 12, width: 400, height: 64 };
  assert.equal(
    place('header-overlap', bar).y,
    8,
    'an anchor edge above the padded inset clamps the trigger inside',
  );
  assert.equal(
    place('footer-overlap', bar).y,
    48,
    'element footer overlap straddles the anchor bottom',
  );
  assert.equal(place('normal').y, 728, 'normal edges keep the padded inset placement');
  for (const edge of ['header-overlap', 'footer-overlap'])
    for (const anchor of [undefined, bar]) {
      const { x, y } = place(edge, anchor);
      assert.ok(x >= 8 && x + 56 <= 392, `${edge}: the inline axis stays inside the padded bounds`);
      assert.ok(
        y >= 8 && y + 56 <= 792,
        `${edge}: the whole trigger stays inside the padded bounds`,
      );
    }
  // An internal reference edge keeps its exact straddle; a supplied anchor rect is the reference for any anchor option.
  const page = { x: 0, y: 0, width: 400, height: 500 };
  const toolbar = { x: 0, y: 100, width: 400, height: 64 };
  for (const anchor of ['viewport', 'container', 'element']) {
    const straddle = edge =>
      placeFabTrigger({
        bounds: page,
        anchor: toolbar,
        width: 56,
        height: 56,
        options: normalizeFabOptions({ edge, anchor }),
      });
    assert.equal(
      straddle('header-overlap').y,
      72,
      `${anchor}: header overlap centres on the top edge`,
    );
    assert.equal(
      straddle('footer-overlap').y,
      136,
      `${anchor}: footer overlap centres on the bottom edge`,
    );
  }
  assert.equal(
    placeFabTrigger({
      bounds: page,
      width: 56,
      height: 56,
      options: normalizeFabOptions({ edge: 'header-overlap', anchor: 'viewport' }),
    }).y,
    8,
    'a viewport header overlap without an anchor rect stays inside the padded bounds',
  );

  // An explicit spatial (TV) surface keeps a labelled floating menu with a bounded scroll region instead of a sheet.
  const screen = { x: 0, y: 0, width: 960, height: 360 };
  const remote = { x: 880, y: 280, width: 56, height: 56 };
  const header = { x: 0, y: 0, width: 960, height: 60 };
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: `tv-${i + 1}`,
    width: 64,
    height: 64,
    labelWidth: 2000,
    labelHeight: 24,
  }));
  const tv = layoutFab({
    bounds: screen,
    trigger: remote,
    actions: rows,
    options: defaults,
    obstacles: [header],
    spatial: true,
  });
  assert.equal(tv.mode, 'menu', 'TV overflow keeps the menu instead of a sheet');
  assert.equal(tv.layout, 'floating-menu');
  assert.equal(tv.collision, true, 'the scroll fallback is reported');
  assert.deepEqual(
    tv.positions.map(p => p.id),
    rows.map(r => r.id),
    'every action stays reachable in order',
  );
  const [first] = tv.positions;
  const panel = { x: first.x, y: first.y, width: first.width, height: tv.maxHeight };
  assert.ok(
    panel.height >= 64 && panel.height < 640,
    `the panel shows a full row and scrolls the rest: ${panel.height}`,
  );
  assert.ok(
    panel.x >= 0 && panel.x + panel.width <= screen.width,
    'oversized labels clamp the panel to the usable width',
  );
  assert.ok(panel.y >= header.y + header.height, 'the panel stops below the header obstacle');
  assert.ok(panel.y + panel.height <= remote.y, 'the panel stays clear of the trigger');
  tv.positions.forEach((p, i) => {
    assert.equal(p.height, 64, `${p.id} keeps its full row height`);
    assert.equal(p.width, panel.width, `${p.id} spans the panel`);
    assert.ok(Math.abs(p.y - (first.y + i * 64)) < 1e-6, `${p.id} follows the previous row`);
  });
  assert.deepEqual({ ...tv.panel }, panel, 'the TV scroll menu reports its explicit outer panel');
  assert.equal(explicit.panel, undefined, 'dials keep their geometry without a panel');

  // Menus report the exact panel: its top is the first row and its height the natural rows height.
  const menuRows = Array.from({ length: 3 }, (_, i) => ({
    id: `menu-${i + 1}`,
    width: 64,
    height: 64,
  }));
  const menu = layoutFab({
    bounds,
    trigger,
    actions: menuRows,
    options: normalizeFabOptions({ layout: 'floating-menu' }),
  });
  assert.equal(menu.mode, 'menu');
  const [row] = menu.positions;
  assert.deepEqual(
    { ...menu.panel },
    { x: row.x, y: row.y, width: row.width, height: 192 },
    'the menu panel starts at its first row',
  );
  assert.equal(menu.maxHeight, 192, 'maxHeight is the outer menu panel height');

  // A short phone sheet sits in a free slot between the header obstacle and the bottom trigger, padding its rows.
  const phone = { x: 0, y: 0, width: 360, height: 400 };
  const fab = { x: 288, y: 328, width: 56, height: 56 };
  const topBar = { x: 0, y: 0, width: 360, height: 60 };
  const sheetRows = Array.from({ length: 8 }, (_, i) => ({
    id: `sheet-${i + 1}`,
    width: 64,
    height: 64,
    labelWidth: 120,
    labelHeight: 24,
  }));
  const sheet = layoutFab({
    bounds: phone,
    trigger: fab,
    actions: sheetRows,
    options: normalizeFabOptions({ adaptation: 'sheet' }),
    obstacles: [topBar],
  });
  assert.equal(sheet.mode, 'sheet');
  assert.ok(sheet.panel, 'the sheet reports its explicit panel');
  const { panel: sheetPanel } = sheet;
  const disjoint = (a, b) =>
    a.x + a.width <= b.x + 1e-6 ||
    b.x + b.width <= a.x + 1e-6 ||
    a.y + a.height <= b.y + 1e-6 ||
    b.y + b.height <= a.y + 1e-6;
  assert.ok(
    sheetPanel.x >= 0 &&
      sheetPanel.y >= 0 &&
      sheetPanel.x + sheetPanel.width <= 360 &&
      sheetPanel.y + sheetPanel.height <= 400,
    'the sheet panel stays inside the bounds',
  );
  assert.ok(disjoint(sheetPanel, topBar), 'the sheet panel clears the header obstacle');
  assert.ok(disjoint(sheetPanel, fab), 'the sheet panel clears the trigger');
  assert.equal(sheet.collision, false, 'a free sheet slot is not a collision');
  assert.equal(sheet.maxHeight, sheetPanel.height, 'maxHeight is the outer sheet panel height');
  assert.ok(
    sheetPanel.height >= 64 + 16,
    `the sheet shows a full padded row: ${sheetPanel.height}`,
  );
  assert.deepEqual(
    sheet.positions.map(p => p.id),
    sheetRows.map(r => r.id),
    'every sheet row stays reachable in order',
  );
  sheet.positions.forEach((p, i) => {
    assert.equal(p.height, 64, `${p.id} keeps its natural row height`);
    assert.ok(
      Math.abs(p.y - (sheetPanel.y + 8 + i * 64)) < 1e-6,
      `${p.id} starts after the panel padding`,
    );
  });

  // Multi-directional arms keep the measured up/start/end anatomy clear of the trigger's own outside label: an arm
  // whose natural reach crosses that obstacle moves along its ray instead of dropping the dial to a menu or sheet.
  const fabGroups = [
    { id: 'create', direction: 'up' },
    { id: 'review', direction: 'start' },
    { id: 'archive', direction: 'end' },
  ];
  const labelled = (id, group, width, labelWidth) => ({
    id,
    group,
    width,
    height: 48,
    ...(labelWidth ? { labelWidth, labelHeight: 29 } : {}),
  });
  const grouped = [
    labelled('create-new', 'create', 134, 32),
    labelled('create-copy', 'create', 152),
    labelled('review-open', 'review', 159, 46),
    labelled('review-share', 'review', 120),
    labelled('archive-move', 'archive', 138, 38),
    labelled('archive-delete', 'archive', 151),
  ];
  const multiOptions = normalizeFabOptions({
    layout: 'multi-directional',
    labelPlacement: 'outside',
  });
  for (const [view, own, ownLabel] of [
    [
      { x: 0, y: 0, width: 1440, height: 900 },
      { x: 708, y: 438, width: 56, height: 56 },
      { x: 640, y: 451.5, width: 60, height: 29 },
    ],
    [
      { x: 0, y: 0, width: 1024, height: 480 },
      { x: 484, y: 212, width: 56, height: 56 },
      { x: 548, y: 225.5, width: 60, height: 29 },
    ],
  ]) {
    const name = `${view.width}x${view.height}`;
    const multi = layoutFab({
      bounds: view,
      trigger: own,
      actions: grouped,
      groups: fabGroups,
      options: multiOptions,
      obstacles: [ownLabel],
    });
    assert.equal(multi.mode, 'dial', `${name}: the dial fits beside the trigger label`);
    assert.equal(multi.layout, 'multi-directional', `${name}: the requested layout is kept`);
    assert.equal(multi.collision, true, `${name}: the obstacle clearance is reported`);
    assert.deepEqual(
      multi.positions.map(p => p.id),
      grouped.map(a => a.id),
      `${name}: every action keeps its ID and order`,
    );
    const parts = multi.positions.map(p => ({
      id: p.id,
      rects: [p.control, p.label].filter(Boolean),
    }));
    parts.forEach(({ id, rects }, index) => {
      for (const r of rects) {
        assert.ok(
          r.x >= 0 && r.y >= 0 && r.x + r.width <= view.width && r.y + r.height <= view.height,
          `${name} ${id}: stays inside the bounds`,
        );
        assert.ok(disjoint(r, own), `${name} ${id}: clears the trigger`);
        assert.ok(disjoint(r, ownLabel), `${name} ${id}: clears the trigger's outside label`);
        for (const other of parts.slice(index + 1))
          for (const q of other.rects)
            assert.ok(disjoint(r, q), `${name} ${id}: clears ${other.id}`);
      }
    });
    const control = new Map(multi.positions.map(p => [p.id, p.control]));
    for (const action of grouped) {
      const native = control.get(action.id);
      assert.ok(native, `${name} ${action.id}: reports its native control`);
      assert.equal(native.width, action.width, `${name} ${action.id}: keeps its natural width`);
      assert.equal(native.height, action.height, `${name} ${action.id}: keeps its natural height`);
    }
    const mid = { x: own.x + own.width / 2, y: own.y + own.height / 2 };
    const [up1, up2, start1, start2, end1, end2] = grouped.map(a => control.get(a.id));
    for (const r of [up1, up2])
      assert.ok(
        Math.abs(r.x + r.width / 2 - mid.x) < 1e-6 && r.y + r.height <= own.y,
        `${name}: the create arm opens up`,
      );
    for (const r of [start1, start2])
      assert.ok(
        Math.abs(r.y + r.height / 2 - mid.y) < 1e-6 && r.x + r.width <= own.x,
        `${name}: the review arm opens toward the start`,
      );
    for (const r of [end1, end2])
      assert.ok(
        Math.abs(r.y + r.height / 2 - mid.y) < 1e-6 && r.x >= own.x + own.width,
        `${name}: the archive arm opens toward the end`,
      );
    assert.ok(up2.y + up2.height <= up1.y, `${name}: create keeps its order`);
    assert.ok(start2.x + start2.width <= start1.x, `${name}: review keeps its order`);
    assert.ok(end2.x >= end1.x + end1.width, `${name}: archive keeps its order`);
    // The unobstructed create arm keeps its uniform gap from the trigger and between its rows.
    const lead = own.y - (up1.y + up1.height);
    assert.ok(
      lead > 0 && Math.abs(up1.y - (up2.y + up2.height) - lead) < 1e-6,
      `${name}: the unobstructed arm keeps a uniform gap`,
    );
  }

  // A feasible flipped arm is preferred unadjusted; moving the requested arm past an obstacle is a later resolution.
  const column = { x: 0, y: 0, width: 400, height: 800 };
  const low = { x: 320, y: 500, width: 56, height: 56 };
  const shelf = { x: 300, y: 360, width: 100, height: 130 };
  const flippedFirst = layoutFab({
    bounds: column,
    trigger: low,
    actions: actions(3),
    options: normalizeFabOptions({ layout: 'linear', direction: 'up' }),
    obstacles: [shelf],
  });
  assert.equal(flippedFirst.mode, 'dial', 'the linear dial is kept');
  assert.equal(flippedFirst.direction, 'down', 'the free flipped arm wins over obstacle clearance');
  assert.equal(flippedFirst.collision, true, 'the flip is reported as a collision resolution');
  for (const p of flippedFirst.positions) {
    assert.ok(p.y >= low.y + low.height, `${p.id} opens below the trigger`);
    assert.ok(disjoint(p, shelf), `${p.id} clears the obstacle`);
  }
});
