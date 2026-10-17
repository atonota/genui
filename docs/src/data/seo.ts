import seoPolicy from './seo-policy.json';
import { canonicalUrl, documentPath, publicRoot, urlPolicy } from './url-policy';

export { seoPolicy };
export interface SeoInput {
  path: string;
  title: string;
  description: string;
}

/** Server/build-only metadata: factual project identity, no inferred authors or review dates. */
export function buildSeo({ path, title, description }: SeoInput) {
  const route = documentPath(path);
  if (Object.hasOwn(urlPolicy.aliases, route) || !title.trim() || !description.trim())
    throw new Error(`SEO metadata requires a canonical document and meaningful copy: ${route}`);
  const canonical = canonicalUrl(route);
  const page = urlPolicy.pages.find(entry => entry.path === route);
  const type =
    route.startsWith('/components/') && route !== '/components/'
      ? 'TechArticle'
      : seoPolicy.pageTypes.collections.includes(page?.id ?? '')
        ? 'CollectionPage'
        : seoPolicy.pageTypes.technicalArticles.includes(page?.id ?? '')
          ? 'TechArticle'
          : 'WebPage';
  const image = new URL(seoPolicy.social.path.slice(1), publicRoot).href;
  const websiteId = `${publicRoot}#website`;
  const projectId = `${publicRoot}#project`;
  const fullTitle = `${title.trim()} · ${seoPolicy.site.name}`;
  const document = {
    '@type': type,
    '@id': `${canonical}#document`,
    url: canonical,
    name: title.trim(),
    ...(type === 'TechArticle' ? { headline: title.trim() } : {}),
    description: description.trim(),
    inLanguage: seoPolicy.site.language,
    isPartOf: { '@id': websiteId },
    about: { '@id': projectId },
  };
  return {
    canonical,
    title: fullTitle,
    description: description.trim(),
    robots: seoPolicy.site.robots,
    document,
    graph: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': websiteId,
          name: seoPolicy.site.name,
          url: publicRoot,
          inLanguage: seoPolicy.site.language,
          about: { '@id': projectId },
        },
        {
          '@type': 'SoftwareSourceCode',
          '@id': projectId,
          name: seoPolicy.site.name,
          description: seoPolicy.site.description,
          url: publicRoot,
          codeRepository: seoPolicy.site.repository,
          license: seoPolicy.site.license,
        },
        document,
      ],
    },
    openGraph: {
      'og:url': canonical,
      'og:type': 'website',
      'og:site_name': seoPolicy.site.name,
      'og:title': fullTitle,
      'og:description': description.trim(),
      'og:locale': seoPolicy.site.locale,
      'og:image': image,
      'og:image:type': 'image/png',
      'og:image:width': String(seoPolicy.social.width),
      'og:image:height': String(seoPolicy.social.height),
      'og:image:alt': seoPolicy.social.alt,
    },
    twitter: {
      'twitter:card': 'summary_large_image',
      'twitter:title': fullTitle,
      'twitter:description': description.trim(),
      'twitter:image': image,
      'twitter:image:alt': seoPolicy.social.alt,
    },
  };
}
