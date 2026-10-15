import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import vm from 'node:vm';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const read = path => readFile(resolve(root, path), 'utf8');

// Source order is a contract: one offline classic script, no browser import loader.
export async function render() {
  const manifest = JSON.parse(await read('build-order.json'));
  for (const asset of [...manifest.assets, manifest.vendor]) {
    const bytes = await readFile(resolve(root, asset.path));
    if (sha256(bytes) !== asset.sha256) throw new Error(`Asset changed: ${asset.path}`);
  }
  let css = (await Promise.all(manifest.css.map(read))).join('');
  for (const asset of manifest.assets) {
    const name = asset.path.split('/').at(-1);
    css = css.replace(
      `@@FONT:${name}@@`,
      (await readFile(resolve(root, asset.path))).toString('base64'),
    );
  }
  const script = (await Promise.all(manifest.js.map(read))).join('');
  new vm.Script(script, { filename: 'atlas.generated.js' });
  if (/<\/script\s*>/i.test(script) || /<\/style\s*>/i.test(css))
    throw new Error('Unsafe inline closing tag');
  const template = await read('src/document.html');
  const translations = JSON.stringify(JSON.parse(await read('src/i18n/tr.json')))
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  for (const token of ['@@ATLAS:CSS@@', '@@ATLAS:JS@@', '@@ATLAS:I18N@@']) {
    if (template.split(token).length !== 2) throw new Error(`Expected exactly one ${token}`);
  }
  // Function replacements preserve literal $& / $` / $' inside vendored JS.
  const html = template
    .replace('@@ATLAS:CSS@@', () => css)
    .replace('@@ATLAS:JS@@', () => script)
    .replace('@@ATLAS:I18N@@', () => translations);
  if (/@@(?:ATLAS|FONT):/.test(html)) throw new Error('Unresolved build token');
  return { html, css, script, manifest };
}

export async function build() {
  const result = await render();
  await mkdir(resolve(root, 'dist'), { recursive: true });
  await writeFile(resolve(root, 'dist/buton-atlasi.html'), result.html);
  return { bytes: Buffer.byteLength(result.html), sha256: sha256(result.html) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await build()));
