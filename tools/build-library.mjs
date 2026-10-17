// Library build for packages/genux. esbuild bundles the public entries as ES modules with code
// splitting (literal dynamic profiles stay separate chunks), turns Vite-style ?inline/?raw and Sass
// imports into code-owned CSS strings, builds the static styles.css entry and records
// dist/consumer.json; the pinned tsc emits declarations. Writes only packages/genux/dist and the
// copied packages/genux/LICENSE; canonical sources and the root legacy build stay untouched.
import { execFile } from 'node:child_process';
import { existsSync, lstatSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import * as sass from 'sass';

const run = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = path.join(repoRoot, 'packages', 'genux');
const srcDir = path.join(packageDir, 'src');
const distDir = path.join(packageDir, 'dist');
const typesDir = path.join(distDir, 'types');
const stylesDir = path.join(repoRoot, 'docs', 'src', 'styles');
const assetsDir = path.join(repoRoot, 'src', 'assets');

const adaptiveDir = path.join(repoRoot, 'docs', 'src', 'adaptive');

// Public subpath -> source path without extension. Package entries live in src; the explicit input
// layers build directly from the canonical docs/src/adaptive sources, so no wrapper files exist.
const ENTRIES = {
  index: path.join(srcDir, 'index'),
  adaptive: path.join(srcDir, 'adaptive'),
  genux: path.join(srcDir, 'genux'),
  frappe: path.join(srcDir, 'frappe'),
  'input/spatial': path.join(adaptiveDir, 'spatial'),
  'input/pointer': path.join(adaptiveDir, 'pointer'),
  'input/webos': path.join(adaptiveDir, 'webos'),
};
const ENTRY_EXTENSIONS = ['.ts', '.tsx'];
const ASSET_EXTENSIONS = ['.woff2', '.woff', '.svg', '.png', '.jpg', '.webp'];
const QUERY = /[?](inline|raw)$/;
const SASS = /[.]s[ac]ss$/;
// web.css, the docs.css shell (only its foundation is extracted) and shell/sidebar/catalog/preview
// sheets are docs-only and must never reach the library.
const DOCS_ONLY_STYLE =
  /(^|[/])(web|docs)[.]css$|(shell|sidebar|catalog|preview)[^/]*[.](css|s[ac]ss)$/;
// Docs preview modules and any demo path must never reach the base entry's graph.
const DOCS_ONLY_MODULE =
  /^docs[/]src[/]react[/](ExamplePreview|PreviewWorkbench|PreviewSource|usePreviewFrame|InlinePreview)[.][jt]sx?$|(^|[/])(demos?[/]|[^/]*Demo[^/]*[.][jt]sx?$)/;
const MIN_TEXT_PX = 14;
const SMALL_TEXT = /font-size *: *([0-9]*[.]?[0-9]+)(px|rem)(?![a-z])/g;

const toPosix = file => file.split(path.sep).join('/');
const rel = file => toPosix(path.relative(repoRoot, file));
const fromPackage = metaPath =>
  `./${toPosix(path.relative(packageDir, path.join(repoRoot, metaPath)))}`;
const packageName = specifier =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));

function fail(message) {
  throw new Error(`build-library: ${message}`);
}

function assertNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!((major === 24 && minor >= 15) || major >= 26)) {
    fail(`Node ${process.versions.node} does not satisfy ^24.15.0 || >=26.0.0`);
  }
}

// Root devDependencies pin the toolchain; a drifted node_modules must not build silently.
async function assertToolchain(rootManifest) {
  const toolchain = {};
  for (const name of ['esbuild', 'typescript', 'sass', 'postcss']) {
    const pinned = rootManifest.devDependencies?.[name];
    const { version } = await readJson(path.join(repoRoot, 'node_modules', name, 'package.json'));
    if (version !== pinned)
      fail(`${name} ${version} in node_modules differs from pinned ${pinned}`);
    toolchain[name] = version;
  }
  if (esbuild.version !== toolchain.esbuild) {
    fail(`esbuild binary ${esbuild.version} differs from ${toolchain.esbuild}`);
  }
  return toolchain;
}

function resolveEntries() {
  return Object.fromEntries(
    Object.entries(ENTRIES).map(([name, base]) => {
      const found = ENTRY_EXTENSIONS.map(ext => base + ext).filter(file => existsSync(file));
      if (found.length !== 1)
        fail(`entry ${name} needs exactly one source at ${rel(base)}.{ts,tsx}`);
      return [name, found[0]];
    }),
  );
}

