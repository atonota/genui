// FAB model contract tests. The real options.ts/geometry.ts modules are bundled with esbuild into a
// temporary directory; expectations come from docs/FAB-PLAN.md and docs/decisions/current.json.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { builtinModules, createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { openFabHarness } from './fab-harness.mjs';

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EPS = 0.5;
const SHORT_HEIGHT = 480;
const RADIUS_OPTIONS = ['0px', '3px', '5px', '100%'];
const DURATION_TOKENS = ['fast', 'normal', 'slow'];

const APPROVED = {
  type: ['single', 'extended', 'collapsible', 'speed-dial', 'menu', 'contextual', 'adaptive'],
  layout: [
    'linear',
    'diagonal',
    'circle',
    'semi-circle',
    'quarter-circle',
    'custom-arc',
    'multi-directional',
    'floating-menu',
    'sheet',
  ],
  direction: ['up', 'down', 'start', 'end', 'up-start', 'up-end', 'down-start', 'down-end'],
  shape: ['circle', 'rounded-square', 'squircle', 'square', 'pill', 'custom'],
  appearance: [
    'filled',
    'tonal',
    'outlined',
    'soft-outlined',
    'elevated',
    'flat',
    'semi-flat',
    'inset-press',
    'translucent',
    'branded',
  ],
  content: ['icon-only', 'text-only', 'icon-text'],
  labelPlacement: ['inside', 'outside', 'above', 'below', 'start', 'end'],
  labelVisibility: ['always', 'hover', 'focus', 'expanded-only'],
  tooltip: ['none', 'hover', 'focus', 'hover-focus'],
  iconPosition: ['start', 'end', 'top', 'bottom'],
  iconTransition: ['rotate', 'replace', 'morph', 'static'],
  density: ['compact', 'comfortable', 'spacious'],
  trigger: ['click', 'hover', 'long-press', 'gesture'],
  horizontal: ['start', 'center', 'end'],
  vertical: ['top', 'center', 'bottom'],
  anchor: ['viewport', 'container', 'element'],
  positioning: ['fixed', 'absolute', 'sticky'],
  edge: ['normal', 'header-overlap', 'footer-overlap'],
  entrance: ['fade', 'scale', 'slide', 'pop'],
  exit: ['fade', 'scale', 'slide'],
  sequence: ['together', 'staggered'],
  order: ['forward', 'reverse', 'from-center'],
  easing: ['cubic', 'linear', 'ease-out', 'ease-in-out', 'spring'],
  origin: ['trigger-center', 'edge', 'custom'],
  backdrop: ['none', 'transparent', 'dim', 'blur', 'dim-blur'],
  visibility: [
    'always',
    'hide-on-scroll-down',
    'show-on-scroll-up',
    'collapse-on-scroll',
    'expand-near-top',
    'contextual',
    'sticky-boundary',
  ],
  adaptation: ['auto', 'compact', 'expanded', 'sheet'],
  state: ['closed', 'opening', 'open', 'closing', 'disabled', 'busy'],
  actionType: ['action', 'link', 'panel', 'dialog'],
};
const TOP_LEVEL_AXES = [
  'type',
  'layout',
  'direction',
  'shape',
  'appearance',
  'content',
  'labelPlacement',
  'labelVisibility',
  'tooltip',
  'iconPosition',
  'iconTransition',
  'density',
  'trigger',
  'horizontal',
  'vertical',
  'anchor',
  'positioning',
  'edge',
  'backdrop',
  'visibility',
  'adaptation',
];
const MOTION_AXES = ['sequence', 'order', 'easing', 'origin'];
const BOOLEAN_FIELDS = [
  'modal',
  'critical',
  'draggable',
  'closeOnSelect',
  'closeOnOutside',
  'closeOnEscape',
  'closeOnScroll',
  'closeOnNavigation',
  'closeOnBlur',
  'toggleOnTrigger',
  'keepOpenOnError',
  'disableWhileLoading',
];
const UNSAFE_SCHEMES = ['javascript:', 'data:', 'vbscript:'];

let tmp;
let model;

function findModelDir() {
  if (process.env.FAB_MODEL_DIR) return resolve(process.env.FAB_MODEL_DIR);
  const skip = new Set(['node_modules', 'dist', 'build', 'coverage', 'tests']);
  const hits = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name) && !entry.name.startsWith('.')) walk(path);
      } else if (
        entry.name === 'options.ts' &&
        existsSync(join(dir, 'geometry.ts')) &&
        readFileSync(path, 'utf8').includes('normalizeFabOptions')
      ) {
        hits.push(dir);
      }
    }
  };
  walk(docsRoot);
  assert.equal(
    hits.length,
    1,
    `expected one FAB model directory under ${docsRoot}, found: ${hits.join(', ') || 'none'}`,
  );
  return hits[0];
}

const requireFromDocs = createRequire(join(docsRoot, 'package.json'));

// ESM resolution from this docs test first, so a package's import entry loads; CommonJS resolution is the fallback.
function resolveImport(specifier) {
  try {
    return import.meta.resolve(specifier);
  } catch {
    try {
      return pathToFileURL(requireFromDocs.resolve(specifier)).href;
    } catch {
      return null;
    }
  }
}

const SCRIPT_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'];

// The one FAB browser config is bundled like the model; installed packages stay external through absolute URLs.
async function loadFabConfig(dir) {
  const skip = new Set(['node_modules', 'dist', 'build', 'coverage']);
  const hits = [];
  const walk = folder => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name) && !entry.name.startsWith('.')) walk(path);
      } else if (
        entry.name.includes('fab.config.') &&
        SCRIPT_EXTENSIONS.some(extension => entry.name.endsWith(extension))
      ) {
        hits.push(path);
      }
    }
  };
  walk(docsRoot);
  assert.equal(
    hits.length,
    1,
    `expected one FAB browser config under ${docsRoot}, found: ${hits.join(', ') || 'none'}`,
  );
  const outfile = join(dir, 'fab-config.mjs');
  await build({
    entryPoints: [hits[0]],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
    // The bundle keeps the config's own module URL, so paths derived from import.meta.url stay in the repository.
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(hits[0]).href) },
    plugins: [
      {
        name: 'external-installed-packages',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^[^./]/ }, ({ path }) => {
            if (path.startsWith('node:') || builtinModules.includes(path))
              return { path, external: true };
            const url = resolveImport(path);
            return url ? { path: url, external: true } : undefined;
          });
        },
      },
    ],
  });
  return (await import(pathToFileURL(outfile).href)).default;
}

// The installed YAML parser reads the workflows; without one the check fails instead of parsing a subset.
async function loadYamlParser() {
  for (const [name, method] of [
    ['yaml', 'parse'],
    ['js-yaml', 'load'],
  ]) {
    const url = resolveImport(name);
    if (!url) continue;
    const module = await import(url);
    const parse = module[method] ?? module.default?.[method];
    if (typeof parse === 'function') return text => parse(text);
  }
  assert.fail('the workflow checks need the installed yaml or js-yaml parser');
}

before(async () => {
  const dir = findModelDir();
  tmp = await mkdtemp(join(tmpdir(), 'genux-fab-test-'));
  const outfile = join(tmp, 'fab-model.mjs');
  await build({
    stdin: {
      contents: `export * from ${JSON.stringify(join(dir, 'options.ts'))}; export * from ${JSON.stringify(join(dir, 'geometry.ts'))};`,
      resolveDir: dir,
      sourcefile: 'fab-model-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  model = await import(pathToFileURL(outfile).href);
});

after(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

const config = (options = {}) => model.normalizeFabOptions(deepFreeze(options));
const center = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const ids = list => list.map(item => item.id).sort();
const isFiniteRect = r => [r.x, r.y, r.width, r.height].every(Number.isFinite);
const overlaps = (a, b) =>
  a.x + EPS < b.x + b.width &&
  b.x + EPS < a.x + a.width &&
  a.y + EPS < b.y + b.height &&
  b.y + EPS < a.y + a.height;
const within = (r, b) =>
  r.x >= b.x - EPS &&
  r.y >= b.y - EPS &&
  r.x + r.width <= b.x + b.width + EPS &&
  r.y + r.height <= b.y + b.height + EPS;

function near(actual, expected, message, eps = EPS) {
  assert.ok(Math.abs(actual - expected) <= eps, `${message}: got ${actual}, expected ${expected}`);
}

// The public contract allows invalid input to be rejected by throwing or by normalizing it away.
function rejectsOr(fn, check) {
  let result;
  try {
    result = fn();
  } catch {
    return;
  }
  check(result);
}

function assertFiniteConfig(c) {
  assert.ok(Number.isFinite(c.offset.x) && Number.isFinite(c.offset.y), 'offset is finite');
  for (const key of ['startAngle', 'endAngle', 'radius', 'angularGap'])
    assert.ok(Number.isFinite(c.arc[key]), `arc.${key} is finite`);
  assert.ok(c.arc.radius > 0, 'arc.radius is positive');
  assert.ok(c.arc.angularGap >= 0, 'arc.angularGap is not negative');
  for (const key of ['duration', 'closeDuration']) {
    const value = c.motion[key];
    assert.ok(
      DURATION_TOKENS.includes(value) || (Number.isFinite(value) && value > 0),
      `motion.${key} is a token or positive finite number`,
    );
  }
  assert.ok(
    Number.isFinite(c.motion.stagger) && c.motion.stagger >= 0,
    'motion.stagger is finite and not negative',
  );
  assert.ok(
    Number.isFinite(c.motion.customOrigin.x) && Number.isFinite(c.motion.customOrigin.y),
    'motion.customOrigin is finite',
  );
  if (typeof c.radius === 'number')
    assert.ok(
      Number.isFinite(c.radius) && c.radius >= 0,
      'numeric radius is finite and not negative',
    );
  else assert.ok(RADIUS_OPTIONS.includes(c.radius), `radius ${c.radius} is an approved option`);
}

function measured(count, size = 40, extra = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `action-${i + 1}`,
    width: size,
    height: size,
    ...extra,
  }));
}

function layout({ bounds, trigger, actions, options, obstacles, rtl, spatial }) {
  const geometry = model.layoutFab(
    deepFreeze({ bounds, trigger, actions, options: config(options), obstacles, rtl, spatial }),
  );
  assert.deepEqual(
    ids(geometry.positions),
    ids(actions),
    'every action id is retained exactly once',
  );
  for (const p of geometry.positions) {
    assert.ok(isFiniteRect(p), `${p.id} has a finite rect`);
    assert.ok(within(p, bounds), `${p.id} stays inside bounds`);
  }
  return geometry;
}

function assertNoOverlap(positions) {
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      assert.ok(
        !overlaps(positions[i], positions[j]),
        `${positions[i].id} overlaps ${positions[j].id}`,
      );
    }
  }
}

