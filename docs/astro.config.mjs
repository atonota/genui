import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import docsPixelStyles from '../tools/docs-pixel-styles.mjs';
import docsPresentation from '../tools/docs-presentation.mjs';
import docsPages, { PAGES_BASE, PAGES_SITE } from '../tools/docs-pages.mjs';

// GENUI_DOCS_PAGES=1 builds the GitHub Pages artifact; local builds keep root base and docs/dist.
const pages = process.env.GENUI_DOCS_PAGES === '1';

// Stable manifest name; tools/docs-adaptive-resource-map.mjs maps layout chunks from it.
const ADAPTIVE_MANIFEST = 'adaptive-manifest.json';

// Absolute Vite source ids are published relative to the repository, never as machine paths.
const REPO_ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

/** Repo-relative POSIX form of an absolute source id, keeping its ?query; other ids pass through. */
function publicSource(id) {
  if (typeof id !== 'string' || !path.win32.isAbsolute(id)) return id;
  const query = id.indexOf('?');
  const file = query === -1 ? id : id.slice(0, query);
  const relative = path.relative(REPO_ROOT, file);
  if (
    !path.isAbsolute(file) ||
    relative === '' ||
    relative.split(path.sep)[0] === '..' ||
    path.isAbsolute(relative)
  )
    throw new Error(`${ADAPTIVE_MANIFEST} source '${id}' is not inside the repository.`);
  return relative.split(path.sep).join('/') + (query === -1 ? '' : id.slice(query));
}

/** Rewrites the emitted client manifest in place: repo-relative sources, sorted keys, checked outputs. */
async function publishManifest(dir) {
  const file = path.join(dir, ADAPTIVE_MANIFEST);
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  const chunks = new Map();
  for (const [key, chunk] of Object.entries(manifest)) {
    const id = publicSource(key);
    if (chunks.has(id)) throw new Error(`${ADAPTIVE_MANIFEST} keys collide at '${id}'.`);
    for (const output of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])])
      if (
        typeof output !== 'string' ||
        path.win32.isAbsolute(output) ||
        !path.resolve(dir, output).startsWith(dir + path.sep)
      )
        throw new Error(`${ADAPTIVE_MANIFEST} output '${output}' of '${id}' leaves the artifact.`);
    chunks.set(id, {
      ...chunk,
      ...(chunk.src === undefined ? {} : { src: publicSource(chunk.src) }),
      ...(chunk.imports ? { imports: chunk.imports.map(publicSource) } : {}),
      ...(chunk.dynamicImports ? { dynamicImports: chunk.dynamicImports.map(publicSource) } : {}),
    });
  }
  const sorted = [...chunks].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const text = `${JSON.stringify(Object.fromEntries(sorted), null, 2)}\n`;
  if (text.includes(REPO_ROOT))
    throw new Error(`${ADAPTIVE_MANIFEST} still publishes a machine path.`);
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, text);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

// Astro forces build.manifest to false after the user Vite config, so the manifest is set on the
// client environment through astro:build:setup, which merges after those framework defaults.
// Only the public client output gets it; server and prerender output stay manifest-free.
// build:done then republishes absolute source ids repo-relative before presentation and Pages.
function adaptiveManifest() {
  let configured = false;
  return {
    name: 'atlas-docs-adaptive-manifest',
    hooks: {
      'astro:build:setup': ({ vite, updateConfig }) => {
        if (!vite.environments?.client) return;
        updateConfig({ environments: { client: { build: { manifest: ADAPTIVE_MANIFEST } } } });
        configured = true;
      },
      'astro:build:done': async ({ dir }) => {
        if (!configured)
          throw new Error(
            `No Vite client environment was configured to emit ${ADAPTIVE_MANIFEST}.`,
          );
        await publishManifest(path.resolve(fileURLToPath(dir)));
      },
    },
  };
}

