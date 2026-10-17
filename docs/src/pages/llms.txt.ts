import { discoveryPages } from '../data/url-discovery';
import { canonicalUrl } from '../data/url-policy';
export function GET() {
  const lines = [
    '# GenUX',
    '',
    '> Component documentation, design foundations and validated AI interface contracts.',
    '',
    'This index is a non-standard discovery convenience. The linked HTML is authoritative.',
    'Examples are local recorded demonstrations unless explicitly stated otherwise. No live AI/server behavior is implied.',
    '',
    '## Documentation',
    '',
    ...discoveryPages().map(
      page => `- [${page.title}](${canonicalUrl(page.path)}): ${page.description}`,
    ),
  ];
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
