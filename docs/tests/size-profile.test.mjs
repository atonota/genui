import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { mountPattern } from './harness.mjs';

test('shared documentation size profiles preserve input drafts and expose exactly three sizes', async t => {
  const h = await mountPattern('WebInputDemo', 'docs/src/react/InputDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const owner = h.document.querySelector('.atlas-demo[data-size-profile]');
  const input = h.document.querySelector('#input-filled');
  await h.type(input, 'Preserved entry');
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  const options = [...owner.querySelectorAll('[data-size-control] input[type="radio"]')];
  assert.deepEqual(
    options.map(option => option.closest('label').textContent.trim()),
    ['Small · 48 px', 'Medium · 56 px', 'Large · 64 px'],
  );
  assert.equal(owner.dataset.sizeProfile, 'md');
  for (const [index, profile] of ['sm', 'md', 'lg'].entries()) {
    await h.click(options[index]);
    assert.equal(owner.dataset.sizeProfile, profile);
    assert.equal(
      owner.style.getPropertyValue('--atlas-component-height'),
      [48, 56, 64][index] + 'px',
    );
    assert.equal(h.document.querySelector('#input-filled'), input);
    assert.equal(input.value, 'Preserved entry');
  }
  await h.act(async () => h.setLocale('tr'));
  assert.equal(input.value, 'Preserved entry');
  assert.equal(owner.dataset.sizeProfile, 'lg');
  assert.match(owner.querySelector('[data-size-control]').textContent, /Bileşen boyutu/);
});

test('NumberStepper native size overrides align the field and both actions without replacing drafts', async t => {
  const fixture = `docs/tests/.stepper-sizes-${randomUUID()}.tsx`;
  await writeFile(
    fixture,
    `import {useState} from 'react';
import AtlasProvider from '../src/react/AtlasProvider';
import {AtlasSizeContext} from '../src/react/AtlasSizeProfile';
import NumberStepper from '../src/react/NumberStepper';
function Quantity({size, name}) {
  const [value,setValue]=useState(7);
  return <NumberStepper size={size} aria-label={name} value={value} min={1} onChange={setValue}/>;
}
export default function Fixture({appearance}) {
  const [parentSize,setParentSize]=useState('md');
  return <AtlasSizeContext.Provider value={parentSize}><AtlasProvider appearance={appearance}><Quantity size="small" name="Small quantity"/><Quantity size="medium" name="Medium quantity"/><Quantity size="large" name="Large quantity"/><Quantity size="middle" name="Compatible middle quantity"/><Quantity name="Shared quantity"/>{appearance==='approved'&&<button data-parent-size-change onClick={()=>setParentSize('lg')}>Change parent size</button>}</AtlasProvider></AtlasSizeContext.Provider>;
}`,
  );
  t.after(() => unlink(fixture));
  for (const appearance of ['docs', 'approved']) {
    await t.test(appearance, async () => {
      const h = await mountPattern('default', fixture, { appearance });
      try {
        const owner = h.document.querySelector('.atlas-demo[data-size-profile]');
        assert.equal(owner.dataset.sizeProfile, 'md');
        const fields = [...h.document.querySelectorAll('input[role="spinbutton"]')];
        const units = pixels => (appearance === 'docs' ? `${pixels}px` : `${pixels / 16}rem`);
        const assertDimensions = (input, pixels) => {
          const wrapper = input.closest('.atlas-number-stepper');
          const height = units(pixels);
          for (const property of ['--atlas-component-height', '--field-height', '--control-height'])
            assert.equal(
              wrapper.style.getPropertyValue(property),
              height,
              `${input.getAttribute('aria-label')} must own ${property} so parent sizing cannot stretch its field`,
            );
          for (const action of wrapper.querySelectorAll('.atlas-icon-button')) {
            assert.equal(action.style.minHeight, height);
            assert.equal(action.style.height, height);
            assert.equal(action.style.width, height);
          }
        };
        for (const [index, pixels] of [48, 56, 64, 56, 56].entries()) {
          assertDimensions(fields[index], pixels);
          await h.type(fields[index], String(12 + index));
        }
        if (appearance === 'docs') {
          await h.click(h.document.querySelector('[data-tweaker-trigger]'));
          const options = [...owner.querySelectorAll('[data-size-control] input[type="radio"]')];
          await h.click(options[2]);
        } else {
          await h.click(h.document.querySelector('[data-parent-size-change]'));
        }
        assert.equal(owner.dataset.sizeProfile, 'lg');
        for (const [index, pixels] of [48, 56, 64, 56, 64].entries()) {
          assert.equal(
            h.document.querySelectorAll('input[role="spinbutton"]')[index],
            fields[index],
          );
          assert.equal(fields[index].value, String(12 + index));
          assertDimensions(fields[index], pixels);
        }
        if (appearance === 'docs')
          await h.act(() => {
            h.window.dispatchEvent(
              new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            );
          });
        await h.act(() => fields[0].focus());
        for (const mode of ['dark', 'light']) {
          await h.act(() => {
            h.document.documentElement.dataset.theme = mode;
            h.window.dispatchEvent(new h.window.Event('atlas-theme-change'));
          });
          assert.equal(h.document.activeElement, fields[0]);
          assert.equal(fields[0].value, '12');
          assertDimensions(fields[0], 48);
        }
        await h.act(() => h.setLocale('tr'));
        assert.equal(h.document.activeElement, fields[0]);
        assert.equal(fields[0].value, '12');
      } finally {
        await h.dispose();
      }
    });
  }
});
