import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Structural ECA contract for built documentation HTML. The gate inspects built
// markup only; it is not browser, computed-style, device or CI evidence.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const loadGate = () => import(pathToFileURL(resolve(root, 'tools/docs-presentation.mjs')).href);
const readRules = async () =>
  JSON.parse(await readFile(resolve(root, 'docs/src/data/documentation-rules.json'), 'utf8'));

// Showcase sections first, then the API and resources reference column.
const componentOrder = [
  'usage',
  'examples',
  'code',
  'astro',
  'accessibility',
  'notes',
  'api',
  'resources',
];
const headings = {
  usage: 'When to use',
  examples: 'Live examples',
  code: 'Usage code',
  astro: 'Astro integration',
  api: 'API',
  accessibility: 'Accessibility',
  notes: 'Implementation notes',
  resources: 'Source and resources',
};
const foundationKinds = {
  '/': 'overview',
  '/getting-started/': 'guide',
  '/tokens/': 'tokens',
  '/standards/': 'ux-standards',
  '/genui/': 'genui',
  '/color-system/': 'color-lab',
  '/theme-builder/': 'color-lab',
  '/decisions/': 'decisions',
  '/licenses/': 'legal',
  '/documentation/': 'standard',
};
// Retired routes only redirect to their canonical documentation route.
const redirectTargets = { '/token-standards/': '/tokens/', '/components/': '/' };
const pageKinds = [...new Set([...Object.values(foundationKinds), 'redirect', 'component'])];
const resourceSources = {
  catalog: ['docs/src/data/catalog.ts'],
  route: ['docs/src/pages/components/[slug].astro', 'docs/src/layouts/DocsLayout.astro'],
  adapter: ['docs/src/react/TimelineDemo.tsx'],
  styles: ['docs/src/styles/atlas-timeline.css', 'docs/src/styles/docs.css'],
  instructions: ['docs/AGENTS.md'],
  tests: ['docs/tests/timeline.test.mjs'],
  genui: [
    'docs/src/genui/contracts.ts',
    'docs/src/genui/policy.ts',
    'docs/src/react/genui/AtlasGenUISurface.tsx',
  ],
};
const capabilityStatus =
  '<p data-doc-capability-status>Not registered as a GenUI capability yet.</p>';
const standardSections = [
  'page-types',
  'section-order',
  'rules',
  'source-map',
  'admission',
  'verification-limits',
];
const structuralRules = [
  'page-kind-unknown',
  'heading-single-h1',
  'section-unnamed',
  'section-name-duplicate',
  'section-target-duplicate',
  'section-id-mismatch',
  'navigation-missing',
  'navigation-target-missing',
  'navigation-link-duplicate',
  'navigation-section-unlisted',
  'component-section-missing',
  'component-section-duplicate',
  'component-section-order',
  'component-demo-empty',
  'component-demo-duplicate',
  'component-api-missing',
  'component-api-reference-missing',
  'component-api-reference-invalid',
  'component-astro-incomplete',
  'component-resources-incomplete',
  'astro-guide-missing',
  'astro-guide-target-missing',
  'astro-guide-target-duplicate',
  'foundation-sections-missing',
  'standard-section-missing',
  'standard-rule-unlisted',
];

const shell = main => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Fixture · Atlas Components</title></head>
  <body data-atlas-surface="docs">
    <a class="skip-link" href="#content">Skip to content</a>
    <header><a href="/">Atlas Components</a></header>
    <aside>
      <h2>Component library</h2>
      <nav aria-label="Documentation">
        <a href="/documentation/">Documentation standard</a>
        <section><h2>Actions</h2><a href="/components/button/">Button</a></section>
      </nav>
    </aside>
    <main id="content" tabindex="-1">${main}</main>
    <footer><a href="/licenses/">Third-party licenses</a></footer>
  </body>
