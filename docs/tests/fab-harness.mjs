// React harness for the FAB hook checks in fab.test.mjs. The real useFab.ts is bundled with esbuild into a temporary
// directory; installed packages stay external through absolute paths because that directory cannot resolve
// node_modules, so the hook and this harness share one React instance.
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireFromDocs = createRequire(join(docsRoot, 'package.json'));
const GLOBALS = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'FocusEvent',
  'PointerEvent',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
];

// CommonJS entries first, so packages such as antd load their Node-compatible build; ESM-only packages fall back.
function resolvePackage(specifier) {
  try {
    return requireFromDocs.resolve(specifier);
  } catch {
    try {
      return fileURLToPath(import.meta.resolve(specifier));
    } catch {
      return null;
    }
  }
}

const toUrl = path => (path.startsWith('node:') ? path : pathToFileURL(path).href);

async function loadPackage(specifier) {
  const path = resolvePackage(specifier);
  assert.ok(path, `${specifier} is installed for the FAB hook harness`);
  const module = await import(toUrl(path));
  return module.default ?? module;
}

async function bundleHook(dir) {
  const outfile = join(dir, 'fab-hook.mjs');
  const source = path => JSON.stringify(join(docsRoot, path));
  await build({
    stdin: {
      contents: [
        `export { useFab } from ${source('src/react/fab/useFab.ts')};`,
        `export { normalizeFabOptions, FAB_MOTION, actionUnavailableReason } from ${source('src/fab/options.ts')};`,
        `export { previewDocumentSelector } from './src/react/PreviewContext';`,
        `export { default as GenUXTweaker } from './src/react/GenUXTweaker';`,
        `export { GenUXAppearanceContext } from './src/react/GenUXAppearance';`,
      ].join(' '),
      resolveDir: docsRoot,
      sourcefile: 'fab-hook-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    jsx: 'automatic',
    outfile,
    logLevel: 'silent',
    loader: { '.css': 'empty', '.less': 'empty', '.scss': 'empty' },
    define: {
      'import.meta.env': JSON.stringify({
        DEV: true,
        PROD: false,
        SSR: false,
        MODE: 'test',
        BASE_URL: '/',
      }),
    },
    plugins: [
      {
        name: 'external-installed-packages',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^[^./]/ }, ({ path }) => {
            const resolved = resolvePackage(path);
            return resolved ? { path: toUrl(resolved), external: true } : undefined;
          });
        },
      },
    ],
  });
  return outfile;
}

