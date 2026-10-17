// FAB motion guard. validateFabMotionOwner bundles the pure FAB motion-role factory and checks its
// validated, bounded outputs; fabMotionFailures checks that FAB stylesheet motion consumes only those
// roles and the central Cubic tokens. Reuses the docs package's existing esbuild and postcss.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../docs/package.json', import.meta.url));
const postcss = require('postcss');
const MOTION_OWNER = new URL('../docs/src/fab/motion.ts', import.meta.url);

const STYLE_DEFAULTS = Object.freeze({
  '--fab-open-duration': '200ms',
  '--fab-close-duration': '140ms',
  '--fab-stagger': '40ms',
  '--fab-easing': 'var(--motion-easing)',
  '--fab-custom-origin-x': '50%',
  '--fab-custom-origin-y': '50%',
});
const MAX_COUNT = 64;
const MAX_DELAY = '6300ms';

// Only a bare reduce query is the exception; not, only or combined queries stay normal motion.
const REDUCED = /^\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/i;
const ZERO = /^0m?s$/;
const VAR = /^var\((--[\w-]+)\)$/;
const VAR_REFS = /var\((--[\w-]+)/g;
// Exact central duration names with positive motion.json values; invented names are not roles.
const CENTRAL_DURATIONS = new Set(
  Object.entries(require('./src/data/motion.json').durationMs)
    .filter(([, ms]) => Number.isFinite(ms) && ms > 0)
    .map(([name]) => `--motion-duration-${name}`),
);
const IDENT = /^-?[a-z][\w-]*$/i;
const EASING_KEYWORDS = new Set([
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'linear',
  'step-start',
  'step-end',
]);
// Transition property values that cover the whole element instead of named properties.
const WHOLE_PROPERTY = new Set([
  'all',
  'none',
  'initial',
  'inherit',
  'unset',
  'revert',
  'revert-layer',
]);
const STANDARD = 'var(--motion-duration-standard)';
const STAGGER_DELAY = 'calc(var(--fab-stagger) * var(--fab-order-index, 0))';
const DURATION_ROLES = new Set(['--fab-open-duration', '--fab-close-duration', '--fab-duration']);
// Master GenUXButton press/release roles reused by the FAB action face inset transition.
const MASTER_DURATIONS = new Set(['--press-duration', '--release-duration']);
// FAB press feedback runs on the central 116.667 ms button-feedback duration, directly or through the master
// press/release aliases that docs web.css binds to that same token.
const PRESS_DURATIONS = new Set(['--motion-duration-button-feedback', ...MASTER_DURATIONS]);
// Rank emitted by fabActionMotionStyle; validateFabMotionOwner bounds it to 0..63.
const FACTORY_OUTPUTS = new Set(['--fab-order-index']);
const LONGHANDS = Object.freeze({
  'transition-duration': 'duration',
  'animation-duration': 'duration',
  'transition-timing-function': 'easing',
  'animation-timing-function': 'easing',
  'transition-delay': 'delay',
  'animation-delay': 'delay',
});
// Stylesheet defaults of the roles the factory overrides inline with validated values.
const ROLE_RULES = Object.freeze({
  '--fab-open-duration': value => value === STANDARD,
  '--fab-close-duration': value => value === STANDARD,
  '--fab-duration': value => {
    const name = varName(value);
    return DURATION_ROLES.has(name) || CENTRAL_DURATIONS.has(name);
  },
  '--fab-easing': value => value === 'var(--motion-easing)',
  '--fab-stagger': value => value === 'var(--motion-delay)',
  '--fab-delay': value => value === 'var(--motion-delay)' || value === STAGGER_DELAY,
});

async function loadMotionOwner() {
  const { build } = require('esbuild');
  const { outputFiles } = await build({
    entryPoints: [fileURLToPath(MOTION_OWNER)],
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

function actionRoles(owner, options, count, role) {
  return Array.from(
    { length: count },
    (_, index) => owner.fabActionMotionStyle(options, index, count)[role],
  );
}

/** @returns {Promise<void>} */
export async function validateFabMotionOwner() {
  const owner = await loadMotionOwner();
  const { fabMotionDuration, fabMotionStyle, fabActionMotionStyle } = owner;

  // Only semantic custom-property roles leave the owner; easing is the central Cubic alias.
  assert.deepEqual({ ...fabMotionStyle(undefined, 0) }, STYLE_DEFAULTS);
  assert.deepEqual(
    { ...fabActionMotionStyle(undefined, 1, 4) },
    { '--fab-delay': '40ms', '--fab-order-index': '1' },
  );
  assert.equal(fabMotionDuration(undefined, true), 200);
  assert.equal(fabMotionDuration(undefined, false), 140);
  assert.throws(() => fabMotionDuration(undefined, 'true'), TypeError);

  for (const ms of [16, 2000]) {
    const options = { motion: { duration: ms, closeDuration: ms } };
    assert.equal(fabMotionDuration(options, true), ms);
    assert.equal(fabMotionDuration(options, false), ms);
    assert.equal(fabMotionStyle(options, 1)['--fab-open-duration'], `${ms}ms`);
    assert.equal(fabMotionStyle(options, 1)['--fab-close-duration'], `${ms}ms`);
  }
  for (const ms of [0, Number.NaN, Number.POSITIVE_INFINITY, 2001])
    for (const key of ['duration', 'closeDuration'])
      assert.throws(() => fabMotionStyle({ motion: { [key]: ms } }, 1), RangeError, `${key} ${ms}`);

  for (const count of [0, MAX_COUNT])
    assert.equal(fabMotionStyle(undefined, count)['--fab-easing'], 'var(--motion-easing)');
  for (const count of [-1, MAX_COUNT + 1, 1.5, Number.NaN, '1'])
    assert.throws(() => fabMotionStyle(undefined, count), RangeError, `count ${count}`);
  assert.equal(
    fabActionMotionStyle(undefined, MAX_COUNT - 1, MAX_COUNT)['--fab-order-index'],
    '63',
  );
  for (const [index, count] of [
    [-1, MAX_COUNT],
    [MAX_COUNT, MAX_COUNT],
    [0, 0],
    [0.5, 2],
  ])
    assert.throws(
      () => fabActionMotionStyle(undefined, index, count),
      RangeError,
      `index ${index} of ${count}`,
    );

  for (const stagger of [0, 100])
    assert.equal(fabMotionStyle({ motion: { stagger } }, 1)['--fab-stagger'], `${stagger}ms`);
  for (const stagger of [-1, 101, Number.NaN])
    assert.throws(
      () => fabMotionStyle({ motion: { stagger } }, 1),
      RangeError,
      `stagger ${stagger}`,
    );
  for (const order of ['forward', 'reverse', 'from-center']) {
    const delays = actionRoles(
      owner,
      { motion: { stagger: 100, order } },
      MAX_COUNT,
      '--fab-delay',
    ).map(value => Number.parseInt(value, 10));
    assert.equal(Math.min(...delays), 0, order);
    assert.equal(`${Math.max(...delays)}ms`, MAX_DELAY, order);
  }

  assert.deepEqual(
    actionRoles(owner, { motion: { order: 'from-center' } }, 4, '--fab-order-index'),
    ['2', '0', '1', '3'],
  );
  assert.deepEqual(
    actionRoles(owner, { motion: { sequence: 'together', stagger: 100 } }, 4, '--fab-delay'),
    ['0ms', '0ms', '0ms', '0ms'],
  );

  // customOrigin is a 0..1 fraction of the trigger box: distinct accepted values stay distinct, others throw.
  assert.deepEqual(
    [0, 0.25, 1].map(
      x => fabMotionStyle({ motion: { customOrigin: { x, y: 0.5 } } }, 1)['--fab-custom-origin-x'],
    ),
    ['0%', '25%', '100%'],
  );
  assert.equal(
    fabMotionStyle({ motion: { customOrigin: { x: 0.5, y: 0.75 } } }, 1)['--fab-custom-origin-y'],
    '75%',
  );
  for (const customOrigin of [
    { x: -0.01, y: 0.5 },
    { x: 0.5, y: 1.01 },
    { x: -200, y: 200 },
  ])
    assert.throws(
      () => fabMotionStyle({ motion: { customOrigin } }, 1),
      RangeError,
      `customOrigin ${customOrigin.x},${customOrigin.y}`,
    );

  assert.throws(() => fabMotionStyle({ unknownOption: true }, 1), TypeError);
  assert.throws(() => fabMotionStyle({ motion: { unknownMotion: true } }, 1), TypeError);

  // Curve policy awaits a human answer: only cubic is implemented.
  assert.equal(
    fabMotionStyle({ motion: { easing: 'cubic' } }, 1)['--fab-easing'],
    'var(--motion-easing)',
  );
  for (const easing of ['linear', 'ease-out', 'ease-in-out', 'spring', 'quart']) {
    assert.throws(() => fabMotionStyle({ motion: { easing } }, 1), RangeError, easing);
    assert.throws(() => fabActionMotionStyle({ motion: { easing } }, 0, 1), RangeError, easing);
    assert.throws(() => fabMotionDuration({ motion: { easing } }, true), RangeError, easing);
  }
}

/** @param {string} token @returns {string | undefined} */
function varName(token) {
  return VAR.exec(token)?.[1];
}

/** @param {string} name @returns {'duration' | 'easing' | 'delay' | undefined} */
function roleKind(name) {
  if (name === '--motion-easing' || name === '--fab-easing') return 'easing';
  if (name === '--motion-delay' || name === '--fab-delay') return 'delay';
  if (CENTRAL_DURATIONS.has(name) || DURATION_ROLES.has(name) || MASTER_DURATIONS.has(name))
    return 'duration';
  return undefined;
}

function isReduced(node) {
  for (let parent = node.parent; parent; parent = parent.parent)
    if (parent.type === 'atrule' && parent.name === 'media' && REDUCED.test(parent.params.trim()))
      return true;
  return false;
}

/** @param {string} name @param {Map<string, string[]>} definitions @param {Set<string>} path @returns {string | undefined} */
function resolveRole(name, definitions, path = new Set()) {
  if (!name.startsWith('--fab-') || FACTORY_OUTPUTS.has(name)) return undefined;
  if (!Object.hasOwn(ROLE_RULES, name)) return `${name} is not a validated FAB motion role`;
  if (path.has(name)) return `${name} has a cyclic default chain`;
  const values = definitions.get(name);
  if (values === undefined) return `${name} has no stylesheet default`;
  path.add(name);
  for (const value of values)
    for (const [, reference] of value.matchAll(VAR_REFS)) {
      const reason = resolveRole(reference, definitions, path);
      if (reason) return reason;
    }
  path.delete(name);
  return undefined;
}

function roleFailure(token, expected, resolve) {
  const name = varName(token);
  if (name === undefined || roleKind(name) !== expected)
    return `${token} is not a central ${expected} role`;
  return resolve(name);
}

// One shorthand item: property/keyframe idents plus exactly one duration and one easing role,
// an optional delay role after the duration, and no literal times or curves. A transition item names
// exactly one explicit property; none and an implicit or whole-element all are not motion items.
function shorthandFailure(item, resolve, transition) {
  const found = { duration: [], easing: [], delay: [] };
  const idents = [];
  let duration;
  for (const [index, token] of postcss.list.space(item).entries()) {
    const name = varName(token);
    const kind = name === undefined ? undefined : roleKind(name);
    if (kind !== undefined) {
      found[kind].push(index);
      if (kind === 'duration') duration = name;
      const reason = resolve(name);
      if (reason) return reason;
    } else if (!IDENT.test(token) || EASING_KEYWORDS.has(token))
      return `${token} is not a central motion role`;
    else idents.push(token);
  }
  if (found.duration.length !== 1 || found.easing.length !== 1 || found.delay.length > 1)
    return `${item} needs one duration and one easing role`;
  if (found.delay.length === 1 && found.delay[0] < found.duration[0])
    return `${item} places the delay before the duration`;
  if (transition && (idents.length !== 1 || WHOLE_PROPERTY.has(idents[0].toLowerCase())))
    return `${item} needs one explicit transition property`;
  // The face inset is the FAB press feedback; it runs on the central button-feedback duration.
  if (transition && idents[0].toLowerCase() === 'inset' && !PRESS_DURATIONS.has(duration))
    return `${item} needs the button-feedback press duration`;
  return undefined;
}

// Press-state timing lists may only carry FAB duration roles and the button-feedback press duration.
function pressFailures({ prop, value, parent }) {
  const selector = parent?.selector ?? '';
  if (
    prop !== 'transition-duration' ||
    !(selector.includes(':active') || selector.includes('[data-pressed'))
  )
    return [];
  return postcss.list
    .comma(value)
    .filter(token => {
      const name = varName(token);
      return !PRESS_DURATIONS.has(name) && !DURATION_ROLES.has(name);
    })
    .map(token => `${token} is not the button-feedback press duration`);
}

function normalFailures(declaration, resolve) {
  const { prop, value } = declaration;
  if (Object.hasOwn(LONGHANDS, prop))
    return [
      ...postcss.list
        .comma(value)
        .map(token => roleFailure(token, LONGHANDS[prop], resolve))
        .filter(Boolean),
      ...pressFailures(declaration),
    ];
  if (prop === 'transition-property')
    return postcss.list
      .comma(value)
      .filter(token => !IDENT.test(token) || WHOLE_PROPERTY.has(token.toLowerCase()))
      .map(token => `${token} is not an explicit transition property`);
  // Normal motion never switches off through none; only the reduced-motion exception may.
  if (prop === 'transition' || prop === 'animation')
    return postcss.list
      .comma(value)
      .map(item => shorthandFailure(item, resolve, prop === 'transition'))
      .filter(Boolean);
  return [];
}

// Central motion tokens, master press/release timing and the factory rank (validated 0..63) are
// never written by FAB CSS, not even under reduced motion.
function writeFailure(prop) {
  if (prop.startsWith('--motion-') || MASTER_DURATIONS.has(prop))
    return `${prop} is a central motion token`;
  if (FACTORY_OUTPUTS.has(prop)) return `${prop} is set only by the validated motion factory`;
  return undefined;
}

// Reduced motion is only a zero exception for the same roles and timings.
function reducedFailure({ prop, value }) {
  if (Object.hasOwn(ROLE_RULES, prop) && prop !== '--fab-easing')
    return ZERO.test(value) ? undefined : 'reduced-motion role must be zero';
  if (/^(transition|animation)-(duration|delay)$/.test(prop))
    return postcss.list.comma(value).every(part => ZERO.test(part))
      ? undefined
      : 'reduced-motion timing must be zero';
  if (prop === 'transition' || prop === 'animation')
    return value === 'none' ? undefined : 'reduced-motion shorthand must be none';
  return undefined;
}

/** @param {string} cssSource @returns {string[]} */
export function fabMotionFailures(cssSource) {
  const root = postcss.parse(cssSource);
  /** @type {Map<string, string[]>} */
  const definitions = new Map();
  /** @type {string[]} */
  const failures = [];
  const report = (declaration, reason) =>
    failures.push(
      `${declaration.parent?.selector ?? declaration.parent?.type} ${declaration.prop}: ${reason}`,
    );
  root.walkDecls(declaration => {
    const written = writeFailure(declaration.prop);
    if (written) report(declaration, written);
    else if (isReduced(declaration)) {
      const reason = reducedFailure(declaration);
      if (reason) report(declaration, reason);
    } else if (Object.hasOwn(ROLE_RULES, declaration.prop)) {
      if (!ROLE_RULES[declaration.prop](declaration.value))
        report(declaration, `${declaration.value} is not a validated FAB role default`);
      definitions.set(declaration.prop, [
        ...(definitions.get(declaration.prop) ?? []),
        declaration.value,
      ]);
    }
  });
  const resolve = name => resolveRole(name, definitions);
  for (const name of definitions.keys()) {
    const reason = resolve(name);
    if (reason) failures.push(`${name}: ${reason}`);
  }
  root.walkDecls(declaration => {
    if (isReduced(declaration)) return;
    for (const reason of normalFailures(declaration, resolve)) report(declaration, reason);
  });
  return failures;
}
