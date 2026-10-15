import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mountPattern } from './harness.mjs';

test('current and saved retired selections restore without blocking other saved colors', async t => {
  const file = `docs/tests/.color-retired-${randomUUID()}.tsx`;
  const retired = {
    anchor: 285,
    offset: 0,
    w: 12,
    b: 12,
    mode: 'dark',
    selectionMode: 'presets',
    presetId: 'violet-magenta',
  };
  const other = {
    anchor: 60,
    offset: 0,
    w: 15,
    b: 15,
    mode: 'light',
    selectionMode: 'presets',
    presetId: 'yellow',
  };
  await writeFile(
    file,
    `import Demo from '../src/react/color/ColorSystemDemo';
window.localStorage.setItem('hwb-ant-controller-v1', ${JSON.stringify(JSON.stringify(retired))});
window.localStorage.setItem('hwb-ant-controller-saved-v1', ${JSON.stringify(JSON.stringify([retired, other]))});
export default Demo;`,
  );
  let h;
  try {
    h = await mountPattern('default', file);
  } catch (error) {
    await unlink(file);
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  const radios = [...h.document.querySelectorAll('.color-presets input')];
  assert.equal(radios.length, 24);
  assert.equal(
    radios.some(e => e.value === 'violet-magenta'),
    false,
  );
  assert.equal(h.document.querySelector('[data-color-hex]').textContent, '#B01FE0');
  const saved = [...h.document.querySelectorAll('[data-saved-load]')];
  assert.equal(saved.length, 2);
  await h.click(saved[1]);
  assert.equal(h.document.querySelector('[data-color-hex]').textContent, '#D9D926');
  await h.click(saved[0]);
  assert.equal(h.document.querySelector('[data-color-hex]').textContent, '#B01FE0');
});