function angleBetween(origin, a, b) {
  const ax = a.x - origin.x;
  const ay = a.y - origin.y;
  const bx = b.x - origin.x;
  const by = b.y - origin.y;
  const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

function pairwiseAngles(origin, points) {
  const angles = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1)
      angles.push(angleBetween(origin, points[i], points[j]));
  }
  return angles;
}

test('options expose every approved axis, keep Cubic/5px defaults and reject invalid options and actions', async () => {
  const { FAB_OPTIONS, FAB_DEFAULTS, normalizeFabOptions, validateFabActions } = model;
  for (const [axis, values] of Object.entries(APPROVED)) {
    assert.ok(FAB_OPTIONS[axis], `FAB_OPTIONS.${axis} exists`);
    assert.deepEqual(
      [...FAB_OPTIONS[axis]].sort(),
      [...values].sort(),
      `FAB_OPTIONS.${axis} matches the approved axis`,
    );
  }

  const defaults = normalizeFabOptions();
  assert.deepEqual(config({}), defaults, 'empty options normalize to the defaults');
  assert.deepEqual(
    config(structuredClone(defaults)),
    defaults,
    'normalizing a config is idempotent',
  );
  assert.deepEqual(
    config(structuredClone(FAB_DEFAULTS)),
    defaults,
    'FAB_DEFAULTS normalizes to the defaults',
  );
  assert.equal(
    defaults.motion.easing,
    'cubic',
    'Cubic stays current until the easing decision is answered',
  );
  assert.equal(defaults.radius, '5px', 'default radius follows the decision record');
  assert.equal(defaults.backdrop, 'none', 'a non-modal FAB defaults to no backdrop');
  assert.equal(
    config({ modal: false }).backdrop,
    'none',
    'an explicit non-modal FAB keeps no backdrop',
  );
  const modalDefaults = config({ modal: true });
  assert.equal(
    modalDefaults.backdrop,
    'dim-blur',
    'a modal FAB without a backdrop derives the shared dim-blur mask',
  );
  assert.deepEqual(
    config(structuredClone(modalDefaults)),
    modalDefaults,
    'a derived modal backdrop normalizes idempotently',
  );
  assert.equal(
    config({ modal: true, backdrop: 'none' }).backdrop,
    'none',
    'an explicit modal none is preserved for the renderer policy to reject',
  );
  assert.equal(
    config({ modal: true, backdrop: 'dim-blur' }).backdrop,
    'dim-blur',
    'an explicit modal dim-blur is kept',
  );
  for (const axis of TOP_LEVEL_AXES)
    assert.ok(APPROVED[axis].includes(defaults[axis]), `default ${axis} is approved`);
  for (const axis of MOTION_AXES)
    assert.ok(APPROVED[axis].includes(defaults.motion[axis]), `default motion.${axis} is approved`);
  for (const effect of defaults.motion.entrance)
    assert.ok(APPROVED.entrance.includes(effect), `default entrance ${effect}`);
  for (const effect of defaults.motion.exit)
    assert.ok(APPROVED.exit.includes(effect), `default exit ${effect}`);
  for (const field of BOOLEAN_FIELDS)
    assert.equal(typeof defaults[field], 'boolean', `${field} is boolean`);
  assertFiniteConfig(defaults);

  for (const axis of TOP_LEVEL_AXES) {
    for (const value of APPROVED[axis])
      assert.equal(config({ [axis]: value })[axis], value, `${axis}=${value} is accepted`);
    rejectsOr(
      () => config({ [axis]: 'not-an-option' }),
      c => assert.ok(APPROVED[axis].includes(c[axis]), `invalid ${axis} is rejected`),
    );
  }
  for (const axis of MOTION_AXES) {
    for (const value of APPROVED[axis])
      assert.equal(
        config({ motion: { [axis]: value } }).motion[axis],
        value,
        `motion.${axis}=${value} is accepted`,
      );
    rejectsOr(
      () => config({ motion: { [axis]: 'not-an-option' } }),
      c => assert.ok(APPROVED[axis].includes(c.motion[axis]), `invalid motion.${axis} is rejected`),
    );
  }
  for (const effect of APPROVED.entrance)
    assert.ok(
      config({ motion: { entrance: [effect] } }).motion.entrance.includes(effect),
      `entrance ${effect}`,
    );
  for (const effect of APPROVED.exit)
    assert.ok(
      config({ motion: { exit: [effect] } }).motion.exit.includes(effect),
      `exit ${effect}`,
    );
  rejectsOr(
    () => config({ motion: { exit: ['pop'] } }),
    c => assert.ok(!c.motion.exit.includes('pop'), 'pop is not an exit effect'),
  );

  for (const radius of RADIUS_OPTIONS)
    assert.equal(config({ radius }).radius, radius, `radius ${radius} is accepted`);
  for (const radius of [-1, NaN, Infinity, -Infinity, '7px', 'banana']) {
    rejectsOr(() => config({ radius }), assertFiniteConfig);
  }
  for (const bad of [NaN, Infinity, -Infinity]) {
    for (const options of [
      { offset: { x: bad, y: 0 } },
      { offset: { x: 0, y: bad } },
      { arc: { radius: bad } },
      { arc: { startAngle: bad } },
      { arc: { endAngle: bad } },
      { arc: { angularGap: bad } },
      { motion: { duration: bad } },
      { motion: { closeDuration: bad } },
      { motion: { stagger: bad } },
      { motion: { customOrigin: { x: bad, y: 0 } } },
    ])
      rejectsOr(() => config(options), assertFiniteConfig);
  }
  for (const options of [
    { motion: { duration: 0 } },
    { motion: { duration: -100 } },
    { motion: { closeDuration: -1 } },
    { motion: { stagger: -10 } },
    { arc: { radius: -10 } },
    { arc: { angularGap: -5 } },
  ]) {
    rejectsOr(() => config(options), assertFiniteConfig);
  }
  rejectsOr(
    () => config({ unknownField: true }),
    c => assert.ok(!('unknownField' in c), 'unknown option is dropped'),
  );
  rejectsOr(
    () => config({ motion: { unknownMotion: 1 } }),
    c => assert.ok(!('unknownMotion' in c.motion), 'unknown motion option is dropped'),
  );
  rejectsOr(
    () => config({ arc: { unknownArc: 1 } }),
    c => assert.ok(!('unknownArc' in c.arc), 'unknown arc option is dropped'),
  );

  const valid = deepFreeze([
    { id: 'create', label: 'Create record', actionType: 'action' },
    {
      id: 'docs',
      label: 'Open documentation',
      actionType: 'link',
      href: 'https://example.com/docs',
      target: '_blank',
    },
  ]);
  const snapshot = JSON.stringify(valid);
  const accepted = validateFabActions(valid);
  assert.deepEqual(ids(accepted), ['create', 'docs']);
  assert.equal(
    accepted.find(a => a.id === 'docs').href,
    'https://example.com/docs',
    'safe https link is kept',
  );
  assert.equal(JSON.stringify(valid), snapshot, 'validation does not mutate actions');

  rejectsOr(
    () =>
      validateFabActions(
        deepFreeze([
          { id: 'same', label: 'One' },
          { id: 'same', label: 'Two' },
        ]),
      ),
    r => assert.equal(new Set(r.map(a => a.id)).size, r.length, 'duplicate ids are rejected'),
  );
  for (const id of ['', '   ']) {
    rejectsOr(
      () => validateFabActions(deepFreeze([{ id, label: 'Blank id' }])),
      r =>
        assert.ok(
          r.every(a => typeof a.id === 'string' && a.id.trim() !== ''),
          'blank ids are rejected',
        ),
    );
  }
  rejectsOr(
    () => validateFabActions(deepFreeze([{ id: 'unlabelled', label: '' }])),
    r =>
      assert.ok(
        r.every(a => a.label.trim() !== ''),
        'actions keep an accessible label',
      ),
  );
  rejectsOr(
    () => validateFabActions(deepFreeze([{ id: 'odd', label: 'Odd type', actionType: 'rocket' }])),
    r =>
      assert.ok(
        r.every(a => a.actionType === undefined || APPROVED.actionType.includes(a.actionType)),
        'unknown action type is rejected',
      ),
  );
  for (const href of [
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html,hi',
    'vbscript:msgbox(1)',
  ]) {
    rejectsOr(
      () =>
        validateFabActions(
          deepFreeze([{ id: 'bad', label: 'Bad link', actionType: 'link', href }]),
        ),
      r =>
        assert.ok(
          r.every(
            a => !a.href || !UNSAFE_SCHEMES.some(s => a.href.trim().toLowerCase().startsWith(s)),
          ),
          `unsafe href ${href} is rejected`,
        ),
    );
  }

  // CI execution and deployment: the FAB browser config and the workflow DAG that runs it at one commit.
  const ciTmp = await mkdtemp(join(tmpdir(), 'genux-fab-ci-'));
  try {
    const fabConfig = await loadFabConfig(ciTmp);
    assert.equal(fabConfig.workers, 2, 'the FAB browser engines run on two workers');
    assert.equal(fabConfig.timeout, 60_000, 'the browser config default remains 60 s');
    assert.equal(
      fabConfig.globalTimeout,
      420_000,
      'the whole browser run has a finite 420 s global budget',
    );
    assert.equal(fabConfig.retries, 0, 'a failure is never retried into a pass');
    const projects = fabConfig.projects ?? [];
    assert.deepEqual(
      projects
        .map(project => project.use?.browserName ?? project.use?.defaultBrowserType ?? project.name)
        .sort(),
      ['chromium', 'firefox', 'webkit'],
      'one browser project per engine',
    );
    for (const project of projects)
      assert.deepEqual(
        { ...fabConfig.use, ...project.use }.viewport,
        { width: 1440, height: 1000 },
        `${project.name}: the desktop journeys default to a 1440x1000 viewport`,
      );
  } finally {
    await rm(ciTmp, { recursive: true, force: true });
  }
  const parseYaml = await loadYamlParser();
  const workflowDir = [
    join(docsRoot, '..', '.github', 'workflows'),
    join(docsRoot, '.github', 'workflows'),
  ].find(dir => existsSync(dir));
  assert.ok(workflowDir, 'the repository workflows exist');
  const workflows = readdirSync(workflowDir)
    .filter(name => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map(name => ({ name, text: readFileSync(join(workflowDir, name), 'utf8') }));
  const adaptiveFile = workflows.find(workflow => workflow.name === 'adaptive-ui.yml');
  assert.ok(adaptiveFile, 'the adaptive UI workflow exists');
  const adaptive = parseYaml(adaptiveFile.text);
  const on = adaptive.on;
  const triggers = typeof on === 'string' ? [on] : Array.isArray(on) ? on : Object.keys(on ?? {});
  assert.ok(
    triggers.includes('workflow_call'),
    'the adaptive UI workflow is reusable through workflow_call',
  );
  // A gate counts only through a step that has no if condition and cannot continue on error; a step that runs an
  // npm script is read together with that script's body.
  const packageScripts = [join(docsRoot, '..', 'package.json'), join(docsRoot, 'package.json')]
    .filter(path => existsSync(path))
    .map(path => JSON.parse(readFileSync(path, 'utf8')).scripts ?? {});
  const expand = (command, seen = new Set()) => {
    const tokens = command.split(/\s+/);
    const names = tokens.filter(
      (token, index) => ['run', 'run-script'].includes(tokens[index - 1]) && !seen.has(token),
    );
    for (const name of names) seen.add(name);
    const bodies = names.flatMap(name =>
      packageScripts.map(scripts => scripts[name]).filter(body => typeof body === 'string'),
    );
    return [command, ...bodies.map(body => expand(body, seen))].join(' ');
  };
  const steps = Object.values(adaptive.jobs ?? {}).flatMap(job =>
    (job?.steps ?? []).map(step => ({ job, step, run: expand(String(step?.run ?? '')) })),
  );
  const required = ({ job, step }) =>
    !job?.['continue-on-error'] && !step?.['continue-on-error'] && step?.if === undefined;
  // Focused gates match whole command tokens, so a step that drops one of their test paths no longer counts.
  const hasTokens = (run, expected) => {
    const tokens = run.split(/\s+/);
    return expected.every(token => tokens.includes(token));
  };
  for (const [gate, gated] of [
    [
      'decision admission',
      run => hasTokens(run, ['node', '--test', 'docs/tests/decision-admission.test.mjs']),
    ],
    ['adaptive contract', run => hasTokens(run, ['npm', 'run', 'docs:adaptive:test'])],
    [
      'focused FAB node and motion',
      run =>
        hasTokens(run, [
          'node',
          '--test',
          'docs/tests/fab.test.mjs',
          'docs/tests/component-motion.test.mjs',
          'docs/tests/interaction-stability.test.mjs',
        ]),
    ],
    ['type', run => run.includes('type') || run.includes('tsc')],
    ['lint', run => run.includes('lint')],
    ['format', run => run.includes('format') || run.includes('prettier')],
    ['FAB browser test', run => run.includes('playwright test') && run.includes('fab.config')],
  ])
    assert.ok(
      steps.some(entry => required(entry) && gated(entry.run)),
      `the adaptive UI workflow keeps its ${gate} gate as a required step`,
    );
  const concurrency = adaptive.concurrency;
  assert.ok(
    String(typeof concurrency === 'object' ? concurrency?.group : concurrency).includes(
      'github.workflow',
    ),
    'adaptive UI concurrency includes github.workflow, so a standalone run and a Pages call never cancel each other',
  );
  const pagesFile = workflows.find(workflow => workflow.text.includes('actions/deploy-pages'));
  assert.ok(pagesFile, 'a Pages deployment workflow exists');
  const pagesJobs = parseYaml(pagesFile.text).jobs ?? {};
  const needs = job => [job?.needs ?? []].flat();
  assert.equal(
    pagesJobs.verify?.uses,
    './.github/workflows/adaptive-ui.yml',
    'Pages verifies through the local reusable workflow, so the same GITHUB_SHA is checked',
  );
  assert.ok(needs(pagesJobs.build).includes('verify'), 'the Pages build needs verification');
  assert.ok(needs(pagesJobs.deploy).includes('build'), 'the Pages deploy needs the build');
  // Status functions or continue-on-error would let a job run after a failed need, so each runs on normal success.
  for (const name of ['verify', 'build', 'deploy']) {
    const job = pagesJobs[name];
    const condition = String(job?.if ?? '');
    assert.ok(!job?.['continue-on-error'], `the Pages ${name} job cannot continue on error`);
    assert.ok(
      !['always()', 'failure()', 'cancelled()'].some(status => condition.includes(status)),
      `the Pages ${name} job runs only after its needs succeed`,
    );
  }
});

test('linear speed dial stacks actions on the trigger axis with uniform spacing', () => {
  const bounds = { x: 0, y: 0, width: 400, height: 800 };
  const actions = measured(3);
  const up = { x: 320, y: 700, width: 56, height: 56 };
  const g = layout({
    bounds,
    trigger: up,
    actions,
    options: { type: 'speed-dial', layout: 'linear', direction: 'up' },
  });
  assert.equal(g.layout, 'linear');
  assert.equal(g.direction, 'up');
  assert.equal(g.mode, 'dial');
  assert.equal(g.collision, false);
  for (const p of g.positions) {
    near(center(p).x, 348, `${p.id} is centred on the trigger axis`);
    assert.ok(p.y + p.height <= up.y + EPS, `${p.id} sits above the trigger`);
  }
  const stack = [...g.positions].sort((a, b) => b.y - a.y);
  const gaps = stack.slice(1).map((p, i) => stack[i].y - (p.y + p.height));
  for (const gap of gaps) {
    assert.ok(gap >= -EPS, 'linear actions do not overlap');
    near(gap, gaps[0], 'linear spacing is uniform');
  }

  const down = { x: 20, y: 40, width: 56, height: 56 };
  const d = layout({
    bounds,
    trigger: down,
    actions,
    options: { type: 'speed-dial', layout: 'linear', direction: 'down' },
  });
  assert.equal(d.direction, 'down');
  for (const p of d.positions) {
    near(center(p).x, 48, `${p.id} is centred on the trigger axis`);
    assert.ok(p.y >= down.y + down.height - EPS, `${p.id} sits below the trigger`);
  }

  // Inside name placement still reserves a positive measured metadata box beside the control.
  const inside = layout({
    bounds,
    trigger: up,
    actions: measured(3, 40, { labelWidth: 120, labelHeight: 24 }),
    options: { type: 'speed-dial', layout: 'linear', direction: 'up', labelPlacement: 'inside' },
  });
  for (const p of inside.positions) {
    assert.ok(p.control && p.label, `${p.id}: inside placement reserves the metadata box`);
    near(p.label.width, 120, `${p.id}: metadata width`);
    near(p.label.height, 24, `${p.id}: metadata height`);
    assert.ok(
      within(p.control, p) && within(p.label, p),
      `${p.id}: control and metadata stay in the reserved box`,
    );
    assert.ok(!overlaps(p.control, p.label), `${p.id}: metadata does not cover the control`);
  }
  assertNoOverlap(inside.positions);
});

test('custom 0..90 degree arc keeps its radius, reaches both endpoints and honours angular gap', () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
  const trigger = { x: 472, y: 472, width: 56, height: 56 };
  const origin = center(trigger);
  const arc = { startAngle: 0, endAngle: 90, radius: 100 };
  for (const count of [1, 2, 6]) {
    const g = layout({
      bounds,
      trigger,
      actions: measured(count),
      options: { type: 'speed-dial', layout: 'custom-arc', arc },
    });
    assert.equal(g.layout, 'custom-arc', `count ${count}: layout`);
    assert.equal(g.mode, 'dial', `count ${count}: mode`);
    assert.ok(
      Number.isFinite(g.radius) && g.radius >= 100 - EPS,
      `count ${count}: radius is finite and at least the configured radius`,
    );
    if (count <= 2) near(g.radius, 100, `count ${count}: configured radius is kept`, 1);
    const centres = g.positions.map(center);
    for (const c of centres)
      near(
        Math.hypot(c.x - origin.x, c.y - origin.y),
        g.radius,
        `count ${count}: action sits on the arc`,
        1,
      );
    const angles = g.positions.map(p => p.angle).filter(angle => angle !== undefined);
    for (const angle of angles) {
      assert.ok(Number.isFinite(angle), `count ${count}: angle is finite`);
      assert.ok(
        angle >= -EPS && angle <= 90 + EPS,
        `count ${count}: angle ${angle} stays inside the arc`,
      );
    }
    if (count >= 2) {
      near(
        Math.max(...pairwiseAngles(origin, centres)),
        90,
        `count ${count}: actions reach both arc endpoints`,
        1,
      );
      if (angles.length === count) {
        near(Math.min(...angles), 0, `count ${count}: start endpoint`, 1);
        near(Math.max(...angles), 90, `count ${count}: end endpoint`, 1);
      }
    }
  }

  const gapped = layout({
    bounds,
    trigger,
    actions: measured(3),
    options: { type: 'speed-dial', layout: 'custom-arc', arc: { ...arc, angularGap: 30 } },
  });
  const separations = pairwiseAngles(origin, gapped.positions.map(center));
  assert.ok(
    Math.min(...separations) >= 30 - 1,
    `angular gap of 30 degrees is honoured: ${separations.join(', ')}`,
  );
  near(Math.max(...separations), 90, 'gapped arc still spans 0..90', 1);
});

