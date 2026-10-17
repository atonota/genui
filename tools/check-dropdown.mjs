import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = join(root, 'src/vendor');
const banner =
  '/*! GenUX dropdown adapter. Zag.js 1.46.0 and dependencies; third-party MIT licenses embedded below. */';
// The HTML extraction retained this host comment outside the original bundle.
const wrapper = '\n/* Offline headless dropdown: Zag 1.46.0; MIT notices retained below. */\n';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));

function equalBytes(actual, expected, label) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.equals(b)) return;
  let offset = 0;
  while (offset < Math.min(a.length, b.length) && a[offset] === b[offset]) offset++;
  throw new Error(
    label +
      ' differs at byte ' +
      offset +
      '; actual=' +
      a.length +
      '/' +
      sha256(a) +
      ', expected=' +
      b.length +
      '/' +
      sha256(b) +
      '. References were not updated.',
  );
}

function packageDirectory(input) {
  const normalized = input.split(sep).join('/');
  const marker = normalized.lastIndexOf('node_modules/');
  assert.notEqual(marker, -1, 'Unexpected bundled source: ' + input);
  const parts = normalized.slice(marker + 'node_modules/'.length).split('/');
  const count = parts[0].startsWith('@') ? 2 : 1;
  return normalized.slice(0, marker) + 'node_modules/' + parts.slice(0, count).join('/');
}

async function check() {
  const [provenance, lock, project, retained, retainedLicenses] = await Promise.all([
    json(join(vendor, 'provenance.json')),
    json(join(root, 'package-lock.json')),
    json(join(root, 'package.json')),
    readFile(join(vendor, 'dropdowns.js'), 'utf8'),
    readFile(join(vendor, 'THIRD-PARTY-LICENSES.txt'), 'utf8'),
  ]);
  assert.equal(esbuildVersion, '0.28.2', 'Installed esbuild version drifted');
  assert.equal(project.devDependencies.esbuild, esbuildVersion, 'esbuild must be pinned');
  assert.equal(provenance.esbuild, esbuildVersion, 'Original esbuild recipe differs');
  assert.ok(retained.startsWith(wrapper + banner + '\n'), 'Vendor wrapper/banner changed');
  const original = retained.slice(wrapper.length);
  assert.equal(Buffer.byteLength(original), provenance.output.bytes, 'Retained byte count changed');
  assert.equal(sha256(original), provenance.output.sha256, 'Retained bundle hash changed');

  // Same IIFE/global/minifier/target/legal-comment recipe as the original build.
  // write:false produces no output files and never updates the retained bundle.
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['src/vendor/adapter.mjs'],
    outfile: 'genux-dropdowns.min.js',
    bundle: true,
    format: 'iife',
    globalName: 'GenUXDropdowns',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
    metafile: true,
    legalComments: 'eof',
    banner: { js: banner },
    write: false,
  });
  assert.equal(result.outputFiles.length, 1, 'Unexpected build outputs');
  const packages = new Map();
  for (const input of Object.keys(result.metafile.inputs)) {
    if (resolve(root, input) === join(vendor, 'adapter.mjs')) continue;
    const directory = resolve(root, packageDirectory(input));
    const pkg = await json(join(directory, 'package.json'));
    assert.ok(
      !packages.has(pkg.name) || packages.get(pkg.name).directory === directory,
      'Multiple bundled copies of ' + pkg.name,
    );
    packages.set(pkg.name, { directory, pkg });
  }
  assert.deepEqual(
    [...packages.keys()].sort(),
    provenance.packages.map(pkg => pkg.name).sort(),
    'Bundled package graph changed',
  );
  const notices = [];
  for (const name of [...packages.keys()].sort()) {
    const { directory, pkg } = packages.get(name);
    const expected = provenance.packages.find(item => item.name === name);
    const key = relative(root, directory).split(sep).join('/');
    const installedLock = lock.packages[key];
    assert.ok(installedLock, 'Missing lock record for ' + name);
    for (const field of ['version', 'license'])
      assert.equal(pkg[field], expected[field], name + ' installed ' + field + ' drifted');
    for (const field of ['version', 'license', 'resolved', 'integrity'])
      assert.equal(installedLock[field], expected[field], name + ' lock ' + field + ' drifted');
    assert.equal(expected.license, 'MIT', 'Unexpected license for ' + name);
    assert.ok(expected.integrity.startsWith('sha512-'), 'Missing package integrity for ' + name);
    const license = await readFile(join(directory, 'LICENSE'), 'utf8');
    notices.push(name + ' ' + pkg.version + '\n' + license);
  }
  const licenseText = notices.join('\n\n----------------------------------------\n\n');
  equalBytes(licenseText, retainedLicenses, 'License graph');
  // Original recipe appended these complete notices after esbuild legalComments.
  const generated =
    result.outputFiles[0].text + '\n/*!\n' + licenseText.replace(/\*\//g, '* /') + '\n*/\n';
  equalBytes(generated, original, 'Rebuilt bundle');
  equalBytes(wrapper + generated, retained, 'Wrapped vendor bundle');
  return {
    status: 'pass',
    esbuild: esbuildVersion,
    packages: packages.size,
    bundle_bytes: Buffer.byteLength(generated),
    bundle_sha256: sha256(generated),
    wrapper_bytes: Buffer.byteLength(wrapper),
    vendor_sha256: sha256(retained),
    integrity_scope:
      'Installed package versions/licenses and lock integrity match original provenance; no tarballs fetched.',
    writes: false,
    browser: 'not_run',
  };
}

try {
  console.log(JSON.stringify(await check(), null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'fail', message: error.message, writes: false }, null, 2));
  process.exitCode = 1;
}