// Client build ownership of emitted files from the real static module graph and the source-owned
// roots in src/adaptive/resource-ownership.json; the published v1 shape is frozen for tools.
const OWNERSHIP_FILE = 'adaptive-ownership.json';
const OWNERSHIP_CONFIG = new URL('./src/adaptive/resource-ownership.json', import.meta.url);
const OWNERS = ['phone', 'tablet', 'laptop', 'desktop', 'wide', 'living-room', 'genuiLab'];
const DOCS_ROOT = path.resolve(fileURLToPath(new URL('./', import.meta.url)));
// Style modules, including Astro style blocks; ?url, ?raw and ?inline imports stay plain JS.
const STYLE_MODULE = /(?:[.]|lang[.])(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)(?:$|[?&])/;
const STYLE_AS_JS = /[?&](?:url|raw|inline)(?:$|[&=])/;

// Ownerless marker for a generated bundler runtime chunk that has no source module of its own.
const BUNDLER_RUNTIME = 'virtual:bundler-runtime';
// Rolldown synthesizes its runtime module at output only: chunks list it, the module graph never does.
const ROLLDOWN_RUNTIME = '\0rolldown/runtime.js';

/** Public marker of a virtual id: path characters only, no NUL, backslash, query, colon or '..'. */
function virtualSource(name) {
  const marker = name
    .replace(/^virtual:/, '')
    .replace(/[^a-zA-Z0-9_.@+/-]+/g, '-')
    .split('/')
    .filter(part => part !== '' && part !== '.' && part !== '..')
    .join('/');
  if (marker === '')
    throw new Error(`${OWNERSHIP_FILE} virtual source '${name}' cannot be published.`);
  return `virtual:${marker}`;
}

/** Query-free public source of a module id; files stay repo-relative, virtual ids become markers. */
function ownershipSource(id) {
  const virtual = id.charCodeAt(0) === 0;
  const bare = (virtual ? id.slice(1) : id).split('?')[0];
  let source = bare.split(path.win32.sep).join('/');
  if (path.isAbsolute(bare)) {
    const relative = path.relative(REPO_ROOT, bare).split(path.sep).join('/');
    const vendor = source.lastIndexOf('/node_modules/');
    if (relative !== '' && relative !== '..' && !relative.startsWith('../')) source = relative;
    else if (vendor !== -1) source = source.slice(vendor + 1);
    else if (virtual) return virtualSource(path.basename(bare));
    else throw new Error(`${OWNERSHIP_FILE} source '${id}' is not inside the repository.`);
  } else if (virtual || /^[a-zA-Z0-9_-]{2,}:/.test(source)) return virtualSource(source);
  if (source === '' || /^(?:[a-zA-Z]:)?[/]/.test(source) || source.split('/').includes('..'))
    throw new Error(`${OWNERSHIP_FILE} source '${id}' cannot be published.`);
  return source;
}

/** A prefix ending in '/' is a folder; otherwise it also covers its extensions and same-named folder. */
const underPrefix = (source, prefix) =>
  source.startsWith(prefix) &&
  (prefix.endsWith('/') || source.length === prefix.length || '/.'.includes(source[prefix.length]));

/** Validated ownership config; a missing, malformed or partial declaration fails the build. */
function readOwnershipConfig(raw) {
  const paths = (value, where, optional = false) => {
    if (
      !Array.isArray(value) ||
      (!optional && value.length === 0) ||
      value.some(item => typeof item !== 'string' || item === '')
    )
      throw new Error(`resource-ownership.json ${where} must list repository paths.`);
    return value;
  };
  if (raw?.version !== 1) throw new Error('resource-ownership.json must declare version 1.');
  const unknown = Object.keys(raw.ownerRoots ?? {}).find(owner => !OWNERS.includes(owner));
  if (unknown) throw new Error(`resource-ownership.json declares unknown owner '${unknown}'.`);
  if (
    !Array.isArray(raw.alwaysOwned) ||
    raw.alwaysOwned.some(
      rule =>
        typeof rule?.prefix !== 'string' || rule.prefix === '' || !OWNERS.includes(rule.owner),
    )
  )
    throw new Error('resource-ownership.json alwaysOwned must map prefixes to known owners.');
  return {
    sharedRoots: paths(raw.sharedRoots, 'sharedRoots'),
    ownerRoots: new Map(
      OWNERS.map(owner => [owner, paths(raw.ownerRoots?.[owner], `ownerRoots.${owner}`)]),
    ),
    alwaysOwned: raw.alwaysOwned,
    sharedExceptions: paths(raw.sharedExceptions ?? [], 'sharedExceptions', true),
  };
}

