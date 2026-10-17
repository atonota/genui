import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// Unit scope: JSDOM with synthetic, untrusted events and stubbed geometry/capture.
// This is not a physical pen, remote, webOS device or TV; trusted arrow keys and
// the living-room visual focus are covered by browser tests, not forged here.
const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// DOM-only stand-in for a compiled `?inline` stylesheet: a valid, nonempty CSS comment naming its
// source. It proves nothing about Sass or CSS; real profile styles are checked in browsers.
const styleFixture = id => `/* DOM-only fixture, not compiled CSS: ${id} */`;
const domOnlyInlineStyles = {
  name: 'dom-only-inline-styles',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /[.]scss[?]inline$/ }, args => ({
      path: relative(
        projectDirectory,
        resolve(args.resolveDir, args.path.replace(/[?]inline$/, '')),
      ),
      namespace: 'dom-only-inline-style',
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: 'dom-only-inline-style' }, args => ({
      contents: `export default ${JSON.stringify(styleFixture(args.path))};`,
      loader: 'js',
    }));
  },
};

let adaptive;
function loadAdaptive() {
  // The adapters, the modality owner and the living-room layout touch no browser global at
  // module scope, so one bundle loads in plain Node and every case passes its own JSDOM nodes.
  // Layout stylesheets load as DOM-only fixtures; this unit scope checks behavior, not CSS.
  adaptive ??= build({
    absWorkingDir: projectDirectory,
    stdin: {
      contents: [
        `export * from './docs/src/adaptive/pointer.ts';`,
        `export * from './docs/src/adaptive/spatial.ts';`,
        `export * from './docs/src/adaptive/webos.ts';`,
        `export * as modality from './docs/src/input-modality.ts';`,
        `export { layoutModule as livingRoomLayout } from './docs/src/adaptive/layouts/living-room.ts';`,
        `export { layoutLoaders } from './docs/src/adaptive/delivery.ts';`,
        `export { withLayoutStyles } from './docs/src/adaptive/layout-styles.ts';`,
      ].join(' '),
      resolveDir: projectDirectory,
      sourcefile: 'adaptive-input-test-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    loader: { '.scss': 'empty' },
    plugins: [domOnlyInlineStyles],
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
  }).then(
    ({ outputFiles }) =>
      import(
        `data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`
      ),
  );
  return adaptive;
}

function pointer(
  window,
  type,
  { pointerId = 1, pointerType = 'mouse', isPrimary = true, button = 0, x = 0, y = 0 } = {},
) {
  // JSDOM may lack PointerEvent; a MouseEvent carries the fields the adapters read.
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
    isPrimary: { value: isPrimary },
  });
  return event;
}

