import { open, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { render, root, sha256 } from './build.mjs';

export async function atomicWrite(path, bytes, check = async () => {}) {
  const staging = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(staging, bytes, { flag: 'wx' });
    await check();
    await rename(staging, path);
  } finally {
    await rm(staging, { force: true });
  }
}

// Only the explicit CLI invocation writes to the user's existing standalone file.
export async function sync({
  statePath = resolve(root, 'evidence/sync-state.json'),
  output = async () => Buffer.from((await render()).html),
  writeState = state => atomicWrite(statePath, JSON.stringify(state, null, 2) + '\n'),
} = {}) {
  const lockPath = statePath + '.lock';
  const lock = await open(lockPath, 'wx').catch(error => {
    if (error.code === 'EEXIST')
      throw new Error(
        'Sync already locked; inspect the recorded PID before recovering an abandoned lock.',
      );
    throw error;
  });
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }) + '\n');
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    const actualSha = sha256(await readFile(state.path));
    // A previous replacement may have succeeded while its final state write failed.
    if (state.pending_sha256 === actualSha) state.sha256 = actualSha;
    if (actualSha !== state.sha256)
      throw new Error('Standalone changed externally; reconcile it before syncing.');
    const bytes = await output(),
      nextSha = sha256(bytes);
    await writeState({ ...state, pending_sha256: nextSha });
    await atomicWrite(state.path, bytes, async () => {
      if (sha256(await readFile(state.path)) !== actualSha)
        throw new Error('Standalone changed during sync.');
    });
    await writeState({ path: state.path, sha256: nextSha });
    return { path: state.path, bytes: bytes.length, sha256: nextSha };
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await sync()));