test('trigger placement honours nine anchors, offsets and RTL start/end', () => {
  const bounds = { x: 100, y: 50, width: 1000, height: 800 };
  const offset = { x: 16, y: 24 };
  const xFor = {
    start: bounds.x + offset.x,
    end: bounds.x + bounds.width - 56 - offset.x,
    center: bounds.x + (bounds.width - 56) / 2,
  };
  const yFor = {
    top: bounds.y + offset.y,
    bottom: bounds.y + bounds.height - 56 - offset.y,
    center: bounds.y + (bounds.height - 56) / 2,
  };
  for (const rtl of [false, true]) {
    for (const horizontal of APPROVED.horizontal) {
      for (const vertical of APPROVED.vertical) {
        const options = config({
          anchor: 'container',
          edge: 'normal',
          horizontal,
          vertical,
          offset,
        });
        const rect = model.placeFabTrigger(
          deepFreeze({ bounds, width: 56, height: 56, options, rtl }),
        );
        const label = `${rtl ? 'rtl' : 'ltr'} ${horizontal}/${vertical}`;
        assert.ok(isFiniteRect(rect), `${label}: finite rect`);
        near(rect.width, 56, `${label}: width`);
        near(rect.height, 56, `${label}: height`);
        assert.ok(within(rect, bounds), `${label}: inside bounds`);
        const physical =
          rtl && horizontal !== 'center' ? (horizontal === 'start' ? 'end' : 'start') : horizontal;
        near(rect.x, xFor[physical], `${label}: x`, horizontal === 'center' ? offset.x : EPS);
        near(rect.y, yFor[vertical], `${label}: y`, vertical === 'center' ? offset.y : EPS);
      }
    }
  }

  const anchor = { x: 400, y: 300, width: 200, height: 100 };
  const anchoredOptions = config({
    anchor: 'element',
    edge: 'normal',
    horizontal: 'end',
    vertical: 'bottom',
    offset: { x: 8, y: 8 },
  });
  const anchored = model.placeFabTrigger(
    deepFreeze({ bounds, anchor, width: 56, height: 56, options: anchoredOptions }),
  );
  assert.ok(
    isFiniteRect(anchored) && within(anchored, bounds),
    'element-anchored trigger stays inside bounds',
  );
  const c = center(anchored);
  const reach = 56 + 8;
  assert.ok(
    c.x >= anchor.x - reach &&
      c.x <= anchor.x + anchor.width + reach &&
      c.y >= anchor.y - reach &&
      c.y <= anchor.y + anchor.height + reach,
    'element-anchored trigger stays attached to its anchor',
  );
});

