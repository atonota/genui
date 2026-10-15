import type { APIRoute, GetStaticPaths } from 'astro';

// Build-time, read-only text copies of the documentation sources named in each
// component page's resources. The glob is a fixed allowlist of docs directories;
// nothing outside it is published and no file is read at request time.
const loaders = import.meta.glob<string>(
  [
    '../../react/**/*.{ts,tsx}',
    '../../styles/**/*.css',
    '../../data/**/*.{ts,json}',
    '../../genui/**/*.ts',
    '../../layouts/*.astro',
    '../../components/*.astro',
    '../components/*.astro',
    '../../theme.ts',
    '../../../AGENTS.md',
    '../../../tests/*.test.mjs',
    '../../../browser/*.spec.ts',
  ],
  { query: '?raw', import: 'default' },
);

// Glob keys are relative to docs/src/pages/source; published paths are relative to docs.
const roots: ReadonlyArray<readonly [prefix: string, base: string]> = [
  ['../../../', ''],
  ['../../', 'src/'],
  ['../', 'src/pages/'],
];
const publishedPath = (key: string) => {
  const [prefix, base] = roots.find(([prefix]) => key.startsWith(prefix)) ?? ['', ''];
  return base + key.slice(prefix.length);
};
const published = new Map(
  Object.entries(loaders).map(([key, load]) => [publishedPath(key), load] as const),
);

/** Link for a docs/-prefixed source path, or undefined when it is not published. */
export const sourceHref = (docsPath: string) => {
  if (!docsPath.startsWith('docs/')) return undefined;
  const path = docsPath.slice('docs/'.length);
  if (!published.has(path)) return undefined;
  return '/source/' + path.split('/').map(encodeURIComponent).join('/') + '.txt';
};

export const prerender = true;

export const getStaticPaths = (() =>
  [...published.keys()].map(path => ({ params: { path } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const load = published.get(params.path ?? '');
  if (!load) return new Response('Not found', { status: 404 });
  return new Response(await load(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