function compileSass(file) {
  return sass.compile(file, {
    style: 'expanded',
    sourceMap: false,
    loadPaths: [path.join(repoRoot, 'node_modules')],
    importers: [new sass.NodePackageImporter(repoRoot)],
  }).css;
}

function sassPlugin() {
  return {
    name: 'genux-sass',
    setup(build) {
      build.onLoad({ filter: SASS, namespace: 'file' }, args => ({
        contents: compileSass(args.path),
        loader: 'css',
        resolveDir: path.dirname(args.path),
      }));
    },
  };
}

// Vite ?inline semantics: the stylesheet with its @imports bundled and assets inlined, as a string.
async function inlineCss(file) {
  const source = SASS.test(file)
    ? {
        stdin: {
          contents: compileSass(file),
          loader: 'css',
          resolveDir: path.dirname(file),
          sourcefile: rel(file),
        },
      }
    : { entryPoints: [file] };
  const result = await esbuild.build({
    ...source,
    absWorkingDir: repoRoot,
    bundle: true,
    write: false,
    sourcemap: false,
    charset: 'utf8',
    logLevel: 'silent',
    loader: Object.fromEntries(ASSET_EXTENSIONS.map(ext => [ext, 'dataurl'])),
    plugins: [sassPlugin()],
  });
  return result.outputFiles[0].text;
}

function libraryPlugin(foundation) {
  return {
    name: 'genux-library',
    setup(build) {
      build.onResolve({ filter: /^genux:foundation$/ }, () => ({
        path: 'foundation.css',
        namespace: 'genux-foundation',
      }));
      build.onLoad({ filter: /.*/, namespace: 'genux-foundation' }, () => ({
        contents: foundation,
        loader: 'css',
        resolveDir: srcDir,
      }));
      // Namespaced paths stay repository-relative so the metafile never records local paths.
      build.onResolve({ filter: QUERY }, args => {
        const kind = args.path.match(QUERY)[1];
        const specifier = args.path.slice(0, -kind.length - 1);
        const file = path.resolve(args.resolveDir, specifier);
        if (!specifier.startsWith('.') || !existsSync(file)) {
          return {
            errors: [{ text: `cannot resolve relative ${args.path} from ${rel(args.importer)}` }],
          };
        }
        return { path: rel(file), namespace: `genux-${kind}` };
      });
      build.onLoad({ filter: /.*/, namespace: 'genux-inline' }, async args => ({
        contents: `export default ${JSON.stringify(await inlineCss(path.join(repoRoot, args.path)))};`,
        loader: 'js',
      }));
      build.onLoad({ filter: /.*/, namespace: 'genux-raw' }, async args => ({
        contents: `export default ${JSON.stringify(await readFile(path.join(repoRoot, args.path), 'utf8'))};`,
        loader: 'js',
      }));
    },
  };
}