test('collisions keep every action, and narrow, short and spatial surfaces fall back', () => {
  const bounds = { x: 0, y: 0, width: 400, height: 800 };
  const corner = { x: 280, y: 680, width: 120, height: 120 };
  const placementOptions = config({
    edge: 'normal',
    horizontal: 'end',
    vertical: 'bottom',
    offset: { x: 16, y: 16 },
  });
  const placed = model.placeFabTrigger(
    deepFreeze({ bounds, width: 56, height: 56, options: placementOptions, obstacles: [corner] }),
  );
  assert.ok(within(placed, bounds), 'trigger stays inside bounds');
  assert.ok(!overlaps(placed, corner), 'trigger avoids the obstacle');

  const trigger = { x: 320, y: 700, width: 56, height: 56 };
  const blocker = { x: 300, y: 560, width: 100, height: 120 };
  const blocked = layout({
    bounds,
    trigger,
    actions: measured(3),
    options: { type: 'speed-dial', layout: 'linear', direction: 'up' },
    obstacles: [blocker],
  });
  assert.equal(blocked.collision, true, 'collision is reported');
  for (const p of blocked.positions) {
    assert.ok(!overlaps(p, blocker), `${p.id} avoids the obstacle`);
    assert.ok(!overlaps(p, trigger), `${p.id} does not cover the trigger`);
  }
  assertNoOverlap(blocked.positions);

  const six = measured(6, 48);
  const phone = layout({
    bounds: { x: 0, y: 0, width: 320, height: 640 },
    trigger: { x: 248, y: 568, width: 56, height: 56 },
    actions: six,
    options: { type: 'speed-dial', layout: 'circle' },
  });
  assert.equal(phone.mode, 'menu', 'six circle actions at 320 CSS px fall back to a menu');
  assertNoOverlap(phone.positions);

  const short = { x: 0, y: 0, width: 800, height: SHORT_HEIGHT - 80 };
  const sheet = layout({
    bounds: short,
    trigger: { x: 728, y: 328, width: 56, height: 56 },
    actions: six,
    options: { type: 'speed-dial', layout: 'circle' },
  });
  assert.equal(sheet.mode, 'sheet', 'short height falls back to a sheet');
  assert.ok(
    sheet.maxHeight > 0 && sheet.maxHeight <= short.height + EPS,
    'sheet height fits the surface',
  );
  assertNoOverlap(sheet.positions);

  const spatial = layout({
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    trigger: { x: 1832, y: 992, width: 56, height: 56 },
    actions: measured(4, 56, { labelWidth: 180, labelHeight: 24 }),
    options: { type: 'speed-dial', layout: 'circle' },
    spatial: true,
  });
  assert.equal(spatial.mode, 'menu', 'spatial navigation uses a labelled menu');
  assertNoOverlap(spatial.positions);

  // Public group arms support only the six dial layouts; a nested menu, sheet or multi-directional arm throws, while
  // every top-level layout keeps working.
  const groupInput = arm =>
    deepFreeze({
      bounds: { x: 0, y: 0, width: 1000, height: 1000 },
      trigger: { x: 472, y: 472, width: 56, height: 56 },
      actions: measured(2).map(action => ({ ...action, group: 'arm' })),
      groups: [{ id: 'arm', direction: 'up', layout: arm }],
      options: config({ type: 'speed-dial', layout: 'multi-directional' }),
    });
  for (const arm of ['floating-menu', 'sheet', 'multi-directional'])
    assert.throws(
      () => model.layoutFab(groupInput(arm)),
      Error,
      `a nested ${arm} group arm is rejected`,
    );
  for (const arm of ['linear', 'diagonal', 'circle', 'semi-circle', 'quarter-circle', 'custom-arc'])
    assert.deepEqual(
      ids(model.layoutFab(groupInput(arm)).positions),
      ['action-1', 'action-2'],
      `a ${arm} group arm keeps every action`,
    );
  for (const top of APPROVED.layout)
    layout({
      bounds: { x: 0, y: 0, width: 1000, height: 1000 },
      trigger: { x: 472, y: 472, width: 56, height: 56 },
      actions: measured(2),
      options: { type: 'speed-dial', layout: top },
    });
});

