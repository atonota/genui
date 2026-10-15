import { writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { root } from './build.mjs';

const bundled = await build({
  entryPoints: [resolve(root, 'docs/src/data/catalog.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { components } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
);
const dir = resolve(root, 'docs/.checks');
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
let count = 0;
for (const component of components)
  for (const example of component.examples) {
    if (!/^[a-z-]+$/.test(component.slug) || !/^[a-z-]+$/.test(example.id))
      throw new Error('Unsafe snippet path');
    await writeFile(resolve(dir, `${component.slug}-${example.id}.tsx`), example.code + '\n');
    count++;
  }
console.log(`${count} documentation TSX snippets prepared for strict type checking.`);