function key(target, name, init = {}) {
  const event = new target.ownerDocument.defaultView.KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

// Unit capture stub; release fires lostpointercapture synchronously, the worst case.
function stubCapture(window, element) {
  const held = new Set();
  element.setPointerCapture = id => held.add(id);
  element.hasPointerCapture = id => held.has(id);
  element.releasePointerCapture = id => {
    if (held.delete(id))
      element.dispatchEvent(pointer(window, 'lostpointercapture', { pointerId: id }));
  };
  return held;
}

// Unit layout stub: fixed CSS px boxes; JSDOM performs no layout.
function place(element, left, top, width = 100, height = 40) {
  const rect = {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
  };
  element.getBoundingClientRect = () => rect;
  element.getClientRects = () => [rect];
}

test('PointerGesture follows one matched pointer through threshold, cancel and lost capture without touching native click', async () => {
  const { PointerGesture } = await loadAdaptive();
  const dom = new JSDOM(
    '<!doctype html><button id=handle>Move</button><div id=outside>Out</div><button id=plain>Plain</button>',
  );
  const { window } = dom;
  const handle = window.document.getElementById('handle');
  const outside = window.document.getElementById('outside');
  const plain = window.document.getElementById('plain');
  try {
    const held = stubCapture(window, handle);
    let clicks = 0;
    handle.addEventListener('click', () => {
      clicks += 1;
    });
    const seen = [];
    const gesture = new PointerGesture(handle, {
      threshold: 10,
      capture: true,
      onGesture: ({ phase, pointerId, pointerType, dx, dy, active }) =>
        seen.push({ phase, pointerId, pointerType, dx, dy, active }),
    });
    const fireOn = (target, type, init) =>
      assert.equal(
        target.dispatchEvent(pointer(window, type, init)),
        true,
        `${type} keeps its default`,
      );
    const fire = (type, init) => fireOn(handle, type, init);

    fire('pointerdown', { pointerId: 7, pointerType: 'pen', x: 10, y: 10 });
    assert.equal(gesture.gesturing, true);
    assert.deepEqual([...held], [7]);
    // A second pointer neither replaces nor moves nor cancels the tracked pen.
    fire('pointerdown', { pointerId: 8, pointerType: 'touch', x: 0, y: 0 });
    fire('pointermove', { pointerId: 8, x: 90, y: 90 });
    fire('pointermove', { pointerId: 7, x: 13, y: 14 });
    fire('pointermove', { pointerId: 7, x: 16, y: 18 });
    fire('pointercancel', { pointerId: 8 });
    fire('pointercancel', { pointerId: 7, x: 16, y: 18 });
    assert.deepEqual(seen, [
      { phase: 'start', pointerId: 7, pointerType: 'pen', dx: 0, dy: 0, active: false },
      { phase: 'move', pointerId: 7, pointerType: 'pen', dx: 6, dy: 8, active: true },
      { phase: 'cancel', pointerId: 7, pointerType: 'pen', dx: 6, dy: 8, active: true },
    ]);
    assert.equal(gesture.gesturing, false);
    assert.equal(held.size, 0);

    // Secondary and non-primary pointers do not start; a dropped capture cancels once.
    seen.length = 0;
    fire('pointerdown', { pointerId: 9, button: 2 });
    fire('pointerdown', { pointerId: 9, isPrimary: false });
    assert.equal(gesture.gesturing, false);
    fire('pointerdown', { pointerId: 9, pointerType: 'mouse' });
    held.clear();
    fire('lostpointercapture', { pointerId: 9, x: 2, y: 1 });
    fire('pointerup', { pointerId: 9, x: 2, y: 1 });
    assert.deepEqual(
      seen.map(event => event.phase),
      ['start', 'cancel'],
    );

    // Activation stays native: no click was synthesized and one real click is one click.
    assert.equal(clicks, 0);
    handle.click();
    assert.equal(clicks, 1);

    // Without capture, a release outside the element still ends the matched gesture
    // once, other ids are ignored, and the next gesture starts.
    const loose = [];
    const plainGesture = new PointerGesture(plain, {
      onGesture: ({ phase, pointerId, dx, dy }) => loose.push({ phase, pointerId, dx, dy }),
    });
    plain.addEventListener('click', () => {
      clicks += 1;
    });
    fireOn(plain, 'pointerdown', { pointerId: 21, x: 10, y: 10 });
    fireOn(outside, 'pointerup', { pointerId: 99, x: 50, y: 50 });
    fireOn(outside, 'pointercancel', { pointerId: 98 });
    assert.equal(plainGesture.gesturing, true);
    fireOn(outside, 'pointerup', { pointerId: 21, x: 40, y: 30 });
    assert.equal(plainGesture.gesturing, false);
    // A release on the element also bubbles to the document but is reported once.
    fireOn(plain, 'pointerdown', { pointerId: 22, x: 0, y: 0 });
    fireOn(plain, 'pointerup', { pointerId: 22, x: 1, y: 2 });
    // A window blur cancels at the last known position; the late release is ignored.
    fireOn(plain, 'pointerdown', { pointerId: 23, x: 0, y: 0 });
    fireOn(plain, 'pointermove', { pointerId: 23, x: 3, y: 4 });
    window.dispatchEvent(new window.Event('blur'));
    assert.equal(plainGesture.gesturing, false);
    fireOn(outside, 'pointerup', { pointerId: 23, x: 9, y: 9 });
    // Dispose mid-gesture stays silent and ignores late document releases and blur.
    fireOn(plain, 'pointerdown', { pointerId: 24, x: 0, y: 0 });
    plainGesture.dispose();
    assert.equal(plainGesture.gesturing, false);
    fireOn(outside, 'pointerup', { pointerId: 24, x: 5, y: 5 });
    window.dispatchEvent(new window.Event('blur'));
    assert.deepEqual(loose, [
      { phase: 'start', pointerId: 21, dx: 0, dy: 0 },
      { phase: 'end', pointerId: 21, dx: 30, dy: 20 },
      { phase: 'start', pointerId: 22, dx: 0, dy: 0 },
      { phase: 'end', pointerId: 22, dx: 1, dy: 2 },
      { phase: 'start', pointerId: 23, dx: 0, dy: 0 },
      { phase: 'move', pointerId: 23, dx: 3, dy: 4 },
      { phase: 'cancel', pointerId: 23, dx: 3, dy: 4 },
      { phase: 'start', pointerId: 24, dx: 0, dy: 0 },
    ]);
    assert.equal(clicks, 1);

    // A throwing setPointerCapture falls back to the document release.
    seen.length = 0;
    const setCapture = handle.setPointerCapture;
    handle.setPointerCapture = () => {
      throw new window.DOMException('No active pointer', 'NotFoundError');
    };
    fire('pointerdown', { pointerId: 31, x: 5, y: 5 });
    handle.setPointerCapture = setCapture;
    assert.equal(gesture.gesturing, true);
    assert.equal(held.size, 0);
    fireOn(outside, 'pointerup', { pointerId: 31, x: 9, y: 8 });
    assert.equal(gesture.gesturing, false);
    fire('pointerdown', { pointerId: 32, x: 0, y: 0 });
    assert.deepEqual([...held], [32]);
    fireOn(outside, 'pointerup', { pointerId: 32, x: 0, y: 0 });
    assert.equal(held.size, 0);
    assert.deepEqual(
      seen.map(({ phase, pointerId, dx, dy }) => ({ phase, pointerId, dx, dy })),
      [
        { phase: 'start', pointerId: 31, dx: 0, dy: 0 },
        { phase: 'end', pointerId: 31, dx: 4, dy: 3 },
        { phase: 'start', pointerId: 32, dx: 0, dy: 0 },
        { phase: 'end', pointerId: 32, dx: 0, dy: 0 },
      ],
    );
    assert.equal(clicks, 1);

    // Dispose releases a held capture silently, is idempotent and stops listening.
    seen.length = 0;
    fire('pointerdown', { pointerId: 11, pointerType: 'pen' });
    assert.deepEqual([...held], [11]);
    gesture.dispose();
    gesture.dispose();
    assert.equal(gesture.gesturing, false);
    assert.equal(held.size, 0);
    fire('pointerup', { pointerId: 11 });
    fireOn(outside, 'pointerup', { pointerId: 11 });
    window.dispatchEvent(new window.Event('blur'));
    fire('pointerdown', { pointerId: 12 });
    assert.deepEqual(
      seen.map(event => event.phase),
      ['start'],
    );
  } finally {
    window.close();
  }
});

test('SpatialNavigationAdapter moves only on an explicit living-room surface and leaves owned, modified and out-of-scope keys native', async () => {
  const { SpatialNavigationAdapter, livingRoomLayout, modality } = await loadAdaptive();
  const dom = new JSDOM(`<!doctype html><body>
<button id=outside data-spatial-target>Outside</button>
<section id=tv>
<button id=a data-spatial-target>A</button>
<button id=b data-spatial-target>B</button>
<button id=disabled data-spatial-target disabled>Disabled</button>
<div inert><button id=inert data-spatial-target>Inert</button></div>
<button id=below data-spatial-target>Below</button>
<button id=far data-spatial-target>Far</button>
<input id=text value=caret>
<div role=toolbar><button id=tool data-spatial-target>Tool</button></div>
<div id=dialog role=dialog><button id=d1 data-spatial-target>D1</button><button id=d2 data-spatial-target>D2</button></div>
</section>
<section id=web><button id=w1 data-spatial-target>W1</button><button id=w2 data-spatial-target>W2</button></section>
</body>`);
  const { window } = dom;
  const doc = window.document;
  const node = Object.fromEntries(
    [...doc.querySelectorAll('[id]')].map(element => [element.id, element]),
  );
  try {
    const boxes = {
      outside: [105, 0, 10],
      a: [0, 0],
      b: [120, 0],
      disabled: [0, 60],
      inert: [0, 120],
      below: [0, 200],
      far: [400, 200],
      text: [600, 100],
      tool: [600, 0],
      d1: [0, 300],
      d2: [120, 300],
      w1: [0, 0],
      w2: [120, 0],
    };
    for (const [id, [left, top, width]] of Object.entries(boxes)) place(node[id], left, top, width);
    const moves = [];
    let dialogOpen = false;
    // null is an explicit absence of any active scope; it never falls back to the boundary.
    let nullScope = false;
    const adapter = new SpatialNavigationAdapter(node.tv, {
      surface: 'living-room',
      scope: () => (nullScope ? null : dialogOpen ? node.dialog : node.tv),
      refocusOnRemoval: true,
      onNavigate: ({ from, to, direction }) => moves.push(`${from.id}>${to.id}:${direction}`),
    });
    const press = (element, name, init) => {
      element.focus();
      return key(element, name, init).defaultPrevented;
    };

    // Nearest target ahead; the closer outside-boundary, disabled and inert targets never win.
    assert.equal(press(node.a, 'ArrowRight'), true);
    assert.equal(doc.activeElement, node.b);
    assert.equal(press(node.b, 'ArrowLeft'), true);
    assert.equal(doc.activeElement, node.a);
    assert.equal(press(node.a, 'ArrowDown'), true);
    assert.equal(doc.activeElement, node.below);
    assert.deepEqual(moves, ['a>b:right', 'b>a:left', 'a>below:down']);

    // No candidate, modifiers, IME composition and an earlier handler keep native behavior.
    assert.equal(press(node.a, 'ArrowLeft'), false);
    assert.equal(press(node.a, 'ArrowRight', { shiftKey: true }), false);
    assert.equal(press(node.a, 'ArrowRight', { altKey: true }), false);
    assert.equal(press(node.a, 'ArrowRight', { isComposing: true }), false);
    node.a.addEventListener('keydown', event => event.preventDefault(), { once: true });
    press(node.a, 'ArrowRight');
    assert.equal(doc.activeElement, node.a);

    // The text caret and composite widgets own their arrows.
    assert.equal(press(node.text, 'ArrowRight'), false);
    assert.equal(doc.activeElement, node.text);
    assert.equal(press(node.tool, 'ArrowLeft'), false);
    assert.equal(doc.activeElement, node.tool);
    assert.equal(moves.length, 3);

    // A blurred window suspends handling until focus returns.
    window.dispatchEvent(new window.Event('blur'));
    assert.equal(press(node.a, 'ArrowRight'), false);
    window.dispatchEvent(new window.Event('focus'));
    assert.equal(press(node.a, 'ArrowRight'), true);
    assert.equal(doc.activeElement, node.b);

    // An open dialog is the only scope: keys behind it and moves out of it stay native.
    dialogOpen = true;
    assert.equal(press(node.a, 'ArrowRight'), false);
    assert.equal(press(node.d1, 'ArrowUp'), false);
    assert.equal(press(node.d1, 'ArrowRight'), true);
    assert.equal(doc.activeElement, node.d2);
    dialogOpen = false;
    assert.deepEqual(moves, ['a>b:right', 'b>a:left', 'a>below:down', 'a>b:right', 'd1>d2:right']);

    // An explicit null scope leaves every arrow native, even with targets ahead.
    nullScope = true;
    assert.equal(press(node.a, 'ArrowRight'), false);
    assert.equal(doc.activeElement, node.a);
    assert.equal(press(node.d1, 'ArrowRight'), false);
    assert.equal(doc.activeElement, node.d1);
    nullScope = false;

    // A pointermove on an eligible target makes it the next origin: from far, Up picks
    // tool (score 360) over b (520) and a (760), while Up from focused a has no target.
    // Synthetic unit pointermove only; JSDOM is neither remote nor pointer hardware.
    node.a.focus();
    node.far.dispatchEvent(pointer(window, 'pointermove', { x: 450, y: 220 }));
    assert.equal(doc.activeElement, node.a);
    assert.equal(press(node.a, 'ArrowUp'), true);
    assert.equal(doc.activeElement, node.tool);
    // A handled move hands the origin back to focus.
    assert.equal(press(node.a, 'ArrowRight'), true);
    assert.equal(doc.activeElement, node.b);
    assert.deepEqual(moves.slice(5), ['far>tool:up', 'a>b:right']);

    // The same markup on a web surface never moves focus; no width or device inference.
    const web = new SpatialNavigationAdapter(node.web, { surface: 'web', refocusOnRemoval: true });
    assert.equal(press(node.w1, 'ArrowRight'), false);
    assert.equal(doc.activeElement, node.w1);
    web.dispose();

    // Removing the focused target returns focus to the nearest remaining target.
    node.b.focus();
    node.b.remove();
    await delay(0);
    assert.equal(doc.activeElement, node.a);

    // Dispose is idempotent and removes key handling and the removal observer.
    adapter.dispose();
    adapter.dispose();
    assert.equal(press(node.a, 'ArrowRight'), false);
    node.a.remove();
    await delay(0);
    assert.ok(![node.tool, node.below, node.far, node.d1, node.d2].includes(doc.activeElement));

    // Nested Shells: the outer TV layout owns only its own controller. A nested web Shell keeps
    // native arrows, stays unmarked and never opens TV focus; a nested TV Shell handles its own
    // keys once; same-surface wrappers inside the outer Shell still navigate. Synthetic keys.
    const nested = new JSDOM(`<!doctype html><body>
<div id=tvshell data-adaptive-shell data-adaptive-surface=living-room>
<button id=t1>T1</button>
<div data-adaptive-surface=living-room><button id=t2>T2</button></div>
<div id=webshell data-adaptive-shell data-adaptive-surface=web><button id=n1 data-spatial-target>N1</button><button id=n2>N2</button></div>
<div id=tvinner data-adaptive-shell data-adaptive-surface=living-room><button id=v1>V1</button><button id=v2>V2</button></div>
<div id=wrap><button id=late>Late</button></div>
</div>
<div id=owner data-genux-provider-owner data-adaptive-surface=living-room><div id=genux data-adaptive-surface=living-room></div></div>
<div id=portal data-genux-portal data-adaptive-surface=living-room><button id=p1>P1</button><div data-adaptive-surface=web><button id=pw>PW</button></div></div>
<div id=webportal data-genux-portal data-adaptive-surface=web><button id=w>W</button></div>
<div id=foreign data-genux-provider-owner data-adaptive-surface=living-room><div id=fgen data-adaptive-surface=living-room></div></div>
<div id=stray data-genux-portal data-adaptive-surface=living-room><button id=s1>S1</button></div>
</body>`);
    const nestedDoc = nested.window.document;
    const part = Object.fromEntries(
      [...nestedDoc.querySelectorAll('[id]')].map(element => [element.id, element]),
    );
    try {
      const nestedBoxes = {
        t1: [0, 0],
        t2: [120, 0],
        n1: [240, 0],
        n2: [360, 0],
        v1: [0, 100],
        v2: [120, 100],
        late: [0, 200],
      };
      for (const [id, [left, top]] of Object.entries(nestedBoxes)) place(part[id], left, top);
      const release = modality.installInputModality(nestedDoc);
      const detachOuter = livingRoomLayout.attach(part.tvshell);
      const detachInner = livingRoomLayout.attach(part.tvinner);
      const mode = () => nestedDoc.documentElement.dataset.inputModality;
      const pointerOff = () => nestedDoc.body.dispatchEvent(pointer(nested.window, 'pointerdown'));
      const marker = element => element.getAttribute('data-spatial-target');
      const pressNested = (element, name) => {
        element.focus();
        return key(element, name).defaultPrevented;
      };

      // Markers stop at nested Shells; caller-owned values stay untouched.
      assert.equal(marker(part.t1), 'living-room');
      assert.equal(marker(part.t2), 'living-room');
      assert.equal(marker(part.n1), '');
      assert.equal(marker(part.n2), null);
      assert.equal(marker(part.v1), 'living-room');
      assert.equal(mode(), 'pointer');

      // Arrows inside the nested web Shell stay native and never open TV focus.
      assert.equal(pressNested(part.n1, 'ArrowRight'), false);
      assert.equal(nestedDoc.activeElement, part.n1);
      assert.equal(mode(), 'pointer');
      // Outer candidates and pointer origins never enter the nested web Shell.
      assert.equal(pressNested(part.t2, 'ArrowRight'), false);
      assert.equal(nestedDoc.activeElement, part.t2);
      part.n1.dispatchEvent(pointer(nested.window, 'pointermove', { x: 250, y: 10 }));
      // The same-surface wrapper still navigates and opens the one central focus mode.
      assert.equal(pressNested(part.t1, 'ArrowRight'), true);
      assert.equal(nestedDoc.activeElement, part.t2);
      assert.equal(mode(), 'keyboard');
      pointerOff();
      assert.equal(mode(), 'pointer');

      // A nested TV Shell handles its own arrow once; the outer adapter leaves it alone.
      assert.equal(pressNested(part.v1, 'ArrowRight'), true);
      assert.equal(nestedDoc.activeElement, part.v2);
      assert.equal(mode(), 'keyboard');
      pointerOff();

      // The central owner reads the nearest declared surface and the focused controller.
      part.n1.focus();
      modality.requestSpatialInputModality(part.tvshell);
      modality.requestSpatialInputModality(part.webshell);
      assert.equal(mode(), 'pointer');
      part.t1.focus();
      modality.requestSpatialInputModality(part.webshell);
      assert.equal(mode(), 'pointer');
      modality.requestSpatialInputModality(part.tvshell);
      assert.equal(mode(), 'keyboard');
      pointerOff();

      // Body portals: native layers render under body, outside the boundary. Focus there opens
      // the central mode only through a portal its own provider owner registered; web portals,
      // nested web content, foreign owners, unregistered and released portals stay closed.
      // Synthetic unit focus and requests; no browser portal or TV is claimed here. A missing
      // export falls back to no registration, so the old guard fails on behavior, not import.
      const registerPortal = modality.registerSpatialPortal ?? (() => () => {});
      const unregisterPortal = registerPortal(part.owner, part.portal);
      const unregisterWebPortal = registerPortal(part.owner, part.webportal);
      const requestFrom = (element, boundary) => {
        element.focus();
        modality.requestSpatialInputModality(boundary);
        return mode();
      };
      assert.equal(requestFrom(part.p1, part.genux), 'keyboard');
      pointerOff();
      assert.equal(mode(), 'pointer');
      assert.equal(requestFrom(part.pw, part.genux), 'pointer');
      assert.equal(requestFrom(part.w, part.genux), 'pointer');
      assert.equal(requestFrom(part.p1, part.fgen), 'pointer');
      assert.equal(requestFrom(part.s1, part.genux), 'pointer');
      unregisterPortal();
      unregisterPortal();
      assert.equal(requestFrom(part.p1, part.genux), 'pointer');
      unregisterWebPortal();
      assert.equal(requestFrom(part.p1, part.genux), 'pointer');

      // Ownership changes re-check markers; inserted nested web Shell content stays unmarked.
      part.wrap.setAttribute('data-adaptive-surface', 'web');
      await delay(0);
      assert.equal(marker(part.late), null);
      part.wrap.removeAttribute('data-adaptive-surface');
      await delay(0);
      assert.equal(marker(part.late), 'living-room');
      const added = nestedDoc.createElement('div');
      added.setAttribute('data-adaptive-shell', '');
      added.setAttribute('data-adaptive-surface', 'web');
      added.innerHTML = '<button>Fresh</button>';
      part.tvshell.append(added);
      await delay(0);
      assert.equal(marker(added.firstElementChild), null);

      // A stale outer surface leaks nothing: markers go and even caller targets stay native.
      part.tvshell.setAttribute('data-adaptive-surface', 'web');
      await delay(0);
      assert.equal(marker(part.t1), null);
      part.t1.setAttribute('data-spatial-target', '');
      part.t2.setAttribute('data-spatial-target', '');
      assert.equal(pressNested(part.t1, 'ArrowRight'), false);
      assert.equal(nestedDoc.activeElement, part.t1);
      assert.equal(mode(), 'pointer');
      part.tvshell.setAttribute('data-adaptive-surface', 'living-room');
      await delay(0);

      // Detach is idempotent and removes only its own markers.
      detachInner();
      detachOuter();
      detachOuter();
      release();
      assert.equal(marker(part.late), null);
      assert.equal(marker(part.v1), null);
      assert.equal(marker(part.n1), '');
      assert.equal(marker(part.t1), '');
    } finally {
      nested.window.close();
    }

    // Body portals: a native Modal renders into its Shell's registered body portal, outside every
    // Shell, so its keys never bubble to the Shell adapter. Ownership follows the nearest Shell:
    // only the Shell that registered a TV portal root holds it, through one pooled spatial
    // controller shared by that Shell's leases; a sibling Shell under the same provider, a
    // provider-only portal, web, foreign and unregistered roots stay native. Arrows stay inside
    // the open dialog. Synthetic unit keys and stubbed DOM rects, not physical geometry; no
    // browser portal, physical remote or TV is claimed here.
    const hosted = new JSDOM(`<!doctype html><body>
<div id=howner data-genux-provider-owner data-adaptive-surface=living-room>
<div id=shellA data-adaptive-shell data-adaptive-surface=living-room><button id=m1>M1</button></div>
<div id=shellB data-adaptive-shell data-adaptive-surface=living-room><button id=m2>M2</button></div>
</div>
<div id=hportal data-genux-portal data-adaptive-surface=living-room><button id=behind>Behind</button><div id=hdialog role=dialog aria-modal=true><button id=o1>OK</button><button id=o2>Cancel</button></div></div>
<div id=hweb data-genux-portal data-adaptive-surface=web><button id=x1>X1</button><button id=x2>X2</button></div>
<div id=fowner data-genux-provider-owner data-adaptive-surface=living-room></div>
<div id=fportal data-genux-portal data-adaptive-surface=living-room><button id=f1>F1</button><button id=f2>F2</button></div>
<div id=stray data-genux-portal data-adaptive-surface=living-room><button id=s1>S1</button><button id=s2>S2</button></div>
<div id=pportal data-genux-portal data-adaptive-surface=living-room><button id=q1>Q1</button><button id=q2>Q2</button></div>
</body>`);
    const hostedDoc = hosted.window.document;
    const host = Object.fromEntries(
      [...hostedDoc.querySelectorAll('[id]')].map(element => [element.id, element]),
    );
    try {
      const hostedBoxes = {
        behind: [0, 0],
        o1: [0, 100],
        o2: [120, 100],
        x1: [0, 200],
        x2: [120, 200],
        f1: [0, 300],
        f2: [120, 300],
        s1: [0, 400],
        s2: [120, 400],
        m1: [0, 500],
        m2: [120, 500],
        q1: [0, 600],
        q2: [120, 600],
      };
      for (const [id, [left, top]] of Object.entries(hostedBoxes)) place(host[id], left, top);
      place(host.hdialog, 0, 100, 240);
      const release = modality.installInputModality(hostedDoc);
      const mode = () => hostedDoc.documentElement.dataset.inputModality;
      const pointerOff = () => hostedDoc.body.dispatchEvent(pointer(hosted.window, 'pointerdown'));
      const marker = element => element.getAttribute('data-spatial-target');
      const pressHosted = (element, name) => {
        element.focus();
        return key(element, name).defaultPrevented;
      };
      const registerPortal = modality.registerSpatialPortal ?? (() => () => {});
      // The first lease on Shell A subscribes before registration; the second reads the live
      // registry. Shell B shares the provider but registers no portal of its own.
      const leaseA1 = livingRoomLayout.attach(host.shellA);
      const unregister = [
        registerPortal(host.shellA, host.hportal),
        registerPortal(host.shellA, host.hweb),
        registerPortal(host.howner, host.pportal),
        registerPortal(host.fowner, host.fportal),
      ];
      const leaseA2 = livingRoomLayout.attach(host.shellA);
      const detachB = livingRoomLayout.attach(host.shellB);
      // Ownership follows the nearest Shell: Shell A owns only its TV portal; Shell B, a sibling
      // under the same provider, owns none, and a provider-registered portal belongs to no Shell.
      assert.deepEqual(modality.getSpatialPortalsFor(host.shellA), [host.hportal]);
      assert.deepEqual(modality.getSpatialPortalsFor(host.shellB), []);
      assert.equal(marker(host.o1), 'living-room');
      assert.equal(marker(host.behind), 'living-room');
      assert.equal(marker(host.x1), null);
      assert.equal(marker(host.q1), null);
      assert.equal(marker(host.f1), null);
      assert.equal(marker(host.s1), null);

      // One handled arrow inside the portal dialog moves exactly once and opens the central mode.
      host.o1.focus();
      pointerOff();
      assert.equal(mode(), 'pointer');
      let focusMoves = 0;
      host.hportal.addEventListener('focusin', () => {
        focusMoves += 1;
      });
      assert.equal(key(host.o1, 'ArrowRight').defaultPrevented, true);
      assert.equal(hostedDoc.activeElement, host.o2);
      assert.equal(focusMoves, 1);
      assert.equal(mode(), 'keyboard');
      pointerOff();

      // The open dialog is the only scope: the target behind it stays out of reach.
      assert.equal(pressHosted(host.o1, 'ArrowUp'), false);
      assert.equal(hostedDoc.activeElement, host.o1);
      // Web, provider-only, foreign and unregistered roots keep native arrows and never open the
      // mode.
      for (const element of [host.x1, host.q1, host.f1, host.s1]) {
        assert.equal(pressHosted(element, 'ArrowRight'), false);
        assert.equal(hostedDoc.activeElement, element);
      }
      assert.equal(mode(), 'pointer');

      // Both leases on Shell A share one pooled controller: releasing one leaves it working and
      // still moves focus exactly once per handled arrow.
      leaseA1();
      leaseA1();
      assert.equal(marker(host.o1), 'living-room');
      host.o1.focus();
      focusMoves = 0;
      assert.equal(key(host.o1, 'ArrowRight').defaultPrevented, true);
      assert.equal(hostedDoc.activeElement, host.o2);
      assert.equal(focusMoves, 1);
      assert.equal(mode(), 'keyboard');
      pointerOff();
      // The final lease on Shell A releases markers and arrows even while Shell B stays
      // attached, because Shell B never held that portal; later registrations attach nothing.
      leaseA2();
      assert.equal(marker(host.o1), null);
      assert.equal(pressHosted(host.o1, 'ArrowRight'), false);
      assert.equal(hostedDoc.activeElement, host.o1);
      assert.equal(mode(), 'pointer');
      detachB();
      for (const drop of unregister) drop();
      const unregisterAgain = registerPortal(host.shellA, host.hportal);
      assert.equal(marker(host.o1), null);
      unregisterAgain();
      release();
    } finally {
      hosted.window.close();
    }

    // Single-line fields on a TV surface: Left/Right stay with the caret even at either edge of an
    // empty value, while Up/Down leave the field because a remote has no other way out. Checkbox
    // and button inputs own no arrows unless a composite owns them; multiline, rich text, select,
    // combobox, radio, range and number fields keep every arrow. Synthetic unit keys and stubbed
    // rects; no physical remote, IME or TV is claimed here.
    const fieldsDom = new JSDOM(`<!doctype html><body>
<section id=form>
<button id=up data-spatial-target>Up</button>
<button id=left data-spatial-target>Left</button>
<input id=line data-spatial-target>
<button id=right data-spatial-target>Right</button>
<button id=down data-spatial-target>Down</button>
<textarea id=area data-spatial-target></textarea>
<div id=rich contenteditable=true tabindex=0>Rich</div>
<select id=pick data-spatial-target><option>One</option><option>Two</option></select>
<input id=combo role=combobox data-spatial-target>
<input id=radio type=radio name=choice data-spatial-target>
<input id=range type=range data-spatial-target>
<input id=count type=number data-spatial-target>
<input id=check type=checkbox data-spatial-target>
<input id=action type=button value=Act data-spatial-target>
<div role=toolbar><input id=grouped type=checkbox data-spatial-target></div>
</section>
<section id=webform><input id=webline data-spatial-target><button id=webdown data-spatial-target>Web down</button></section>
</body>`);
    const fieldDoc = fieldsDom.window.document;
    const own = Object.fromEntries(
      [...fieldDoc.querySelectorAll('[id]')].map(element => [element.id, element]),
    );
    try {
      // Every field under test shares one box, so none lies ahead of another.
      const shared = ['line', 'area', 'rich', 'pick', 'combo', 'radio', 'range', 'count'];
      for (const id of [...shared, 'check', 'action', 'grouped']) place(own[id], 120, 100);
      const fieldBoxes = {
        up: [120, 0],
        left: [0, 100],
        right: [240, 100],
        down: [120, 200],
        webline: [0, 400],
        webdown: [0, 500],
      };
      for (const [id, [left, top]] of Object.entries(fieldBoxes)) place(own[id], left, top);
      const fieldMoves = [];
      const formAdapter = new SpatialNavigationAdapter(own.form, {
        surface: 'living-room',
        onNavigate: ({ from, to, direction }) =>
          fieldMoves.push(`${from.id}>${to.id}:${direction}`),
      });
      const pressField = (element, name, init) => {
        element.focus();
        return key(element, name, init).defaultPrevented;
      };
      const exits = {
        ArrowUp: own.up,
        ArrowDown: own.down,
        ArrowLeft: own.left,
        ArrowRight: own.right,
      };

      // Up/Down leave every single-line field; Left/Right never escape the caret.
      for (const type of [null, 'text', 'password', 'email', 'url', 'tel', 'search']) {
        if (type === null) own.line.removeAttribute('type');
        else own.line.setAttribute('type', type);
        const label = type ?? 'default';
        for (const name of ['ArrowLeft', 'ArrowRight']) {
          assert.equal(pressField(own.line, name), false, `${label} ${name} stays with the caret`);
          assert.equal(fieldDoc.activeElement, own.line);
        }
        assert.equal(pressField(own.line, 'ArrowDown'), true, `${label} ArrowDown leaves`);
        assert.equal(fieldDoc.activeElement, own.down);
        assert.equal(pressField(own.line, 'ArrowUp'), true, `${label} ArrowUp leaves`);
        assert.equal(fieldDoc.activeElement, own.up);
      }
      assert.equal(fieldMoves.length, 14);

      // Modifiers, IME composition and an earlier handler keep the field's native keys.
      own.line.setAttribute('type', 'text');
      for (const init of [
        { shiftKey: true },
        { altKey: true },
        { ctrlKey: true },
        { metaKey: true },
        { isComposing: true },
      ]) {
        assert.equal(pressField(own.line, 'ArrowDown', init), false);
        assert.equal(fieldDoc.activeElement, own.line);
      }
      own.line.addEventListener('keydown', event => event.preventDefault(), { once: true });
      pressField(own.line, 'ArrowDown');
      assert.equal(fieldDoc.activeElement, own.line);

      // Multiline, rich text, select, combobox, radio, range, number and a composite-owned
      // checkbox keep every arrow.
      for (const owner of shared
        .slice(1)
        .map(id => own[id])
        .concat(own.grouped)) {
        for (const name of Object.keys(exits)) {
          assert.equal(pressField(owner, name), false, `${owner.id} owns ${name}`);
          assert.equal(fieldDoc.activeElement, owner);
        }
      }

      // Checkbox and button inputs have no arrow behavior of their own, so every arrow moves.
      for (const control of [own.check, own.action]) {
        for (const [name, exit] of Object.entries(exits)) {
          assert.equal(pressField(control, name), true, `${control.id} ${name} moves`);
          assert.equal(fieldDoc.activeElement, exit);
        }
      }
      assert.deepEqual(fieldMoves.slice(14), [
        'check>up:up',
        'check>down:down',
        'check>left:left',
        'check>right:right',
        'action>up:up',
        'action>down:down',
        'action>left:left',
        'action>right:right',
      ]);

      // The same field on a web surface keeps every arrow; a disposed adapter does too.
      const webForm = new SpatialNavigationAdapter(own.webform, { surface: 'web' });
      assert.equal(pressField(own.webline, 'ArrowDown'), false);
      assert.equal(fieldDoc.activeElement, own.webline);
      webForm.dispose();
      formAdapter.dispose();
      assert.equal(pressField(own.line, 'ArrowDown'), false);
      assert.equal(fieldDoc.activeElement, own.line);
      assert.equal(fieldMoves.length, 22);
    } finally {
      fieldsDom.window.close();
    }
  } finally {
    window.close();
  }
});

test('WebOSInputAdapter reports only observed input and consumes Back only when a layer, history or platform handled it', async () => {
  const { WebOSInputAdapter } = await loadAdaptive();
  const dom = new JSDOM('<!doctype html><button id=tile>Tile</button>');
  const { window } = dom;
  const doc = window.document;
  const tile = doc.getElementById('tile');
  try {
    const handled = [];
    let layers = 1;
    let history = 2;
    const adapter = new WebOSInputAdapter(doc, {
      surface: 'living-room',
      back: {
        closeTopLayer() {
          handled.push('layer');
          if (layers === 0) return false;
          layers -= 1;
          return true;
        },
        navigateBack() {
          handled.push('history');
          if (history === 1) return false;
          history -= 1;
          return true;
        },
        platformBack() {
          handled.push('platform');
          return false;
        },
      },
    });
    let notifications = 0;
    adapter.subscribe(() => {
      notifications += 1;
    });
    const initial = adapter.getSnapshot();
    assert.deepEqual(initial, { cursorVisible: null, activeInput: 'unknown' });
    assert.ok(Object.isFrozen(initial));
    assert.equal(adapter.getSnapshot(), initial);
    assert.deepEqual(adapter.getServerSnapshot(), initial);

    // Unit stand-in for the platform event: only a boolean visibility detail counts.
    const cursor = detail =>
      tile.dispatchEvent(new window.CustomEvent('cursorStateChange', { bubbles: true, detail }));
    cursor({ visibility: 'visible' });
    cursor(null);
    assert.equal(adapter.getSnapshot(), initial);
    assert.equal(notifications, 0);
    cursor({ visibility: true });
    assert.deepEqual(adapter.getSnapshot(), { cursorVisible: true, activeInput: 'pointer' });
    cursor({ visibility: true });
    cursor({ visibility: false });
    assert.deepEqual(adapter.getSnapshot(), { cursorVisible: false, activeInput: 'pointer' });
    assert.equal(notifications, 2);

    // Wheel stays native: nothing is prevented, activated or reclassified.
    let clicks = 0;
    tile.addEventListener('click', () => {
      clicks += 1;
    });
    tile.focus();
    const settled = adapter.getSnapshot();
    const wheel = new window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    assert.equal(tile.dispatchEvent(wheel), true);
    assert.equal(clicks, 0);
    assert.equal(adapter.getSnapshot(), settled);

    // Arrows report the remote; touch does not claim the pointer; a mouse does.
    assert.equal(key(tile, 'ArrowDown').defaultPrevented, false);
    assert.equal(adapter.getSnapshot().activeInput, 'remote');
    tile.dispatchEvent(pointer(window, 'pointerdown', { pointerType: 'touch' }));
    assert.equal(adapter.getSnapshot().activeInput, 'remote');
    tile.dispatchEvent(pointer(window, 'pointermove', { pointerType: 'mouse' }));
    assert.equal(adapter.getSnapshot().activeInput, 'pointer');

    // A blurred window ignores arrows, cursor, pointer and Back until focus returns.
    window.dispatchEvent(new window.Event('blur'));
    const paused = adapter.getSnapshot();
    const pausedCount = notifications;
    assert.equal(key(tile, 'ArrowDown').defaultPrevented, false);
    cursor({ visibility: true });
    tile.dispatchEvent(pointer(window, 'pointermove', { pointerType: 'mouse' }));
    assert.equal(key(tile, 'GoBack').defaultPrevented, false);
    assert.equal(adapter.getSnapshot(), paused);
    assert.equal(notifications, pausedCount);
    assert.deepEqual(handled, []);
    window.dispatchEvent(new window.Event('focus'));
    assert.equal(key(tile, 'ArrowDown').defaultPrevented, false);
    assert.deepEqual(adapter.getSnapshot(), { cursorVisible: false, activeInput: 'remote' });
    assert.equal(notifications, pausedCount + 1);

    // Back: top layer, then history, then platform; only a handled step consumes the key.
    assert.equal(key(tile, 'GoBack').defaultPrevented, true);
    assert.deepEqual(handled, ['layer']);
    assert.equal(adapter.getSnapshot().activeInput, 'remote');
    assert.equal(key(tile, 'GoBack', { repeat: true }).defaultPrevented, false);
    assert.equal(key(tile, 'GoBack', { isComposing: true }).defaultPrevented, false);
    tile.addEventListener('keydown', event => event.preventDefault(), { once: true });
    key(tile, 'GoBack');
    assert.deepEqual(handled, ['layer']);
    assert.equal(key(tile, 'BrowserBack').defaultPrevented, true);
    assert.deepEqual(handled, ['layer', 'layer', 'history']);
    assert.equal(key(tile, 'GoBack').defaultPrevented, false);
    assert.deepEqual(handled, ['layer', 'layer', 'history', 'layer', 'history', 'platform']);
    assert.equal(clicks, 0);

    // A web surface observes nothing, even with Back handlers and an injected target.
    const surface = doc.createElement('div');
    const webHandled = [];
    const web = new WebOSInputAdapter(doc, {
      surface: 'web',
      target: surface,
      back: {
        closeTopLayer() {
          webHandled.push('layer');
          return true;
        },
      },
    });
    assert.equal(key(surface, 'GoBack').defaultPrevented, false);
    surface.dispatchEvent(
      new window.CustomEvent('cursorStateChange', { detail: { visibility: true } }),
    );
    assert.deepEqual(webHandled, []);
    assert.deepEqual(web.getSnapshot(), { cursorVisible: null, activeInput: 'unknown' });
    web.dispose();

    // Dispose is idempotent and stops every observation and notification.
    const before = adapter.getSnapshot();
    const count = notifications;
    adapter.dispose();
    adapter.dispose();
    assert.equal(key(tile, 'GoBack').defaultPrevented, false);
    tile.dispatchEvent(pointer(window, 'pointermove', { pointerType: 'mouse' }));
    cursor({ visibility: true });
    assert.equal(adapter.getSnapshot(), before);
    assert.equal(notifications, count);
    assert.equal(handled.length, 6);
  } finally {
    window.close();
  }
});

test('Layout modules carry their own compiled CSS and install it once per owner document only on attach', async () => {
  const { layoutLoaders, withLayoutStyles, livingRoomLayout, modality } = await loadAdaptive();
  // DOM-only: fixture strings stand in for compiled CSS; real Sass output is checked in browsers.
  const profiles = ['phone', 'tablet', 'laptop', 'desktop', 'wide', 'living-room'];
  assert.deepEqual(Object.keys(layoutLoaders), profiles);
  for (const profile of profiles) {
    const entry = await layoutLoaders[profile]();
    assert.equal(entry.profile, profile);
    // Each profile owns exactly its own stylesheet instead of a side-effect import.
    assert.equal(entry.cssText, styleFixture(`docs/src/styles/adaptive-layouts/${profile}.scss`));
    assert.equal(typeof entry.attach, 'function');
    assert.ok(Object.isFrozen(entry));
  }
  assert.equal(await layoutLoaders['living-room'](), livingRoomLayout);

  // Only nonempty compiled CSS is accepted.
  const base = { profile: 'phone', className: 'adaptive-layout-phone', navigation: 'drawer' };
  for (const empty of ['', '   ', undefined, null])
    assert.throws(() => withLayoutStyles(base, empty), /phone has no compiled CSS/);

  const first = new JSDOM('<!doctype html><body><div id=a></div><div id=b></div></body>');
  const second = new JSDOM('<!doctype html><body><div id=c></div></body>');
  const styles = doc =>
    [...doc.querySelectorAll('style[data-adaptive-layout-style]')].map(style => [
      style.getAttribute('data-adaptive-layout-style'),
      style.textContent,
      style.parentElement.localName,
    ]);
  try {
    const firstDoc = first.window.document;
    const secondDoc = second.window.document;
    const css = '.adaptive-layout-phone { display: grid; }';
    const calls = [];
    const phone = withLayoutStyles(
      {
        ...base,
        attach: root => {
          // The original attach runs after the style is in its own document.
          calls.push(`attach ${root.id} ${styles(root.ownerDocument).length}`);
          return () => calls.push(`detach ${root.id}`);
        },
      },
      css,
    );
    assert.equal(phone.cssText, css);
    // Wrapping installs nothing; only attach does.
    assert.deepEqual(styles(firstDoc), []);
    const detachA = phone.attach(firstDoc.getElementById('a'));
    const detachB = phone.attach(firstDoc.getElementById('b'));
    assert.deepEqual(styles(firstDoc), [['phone', css, 'head']]);
    detachA();
    detachB();
    // Cleanup keeps the class-scoped style for the next attach in this document.
    assert.deepEqual(styles(firstDoc), [['phone', css, 'head']]);
    // A cached module reused in another document installs there too, leaving the first alone.
    assert.deepEqual(styles(secondDoc), []);
    phone.attach(secondDoc.getElementById('c'))();
    assert.deepEqual(styles(secondDoc), [['phone', css, 'head']]);
    assert.deepEqual(styles(firstDoc), [['phone', css, 'head']]);
    assert.deepEqual(calls, [
      'attach a 1',
      'attach b 1',
      'detach a',
      'detach b',
      'attach c 1',
      'detach c',
    ]);

    // Without an original attach the wrapper still installs and returns a cleanup.
    const tablet = withLayoutStyles(
      { profile: 'tablet', className: 'adaptive-layout-tablet', navigation: 'rail' },
      '.adaptive-layout-tablet { display: grid; }',
    );
    const detachTablet = tablet.attach(firstDoc.getElementById('a'));
    assert.equal(typeof detachTablet, 'function');
    detachTablet();
    assert.deepEqual(
      styles(firstDoc).map(([profile]) => profile),
      ['phone', 'tablet'],
    );

    // The TV layout installs its own CSS and keeps its original controller cleanup.
    const release = modality.installInputModality(firstDoc);
    const detachTv = livingRoomLayout.attach(firstDoc.getElementById('b'));
    detachTv();
    release();
    assert.deepEqual(styles(firstDoc).at(-1), ['living-room', livingRoomLayout.cssText, 'head']);
  } finally {
    first.window.close();
    second.window.close();
  }
});