/** Owners in one environment's module graph: each owner root's static closure minus the shared
 * roots' closure; always-owned prefixes win over any accidental shared import. Server graphs may
 * lack client-only roots, which only shrinks the shared closure and so can only add owners. */
function moduleOwnership(context, config, environment, requireRoots) {
  const sourceOf = new Map();
  const idsOf = new Map();
  for (const id of context.getModuleIds()) {
    // Rolldown ModuleInfo has no isExternal: unknown ids return null and Rollup externals stay out.
    const info = context.getModuleInfo(id);
    if (!info || info.isExternal === true) continue;
    const source = ownershipSource(id);
    sourceOf.set(id, source);
    idsOf.set(source, [...(idsOf.get(source) ?? []), id]);
  }
  if (sourceOf.size === 0)
    throw new Error(`${OWNERSHIP_FILE} found no ${environment} module graph.`);
  const closure = roots => {
    const seen = new Set();
    const queue = roots.flatMap(root => {
      const ids = [...sourceOf]
        .filter(
          ([, source]) =>
            source === root ||
            source.slice(0, source.length - path.posix.extname(source).length) === root,
        )
        .map(([id]) => id);
      if (ids.length === 0 && requireRoots)
        throw new Error(
          `${OWNERSHIP_FILE} root '${root}' is not in the ${environment} module graph.`,
        );
      return ids;
    });
    while (queue.length > 0) {
      const id = queue.pop();
      if (seen.has(id) || !sourceOf.has(id)) continue;
      seen.add(id);
      queue.push(...context.getModuleInfo(id).importedIds);
    }
    return seen;
  };
  const shared = closure(config.sharedRoots);
  const owned = new Map(
    [...config.ownerRoots].map(([owner, roots]) => [
      owner,
      new Set([...closure(roots)].filter(id => !shared.has(id))),
    ]),
  );
  const forced = source =>
    config.sharedExceptions.some(prefix => underPrefix(source, prefix))
      ? undefined
      : config.alwaysOwned.find(rule => underPrefix(source, rule.prefix))?.owner;
  const ownersOf = id => {
    if (!sourceOf.has(id))
      throw new Error(`${OWNERSHIP_FILE} output module '${id}' is missing from the module graph.`);
    const source = sourceOf.get(id);
    // Virtual modules are owned like files: by owner closures outside the shared closure.
    const owner = forced(source);
    return owner ? [owner] : OWNERS.filter(name => owned.get(name).has(id));
  };
  return { sourceOf, idsOf, forced, ownersOf };
}

