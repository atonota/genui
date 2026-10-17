// Maps a production docs build to what each adaptive layout profile and the /adaptive/ lab
// baseline actually ship. Profiles come from the Vite manifest that docs/astro.config.mjs names;
// the baseline comes from the emitted lab HTML and its static ES-module closure. No hashed file
// name is guessed and every file read is hashed and sized.
//
// buildAdaptiveResourceMap({ outDir, base = '/' }) resolves to
// { outDir, base, manifestPath, profiles: Record<LayoutProfile, Group & { source, entry }>,
//   features: { genuxLab: Group & { sources, entry, entries } },
//   baseline: Group & { html, roots }, ownership: Record<url, { sources, owners }> }
// with Group = { js, css, assets, dynamicImports, files }.
// Paths are base-prefixed URLs, files maps each URL to { sha256, bytes }, and dynamicImports are
// reachable later but never part of a static closure. outDir is the Astro/Vite client outDir.
// Ownership is read from the adaptive-ownership.json the production build emits; the map is
// returned only after the initial phone delivery passes assertAdaptiveResourceIsolation.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { init, parse } from 'es-module-lexer';

export const adaptiveProfiles = ['phone', 'tablet', 'laptop', 'desktop', 'wide', 'living-room'];
export const ADAPTIVE_MANIFEST = 'adaptive-manifest.json';
export const ADAPTIVE_OWNERSHIP = 'adaptive-ownership.json';
// Every owner the docs build may name: the six layout profiles and the GenUX card lab.
export const adaptiveOwners = [...adaptiveProfiles, 'genuxLab'];

