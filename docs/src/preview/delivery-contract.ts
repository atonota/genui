/** Delivery contract of the preview profiles: each profile's entry source, its default export's
    name and props, and the React usage that imports that entry and renders it with the
    allowlisted props. Pure metadata plus the pure profiles module, so the Code view never loads
    the demo registry or its business loaders. */
import { parsePreviewProfile, type PreviewProfile } from './profiles';
import type { ThemeMode } from '../theme';
import type { PreviewOrientation } from '../data/preview-devices';

/** Source of each profile's delivery entry; the next Code endpoint phase adds it to payloads. */
export const previewEntrySources: Readonly<Record<PreviewProfile, string>> = {
  small: 'docs/src/react/preview/SmallDelivery.tsx',
  medium: 'docs/src/react/preview/MediumDelivery.tsx',
  large: 'docs/src/react/preview/LargeDelivery.tsx',
  tv: 'docs/src/react/preview/TvDelivery.tsx',
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
  tv: {
    componentName: 'TvDelivery',
    sourcePath: previewEntrySources.tv,
    props: previewDeliveryPropNames,
  },
};

/** Canonical public site of the standalone preview pages when no other site base is given. */
export const canonicalPreviewSiteBase = 'https://atonota.github.io/genux/';

// Only absolute http(s) bases are used; the path ends in one slash so the preview route
// resolves beneath it, and any query or hash is dropped.
function siteBaseUrl(siteBase: string): URL {
  const url = new URL(siteBase);
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new TypeError(`Standalone preview URLs need an http(s) site base, not ${url.protocol}`);
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

/** Absolute URL of the standalone preview page for an id and profile under siteBase, ending in
    the route's canonical slash so it is served without a redirect. A set theme or orientation
    becomes its query parameter; grid becomes grid=1 only when true, as that page reads it. Kept
    as a standalone link utility; usage never embeds it. */
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

/** The same standalone URL utility under its current name. */
export const previewStandaloneUrl = previewEmbedUrl;

const themes: readonly unknown[] = ['light', 'dark'];

/** Only the allowlisted delivery props, in contract order and validated; any other field the
    caller holds, such as private form state, is never read or printed. */
function deliveryProps(profile: PreviewProfile, values: PreviewDeliveryValues) {
  if (!values.id || !values.slug) throw new TypeError('Preview usage needs an id and a slug.');
  parsePreviewProfile(profile, values.orientation);
  if (values.theme !== undefined && !themes.includes(values.theme))
    throw new TypeError('Unknown preview theme.');
  if (values.grid !== undefined && typeof values.grid !== 'boolean')
    throw new TypeError('Preview grid must be a boolean.');
  return previewDeliveryPropNames.flatMap(name => {
    const value = values[name];
    return value === undefined ? [] : [[name, value] as const];
  });
}

/** React usage of a profile: the default export of its delivery entry, imported by the internal
    repository path of its contract sourcePath (relative to the repository root; not a published
    package API), rendered as JSX with only the allowlisted props. Every value is printed through
    JSON.stringify inside an expression container, so no id or slug can close the string, the
    attribute or the tag. A comment names the standalone page under siteBase, the canonical public
    site by default. */
export function previewDeliveryUsage(
  profile: PreviewProfile,
  values: PreviewDeliveryValues,
  siteBase = canonicalPreviewSiteBase,
): string {
  const props = deliveryProps(profile, values);
  const { componentName, sourcePath } = previewDeliveryContracts[profile];
  const specifier = `./${sourcePath.replace(/[.]tsx$/, '')}`;
  const attributes = props.map(([name, value]) => `${name}={${JSON.stringify(value)}}`).join(' ');
  return [
    '// Internal repository entry, imported from the repository root; not a published package API.',
    '// It renders inline on any route; the host page loads the preview and demo stylesheets.',
    `// Standalone page: ${previewEmbedUrl(profile, values, siteBase)}`,
    `import ${componentName} from ${JSON.stringify(specifier)};`,
    '',
    'export function Example() {',
    `  return <${componentName} ${attributes} />;`,
    '}',
  ].join('\n');
}