// Client-only Vite plugin beside the manifest hook; owners come from the client module graph.
function adaptiveOwnership() {
  let config;
  return {
    name: 'atlas-docs-adaptive-ownership',
    apply: 'build',
    applyToEnvironment: environment => environment.name === 'client',
    async buildStart() {
      config = readOwnershipConfig(JSON.parse(await readFile(OWNERSHIP_CONFIG, 'utf8')));
    },
    generateBundle(_options, bundle) {
      const { sourceOf, idsOf, forced, ownersOf } = moduleOwnership(this, config, 'client', true);
      const files = new Map();
      // Every output keeps its actual sources; shared files simply list no owner.
      const add = (file, source, owners) => {
        const entry = files.get(file) ?? { sources: new Set(), owners: new Set() };
        entry.sources.add(source);
        for (const owner of owners) entry.owners.add(owner);
        files.set(file, entry);
      };
      const root = this.environment?.config.root ?? DOCS_ROOT;
      for (const output of Object.values(bundle)) {
        if (output.type === 'asset') {
          // originalFileNames are relative to the Vite root; root CSS URL entries own their asset.
          for (const name of output.originalFileNames ?? []) {
            const source = ownershipSource(path.resolve(root, name));
            const ids = idsOf.get(source) ?? [];
            const owner = forced(source);
            add(
              output.fileName,
              source,
              ids.length > 0 ? [...new Set(ids.flatMap(ownersOf))] : owner ? [owner] : [],
            );
          }
          continue;
        }
        const styles = [];
        // A generated runtime chunk has no module or facade of its own and serves every owner.
        if (Object.keys(output.modules).length === 0 && output.facadeModuleId == null)
          add(output.fileName, BUNDLER_RUNTIME, []);
        for (const [id, module] of Object.entries(output.modules)) {
          // Only the exact output-only Rolldown runtime is ownerless glue; other unknown ids still fail.
          if (id === ROLLDOWN_RUNTIME) add(output.fileName, BUNDLER_RUNTIME, []);
          else if (STYLE_MODULE.test(id) && !STYLE_AS_JS.test(id)) {
            // A style-only JS stub carries its style side-effect link, so the style owns it too.
            styles.push(id);
            add(output.fileName, sourceOf.get(id), ownersOf(id));
          } else {
            // Modules rendered to nothing stay listed but do not make the file theirs.
            const owners = ownersOf(id);
            add(output.fileName, sourceOf.get(id), module.renderedLength !== 0 ? owners : []);
          }
        }
        // Chunk CSS takes its style modules' owners, or the chunk's own when none are known.
        const chunk = files.get(output.fileName);
        for (const css of output.viteMetadata?.importedCss ?? []) {
          if (styles.length > 0) for (const id of styles) add(css, sourceOf.get(id), ownersOf(id));
          else for (const source of chunk?.sources ?? []) add(css, source, [...chunk.owners]);
        }
      }
      const unrecorded = Object.values(bundle)
        .map(output => output.fileName)
        .filter(file => /[.](?:m?js|css)$/.test(file) && !files.has(file));
      if (unrecorded.length > 0)
        throw new Error(`${OWNERSHIP_FILE} has no recorded sources for ${unrecorded.join(', ')}.`);
      const missing = OWNERS.filter(
        owner => ![...files.values()].some(entry => entry.owners.has(owner)),
      );
      if (missing.length > 0)
        throw new Error(`${OWNERSHIP_FILE} has no client output for ${missing.join(', ')}.`);
      const entries = [...files]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([file, entry]) => {
          if (
            file.includes(path.win32.sep) ||
            path.posix.isAbsolute(file) ||
            file.split('/').includes('..')
          )
            throw new Error(`${OWNERSHIP_FILE} output '${file}' leaves the artifact.`);
          return [
            file,
            {
              sources: [...entry.sources].sort(),
              owners: OWNERS.filter(owner => entry.owners.has(owner)),
            },
          ];
        });
      const text = `${JSON.stringify({ version: 1, files: Object.fromEntries(entries) }, null, 2)}\n`;
      if (text.includes(REPO_ROOT))
        throw new Error(`${OWNERSHIP_FILE} still publishes a machine path.`);
      this.emitFile({ type: 'asset', fileName: OWNERSHIP_FILE, source: text });
    },
  };
}

// Astro renders DocsLayout and page styles in its server environments only, and presentation
// restores the CSS they emit into the client output. Each such stylesheet is traced here to the
// style modules or asset origins that actually produced it; an untraceable stylesheet fails.
const serverStyles = new Map();

