import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, sha256 } from './build.mjs';

// Two verified upstream declaration collisions; no JS/runtime edits, no check suppression.
// Validate the complete patch set before writing. Dependency updates must fail closed.
const patches = JSON.parse(await readFile(resolve(root, 'patches/antd-declarations.json'), 'utf8'));
const writes = [];
for (const patch of patches) {
  const pkg = JSON.parse(
    await readFile(resolve(root, `node_modules/${patch.package}/package.json`), 'utf8'),
  );
  if (pkg.version !== patch.version)
    throw new Error(`Re-review declaration patch for ${patch.package}@${pkg.version}`);
  const file = resolve(root, patch.path),
    source = await readFile(file, 'utf8');
  if (sha256(source) === patch.after_sha256) continue;
  if (sha256(source) !== patch.before_sha256 || source.split(patch.old).length !== 2)
    throw new Error(`Declaration drift: ${patch.path}`);
  const next = source.replace(patch.old, () => patch.new);
  if (sha256(next) !== patch.after_sha256) throw new Error(`Invalid patch: ${patch.path}`);
  writes.push({ file, next });
}
for (const { file, next } of writes) await writeFile(file, next);
console.log(JSON.stringify({ declaration_files_patched: writes.length, runtime_changes: 0 }));
