import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import postcss from 'postcss';
import { build } from 'esbuild';
import { mountPattern } from './harness.mjs';

test('all documentation preset text/link inks remain readable on actual transparent button surfaces', async t => {
  const fixture = `docs/tests/.button-a11y-${randomUUID()}.tsx`;
  await writeFile(
    fixture,
    `import AtlasProvider from '../src/react/AtlasProvider';
    import AtlasButton from '../src/react/AtlasButton';
    import {buttonColorPresets} from '../src/data/button-palette';
    export default function Probe(){return <AtlasProvider appearance="docs"><div className="playground-preview">{buttonColorPresets.flatMap(p=>['middle','dark','light','pastel'].flatMap(tone=>['text','link'].map(fill=><AtlasButton key={p.value+tone+fill} colorPreset={p.value} tone={tone as 'middle'} fill={fill} text={p.value+tone+fill}/>)))}</div></AtlasProvider>}`,
  );
  const h = await mountPattern('default', fixture);
  t.after(async () => {
    await h.dispose();
    await unlink(fixture);
  });
  const compiled = await build({
    stdin: {
      contents:
        "export {contrastRatio} from './docs/src/data/color-system';export {docsAccessibleThemeColors} from './docs/src/data/accessibility';export {buttonColorPresets} from './docs/src/data/button-palette';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { contrastRatio, docsAccessibleThemeColors, buttonColorPresets } = await import(
    'data:text/javascript;base64,' +
      Buffer.from(compiled.outputFiles[0].contents).toString('base64')
  );
  // Validate the ink that the actual CSS consumer selects, rather than the fill prop.
  const css = postcss.parse(await readFile('docs/src/styles/components.css', 'utf8'));
  let consumer;
  css.walkRules(rule => {
    if (
      rule.selector.replace(/\s+/g, ' ') ===
      '.atlas-demo :is(.ant-btn-variant-text, .ant-btn-variant-link).atlas-button'
    )
      consumer = rule;
  });
  assert.ok(consumer);
  assert.ok(
    consumer.nodes.some(
      node => node.prop === 'color' && node.value === 'var(--button-transparent-ink)',
    ),
  );
  const buttons = [...h.document.querySelectorAll('.atlas-button[data-color-preset]')];
  assert.equal(buttons.length, buttonColorPresets.length * 4 * 2);
  assert.deepEqual(
    [...new Set(buttons.map(button => button.dataset.colorPreset))],
    buttonColorPresets.map(preset => preset.value),
  );
  const failures = [];
  for (const button of buttons) {
    assert.ok(button.matches(consumer.selector));
    for (const mode of ['light', 'dark']) {
      const ink = button.style.getPropertyValue(
        mode === 'light' ? '--button-transparent-light-ink' : '--button-outline-ink',
      );
      for (const key of ['paper', 'panel', 'surface', 'fieldBg', 'fieldHoverBg']) {
        const bg = docsAccessibleThemeColors[mode][key];
        const ratio = contrastRatio(ink, bg);
        if (ratio < 4.5)
          failures.push(`${mode} ${button.textContent}: ${ink}/${bg} ${ratio.toFixed(4)}:1`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