</html>`;

function docSection(key, heading, body, id = key) {
  const target = id === null ? '' : ` id="${id}"`;
  if (heading === null) return `<section${target} data-doc-section="${key}">${body}</section>`;
  const title = `<h2 id="${key}-title">${heading}</h2>`;
  return `<section${target} data-doc-section="${key}" aria-labelledby="${key}-title">${title}${body}</section>`;
}
// Both the 320px section links and the optional desktop contents are page navigation.
const pageNav = (kind, ids, label = id => headings[id] ?? id) =>
  `<nav data-doc-nav="${kind}" aria-label="${kind === 'toc' ? 'Contents' : 'On this page'}">${ids
    .map(id => `<a href="#${id}">${label(id)}</a>`)
    .join('')}</nav>`;

const demo = `<div data-doc-demo>
  <astro-island component-url="/_astro/TimelineDemo.js" client="load">
    <div data-timeline-catalog>
      <nav aria-label="Timeline examples"><a href="#timeline-basic">Basic</a><a href="#timeline-states">States</a></nav>
      <section id="timeline-basic"><h3>Basic</h3><button type="button">Add event</button></section>
      <section id="timeline-states"><h3>States</h3><p>Pending</p></section>
    </div>
  </astro-island>
</div>`;
const officialUrl = 'https://ant.design/components/timeline';
const officialReference = href =>
  `<a data-doc-official-reference${href === null ? '' : ` href="${href}"`}>Official API reference</a>`;
const apiTable = `<table><caption>Timeline API table</caption>
<thead><tr><th>Property</th><th>Type</th></tr></thead>
<tbody><tr><td>items</td><td>TimelineItem[]</td></tr></tbody></table>`;
const guideLink = '<a href="/getting-started/#astro-integration">Astro integration guide</a>';
const resourceEntry = (kind, paths) =>
  `<li data-doc-resource="${kind}"><span>${kind}</span> ${paths
    .map(path => `<code data-doc-source>${path}</code>`)
    .join(' ')}</li>`;
function resources({ sources = resourceSources, raw = {}, status = capabilityStatus } = {}) {
  const entries = Object.entries(sources).map(
    ([kind, paths]) => raw[kind] ?? resourceEntry(kind, paths),
  );
  return `<ul>${entries.join('')}</ul>${status}`;
}
const componentBodies = {
  usage: '<ul><li>Show a dated sequence of related events.</li></ul>',
  examples: `<p>Open Tweaker from the middle of the right edge.</p>${demo}`,
  code: "<pre><code>import { AtlasTimeline } from '../react/AtlasTimeline';</code></pre>",
  astro: `<p>Astro renders static content; the trusted React island owns interaction.</p>
<pre><code>---
import Demo from '../react/Demo';
---
&lt;Demo documentation client:load /&gt;</code></pre>
${guideLink}`,
  api: `${apiTable}${officialReference(officialUrl)}`,
  accessibility: '<ul><li>Events are an ordered list with readable dates.</li></ul>',
  notes: '<ul><li>The host owns event data.</li></ul>',
  resources: resources(),
};

function componentPage({
  sections = componentOrder,
  bodies = {},
  names = {},
  ids = {},
  nav = sections,
  toc = componentOrder.filter(id => sections.includes(id)),
  h1 = '<h1>Timeline</h1>',
} = {}) {
  const content = sections
    .map(key =>
      docSection(
        key,
        key in names ? names[key] : headings[key],
        bodies[key] ?? componentBodies[key],
        key in ids ? ids[key] : key,
      ),
    )
    .join('');
  const sectionNav = nav === null ? '' : pageNav('sections', nav);
  const contents = toc === null ? '' : pageNav('toc', toc);
  return shell(
    `<article>${h1}<p>Shows a dated sequence.</p>${sectionNav}${content}</article>${contents}`,
  );
}

const foundationSections = [
  ['purpose', 'Purpose', '<p>Prose stays on the paper surface.</p>'],
  ['details', 'Details', '<p>Shared tokens own spacing and type.</p>'],
];
function foundationPage({
  sections = foundationSections,
  nav = true,
  h1 = '<h1>Foundation</h1>',
} = {}) {
  const labels = Object.fromEntries(sections.map(([id, name]) => [id, name]));
  const sectionNav = nav
    ? pageNav(
        'sections',
        sections.map(([id]) => id),
        id => labels[id],
      )
    : '';
  return shell(
    `<article>${h1}<p>Lead.</p>${sectionNav}${sections
      .map(([id, name, body]) => docSection(id, name, body))
      .join('')}</article>`,
  );
}

const guideSections = [
  ...foundationSections,
  [
    'astro-integration',
    'Astro integration',
    '<p>Pages stay static; trusted React islands own interaction.</p>',
  ],
];
const guidePage = (sections = guideSections) =>
  foundationPage({ h1: '<h1>Getting started</h1>', sections });

function standardPage(ruleIds, { omit } = {}) {
  const bodies = {
    'page-types': `<ul>${pageKinds.map(kind => `<li>${kind}</li>`).join('')}</ul>`,
    'section-order': `<ol>${componentOrder.map(id => `<li>${id}</li>`).join('')}</ol>`,
    rules: `<div><table><caption>Event, condition and action rules</caption>
