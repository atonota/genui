import urlPolicy from './url-policy.json';

export { urlPolicy };
export const publicRoot = `${urlPolicy.origin}${urlPolicy.base}/`;

/** Accept logical documentation paths only; reject ambiguous encodings and traversal. */
export function documentPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\%]/.test(value))
    throw new Error(`Invalid documentation path: ${value}`);
  const path = value.split(/[?#]/, 1)[0];
  if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(path))
    throw new Error(`Invalid documentation path: ${value}`);
  return path;
}

/** Astro pathname to logical route, stripping the deployment base exactly once. */
export function logicalPath(pathname: string, base: string): string {
  const prefix = base.replace(/\/+$/, '');
  return prefix && pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

export function canonicalUrl(value: string): string {
  const path = documentPath(value);
  const aliases: Record<string, string> = urlPolicy.aliases;
  return `${urlPolicy.origin}${urlPolicy.base}${aliases[path] ?? path}`;
}

export function routeHref(id: string, base = '/'): string {
  const page = urlPolicy.pages.find(entry => entry.id === id);
  if (!page) throw new Error(`Unknown documentation page: ${id}`);
  return `${base.replace(/\/+$/, '')}${page.path}`;
}

/** Escape inline structured data without changing its JSON semantics. */
export function structuredJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
