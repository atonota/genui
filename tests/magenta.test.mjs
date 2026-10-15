import assert from 'node:assert/strict';
import test from 'node:test';
import { render } from '../tools/build.mjs';
import { setup } from './harness.mjs';

test('Magenta reaches studio, forms and AntD exports in all four tones', async t => {
  const h = setup((await render()).html);
  t.after(h.close);
  assert.equal(h.read('PALETTES.magenta?.color'), '#da037d');
  assert.equal(h.read('BASE.palette'), 'coral');
  assert.equal(h.read('safeConfig({palette:"magenta"}).palette'), 'magenta');
  assert.deepEqual(
    JSON.parse(h.read('JSON.stringify(AXES.find(axis=>axis.key==="palette").options.at(-1))')),
    ['magenta', 'Magenta'],
  );
  h.click('tab-forms');
  for (const [tone, color, edge] of [
    ['middle', '#da037d', '#b3006b'],
    ['dark', '#b3006b', '#8c0059'],
    ['light', '#ff7dba', '#f250a1'],
    ['pastel', '#ffe6f0', '#ffa6cc'],
  ]) {
    const config = JSON.stringify({ palette: 'magenta', tone });
    assert.equal(h.read(`buttonFor({...BASE,...${config}}).style.getPropertyValue('--bc')`), color);
    assert.equal(h.read(`paletteFor(${config}).dark`), edge);
    assert.equal(
      h.read(`buildAntdRecipe({...BASE,...${config}}).configProvider.theme.token.colorPrimary`),
      color,
    );
    h.click('ff-palette-magenta');
    h.click('ff-tone-' + tone);
    assert.equal(h.el('formLab').style.getPropertyValue('--ff-fill'), color);
  }
});
