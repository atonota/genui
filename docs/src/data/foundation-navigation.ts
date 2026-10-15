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
  {
    label: 'Start',
    links: [
      { slug: '', href: '/', label: 'Overview' },
      { slug: 'getting-started', href: '/getting-started/', label: 'Getting started' },
    ],
  },
  {
    label: 'Foundations',
    links: [
      { slug: 'tokens', href: '/tokens/', label: 'Design tokens' },
      { slug: 'standards', href: '/standards/', label: 'UX standards' },
      { slug: 'color-system', href: '/color-system/', label: 'Color system' },
      { slug: 'theme-builder', href: '/theme-builder/', label: 'Theme Builder' },
      { slug: 'genui', href: '/genui/', label: 'GenUI' },
    ],
  },
  {
    label: 'Project',
    links: [
      { slug: 'decisions', href: '/decisions/', label: 'Decision log' },
      { slug: 'documentation', href: '/documentation/', label: 'Documentation standard' },
    ],
  },
];

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
