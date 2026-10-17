import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { collectPreviewCode } from './docs-preview-code.mjs';

// Structural ECA gate for built documentation HTML. It inspects generated markup only;
// it is not browser, computed-style, visual, device or CI evidence.
const rules = JSON.parse(
  await readFile(resolve(import.meta.dirname, '../docs/src/data/documentation-rules.json'), 'utf8'),
);
const declared = new Set(rules.rules.map(rule => rule.ruleId));
const foundationRoutes = new Map(
  Object.entries(rules.pageKinds).flatMap(([kind, entry]) =>
    (entry.routes ?? []).map(route => [route, kind]),
  ),
);
const componentRoute = new RegExp(rules.pageKinds.component.routePattern);
// Preview documents are not documentation pages: a route is admitted only for a literal
// ExamplePreview id collected from the fixed docs/src/react allowlist and a declared profile.
const previewRoute = new RegExp(rules.previewDocuments.routePattern);
const reactRoot = resolve(import.meta.dirname, '../docs/src/react');
const previewIds = new Set(
  collectPreviewCode(
    await Promise.all(
      (await readdir(reactRoot, { recursive: true }))
        .filter(file => file.endsWith('.tsx'))
        .map(async file => ({
          path: `docs/src/react/${file.split(sep).join('/')}`,
          text: await readFile(resolve(reactRoot, file), 'utf8'),
        })),
    ),
    { sourceUrl: () => '' },
  ).map(({ id }) => id),
);
function previewOf(path) {
  const match = previewRoute.exec(path);
  if (!match) return null;
  const [, id, profile] = match;
  const known = previewIds.has(id) && Object.hasOwn(rules.previewDocuments.deliveries, profile);
  return { id, profile, known };
}
// Declared redirects: each retired route names one canonical documentation route as its target.
const redirectTargets = new Map(Object.entries(rules.pageKinds.redirect?.targets ?? {}));
for (const route of rules.pageKinds.redirect?.routes ?? [])
  if (!redirectTargets.has(route)) throw new Error(`Redirect route ${route} declares no target.`);
for (const [route, target] of redirectTargets) {
  const kind = foundationRoutes.get(target);
  if (foundationRoutes.get(route) !== 'redirect' || !kind || kind === 'redirect')
    throw new Error(`Redirect ${route} must target a documentation route, not ${target}.`);
}
const islandDirective = /\bclient:(?:load|idle|visible|media|only)\b/;
const rendersContent =
  'button, input, select, textarea, a[href], img, svg, canvas, video, audio, iframe, [role], [tabindex]';

const text = node => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
const key = section => section.getAttribute('data-doc-section');
const fragment = href => {
  if (!href?.startsWith('#')) return null;
  try {
    return decodeURIComponent(href.slice(1));
  } catch {
    return href.slice(1);
  }
};
function finding(ruleId, message) {
  if (!declared.has(ruleId)) throw new Error(`Undeclared documentation rule ${ruleId}`);
  return { ruleId, message };
}

/** Page kind for a built route; null means the route is unknown and fails closed. */
export function pageKind(path) {
  if (foundationRoutes.has(path)) return foundationRoutes.get(path);
  if (previewOf(path)?.known) return 'preview';
  return componentRoute.test(path) ? 'component' : null;
}

