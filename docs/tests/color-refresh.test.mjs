import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { generate } from '@ant-design/colors';

const compiled = await build({
  stdin: {
    contents: `export * from './docs/src/data/button-palette';
export * from './docs/src/data/color-system';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node24',
});
const color = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64')
);

test('Button families inherit all Color preset identities and official seed roles', () => {
  assert.equal(color.buttonColorPresets.length, 24);
  assert.deepEqual(
    color.buttonColorPresets.map(value => value.value),
    color.COLOR_PRESETS.map(value => value.id),
  );
  for (const preset of color.buttonColorPresets) {
    const tones = generate(preset.color);
    assert.equal(preset.dark, tones[6], preset.value);
    assert.equal(preset.tint, tones[0], preset.value);
    assert.ok(color.contrastRatio(preset.color, preset.ink) >= 4.5, preset.value);
  }
  assert.equal(color.buttonPresetTone('violet-magenta', 'middle'), undefined);
  assert.equal(
    color.tokenColorPresets.some(p => p.value === 'violet-magenta'),
    false,
  );
  const lime = color.buttonColorPresets.find(preset => preset.value === 'lime');
  assert.equal(lime.color, '#B3E61A', 'hue presets use the requested exact 10/10 composition');
  assert.equal(color.buttonPresetTone('lime', 'middle'), lime);
  const limeTones = generate(lime.color);
  for (const [tone, index] of [
    ['dark', 6],
    ['light', 3],
    ['pastel', 0],
  ]) {
    const toned = color.buttonPresetTone('lime', tone);
    assert.equal(toned.color, limeTones[index]);
    assert.ok(color.contrastRatio(toned.color, toned.ink) >= 4.5, tone);
  }
  assert.equal(color.buttonPresetTone('unknown', 'middle'), undefined);
  const red = color.buttonColorPresets.find(preset => preset.value === 'red');
  const repeat = color.buttonColorPresets.find(preset => preset.value === 'red-repeat');
  assert.equal(red.color, repeat.color, 'duplicate red keeps its source identity');
});

test('Design tokens include Purple in the complete shared Color-system order', () => {
  assert.equal(color.tokenColorPresets.length, 24);
  assert.deepEqual(color.tokenColorPresets, color.buttonColorPresets);
  const purpleIndex = color.tokenColorPresets.findIndex(preset => preset.value === 'purple');
  assert.deepEqual(
    color.tokenColorPresets.slice(purpleIndex - 1, purpleIndex + 2).map(preset => preset.value),
    ['violet', 'purple', 'magenta'],
  );
  const purple = color.tokenColorPresets[purpleIndex];
  const source = color.COLOR_PRESETS.find(preset => preset.id === 'purple');
  assert.equal(purple.label, source.name);
  assert.equal(purple.color, color.hwbToHex(source.h, 10, 10));
  assert.equal(purple.dark, generate(purple.color)[6]);
});

test('neutral Color presets retain distinct gray, warm-black and cool-black compositions', () => {
  const neutrals = color.buttonColorPresets.filter(
    preset => preset.value.startsWith('grey') || preset.value.startsWith('black'),
  );
  assert.equal(neutrals.length, 6);
  assert.equal(new Set(neutrals.map(preset => preset.color)).size, 6);
  for (const neutral of neutrals) {
    const source = color.COLOR_PRESETS.find(preset => preset.id === neutral.value);
    assert.equal(
      neutral.color,
      color.hwbToHex(source.h, source.w * 0.8 + 10, source.b * 0.8 + 10),
      neutral.value,
    );
    if (source.id.startsWith('grey')) {
      const [r, g, b] = color.hexToRgb(neutral.color);
      assert.equal(r, g, neutral.value);
      assert.equal(g, b, neutral.value);
    }
  }
});