test('action policy filters hidden or denied actions and explains unavailable ones without mutation', async () => {
  const { resolveFabActions, actionUnavailableReason } = model;
  let calls = 0;
  const onAction = () => {
    calls += 1;
  };
  const actions = deepFreeze([
    { id: 'ok', label: 'Create', onAction },
    { id: 'hidden', label: 'Hidden', visible: false, onAction },
    { id: 'denied', label: 'Denied', permission: false, onAction },
    { id: 'off', label: 'Archive', disabled: true, disabledReason: 'Archived record' },
    { id: 'offPlain', label: 'Delete', disabled: true },
    { id: 'busy', label: 'Sync', loading: true },
    { id: 'net', label: 'Publish', offlineAvailable: false },
    { id: 'cache', label: 'Draft', offlineAvailable: true },
  ]);
  const snapshot = JSON.stringify(actions);
  const byId = Object.fromEntries(actions.map(a => [a.id, a]));

  const online = resolveFabActions(actions, true);
  assert.deepEqual(
    ids(online),
    ['busy', 'cache', 'net', 'off', 'offPlain', 'ok'].sort(),
    'hidden and denied actions are filtered',
  );
  assert.equal(
    online.find(a => a.id === 'off').disabled,
    true,
    'disabled actions stay listed as disabled',
  );
  const offline = resolveFabActions(actions, false);
  assert.ok(ids(offline).includes('cache'), 'offline-capable action stays available offline');
  for (const id of ['hidden', 'denied'])
    assert.ok(!ids(offline).includes(id), `${id} stays filtered offline`);

  assert.equal(actionUnavailableReason(byId.ok, true), undefined);
  assert.equal(actionUnavailableReason(byId.net, true), undefined);
  assert.equal(actionUnavailableReason(byId.net), undefined, 'online is the default');
  assert.equal(actionUnavailableReason(byId.cache, false), undefined);
  assert.equal(
    actionUnavailableReason(byId.off, true),
    'Archived record',
    'explicit disabled reason is surfaced',
  );
  for (const [id, isOnline] of [
    ['offPlain', true],
    ['busy', true],
    ['net', false],
  ]) {
    const reason = actionUnavailableReason(byId[id], isOnline);
    assert.equal(typeof reason, 'string', `${id} has a reason`);
    assert.ok(reason.trim().length > 0, `${id} reason is not empty`);
  }

  const granted = deepFreeze(
    actions.map(a =>
      a.id === 'denied'
        ? { ...a, permission: true }
        : a.id === 'hidden'
          ? { ...a, visible: true }
          : a,
    ),
  );
  const regranted = ids(resolveFabActions(granted, true));
  assert.ok(regranted.includes('denied'), 'permission is re-evaluated on every call');
  assert.ok(regranted.includes('hidden'), 'visibility is re-evaluated on every call');
  assert.ok(
    !ids(resolveFabActions(actions, true)).includes('denied'),
    'earlier calls do not leak state',
  );

  assert.equal(JSON.stringify(actions), snapshot, 'policy resolution does not mutate actions');
  assert.equal(calls, 0, 'policy resolution never runs actions');

  // The real useFab.ts runs under React and JSDOM through fab-harness.mjs. Unverified here: browser geometry and
  // computed styles, physical key activation, real focus order, touch hardware, TV, and closeOnScroll, which the
  // position hook owns and the browser scroll case covers, so useFab has no scroll listener to exercise.
  const h = await openFabHarness();
  try {
    const item = (id, extra = {}) => ({ id, label: id, ...extra });
    const tracked = () => {
      const log = [];
      return { log, onOpenChange: (open, reason) => log.push([open, reason]) };
    };
    const done = () => Promise.resolve();
    const focused = () => h.window.document.activeElement;
    const settle = (run, release) =>
      h.act(async () => {
        release();
        return run.pending;
      });

    const closers = [
      ['closeOnSelect', 'select', () => h.invoke(h.fab.actions[0])],
      ['closeOnOutside', 'outside', () => h.pointer(h.page.outside, 'pointerdown')],
      [
        'closeOnEscape',
        'escape',
        async () => {
          await h.focus(h.actions()[0]);
          await h.key(h.actions()[0], 'Escape');
        },
      ],
      [
        'closeOnNavigation',
        'navigation',
        () => h.dispatch(h.window, new h.window.HashChangeEvent('hashchange')),
      ],
      [
        'closeOnNavigation',
        'navigation',
        () => h.dispatch(h.window, new h.window.PopStateEvent('popstate')),
      ],
      [
        'closeOnBlur',
        'blur',
        () =>
          h.dispatch(
            h.actions()[0],
            new h.window.FocusEvent('focusout', { bubbles: true, relatedTarget: h.page.outside }),
          ),
      ],
      ['toggleOnTrigger', 'trigger', () => h.click(h.trigger())],
      ['toggleOnTrigger', 'keyboard', () => h.click(h.trigger(), 0)],
    ];
    for (const [flag, reason, close] of closers) {
      for (const enabled of [false, true]) {
        const label = `${flag}=${enabled} (${reason})`;
        const { log, onOpenChange } = tracked();
        await h.mount(
          { actions: [item('Share', { onAction: done })], defaultOpen: true, onOpenChange },
          { [flag]: enabled },
        );
        await close();
        assert.deepEqual(log, enabled ? [[false, reason]] : [], `${label}: reported close`);
        assert.equal(h.fab.open, !enabled, `${label}: open state`);
        assert.equal(
          h.actions().length,
          enabled ? 0 : 1,
          `${label}: rendered actions follow the open state`,
        );
        if (enabled && ['select', 'escape'].includes(reason))
          assert.equal(focused(), h.trigger(), `${label}: focus returns to the trigger`);
      }
    }

    let finish;
    let runs = 0;
    await h.mount({
      actions: [
        item('Sync', {
          onAction: () =>
            new Promise(resolve => {
              runs += 1;
              finish = resolve;
            }),
        }),
      ],
      defaultOpen: true,
    });
    const first = await h.start(h.fab.actions[0]);
    assert.equal(h.fab.busyId, 'Sync', 'a pending action is busy');
    assert.equal(await h.invoke(h.fab.actions[0]), false, 'a second invoke while busy is refused');
    assert.equal(await settle(first, finish), true, 'the settled handler resolves true');
    assert.equal(runs, 1, 'single flight runs the handler once');
    assert.equal(h.fab.busyId, null, 'busy clears after success');

    for (const keepOpenOnError of [false, true]) {
      const { log, onOpenChange } = tracked();
      const reports = [];
      const onError = (cause, action) => {
        reports.push([cause.message, action.id]);
        throw new Error('reporter down');
      };
      await h.mount(
        {
          actions: [
            item('Publish', { onAction: () => Promise.reject(new Error('Publish failed')) }),
          ],
          defaultOpen: true,
          onOpenChange,
          onError,
        },
        { keepOpenOnError },
      );
      assert.equal(
        await h.invoke(h.fab.actions[0]),
        false,
        `keepOpenOnError=${keepOpenOnError}: a rejected handler resolves false`,
      );
      assert.deepEqual(
        reports,
        [['Publish failed', 'Publish']],
        'onError receives the original error and action',
      );
      assert.equal(h.fab.error, 'Publish failed', 'the actual thrown message is shown');
      assert.equal(h.fab.busyId, null, 'busy clears even when onError throws');
      assert.equal(
        h.fab.open,
        keepOpenOnError,
        `keepOpenOnError=${keepOpenOnError}: open state after the error`,
      );
      assert.deepEqual(
        log,
        keepOpenOnError ? [] : [[false, 'error']],
        `keepOpenOnError=${keepOpenOnError}: close report`,
      );
    }

    for (const change of ['permission', 'removed']) {
      let release;
      const onAction = () =>
        new Promise(resolve => {
          release = resolve;
        });
      const { log, onOpenChange } = tracked();
      const props = share => ({
        actions: share ? [share, item('Copy')] : [item('Copy')],
        defaultOpen: true,
        onOpenChange,
      });
      await h.mount(props(item('Share', { onAction })));
      const run = await h.start(h.fab.actions[0]);
      await h.render(
        props(change === 'removed' ? null : item('Share', { onAction, permission: false })),
      );
      assert.equal(
        await settle(run, release),
        false,
        `${change}: a pending action that is no longer offered resolves false`,
      );
      assert.deepEqual(log, [], `${change}: the panel is not closed as a selection`);
    }

    for (const outcome of ['resolve', 'reject']) {
      // Removing a pending action and offering the same meaning again does not revive the removed run.
      let release;
      let fail;
      const reports = [];
      const { log, onOpenChange } = tracked();
      const onAction = () =>
        new Promise((resolve, reject) => {
          release = resolve;
          fail = reject;
        });
      const props = actions => ({
        actions,
        defaultOpen: true,
        onOpenChange,
        onError: (cause, action) => {
          reports.push([cause.message, action.id]);
        },
      });
      await h.mount(props([item('Share', { onAction }), item('Copy')]));
      const run = await h.start(h.fab.actions[0]);
      await h.render(props([item('Copy')]));
      await h.render(props([item('Share', { onAction }), item('Copy')]));
      const stale = await settle(run, () =>
        outcome === 'resolve' ? release() : fail(new Error('Stale share failed')),
      );
      assert.equal(
        stale,
        false,
        `${outcome}: a reintroduced action does not complete the removed run`,
      );
      assert.deepEqual(log, [], `${outcome}: the stale run closes nothing`);
      assert.deepEqual(reports, [], `${outcome}: the stale run reports no error`);
      assert.equal(h.fab.error, '', `${outcome}: the stale run shows no error`);
      assert.equal(h.fab.busyId, null, `${outcome}: busy clears after the stale run`);
      const retry = await h.start(h.fab.actions[0]);
      assert.equal(
        await settle(retry, () => release()),
        true,
        `${outcome}: a fresh activation of the reintroduced action succeeds`,
      );
    }

    {
      // A rejection after unmount reaches neither the stale component nor the parent reporter.
      let fail;
      const reports = [];
      await h.mount({
        actions: [
          item('Upload', {
            onAction: () =>
              new Promise((resolve, reject) => {
                fail = reject;
              }),
          }),
        ],
        defaultOpen: true,
        onError: cause => {
          reports.push(cause.message);
        },
      });
      const run = await h.start(h.fab.actions[0]);
      await h.unmount();
      assert.equal(
        await settle(run, () => fail(new Error('Upload failed late'))),
        false,
        'a run settling after unmount resolves false',
      );
      assert.deepEqual(reports, [], 'the parent reporter is not called after unmount');
    }

    for (const disableWhileLoading of [false, true]) {
      const label = `disableWhileLoading=${disableWhileLoading}`;
      const releases = {};
      const runs = { Alpha: 0, Beta: 0 };
      const deferred = id =>
        item(id, {
          onAction: () =>
            new Promise(resolve => {
              runs[id] += 1;
              releases[id] = resolve;
            }),
        });
      await h.mount(
        { actions: [deferred('Alpha'), deferred('Beta')], defaultOpen: true },
        { disableWhileLoading, closeOnSelect: false },
      );
      const running = () => [...(h.fab.busyIds ?? [])].sort();
      const [alpha, beta] = h.fab.actions;
      const first = await h.start(alpha);
      assert.equal(
        await h.invoke(alpha),
        false,
        `${label}: a duplicate of a running action is refused`,
      );
      if (disableWhileLoading) {
        assert.equal(
          await h.invoke(beta),
          false,
          `${label}: another action waits for the running one`,
        );
        assert.deepEqual(runs, { Alpha: 1, Beta: 0 }, `${label}: only the first action runs, once`);
        assert.deepEqual(running(), ['Alpha'], `${label}: busyIds lists the running action`);
        assert.equal(
          await settle(first, () => releases.Alpha()),
          true,
          `${label}: the running action settles`,
        );
        assert.deepEqual(running(), [], `${label}: busy clears after it settles`);
        continue;
      }
      const second = await h.start(beta);
      assert.deepEqual(
        runs,
        { Alpha: 1, Beta: 1 },
        `${label}: independent actions both run, once each`,
      );
      assert.deepEqual(
        running(),
        ['Alpha', 'Beta'],
        `${label}: busyIds lists every running action`,
      );
      assert.equal(
        await settle(first, () => releases.Alpha()),
        true,
        `${label}: the first action settles`,
      );
      assert.deepEqual(running(), ['Beta'], `${label}: settling one action leaves the other busy`);
      assert.equal(
        await settle(second, () => releases.Beta()),
        true,
        `${label}: the second action settles`,
      );
      assert.deepEqual(running(), [], `${label}: busy clears after the last action settles`);
    }

    let confirmed = 0;
    await h.mount({
      actions: [
        item('Delete', {
          confirmation: 'Delete this record?',
          onAction: () => {
            confirmed += 1;
          },
        }),
      ],
      defaultOpen: true,
    });
    const removal = h.fab.actions[0];
    assert.equal(await h.invoke(removal), false, 'a confirmed action first asks for confirmation');
    assert.equal(h.fab.confirmation?.id, 'Delete', 'the confirmation is pending');
    await h.act(() => h.fab.cancelConfirmation());
    assert.equal(h.fab.confirmation, null, 'cancel clears the pending confirmation');
    assert.equal(
      await h.invoke(removal, true),
      false,
      'a cancelled confirmation cannot be confirmed later',
    );
    assert.equal(confirmed, 0, 'nothing runs before confirmation');
    await h.invoke(removal);
    assert.equal(await h.invoke(removal, true), true, 'the confirmed action runs');
    assert.equal(confirmed, 1, 'the confirmed action runs once');

    {
      const { log, onOpenChange } = tracked();
      const props = { actions: [item('Share')], defaultOpen: true, loading: true, onOpenChange };
      await h.mount(props);
      await h.render({ ...props, actions: [item('Share')] });
      await h.act(() => h.fab.requestOpen(true, 'api'));
      assert.deepEqual(log, [[false, 'loading']], 'loading blocks the panel with one close report');
      assert.equal(h.fab.state, 'busy', 'loading shows a busy state');
      assert.equal(h.actions().length, 0, 'a loading-blocked panel renders no actions');
    }

    {
      const { log, onOpenChange } = tracked();
      const props = { actions: [item('Share')], open: false, onOpenChange };
      await h.mount(props);
      await h.act(() => h.fab.requestOpen(true, 'api'));
      await h.act(() => h.fab.requestOpen(true, 'api'));
      assert.deepEqual(
        log,
        [[true, 'api']],
        'repeated requests before the owner answers are reported once',
      );
      assert.equal(h.fab.open, false, 'a controlled panel stays closed until its owner opens it');
      assert.equal(h.actions().length, 0, 'no DOM claims the unanswered panel is open');
      await h.render({ ...props, open: true });
      assert.equal(h.actions().length, 1, 'the owner opens the panel');
    }

    {
      const { log, onOpenChange } = tracked();
      await h.mount({ actions: [item('Share')], onOpenChange }, { trigger: 'hover' });
      await h.pointer(h.trigger(), 'pointerover');
      assert.deepEqual(log, [], 'hover does not open without a fine hover pointer');
      h.media.hover = true;
      await h.pointer(h.trigger(), 'pointerover');
      h.media.hover = false;
      assert.equal(h.actions().length, 1, 'mouse hover opens a hover trigger');
      await h.pointer(h.fab.rootRef.current, 'pointerleave');
      assert.deepEqual(
        log,
        [
          [true, 'hover'],
          [false, 'hover'],
        ],
        'leaving closes a hover-opened panel',
      );
    }

    {
      // A hover-opened panel owns its trigger and action boxes, gaps included: leaving the root over the transparent
      // gap keeps it open, and only leaving that whole box closes it once. JSDOM has no layout, so the boxes are
      // stubbed here; this proves the hook's region logic, not real browser hit testing.
      const { log, onOpenChange } = tracked();
      await h.mount({ actions: [item('Share'), item('Copy')], onOpenChange }, { trigger: 'hover' });
      h.media.hover = true;
      await h.pointer(h.trigger(), 'pointerover');
      h.media.hover = false;
      const [share, copy] = h.actions();
      assert.ok(share && copy, 'mouse hover opens both actions');
      const box = (element, x, y, width, height) =>
        Object.defineProperty(element, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({
            x,
            y,
            width,
            height,
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
          }),
        });
      box(h.fab.triggerRef.current, 300, 700, 56, 56);
      box(share, 308, 620, 40, 40);
      box(copy, 308, 560, 40, 40);
      await h.pointer(h.fab.rootRef.current, 'pointerleave', { clientX: 328, clientY: 680 });
      assert.deepEqual(
        log,
        [[true, 'hover']],
        'crossing the gap from the trigger to an action keeps the panel',
      );
      await h.pointer(h.page.outside, 'pointermove', { clientX: 328, clientY: 610 });
      assert.deepEqual(
        log,
        [[true, 'hover']],
        'moving through the gap between actions keeps the panel',
      );
      assert.equal(h.actions().length, 2, 'the actions stay rendered inside the owned area');
      await h.pointer(h.page.outside, 'pointermove', { clientX: 20, clientY: 20 });
      await h.pointer(h.page.outside, 'pointermove', { clientX: 10, clientY: 10 });
      assert.deepEqual(
        log,
        [
          [true, 'hover'],
          [false, 'hover'],
        ],
        'leaving the owned hover area closes once',
      );
    }

    {
      // Closing a hover-opened panel by any other path removes its document pointer tracker before the next pointer
      // event, and unmounting removes it too. Only pointermove listeners added to the owner document are counted.
      const { log, onOpenChange } = tracked();
      const doc = h.window.document;
      const { addEventListener, removeEventListener } = doc;
      const trackers = new Set();
      doc.addEventListener = function (type, listener, options) {
        if (type === 'pointermove') trackers.add(listener);
        return addEventListener.call(this, type, listener, options);
      };
      doc.removeEventListener = function (type, listener, options) {
        if (type === 'pointermove') trackers.delete(listener);
        return removeEventListener.call(this, type, listener, options);
      };
      const box = (element, x, y, width, height) =>
        Object.defineProperty(element, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({
            x,
            y,
            width,
            height,
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
          }),
        });
      const hoverIntoGap = async () => {
        h.media.hover = true;
        await h.pointer(h.trigger(), 'pointerover');
        h.media.hover = false;
        const [share, copy] = h.actions();
        box(h.fab.triggerRef.current, 300, 700, 56, 56);
        box(share, 308, 620, 40, 40);
        box(copy, 308, 560, 40, 40);
        await h.pointer(h.fab.rootRef.current, 'pointerleave', { clientX: 328, clientY: 680 });
      };
      try {
        await h.mount(
          { actions: [item('Share'), item('Copy')], onOpenChange },
          { trigger: 'hover' },
        );
        await hoverIntoGap();
        assert.equal(trackers.size, 1, 'leaving over the gap tracks the pointer on the document');
        await h.act(() => h.fab.requestOpen(false, 'api'));
        assert.deepEqual(
          log,
          [
            [true, 'hover'],
            [false, 'api'],
          ],
          'the api close is reported once',
        );
        assert.equal(
          trackers.size,
          0,
          'closing removes the hover tracker before the next pointer event',
        );
        await hoverIntoGap();
        assert.equal(trackers.size, 1, 'a new hover opening tracks the gap again');
        await h.unmount();
        assert.equal(trackers.size, 0, 'unmounting removes the hover tracker');
      } finally {
        delete doc.addEventListener;
        delete doc.removeEventListener;
      }
    }

    await h.withTimers(async tick => {
      const { log, onOpenChange } = tracked();
      const touch = { pointerType: 'touch' };
      await h.mount({ actions: [item('Share')], onOpenChange }, { trigger: 'long-press' });
      await h.pointer(h.trigger(), 'pointerdown', touch);
      await h.pointer(h.page.outside, 'pointermove', {
        ...touch,
        clientX: h.FAB_MOTION.dragThreshold + 1,
      });
      await tick(h.FAB_MOTION.longPress);
      assert.deepEqual(log, [], 'moving past the central drag threshold cancels a long press');
      await h.pointer(h.trigger(), 'pointerdown', touch);
      await h.pointer(h.page.outside, 'pointerup', touch);
      await tick(h.FAB_MOTION.longPress);
      assert.deepEqual(log, [], 'a release anywhere cancels a long press');
      await h.pointer(h.trigger(), 'pointerdown', touch);
      await tick(h.FAB_MOTION.longPress);
      assert.deepEqual(
        log,
        [[true, 'long-press']],
        'holding for the central long-press time opens',
      );
      // A long press whose compatibility click never arrives leaves nothing to consume later trigger clicks.
      await h.pointer(h.page.outside, 'pointercancel', touch);
      await h.key(h.trigger(), 'Escape');
      await h.click(h.trigger(), 0);
      await h.click(h.trigger());
      await h.pointer(h.trigger(), 'pointerdown', touch);
      await tick(h.FAB_MOTION.longPress);
      await h.pointer(h.page.outside, 'pointerup', touch);
      await h.key(h.trigger(), 'Escape');
      await h.click(h.trigger(), 0);
      await h.click(h.trigger());
      assert.deepEqual(
        log,
        [
          [true, 'long-press'],
          [false, 'escape'],
          [true, 'keyboard'],
          [false, 'trigger'],
          [true, 'long-press'],
          [false, 'escape'],
          [true, 'keyboard'],
          [false, 'trigger'],
        ],
        'after a cancel or a release outside, keyboard and later pointer clicks on the trigger still run',
      );
      // A release over the trigger keeps the scope only for the compatibility click of that same task.
      await h.pointer(h.trigger(), 'pointerdown', touch);
      await tick(h.FAB_MOTION.longPress);
      await h.pointer(h.trigger(), 'pointerup', touch);
      await h.click(h.trigger());
      await h.key(h.trigger(), 'Escape');
      // Without that click the next task ends the scope, so a later pointer click with no new press still runs.
      await h.pointer(h.trigger(), 'pointerdown', touch);
      await tick(h.FAB_MOTION.longPress);
      await h.pointer(h.trigger(), 'pointerup', touch);
      await tick(1);
      await h.key(h.trigger(), 'Escape');
      await h.click(h.trigger());
      assert.deepEqual(
        log.slice(8),
        [
          [true, 'long-press'],
          [false, 'escape'],
          [true, 'long-press'],
          [false, 'escape'],
          [true, 'trigger'],
        ],
        'a release over the trigger consumes its same-task click once and expires on the next task',
      );
    });

    await h.withTimers(async () => {
      // Mocked timers keep the 0 ms suppression expiry from racing the act task between a release and its click.
      const { log, onOpenChange } = tracked();
      await h.mount({ actions: [item('Share')], onOpenChange }, { trigger: 'gesture' });
      await h.pointer(h.trigger(), 'pointerdown');
      await h.pointer(h.page.outside, 'pointermove', { clientX: h.FAB_MOTION.gesture });
      assert.deepEqual(
        log,
        [[true, 'gesture']],
        'a swipe past the central gesture threshold opens',
      );
      // The swipe's own compatibility click after a release on the trigger is still consumed.
      await h.pointer(h.trigger(), 'pointerup');
      await h.click(h.trigger());
      assert.deepEqual(
        log,
        [[true, 'gesture']],
        'the compatibility click after a swipe is consumed',
      );
      await h.key(h.trigger(), 'Escape');
      await h.pointer(h.trigger(), 'pointerdown');
      await h.pointer(h.page.outside, 'pointermove', { clientX: h.FAB_MOTION.gesture });
      await h.pointer(h.page.outside, 'pointerup');
      await h.key(h.trigger(), 'Escape');
      await h.click(h.trigger(), 0);
      await h.click(h.trigger());
      assert.deepEqual(
        log,
        [
          [true, 'gesture'],
          [false, 'escape'],
          [true, 'gesture'],
          [false, 'escape'],
          [true, 'keyboard'],
          [false, 'trigger'],
        ],
        'a swipe released outside leaves keyboard and later pointer clicks working',
      );
    });

    // The real renderer composes the GenUXOverlay Modal, so useFab adds no inert shield of its own. This harness only
    // proves the hook leaves background attributes as they were; native Modal focus, mask and top-layer behavior belong
    // to the existing browser case, and nothing here proves the whole modal.
    await h.mount({ actions: [item('Share')], open: true }, { modal: true });
    const { sibling, legacy, dialog, shell } = h.page;
    const background = () =>
      [sibling, legacy, dialog, shell].map(node => node.getAttribute('inert'));
    assert.deepEqual(
      background(),
      [null, 'legacy', null, null],
      'an open modal panel leaves background inert unchanged',
    );
    await h.render({ actions: [item('Share')], open: false }, { modal: true });
    assert.deepEqual(
      background(),
      [null, 'legacy', null, null],
      'closing leaves the previous inert value in place',
    );

    let presses = 0;
    const press = () => {
      presses += 1;
    };
    await h.mount(
      {
        actions: [
          item('Share', { onAction: press }),
          item('Archive', { disabled: true }),
          item('Copy', { onAction: press }),
          item('Delete', { onAction: press }),
        ],
        defaultOpen: true,
      },
      { closeOnSelect: false },
    );
    const [share, archive, copy, remove] = h.actions();
    await h.focus(share);
    await h.key(share, 'ArrowDown');
    assert.equal(focused(), copy, 'arrow navigation skips disabled actions');
    assert.deepEqual(
      [share, archive, copy, remove].map(button => button.tabIndex),
      [-1, -1, 0, -1],
      'one roving tab stop',
    );
    await h.key(copy, 'd');
    assert.equal(focused(), remove, 'typeahead matches the aria-label of icon-only actions');
    for (const key of ['Enter', ' ']) await h.key(remove, key);
    assert.equal(presses, 0, 'Enter and Space keydown leave activation to the native button');
    await h.click(remove, 0);
    assert.equal(presses, 1, 'native keyboard activation runs the action once');

    {
      // Escape during IME composition belongs to the editor, and a child that prevents Escape keeps it.
      const { log, onOpenChange } = tracked();
      await h.mount(
        { actions: [item('Share')], defaultOpen: true, onOpenChange },
        { closeOnEscape: true },
      );
      const [action] = h.actions();
      await h.focus(action);
      await h.key(action, 'Escape', { isComposing: true });
      assert.deepEqual(log, [], 'a composing Escape never closes');
      h.consumeChildEscape(true);
      try {
        await h.key(action, 'Escape');
      } finally {
        h.consumeChildEscape(false);
      }
      assert.deepEqual(
        log,
        [],
        'a child preventing Escape in its React handler wins over the panel dismissal',
      );
      assert.equal(h.fab.open, true, 'the panel stays open while a child owns Escape');
      await h.key(action, 'Escape');
      assert.deepEqual(log, [[false, 'escape']], 'an unowned Escape still closes once');
      assert.equal(focused(), h.trigger(), 'focus returns to the trigger after Escape');
    }

    // A focused action that stays connected but loses eligibility hands focus and the single tab stop to its neighbour.
    for (const [change, policy, online] of [
      ['disabled', { disabled: true }, true],
      ['offline', { offlineAvailable: false }, false],
      ['loading', { loading: true }, true],
    ]) {
      const list = extra => [
        item('Share', { offlineAvailable: true }),
        item('Copy', { offlineAvailable: true, ...extra }),
        item('Delete', { offlineAvailable: true }),
      ];
      await h.mount({ actions: list({}), defaultOpen: true }, { closeOnSelect: false });
      const index = 1;
      await h.focus(h.actions()[index]);
      await h.render(
        { actions: list(policy), defaultOpen: true, online },
        { closeOnSelect: false },
      );
      const rendered = h.actions();
      const eligible = rendered.filter(
        button => !button.disabled && button.getAttribute('aria-disabled') !== 'true',
      );
      const neighbour = eligible[Math.min(index, eligible.length - 1)];
      assert.equal(
        neighbour?.getAttribute('aria-label'),
        'Delete',
        `${change}: the eligible neighbour keeps the focused index`,
      );
      assert.equal(focused(), neighbour, `${change}: focus moves off the ineligible action`);
      const stops = rendered.filter(button => button.tabIndex === 0);
      assert.equal(stops.length, 1, `${change}: exactly one roving tab stop`);
      assert.equal(stops[0], neighbour, `${change}: the tab stop follows focus`);
    }

    await h.withTimers(async () => {
      // Turning on reduced motion mid-transition settles the visual state at once in both directions.
      const { log, onOpenChange } = tracked();
      const options = { motion: { duration: 'normal', closeDuration: 'normal' } };
      await h.act(() => {
        h.media.reduced = false;
      });
      try {
        await h.mount({ actions: [item('Share')], onOpenChange }, options);
        await h.act(() => h.fab.requestOpen(true, 'api'));
        assert.equal(h.fab.state, 'opening', 'ordinary motion opens through the opening phase');
        await h.act(() => {
          h.media.reduced = true;
        });
        assert.equal(
          h.fab.state,
          'open',
          'reducing motion while opening shows the open state at once',
        );
        await h.act(() => {
          h.media.reduced = false;
        });
        await h.act(() => h.fab.requestOpen(false, 'api'));
        assert.equal(h.fab.state, 'closing', 'ordinary motion closes through the closing phase');
        await h.act(() => {
          h.media.reduced = true;
        });
        assert.equal(
          h.fab.state,
          'closed',
          'reducing motion while closing shows the closed state at once',
        );
        assert.deepEqual(
          log,
          [
            [true, 'api'],
            [false, 'api'],
          ],
          'a reduced-motion change reports no open state change',
        );
      } finally {
        await h.act(() => {
          h.media.reduced = true;
        });
      }
    });

    {
      // Denied or hidden configured actions never fall back to the virtual primary onAction.
      for (const [type, policy] of [
        ['single', { permission: false }],
        ['extended', { visible: false }],
      ]) {
        let own = 0;
        let primary = 0;
        const blocked = item(`Blocked ${type} action`, {
          id: `blocked-${type}`,
          ...policy,
          onAction: () => {
            own += 1;
          },
        });
        await h.mount(
          {
            actions: [blocked],
            onAction: () => {
              primary += 1;
            },
          },
          { type },
        );
        assert.equal(h.fab.actions.length, 0, `${type}: the filtered action is not offered`);
        assert.equal(
          await h.invoke({ id: `${type}-primary`, label: 'Compose' }),
          false,
          `${type}: the primary action does not run while actions are configured`,
        );
        assert.equal(
          await h.invoke(blocked),
          false,
          `${type}: a filtered configured action never runs as the primary action`,
        );
        assert.equal(own + primary, 0, `${type}: neither the action nor the primary callback runs`);
      }
    }
    {
      // A semantic change while confirming withdraws the review; neither the reviewed nor the new callback runs.
      for (const change of [
        { href: '#archive-moved' },
        { actionType: 'action', href: undefined },
        { label: 'Archive every record' },
        { confirmation: false },
        { confirmation: undefined },
      ]) {
        const calls = { reviewed: 0, replacement: 0 };
        const archive = (key, { label = 'Archive record', ...rest } = {}) =>
          item(label, {
            id: 'archive-record',
            actionType: 'link',
            href: '#archive',
            confirmation: 'Approve?',
            onAction: () => {
              calls[key] += 1;
            },
            ...rest,
          });
        const reviewed = archive('reviewed');
        await h.mount({ actions: [reviewed], defaultOpen: true });
        assert.equal(
          await h.invoke(h.fab.actions[0]),
          false,
          'the first activation only asks for confirmation',
        );
        assert.equal(h.fab.confirmation?.id, 'archive-record', 'the confirmation is pending');
        await h.render({ actions: [archive('replacement', change)], defaultOpen: true });
        const name = JSON.stringify(change, (_, value) =>
          value === undefined ? 'undefined' : value,
        );
        assert.ok(!h.fab.confirmation, `${name} cancels the pending confirmation`);
        assert.ok(h.fab.error, `${name} announces that the action changed`);
        assert.equal(
          await h.invoke(reviewed, true),
          false,
          `${name}: confirming the stale review fails`,
        );
        assert.deepEqual(calls, { reviewed: 0, replacement: 0 }, `${name}: no callback runs`);
      }
    }
    {
      // Disabling or hiding the whole FAB withdraws a pending review, so re-enabling it cannot confirm the review.
      for (const policy of [{ disabled: true }, { visible: false }]) {
        const name = JSON.stringify(policy);
        let reviewedCalls = 0;
        const reviewed = item('Archive record', {
          id: 'archive-record',
          confirmation: 'Approve?',
          onAction: () => {
            reviewedCalls += 1;
          },
        });
        const props = extra => ({ actions: [reviewed], defaultOpen: true, ...extra });
        await h.mount(props({}));
        assert.equal(
          await h.invoke(h.fab.actions[0]),
          false,
          `${name}: the first activation only asks for confirmation`,
        );
        assert.equal(h.fab.confirmation?.id, 'archive-record', `${name}: the review is pending`);
        await h.render(props(policy));
        assert.ok(!h.fab.confirmation, `${name} withdraws the pending confirmation`);
        await h.render(props({}));
        assert.ok(!h.fab.confirmation, `${name}: re-enabling does not restore the review`);
        assert.equal(
          await h.invoke(reviewed, true),
          false,
          `${name}: confirming the withdrawn review fails`,
        );
        assert.equal(reviewedCalls, 0, `${name}: the reviewed callback never runs`);
      }
    }
    {
      // Recreating the same reviewed action's callback while confirming runs the reviewed callback exactly once.
      const calls = [];
      const props = key => ({
        actions: [
          item('Publish draft', {
            id: 'publish-draft',
            confirmation: true,
            onAction: () => {
              calls.push(key);
            },
          }),
        ],
        defaultOpen: true,
      });
      await h.mount(props('reviewed'));
      assert.equal(
        await h.invoke(h.fab.actions[0]),
        false,
        'the first activation only asks for confirmation',
      );
      await h.render(props('replacement'));
      assert.equal(
        h.fab.confirmation?.id,
        'publish-draft',
        'an unchanged action keeps its pending review',
      );
      assert.equal(
        await h.invoke(h.fab.actions[0], true),
        true,
        'confirming the unchanged action succeeds',
      );
      assert.deepEqual(calls, ['reviewed'], 'only the originally reviewed callback runs, once');
    }
    {
      // A host re-render that recreates an inline callback for the same, still allowed action is not a failure.
      let resolveShare;
      const { log, onOpenChange } = tracked();
      const props = () => ({
        actions: [
          item('Share', {
            actionType: 'link',
            href: '#share',
            onAction: () =>
              new Promise(resolve => {
                resolveShare = resolve;
              }),
          }),
        ],
        defaultOpen: true,
        onOpenChange,
      });
      await h.mount(props());
      const run = await h.start(h.fab.actions[0]);
      await h.render(props());
      assert.equal(
        await settle(run, resolveShare),
        true,
        'same id, type and href with a fresh callback still succeeds',
      );
      assert.deepEqual(log, [[false, 'select']], 'closeOnSelect still closes after the re-render');
      assert.equal(h.fab.open, false, 'the panel closes after the successful action');
    }
    {
      // activate admits synchronously, so two activations in one task share one admission; invoke stays a Promise.
      let releaseHeld;
      let heldRuns = 0;
      await h.mount(
        {
          actions: [
            item('Share', {
              actionType: 'link',
              href: '#share-held',
              onAction: () =>
                new Promise(resolve => {
                  heldRuns += 1;
                  releaseHeld = resolve;
                }),
            }),
            item('Docs', { actionType: 'link', href: '#docs-plain' }),
          ],
          defaultOpen: true,
        },
        { closeOnSelect: false, closeOnNavigation: false },
      );
      assert.equal(typeof h.fab.activate, 'function', 'the hook exposes synchronous activate');
      const [heldLink, plainLink] = h.fab.actions;
      let held;
      await h.act(() => {
        held = [h.fab.activate(heldLink), h.fab.activate(heldLink)];
      });
      assert.deepEqual(
        held.map(run => run.admitted),
        [true, false],
        'only the first of two same-task activations is admitted',
      );
      assert.equal(heldRuns, 1, 'the held link callback runs once');
      assert.deepEqual([...h.fab.busyIds], ['Share'], 'one operation is busy');
      assert.deepEqual(
        await h.act(async () => {
          releaseHeld();
          return Promise.all(held.map(run => run.completion));
        }),
        [true, false],
        'the admitted run completes true and the refused one false',
      );
      assert.deepEqual([...h.fab.busyIds], [], 'busy clears after the held run');
      // A link without a callback only completes here; JSDOM proves no real navigation.
      let plain;
      await h.act(() => {
        plain = [h.fab.activate(plainLink), h.fab.activate(plainLink)];
      });
      assert.deepEqual(
        plain.map(run => run.admitted),
        [true, false],
        'a plain link is admitted once before a microtask passes',
      );
      assert.deepEqual(
        await h.act(() => Promise.all(plain.map(run => run.completion))),
        [true, false],
        'only the admitted plain link completes true',
      );
    }

    await h.withTimers(async tick => {
      // The visual phase settles on its own timer while work is still busy; the open state changes at once.
      let releaseSync;
      let syncRuns = 0;
      const { log, onOpenChange } = tracked();
      const options = {
        motion: { duration: 'normal', closeDuration: 'normal', sequence: 'together' },
      };
      await h.act(() => {
        h.media.reduced = false;
      });
      try {
        await h.mount(
          {
            actions: [
              item('Sync', {
                onAction: () =>
                  new Promise(resolve => {
                    syncRuns += 1;
                    releaseSync = resolve;
                  }),
              }),
            ],
            defaultOpen: true,
            onOpenChange,
          },
          options,
        );
        assert.equal(h.fab.phase, 'open', 'a default-open panel starts in the open phase');
        const run = await h.start(h.fab.actions[0]);
        assert.equal(h.fab.busyId, 'Sync', 'the held action is busy');
        await h.act(() => h.fab.requestOpen(false, 'api'));
        assert.equal(h.fab.open, false, 'closing updates the open state at once');
        assert.equal(h.actions().length, 0, 'the closed panel renders no actions');
        assert.equal(h.fab.phase, 'closing', 'the phase closes while the action is busy');
        assert.equal(h.fab.state, 'busy', 'the state still reports busy work');
        assert.equal(h.fab.busyId, 'Sync', 'closing does not cancel the busy action');
        await tick(h.FAB_MOTION.close.normal);
        assert.equal(h.fab.phase, 'closed', 'the closing time settles the phase while busy');
        assert.equal(h.fab.state, 'busy', 'busy outlasts the settled phase');
        assert.equal(
          await settle(run, () => releaseSync()),
          true,
          'the still offered action completes after the panel closed',
        );
        assert.equal(syncRuns, 1, 'the handler ran once');
        assert.equal(h.fab.busyId, null, 'busy clears after completion');
        assert.equal(h.fab.state, 'closed', 'the settled phase shows once busy clears');
        assert.deepEqual(log, [[false, 'api']], 'no second close is reported');
      } finally {
        await h.act(() => {
          h.media.reduced = true;
        });
      }
    });

    for (const outcome of ['resolve', 'reject']) {
      // An open real GenUXTweaker only suspends new input: deferred work admitted before it settles once under the
      // Tweaker without taking its focus, and closing the real Drawer keeps that result and replays nothing.
      let release;
      let fail;
      let runs = 0;
      const reports = [];
      const { log, onOpenChange } = tracked();
      await h.mount(
        {
          actions: [
            item('Sync', {
              onAction: () =>
                new Promise((resolve, reject) => {
                  runs += 1;
                  release = resolve;
                  fail = reject;
                }),
            }),
          ],
          defaultOpen: true,
          onOpenChange,
          onError: (cause, action) => {
            reports.push([cause.message, action.id]);
          },
        },
        { closeOnSelect: true, keepOpenOnError: false },
        { tweaker: true },
      );
      const resolved = outcome === 'resolve';
      const inTweaker = () =>
        Boolean(focused()?.closest?.('.genux-tweaker-panel, .genux-tweaker-trigger'));
      const run = await h.start(h.fab.actions[0]);
      assert.equal(h.fab.busyId, 'Sync', `${outcome}: the deferred action is busy`);
      assert.equal(h.fab.suspended, false, `${outcome}: a closed Tweaker does not suspend the FAB`);
      const opener = h.tweakerOpener();
      assert.ok(opener, `${outcome}: the real fixed Tweaker opener renders`);
      await h.focus(opener);
      await h.click(opener);
      assert.equal(h.fab.suspended, true, `${outcome}: opening the real Tweaker suspends the FAB`);
      assert.ok(inTweaker(), `${outcome}: focus starts in the Tweaker`);
      assert.equal(
        await settle(run, () => (resolved ? release() : fail(new Error('Sync failed')))),
        resolved,
        `${outcome}: the admitted run settles under the open Tweaker`,
      );
      const closes = [[false, resolved ? 'select' : 'error']];
      const reported = resolved ? [] : [['Sync failed', 'Sync']];
      const shown = resolved ? '' : 'Sync failed';
      assert.deepEqual(log, closes, `${outcome}: the settled run closes the panel once`);
      assert.deepEqual(reports, reported, `${outcome}: onError follows the outcome once`);
      assert.equal(h.fab.error, shown, `${outcome}: the error state follows the outcome`);
      assert.deepEqual([...h.fab.busyIds], [], `${outcome}: busy is released`);
      assert.ok(inTweaker(), `${outcome}: settling leaves focus in the Tweaker`);
      assert.ok(
        !h.fab.rootRef.current.contains(focused()),
        `${outcome}: focus does not return to the FAB`,
      );
      await h.key(focused() ?? h.window.document.body, 'Escape');
      assert.equal(h.fab.suspended, false, `${outcome}: closing the real Drawer resumes the FAB`);
      assert.deepEqual(log, closes, `${outcome}: resuming reports no further open change`);
      assert.deepEqual(reports, reported, `${outcome}: resuming reports no further error`);
      assert.equal(
        h.fab.error,
        shown,
        `${outcome}: the result is retained after the Tweaker closes`,
      );
      assert.equal(h.fab.open, false, `${outcome}: the panel stays closed`);
      assert.equal(runs, 1, `${outcome}: the handler ran once and was not replayed`);
    }

    for (const source of ['action', 'component']) {
      for (const outcome of ['resolve', 'reject']) {
        // A loading flag set while admitted work is pending blocks new starts but keeps that work's outcome: the run
        // settles once, reports once and releases busy without a remount.
        const label = `${source} loading (${outcome})`;
        const resolved = outcome === 'resolve';
        let release;
        let fail;
        let runs = 0;
        const reports = [];
        const { log, onOpenChange } = tracked();
        const options = { disableWhileLoading: true, keepOpenOnError: false };
        const props = loading => ({
          actions: [
            item('Sync', {
              loading: source === 'action' && loading,
              onAction: () =>
                new Promise((resolve, reject) => {
                  runs += 1;
                  release = resolve;
                  fail = reject;
                }),
            }),
          ],
          defaultOpen: true,
          loading: source === 'component' && loading,
          onOpenChange,
          onError: (cause, action) => {
            reports.push([cause.message, action.id]);
          },
        });
        await h.mount(props(false), options);
        const run = await h.start(h.fab.actions[0]);
        assert.equal(h.fab.busyId, 'Sync', `${label}: the admitted action is busy`);
        await h.render(props(true), options);
        assert.equal(
          await h.invoke(h.fab.actions[0]),
          false,
          `${label}: loading admits no second start`,
        );
        assert.equal(
          await settle(run, () => (resolved ? release() : fail(new Error('Sync failed')))),
          resolved,
          `${label}: the admitted run keeps its outcome`,
        );
        assert.equal(runs, 1, `${label}: the handler ran once without reentry`);
        assert.deepEqual(
          reports,
          resolved ? [] : [['Sync failed', 'Sync']],
          `${label}: onError follows the outcome once`,
        );
        assert.equal(h.fab.error, resolved ? '' : 'Sync failed', `${label}: the error is retained`);
        assert.deepEqual([...h.fab.busyIds], [], `${label}: busy is released`);
        assert.deepEqual(
          log,
          source === 'component' ? [[false, 'loading']] : [[false, resolved ? 'select' : 'error']],
          `${label}: the panel closes once`,
        );
      }
    }

    const named = name => h.actions().find(control => control.getAttribute('aria-label') === name);
    const tabStops = () =>
      h
        .actions()
        .filter(control => control.tabIndex === 0)
        .map(control => control.getAttribute('aria-label'));

    {
      // activeActionId is the single roving owner: enabling an earlier action keeps focus and one tab stop.
      const list = shareDisabled => [
        item('Share', { disabled: shareDisabled }),
        item('Copy'),
        item('Delete'),
      ];
      await h.mount({ actions: list(true), defaultOpen: true }, { closeOnSelect: false });
      await h.focus(named('Copy'));
      await h.key(named('Copy'), 'End');
      assert.equal(focused(), named('Delete'), 'End focuses the last eligible action');
      await h.render({ actions: list(false), defaultOpen: true }, { closeOnSelect: false });
      assert.equal(focused(), named('Delete'), 'enabling an earlier action keeps focus');
      assert.deepEqual(tabStops(), ['Delete'], 'exactly one roving tab stop stays on focus');
      assert.equal(h.fab.activeActionId, 'Delete', 'the active action id is preserved');
    }

    {
      // Starting work makes the focused action ineligible although the actions array stays the same.
      let releaseCopy;
      const stable = [
        item('Share'),
        item('Copy', {
          onAction: () =>
            new Promise(resolve => {
              releaseCopy = resolve;
            }),
        }),
        item('Delete'),
      ];
      await h.mount(
        { actions: stable, defaultOpen: true },
        { closeOnSelect: false, disableWhileLoading: false },
      );
      await h.focus(named('Share'));
      await h.key(named('Share'), 'ArrowDown');
      assert.equal(focused(), named('Copy'), 'arrow navigation focuses Copy');
      const run = await h.start(h.fab.actions[1]);
      assert.equal(
        named('Copy').getAttribute('aria-disabled'),
        'true',
        'the running action is unavailable',
      );
      assert.equal(
        focused(),
        named('Delete'),
        'focus moves off the running action to its neighbour',
      );
      assert.deepEqual(tabStops(), ['Delete'], 'the single tab stop follows the repaired focus');
      assert.equal(h.fab.activeActionId, 'Delete', 'the active action id follows the repair');
      assert.equal(await settle(run, () => releaseCopy()), true, 'the running action settles');
    }

    {
      // A link menuitem has no native Space activation, so the hook clicks it once; Enter stays native.
      // JSDOM dispatches only the synthetic keydown here, so this proves neither browser Enter nor navigation.
      let linkPresses = 0;
      await h.mount(
        {
          actions: [
            item('Docs', {
              actionType: 'link',
              href: '#fab-space-link',
              onAction: () => {
                linkPresses += 1;
              },
            }),
            item('Copy'),
          ],
          defaultOpen: true,
        },
        { closeOnSelect: false, closeOnNavigation: false },
      );
      const link = named('Docs');
      assert.equal(link.tagName, 'A', 'a link action renders a native anchor');
      assert.equal(link.getAttribute('role'), 'menuitem', 'the anchor is a menuitem');
      assert.equal(link.getAttribute('href'), '#fab-space-link', 'the anchor keeps its href');
      await h.focus(link);
      assert.equal(await h.key(link, ' '), false, 'Space on a link menuitem is prevented');
      assert.equal(linkPresses, 1, 'Space activates the link once');
      assert.equal(await h.key(link, 'Enter'), true, 'Enter keydown stays with the native link');
      assert.equal(linkPresses, 1, 'Enter keydown does not invoke the link again');
    }

    for (const consumerMoved of [false, true]) {
      // Regrouping an action merges group runs, so production remounts its native control under another parent. Focus
      // left on the disconnected control fell to the body and moves to the remounted control; focus a consumer moved
      // elsewhere stays there.
      const label = consumerMoved ? 'focus moved outside' : 'focus on the regrouped action';
      const options = { closeOnSelect: false, closeOnBlur: false };
      const list = copyGroup => [item('Share', { group: 'a' }), item('Copy', { group: copyGroup })];
      await h.mount({ actions: list('b'), defaultOpen: true }, options);
      const previous = named('Copy');
      await h.focus(previous);
      assert.equal(focused(), previous, `${label}: Copy starts focused`);
      if (consumerMoved) await h.focus(h.page.outside);
      await h.render({ actions: list('a'), defaultOpen: true }, options);
      const remounted = named('Copy');
      assert.equal(previous.isConnected, false, `${label}: the old Copy control is disconnected`);
      assert.ok(
        remounted && remounted !== previous,
        `${label}: Copy remounts under the merged run`,
      );
      assert.equal(h.fab.activeActionId, 'Copy', `${label}: the active action id stays on Copy`);
      assert.deepEqual(tabStops(), ['Copy'], `${label}: exactly one roving tab stop stays on Copy`);
      assert.equal(
        focused(),
        consumerMoved ? h.page.outside : remounted,
        consumerMoved
          ? `${label}: focus a consumer moved elsewhere stays there`
          : `${label}: focus moves to the remounted native Copy control`,
      );
    }
  } finally {
    await h.close();
  }
});
