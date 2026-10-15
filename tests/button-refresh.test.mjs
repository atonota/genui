import assert from 'node:assert/strict';
import test from 'node:test';
import { render } from '../tools/build.mjs';
import { setup } from './harness.mjs';

test('legacy consumer retains new flat Text/Link fills and normalizes old busy recipes safely', async t => {
  const h = setup((await render()).html);
  t.after(h.close);
  for (const fill of ['text', 'link']) {
    const button = h.read(`buttonFor({...BASE,fill:${JSON.stringify(fill)}})`);
    assert.equal(button.dataset.semanticFill, fill);
    assert.equal(button.dataset.fill, 'ghost', 'compatibility paint remains transparent');
    assert.equal(button.dataset.detail, 'none');
    assert.equal(
      button.querySelector('.btx-lip'),
      null,
      'plain text and links have no tactile layer',
    );
    assert.equal(button.style.getPropertyValue('--edgew'), '0px');
  }
  for (const oldState of ['saving', 'syncing', 'queued', 'processing']) {
    assert.equal(h.read(`buttonFor(BASE,${JSON.stringify(oldState)}).dataset.force`), 'loading');
    assert.equal(h.read(`buttonStatus(${JSON.stringify(oldState)}).busy`), true);
    assert.equal(h.read(`buttonStatus(${JSON.stringify(oldState)}).blocked`), true);
  }
  for (const [size, height] of [
    ['sm', 48],
    ['md', 56],
    ['lg', 64],
  ])
    assert.equal(
      h.read(`buttonFor({...BASE,size:${JSON.stringify(size)}}).style.getPropertyValue('--h')`),
      height + 'px',
    );
});
