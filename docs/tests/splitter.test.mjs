import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { transform } from 'esbuild';
import { buttonByText, mountPattern } from './harness.mjs';

const source = await readFile(new URL('../src/data/splitter.ts', import.meta.url), 'utf8');
const compiled = await transform(source, { loader: 'ts', format: 'esm' });
const model = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.code).toString('base64')
);

test('Splitter ratios are bounded, finite and complementary, including invalid or impossible input', () => {
  const bounds = model.splitterLimits([
    { min: 25, max: 70 },
    { min: 30, max: 75 },
  ]);
  assert.deepEqual(bounds, { min: 25, max: 70 });
  assert.deepEqual(model.splitterSizes([3, 1], bounds), [70, 30]);
  for (const invalid of [
    undefined,
    [],
    [0, 0],
    [NaN, 10],
    [-2, 4],
    [Infinity, 1],
    [1, 2, 3],
    [Number.MAX_VALUE, Number.MAX_VALUE],
  ]) {
    assert.deepEqual(model.splitterSizes(invalid, bounds), [50, 50]);
  }
  assert.deepEqual(model.splitterLimits([{ min: 90 }, { min: 90 }]), { min: 20, max: 80 });
  assert.deepEqual(model.splitterLimits([{ min: NaN, max: Infinity }, {}]), { min: 20, max: 80 });
  assert.deepEqual(model.splitterSizes([10, 90], { min: 33.3, max: 33.3 }), [33.3, 66.7]);
  for (let first = 1; first < 100; first++) {
    const sizes = model.splitterSizes([first, 100 - first], bounds);
    assert.equal(sizes[0] + sizes[1], 100);
    assert.ok(sizes[0] >= bounds.min && sizes[0] <= bounds.max);
  }
});

test('Splitter auto layout uses measured area and preserves a stack for short landscape', () => {
  const direction = (width, height, viewportHeight) =>
    model.splitterDirection('auto', { width, height, viewportHeight });
  assert.equal(direction(320, 700, 900), 'vertical');
  assert.equal(direction(759, 700, 900), 'vertical');
  assert.equal(direction(760, 320, 480), 'horizontal');
  assert.equal(direction(761, 319, 480), 'vertical');
  assert.equal(direction(900, 640, 360), 'vertical');
  assert.equal(
    model.splitterDirection('vertical', { width: 1600, height: 900, viewportHeight: 900 }),
    'vertical',
  );
});

test('Splitter keyboard follows the divider axis and respects limits, large steps and RTL', () => {
  const bounds = { min: 25, max: 70 };
  const key = (name, direction = 'horizontal', ratio = 50, large = false, rtl = false) =>
    model.splitterKeyRatio(name, direction, ratio, bounds, large, rtl);
  assert.equal(key('ArrowRight'), 55);
  assert.equal(key('ArrowLeft'), 45);
  assert.equal(key('ArrowRight', 'horizontal', 50, true), 60);
  assert.equal(key('ArrowLeft', 'horizontal', 50, false, true), 55);
  assert.equal(key('ArrowUp', 'vertical'), 45);
  assert.equal(key('ArrowDown', 'vertical', 68), 70);
  assert.equal(key('ArrowRight', 'vertical'), null);
  assert.equal(key('ArrowDown', 'horizontal'), null);
  assert.equal(key('Home'), 25);
  assert.equal(key('End'), 70);
  assert.equal(key('Escape'), null);
});