function adaptiveStyleProvenance(styles) {
  let config;
  return {
    name: 'atlas-docs-adaptive-style-provenance',
    apply: 'build',
    applyToEnvironment: environment => environment.name !== 'client',
    async buildStart() {
      config = readOwnershipConfig(JSON.parse(await readFile(OWNERSHIP_CONFIG, 'utf8')));
    },
    // Ordered 'pre' like the presentation CSS snapshot, before Astro prunes server CSS assets.
    generateBundle: {
      order: 'pre',
      handler(_options, bundle) {
        const outputs = Object.values(bundle);
        const stylesheet = output => output.type === 'asset' && output.fileName.endsWith('.css');
        const linked = output =>
          output.type === 'chunk' ? [...(output.viteMetadata?.importedCss ?? [])] : [];
        if (!outputs.some(output => stylesheet(output) || linked(output).length > 0)) return;
        const environment = this.environment?.name ?? 'server';
        const { sourceOf, idsOf, forced, ownersOf } = moduleOwnership(
          this,
          config,
          environment,
          false,
        );
        const recorded = new Set();
        const add = (file, source, owners) => {
          if (
            file.includes(path.win32.sep) ||
            path.posix.isAbsolute(file) ||
            file.split('/').includes('..')
          )
            throw new Error(`${OWNERSHIP_FILE} output '${file}' leaves the artifact.`);
          const entry = styles.get(file) ?? { sources: new Set(), owners: new Set() };
          entry.sources.add(source);
          for (const owner of owners) entry.owners.add(owner);
          styles.set(file, entry);
          recorded.add(file);
        };
        const root = this.environment?.config.root ?? DOCS_ROOT;
        for (const output of outputs) {
          if (stylesheet(output)) {
            // Emitted stylesheet assets name their own origins, relative to the Vite root.
            for (const name of output.originalFileNames ?? []) {
              const source = ownershipSource(path.resolve(root, name));
              const ids = idsOf.get(source) ?? [];
              const owner = forced(source);
              add(
                output.fileName,
                source,
                ids.length > 0 ? [...new Set(ids.flatMap(ownersOf))] : owner ? [owner] : [],
              );
            }
            continue;
          }
          const css = linked(output);
          if (css.length === 0) continue;
          // Vite builds chunk CSS from exactly the chunk's style modules; ?inline styles stay JS.
          const ids = (output.moduleIds ?? Object.keys(output.modules)).filter(
            id => STYLE_MODULE.test(id) && !STYLE_AS_JS.test(id),
          );
          if (ids.length === 0)
            throw new Error(
              `${OWNERSHIP_FILE} cannot trace ${css.join(', ')} of ${environment} chunk ${output.fileName} to a style module.`,
            );
          for (const file of css) for (const id of ids) add(file, sourceOf.get(id), ownersOf(id));
        }
        const unknown = outputs
          .filter(output => stylesheet(output) && !recorded.has(output.fileName))
          .map(output => output.fileName);
        if (unknown.length > 0)
          throw new Error(
            `${OWNERSHIP_FILE} has no recorded ${environment} sources for ${unknown.join(', ')}.`,
          );
      },
    },
  };
}

