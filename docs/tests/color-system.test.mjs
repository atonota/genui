import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { generate } from '@ant-design/colors';

const compiled = await build({
  entryPoints: ['docs/src/data/color-system.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node24',
});
const color = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64')
);

test('HWB conversion preserves the chosen sRGB HEX without historical web-safe quantization', () => {
  for (const [h, w, b, expected] of [
    [0, 0, 0, '#FF0000'],
    [60, 0, 0, '#FFFF00'],
    [120, 0, 0, '#00FF00'],
    [180, 0, 0, '#00FFFF'],
    [240, 0, 0, '#0000FF'],
    [300, 0, 0, '#FF00FF'],
    [360, 0, 0, '#FF0000'],
    [-60, 0, 0, '#FF00FF'],
    [214, 100, 0, '#FFFFFF'],
    [214, 0, 100, '#000000'],
    [179.6, 30.3, 50, '#4D807F'],
  ]) {
    assert.equal(color.hwbToHex(h, w, b), expected);
  }
  const output = color.convertColorSelection({
    ...color.DEFAULT_COLOR_SELECTION,
    anchor: 179.6,
    w: 30.3,
    b: 50,
  });
  assert.equal(output.rawHex, '#4D807F');
  assert.equal(output.rawHex, output.seedHex);
  assert.deepEqual(output.rawRgb, [77, 128, 127]);
  assert.deepEqual(output.seedRgb, output.rawRgb);
  assert.notEqual(output.rawHex, '#669966');
});

test('W and B remain independent while only the effective composition is normalized', () => {
  const input = { ...color.DEFAULT_COLOR_SELECTION, w: 80, b: 80 };
  const output = color.convertColorSelection(input);
  assert.equal(input.w, 80);
  assert.equal(input.b, 80);
  assert.equal(output.rawHex, '#808080');
  assert.equal(output.effectiveW, 50);
  assert.equal(output.effectiveB, 50);
  assert.equal(output.pureShare, 0);
  assert.equal(output.normalized, true);
  assert.equal(output.achromatic, true);
  assert.equal(color.convertColorSelection({ ...input, anchor: 30 }).rawHex, output.rawHex);
  const boundary = color.convertColorSelection({ ...input, w: 20, b: 80 });
  assert.equal(boundary.rawHex, '#333333');
  assert.equal(boundary.normalized, false);
  assert.equal(boundary.achromatic, true);
  assert.equal(boundary.effectiveW + boundary.effectiveB + boundary.pureShare, 100);
});

test('fine Hue preserves its fixed 72-degree window and wraps across zero', () => {
  const initial = { ...color.DEFAULT_COLOR_SELECTION, anchor: 5 };
  const wrapped = color.setFineOffset(initial, -10);
  assert.equal(wrapped.anchor, 5);
  assert.equal(color.convertColorSelection(wrapped).h, 355);
  assert.equal(wrapped.offset, -10);
  const segments = color.hueWindowSegments(initial.anchor);
  assert.equal(segments.length, 2);
  assert.ok(Math.abs(segments.reduce((total, segment) => total + segment.width, 0) - 20) < 1e-10);
  const inside = color.setFineHue(initial, 355);
  assert.equal(inside.recentered, false);
  assert.equal(inside.state.anchor, 5);
  assert.equal(inside.state.offset, -10);
  const outside = color.setFineHue(initial, 80);
  assert.equal(outside.recentered, true);
  assert.equal(outside.state.anchor, 80);
  assert.equal(outside.state.offset, 0);
  assert.equal(color.setMainHue(wrapped, 210).offset, 0);
  assert.equal(initial.offset, 0, 'updates must not mutate their input');
});

test('method switches preserve all selection values and reset preserves the selected method', () => {
  const selected = color.setFineOffset(
    color.applyColorPreset(color.DEFAULT_COLOR_SELECTION, 'blue'),
    8.4,
  );
  const switched = color.setSelectionMethod(selected, 'presets');
  assert.deepEqual({ ...switched, selectionMode: selected.selectionMode }, selected);
  assert.equal(
    color.convertColorSelection(switched).seedHex,
    color.convertColorSelection(selected).seedHex,
  );
  assert.deepEqual(color.resetColorSelection(switched), {
    ...color.DEFAULT_COLOR_SELECTION,
    selectionMode: 'presets',
  });
  assert.equal(color.setPreviewTheme(switched, 'dark').mode, 'dark');
});

