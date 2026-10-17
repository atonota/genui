import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateUrlBuild } from '../../tools/docs-url-policy.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const compiled = await build({
  entryPoints: ['docs/src/data/url-policy.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const policy = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
);

test('canonical addresses ignore view state and resolve legacy routes in one hop', () => {
  assert.equal(
    policy.canonicalUrl('/components/button/?tab=api#api'),
    'https://atonota.github.io/genux/components/button/',
  );
  assert.equal(policy.canonicalUrl('/genux/'), 'https://atonota.github.io/genux/ai-ui/');
  assert.equal(policy.logicalPath('/genux/components/button/', '/genux/'), '/components/button/');
  assert.equal(policy.logicalPath('/genux/', '/genux/'), '/');
  assert.equal(policy.logicalPath('/genux/genux/', '/genux/'), '/genux/');
  assert.equal(policy.canonicalUrl('/'), 'https://atonota.github.io/genux/');
  for (const path of ['https://evil.example/', '//evil.example/', '/a/../b/', '/a%2fb/', '/a\\b/'])
    assert.throws(() => policy.canonicalUrl(path));
});

test('registry paths are unique, readable, and aliases never form chains', () => {
  const routes = policy.urlPolicy.pages.map(page => page.path);
  assert.equal(new Set(routes).size, routes.length);
  for (const path of routes) assert.match(path, /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/);
  assert.ok(routes.includes('/components/'));
  for (const [old, target] of Object.entries(policy.urlPolicy.aliases)) {
    assert.ok(!routes.includes(old));
    assert.ok(routes.includes(target));
    assert.equal(policy.urlPolicy.aliases[target], undefined);
  }
});

test('structured data escapes HTML while retaining its JSON meaning', () => {
  const value = { text: '</script><script>alert(1)</script>' };
  const encoded = policy.structuredJson(value);
  assert.equal(encoded.includes('<'), false);
  assert.deepEqual(JSON.parse(encoded), value);
});

test('final artifact gate accepts root/project hosting and rejects canonical drift', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'genux-url-policy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pages = policy.urlPolicy.pages.map(page => ({
    ...page,
    title: page.label,
    url: policy.canonicalUrl(page.path),
  }));
  const file = path => join(directory, path === '/' ? 'index.html' : `${path.slice(1)}index.html`);
  const put = async (path, html) => {
    const target = file(path);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, html);
  };
  const manifest = { root: policy.publicRoot, pages };
  await writeFile(join(directory, 'url-manifest.json'), JSON.stringify(manifest));
  await writeFile(
    join(directory, 'sitemap.xml'),
    `<urlset>${pages.map(page => `<url><loc>${page.url}</loc></url>`).join('')}</urlset>`,
  );
  await writeFile(join(directory, '404.html'), '<meta name="robots" content="noindex">');
  for (const [from, to] of Object.entries(policy.urlPolicy.aliases))
    await put(
      from,
      `<meta name="robots" content="noindex"><link rel="canonical" href="${policy.canonicalUrl(to)}">`,
    );
  for (const base of ['/', '/genux/']) {
    for (const page of pages)
      await put(
        page.path,
        `<title>${page.title}</title><meta name="description" content="Useful documentation"><link rel="canonical" href="${page.url}"><meta property="og:url" content="${page.url}">${pages.map(link => `<a href="${base.replace(/\/$/, '')}${link.path}">${link.label}</a>`).join('')}<a href="${policy.publicRoot}">Public homepage</a>`,
      );
    assert.deepEqual(await validateUrlBuild(directory, { base }), []);
  }
  await put(
    '/forgotten/',
    '<title>Forgotten document</title><link rel="canonical" href="https://atonota.github.io/genux/forgotten/">',
  );
  assert.ok(
    (await validateUrlBuild(directory, { base: '/genux/' })).some(message =>
      message.startsWith('Unregistered indexable document:'),
    ),
  );
  await rm(join(directory, 'forgotten'), { recursive: true });
  const page = file('/components/');
  await writeFile(
    page,
    (await readFile(page, 'utf8')).replace(
      `rel="canonical" href="${policy.canonicalUrl('/components/')}"`,
      'rel="canonical" href="https://wrong.example/"',
    ),
  );
  assert.ok(
    (await validateUrlBuild(directory, { base: '/genux/' })).some(message =>
      message.startsWith('Canonical mismatch:'),
    ),
  );
});
