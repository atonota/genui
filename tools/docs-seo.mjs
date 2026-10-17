import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';
import policy from '../docs/src/data/seo-policy.json' with { type: 'json' };
import urls from '../docs/src/data/url-policy.json' with { type: 'json' };

const root = `${urls.origin}${urls.base}/`;
const image = new URL(policy.social.path.slice(1), root).href;

/** Pure document admission; it validates observable markup, never search rankings. */
export function validateSeoDocument(doc, { path, canonical }) {
  const failures = [];
  const oneMeta = (attribute, name) => {
    const nodes = [...doc.querySelectorAll(`meta[${attribute}="${name}"]`)];
    return nodes.length === 1 ? nodes[0].content : undefined;
  };
  const description = oneMeta('name', 'description');
  if (doc.querySelectorAll('title').length !== 1 || !doc.title.trim() || !description?.trim())
    failures.push(`${path}: missing/duplicate title or description`);
  const directives = (oneMeta('name', 'robots') ?? '')
    .toLowerCase()
    .split(',')
    .map(value => value.trim());
  if (
    !directives.includes('index') ||
    !directives.includes('follow') ||
    directives.some(value =>
      ['noindex', 'none', 'nosnippet', 'nofollow', 'max-snippet:0'].includes(value),
    )
  )
    failures.push(`${path}: conflicting or missing indexing/snippet directives`);
  if (doc.documentElement.lang !== policy.site.language || doc.querySelector('link[hreflang]'))
    failures.push(`${path}: unsupported language publication`);
  const social = {
    'og:url': canonical,
    'og:title': doc.title,
    'og:description': description,
    'og:type': 'website',
    'og:site_name': policy.site.name,
    'og:locale': policy.site.locale,
    'og:image': image,
    'og:image:type': 'image/png',
    'og:image:width': String(policy.social.width),
    'og:image:height': String(policy.social.height),
    'og:image:alt': policy.social.alt,
  };
  if (Object.entries(social).some(([key, value]) => oneMeta('property', key) !== value))
    failures.push(`${path}: inconsistent social metadata`);
  const twitter = {
    'twitter:card': 'summary_large_image',
    'twitter:title': doc.title,
    'twitter:description': description,
    'twitter:image': image,
    'twitter:image:alt': policy.social.alt,
  };
  if (Object.entries(twitter).some(([key, value]) => oneMeta('name', key) !== value))
    failures.push(`${path}: inconsistent social card metadata`);
  const graphNodes = [
    ...doc.querySelectorAll('script[data-seo-graph][type="application/ld+json"]'),
  ];
  try {
    if (graphNodes.length !== 1) throw new Error('one owned graph required');
    const data = JSON.parse(graphNodes[0].textContent);
    if (data['@context'] !== 'https://schema.org' || !Array.isArray(data['@graph']))
      throw new Error('graph missing');
    const graph = data['@graph'];
    if (graph.some(node => !policy.allowedGraphTypes.includes(node['@type'])))
      failures.push(`${path}: unsupported structured-data claim`);
    const ids = graph.map(node => node['@id']);
    if (new Set(ids).size !== ids.length) failures.push(`${path}: duplicate structured identities`);
    const page = graph.find(node => node['@id'] === `${canonical}#document`);
    const website = graph.find(node => node['@id'] === `${root}#website`);
    const project = graph.find(node => node['@id'] === `${root}#project`);
    if (
      !page ||
      !['WebPage', 'CollectionPage', 'TechArticle'].includes(page['@type']) ||
      page.url !== canonical ||
      page.description !== description ||
      page.inLanguage !== policy.site.language ||
      page.isPartOf?.['@id'] !== website?.['@id']
    )
      failures.push(`${path}: structured document differs from visible metadata`);
    if (
      website?.['@type'] !== 'WebSite' ||
      website.url !== root ||
      website.name !== policy.site.name ||
      project?.['@type'] !== 'SoftwareSourceCode' ||
      project.codeRepository !== policy.site.repository ||
      project.license !== policy.site.license
    )
      failures.push(`${path}: inconsistent project identity`);
    if (
      graph.some(node =>
        [
          'dateModified',
          'datePublished',
          'author',
          'aggregateRating',
          'review',
          'offers',
          'potentialAction',
        ].some(key => Object.hasOwn(node, key)),
      )
    )
      failures.push(`${path}: unsupported authority, date or action claim`);
  } catch {
    failures.push(`${path}: missing/invalid SEO graph`);
  }
  const primaryMains = [...doc.querySelectorAll('main')].filter(
    node => !node.parentElement.closest('main'),
  );
  if (
    primaryMains.length !== 1 ||
    doc.querySelectorAll('main h1').length !== 1 ||
    !doc.querySelector('main .lead')?.textContent.trim()
  )
    failures.push(`${path}: missing primary heading or human-readable summary`);
  const positiveDimension = value =>
    /^\d+$/.test(value ?? '') && Number.isSafeInteger(Number(value)) && Number(value) > 0;
  for (const img of doc.querySelectorAll('main img')) {
    if (img.closest('[data-example-preview], [data-preview-content], astro-island')) continue;
    if (
      !img.hasAttribute('alt') ||
      !positiveDimension(img.getAttribute('width')) ||
      !positiveDimension(img.getAttribute('height'))
    )
      failures.push(`${path}: editorial image needs alt and intrinsic dimensions`);
  }
  return failures;
}