test('all 24 presets retain their source order, values and separate repeated-red identity', () => {
  assert.deepEqual(
    color.COLOR_PRESETS.map(preset => preset.id),
    [
      'red',
      'red-orange',
      'orange',
      'orange-yellow',
      'yellow',
      'lime',
      'yellow-green',
      'green',
      'green-cyan',
      'cyan',
      'cyan-blue',
      'blue',
      'blue-violet',
      'violet',
      'purple',
      'magenta',
      'magenta-red',
      'red-repeat',
      'grey1',
      'grey2',
      'grey3',
      'black1',
      'black2',
      'black3',
    ],
  );
  assert.deepEqual(
    color.COLOR_PRESETS.map(preset => preset.hex),
    [
      '#E01F1F',
      '#E04F1F',
      '#E0801F',
      '#E0B01F',
      '#E0E01F',
      '#B0E01F',
      '#80E01F',
      '#1FE01F',
      '#1FE080',
      '#1FE0E0',
      '#1F80E0',
      '#1F1FE0',
      '#4F1FE0',
      '#801FE0',
      '#A41FB8',
      '#E01FE0',
      '#E01F80',
      '#E01F1F',
      '#D6D6D6',
      '#8F8F8F',
      '#525252',
      '#19140F',
      '#0F1319',
      '#000000',
    ],
  );
  const repeated = color.applyColorPreset(color.DEFAULT_COLOR_SELECTION, 'red-repeat');
  assert.equal(color.presetStatus(repeated).origin.id, 'red-repeat');
  assert.equal(color.presetStatus(repeated).exact.id, 'red-repeat');
  const modified = color.setColorChannel(repeated, 'w', 13);
  assert.equal(color.presetStatus(modified).origin.id, 'red-repeat');
  assert.equal(color.presetStatus(modified).modified, true);
  assert.equal(color.setMainHue(modified, 1).presetId, null);
  assert.equal(color.setFineOffset(modified, 1).presetId, null);
  assert.ok(Object.isFrozen(color.COLOR_PRESETS));
  assert.ok(color.COLOR_PRESETS.every(Object.isFrozen));
  assert.throws(() => color.applyColorPreset(repeated, 'toString'));
  const grey = color.COLOR_PRESETS.find(preset => preset.id === 'grey3');
  for (const id of ['black1', 'black2'])
    assert.ok(
      color.relativeLuminance(grey.hex) >
        color.relativeLuminance(color.COLOR_PRESETS.find(p => p.id === id).hex),
    );
});

test('validation rejects nonfinite, coercible and out-of-range inputs without silently clamping settings', () => {
  for (const invalid of [null, [], {}, 'settings'])
    assert.throws(() => color.validateColorSelection(invalid));
  for (const key of ['anchor', 'offset', 'w', 'b']) {
    for (const invalid of [NaN, Infinity, -Infinity, '10', undefined, null])
      assert.throws(() =>
        color.validateColorSelection({ ...color.DEFAULT_COLOR_SELECTION, [key]: invalid }),
      );
  }
  for (const [key, invalid] of [
    ['anchor', -1],
    ['anchor', 361],
    ['offset', -36.1],
    ['offset', 36.1],
    ['w', -0.1],
    ['w', 100.1],
    ['b', -0.1],
    ['b', 100.1],
  ])
    assert.throws(() =>
      color.validateColorSelection({ ...color.DEFAULT_COLOR_SELECTION, [key]: invalid }),
    );
  for (const patch of [{ mode: 'sepia' }, { selectionMode: 'custom' }, { presetId: 'unknown' }])
    assert.throws(() =>
      color.validateColorSelection({ ...color.DEFAULT_COLOR_SELECTION, ...patch }),
    );
  assert.throws(() => color.rgbToHex([0, 1]));
  assert.throws(() => color.rgbToHex([0, Infinity, 1]));
  assert.throws(() => color.hexToRgb('#fff'));
  const rounded = color.validateColorSelection({
    ...color.DEFAULT_COLOR_SELECTION,
    anchor: 214.14,
  });
  assert.equal(rounded.anchor, 214.1);
});

