import { discoveryPages } from '../data/url-discovery';
import { canonicalUrl, publicRoot, urlPolicy } from '../data/url-policy';
export function GET() {
  const manifest = {
    version: 1,
    root: publicRoot,
    language: urlPolicy.language,
    pages: discoveryPages().map(page => ({ ...page, url: canonicalUrl(page.path) })),
    aliases: Object.entries(urlPolicy.aliases).map(([from, to]) => ({
      from,
      to,
      url: canonicalUrl(to),
      mechanism: 'static-client-redirect',
    })),
    auxiliary: ['/preview/', '/preview-code/', '/source/'],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