<thead><tr><th>Rule</th><th>Event</th><th>Condition</th><th>Action</th></tr></thead>
<tbody>${ruleIds
      .map(
        id =>
          `<tr data-rule-id="${id}"><td><code>${id}</code></td><td>Build</td><td>Checked</td><td>Fail</td></tr>`,
      )
      .join('')}</tbody></table></div>`,
    'source-map': resources(),
    admission: '<ol><li>Add catalog data.</li><li>Pass the build gate.</li></ol>',
    'verification-limits': '<p>The gate inspects built HTML; it is not browser proof.</p>',
  };
  const names = {
    'page-types': 'Page types',
    'section-order': 'Component section order',
    rules: 'Rules',
    'source-map': 'Source map',
    admission: 'Admission workflow',
    'verification-limits': 'Verification limits',
  };
  return foundationPage({
    h1: '<h1>Documentation standard</h1>',
    sections: standardSections.filter(id => id !== omit).map(id => [id, names[id], bodies[id]]),
  });
}

async function declaredRuleIds() {
  return new Set((await readRules()).rules.map(rule => rule.ruleId));
}
async function check(html, path) {
  const { validateBuiltPage } = await loadGate();
  const findings = await validateBuiltPage(html, { path });
  assert.ok(Array.isArray(findings), 'findings are an array');
  const declared = await declaredRuleIds();
  for (const finding of findings) {
    assert.equal(typeof finding.ruleId, 'string');
    assert.ok(
      declared.has(finding.ruleId),
      `${finding.ruleId} is declared in documentation-rules.json`,
    );
    assert.equal(typeof finding.message, 'string');
    assert.ok(finding.message.trim(), `${finding.ruleId} explains the failure`);
  }
  return findings.map(finding => finding.ruleId);
}
async function rejects(html, path, ruleId) {
  const ids = await check(html, path);
  assert.ok(ids.includes(ruleId), `${path} expected ${ruleId}, received ${JSON.stringify(ids)}`);
}

async function tempSite(t, files) {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-docs-presentation-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [file, html] of Object.entries(files)) {
    await mkdir(dirname(join(directory, file)), { recursive: true });
    await writeFile(join(directory, file), html);
  }
  return directory;
}
const redirectPage = target => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" /><title>Redirecting · Atlas Components</title>
    <link rel="canonical" href="${target}" />
    <meta http-equiv="refresh" content="0; url=${target}" />
  </head>
  <body><a href="${target}">Continue to the documentation</a></body>
</html>`;
const validSite = ruleIds => ({
  'index.html': foundationPage(),
  'getting-started/index.html': guidePage(),
  'tokens/index.html': foundationPage(),
  'documentation/index.html': standardPage(ruleIds),
  'components/timeline/index.html': componentPage(),
  ...Object.fromEntries(
    Object.entries(redirectTargets).map(([route, target]) => [
      `${route.slice(1)}index.html`,
      redirectPage(target),
    ]),
  ),
  '_astro/client.js': 'export {};',
});
async function buildFindings(directory) {
  const { validateBuild } = await loadGate();
  const findings = await validateBuild(directory);
  assert.ok(Array.isArray(findings), 'findings are an array');
  const declared = await declaredRuleIds();
  for (const finding of findings) {
    assert.ok(
      declared.has(finding.ruleId),
      `${finding.ruleId} is declared in documentation-rules.json`,
    );
    assert.match(finding.path, /^\//, `${finding.ruleId} names the built route`);
    assert.ok(finding.message.trim(), `${finding.ruleId} explains the failure`);
  }
  return findings;
}

test('documentation-rules.json is the single machine-readable ECA source', async () => {
  const rules = await readRules();
  assert.deepEqual(Object.keys(rules.pageKinds).sort(), [...pageKinds].sort());
  for (const [route, kind] of Object.entries(foundationKinds)) {
    assert.ok(rules.pageKinds[kind].routes.includes(route), `${route} belongs to ${kind}`);
  }
  assert.deepEqual(
    [...rules.pageKinds.redirect.routes].sort(),
    Object.keys(redirectTargets).sort(),
  );
  assert.deepEqual(rules.pageKinds.redirect.targets, redirectTargets);
  assert.deepEqual(rules.componentSections, componentOrder);
  const ids = rules.rules.map(rule => rule.ruleId);
  assert.equal(new Set(ids).size, ids.length, 'rule IDs are unique');
  for (const rule of rules.rules) {
    assert.match(rule.ruleId, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(['error', 'warning'].includes(rule.severity), `${rule.ruleId} severity`);
    for (const key of ['event', 'condition', 'action']) {
      assert.equal(typeof rule[key], 'string');
      assert.ok(rule[key].trim(), `${rule.ruleId} ${key}`);
    }
  }
  for (const id of structuralRules) {
    const rule = rules.rules.find(entry => entry.ruleId === id);
    assert.ok(rule, `${id} is declared`);
    assert.equal(rule.severity, 'error', `${id} fails the build`);
  }
});

test('component routes are classified by path, never by an enumerated slug list', async () => {
  const rules = await readRules();
  const strings = [];
  const routeLists = [];
  const walk = (value, key) => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) {
      if (key === 'routes') routeLists.push(value);
      value.forEach(item => walk(item));
    } else if (value && typeof value === 'object') {
      for (const [name, item] of Object.entries(value)) walk(item, name);
    }
  };
  walk(rules);
  const componentRoute = new RegExp(rules.pageKinds.component.routePattern);
  assert.ok(componentRoute.test('/components/timeline/'), 'the component pattern admits slugs');
  const literalComponentRoute = /\/components\/[a-z0-9]+(?:-[a-z0-9]+)*\//;
  assert.deepEqual(
    strings.filter(value => literalComponentRoute.test(value)),
    [],
    'no concrete /components/<slug>/ route is enumerated',
  );
  for (const list of routeLists) {
    for (const route of list) {
      assert.equal(typeof route, 'string');
      assert.equal(
        componentRoute.test(route) || literalComponentRoute.test(route),
        false,
        `${route} is not a listed component route`,
      );
    }
  }
  assert.equal(rules.pageKinds.component.routes?.length ?? 0, 0, 'component kind lists no routes');
});

