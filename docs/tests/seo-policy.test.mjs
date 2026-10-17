import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';

const loadSeo = async () => {
  const output = await build({
    entryPoints: ['docs/src/data/seo.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`
  );
};

test('built canonical documents expose complete SEO metadata and typed page graphs', async () => {
  const manifest = JSON.parse(await readFile('docs/dist/url-manifest.json'));
  for (const page of manifest.pages) {
    const dom = new JSDOM(
      await readFile(
        `docs/dist/${page.path === '/' ? 'index.html' : page.path.slice(1) + 'index.html'}`,
      ),
    );
    const d = dom.window.document;
    assert.match(d.querySelector('meta[name=robots]')?.content ?? '', /index, follow/, page.path);
    assert.equal(
      d.querySelector('meta[property="og:image"]')?.content,
      'https://atonota.github.io/genux/social/genux.png',
      page.path,
    );
    assert.equal(d.querySelector('meta[name="twitter:card"]')?.content, 'summary_large_image');
    const graph = JSON.parse(d.querySelector('[data-seo-graph]').textContent)['@graph'];
    assert.ok(graph.some(node => node['@type'] === 'SoftwareSourceCode'));
    assert.ok(
      graph.some(
        node =>
          ['WebPage', 'TechArticle', 'CollectionPage'].includes(node['@type']) &&
          node.url === page.url,
      ),
    );
    dom.window.close();
  }
  const [id] = await readdir('docs/dist/preview');
  const html = await readFile(`docs/dist/preview/${id}/large/index.html`, 'utf8');
  const { validateBuiltPage } = await import('../../tools/docs-presentation.mjs');
  const preview = new JSDOM(html);
  preview.window.document.querySelector('meta[name=robots]').remove();
  assert.ok(
    validateBuiltPage(preview.serialize(), { path: `/preview/${id}/large/` }).some(
      item => item.ruleId === 'preview-indexing-invalid',
    ),
  );
  preview.window.close();
});

test('SEO model describes actual documents without invented authority or dates', async () => {
  const { buildSeo } = await loadSeo();
  const seo = buildSeo({
    path: '/components/button/',
    title: 'Button',
    description: 'Button variants and API.',
  });
  assert.equal(seo.document['@type'], 'TechArticle');
  assert.equal(seo.document.url, 'https://atonota.github.io/genux/components/button/');
  assert.equal(
    seo.graph['@graph'].find(node => node['@type'] === 'SoftwareSourceCode').codeRepository,
    'https://github.com/atonota/genux',
  );
  assert.equal(seo.document.dateModified, undefined);
  assert.equal(seo.document.author, undefined);
  assert.equal(
    buildSeo({ path: '/components/', title: 'Catalog', description: 'Browse components.' })
      .document['@type'],
    'CollectionPage',
  );
  assert.throws(() => buildSeo({ path: '/genux/', title: 'Legacy', description: 'Alias.' }));
  assert.throws(() => buildSeo({ path: '/', title: ' ', description: 'Missing title.' }));
});

test('SEO admission rejects conflicting directives, misleading graph data and broken social metadata', async () => {
  const { buildSeo, seoPolicy } = await loadSeo();
  const { validateSeoDocument } = await import('../../tools/docs-seo.mjs');
  const seo = buildSeo({
    path: '/',
    title: 'Overview',
    description: 'GenUX components and documentation.',
  });
  const dom = new JSDOM(
    `<html lang="en"><head><title>${seo.title}</title><meta name="description" content="${seo.description}"><meta name="robots" content="${seo.robots}"><link rel="canonical" href="${seo.canonical}">${Object.entries(
      seo.openGraph,
    )
      .map(([key, value]) => `<meta property="${key}" content="${value}">`)
      .join('')}${Object.entries(seo.twitter)
      .map(([key, value]) => `<meta name="${key}" content="${value}">`)
      .join(
        '',
      )}<script type="application/ld+json" data-seo-graph>${JSON.stringify(seo.graph)}</script></head><body><main><h1>GenUX overview</h1><p class="lead">Build a consistent interface with documented components.</p></main></body></html>`,
  );
  const d = dom.window.document;
  assert.deepEqual(
    validateSeoDocument(d, { path: '/', canonical: seo.canonical, policy: seoPolicy }),
    [],
  );
  d.querySelector('meta[name=robots]').content = 'noindex, nosnippet';
  assert.ok(
    validateSeoDocument(d, { path: '/', canonical: seo.canonical }).some(message =>
      message.includes('directives'),
    ),
  );
  d.querySelector('meta[name=robots]').content = seo.robots;
  d.querySelector('[data-seo-graph]').textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [...seo.graph['@graph'], { '@type': 'Review', ratingValue: 5 }],
  });
  assert.ok(
    validateSeoDocument(d, { path: '/', canonical: seo.canonical }).some(message =>
      message.includes('unsupported'),
    ),
  );
  d.querySelector('[data-seo-graph]').textContent = JSON.stringify(seo.graph);
  d.querySelector('meta[property="og:image"]').content = 'https://wrong.example/image.png';
  assert.ok(
    validateSeoDocument(d, { path: '/', canonical: seo.canonical }).some(message =>
      message.includes('social'),
    ),
  );
  d.querySelector('meta[property="og:image"]').content = seo.openGraph['og:image'];
  const example = d.createElement('main');
  example.textContent = 'Embedded component surface';
  d.querySelector('main').append(example);
  assert.deepEqual(validateSeoDocument(d, { path: '/', canonical: seo.canonical }), []);
  const image = d.createElement('img');
  image.alt = 'Editorial example';
  image.setAttribute('width', '0');
  image.setAttribute('height', '');
  d.querySelector('main').append(image);
  assert.ok(
    validateSeoDocument(d, { path: '/', canonical: seo.canonical }).some(message =>
      message.includes('intrinsic dimensions'),
    ),
  );
  dom.window.close();
});