function rebaseFontFace(rule, from) {
  rule.walkDecls('src', decl => {
    decl.value = decl.value.replace(/url[(]([^)]*)[)]/g, (match, raw) => {
      const ref = raw.trim().replace(/^['"]|['"]$/g, '');
      const asset = path.resolve(path.dirname(from), ref);
      if (!asset.startsWith(assetsDir + path.sep) || !existsSync(asset)) {
        fail(`@font-face url ${ref} must point at an existing file in src/assets`);
      }
      return `url('${toPosix(path.relative(srcDir, asset))}')`;
    });
  });
  return rule;
}

// Foundation = the top-level :root block and @font-face rules of the canonical docs.css, copied
// through PostCSS unchanged except for font URLs, which esbuild's file loader then copies.
async function foundationCss() {
  const from = path.join(stylesDir, 'docs.css');
  const root = postcss.parse(await readFile(from, 'utf8'), { from });
  const foundation = postcss.root();
  root.each(node => {
    if (node.type === 'rule' && node.selector.trim() === ':root') foundation.append(node.clone());
    if (node.type === 'atrule' && node.name === 'font-face') {
      foundation.append(rebaseFontFace(node.clone(), from));
    }
  });
  const css = foundation.toString();
  if (!foundation.some(node => node.type === 'rule')) fail('docs.css has no top-level :root block');
  if (!css.includes('font-family: Outfit'))
    fail('docs.css @font-face rules no longer declare Outfit');
  return `/* Generated from docs/src/styles/docs.css: :root and @font-face only. */\n${css}\n`;
}

// Cleanup is limited to this package's generated dist directory.
async function cleanDist() {
  if (rel(distDir) !== 'packages/genux/dist') fail(`refusing to clean ${rel(distDir)}`);
  if (existsSync(distDir) && lstatSync(distDir).isSymbolicLink()) {
    fail('packages/genux/dist must not be a symlink');
  }
  await rm(distDir, { recursive: true, force: true });
}

// Every stylesheet that reaches a bundle is canonical; styles.css additionally stays inside the docs
// style sheets, shared assets and the generated foundation.
function checkStyleInputs(metafile, staticEntry) {
  for (const input of Object.keys(metafile.inputs)) {
    const file = input.replace(/^genux-[a-z]+:/, '');
    if (DOCS_ONLY_STYLE.test(file)) fail(`docs-only style ${file} reached the library`);
    const canonical =
      input === 'genux-foundation:foundation.css' ||
      file === rel(path.join(srcDir, 'styles.css')) ||
      ['docs/src/styles/', 'src/assets/', 'node_modules/'].some(prefix => file.startsWith(prefix));
    if (staticEntry && !canonical) fail(`styles.css pulled unexpected input ${input}`);
  }
}

// The base entry and every chunk it can load, statically or dynamically, stay free of docs preview
// and demo modules.
function checkBaseInputs(metafile, entry) {
  const outputs = metafile.outputs;
  const start = Object.keys(outputs).find(
    file => file.endsWith('.js') && outputs[file].entryPoint === rel(entry),
  );
  if (!start) fail('no JavaScript output for the base entry');
  const seen = new Set();
  const pending = [start];
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const input of Object.keys(outputs[file].inputs)) {
      const source = input.replace(/^genux-[a-z]+:/, '');
      if (DOCS_ONLY_MODULE.test(source)) fail(`base entry pulls docs-only module ${source}`);
    }
    for (const item of outputs[file].imports) {
      if (!item.external && outputs[item.path]) pending.push(item.path);
    }
  }
}