test('known and future component routes pass when the full common contract is met', async () => {
  assert.deepEqual(await check(componentPage(), '/components/button/'), []);
  assert.deepEqual(await check(componentPage(), '/components/timeline/'), []);
});

test('future component routes are admitted only through the complete contract', async () => {
  const partial = componentPage({ sections: componentOrder.filter(id => id !== 'resources') });
  await rejects(partial, '/components/timeline/', 'component-section-missing');
  await rejects(componentPage(), '/components', 'page-kind-unknown');
  await rejects(componentPage(), '/components/Timeline/', 'page-kind-unknown');
  // The component index is a declared redirect, never a component page.
  await rejects(componentPage(), '/components/', 'redirect-metadata-invalid');
  await rejects(componentPage(), '/components/timeline/history/', 'page-kind-unknown');
});

test('unknown non-component routes fail closed', async () => {
  await rejects(foundationPage(), '/patterns/', 'page-kind-unknown');
  await rejects(componentPage(), '/guides/timeline/', 'page-kind-unknown');
});

test('every shared component section is required', async () => {
  for (const id of componentOrder) {
    const html = componentPage({ sections: componentOrder.filter(section => section !== id) });
    await rejects(html, '/components/timeline/', 'component-section-missing');
  }
});

test('duplicate and reordered component sections fail', async () => {
  const duplicate = componentPage({ sections: [...componentOrder, 'notes'], nav: componentOrder });
  await rejects(duplicate, '/components/timeline/', 'component-section-duplicate');
  const swapped = [
    'usage',
    'examples',
    'api',
    'astro',
    'code',
    'accessibility',
    'notes',
    'resources',
  ];
  await rejects(
    componentPage({ sections: swapped }),
    '/components/timeline/',
    'component-section-order',
  );
});

