import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/model/decisions.js', import.meta.url), 'utf8');
const data = JSON.parse(
  vm.runInNewContext(
    source +
      '\nJSON.stringify({decisions:BUTTON_DECISIONS,experiments:BUTTON_EXPERIMENTS,variants:BUTTON_VARIANTS})',
  ),
);
const values = items => items?.map(item => item.value);

test('approved Button visuals contain exactly the screenshot axes and the separate 8px layer', () => {
  assert.deepEqual(values(data.decisions.fill_variants), [
    'solid',
    'outline',
    'tint',
    'text',
    'link',
  ]);
  assert.deepEqual(values(data.decisions.palette_variants), [
    'violet',
    'blue',
    'teal',
    'moss',
    'clay',
    'coral',
    'amber',
    'graphite',
  ]);
  assert.deepEqual(values(data.decisions.tone_variants), ['dark', 'middle', 'light', 'pastel']);
  assert.deepEqual(values(data.decisions.shadow_variants), [
    'none',
    'soft',
    'ambient',
    'longFlat',
    'layeredFlat',
    'layeredFlat8',
  ]);
  assert.deepEqual(data.decisions.duration_variants, [
    { value: 'deliberate', label: '500 ms / deliberate', duration_ms: 500 },
  ]);
  assert.deepEqual(values(data.decisions.radius_variants), ['0', '3', '5', 'pill']);
  const layered = data.decisions.shadow_variants.find(item => item.value === 'layeredFlat8');
  assert.equal(layered.css, 'var(--shadow-layered-flat-8)');
  assert.equal(layered.pressed_css, 'var(--shadow-layered-pressed-8)');
  assert.equal(layered.max_offset_px, 8);
});

test('promoted tones and shadows have one owner while historical compatibility order survives', () => {
  assert.deepEqual(values(data.experiments.tone_variants), []);
  assert.deepEqual(values(data.experiments.shadow_variants), [
    'contact',
    'diffuse',
    'raised',
    'antd',
    'flatLayer',
  ]);
  for (const key of ['tone', 'shadow']) {
    const approved = new Set(values(data.decisions[`${key}_variants`]));
    for (const item of data.experiments[`${key}_variants`]) assert.ok(!approved.has(item.value));
  }
  assert.deepEqual(values(data.variants.tone), ['dark', 'middle', 'light', 'pastel']);
  assert.deepEqual(values(data.variants.shadow), [
    'none',
    'contact',
    'soft',
    'ambient',
    'diffuse',
    'raised',
    'antd',
    'flatLayer',
    'longFlat',
    'layeredFlat',
  ]);
  assert.deepEqual(values(data.experiments.duration_variants), [
    'instant',
    'quick',
    'normal',
    'slow',
  ]);
});
