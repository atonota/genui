import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = (await readdir(resolve(root, 'docs/tests')))
  .filter(name => name.endsWith('.test.mjs') && name !== 'site.test.mjs')
  .sort()
  .map(name => `docs/tests/${name}`);
if (process.argv.includes('--list')) console.log(files.join('\n'));
else {
  const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