test('sections need unambiguous names and pages need exactly one h1', async () => {
  await rejects(
    componentPage({ names: { notes: null } }),
    '/components/timeline/',
    'section-unnamed',
  );
  await rejects(
    componentPage({ names: { notes: ' ' } }),
    '/components/timeline/',
    'section-unnamed',
  );
  await rejects(
    componentPage({ names: { notes: 'Accessibility' } }),
    '/components/timeline/',
    'section-name-duplicate',
  );
  await rejects(componentPage({ h1: '' }), '/components/timeline/', 'heading-single-h1');
  await rejects(
    componentPage({ h1: '<h1>Timeline</h1><h1>Again</h1>' }),
    '/components/timeline/',
    'heading-single-h1',
  );
});

test('section id equals data-doc-section and links resolve to that section', async () => {
  const path = '/components/timeline/';
  await rejects(componentPage({ ids: { notes: null } }), path, 'section-id-mismatch');
  await rejects(componentPage({ ids: { notes: 'implementation' } }), path, 'section-id-mismatch');
  // The decoy satisfies mere fragment existence for #notes but is not the notes section.
  const decoy = componentPage({
    ids: { notes: 'implementation-notes' },
    bodies: { usage: `${componentBodies.usage}<p id="notes">Decoy</p>` },
  });
  await rejects(decoy, path, 'section-id-mismatch');
  await rejects(decoy, path, 'navigation-target-missing');
});

test('section navigation exists and every target resolves exactly once', async () => {
  const path = '/components/timeline/';
  await rejects(componentPage({ nav: null }), path, 'navigation-missing');
  await rejects(componentPage({ nav: null, toc: null }), path, 'navigation-missing');
  await rejects(
    componentPage({ nav: [...componentOrder, 'changelog'] }),
    path,
    'navigation-target-missing',
  );
  await rejects(
    componentPage({ nav: [...componentOrder, 'api'] }),
    path,
    'navigation-link-duplicate',
  );
  await rejects(
    componentPage({ nav: componentOrder.filter(id => id !== 'notes') }),
    path,
    'navigation-section-unlisted',
  );
  const collision = componentPage({
    bodies: { notes: '<p id="api">The host owns event data.</p>' },
  });
  await rejects(collision, path, 'section-target-duplicate');
});

test('the desktop contents is checked independently of the section links', async () => {
  const path = '/components/timeline/';
  // Each target appears once in the section links and once in the contents.
  assert.deepEqual(await check(componentPage(), path), []);
  assert.deepEqual(await check(componentPage({ toc: null }), path), []);
  await rejects(
    componentPage({ toc: [...componentOrder, 'changelog'] }),
    path,
    'navigation-target-missing',
  );
  await rejects(
    componentPage({ toc: [...componentOrder, 'api'] }),
    path,
    'navigation-link-duplicate',
  );
});

test('the live demonstration is mounted exactly once and is not empty', async () => {
  const path = '/components/timeline/';
  await rejects(
    componentPage({ bodies: { examples: '<p>Examples</p>' } }),
    path,
    'component-demo-empty',
  );
  await rejects(
    componentPage({ bodies: { examples: '<div data-doc-demo>   </div>' } }),
    path,
    'component-demo-empty',
  );
  await rejects(
    componentPage({
      bodies: {
        examples: '<div data-doc-demo><astro-island component-url="/x.js"></astro-island></div>',
      },
    }),
    path,
    'component-demo-empty',
  );
  await rejects(
    componentPage({ bodies: { examples: demo + demo } }),
    path,
    'component-demo-duplicate',
  );
});