/** Merges traced server stylesheets into the emitted ownership record; pruning then judges all. */
async function mergeServerStyles(dir, styles) {
  if (styles.size === 0) return;
  const file = path.join(dir, OWNERSHIP_FILE);
  const record = JSON.parse(await readFile(file, 'utf8'));
  if (
    record?.version !== 1 ||
    Object.keys(record).sort().join() !== 'files,version' ||
    typeof record.files !== 'object' ||
    record.files === null ||
    Array.isArray(record.files)
  )
    throw new Error(`${OWNERSHIP_FILE} must keep its frozen version 1 { version, files } shape.`);
  const files = new Map(Object.entries(record.files));
  for (const [name, entry] of styles) {
    const known = files.get(name);
    if (known !== undefined && (!Array.isArray(known?.sources) || !Array.isArray(known?.owners)))
      throw new Error(`${OWNERSHIP_FILE} output '${name}' must list its sources and owners.`);
    const sources = new Set([...(known?.sources ?? []), ...entry.sources]);
    const owners = new Set([...(known?.owners ?? []), ...entry.owners]);
    files.set(name, {
      sources: [...sources].sort(),
      owners: OWNERS.filter(owner => owners.has(owner)),
    });
  }
  const sorted = [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const text = `${JSON.stringify({ version: 1, files: Object.fromEntries(sorted) }, null, 2)}\n`;
  if (text.includes(REPO_ROOT))
    throw new Error(`${OWNERSHIP_FILE} still publishes a machine path.`);
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, text);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

// Astro prerendering inlines or drops unused client scripts after Vite's generateBundle, so the
// emitted ownership can name files the final output no longer has. This runs after presentation
// restores CSS and before the Pages adapter: missing ownerless records are dropped, a missing
// owned file fails the build, and every remaining record keeps its sources and owners unchanged.
async function pruneOwnership(dir, logger) {
  const file = path.join(dir, OWNERSHIP_FILE);
  const record = JSON.parse(await readFile(file, 'utf8'));
  if (
    record?.version !== 1 ||
    Object.keys(record).sort().join() !== 'files,version' ||
    typeof record.files !== 'object' ||
    record.files === null ||
    Array.isArray(record.files)
  )
    throw new Error(`${OWNERSHIP_FILE} must keep its frozen version 1 { version, files } shape.`);
  const kept = [];
  let removed = 0;
  for (const [name, entry] of Object.entries(record.files)) {
    const target = path.resolve(dir, name);
    if (
      name === '' ||
      name.includes(path.win32.sep) ||
      path.posix.isAbsolute(name) ||
      name.split('/').includes('..') ||
      !target.startsWith(dir + path.sep)
    )
      throw new Error(`${OWNERSHIP_FILE} output '${name}' leaves the artifact.`);
    if (!Array.isArray(entry?.sources) || !Array.isArray(entry?.owners))
      throw new Error(`${OWNERSHIP_FILE} output '${name}' must list its sources and owners.`);
    let present = true;
    try {
      if (!(await stat(target)).isFile())
        throw new Error(`${OWNERSHIP_FILE} output '${name}' is not a file.`);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
      present = false;
    }
    if (present) kept.push([name, entry]);
    // An owned file may have been inlined into pages; failing keeps a possible profile leak visible.
    else if (entry.owners.length > 0)
      throw new Error(
        `${OWNERSHIP_FILE} owned output '${name}' (${entry.owners.join(', ')}) is missing from the final build.`,
      );
    else removed += 1;
  }
  if (removed === 0) return;
  const sorted = kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const text = `${JSON.stringify({ version: 1, files: Object.fromEntries(sorted) }, null, 2)}\n`;
  if (text.includes(REPO_ROOT))
    throw new Error(`${OWNERSHIP_FILE} still publishes a machine path.`);
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, text);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  logger.info(
    `${OWNERSHIP_FILE} dropped ${removed} ownerless record(s) the final build discarded.`,
  );
}

function adaptiveOwnershipPrune(styles) {
  return {
    name: 'atlas-docs-adaptive-ownership-prune',
    hooks: {
      'astro:build:start': () => {
        styles.clear();
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = path.resolve(fileURLToPath(dir));
        // Server stylesheets join the client record first, so pruning judges every file alike.
        await mergeServerStyles(root, styles);
        await pruneOwnership(root, logger);
      },
    },
  };
}

export default defineConfig({
  ...(pages ? { site: PAGES_SITE, base: PAGES_BASE, outDir: './pages/dist' } : {}),
  // The Pages adapter runs after the presentation gate has checked the canonical root paths;
  // ownership records are pruned between them, once presentation has restored CSS.
  integrations: [
    react(),
    adaptiveManifest(),
    docsPresentation(),
    adaptiveOwnershipPrune(serverStyles),
    ...(pages ? [docsPages()] : []),
  ],
  output: 'static',
  server: { host: '127.0.0.1', port: 4321 },
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'auto' },
  vite: {
    css: { postcss: { plugins: [docsPixelStyles()] } },
    plugins: [adaptiveOwnership(), adaptiveStyleProvenance(serverStyles)],
  },
});