// A documentation section is a <section> whose aria-labelledby names exactly one id that
// resolves uniquely to the section's own nonempty h2; other labels or targets do not count.
function sectionHeading(section, document, ids) {
  if (section.tagName !== 'SECTION') return { problem: 'is not a <section> element' };
  const references = (section.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
  if (references.length !== 1)
    return { problem: 'needs aria-labelledby naming exactly one heading' };
  const [id] = references;
  if (ids.get(id) !== 1)
    return {
      problem: `references "${id}", which is used by ${ids.get(id) ?? 0} elements instead of one`,
    };
  const heading = document.getElementById(id);
  if (heading.tagName !== 'H2' || heading.closest('[data-doc-section]') !== section)
    return { problem: `references "${id}", which is not the section's own h2` };
  const name = text(heading);
  if (!name) return { problem: 'has an empty h2' };
  return { name };
}

function checkStructure(document, findings) {
  const h1 = document.querySelectorAll('h1').length;
  if (h1 !== 1)
    findings.push(
      finding('heading-single-h1', `Found ${h1} h1 elements; a page needs exactly one.`),
    );
  const scope = document.querySelector('main') ?? document.body;
  const sections = [...scope.querySelectorAll('[data-doc-section]')];
  const ids = new Map();
  for (const element of document.querySelectorAll('[id]'))
    ids.set(element.id, (ids.get(element.id) ?? 0) + 1);
  const names = new Map();
  for (const section of sections) {
    const { name, problem } = sectionHeading(section, document, ids);
    if (problem)
      findings.push(
        finding(
          'section-unnamed',
          `Section "${key(section)}" ${problem}; it must be named by its own h2.`,
        ),
      );
    else if (names.has(name.toLowerCase()))
      findings.push(
        finding(
          'section-name-duplicate',
          `Sections "${names.get(name.toLowerCase())}" and "${key(section)}" are both named "${name}".`,
        ),
      );
    else names.set(name.toLowerCase(), key(section));
    if (section.id !== key(section))
      findings.push(
        finding(
          'section-id-mismatch',
          `Section "${key(section)}" has id "${section.id}"; the id must equal data-doc-section.`,
        ),
      );
    if (section.id && ids.get(section.id) > 1)
      findings.push(
        finding(
          'section-target-duplicate',
          `Target #${section.id} is used by ${ids.get(section.id)} elements.`,
        ),
      );
  }

  // The 320px section links and every desktop contents are checked independently;
  // each must list every section exactly once, comparing decoded fragments.
  const targets = new Set(sections.map(section => section.id).filter(Boolean));
  const navs = [...document.querySelectorAll('nav[data-doc-nav]')];
  const sectionNavs = navs.filter(nav => nav.getAttribute('data-doc-nav') === 'sections');
  if (!sectionNavs.length)
    findings.push(
      finding('navigation-missing', 'No nav[data-doc-nav="sections"] lists the page sections.'),
    );
  for (const nav of navs) {
    const variant = nav.getAttribute('data-doc-nav');
    const seen = new Set();
    const listed = new Set();
    for (const link of nav.querySelectorAll('a')) {
      // Page tools slotted into a navigation link to sources and the repository, not sections.
      const tools = link.closest('[data-doc-tools]');
      if (tools && tools !== nav && nav.contains(tools)) continue;
      const href = link.getAttribute('href');
      const id = fragment(href);
      if (id === null || !targets.has(id))
        findings.push(
          finding(
            'navigation-target-missing',
            `The ${variant} navigation links to "${href ?? ''}", which is not a section on this page.`,
          ),
        );
      const target = id === null ? href : `#${id}`;
      if (seen.has(target))
        findings.push(
          finding(
            'navigation-link-duplicate',
            `The ${variant} navigation lists "${href}", which resolves to ${target} already listed.`,
          ),
        );
      seen.add(target);
      if (id !== null) listed.add(id);
    }
    if (variant === 'sections' || variant === 'toc')
      for (const section of sections)
        if (section.id && !listed.has(section.id))
          findings.push(
            finding(
              'navigation-section-unlisted',
              `Section #${section.id} is missing from the ${variant} navigation.`,
            ),
          );
  }
  return sections;
}

// Native HTML/SVG compositions have no Ant Design page. Each registered component slug
// accepts exactly one standards reference; other routes and other links still fail.
const nativeReferences = new Map([
  ['media', 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/figure'],
  ['chart', 'https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect'],
  ['carousel', 'https://www.w3.org/WAI/ARIA/apg/patterns/carousel/'],
]);

function componentSlug(path) {
  const segments = path.split('/');
  return segments.length === 4 && !segments[0] && segments[1] === 'components' && !segments[3]
    ? segments[2]
    : null;
}

function officialHref(href, path) {
  if (!href) return false;
  let url;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (
    url.protocol === rules.officialReference.protocol &&
    rules.officialReference.hosts.some(
      host => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  )
    return true;
  const native = nativeReferences.get(componentSlug(path));
  return Boolean(native) && url.protocol === 'https:' && !url.hash && href === native;
}

// Same-site URL for an href resolved against the page route; null when absent, invalid or external.
const siteOrigin = 'https://genux.invalid';
function localUrl(href, path) {
  if (!href) return null;
  try {
    const url = new URL(href, `${siteOrigin}${path}`);
    return url.origin === siteOrigin ? url : null;
  } catch {
    return null;
  }
}

function guideHref(href, path) {
  const url = localUrl(href, path);
  return url?.pathname === rules.astroGuide.route && url.hash === `#${rules.astroGuide.target}`;
}

// True only for exactly this route, without query or fragment.
function routesTo(href, path, route) {
  const url = localUrl(href, path);
  return url?.pathname === route && !url.search && !url.hash;
}

function sourcePath(value) {
  // Project instruction entry points are valid concrete paths at the root.
  if (['AGENTS.md', 'CLAUDE.md', 'CONTRIBUTING.md'].includes(value)) return true;
  const segments = value.split('/');
  return (
    segments.length > 1 &&
    segments.every(
      segment => /^[\w.@[\]-]+$/.test(segment) && segment !== '.' && segment !== '..',
    ) &&
    /\.[A-Za-z0-9]+$/.test(segments.at(-1))
  );
}

function rendered(demo) {
  const copy = demo.cloneNode(true);
  for (const node of copy.querySelectorAll('script, style, template, noscript')) node.remove();
  return Boolean(text(copy)) || Boolean(copy.querySelector(rendersContent));
}

function checkComponent(document, sections, path, findings) {
  const order = rules.componentSections;
  const keys = sections.map(key);
  for (const id of order) {
    const count = keys.filter(entry => entry === id).length;
    if (!count)
      findings.push(finding('component-section-missing', `Component section "${id}" is missing.`));
    else if (count > 1)
      findings.push(
        finding('component-section-duplicate', `Component section "${id}" appears ${count} times.`),
      );
  }
  const present = [...new Set(keys)];
  const expected = order.filter(id => present.includes(id));
  if (present.join() !== expected.join())
    findings.push(
      finding(
        'component-section-order',
        `Sections are ${present.join(', ')}; expected the shared order ${expected.join(', ')}.`,
      ),
    );
  const section = id => sections.find(entry => key(entry) === id);

  const scope = document.querySelector('main') ?? document.body;
  const demos = scope.querySelectorAll('[data-doc-demo]');
  if (demos.length > 1)
    findings.push(
      finding('component-demo-duplicate', `Found ${demos.length} live demonstration areas.`),
    );
  const examples = section('examples');
  const demo = examples?.querySelector('[data-doc-demo]');
  if (examples && !(demo && rendered(demo)))
    findings.push(
      finding('component-demo-empty', 'The live examples section has no rendered demonstration.'),
    );

  const api = section('api');
  if (api) {
    if (!api.querySelector('table'))
      findings.push(finding('component-api-missing', 'The API section has no local API table.'));
    const references = [...api.querySelectorAll('[data-doc-official-reference]')];
    if (!references.length)
      findings.push(
        finding('component-api-reference-missing', 'The API section has no official reference.'),
      );
    for (const reference of references)
      if (!officialHref(reference.getAttribute('href'), path))
        findings.push(
          finding(
            'component-api-reference-invalid',
            `Official reference "${reference.getAttribute('href') ?? ''}" is neither a usable https Ant Design destination nor the registered native reference for this component.`,
          ),
        );
  }

  const astro = section('astro');
  if (astro) {
    const example = [...astro.querySelectorAll('pre, code')].some(
      code => islandDirective.test(code.textContent) && /^\s*import\s/m.test(code.textContent),
    );
    if (!example)
      findings.push(
        finding(
          'component-astro-incomplete',
          'The Astro integration section needs an example with an import and a client: island directive.',
        ),
      );
    if (
      ![...astro.querySelectorAll('a[href]')].some(link =>
        guideHref(link.getAttribute('href'), path),
      )
    )
      findings.push(
        finding(
          'component-astro-incomplete',
          `The Astro integration section must link to ${rules.astroGuide.route}#${rules.astroGuide.target}.`,
        ),
      );
  }

  const resources = section('resources');
  if (resources) {
    for (const kind of rules.resources.kinds) {
      const sources = [...resources.querySelectorAll(`[data-doc-resource="${kind}"]`)].flatMap(
        entry => [...entry.querySelectorAll('[data-doc-source]')].map(text),
      );
      if (!sources.length || !sources.every(sourcePath))
        findings.push(
          finding(
            'component-resources-incomplete',
            `Resource "${kind}" must name concrete source paths.`,
          ),
        );
      for (const required of rules.resources.requiredSources[kind] ?? [])
        if (!sources.includes(required))
          findings.push(
            finding('component-resources-incomplete', `Resource "${kind}" must name ${required}.`),
          );
    }
    if (!text(resources.querySelector('[data-doc-capability-status]')))
      findings.push(
        finding(
          'component-resources-incomplete',
          'Resources must state the GenUX capability status separately.',
        ),
      );
  }
}

function checkStandard(sections, findings) {
  for (const id of rules.standardSections)
    if (!sections.some(section => key(section) === id))
      findings.push(finding('standard-section-missing', `Standard section "${id}" is missing.`));
  const table = sections.find(section => key(section) === 'rules');
  if (!table) return;
  const listed = new Set(
    [...table.querySelectorAll('[data-rule-id]')].map(row => row.getAttribute('data-rule-id')),
  );
  for (const id of declared)
    if (!listed.has(id))
      findings.push(finding('standard-rule-unlisted', `Rule ${id} is not published.`));
}

// A redirect page carries no documentation. Every client must reach its declared target through
// one canonical link, one zero-delay refresh and a fallback link; fragment mapping is the page's own.
const refreshTarget = /^\s*0\s*[;,]\s*url\s*=\s*(['"]?)([^'"\s]+)\1\s*$/i;

function checkRedirect(document, path, findings) {
  const target = redirectTargets.get(path);
  const canonicals = [...document.querySelectorAll('link[rel~="canonical"]')];
  if (canonicals.length !== 1 || !routesTo(canonicals[0].getAttribute('href'), path, target))
    findings.push(
      finding(
        'redirect-metadata-invalid',
        `${path} needs exactly one canonical link to ${target}.`,
      ),
    );
  const refreshes = [...document.querySelectorAll('meta[http-equiv]')].filter(
    meta => meta.getAttribute('http-equiv').trim().toLowerCase() === 'refresh',
  );
  const refresh =
    refreshes.length === 1 ? refreshTarget.exec(refreshes[0].getAttribute('content') ?? '') : null;
  if (!routesTo(refresh?.[2], path, target))
    findings.push(
      finding(
        'redirect-metadata-invalid',
        `${path} needs exactly one zero-delay refresh to ${target}.`,
      ),
    );
  const links = [...document.querySelectorAll('a[href]')];
  if (!links.some(link => routesTo(link.getAttribute('href'), path, target)))
    findings.push(
      finding('redirect-fallback-missing', `${path} has no fallback link to ${target}.`),
    );
}

// A preview page is one server-rendered example document hydrated only by the selected
// profile's delivery entry; client-only placeholders and documentation chrome fail.
// Preview content is the example's own server-rendered markup: presentational text, graphics and
// native controls all count. Hidden nodes and unresolved React Suspense boundaries ($? pending,
// $! client-rendered) are not server-rendered content, so empty wrappers and loading-only or
// client-only placeholders still fail.
const previewMarkup = `img, svg, canvas, video, audio, picture, iframe, [role='img'], button, input, select, textarea, a[href], summary, [contenteditable=true], [tabindex]:not([tabindex='-1'])`;
const unresolvedBoundary = new Set(['$?', '$!']);
const docsChrome = '[data-doc-section], [data-doc-nav], [data-doc-contents], [data-doc-tools]';
const islandFile = island => (island.getAttribute('component-url') ?? '').split('/').at(-1);

function renderedPreview(document, contents) {
  if (contents.length !== 1) return false;
  const content = contents[0].cloneNode(true);
  for (const node of content.querySelectorAll('script, style, template, noscript, [hidden]'))
    node.remove();
  const comments = document.createTreeWalker(content, document.defaultView.NodeFilter.SHOW_COMMENT);
  while (comments.nextNode()) if (unresolvedBoundary.has(comments.currentNode.data)) return false;
  return (
    Boolean(content.firstElementChild) &&
    (Boolean(text(content)) || Boolean(content.querySelector(previewMarkup)))
  );
}

function checkPreview(document, profile, findings) {
  const delivery = rules.previewDocuments.deliveries[profile];
  const islands = [...document.querySelectorAll('astro-island')];
  const [island] = islands;
  const selected =
    islands.length === 1 &&
    island.getAttribute('client') !== 'only' &&
    islandFile(island).startsWith(`${delivery}.`) &&
    islandFile(island).endsWith('.js');
  if (!selected)
    findings.push(
      finding(
        'preview-island-invalid',
        `Expected exactly one hydrating ${delivery} island; found ${islands.map(islandFile).join(', ') || 'none'}.`,
      ),
    );
  const documents = [...document.querySelectorAll('[data-preview-document]')];
  const root =
    documents.length === 1 && selected && island.contains(documents[0]) ? documents[0] : null;
  if (!root || root.getAttribute('data-profile') !== profile) {
    findings.push(
      finding(
        'preview-document-invalid',
        `Expected one server-rendered ${profile} preview document inside the ${delivery} island; found ${documents.length}.`,
      ),
    );
    return;
  }
  if (root.querySelector(docsChrome))
    findings.push(
      finding('preview-shell-nested', 'The preview document embeds documentation page chrome.'),
    );
  const contents = root.querySelectorAll('[data-preview-content]');
  if (!renderedPreview(document, contents))
    findings.push(
      finding(
        'preview-content-invalid',
        `Expected exactly one [data-preview-content] with server-rendered text, graphics or controls; found ${contents.length}.`,
      ),
    );
}

/** Structural findings for one generated page; cross-page checks belong to validateBuild. */
export function validateBuiltPage(html, { path }) {
  const kind = pageKind(path);
  if (!kind)
    return [
      previewOf(path)
        ? finding('preview-route-unknown', `${path} names no literal ExamplePreview id.`)
        : finding(
            'page-kind-unknown',
            `${path} is neither a listed foundation route nor a /components/<slug>/ route.`,
          ),
    ];
  const { window } = new JSDOM(html);
  const findings = [];
  if (kind === 'preview') checkPreview(window.document, previewOf(path).profile, findings);
  else if (kind === 'redirect') checkRedirect(window.document, path, findings);
  else {
    const sections = checkStructure(window.document, findings);
    if (kind === 'component') checkComponent(window.document, sections, path, findings);
    else if (!sections.length)
      findings.push(
        finding('foundation-sections-missing', 'The page has no named documentation sections.'),
      );
    if (kind === 'standard') checkStandard(sections, findings);
  }
  window.close();
  return findings;
}

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(entry => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return htmlFiles(path);
        return entry.name.endsWith('.html') ? [path] : [];
      }),
    )
  ).flat();
}
function routeOf(file) {
  const path = file.split(sep).join('/');
  if (path === 'index.html') return '/';
  return path.endsWith('/index.html') ? `/${path.slice(0, -'index.html'.length)}` : `/${path}`;
}

function checkGuide(html) {
  const { route, target } = rules.astroGuide;
  if (html === undefined) return [finding('astro-guide-missing', `${route} was not generated.`)];
  const { window } = new JSDOM(html);
  const count = [...window.document.querySelectorAll('[id]')].filter(
    element => element.id === target,
  ).length;
  window.close();
  if (!count) return [finding('astro-guide-target-missing', `${route} has no #${target} target.`)];
  if (count > 1)
    return [finding('astro-guide-target-duplicate', `${route} has ${count} #${target} targets.`)];
  return [];
}

/** Validates every generated HTML page in an output directory; findings name their route. */
export async function validateBuild(outputDirectory) {
  const directory =
    outputDirectory instanceof URL ? fileURLToPath(outputDirectory) : resolve(outputDirectory);
  const findings = [];
  let guide;
  const generated = new Set();
  for (const file of (await htmlFiles(directory)).sort()) {
    const path = routeOf(relative(directory, file));
    generated.add(path);
    const html = await readFile(file, 'utf8');
    for (const item of validateBuiltPage(html, { path })) findings.push({ ...item, path });
    if (path === rules.astroGuide.route) guide = html;
  }
  for (const item of checkGuide(guide)) findings.push({ ...item, path: rules.astroGuide.route });
  for (const [route, target] of redirectTargets)
    for (const missing of [route, target].filter(entry => !generated.has(entry)))
      findings.push({
        ...finding(
          'redirect-route-missing',
          `${route} redirects to ${target}; ${missing} was not generated.`,
        ),
        path: route,
      });
  return findings;
}

// Vite's css-post plugin emits code-split CSS assets during renderChunk, so a generateBundle
// handler ordered "pre" sees every emitted stylesheet before Astro's own CSS generateBundle
// prunes assets it assumes the SSR manifest already covers. Only flat /_astro/<name>.css
// stylesheets that the built HTML links are restored, byte-for-byte, from this same build.
const localCss = /^\/(_astro\/[\w-]+(?:\.[\w-]+)*\.css)$/;

// Name of a local CSS link: with a configured Astro base only links under that base qualify,
// and the base is stripped before the flat /_astro/<name>.css check.
function linkedCss(href, base) {
  if (!base) return localCss.exec(href)?.[1];
  return href.startsWith(`${base}/`) ? localCss.exec(href.slice(base.length))?.[1] : undefined;
}

function cssSnapshotPlugin(snapshots) {
  return {
    name: 'genux-docs-css-snapshot',
    generateBundle: {
      order: 'pre',
      handler(_options, bundle) {
        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type !== 'asset' || !localCss.test(`/${fileName}`)) continue;
          const bytes =
            typeof output.source === 'string'
              ? Buffer.from(output.source, 'utf8')
              : Buffer.from(output.source);
          const known = snapshots.get(fileName);
          if (known && !known.equals(bytes))
            throw new Error(`CSS asset ${fileName} was emitted with conflicting contents.`);
          snapshots.set(fileName, bytes);
        }
      },
    },
  };
}