test('API is local to the component and keeps a usable official reference', async () => {
  const path = '/components/timeline/';
  await rejects(
    componentPage({ bodies: { api: `<p>Props.</p>${officialReference(officialUrl)}` } }),
    path,
    'component-api-missing',
  );
  await rejects(
    componentPage({ bodies: { api: apiTable } }),
    path,
    'component-api-reference-missing',
  );
  const unusable = [
    null,
    '',
    ' ',
    '#',
    '#api',
    'javascript:alert(1)',
    'http://ant.design/components/timeline',
    '/components/timeline/',
    'https://example.com/components/timeline',
    'https://ant.design.example.com/components/timeline',
    'https://ant.design@example.com/components/timeline',
    'https://example.com/?next=https://ant.design/components/timeline',
  ];
  for (const href of unusable) {
    await rejects(
      componentPage({ bodies: { api: `${apiTable}${officialReference(href)}` } }),
      path,
      'component-api-reference-invalid',
    );
  }
});

test('Astro integration shows a trusted island example and links to the shared guide', async () => {
  const path = '/components/timeline/';
  await rejects(
    componentPage({ bodies: { astro: `<p>Use a React island.</p>${guideLink}` } }),
    path,
    'component-astro-incomplete',
  );
  await rejects(
    componentPage({
      bodies: {
        astro: `<pre><code>import Demo from '../react/Demo';\n&lt;Demo /&gt;</code></pre>${guideLink}`,
      },
    }),
    path,
    'component-astro-incomplete',
  );
  await rejects(
    componentPage({ bodies: { astro: componentBodies.astro.replace(guideLink, '') } }),
    path,
    'component-astro-incomplete',
  );
});

test('resources name concrete source locations and keep capability status separate', async () => {
  const fails = options =>
    rejects(
      componentPage({ bodies: { resources: resources(options) } }),
      '/components/timeline/',
      'component-resources-incomplete',
    );
  for (const kind of Object.keys(resourceSources)) {
    await fails({
      sources: Object.fromEntries(
        Object.entries(resourceSources).filter(([entry]) => entry !== kind),
      ),
    });
    await fails({ raw: { [kind]: `<li data-doc-resource="${kind}">${kind} source</li>` } });
    await fails({ raw: { [kind]: `<li data-doc-resource="${kind}"> </li>` } });
  }
  await fails({
    raw: { tests: '<li data-doc-resource="tests"><code data-doc-source>Tests</code></li>' },
  });
  await fails({
    raw: { tests: '<li data-doc-resource="tests"><code data-doc-source> </code></li>' },
  });
  await fails({ raw: { genui: '<li data-doc-resource="genui">GenUI contract and registry</li>' } });
  await fails({
    raw: { genui: '<li data-doc-resource="genui">Not registered as a GenUI capability yet.</li>' },
  });
  for (const required of resourceSources.genui) {
    await fails({
      sources: {
        ...resourceSources,
        genui: resourceSources.genui.filter(path => path !== required),
      },
    });
  }
  await fails({ status: '' });
  await fails({ status: '<p data-doc-capability-status> </p>' });
});

test('foundation pages use named, navigable sections on their known routes', async () => {
  for (const path of Object.keys(foundationKinds).filter(path => path !== '/documentation/')) {
    assert.deepEqual(await check(foundationPage(), path), [], path);
  }
  assert.deepEqual(await check(guidePage(), '/getting-started/'), []);
  await rejects(foundationPage({ sections: [] }), '/tokens/', 'foundation-sections-missing');
  await rejects(foundationPage({ nav: false }), '/tokens/', 'navigation-missing');
  await rejects(
    foundationPage({ sections: [['purpose', null, '<p>Prose.</p>']] }),
    '/decisions/',
    'section-unnamed',
  );
  await rejects(foundationPage({ h1: '' }), '/licenses/', 'heading-single-h1');
});