// The JS build also emits a CSS bundle per entry (for example dist/index.css) for stylesheets that
// components import directly, yet only dist/styles.css is exported. Append each top-level bundle
// rule that styles.css lacks after the static sheets, in bundle order, with asset URLs rebased to
// dist, then prove from the written file that every bundle rule is delivered. ?inline profile CSS
// stays a string in its chunk and never reaches these bundles.
function rebaseBundleUrls(node, from) {
  node.walkDecls(decl => {
    decl.value = decl.value.replace(/url[(]([^)]*)[)]/g, (match, raw) => {
      const ref = raw.trim().replace(/^['"]|['"]$/g, '');
      if (/^([a-z][a-z0-9+.-]*:|[/#])/i.test(ref)) return match;
      const asset = path.resolve(path.dirname(from), ref);
      if (!asset.startsWith(distDir + path.sep) || !existsSync(asset)) {
        fail(`${rel(from)} url ${ref} must point at an emitted file in packages/genux/dist`);
      }
      const rebased = `./${toPosix(path.relative(distDir, asset))}`;
      if (path.posix.normalize(ref) === path.posix.normalize(rebased)) return match;
      return `url('${rebased}')`;
    });
  });
  return node;
}

const topLevelRules = root => root.nodes.filter(node => node.type !== 'comment');
const ruleKey = node => {
  const copy = node.clone();
  copy.cleanRaws();
  return copy.toString();
};

async function deliverBundleCss(metafile, entries) {
  const outputs = metafile.outputs;
  const entryBundles = Object.values(entries).map(source => {
    const output = Object.keys(outputs).find(
      file => file.endsWith('.js') && outputs[file].entryPoint === rel(source),
    );
    return output && outputs[output].cssBundle;
  });
  const cssOutputs = Object.keys(outputs)
    .filter(file => file.endsWith('.css'))
    .sort();
  const bundles = [...new Set([...entryBundles.filter(Boolean), ...cssOutputs])];
  const stylesFile = path.join(distDir, 'styles.css');
  const deliveredBy = fromPackage(rel(stylesFile));
  const original = (await readFile(stylesFile, 'utf8')).trimEnd();
  const delivered = new Set(topLevelRules(postcss.parse(original)).map(ruleKey));
  const required = new Set();
  const parts = [];
  const record = [];
  for (const bundle of bundles) {
    const from = path.join(repoRoot, bundle);
    const nodes = topLevelRules(postcss.parse(await readFile(from, 'utf8'), { from }));
    const appended = [];
    for (const node of nodes) {
      const key = ruleKey(rebaseBundleUrls(node, from));
      required.add(key);
      if (delivered.has(key)) continue;
      if (node.type === 'atrule' && ['charset', 'import'].includes(node.name)) {
        fail(`${bundle} has @${node.name}, which cannot follow the static styles`);
      }
      delivered.add(key);
      appended.push(node.toString());
    }
    if (appended.length) parts.push(`/* ${fromPackage(bundle)} */`, ...appended);
    record.push({
      file: fromPackage(bundle),
      deliveredBy,
      rules: nodes.length,
      appended: appended.length,
    });
  }
  const tail = parts.length ? `\n\n${parts.join('\n')}` : '';
  await writeFile(stylesFile, `${original}${tail}\n`);

  // Prove delivery from the written file, not from the bookkeeping above.
  const written = await readFile(stylesFile, 'utf8');
  if (!written.startsWith(original)) fail('merging bundle CSS altered the static styles.css rules');
  const writtenKeys = new Set(topLevelRules(postcss.parse(written)).map(ruleKey));
  const orphan = [...required].filter(key => !writtenKeys.has(key));
  if (orphan.length) {
    fail(`styles.css misses bundle CSS rules:\n${orphan.map(key => key.slice(0, 120)).join('\n')}`);
  }
  return record;
}

function checkSideEffects(manifest) {
  const marked = manifest.sideEffects;
  if (
    !Array.isArray(marked) ||
    marked.length === 0 ||
    marked.some(pattern => !/[.](css|woff2?)$|assets/.test(pattern))
  ) {
    fail('packages/genux/package.json sideEffects must list only CSS and font patterns');
  }
}

// Declarations come from the pinned compiler in root node_modules, run with this Node binary.
async function emitDeclarations() {
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  try {
    await run(process.execPath, [tsc, '--project', path.join(packageDir, 'tsconfig.json')], {
      cwd: packageDir,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    fail(`tsc declaration emit failed\n${error.stdout ?? ''}${error.stderr ?? error.message}`);
  }
}

// Canonical sources reference vite/client for the build compiler only; drop that reference from the
// emitted declarations so consumers need no Vite types. scanDist rejects any Vite reference left.
const VITE_CLIENT_REFERENCE = /^ *[/]{3} *<reference +types=['"]vite[/]client['"] *[/]> *$/gm;

async function stripBuildReferences() {
  for await (const file of walk(typesDir)) {
    if (!file.endsWith('.d.ts')) continue;
    const text = await readFile(file, 'utf8');
    const stripped = text.replace(VITE_CLIENT_REFERENCE, '');
    if (stripped !== text) await writeFile(file, stripped);
  }
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

// Declarations may keep typeof import('./data.json'); copy those JSON files into the types tree so
// the emitted relative paths stay valid for consumers.
async function copyDeclarationJson() {
  for await (const file of walk(typesDir)) {
    if (!file.endsWith('.d.ts')) continue;
    const sourceDir = path.join(repoRoot, path.relative(typesDir, path.dirname(file)));
    const text = await readFile(file, 'utf8');
    for (const [, specifier] of text.matchAll(/['"]([.][^'"]*[.]json)['"]/g)) {
      const source = path.resolve(sourceDir, specifier);
      if (
        !source.startsWith(repoRoot + path.sep) ||
        rel(source).startsWith('evidence/') ||
        !existsSync(source)
      ) {
        fail(`${rel(file)} references unexpected JSON ${specifier}`);
      }
      const target = path.join(typesDir, path.relative(repoRoot, source));
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
    }
  }
}

// The Outfit OFL notice already ships in src/styles/fonts.css; the copied woff2 files carry it here.
async function writeFontLicense() {
  const source = await readFile(path.join(repoRoot, 'src', 'styles', 'fonts.css'), 'utf8');
  const first = 'Copyright 2021 The Outfit Project Authors';
  const last = 'OTHER DEALINGS IN THE FONT SOFTWARE.';
  const start = source.indexOf(first);
  const end = source.indexOf(last, start);
  if (
    start < 0 ||
    end < 0 ||
    !source.slice(start, end).includes('SIL OPEN FONT LICENSE Version 1.1')
  ) {
    fail('src/styles/fonts.css no longer carries the Outfit OFL notice');
  }
  const notice = source.slice(start, end + last.length);
  await writeFile(
    path.join(distDir, 'LICENSE.fonts'),
    `Outfit variable WOFF2 fonts shipped as dist/assets/outfit-*.woff2.\n\n${notice}\n`,
  );
}

async function copyLicense() {
  const license = await readFile(path.join(repoRoot, 'LICENSE'), 'utf8');
  if (!license.includes('MIT')) fail('root LICENSE is not the MIT license');
  const target = path.join(packageDir, 'LICENSE');
  if (existsSync(target) && (await readFile(target, 'utf8')) !== license) {
    fail('packages/genux/LICENSE differs from the root LICENSE; refusing to overwrite it');
  }
  await writeFile(target, license);
}

async function consumerManifest({ js, css, entries, manifest, toolchain, bundleStyles }) {
  const outputs = js.metafile.outputs;
  const declared = {
    ...manifest.optionalDependencies,
    ...manifest.dependencies,
    ...manifest.peerDependencies,
  };
  const inlineStyles = file =>
    Object.keys(outputs[file].inputs)
      .filter(input => input.startsWith('genux-inline:'))
      .map(input => input.slice('genux-inline:'.length));
  const staticClosure = start => {
    const seen = new Set();
    const pending = [start];
    while (pending.length) {
      const file = pending.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      for (const item of outputs[file].imports) {
        if (!item.external && item.kind === 'import-statement') pending.push(item.path);
      }
    }
    return seen;
  };

  const exports = {};
  const eager = new Set();
  for (const [name, source] of Object.entries(entries)) {
    const output = Object.keys(outputs).find(
      file => file.endsWith('.js') && outputs[file].entryPoint === rel(source),
    );
    if (!output) fail(`no JavaScript output for entry ${name}`);
    const types = path.join(typesDir, rel(source).replace(/[.]tsx?$/, '.d.ts'));
    if (!existsSync(types)) fail(`declaration ${rel(types)} was not emitted`);
    const closure = staticClosure(output);
    closure.forEach(file => eager.add(file));
    const key = name === 'index' ? '.' : `./${name}`;
    exports[key] = {
      types: fromPackage(rel(types)),
      import: fromPackage(output),
      css: outputs[output].cssBundle && fromPackage(outputs[output].cssBundle),
      eagerInlineStyles: [...closure].flatMap(inlineStyles).sort(),
    };
    // package.json is the consumer contract; it must name exactly what this build emitted.
    const { types: declaredTypes, import: declaredImport } = manifest.exports?.[key] ?? {};
    if (declaredTypes !== exports[key].types || declaredImport !== exports[key].import) {
      fail(
        `package.json export ${key} must map types ${exports[key].types} and import ${exports[key].import}`,
      );
    }
  }

  // Chunks outside every entry's static graph load only through literal dynamic imports.
  const chunks = Object.keys(outputs)
    .filter(file => file.endsWith('.js') && !outputs[file].entryPoint)
    .sort()
    .map(file => ({
      file: fromPackage(file),
      loading: eager.has(file) ? 'static' : 'dynamic',
      inlineStyles: inlineStyles(file),
    }));

  const externals = {};
  for (const output of Object.values(outputs)) {
    for (const item of output.imports) {
      if (!item.external) continue;
      const name = packageName(item.path);
      if (!Object.hasOwn(declared, name)) {
        fail(`bundle imports ${item.path}; declare ${name} in packages/genux/package.json`);
      }
      externals[name] ??= { declared: declared[name] };
    }
  }
  for (const name of Object.keys(externals)) {
    const installed = path.join(repoRoot, 'node_modules', name, 'package.json');
    externals[name].observed = existsSync(installed) ? (await readJson(installed)).version : null;
  }

  const styles = fromPackage(rel(path.join(distDir, 'styles.css')));
  for (const key of ['./styles', './styles.css']) {
    if (manifest.exports?.[key] !== styles) fail(`package.json export ${key} must be ${styles}`);
  }
  for (const entry of ['dist', 'LICENSE']) {
    if (!manifest.files?.includes(entry))
      fail(`packages/genux/package.json files must list ${entry}`);
  }
  const allOutputs = [...Object.keys(outputs), ...Object.keys(css.metafile.outputs)];
  return {
    schemaVersion: 1,
    name: manifest.name,
    version: manifest.version,
    generatedBy: 'tools/build-library.mjs',
    toolchain: { node: process.versions.node, ...toolchain },
    exports,
    styles,
    bundleStyles,
    chunks,
    externals: Object.fromEntries(Object.entries(externals).sort(([a], [b]) => a.localeCompare(b))),
    assets: [
      ...new Set(allOutputs.filter(file => !/[.](js|css)$/.test(file)).map(fromPackage)),
    ].sort(),
    licenses: ['./LICENSE', './dist/LICENSE.fonts'],
  };
}

// Shipped files carry no source maps, local paths, Vite-only env reads, Vite/Astro type references or
// text below the 14 CSS px minimum.
async function scanDist() {
  const home = os.homedir();
  const smallText = [];
  for await (const file of walk(distDir)) {
    const name = rel(file);
    if (file.endsWith('.map')) fail(`source map ${name} must not ship`);
    if (!/[.](js|css|json|ts)$|LICENSE/.test(file)) continue;
    const text = await readFile(file, 'utf8');
    if (text.includes(repoRoot) || (home.length > 1 && text.includes(home))) {
      fail(`${name} contains a local absolute path`);
    }
    if (text.includes('sourceMappingURL=')) fail(`${name} references a source map`);
    if (file.endsWith('.js') && text.includes('import.meta.env')) {
      fail(`${name} reads import.meta.env, which only Vite defines`);
    }
    const typeReference = file.endsWith('.d.ts') && text.match(/['"](astro|vite)([:/][^'"]*)?['"]/);
    if (typeReference) fail(`${name} references ${typeReference[1]} types ${typeReference[0]}`);
    if (/[.](js|css)$/.test(file)) {
      for (const [declaration, value, unit] of text.matchAll(SMALL_TEXT)) {
        const px = Number(value) * (unit === 'rem' ? 16 : 1);
        if (px > 0 && px < MIN_TEXT_PX) smallText.push(`${name}: ${declaration}`);
      }
    }
  }
  if (smallText.length) fail(`text below ${MIN_TEXT_PX} CSS px:\n${smallText.join('\n')}`);
}

async function main() {
  assertNode();
  const rootManifest = await readJson(path.join(repoRoot, 'package.json'));
  const manifestFile = path.join(packageDir, 'package.json');
  if (!existsSync(manifestFile)) fail('packages/genux/package.json is missing');
  const manifest = await readJson(manifestFile);
  const toolchain = await assertToolchain(rootManifest);
  const entries = resolveEntries();
  const foundation = await foundationCss();
  await cleanDist();

  const shared = {
    absWorkingDir: repoRoot,
    bundle: true,
    outdir: distDir,
    assetNames: 'assets/[name]-[hash]',
    loader: Object.fromEntries(ASSET_EXTENSIONS.map(ext => [ext, 'file'])),
    sourcemap: false,
    metafile: true,
    charset: 'utf8',
    logLevel: 'warning',
    plugins: [libraryPlugin(foundation), sassPlugin()],
  };
  // Every bare import stays external; consumerManifest proves each one is declared.
  const js = await esbuild.build({
    ...shared,
    entryPoints: entries,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    splitting: true,
    chunkNames: 'chunks/[name]-[hash]',
    packages: 'external',
    jsx: 'automatic',
    tsconfig: path.join(packageDir, 'tsconfig.json'),
    // Optional GenUX asset refs read only BASE_URL, the logical package asset base; scanDist still
    // rejects every other import.meta.env read.
    define: { 'import.meta.env.BASE_URL': JSON.stringify('/') },
  });
  const css = await esbuild.build({
    ...shared,
    entryPoints: { styles: path.join(srcDir, 'styles.css') },
  });
  if (!css.metafile.outputs[rel(path.join(distDir, 'styles.css'))])
    fail('dist/styles.css was not emitted');
  checkBaseInputs(js.metafile, entries.index);
  checkStyleInputs(js.metafile, false);
  checkStyleInputs(css.metafile, true);
  checkSideEffects(manifest);
  const bundleStyles = await deliverBundleCss(js.metafile, entries);

  await emitDeclarations();
  await stripBuildReferences();
  await copyDeclarationJson();
  await writeFontLicense();
  await copyLicense();
  const consumer = await consumerManifest({ js, css, entries, manifest, toolchain, bundleStyles });
  await writeFile(path.join(distDir, 'consumer.json'), `${JSON.stringify(consumer, null, 2)}\n`);
  await scanDist();
  console.log(
    `genux library: ${Object.keys(consumer.exports).length} entries, ${consumer.chunks.length} chunks, externals ${Object.keys(consumer.externals).join(', ')}`,
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
