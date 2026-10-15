import type { APIRoute, GetStaticPaths } from 'astro';
import process from 'node:process';

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

// Pages builds (GENUI_DOCS_PAGES=1) publish these copies: machine home prefixes
// become a portable <workspace> placeholder and credential-shaped text fails the
// build without echoing it. Local builds keep the files verbatim.
const pagesBuild = process.env.GENUI_DOCS_PAGES === '1';
const machineHome = /\/Users\/[^/\s'"`)\]>]*/g;
const credential =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b|\bsk-[A-Za-z0-9_-]{20,}/;
const publishable = (path: string, text: string) => {
  if (!pagesBuild) return text;
  if (credential.test(text))
    throw new Error(`Refusing to publish ${path}: credential-shaped content`);
  return text.replace(machineHome, '<workspace>');
};

export const GET: APIRoute = async ({ params }) => {
  const path = params.path ?? '';
  const load = published.get(path);
  if (!load) return new Response('Not found', { status: 404 });
  return new Response(publishable(path, await load()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