test('the documentation standard publishes its sections and every declared rule', async () => {
  const ids = (await readRules()).rules.map(rule => rule.ruleId);
  assert.deepEqual(await check(standardPage(ids), '/documentation/'), []);
  for (const omit of standardSections) {
    await rejects(standardPage(ids, { omit }), '/documentation/', 'standard-section-missing');
  }
  await rejects(
    standardPage(ids.filter(id => id !== 'component-demo-empty')),
    '/documentation/',
    'standard-rule-unlisted',
  );
});

test('cross-page guide resolution is build-wide, not part of validateBuiltPage', async () => {
  // A single page cannot see the guide page; only validateBuild resolves it.
  assert.deepEqual(await check(componentPage(), '/components/timeline/'), []);
  assert.deepEqual(await check(foundationPage(), '/getting-started/'), []);
});

test('validateBuild inspects every generated HTML page with its route', async t => {
  const ids = (await readRules()).rules.map(rule => rule.ruleId);
  assert.deepEqual(await buildFindings(await tempSite(t, validSite(ids))), []);
  const findings = await buildFindings(
    await tempSite(t, {
      ...validSite(ids),
      'patterns/index.html': foundationPage(),
      'components/broken/index.html': componentPage({
        sections: componentOrder.filter(id => id !== 'api'),
      }),
    }),
  );
  assert.ok(
    findings.some(f => f.path === '/patterns/' && f.ruleId === 'page-kind-unknown'),
    JSON.stringify(findings),
  );
  assert.ok(
    findings.some(
      f => f.path === '/components/broken/' && f.ruleId === 'component-section-missing',
    ),
    JSON.stringify(findings),
  );
  assert.equal(
    findings.some(f => f.path === '/components/timeline/'),
    false,
  );
});

test('validateBuild requires exactly one shared Astro guide target', async t => {
  const ids = (await readRules()).rules.map(rule => rule.ruleId);
  const ruleIds = async files => (await buildFindings(await tempSite(t, files))).map(f => f.ruleId);
  const withoutGuide = Object.fromEntries(
    Object.entries(validSite(ids)).filter(([file]) => file !== 'getting-started/index.html'),
  );
  assert.ok((await ruleIds(withoutGuide)).includes('astro-guide-missing'));
  const missingTarget = {
    ...validSite(ids),
    'getting-started/index.html': guidePage(foundationSections),
  };
  assert.ok((await ruleIds(missingTarget)).includes('astro-guide-target-missing'));
  const twice = guidePage([
    ['purpose', 'Purpose', '<p id="astro-integration">Islands own interaction.</p>'],
    ...guideSections.slice(1),
  ]);
  const duplicateTarget = { ...validSite(ids), 'getting-started/index.html': twice };
  assert.ok((await ruleIds(duplicateTarget)).includes('astro-guide-target-duplicate'));
});

test('the Astro build:done gate fails the build on structural findings', async t => {
  const { default: config } = await import(
    pathToFileURL(resolve(root, 'docs/astro.config.mjs')).href
  );
  const gate = config.integrations.flat().find(item => item?.name === 'atlas-docs-presentation');
  assert.ok(gate, 'atlas-docs-presentation integration is configured');
  const hook = gate.hooks?.['astro:build:done'];
  assert.equal(typeof hook, 'function');
  const logger = { info() {}, warn() {}, error() {}, debug() {}, fork: () => logger };
  const ids = (await readRules()).rules.map(rule => rule.ruleId);
  const run = async files => {
    const dir = pathToFileURL(`${await tempSite(t, files)}/`);
    return hook({ dir, logger, pages: [], routes: [], assets: new Map() });
  };
  await run(validSite(ids));
  await assert.rejects(
    async () =>
      run({
        ...validSite(ids),
        'components/button/index.html': componentPage({
          sections: componentOrder.filter(id => id !== 'api'),
        }),
      }),
    /component-section-missing/,
  );
  await assert.rejects(
    async () => run({ ...validSite(ids), 'patterns/index.html': foundationPage() }),
    /page-kind-unknown/,
  );
});