export async function validateSeoBuild(directory) {
  const manifest = JSON.parse(await readFile(resolve(directory, 'url-manifest.json'), 'utf8'));
  const failures = [],
    records = [];
  const descriptions = new Set();
  for (const page of manifest.pages) {
    const html = await readFile(
      resolve(directory, page.path === '/' ? 'index.html' : `${page.path.slice(1)}index.html`),
      'utf8',
    );
    const dom = new JSDOM(html);
    failures.push(
      ...validateSeoDocument(dom.window.document, { path: page.path, canonical: page.url }),
    );
    const description = dom.window.document.querySelector('meta[name="description"]')?.content;
    if (descriptions.has(description))
      failures.push(`${page.path}: duplicate document description`);
    descriptions.add(description);
    records.push({ url: page.url, htmlBytes: Buffer.byteLength(html), status: 'pass' });
    dom.window.close();
  }
  const png = await readFile(resolve(directory, policy.social.path.slice(1)));
  if (
    !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    png.readUInt32BE(16) !== policy.social.width ||
    png.readUInt32BE(20) !== policy.social.height
  )
    failures.push('Shared social image differs from declared PNG dimensions.');
  return {
    failures,
    report: {
      policyVersion: policy.version,
      scope: 'static-artifact',
      status: failures.length ? 'fail' : 'pass',
      sourceRevision: process.env.GITHUB_SHA ?? null,
      policyFingerprint: createHash('sha256').update(JSON.stringify(policy)).digest('hex'),
      documents: records,
      verification: {
        metadata: 'checked',
        contentStructure: 'checked',
        browser: 'not_run',
        searchIndexing: 'not_run',
        aiCitations: 'not_run',
        coreWebVitals: 'not_run',
        hostRobots: 'outside_project_scope',
      },
    },
  };
}

export default function docsSeo() {
  return {
    name: 'genux-docs-seo',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const directory = fileURLToPath(dir),
          { failures, report } = await validateSeoBuild(directory);
        if (failures.length) throw new Error(`SEO policy failed:\n${failures.join('\n')}`);
        await writeFile(
          resolve(directory, 'seo-report.json'),
          JSON.stringify(report, null, 2) + '\n',
        );
        logger.info(
          `SEO policy: pass (${report.documents.length} canonical documents; static evidence only).`,
        );
      },
    },
  };
}
