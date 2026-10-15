import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('six hue-offset previews inherit one effective composition without changing raw seed identity', async () => {
  const compiled = await build({
    stdin: {
      contents:
        "export * from './docs/src/data/color-preview';export * from './docs/src/data/color-system';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    packages: 'external',
    format: 'esm',
    platform: 'node',
  });
  // A file-backed module resolves installed external AntD consistently with the app.
  const { writeFile, unlink } = await import('node:fs/promises');
  const path = new URL('./.color-preview-model.mjs', import.meta.url);
  await writeFile(path, compiled.outputFiles[0].contents);
  try {
    const m = await import(path.href);
    const selection = { ...m.DEFAULT_COLOR_SELECTION, anchor: 350, offset: 0, w: 75, b: 5 };
    const families = m.colorPreviewFamilies(selection);
    assert.equal(families.length, 6);
    assert.deepEqual(
      families.map(f => f.variableKey),
      m.colorFamilyVariableKeys,
    );
    assert.equal(new Set(m.colorFamilyVariableKeys).size, 6);
    assert.equal(families[0].seedHex, m.convertColorSelection(selection).seedHex);
    assert.equal(new Set(families.map(f => f.seedHex)).size, 6);
    for (const family of families) assert.equal(family.seedHex, m.hwbToHex(family.hue, 75, 5));
    const normalized = m.colorPreviewFamilies({ ...selection, w: 80, b: 80 });
    assert.equal(
      new Set(normalized.map(f => f.seedHex)).size,
      1,
      'achromatic composition remains truthful',
    );
  } finally {
    await unlink(path);
  }
});