// Builds an element for the hook's own preview selector; an unsupported selector form fails visibly.
function boundaryFor(document, selector) {
  const element = document.createElement('div');
  const part = selector.split(',')[0].trim();
  if (part.startsWith('.')) element.classList.add(part.slice(1));
  else if (part.startsWith('[') && part.endsWith(']')) {
    const [name, value = ''] = part.slice(1, -1).split('=');
    element.setAttribute(name.trim(), value.trim().replace(/^['"]|['"]$/g, ''));
  }
  assert.ok(element.matches(selector), `the preview boundary ${selector} can be built`);
  return element;
}

export async function openFabHarness() {
  const saved = GLOBALS.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const tmp = await mkdtemp(join(tmpdir(), 'genux-fab-hook-'));
  // Only reduced-motion query lists are reactive; assigning media.reduced emits a change event to their listeners.
  const reducedLists = new Set();
  let reduced = true;
  const media = {
    hover: false,
    get reduced() {
      return reduced;
    },
    set reduced(value) {
      if (reduced === value) return;
      reduced = value;
      for (const list of [...reducedLists]) list.emit();
    },
  };
  let window;
  let React;
  let createRoot;
  let hook;
  const restore = async () => {
    window?.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    await rm(tmp, { recursive: true, force: true });
  };
  try {
    const { JSDOM } = await loadPackage('jsdom');
    ({ window } = new JSDOM('<!doctype html><html><body></body></html>', {
      pretendToBeVisual: true,
      url: 'https://genux.test/',
    }));
    window.matchMedia = query => {
      const reduces = query.includes('reduce');
      // media.hover models an attached mouse on a hybrid device: any-hover and any-pointer: fine follow it,
      // while the primary hover and pointer queries stay coarse.
      const fineHover = query.includes('any-hover: hover') || query.includes('any-pointer: fine');
      const listeners = new Set();
      const list = {
        media: query,
        get matches() {
          return reduces ? media.reduced : fineHover && media.hover;
        },
        onchange: null,
        addEventListener(type, listener) {
          if (type === 'change' && reduces && listener) listeners.add(listener);
        },
        removeEventListener(type, listener) {
          if (type === 'change') listeners.delete(listener);
        },
        addListener(listener) {
          if (reduces && listener) listeners.add(listener);
        },
        removeListener(listener) {
          listeners.delete(listener);
        },
        dispatchEvent: () => false,
        // A real MediaQueryListEvent where the window has one, otherwise a change Event carrying matches and media.
        emit() {
          const matches = media.reduced;
          const event = window.MediaQueryListEvent
            ? new window.MediaQueryListEvent('change', { matches, media: query })
            : Object.defineProperties(new window.Event('change'), {
                matches: { value: matches },
                media: { value: query },
              });
          if (typeof list.onchange === 'function') list.onchange(event);
          for (const listener of [...listeners]) {
            if (typeof listener === 'function') listener.call(list, event);
            else listener.handleEvent?.(event);
          }
        },
      };
      if (reduces) reducedLists.add(list);
      return list;
    };
    for (const key of GLOBALS) {
      const value = key === 'IS_REACT_ACT_ENVIRONMENT' ? true : window[key];
      const bound = typeof value === 'function' && /^[a-z]/.test(key) ? value.bind(window) : value;
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bound });
    }
    React = await loadPackage('react');
    ({ createRoot } = await loadPackage('react-dom/client'));
    hook = await import(pathToFileURL(await bundleHook(tmp)).href);
  } catch (error) {
    await restore();
    throw error;
  }

  const h = React.createElement;
  let controller = null;
  let root = null;
  let page = null;
  let childOwnsEscape = false;
  // Opt-in per mount: the real GenUXTweaker and the docs appearance its fixed opener needs wrap the Harness.
  let tweaker = false;
  const act = async fn => {
    let result;
    await React.act(async () => {
      result = await fn();
    });
    return result;
  };

  function Harness({ props, options }) {
    const fab = hook.useFab(props, hook.normalizeFabOptions(options));
    controller = fab;
    const online = props.online ?? true;
    // A controller exposing activeActionId is the only roving owner. An older controller keeps the former renderer's
    // first available action as a competing native tab stop, so its roving defects stay visible.
    const rovingOwned = 'activeActionId' in fab;
    const firstStop = fab.actions.findIndex(item => !hook.actionUnavailableReason(item, online));
    return h(
      'div',
      { ref: fab.rootRef },
      h(
        'div',
        { ref: fab.triggerRef, ...fab.triggerHandlers },
        h('button', { type: 'button', className: 'trigger' }, 'Menu'),
      ),
      h(
        'div',
        { role: 'menu', ...fab.groupHandlers },
        fab.open &&
          fab.actions.map((item, index) => {
            // A link is a native anchor, which has no native Space activation; other actions are buttons.
            const link = item.actionType === 'link' && Boolean(item.href);
            // A running action is not activatable, so its control reports itself unavailable.
            const unavailable =
              item.loading === true ||
              (fab.busyIds ?? []).includes(item.id) ||
              Boolean(hook.actionUnavailableReason(item, online));
            const tabStop = rovingOwned ? item.id === fab.activeActionId : index === firstStop;
            return h(link ? 'a' : 'button', {
              // Production wraps each consecutive group run in its own parent, so a group change remounts the control
              // under another parent; ordinary renders keep the same key and stay mounted.
              key: JSON.stringify([item.group ?? null, item.id]),
              ...(link
                ? { href: item.href }
                : { type: 'button', disabled: item.disabled === true }),
              // The production wrapper carries the action id; this harness collapses that wrapper, so every native
              // control carries it itself and the hook identifies the real owner of the focused element.
              'data-fab-action-id': item.id,
              // Anchors and buttons are both menuitems, as in the production renderer.
              role: 'menuitem',
              className: 'genux-fab-action',
              'aria-label': item.label,
              'aria-disabled': unavailable ? 'true' : undefined,
              tabIndex: tabStop ? 0 : -1,
              onClick: () => void fab.invoke(item),
              onKeyDown: event => {
                // A composite child that owns Escape prevents the React event before the hook handles it.
                if (childOwnsEscape && event.key === 'Escape') event.preventDefault();
                fab.actionKeyDown(event, item.id);
              },
            });
          }),
      ),
    );
  }

  function createPage() {
    const { document } = window;
    const make = (tag, attributes = {}) => Object.assign(document.createElement(tag), attributes);
    const shell = make('nav');
    const outside = make('button', { type: 'button', textContent: 'Outside' });
    const preview = boundaryFor(document, hook.previewDocumentSelector);
    const sibling = make('section');
    const legacy = make('aside');
    const dialog = make('div');
    const host = make('div');
    legacy.setAttribute('inert', 'legacy');
    dialog.setAttribute('role', 'dialog');
    shell.append(outside);
    preview.append(sibling, legacy, dialog, host);
    document.body.replaceChildren(shell, preview);
    return { shell, outside, preview, sibling, legacy, dialog, host };
  }

  const unmount = async () => {
    const current = root;
    root = null;
    if (current) await act(() => current.unmount());
  };
  // The opt-in Tweaker wraps the same unkeyed Harness on every render, so the hook never remounts under it.
  const tree = (props, options) => {
    const harness = h(Harness, { props, options });
    if (!tweaker) return harness;
    return h(
      hook.GenUXAppearanceContext.Provider,
      { value: 'docs' },
      h(hook.GenUXTweaker, { settings: null }, harness),
    );
  };
  const render = (props, options) => act(() => root.render(tree(props, options)));
  const dispatch = (target, event) => act(() => target.dispatchEvent(event));
  const pointer = (target, type, { pointerType = 'mouse', clientX = 0, clientY = 0 } = {}) => {
    const init = {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      pointerId: 1,
      pointerType,
      isPrimary: true,
    };
    const event = window.PointerEvent
      ? new window.PointerEvent(type, init)
      : new window.MouseEvent(type, init);
    if (!window.PointerEvent) {
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        pointerType: { value: pointerType },
        isPrimary: { value: true },
      });
    }
    return dispatch(target, event);
  };

  return {
    window,
    media,
    act,
    render,
    dispatch,
    pointer,
    FAB_MOTION: hook.FAB_MOTION,
    get fab() {
      return controller;
    },
    get page() {
      return page;
    },
    unmount,
    // Makes each action's own React onKeyDown consume Escape, as a composite child would.
    consumeChildEscape(value) {
      childOwnsEscape = value;
    },
    // { tweaker: true } mounts inside the real GenUXTweaker; the default mount is unchanged.
    async mount(props, options, { tweaker: withTweaker = false } = {}) {
      await unmount();
      tweaker = withTweaker;
      page = createPage();
      root = createRoot(page.host);
      await render(props, options);
    },
    trigger: () => page.host.querySelector('.trigger'),
    // The real fixed Tweaker opener of an opt-in Tweaker mount.
    tweakerOpener: () => page.host.querySelector('.genux-tweaker-trigger button'),
    actions: () => Array.from(page.host.querySelectorAll('.genux-fab-action')),
    focus: target => act(() => target.focus()),
    // detail 0 is how browsers report Enter or Space activation of a native button.
    click: (target, detail = 1) =>
      dispatch(
        target,
        new window.MouseEvent('click', { bubbles: true, cancelable: true, detail, button: 0 }),
      ),
    key: (target, key, init = {}) =>
      dispatch(
        target,
        new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
      ),
    invoke: (action, confirmed) => act(() => controller.invoke(action, confirmed)),
    async start(action) {
      let pending;
      await act(() => {
        pending = controller.invoke(action);
      });
      return { pending };
    },
    // The hook schedules through window.setTimeout, so the JSDOM window borrows the node:test mocked timers.
    async withTimers(run) {
      const native = { setTimeout: window.setTimeout, clearTimeout: window.clearTimeout };
      mock.timers.enable({ apis: ['setTimeout'] });
      Object.assign(window, {
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
      });
      try {
        await run(ms => act(() => mock.timers.tick(ms)));
      } finally {
        Object.assign(window, native);
        mock.timers.reset();
      }
    },
    async close() {
      try {
        await unmount();
      } finally {
        await restore();
      }
    },
  };
}
