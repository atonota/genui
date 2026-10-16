// Maps one preview id's built small/medium/large/tv documents to what production actually
// emits: astro-island entry modules, their static import closure and explicit stylesheet links.
// Only that id's four pages and the files they reach are read; no hashed file name is guessed.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { init, parse } from 'es-module-lexer';

export const previewProfiles = ['small', 'medium', 'large', 'tv'];

// Resolves emitted URLs without a server; other origins are external, never emitted files.
const ORIGIN = 'http://docs.invalid';
const TAG = /<(astro-island|link|script)(?=[\s>])([^>]*)>/gi;
const ATTRIBUTE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const ENTITIES = { amp: '&', quot: '"', apos: "'", '#39': "'", lt: '<', gt: '>' };

const sha256 = text => createHash('sha256').update(text).digest('hex');
const unique = values => [...new Set(values)];
const decode = value => value.replace(/&(amp|quot|apos|#39|lt|gt);/g, (_, name) => ENTITIES[name]);

function attributesOf(text) {
  const attributes = new Map();
  for (const [, name, double, single, bare] of text.matchAll(ATTRIBUTE))
    attributes.set(name.toLowerCase(), decode(double ?? single ?? bare ?? ''));
  return attributes;
}

/** URL path of an emitted reference, or null when it points to another origin. */
function resolveUrl(value, from) {
  const url = new URL(value, ORIGIN + from);
  return url.origin === ORIGIN ? url.pathname : null;
}

function createReader(repoRoot, distDir, base) {
  return async urlPath => {
    if (!urlPath.startsWith(base)) throw new Error(`${urlPath} is outside the docs base ${base}.`);
    const relative = decodeURIComponent(urlPath.slice(base.length));
    const file = path.resolve(
      distDir,
      relative === '' || relative.endsWith('/') ? `${relative}index.html` : relative,
    );
    if (!file.startsWith(distDir + path.sep)) throw new Error(`${urlPath} leaves the docs dist.`);
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT')
        throw new Error(
          `Production docs build required: ${path.relative(repoRoot, file)} is missing.`,
        );
      throw error;
    }
    return { file: path.relative(repoRoot, file), text };
  };
}

/** Breadth-first static import closure of emitted ES modules; dynamic imports are not followed. */
async function staticClosure(read, roots) {
  const modules = new Map();
  const queue = [...roots];
  while (queue.length > 0) {
    const url = queue.shift();
    if (modules.has(url)) continue;
    const { file, text } = await read(url);
    modules.set(url, { url, file, sha256: sha256(text) });
    const [imports] = parse(text, file);
    // The installed full lexer reports string kinds and decoded specifiers, not minimal n/d.
    for (const record of imports) {
      if (record.type !== 'static' && record.type !== 'reexport-star') continue;
      const { specifier } = record;
      if (!specifier) continue;
      if (!/^(?:[a-z][a-z0-9+.-]*:|[.]{0,2}[/])/i.test(specifier))
        throw new Error(`${file} has an unresolved bare import '${specifier}'.`);
      const next = resolveUrl(specifier, url);
      if (next && /[.]m?js$/.test(next)) queue.push(next);
    }
  }
  return [...modules.values()];
}

async function profileResources(read, base, id, profile) {
  const url = `${base}preview/${encodeURIComponent(id)}/${profile}/`;
  const page = await read(url);
  const entries = [];
  const modules = [];
  const stylesheets = [];
  const add = (list, value) => {
    const resolved = value ? resolveUrl(value, url) : null;
    if (resolved) list.push(resolved);
  };
  for (const [, tag, rest] of page.text.matchAll(TAG)) {
    const attributes = attributesOf(rest);
    const name = tag.toLowerCase();
    if (name === 'astro-island') {
      add(entries, attributes.get('component-url'));
      add(modules, attributes.get('renderer-url'));
    } else if (name === 'link') {
      if ((attributes.get('rel') ?? '').toLowerCase().split(/\s+/).includes('stylesheet'))
        add(stylesheets, attributes.get('href'));
    } else if (attributes.get('type') === 'module') add(modules, attributes.get('src'));
  }
  if (entries.length === 0) throw new Error(`${page.file} has no astro-island component-url.`);
  const styles = [];
  for (const href of unique(stylesheets)) {
    const { file, text } = await read(href);
    styles.push({ url: href, file, sha256: sha256(text) });
  }
  return {
    url,
    html: { file: page.file, sha256: sha256(page.text) },
    entries: unique(entries),
    js: await staticClosure(read, unique([...entries, ...modules])),
    stylesheets: styles,
  };
}

/** Route to entry, static JS closure and stylesheets, with the SHA-256 of every file read. */
export async function previewResourceMap({ repoRoot, id, base = '/' }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`Unexpected preview id '${id}'.`);
  const root = path.resolve(repoRoot);
  const distDir = path.join(root, 'docs', 'dist');
  const prefix = base.endsWith('/') ? base : `${base}/`;
  await init;
  const read = createReader(root, distDir, prefix);
  const profiles = {};
  for (const profile of previewProfiles)
    profiles[profile] = await profileResources(read, prefix, id, profile);
  return { id, base: prefix, distDir: path.relative(root, distDir), profiles };
}
