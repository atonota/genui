import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import policy from '../docs/src/data/url-policy.json' with { type: 'json' };

const root = `${policy.origin}${policy.base}/`;
const pageFile = (directory, path) =>
  resolve(directory, path === '/' ? 'index.html' : `${path.slice(1)}index.html`);

/** Validate the final artifact, after the existing Pages base/asset adapter has run. */
export async function validateUrlBuild(directory, { base = '/' } = {}) {
  const manifest = JSON.parse(await readFile(resolve(directory, 'url-manifest.json'), 'utf8'));
  const findings = [];
  const paths = new Set();
  const titles = new Set();
  const urls = new Set();
  const documents = new Map();
  for (const page of manifest.pages) {
    if (paths.has(page.path) || urls.has(page.url))
      findings.push(`Duplicate document: ${page.path}`);
    paths.add(page.path);
    urls.add(page.url);
    if (
      !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(page.path) ||
      Object.hasOwn(policy.aliases, page.path) ||
      page.url !== `${policy.origin}${policy.base}${page.path}`
    )
      findings.push(`Invalid canonical route: ${page.path}`);
    const dom = new JSDOM(await readFile(pageFile(directory, page.path), 'utf8'));
    documents.set(page.path, dom);
    const doc = dom.window.document;
    const canonical = [...doc.querySelectorAll('link[rel="canonical"]')];
    if (canonical.length !== 1 || canonical[0].getAttribute('href') !== page.url)
      findings.push(`Canonical mismatch: ${page.path}`);
    if (/noindex/i.test(doc.querySelector('meta[name="robots"]')?.content ?? ''))
      findings.push(`Canonical document is noindex: ${page.path}`);
    const title = doc.title.trim();
    if (!title || titles.has(title)) findings.push(`Missing or duplicate title: ${page.path}`);
    titles.add(title);
    if (!doc.querySelector('meta[name="description"]')?.content.trim())
      findings.push(`Missing description: ${page.path}`);
    if (doc.querySelector('meta[property="og:url"]')?.content !== page.url)
      findings.push(`Open Graph URL mismatch: ${page.path}`);
    for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        JSON.parse(node.textContent);
      } catch {
        findings.push(`Invalid structured data: ${page.path}`);
      }
    }
  }
  for (const page of policy.pages)
    if (!paths.has(page.path)) findings.push(`Registered document is missing: ${page.path}`);
  // All canonical documents are discoverable from visible server-rendered links. An alias is
  // never a navigation destination; base stripping keeps root/local and project hosting distinct.
  const graph = new Map();
  for (const [path, dom] of documents) {
    const links = new Set();
    graph.set(path, links);
    for (const anchor of dom.window.document.querySelectorAll('a[href]')) {
      const url = new URL(
        anchor.getAttribute('href'),
        `${policy.origin}${base.replace(/\/$/, '')}${path}`,
      );
      if (url.origin !== policy.origin) continue;
      const prefix = anchor.getAttribute('href').startsWith(root)
        ? policy.base
        : base.replace(/\/$/, '');
      if (prefix && !url.pathname.startsWith(`${prefix}/`)) continue;
      const logical = prefix ? url.pathname.slice(prefix.length) : url.pathname;
      links.add(logical);
      if (Object.hasOwn(policy.aliases, logical))
        findings.push(`Navigation uses retired route: ${path} -> ${logical}`);
    }
    dom.window.close();
  }
  const linked = new Set(['/']);
  for (const path of linked)
    for (const target of graph.get(path) ?? []) if (paths.has(target)) linked.add(target);
  for (const path of paths)
    if (!linked.has(path)) findings.push(`Orphaned canonical document: ${path}`);
  // Reconcile emitted HTML against discovery too: registering a page kind alone must not
  // silently publish a canonical document omitted from the registry and sitemap.
  for (const file of await readdir(directory, { recursive: true })) {
    if (!file.endsWith('.html') || file.startsWith('preview/') || file === '404.html') continue;
    const path =
      file === 'index.html'
        ? '/'
        : file.endsWith('/index.html')
          ? `/${file.slice(0, -'index.html'.length)}`
          : `/${file}`;
    if (paths.has(path) || Object.hasOwn(policy.aliases, path)) continue;
    const dom = new JSDOM(await readFile(resolve(directory, file), 'utf8'));
    if (!/noindex/i.test(dom.window.document.querySelector('meta[name="robots"]')?.content ?? ''))
      findings.push(`Unregistered indexable document: ${path}`);
    dom.window.close();
  }
  const xml = new JSDOM(await readFile(resolve(directory, 'sitemap.xml'), 'utf8'), {
    contentType: 'application/xml',
  });
  const sitemap = [...xml.window.document.querySelectorAll('loc')].map(node => node.textContent);
  if (
    sitemap.length !== urls.size ||
    new Set(sitemap).size !== sitemap.length ||
    sitemap.some(url => !urls.has(url))
  )
    findings.push('Sitemap differs from the canonical document registry.');
  xml.window.close();
  for (const [from, to] of Object.entries(policy.aliases)) {
    if (paths.has(from) || !paths.has(to) || Object.hasOwn(policy.aliases, to))
      findings.push(`Invalid alias: ${from} -> ${to}`);
    const dom = new JSDOM(await readFile(pageFile(directory, from), 'utf8'));
    const doc = dom.window.document;
    if (
      doc.querySelector('link[rel="canonical"]')?.getAttribute('href') !==
        `${policy.origin}${policy.base}${to}` ||
      !/noindex/i.test(doc.querySelector('meta[name="robots"]')?.content ?? '')
    )
      findings.push(`Invalid alias metadata: ${from}`);
    dom.window.close();
  }
  const notFound = new JSDOM(await readFile(resolve(directory, '404.html'), 'utf8'));
  if (
    !/noindex/i.test(
      notFound.window.document.querySelector('meta[name="robots"]')?.content ?? '',
    ) ||
    notFound.window.document.querySelector('link[rel="canonical"]')
  )
    findings.push('404 must be noindex without a canonical to a valid document.');
  notFound.window.close();
  if (manifest.root !== root) findings.push('Manifest hosting root differs from the URL policy.');
  return findings;
}

export default function docsUrlPolicy() {
  let base = '/';
  return {
    name: 'genux-docs-url-policy',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const findings = await validateUrlBuild(fileURLToPath(dir), { base });
        if (findings.length) throw new Error(`URL policy failed:\n${findings.join('\n')}`);
        logger.info('Canonical routes, metadata, discovery, aliases and 404: pass.');
      },
    },
  };
}
