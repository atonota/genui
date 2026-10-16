import type { APIRoute, GetStaticPaths } from 'astro';
import process from 'node:process';
import { collectPreviewCode } from '../../../../tools/docs-preview-code.mjs';
import { sourceHref } from '../source/[...path].txt';

// Build-time, read-only Code view payloads for ExamplePreview, fetched only when a reader
// picks Code. The glob is the fixed docs/src/react allowlist; tools/docs-preview-code.mjs
// parses the sources without executing them, and nothing is read at request time.
const sources = import.meta.glob<string>('../../react/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Pages builds serve under a base path that the HTML adapter does not apply to JSON.
const base = import.meta.env.BASE_URL.replace(/[/]$/, '');
const sourceUrl = (sourcePath: string) => {
  const href = sourceHref(sourcePath);
  if (!href) throw new Error(`${sourcePath} has no published source copy to link`);
  return base + href;
};

export const prerender = true;

export const getStaticPaths = (() =>
  collectPreviewCode(
    Object.entries(sources).map(([key, text]) => ({
      path: 'docs/src/' + key.slice('../../'.length),
      text,
    })),
    { sourceUrl, redactHome: process.env.GENUI_DOCS_PAGES === '1' },
  ).map(payload => ({ params: { id: payload.id }, props: { payload } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.payload), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