test('schema 4 export roundtrips and legacy imports recalculate rather than trusting derived colors', () => {
  const selected = color.setColorChannel(
    color.applyColorPreset(color.DEFAULT_COLOR_SELECTION, 'purple'),
    'w',
    24.2,
  );
  const exported = color.exportColorSelection(selected, { colorPrimary: '#123456' });
  assert.equal(exported.schemaVersion, 4);
  assert.equal(exported.pipeline.transferPolicy, 'direct-srgb-hex');
  assert.equal(exported.pipeline.webSafeQuantization, false);
  assert.equal(exported.pipeline.rawHex, exported.pipeline.seedHex);
  assert.equal(exported.antDesign.theme.token.colorPrimary, exported.pipeline.seedHex);
  assert.deepEqual(color.importColorSelection(JSON.stringify(exported)), selected);
  for (const schemaVersion of [1, 2, 3, 4]) {
    const settings = { anchor: 179.6, offset: 0, w: 30.3, b: 50, mode: 'dark' };
    const imported = color.importColorSelection({
      format: 'hwb-ant-design-controller',
      schemaVersion,
      settings,
      pipeline: { rawHex: '#669966', seedHex: '#669966' },
    });
    assert.equal(imported.selectionMode, 'detailed');
    assert.equal(imported.presetId, null);
    assert.equal(color.convertColorSelection(imported).seedHex, '#4D807F');
  }
  const brown = color.importColorSelection({
    format: 'hwb-ant-design-controller',
    schemaVersion: 2,
    settings: { anchor: 30, offset: 0, w: 16, b: 50, mode: 'light', presetId: 'brown' },
  });
  assert.equal(color.presetStatus(brown).origin.id, 'brown');
  assert.equal(
    color.COLOR_PRESETS.some(preset => preset.id === 'brown'),
    false,
  );
  for (const source of [
    '{',
    JSON.stringify({ ...exported, schemaVersion: 5 }),
    JSON.stringify({ ...exported, schemaVersion: '4' }),
    JSON.stringify({ ...exported, format: 'unrelated' }),
    JSON.stringify({ ...exported, settings: null }),
    ' '.repeat(color.MAX_COLOR_SETTINGS_BYTES + 1),
  ])
    assert.throws(() => color.importColorSelection(source));
  const polluted = color.importColorSelection(
    JSON.stringify({
      ...exported,
      settings: { ...selected, unrelated: 'ignored', __proto__: { malicious: true } },
    }),
  );
  assert.deepEqual(polluted, selected);
  assert.equal(Object.hasOwn(polluted, 'unrelated'), false);
});

test('official Ant Design light and dark palettes are returned unchanged', () => {
  for (const seed of ['#4D807F', '#000000', '#FFFFFF', '#E01F1F']) {
    assert.deepEqual(color.generateColorPalette(seed, 'light'), generate(seed));
    assert.deepEqual(
      color.generateColorPalette(seed, 'dark'),
      generate(seed, { theme: 'dark', backgroundColor: '#141414' }),
    );
    assert.deepEqual(
      color.generateColorPalette(seed, 'dark', '#222222'),
      generate(seed, { theme: 'dark', backgroundColor: '#222222' }),
    );
  }
  assert.throws(() => color.generateColorPalette('#ff0000', 'unknown'));
});

test('contrast and RGB roundtrip retain measurable pairs without modifying the seed', () => {
  assert.equal(color.contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(color.contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  assert.equal(color.contrastInk('#FFFF00'), '#000000');
  assert.equal(color.contrastInk('#0000FF'), '#FFFFFF');
  for (const hex of ['#000000', '#FFFFFF', '#4D807F', '#123456', '#FF00FF']) {
    const hwb = color.hexToHwb(hex, 214);
    assert.equal(color.hwbToHex(hwb.h, hwb.w, hwb.b), hex);
  }
});

test('removed violet-magenta cannot be selected and old selections retain their exact custom color', () => {
  assert.equal(
    color.COLOR_PRESETS.some(p => p.id === 'violet-magenta'),
    false,
  );
  assert.throws(() => color.applyColorPreset(color.DEFAULT_COLOR_SELECTION, 'violet-magenta'));
  const old = {
    anchor: 285,
    offset: -4.8,
    w: 37.4,
    b: 15.5,
    mode: 'dark',
    selectionMode: 'presets',
    presetId: 'violet-magenta',
  };
  const expected = { ...old, presetId: null };
  assert.deepEqual(color.validateColorSelection(old), expected, 'local storage restores as custom');
  const hex = color.hwbToHex(280.2, 37.4, 15.5);
  for (const schemaVersion of [1, 2, 3, 4]) {
    const imported = color.importColorSelection({
      format: color.COLOR_SETTINGS_FORMAT,
      schemaVersion,
      settings: old,
    });
    assert.deepEqual(imported, expected);
    assert.equal(color.convertColorSelection(imported).seedHex, hex);
    assert.equal(color.presetStatus(imported).origin, null);
    const exported = color.exportColorSelection(imported);
    assert.equal(exported.selection.presetCatalogVersion, 3);
    assert.equal(exported.settings.presetId, null);
    assert.equal(JSON.stringify(exported).includes('violet-magenta'), false);
  }
  assert.throws(() => color.validateColorSelection({ ...old, presetId: 'unrecognized-color' }));
});
