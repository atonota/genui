import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sync, atomicWrite } from '../tools/sync.mjs';
import { sha256 } from '../tools/build.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'genux-sync-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'existing.html'),
    statePath = join(dir, 'sync-state.json');
  const state = { path, sha256: sha256('before') };
  await writeFile(path, 'before');
  await writeFile(statePath, JSON.stringify(state));
  return { dir, path, statePath, output: async () => Buffer.from('after') };
}

test('sync refuses an external edit and leaves user bytes intact', async t => {
  const f = await fixture(t);
  await writeFile(f.path, 'external');
  await assert.rejects(sync(f), /changed externally/);
  assert.equal(await readFile(f.path, 'utf8'), 'external');
  assert.equal(
    (await readdir(f.dir)).some(name => name.endsWith('.tmp') || name.endsWith('.lock')),
    false,
  );
});

test('simultaneous sync has one writer and cannot share staging output', async t => {
  const f = await fixture(t);
  let release, entered;
  const started = new Promise(resolve => (entered = resolve));
  const blocked = new Promise(resolve => (release = resolve));
  const first = sync({
    ...f,
    output: async () => {
      entered();
      await blocked;
      return Buffer.from('first');
    },
  });
  await started;
  await assert.rejects(sync({ ...f, output: async () => Buffer.from('second') }), /already locked/);
  release();
  await first;
  assert.equal(await readFile(f.path, 'utf8'), 'first');
  assert.equal(JSON.parse(await readFile(f.statePath, 'utf8')).sha256, sha256('first'));
});

test('completed replacement recovers after final state write failure', async t => {
  const f = await fixture(t);
  let count = 0;
  await assert.rejects(
    sync({
      ...f,
      writeState: async state => {
        if (++count === 2) throw new Error('state disk failure');
        await atomicWrite(f.statePath, JSON.stringify(state));
      },
    }),
    /state disk failure/,
  );
  assert.equal(await readFile(f.path, 'utf8'), 'after');
  await sync(f);
  const state = JSON.parse(await readFile(f.statePath, 'utf8'));
  assert.deepEqual(state, { path: f.path, sha256: sha256('after') });
});

test('an external edit during staging is preserved and temporary files are cleaned', async t => {
  const f = await fixture(t);
  await assert.rejects(
    sync({
      ...f,
      writeState: async state => {
        await atomicWrite(f.statePath, JSON.stringify(state));
        await writeFile(f.path, 'concurrent external');
      },
    }),
    /changed during sync/,
  );
  assert.equal(await readFile(f.path, 'utf8'), 'concurrent external');
  assert.equal(
    (await readdir(f.dir)).some(name => name.endsWith('.tmp') || name.endsWith('.lock')),
    false,
  );
});