async function fixture(t) {
  const path = `docs/tests/.splitter-${randomUUID()}.tsx`;
  await writeFile(
    path,
    `import {useState} from 'react';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasSplitter from '../src/react/AtlasSplitter';
import {AtlasSizeContext} from '../src/react/AtlasSizeProfile';
const callbacks=new Map();
let area={width:320,height:760,viewportHeight:900};
const captures=new Set();
window.ResizeObserver=class { callback; constructor(callback){this.callback=callback;} observe(element){callbacks.set(element,this.callback);} unobserve(element){callbacks.delete(element);} disconnect(){for(const [element,callback] of callbacks)if(callback===this.callback)callbacks.delete(element);} };
const originalRect=window.HTMLElement.prototype.getBoundingClientRect;
window.HTMLElement.prototype.getBoundingClientRect=function(){if(this.matches('[data-atlas-splitter]'))return {x:0,y:0,width:area.width,height:area.height,top:0,left:0,right:area.width,bottom:area.height,toJSON(){}};if(this.matches('.atlas-splitter-native'))return {x:0,y:0,width:area.width,height:640,top:0,left:0,right:area.width,bottom:640,toJSON(){}};if(this.matches('[role="separator"]'))return {x:0,y:0,width:40,height:40,top:0,left:0,right:40,bottom:40,toJSON(){}};return originalRect.call(this);};
window.HTMLElement.prototype.setPointerCapture=function(id){captures.add(id);};
window.HTMLElement.prototype.hasPointerCapture=function(id){return captures.has(id);};
window.HTMLElement.prototype.releasePointerCapture=function(id){captures.delete(id);};
function resize(width,height,viewportHeight){area={width,height,viewportHeight};Object.defineProperty(window,'innerHeight',{configurable:true,value:viewportHeight});for(const [element,callback]of callbacks)callback([{target:element,contentRect:element.getBoundingClientRect()}]);}
function Draft(){const[draft,setDraft]=useState('');return <input aria-label="Persistent draft" value={draft} onChange={e=>setDraft(e.target.value)}/>;}
export default function Fixture(){const[profile,setProfile]=useState('md');return <AtlasProvider appearance="docs"><AtlasSizeContext.Provider value={profile}><AtlasSplitter id="fixture-split" label="Workspace layout" initialSizes={[60,40]} panels={[{id:'records',label:'Records',children:<Draft/>},{id:'details',label:'Details',children:<input aria-label="Detail field" defaultValue="One native pane"/>}]}/></AtlasSizeContext.Provider><button data-layout="wide" onClick={()=>resize(900,760,900)}>Wide</button><button data-layout="short" onClick={()=>resize(900,760,360)}>Short landscape</button><button data-layout="narrow" onClick={()=>resize(320,760,900)}>Narrow</button><button data-profile="large" onClick={()=>setProfile('lg')}>Large</button></AtlasProvider>;}`,
  );
  t.after(() => unlink(path));
  const h = await mountPattern('default', path);
  t.after(() => h.dispose());
  return h;
}

async function key(h, target, key, extra = {}) {
  await h.act(() =>
    target.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }),
    ),
  );
}

async function pointer(h, target, type, props = {}) {
  const event = new h.window.Event(type, { bubbles: true, cancelable: true });
  for (const [name, value] of Object.entries({
    pointerId: 7,
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 100,
    ...props,
  }))
    Object.defineProperty(event, name, { value });
  await h.act(() => target.dispatchEvent(event));
}

