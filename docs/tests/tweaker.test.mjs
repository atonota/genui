import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { mountPattern, selectOption } from './harness.mjs';

async function openTweaker(h) {
  const trigger = h.document.querySelector('[data-tweaker-trigger]');
  assert.ok(trigger, 'every documentation component has the shared Tweaker opener');
  await h.act(async () => trigger.focus());
  await h.click(trigger);
  await h.waitFor(() => trigger.getAttribute('aria-expanded') === 'true', 'Tweaker opens');
  return trigger;
}

test('Tweaker starts closed, owns Button settings and retains the same controls across Escape and reopening', async t => {
  const h = await mountPattern('WebButtonDemo', 'docs/src/react/ButtonDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const trigger = h.document.querySelector('[data-tweaker-trigger]');
  assert.ok(trigger);
  assert.equal(h.document.querySelectorAll('[data-tweaker-trigger]').length, 1);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(trigger.getAttribute('aria-label'), 'Open tweaker');
  assert.equal(h.document.querySelector('.button-playground #button-label'), null);
  await openTweaker(h);
  const panel = h.document.getElementById(trigger.getAttribute('aria-controls'));
  assert.ok(panel);
  assert.equal(
    panel.closest('.atlas-tweaker-panel').style.zIndex,
    '2001',
    'native zIndex prop keeps settings above example overlays',
  );
  const text = panel.querySelector('#button-label');
  assert.ok(text, 'component settings mount inside the panel on first opening');
  assert.ok(panel.querySelector('[data-size-control]'));
  assert.equal(h.document.querySelector('.button-playground #button-label'), null);
  await h.type(text, 'Tweaked action');
  const preview = h.document.querySelector('.playground-preview .atlas-button');
  assert.equal(preview.textContent.trim(), 'Tweaked action');
  const dialog = panel.closest('[role="dialog"]');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  await h.act(async () => {
    dialog.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await h.waitFor(() => trigger.getAttribute('aria-expanded') === 'false', 'Escape closes');
  await h.waitFor(() => h.document.activeElement === trigger, 'focus returns to opener');
  await openTweaker(h);
  assert.equal(panel.querySelector('#button-label'), text, 'the portal target does not remount');
  assert.equal(text.value, 'Tweaked action');
  assert.equal(h.document.querySelector('.playground-preview .atlas-button'), preview);
  await h.act(async () => h.setLocale('tr'));
  assert.equal(trigger.getAttribute('aria-label'), 'Tweaker’ı aç');
  assert.equal(text.value, 'Tweaked action');
});

test('Tweaker changes shared size and Form layout without replacing or clearing real form input', async t => {
  const h = await mountPattern('default', 'docs/src/react/FormDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const input = h.document.querySelector('#profile-example_fullName');
  await h.type(input, 'Preserved draft');
  const trigger = await openTweaker(h);
  const panel = h.document.getElementById(trigger.getAttribute('aria-controls'));
  assert.equal(panel.querySelector('#profile-example_fullName'), null);
  await h.click(panel.querySelector('[data-size-control] input[type="radio"]'));
  assert.equal(h.document.querySelector('[data-size-profile]').dataset.sizeProfile, 'sm');
  await selectOption(h, panel.querySelector('.form-layout-control input'), 'Horizontal');
  assert.ok(
    panel.closest('.atlas-tweaker-panel').querySelector(':scope > .atlas-select-popup'),
    'settings dropdowns render in the same top layer',
  );
  assert.ok(h.document.querySelector('form.ant-form-horizontal'));
  assert.equal(h.document.querySelector('#profile-example_fullName'), input);
  assert.equal(input.value, 'Preserved draft');
  const layout = panel.querySelector('.form-layout-control input');
  await h.act(async () => {
    layout
      .closest('.ant-select')
      .dispatchEvent(new h.window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
  assert.equal(layout.getAttribute('aria-expanded'), 'true');
  await h.act(async () =>
    layout.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(layout.getAttribute('aria-expanded'), 'false');
  assert.equal(
    trigger.getAttribute('aria-expanded'),
    'true',
    'Select consumes its own first Escape',
  );
  await h.act(async () => {
    layout.dispatchEvent(new h.window.Event('compositionend', { bubbles: true }));
    layout.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  });
  assert.equal(
    trigger.getAttribute('aria-expanded'),
    'true',
    'IME confirmation cannot dismiss settings',
  );
  await h.click(h.document.querySelector('[aria-label="Close tweaker"]'));
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(
    h.document.activeElement,
    trigger,
    'focus returns immediately, independently of exit motion',
  );
  await openTweaker(h);
  assert.equal(input.value, 'Preserved draft');
  assert.equal(panel.querySelector('[data-size-control] input').checked, true);
});

// Native focus locks require visible/fixed controls. This explicit DOM contract
// exercises their event order; these synthetic values are not layout evidence.
const overlayFixture = `
import {useState} from 'react';
import AtlasProvider from '../src/react/AtlasProvider';
import {Drawer,Modal} from '../src/react/AtlasOverlay';
import {TweakerSettings} from '../src/react/AtlasTweaker';
Object.defineProperty(HTMLElement.prototype,'offsetParent',{configurable:true,get(){return this.isConnected && !this.closest('[style*="display: none"]') ? document.body : null;}});
const originalStyle=globalThis.getComputedStyle;
globalThis.getComputedStyle=window.getComputedStyle=(element)=>{
 const style=originalStyle(element);
 return element.classList.contains('ant-modal-wrap') ? new Proxy(style,{get(target,key){return key==='position'?'fixed':Reflect.get(target,key,target);}}) : style;
};
export function OverlayFixture(){
 const [container,setContainer]=useState('inline');
 return <AtlasProvider appearance="docs">
  <button data-background>Background action</button>
  <button onClick={()=>setContainer('modal')}>Open example modal</button>
  <TweakerSettings title="Presentation">
   <button onClick={()=>setContainer('modal')}>Choose modal</button>
   <button onClick={()=>setContainer('drawer')}>Choose drawer</button>
   <input data-setting defaultValue="Stable setting"/>
  </TweakerSettings>
  <Modal title="Example modal" open={container==='modal'} onCancel={()=>setContainer('inline')} focusable={{trap:true,focusTriggerAfterClose:true}}>
   <input data-example-modal defaultValue="Modal draft"/>
  </Modal>
  <Drawer title="Example drawer" open={container==='drawer'} onClose={()=>setContainer('inline')} focusable={{trap:true,focusTriggerAfterClose:true}}>
   <input data-example-drawer defaultValue="Drawer draft"/>
  </Drawer>
 </AtlasProvider>;
}
export function NestedFixture(){return <AtlasProvider>
 <AtlasProvider appearance="docs">
  <TweakerSettings title="Outer"><input data-outer-setting/></TweakerSettings>
  <AtlasProvider><TweakerSettings title="Inner"><input data-inner-setting/></TweakerSettings></AtlasProvider>
  <AtlasProvider appearance="approved"><TweakerSettings><input data-approved-setting/></TweakerSettings></AtlasProvider>
 </AtlasProvider>
 <input data-approved-sibling/>
</AtlasProvider>;}
`;

async function mountFixture(t, name) {
  const file = `docs/tests/.tweaker-overlay-${randomUUID()}.tsx`;
  await writeFile(file, overlayFixture);
  let h;
  try {
    h = await mountPattern(name, file);
  } catch (error) {
    await unlink(file);
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  return h;
}

test('native overlays share one focus owner and Escape closes Tweaker even when a preview overlay mounts later', async t => {
  const h = await mountFixture(t, 'OverlayFixture');
  const trigger = await openTweaker(h);
  const panel = h.document.getElementById(trigger.getAttribute('aria-controls'));
  const setting = panel.querySelector('[data-setting]');
  await h.act(async () => setting.focus());
  await h.click(
    [...panel.querySelectorAll('button')].find(button => button.textContent === 'Choose modal'),
  );
  await h.waitFor(
    () => h.document.querySelector('.ant-modal-wrap [role="dialog"]'),
    'preview modal mounts',
  );
  assert.ok(
    h.document.querySelector('[data-example-modal]').closest('[aria-hidden="true"]'),
    'the suspended lower dialog is excluded from the accessibility tree',
  );
  await h.act(async () => h.document.querySelector('[data-background]').focus());
  assert.ok(
    panel.closest('.atlas-tweaker-panel').contains(h.document.activeElement),
    'only Tweaker retains focus',
  );
  await h.act(async () => setting.focus());
  await h.click(
    [...panel.querySelectorAll('button')].find(button => button.textContent === 'Choose drawer'),
  );
  await h.waitFor(
    () =>
      h.document.querySelector('.atlas-overlay-active') === null &&
      h.document.querySelector('[data-example-drawer]'),
    'preview drawer mounts while suspended',
  );
  await h.act(async () => {
    setting.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  });
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.ok(
    h.document.querySelector('.atlas-overlay-active.ant-drawer-open'),
    'Escape leaves the preview drawer open',
  );
  const hiddenAncestor = h.document
    .querySelector('[data-example-drawer]')
    .closest('[aria-hidden="true"]');
  assert.ok(
    hiddenAncestor === null,
    'the resumed dialog is exposed again: ' + hiddenAncestor?.outerHTML.slice(0, 350),
  );
  assert.ok(
    h.document.activeElement.closest('.atlas-overlay-active'),
    'the preview native trap resumes after closing settings',
  );
  const headerOpener = h.document.querySelector(
    '.atlas-overlay-active [aria-label="Open tweaker"]',
  );
  await h.click(headerOpener);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.ok(panel.querySelector('[data-setting]') === setting, 'setting DOM is stable');
  await h.click(h.document.querySelector('[aria-label="Close tweaker"]'));
  assert.ok(
    h.document.activeElement === headerOpener,
    'return focus stays in the active example dialog',
  );
  assert.equal(h.document.querySelector('[data-example-drawer]').value, 'Drawer draft');
});

test('an explicit docs boundary inside approved gets one independent Tweaker while nested providers reuse it', async t => {
  const h = await mountFixture(t, 'NestedFixture');
  assert.equal(h.document.querySelectorAll('[data-tweaker-trigger]').length, 1);
  const trigger = await openTweaker(h);
  const panel = h.document.getElementById(trigger.getAttribute('aria-controls'));
  assert.ok(panel.querySelector('[data-outer-setting]'));
  assert.ok(panel.querySelector('[data-inner-setting]'));
  assert.equal(panel.querySelector('[data-approved-setting]'), null);
  await h.click([...panel.querySelectorAll('[data-size-control] input')].at(-1));
  const docs = h.document.querySelector('[data-atlas-appearance="docs"]');
  assert.equal(docs.dataset.sizeProfile, 'lg');
  assert.equal(
    h.document.querySelector('[data-approved-sibling]').closest('[data-size-profile]').dataset
      .sizeProfile,
    'md',
  );
});

test('approved examples keep their inline controls and do not gain a Tweaker', async t => {
  const h = await mountPattern('default', 'docs/src/react/ButtonDemo.tsx');
  t.after(() => h.dispose());
  assert.equal(h.document.querySelector('[data-tweaker-trigger]'), null);
  assert.equal(h.document.querySelector('[data-tweaker-settings]'), null);
  assert.ok(h.document.querySelector('.button-playground .playground-controls #button-label'));
});

test('record-form presentation settings register in Tweaker while business fields retain their draft', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordFormsDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const input = h.document.querySelector('#record-form-customer');
  await h.type(input, 'Preserved customer');
  const trigger = await openTweaker(h);
  const panel = h.document.getElementById(trigger.getAttribute('aria-controls'));
  assert.ok(panel.querySelector('#record-form-mode'));
  assert.ok(panel.querySelector('#record-form-readonly'));
  assert.ok(panel.querySelector('[aria-label="Example layout"]'));
  assert.equal(panel.querySelector('#record-form-customer'), null);
  await selectOption(h, panel.querySelector('#record-form-mode'), 'Single-page form');
  assert.equal(h.document.querySelector('#record-form-customer').value, 'Preserved customer');
  assert.equal(h.document.querySelector('.record-form-demo #record-form-mode'), null);
});
