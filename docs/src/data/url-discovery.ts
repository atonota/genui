import { components } from './catalog';
import { canonicalUrl, urlPolicy } from './url-policy';

/** Canonical documents only: auxiliary preview/code/source routes never enter discovery. */
export function discoveryPages() {
  return [
    ...urlPolicy.pages.map(page => ({
      path: page.path,
      title: page.label,
      description: page.description,
    })),
    ...components.map(component => ({
      path: `/components/${component.slug}/`,
      title: component.title,
      description: component.summary,
    })),
  ];
}
export function discoveryUrls() {
  return discoveryPages().map(page => canonicalUrl(page.path));
}