async function restoreMissingCss(directory, snapshots, logger, base) {
  const checked = new Set();
  for (const file of (await htmlFiles(directory)).sort()) {
    const { window } = new JSDOM(await readFile(file, 'utf8'));
    const hrefs = [...window.document.querySelectorAll('link[rel~="stylesheet"][href]')].map(link =>
      link.getAttribute('href'),
    );
    window.close();
    for (const href of hrefs) {
      const name = linkedCss(href, base);
      if (!name || checked.has(name)) continue;
      checked.add(name);
      const target = resolve(directory, name);
      try {
        await access(target);
        continue;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const bytes = snapshots.get(name);
      if (!bytes)
        throw new Error(
          `${routeOf(relative(directory, file))} links ${href}, which this build did not emit.`,
        );
      await writeFile(target, bytes, { flag: 'wx' });
      logger.warn(`Restored ${name} from the CSS emitted by this build.`);
    }
  }
}

/** Astro build gate: structural ECA findings fail the documentation build. */
export default function docsPresentation() {
  const snapshots = new Map();
  let base = '';
  return {
    name: 'genux-docs-presentation',
    hooks: {
      'astro:config:setup': ({ config }) => {
        // Astro prefixes its own /_astro/ links with base; root builds keep an empty base.
        const configured = config.base ?? '';
        base = configured.endsWith('/') ? configured.slice(0, -1) : configured;
      },
      'astro:build:start': () => {
        snapshots.clear();
      },
      'astro:build:setup': ({ updateConfig }) => {
        updateConfig({ plugins: [cssSnapshotPlugin(snapshots)] });
      },
      'astro:build:done': async ({ dir, logger }) => {
        await restoreMissingCss(fileURLToPath(dir), snapshots, logger, base);
        const findings = await validateBuild(fileURLToPath(dir));
        if (findings.length) {
          const report = findings
            .map(item => `${item.path} ${item.ruleId}: ${item.message}`)
            .join('\n');
          logger.error(report);
          throw new Error(
            `Documentation presentation gate failed with ${findings.length} findings:\n${report}`,
          );
        }
        logger.info('Documentation presentation gate: pass (built HTML structure only).');
      },
    },
  };
}