// Resolves emitted URLs without a server; other origins are external, never emitted files.
const ORIGIN = 'http://docs.invalid';
const TAG = /<(astro-island|link)(?=[\s>])([^>]*)>/gi;
const SCRIPT = /<script(?=[\s>])([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const ATTRIBUTE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const ENTITIES = { amp: '&', quot: '"', apos: "'", '#39': "'", lt: '<', gt: '>' };
const CSS_REFERENCE = /url\(\s*(['"]?)([^'")]+?)\1\s*\)|@import\s+(['"])([^'"]+)\3/g;
const MACHINE_PATH = /^(?:[/\\]|[a-z]:[/\\])/i;
const MAX_DEPTH = 4;
// Literal source suffixes of the GenUX card lab feature; each must match one manifest key.
const GENUX_LAB_SOURCES = [
  'src/react/genux/GenUXCardLab.tsx',
  'src/styles/genux-card-lab.css?url',
  'src/styles/genux-runtime.css?url',
];

const sha256 = data => createHash('sha256').update(data).digest('hex');
const unique = values => [...new Set(values)];
const posix = value => value.split(path.sep).join('/');
const decode = value => value.replace(/&(amp|quot|apos|#39|lt|gt);/g, (_, name) => ENTITIES[name]);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasKeys = (value, sortedKeys) => Object.keys(value).sort().join() === sortedKeys.join();
// Ownership sources are repo-relative (docs/src/, src/ or node_modules/) or sanitized virtual:
// markers, whatever their owners; only an ownerless bundler runtime may name another scheme marker.
const SOURCE_ROOT = /^(?:docs\/src|src|node_modules)\//;
const VIRTUAL_MARKER = /^virtual:[\w@.+-]+(?:\/[\w@.+-]+)*$/;
const RUNTIME_MARKER = /^[a-z][a-z0-9+.-]*:[\w@.+-]+(?:\/[\w@.+-]+)*$/i;

/** A relative POSIX path: no machine root, backslash, NUL, query, empty or dot segment. */
function isRelativePath(value) {
  return (
    typeof value === 'string' &&
    !MACHINE_PATH.test(value) &&
    !/[\\\0?#]/.test(value) &&
    value.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')
  );
}

function isOwnershipSource(value, owners) {
  if (!isRelativePath(value)) return false;
  return (
    SOURCE_ROOT.test(value) ||
    VIRTUAL_MARKER.test(value) ||
    (owners.length === 0 && RUNTIME_MARKER.test(value))
  );
}

function attributesOf(text) {
  const attributes = new Map();
  for (const [, name, double, single, bare] of text.matchAll(ATTRIBUTE))
    attributes.set(name.toLowerCase(), decode(double ?? single ?? bare ?? ''));
  return attributes;
}

/** URL path of an emitted reference, or null for another origin, data: or a fragment. */
function resolveUrl(value, from) {
  if (value.startsWith('#')) return null;
  const url = new URL(value, ORIGIN + from);
  return url.origin === ORIGIN ? url.pathname : null;
}

/** Reads emitted URLs below base inside outDir, recording SHA-256 and byte count per URL. */
function createReader(outDir, base) {
  const files = new Map();
  const texts = new Map();
  const read = async url => {
    if (texts.has(url)) return texts.get(url);
    if (!url.startsWith(base)) throw new Error(`${url} is outside the docs base ${base}.`);
    const relative = decodeURIComponent(url.slice(base.length));
    const file = path.resolve(
      outDir,
      relative === '' || relative.endsWith('/') ? `${relative}index.html` : relative,
    );
    if (!file.startsWith(outDir + path.sep)) throw new Error(`${url} leaves the docs outDir.`);
    let data;
    try {
      data = await readFile(file);
    } catch (error) {
      if (error?.code === 'ENOENT')
        throw new Error(`Production docs build required: ${url} is not emitted.`);
      throw error;
    }
    files.set(url, { sha256: sha256(data), bytes: data.byteLength });
    texts.set(url, data.toString('utf8'));
    return texts.get(url);
  };
  return { read, files };
}

/** Static and dynamic import targets of one module; non-literal dynamic imports are skipped. */
function importsOf(text, from) {
  const statics = [];
  const dynamics = [];
  const [imports] = parse(text, from);
  // The installed full lexer reports string kinds and decoded specifiers, not minimal n/d.
  for (const { type, specifier } of imports) {
    if (!specifier) continue;
    const dynamic = type === 'dynamic';
    if (!dynamic && type !== 'static' && type !== 'reexport-star') continue;
    if (!/^(?:[a-z][a-z0-9+.-]*:|[.]{0,2}[/])/i.test(specifier))
      throw new Error(`${from} has an unresolved bare import '${specifier}'.`);
    const next = resolveUrl(specifier, from);
    if (next && /[.]m?js$/.test(next)) (dynamic ? dynamics : statics).push(next);
  }
  return { statics, dynamics };
}

/** Breadth-first static closure of emitted ES modules; dynamic targets are only listed. */
async function moduleClosure(read, roots) {
  const js = [];
  const dynamic = [];
  const queue = [...roots];
  while (queue.length > 0) {
    const url = queue.shift();
    if (js.includes(url)) continue;
    js.push(url);
    const { statics, dynamics } = importsOf(await read(url), url);
    queue.push(...statics);
    dynamic.push(...dynamics);
  }
  return { js, dynamicImports: unique(dynamic).filter(url => !js.includes(url)) };
}

/** Stylesheets with their @import closure and the url() assets they reference. */
async function styleClosure(read, roots) {
  const css = [];
  const assets = [];
  const queue = [...roots];
  while (queue.length > 0) {
    const url = queue.shift();
    if (css.includes(url)) continue;
    css.push(url);
    for (const [, , link, , imported] of (await read(url)).matchAll(CSS_REFERENCE)) {
      const next = resolveUrl((link ?? imported).trim(), url);
      if (!next) continue;
      if (next.endsWith('.css')) queue.push(next);
      else if (!assets.includes(next)) {
        await read(next);
        assets.push(next);
      }
    }
  }
  return { css, assets };
}

/** One layout entry's static manifest closure; dynamicImports stay outside it. */
async function profileGroup(read, manifest, source, base) {
  const chunks = new Map();
  const dynamic = [];
  const queue = [source];
  while (queue.length > 0) {
    const key = queue.shift();
    if (chunks.has(key)) continue;
    const chunk = manifest[key];
    if (!chunk?.file) throw new Error(`${ADAPTIVE_MANIFEST} has no emitted file for '${key}'.`);
    chunks.set(key, chunk);
    queue.push(...(chunk.imports ?? []));
    dynamic.push(...(chunk.dynamicImports ?? []));
  }
  const records = [...chunks.values()];
  const outputs = records.map(chunk => base + chunk.file);
  const declared = records.flatMap(chunk => chunk.assets ?? []).map(file => base + file);
  const isCss = url => url.endsWith('.css');
  // CSS emitted as a chunk file or a ?url asset is still a stylesheet, not a module or asset.
  const js = outputs.filter(url => !isCss(url));
  for (const url of js) await read(url);
  const styles = await styleClosure(
    read,
    unique([
      ...records.flatMap(chunk => chunk.css ?? []).map(file => base + file),
      ...outputs.filter(isCss),
      ...declared.filter(isCss),
    ]),
  );
  const assets = unique([...declared.filter(url => !isCss(url)), ...styles.assets]);
  for (const url of assets) await read(url);
  const dynamicImports = unique(
    dynamic
      .map(key => manifest[key]?.file)
      .filter(Boolean)
      .map(file => base + file),
  ).filter(url => !js.includes(url));
  return { source, entry: outputs[0], js, css: styles.css, assets, dynamicImports };
}

/** Merged static closures of several manifest sources; each source keeps its own entry URL. */
async function featureGroup(read, manifest, sources, base, ownersOf) {
  const groups = [];
  for (const source of sources) {
    const group = await profileGroup(read, manifest, source, base);
    if (!ownersOf(group.entry, 'genuxLab entry').includes('genuxLab'))
      throw new Error(
        `${ADAPTIVE_OWNERSHIP} does not give ${source} entry ${group.entry} to genuxLab.`,
      );
    // A ?url entry may be a URL proxy; the stylesheet it names must be genuxLab's own.
    if (
      source.endsWith('.css?url') &&
      !group.css.some(url => ownersOf(url, 'genuxLab stylesheet').includes('genuxLab'))
    )
      throw new Error(`${ADAPTIVE_OWNERSHIP} gives no stylesheet of ${source} to genuxLab.`);
    groups.push(group);
  }
  const merged = name => unique(groups.flatMap(group => group[name]));
  const js = merged('js');
  return {
    sources,
    entry: groups[0].entry,
    entries: groups.map(group => group.entry),
    js,
    css: merged('css'),
    assets: merged('assets'),
    dynamicImports: merged('dynamicImports').filter(url => !js.includes(url)),
  };
}

/** The /adaptive/ lab page: island and module-script roots, stylesheets and their closures. */
async function baselineGroup(read, base) {
  const url = `${base}adaptive/`;
  const html = await read(url);
  const roots = [];
  const dynamic = [];
  const links = [];
  const add = (list, value) => {
    const resolved = value ? resolveUrl(value, url) : null;
    if (resolved) list.push(resolved);
  };
  for (const [, tag, rest] of html.matchAll(TAG)) {
    const attributes = attributesOf(rest);
    if (tag.toLowerCase() === 'astro-island') {
      for (const name of ['component-url', 'renderer-url', 'before-hydration-url'])
        add(roots, attributes.get(name));
    } else if ((attributes.get('rel') ?? '').toLowerCase().split(/\s+/).includes('stylesheet'))
      add(links, attributes.get('href'));
  }
  for (const [, rest, body] of html.matchAll(SCRIPT)) {
    const attributes = attributesOf(rest);
    if (attributes.get('type') !== 'module') continue;
    if (attributes.has('src')) add(roots, attributes.get('src'));
    else {
      const { statics, dynamics } = importsOf(body, url);
      roots.push(...statics);
      dynamic.push(...dynamics);
    }
  }
  if (roots.length === 0) throw new Error(`${url} has no module script or astro-island entry.`);
  const modules = await moduleClosure(read, unique(roots));
  const styles = await styleClosure(read, unique(links));
  return {
    html: url,
    roots: unique(roots),
    js: modules.js,
    css: styles.css,
    assets: styles.assets,
    dynamicImports: unique([...dynamic, ...modules.dynamicImports]).filter(
      target => !modules.js.includes(target),
    ),
  };
}

/** Strict adaptive-ownership.json: version 1, known owners, relative sources, emitted files. */
async function readOwnership(root, base) {
  let text;
  try {
    text = await readFile(path.join(root, ADAPTIVE_OWNERSHIP), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT')
      throw new Error(`Production docs build required: ${ADAPTIVE_OWNERSHIP} is not emitted.`);
    throw error;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`${ADAPTIVE_OWNERSHIP} is not valid JSON: ${error.message}`);
  }
  if (
    !isRecord(data) ||
    !hasKeys(data, ['files', 'version']) ||
    data.version !== 1 ||
    !isRecord(data.files)
  )
    throw new Error(`${ADAPTIVE_OWNERSHIP} must be exactly { version: 1, files: {} }.`);
  const ownership = {};
  for (const [relative, record] of Object.entries(data.files)) {
    const invalid = reason => new Error(`${ADAPTIVE_OWNERSHIP} file '${relative}' ${reason}.`);
    if (!isRelativePath(relative)) throw invalid('is not a normalized outDir-relative path');
    if (!isRecord(record) || !hasKeys(record, ['owners', 'sources']))
      throw invalid('needs exactly sources and owners');
    const { sources, owners } = record;
    if (
      !Array.isArray(owners) ||
      !owners.every(owner => adaptiveOwners.includes(owner)) ||
      unique(owners).length !== owners.length
    )
      throw invalid(`has unknown or repeated owners ${JSON.stringify(owners)}`);
    if (
      !Array.isArray(sources) ||
      sources.length === 0 ||
      !sources.every(source => isOwnershipSource(source, owners))
    )
      throw invalid(`has unnormalized sources ${JSON.stringify(sources)}`);
    let info;
    try {
      info = await stat(path.join(root, relative));
    } catch (error) {
      if (error?.code === 'ENOENT') throw invalid('is not emitted');
      throw error;
    }
    if (!info.isFile()) throw invalid('is not an emitted file');
    ownership[base + relative] = { sources: [...sources], owners: [...owners] };
  }
  return ownership;
}

/**
 * True when the baseline and the allowed owners' groups load only ownerless (shared) or allowed
 * files; otherwise throws naming the offending file and its owners. A file with any owner outside
 * allowedOwners is forbidden, however many owners it has. Group JS and CSS need a record.
 */
export function assertAdaptiveResourceIsolation(map, allowedOwners = ['phone']) {
  if (
    !Array.isArray(allowedOwners) ||
    !allowedOwners.every(owner => adaptiveOwners.includes(owner))
  )
    throw new Error(`Unknown adaptive owners ${JSON.stringify(allowedOwners)}.`);
  if (!isRecord(map?.ownership))
    throw new Error(`Adaptive resource map has no ${ADAPTIVE_OWNERSHIP} records.`);
  const groups = [['baseline', map.baseline]];
  for (const owner of allowedOwners)
    groups.push([owner, owner === 'genuxLab' ? map.features?.genuxLab : map.profiles?.[owner]]);
  for (const [label, group] of groups) {
    if (!group) throw new Error(`Adaptive resource map has no ${label} group.`);
    const code = unique([...group.js, ...group.css]);
    for (const url of unique([...code, ...group.assets])) {
      const record = Object.hasOwn(map.ownership, url) ? map.ownership[url] : undefined;
      if (!record) {
        if (code.includes(url))
          throw new Error(`${label} file ${url} has no ${ADAPTIVE_OWNERSHIP} record.`);
        continue;
      }
      const foreign = record.owners.filter(owner => !allowedOwners.includes(owner));
      if (foreign.length > 0)
        throw new Error(
          `${label} loads ${url} owned by [${record.owners.join(', ')}]; only [${allowedOwners.join(', ')}] may load here.`,
        );
    }
  }
  return true;
}

async function findManifests(dir, depth = 0) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === ADAPTIVE_MANIFEST) found.push(full);
    else if (entry.isDirectory() && depth < MAX_DEPTH && entry.name !== 'node_modules')
      found.push(...(await findManifests(full, depth + 1)));
  }
  return found;
}

function keysEnding(manifest, suffix) {
  return Object.keys(manifest).filter(key => key === suffix || key.endsWith(`/${suffix}`));
}

function layoutKeys(manifest, profile) {
  return keysEnding(manifest, `adaptive/layouts/${profile}.ts`);
}

/** Profile entries and the lab baseline, with SHA-256 and byte count of every file read. */
export async function buildAdaptiveResourceMap({ outDir, base = '/' }) {
  const root = path.resolve(outDir);
  const prefix = base.endsWith('/') ? base : `${base}/`;
  if (!prefix.startsWith('/')) throw new Error(`Docs base '${base}' must be root-relative.`);
  let candidates;
  try {
    candidates = await findManifests(root);
  } catch (error) {
    if (error?.code === 'ENOENT')
      throw new Error(`Production docs build required: ${outDir} is missing.`);
    throw error;
  }
  const matching = [];
  for (const file of candidates) {
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    if (adaptiveProfiles.some(profile => layoutKeys(manifest, profile).length > 0))
      matching.push({ file, manifest });
  }
  if (matching.length !== 1)
    throw new Error(
      `Expected one ${ADAPTIVE_MANIFEST} with adaptive layouts in ${outDir}, found ${matching.length}.`,
    );
  const [{ file, manifest }] = matching;
  for (const [key, chunk] of Object.entries(manifest))
    if (MACHINE_PATH.test(key) || MACHINE_PATH.test(chunk?.src ?? ''))
      throw new Error(`${ADAPTIVE_MANIFEST} publishes a machine path key '${key}'.`);
  const ownership = await readOwnership(root, prefix);
  const ownersOf = (url, label) => {
    if (!Object.hasOwn(ownership, url))
      throw new Error(`${ADAPTIVE_OWNERSHIP} has no record for ${label} file ${url}.`);
    return ownership[url].owners;
  };
  const covered = (group, label) => {
    for (const url of [...group.js, ...group.css]) ownersOf(url, label);
    return group;
  };
  await init;
  const { read, files } = createReader(root, prefix);
  const withFiles = group => ({
    ...group,
    files: Object.fromEntries(
      unique([group.html, ...group.js, ...group.css, ...group.assets])
        .filter(Boolean)
        .map(url => [url, files.get(url)]),
    ),
  });
  const genuxLab = GENUX_LAB_SOURCES.map(suffix => {
    const keys = keysEnding(manifest, suffix);
    if (keys.length !== 1)
      throw new Error(`${ADAPTIVE_MANIFEST} needs one ${suffix} entry, found ${keys.length}.`);
    return keys[0];
  });
  const profiles = {};
  for (const profile of adaptiveProfiles) {
    const keys = layoutKeys(manifest, profile);
    if (keys.length !== 1)
      throw new Error(
        `${ADAPTIVE_MANIFEST} needs one adaptive/layouts/${profile}.ts entry, found ${keys.length}.`,
      );
    const group = covered(await profileGroup(read, manifest, keys[0], prefix), profile);
    if (!ownersOf(group.entry, `${profile} entry`).includes(profile))
      throw new Error(
        `${ADAPTIVE_OWNERSHIP} does not give ${profile} entry ${group.entry} to ${profile}.`,
      );
    profiles[profile] = withFiles(group);
  }
  const feature = await featureGroup(read, manifest, genuxLab, prefix, ownersOf);
  const map = {
    outDir: posix(path.relative(process.cwd(), root)) || '.',
    base: prefix,
    manifestPath: posix(path.relative(root, file)),
    profiles,
    features: { genuxLab: withFiles(covered(feature, 'genuxLab')) },
    baseline: withFiles(covered(await baselineGroup(read, prefix), 'baseline')),
    ownership,
  };
  // The initial phone delivery is checked before any caller receives the map.
  assertAdaptiveResourceIsolation(map);
  return map;
}
