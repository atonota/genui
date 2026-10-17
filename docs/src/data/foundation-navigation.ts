import { routeHref, urlPolicy } from './url-policy';

// Shared information architecture for foundation pages: menu groups, page titles and breadcrumb ancestors.
export interface FoundationLink {
  slug: string;
  href: string;
  label: string;
}

export interface FoundationGroup {
  label: string;
  links: readonly FoundationLink[];
}

export const foundationGroups: readonly FoundationGroup[] = [
  { label: 'Start', ids: ['', 'components', 'getting-started', 'guides'] },
  {
    label: 'Foundations',
    ids: [
      'foundations',
      'tokens',
      'standards',
      'genux',
      'adaptive',
      'tools',
      'color-system',
      'theme-builder',
    ],
  },
  { label: 'Project', ids: ['project', 'decisions', 'documentation', 'url-policy'] },
].map(group => ({
  label: group.label,
  links: group.ids.map(id => {
    const page = urlPolicy.pages.find(entry => entry.id === id)!;
    return { slug: page.id, href: page.path, label: page.label };
  }),
}));

export const foundationLinks: readonly FoundationLink[] = foundationGroups.flatMap(
  group => group.links,
);

/** Group and link for a foundation slug, used for page titles and breadcrumb ancestors. */
export function findFoundation(
  slug: string,
): { group: FoundationGroup; link: FoundationLink } | undefined {
  for (const group of foundationGroups) {
    const link = group.links.find(item => item.slug === slug);
    if (link) return { group, link };
  }
  return undefined;
}

/** Canonical guide route under either local or Pages hosting. */
export function genuxPageHref(base = '/'): string {
  return routeHref('genux', base);
}
