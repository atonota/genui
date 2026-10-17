import type { APIRoute, GetStaticPaths } from 'astro';
import process from 'node:process';
import {
  ALLOWED_ROOT,
  collectPreviewCode,
  publishablePreviewText,
} from '../../../../tools/docs-preview-code.mjs';
import { sourceHref } from '../source/[...path].txt';
import {
  previewDeliveryContracts,
  previewDeliveryUsage,
  previewSlugForId,
} from '../../preview/registry';
import { previewProfiles } from '../../preview/profiles';

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
// Embeds point at the configured public site and base; without SITE the build cannot know where
// it is served, so the usage helper falls back to the canonical public site.
const site = import.meta.env.SITE;
const siteBase = site ? new URL(`${base}/`, site).href : undefined;
const sourceUrl = (sourcePath: string) => {
  const href = sourceHref(sourcePath);
  if (!href) throw new Error(`${sourcePath} has no published source copy to link`);
  return base + href;
};

export const prerender = true;

export const getStaticPaths = (() => {
  const redactHome = process.env.GENUX_DOCS_PAGES === '1';
  const raw = Object.entries(sources).map(([key, text]) => ({
    path: 'docs/src/' + key.slice('../../'.length),
    text,
  }));
  const rawText = new Map(raw.map(({ path, text }) => [path, text]));
  // Each profile's delivery entry ships whole from the same raw glob under the same guard;
  // a missing, empty or out-of-root entry fails the build.
  const entries = previewProfiles.map(profile => {
    const { componentName, sourcePath } = previewDeliveryContracts[profile];
    const text = rawText.get(sourcePath);
    if (
      !sourcePath.startsWith(ALLOWED_ROOT) ||
      sourcePath.split('/').includes('..') ||
      !text?.trim()
    )
      throw new Error(`${profile} delivery entry ${sourcePath} is not a docs/src/react source`);
    const delivery = {
      code: publishablePreviewText(
        text.trimEnd(),
        `${profile} delivery entry ${sourcePath}`,
        redactHome,
      ),
      sourcePath,
      sourceUrl: sourceUrl(sourcePath),
    };
    // Usage follows the registry contract: the default export takes PreviewDeliveryProps.
    const declares =
      text.includes(`export default function ${componentName}(`) &&
      text.includes('PreviewDeliveryProps');
    if (!declares)
      throw new Error(
        `${profile} delivery entry ${sourcePath} must default-export ${componentName}` +
          ' taking PreviewDeliveryProps',
      );
    return { profile, delivery };
  });
  return collectPreviewCode(raw, { sourceUrl, redactHome }).map(payload => {
    const slug = previewSlugForId(payload.id);
    // Every delivery carries an iframe embed of this id's preview route, under the same guard.
    const deliveries = Object.fromEntries(
      entries.map(({ profile, delivery }) => [
        profile,
        {
          ...delivery,
          usage: publishablePreviewText(
            previewDeliveryUsage(profile, { id: payload.id, slug }, siteBase),
            `${profile} usage for ${payload.id}`,
            redactHome,
          ),
        },
      ]),
    );
    return { params: { id: payload.id }, props: { payload: { ...payload, slug, deliveries } } };
  });
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.payload), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
