import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Regression contract for desktop contents coverage and the section heading contract.
// The fixtures exercise the exported validator on built markup only; they are not
// browser, computed-style, device or CI evidence.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const loadGate = () => import(pathToFileURL(resolve(root, 'tools/docs-presentation.mjs')).href);
const readRules = async () =>
  JSON.parse(await readFile(resolve(root, 'docs/src/data/documentation-rules.json'), 'utf8'));

const route = '/tokens/';
const navigationRule = /^navigation-/;
const headingRule = /^(?:section|heading)-/;

const defaultSections = [
  ['purpose', 'Purpose'],
  ['details', 'Details'],
  ['limits', 'Limits'],
];
const ids = defaultSections.map(([id]) => id);
const hashes = list => list.map(id => `#${id}`);

const shell = main => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Fixture · GenUX Components</title></head>
  <body data-genux-surface="docs">
    <a class="skip-link" href="#content">Skip to content</a>
    <header><a href="/">GenUX Components</a></header>
    <aside>
      <h2 id="library-title">Component library</h2>
      <nav aria-label="Documentation"><a href="/documentation/">Documentation standard</a></nav>
    </aside>
    <main id="content" tabindex="-1">${main}</main>
    <footer><a href="/licenses/">Third-party licenses</a></footer>
  </body>
</html>`;

function docSection(
  id,
  heading,
  {
    tag = 'section',
    level = 'h2',
    headingId = `${id}-title`,
    labelledBy = `${id}-title`,
    label = null,
    body = '<p>Shared tokens own spacing and type.</p>',
  } = {},
) {
  const attributes = [`id="${id}"`, `data-doc-section="${id}"`];
  if (labelledBy !== null) attributes.push(`aria-labelledby="${labelledBy}"`);
  if (label !== null) attributes.push(`aria-label="${label}"`);
  const target = headingId === null ? '' : ` id="${headingId}"`;
  const title = heading === null ? '' : `<${level}${target}>${heading}</${level}>`;
  return `<${tag} ${attributes.join(' ')}>${title}${body}</${tag}>`;
}
// The 320px section links and every desktop contents are page navigation.
const pageNav = (variant, hrefs) =>
  `<nav data-doc-nav="${variant}" aria-label="${variant === 'toc' ? 'Contents' : 'On this page'}">${hrefs
    .map(href => `<a href="${href}">${href.slice(1)}</a>`)
    .join('')}</nav>`;

function page({
  sections = defaultSections,
  override = {},
  links,
  tocs,
  before = '',
  after = '',
  h1 = '<h1>Tokens</h1>',
} = {}) {
  const list = sections.map(([id]) => id);
  const content = sections.map(([id, heading]) => override[id] ?? docSection(id, heading)).join('');
  const sectionLinks = pageNav('sections', links ?? hashes(list));
  const contents = (tocs ?? [hashes(list)]).map(hrefs => pageNav('toc', hrefs)).join('');
  return shell(
    `<article>${h1}<p>Lead.</p>${sectionLinks}${before}${content}${after}</article>${contents}`,
  );
}
const guidePage = () =>
  page({
    h1: '<h1>Getting started</h1>',
    sections: [...defaultSections, ['astro-integration', 'Astro integration']],
  });

async function declaredRuleIds() {
  return new Set((await readRules()).rules.map(rule => rule.ruleId));
}
async function check(html, path = route) {
  const { validateBuiltPage } = await loadGate();
  const findings = await validateBuiltPage(html, { path });
  assert.ok(Array.isArray(findings), 'findings are an array');
  const declared = await declaredRuleIds();
  for (const finding of findings) {
    assert.ok(
      declared.has(finding.ruleId),
      `${finding.ruleId} is declared in documentation-rules.json`,
    );
    assert.equal(typeof finding.message, 'string');
    assert.ok(finding.message.trim(), `${finding.ruleId} explains the failure`);
  }
  return findings.map(finding => finding.ruleId);
}
async function rejects(html, pattern, why, path = route) {
  const found = await check(html, path);
  assert.ok(
    found.some(id => pattern.test(id)),
    `${why}: expected a ${pattern} finding, received ${JSON.stringify(found)}`,
  );
}

async function tempSite(t, files) {
  const directory = await mkdtemp(join(tmpdir(), 'genux-docs-structure-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [file, html] of Object.entries(files)) {
    await mkdir(dirname(join(directory, file)), { recursive: true });
    await writeFile(join(directory, file), html);
  }
  return directory;
}

test('valid minimal fixtures keep passing', async () => {
  assert.deepEqual(await check(page()), [], 'one complete contents');
  assert.deepEqual(await check(page({ tocs: [] })), [], 'contents are optional');
  assert.deepEqual(
    await check(page({ tocs: [hashes(ids), hashes(ids)] })),
    [],
    'every present contents is complete',
  );
  assert.deepEqual(
    await check(page({ tocs: [['#purpose', '#%64etails', '#limits']] })),
    [],
    'an encoded fragment that decodes to a section covers it once',
  );
  assert.deepEqual(
    await check(page({ links: ['#purpose', '#%64etails', '#limits'] })),
    [],
    'encoded section links resolve after decoding',
  );
  const rich = docSection('details', '<code>Token</code> details', {
    body: '<h3 id="details-scale">Scale</h3><p>Steps.</p><h3 id="details-usage">Usage</h3>',
  });
  assert.deepEqual(
    await check(page({ override: { details: rich } })),
    [],
    'inline heading markup and h3 subsections stay valid',
  );
  assert.deepEqual(await check(guidePage(), '/getting-started/'), []);
});

test('an empty desktop contents fails', async () => {
  await rejects(page({ tocs: [[]] }), navigationRule, 'empty contents');
  await rejects(
    page({ tocs: [hashes(ids), []] }),
    navigationRule,
    'empty contents beside a complete one',
  );
});

test('a desktop contents that omits any section fails', async () => {
  for (const omitted of ids) {
    await rejects(
      page({ tocs: [hashes(ids.filter(id => id !== omitted))] }),
      navigationRule,
      `contents without #${omitted}`,
    );
    await rejects(
      page({ tocs: [hashes(ids), hashes(ids.filter(id => id !== omitted))] }),
      navigationRule,
      `second contents without #${omitted}`,
    );
  }
});