test('native Splitter has one named keyboard separator and real non-drag controls without remounting drafts', async t => {
  const h = await fixture(t);
  const root = h.document.querySelector('[data-atlas-splitter]');
  const handle = root.querySelector('[role="separator"]');
  const field = h.document.querySelector('[aria-label="Persistent draft"]');
  assert.equal(root.dataset.splitterOrientation, 'vertical');
  assert.equal(root.querySelectorAll('.ant-splitter-panel').length, 2);
  assert.equal(root.querySelectorAll('[role="separator"]').length, 1);
  assert.equal(handle.tabIndex, 0);
  assert.equal(handle.getAttribute('aria-label'), 'Resize Records and Details');
  assert.equal(handle.getAttribute('aria-orientation'), 'horizontal');
  assert.equal(handle.getAttribute('aria-controls'), 'fixture-split-records fixture-split-details');
  const regions = [...root.querySelectorAll('[role="region"]')];
  assert.equal(regions.length, 2, 'only the actual native scroll owners are named regions');
  assert.deepEqual(
    regions.map(region => region.getAttribute('aria-label')),
    ['Records', 'Details'],
  );
  for (const [index, id] of handle.getAttribute('aria-controls').split(' ').entries()) {
    const region = h.document.getElementById(id);
    assert.equal(region, regions[index]);
    assert.ok(region.matches('.ant-splitter-panel'));
    assert.equal(region.tabIndex, 0);
    assert.equal(root.querySelectorAll('#' + id).length, 1);
    assert.equal(region.querySelector('.atlas-splitter-pane').tagName, 'DIV');
    await h.act(() => region.focus());
    assert.equal(h.document.activeElement, region);
    const paneEnd = new h.window.KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true,
      cancelable: true,
    });
    await h.act(() => region.dispatchEvent(paneEnd));
    assert.equal(
      paneEnd.defaultPrevented,
      false,
      'native pane keyboard scrolling remains available',
    );
    assert.equal(
      handle.getAttribute('aria-valuenow'),
      '60',
      'pane scrolling does not resize the divider',
    );
  }
  assert.ok(h.document.getElementById(handle.getAttribute('aria-describedby')));
  assert.equal(handle.getAttribute('aria-valuemin'), '20');
  assert.equal(handle.getAttribute('aria-valuemax'), '80');
  assert.equal(handle.getAttribute('aria-valuenow'), '60');
  await h.type(field, 'Keep my draft');
  await h.act(() => field.focus());
  await h.click(h.document.querySelector('[data-layout="wide"]'));
  assert.equal(root.dataset.splitterOrientation, 'horizontal');
  assert.equal(handle.getAttribute('aria-orientation'), 'vertical');
  assert.equal(h.document.querySelector('[aria-label="Persistent draft"]'), field);
  assert.equal(h.document.activeElement, field);
  assert.equal(field.value, 'Keep my draft');
  await h.act(() => handle.focus());
  await key(h, handle, 'ArrowRight');
  assert.equal(handle.getAttribute('aria-valuenow'), '65');
  await key(h, handle, 'End');
  assert.equal(handle.getAttribute('aria-valuenow'), '80');
  assert.equal(h.document.activeElement, handle);
  assert.equal(buttonByText(root, 'More space for Records').disabled, true);
  await h.click(buttonByText(root, 'More space for Details'));
  assert.equal(handle.getAttribute('aria-valuenow'), '70');
  await h.click(buttonByText(root, 'Balance panels'));
  assert.equal(handle.getAttribute('aria-valuenow'), '50');
  await h.click(h.document.querySelector('[data-layout="short"]'));
  assert.equal(root.dataset.splitterOrientation, 'vertical');
  assert.equal(handle.getAttribute('aria-valuenow'), '50');
  assert.equal(field.value, 'Keep my draft');
  await h.act(() => h.setLocale('tr'));
  assert.equal(h.document.querySelector('[aria-label="Persistent draft"]'), field);
  assert.equal(handle, root.querySelector('[role="separator"]'));
  assert.equal(field.value, 'Keep my draft');
});

test('Splitter pointer ownership clamps extremes and releases on cancel, lost capture and orientation changes', async t => {
  const h = await fixture(t);
  const root = h.document.querySelector('[data-atlas-splitter]');
  const handle = root.querySelector('[role="separator"]');
  await pointer(h, handle, 'pointerdown', { button: 2 });
  assert.equal(root.dataset.splitterResizing, undefined);
  await pointer(h, handle, 'pointerdown', { isPrimary: false });
  assert.equal(root.dataset.splitterResizing, undefined);
  await pointer(h, handle, 'pointerdown');
  assert.equal(root.dataset.splitterResizing, 'true');
  assert.equal(h.document.activeElement, handle);
  assert.equal(handle.hasPointerCapture(7), true);
  await h.act(() =>
    handle.dispatchEvent(new h.window.MouseEvent('mousedown', { bubbles: true, button: 0 })),
  );
  assert.equal(
    root.querySelector('.ant-splitter-mask'),
    null,
    'native mouse/touch controller cannot compete with Pointer Events',
  );
  await pointer(h, handle, 'pointermove', { pointerId: 8, clientY: 200 });
  assert.equal(handle.getAttribute('aria-valuenow'), '60');
  await pointer(h, handle, 'pointermove', { clientY: 10000 });
  assert.equal(handle.getAttribute('aria-valuenow'), '80');
  await pointer(h, handle, 'pointermove', { clientY: -10000 });
  assert.equal(handle.getAttribute('aria-valuenow'), '20');
  await pointer(h, handle, 'pointercancel');
  assert.equal(root.dataset.splitterResizing, undefined);
  assert.equal(handle.hasPointerCapture(7), false);
  await pointer(h, handle, 'pointermove', { clientY: 200 });
  assert.equal(handle.getAttribute('aria-valuenow'), '20');
  await pointer(h, handle, 'pointerdown');
  await pointer(h, handle, 'lostpointercapture');
  assert.equal(root.dataset.splitterResizing, undefined);
  assert.equal(handle.hasPointerCapture(7), false);
  await pointer(h, handle, 'pointerdown');
  await h.click(h.document.querySelector('[data-layout="wide"]'));
  assert.equal(root.dataset.splitterResizing, undefined);
  assert.equal(handle.hasPointerCapture(7), false);
  assert.equal(root.querySelector('.ant-splitter-mask'), null);
});

