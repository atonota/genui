/** Delivery contract of the preview profiles: each profile's entry source, its default export's
    name and props, and the HTML embed of the isolated preview route built from them. Pure
    metadata plus the pure profiles module, so the Code view never loads the demo registry or its
    business loaders. */
import { parsePreviewProfile, type PreviewProfile } from './profiles';
import type { ThemeMode } from '../theme';
import type { PreviewOrientation } from '../data/preview-devices';

/** Source of each profile's delivery entry; the next Code endpoint phase adds it to payloads. */
export const previewEntrySources: Readonly<Record<PreviewProfile, string>> = {
  small: 'docs/src/react/preview/SmallDelivery.tsx',
  medium: 'docs/src/react/preview/MediumDelivery.tsx',
  large: 'docs/src/react/preview/LargeDelivery.tsx',
};

/** Props every delivery entry's default export accepts, as its PreviewDeliveryProps declares. */
export const previewDeliveryPropNames = ['id', 'slug', 'theme', 'orientation', 'grid'] as const;
export type PreviewDeliveryValues = {
  readonly id: string;
  readonly slug: string;
  readonly theme?: ThemeMode;
  readonly orientation?: PreviewOrientation;
  readonly grid?: boolean;
};
export type PreviewDeliveryContract = {
  readonly componentName: string;
  readonly sourcePath: string;
  readonly props: typeof previewDeliveryPropNames;
};
type DeliveryContracts = Readonly<Record<PreviewProfile, PreviewDeliveryContract>>;

/** Export contract of each profile's delivery entry: the default export's name, its source and
    the props it takes. The Code endpoint checks it against the source at build time. */
export const previewDeliveryContracts: DeliveryContracts = {
  small: {
    componentName: 'SmallDelivery',
    sourcePath: previewEntrySources.small,
    props: previewDeliveryPropNames,
  },
  medium: {
    componentName: 'MediumDelivery',
    sourcePath: previewEntrySources.medium,
    props: previewDeliveryPropNames,
  },
  large: {
    componentName: 'LargeDelivery',
    sourcePath: previewEntrySources.large,
    props: previewDeliveryPropNames,
  },
};

/** Canonical public site that embeds use when no other site base is given. */
export const canonicalPreviewSiteBase = 'https://atonota.github.io/genui/';

// Escaped attribute values never close the attribute or the tag, whatever the id or slug holds.
const entities: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escapeAttribute = (value: string) =>
  value.replace(/[&<>"']/g, char => entities[char] ?? char);

// Only absolute http(s) bases are embedded; the path ends in one slash so the preview route
// resolves beneath it, and any query or hash is dropped.
function siteBaseUrl(siteBase: string): URL {
  const url = new URL(siteBase);
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new TypeError(`Preview embeds need an http(s) site base, not ${url.protocol}`);
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

/** Absolute URL of the isolated preview route for an id and profile under siteBase, ending in
    the route's canonical slash so it is served without a redirect. A set theme or orientation
    becomes its query parameter; grid becomes grid=1 only when true, as the preview reads it. */
export function previewEmbedUrl(
  profile: PreviewProfile,
  values: PreviewDeliveryValues,
  siteBase = canonicalPreviewSiteBase,
): string {
  const { id } = values;
  if (!id || id === '.' || id === '..') throw new TypeError(`Invalid preview id ${id}`);
  const url = new URL(`preview/${encodeURIComponent(id)}/${profile}/`, siteBaseUrl(siteBase));
  for (const name of ['theme', 'orientation'] as const) {
    const value = values[name];
    if (value !== undefined) url.searchParams.set(name, value);
  }
  if (values.grid) url.searchParams.set('grid', '1');
  return url.href;
}

/** HTML usage of a profile: one iframe of the existing isolated preview route, which already
    server-renders the example with its styles, sized to the profile's logical screen in the
    chosen orientation. The delivery entries above are internal to that route, so no component
    import is generated. siteBase defaults to the canonical public site. */
export function previewDeliveryUsage(
  profile: PreviewProfile,
  values: PreviewDeliveryValues,
  siteBase = canonicalPreviewSiteBase,
): string {
  const { widthPx, heightPx } = parsePreviewProfile(profile, values.orientation);
  const attributes: ReadonlyArray<readonly [string, string]> = [
    ['src', previewEmbedUrl(profile, values, siteBase)],
    ['title', `${values.slug} preview (${profile} profile)`],
    ['width', String(widthPx)],
    ['height', String(heightPx)],
    ['sandbox', 'allow-scripts allow-same-origin allow-forms'],
    ['loading', 'lazy'],
    ['style', 'border: 0'],
  ];
  return [
    '<iframe',
    ...attributes.map(([name, value]) => `  ${name}="${escapeAttribute(value)}"`),
    '></iframe>',
  ].join('\n');
}