test('equivalent encoded fragments count as duplicate targets', async () => {
  for (const encoded of ['#%64etails', '#d%65tails', '#%64%65%74%61%69%6C%73']) {
    await rejects(
      page({ tocs: [['#purpose', '#details', encoded, '#limits']] }),
      navigationRule,
      `contents lists #details and ${encoded}`,
    );
    await rejects(
      page({ links: ['#purpose', '#details', encoded, '#limits'] }),
      navigationRule,
      `section links list #details and ${encoded}`,
    );
  }
  // Two distinct encoded spellings of one target, without a literal #details link.
  const spellings = ['#purpose', '#%64etails', '#d%65tails', '#limits'];
  await rejects(
    page({ tocs: [spellings] }),
    navigationRule,
    'contents lists #%64etails and #d%65tails',
  );
  await rejects(
    page({ links: spellings }),
    navigationRule,
    'section links list #%64etails and #d%65tails',
  );
});

test('every section is a section element named by its own h2', async () => {
  const cases = {
    'div element': docSection('details', 'Details', { tag: 'div' }),
    'article element': docSection('details', 'Details', { tag: 'article' }),
    'aria-label only': docSection('details', null, { labelledBy: null, label: 'Details' }),
    'aria-label beside an unreferenced h2': docSection('details', 'Details', {
      labelledBy: null,
      label: 'Details',
    }),
    'h2 without aria-labelledby': docSection('details', 'Details', { labelledBy: null }),
    'reference to a paragraph': docSection('details', 'Details', { level: 'p' }),
    'reference to an h3': docSection('details', 'Details', { level: 'h3' }),
    'h2 without the referenced id': docSection('details', 'Details', { headingId: null }),
    'blank h2': docSection('details', ' ', {}),
  };
  for (const [why, section] of Object.entries(cases)) {
    await rejects(page({ override: { details: section } }), headingRule, why);
  }
});

test('aria-labelledby must reference the section h2, not other content in the section', async () => {
  // The section keeps a valid, nonempty, uniquely identified h2 in every fixture;
  // only the aria-labelledby target changes.
  const body =
    '<p id="details-note">Supporting note</p><h3 id="details-sub">Scale</h3><p>Steps.</p>';
  const labelled = labelledBy =>
    page({ override: { details: docSection('details', 'Details', { labelledBy, body }) } });
  assert.deepEqual(
    await check(labelled('details-title')),
    [],
    'reference to the section h2 beside an identified paragraph and h3',
  );
  await rejects(
    labelled('details-note'),
    headingRule,
    'reference to a paragraph while the section h2 is present',
  );
  await rejects(
    labelled('details-sub'),
    headingRule,
    'reference to an h3 while the section h2 is present',
  );
});

test('aria-labelledby must resolve uniquely to the section heading', async () => {
  await rejects(
    page({ after: '<p id="details-title">Details</p>' }),
    headingRule,
    'duplicate heading id after the h2',
  );
  await rejects(
    page({ before: '<p id="details-title">Details</p>' }),
    headingRule,
    'duplicate heading id before the h2',
  );
  await rejects(
    page({
      override: { details: docSection('details', 'Details', { labelledBy: 'stray-title' }) },
      after: '<h2 id="stray-title">Stray heading</h2>',
    }),
    headingRule,
    'reference to an h2 outside the section',
  );
  await rejects(
    page({
      override: { details: docSection('details', 'Details', { labelledBy: 'library-title' }) },
    }),
    headingRule,
    'reference to the sidebar h2',
  );
});

test('validateBuild reports contents and heading defects on their routes', async t => {
  const site = tokens => ({
    'getting-started/index.html': guidePage(),
    'tokens/index.html': tokens,
  });
  const findings = async files => {
    const { validateBuild } = await loadGate();
    const result = await validateBuild(await tempSite(t, files));
    assert.ok(Array.isArray(result), 'findings are an array');
    return result;
  };
  assert.deepEqual(await findings(site(page())), []);
  const emptyToc = await findings(site(page({ tocs: [[]] })));
  assert.ok(
    emptyToc.some(f => f.path === route && navigationRule.test(f.ruleId)),
    JSON.stringify(emptyToc),
  );
  const labelOnly = await findings(
    site(
      page({
        override: { details: docSection('details', null, { labelledBy: null, label: 'Details' }) },
      }),
    ),
  );
  assert.ok(
    labelOnly.some(f => f.path === route && headingRule.test(f.ruleId)),
    JSON.stringify(labelOnly),
  );
});