test('Splitter adaptation reveals only off-viewport owned focus without replacing its draft or caret', async t => {
  const h = await fixture(t);
  const root = h.document.querySelector('[data-atlas-splitter]');
  const field = root.querySelector('[aria-label="Persistent draft"]');
  const panel = field.closest('.ant-splitter-panel');
  const scrolls = [];
  let top = -1773;
  field.getBoundingClientRect = () => ({
    left: 40,
    right: 240,
    top,
    bottom: top + 100,
    width: 200,
    height: 100,
  });
  field.scrollIntoView = options => scrolls.push(options);
  await h.type(field, 'Retain draft and caret');
  await h.act(() => {
    field.focus();
    field.setSelectionRange(7, 12);
    panel.scrollTop = 91;
  });
  await h.click(h.document.querySelector('[data-layout="wide"]'));
  assert.equal(root.dataset.splitterOrientation, 'horizontal');
  assert.deepEqual(scrolls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
  assert.equal(h.document.activeElement, field);
  assert.equal(field.value, 'Retain draft and caret');
  assert.equal(field.selectionStart, 7);
  assert.equal(field.selectionEnd, 12);
  assert.equal(panel.scrollTop, 91, 'the adapter does not reset the native pane scroll position');
  top = 100;
  await h.click(h.document.querySelector('[data-layout="narrow"]'));
  assert.equal(scrolls.length, 1, 'already visible owned focus is not scrolled');
  top = -1773;
  await h.click(h.document.querySelector('[data-profile="large"]'));
  assert.equal(root.dataset.splitterProfile, 'lg');
  assert.equal(scrolls.length, 2, 'size-profile adaptation also reveals off-viewport owned focus');
  const outside = h.document.querySelector('[data-layout="short"]');
  outside.getBoundingClientRect = field.getBoundingClientRect;
  outside.scrollIntoView = options => scrolls.push(options);
  await h.act(() => outside.focus());
  await h.click(h.document.querySelector('[data-layout="wide"]'));
  assert.equal(h.document.activeElement, outside);
  assert.equal(
    scrolls.length,
    2,
    'focus outside this splitter never triggers its scroll correction',
  );
});

test('Splitter reserves accessible gutter space and binds all native motion layers to shared tokens', async () => {
  const css = await readFile(new URL('../src/styles/atlas-splitter.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /ant-splitter-horizontal\s*>\s*\.ant-splitter-bar\s*\{\s*width:\s*var\(--splitter-gutter\)/,
  );
  assert.match(
    css,
    /ant-splitter-vertical\s*>\s*\.ant-splitter-bar\s*\{\s*height:\s*var\(--splitter-gutter\)/,
  );
  assert.match(css, /@media\s*\(any-pointer:\s*coarse\)/);
  assert.match(css, /max\(var\(--splitter-handle-size\),\s*var\(--splitter-coarse-target\)\)/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /transition-property:\s*flex-basis/);
  assert.match(css, /transition-duration:\s*var\(--motion-duration-standard\)/);
  assert.match(css, /transition-timing-function:\s*var\(--motion-easing\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible\s+\.atlas-splitter-grip::after/);
  assert.match(
    css,
    /ant-splitter-panel:focus-visible\s*\{\s*border-inline-start-color:\s*var\(--focus-color\)/,
  );
  assert.match(css, /border-inline-start:\s*var\(--focus-marker\) solid transparent/);
  assert.doesNotMatch(css, /transition:\s*(?:all|none)|linear|gradient/i);
});
