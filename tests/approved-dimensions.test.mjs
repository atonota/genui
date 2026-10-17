import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { render } from '../tools/build.mjs';
import { setup } from './harness.mjs';

const model = await readFile(new URL('../src/model/decisions.js', import.meta.url), 'utf8');
const data = JSON.parse(
  vm.runInNewContext(
    model +
      '\nJSON.stringify({decisions:BUTTON_DECISIONS,experiments:BUTTON_EXPERIMENTS,widths:BUTTON_VARIANTS.width})',
  ),
);

test('approved dimensions retain three size/padding tuples and exactly three width decisions', () => {
  assert.deepEqual(
    data.decisions.size_variants.map(item => [item.height_px, item.padding_inline_px]),
    [
      [48, 25],
      [56, 30],
      [64, 24],
    ],
  );
  assert.deepEqual(
    data.decisions.width_variants?.map(item => item.value),
    ['content', 'wide', 'full'],
  );
  assert.deepEqual(
    data.decisions.width_variants?.map(item => [item.min_width_px, item.block]),
    [
      [null, false],
      [175, false],
      [null, true],
    ],
  );
  assert.deepEqual(
    data.experiments.width_variants?.map(item => item.value),
    ['narrow'],
  );
  assert.deepEqual(
    data.widths?.map(item => item.value),
    ['content', 'wide', 'full', 'narrow'],
  );
  assert.equal(data.decisions.width_variants.find(item => item.value === 'wide').min_width_px, 175);
});

test('GenUX renders approved widths and AntD exports apply the same width decision', async t => {
  const h = setup((await render()).html);
  t.after(h.close);
  const buttons = [...h.el('decisionWidthGrid').querySelectorAll('.btx')];
  assert.deepEqual(
    buttons.map(button => button.dataset.width),
    ['content', 'wide', 'full'],
  );
  assert.equal(h.read('buildAntdRecipe({...BASE,width:"full"}).button.props.block'), true);
  assert.equal(h.read('buildAntdRecipe({...BASE,width:"content"}).button.props.block'), false);
  assert.equal(
    h.read('buildAntdRecipe({...BASE,width:"wide"}).button.styles.root.minWidth'),
    'min(100%, 175px)',
  );
  assert.equal(h.read('safeConfig({width:"unknown"}).width'), 'content');
  assert.equal(h.el('decisionSizeGrid').querySelectorAll('.btx').length, 3);
});
