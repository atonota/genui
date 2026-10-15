import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(testDirectory, '../..');

// JSDOM exercises DOM/state semantics only. These shims provide browser contracts
// needed by AntD; they neither measure layout nor render visual comparisons.
function installDom() {
  const channels = [];
  const timers = new Set();
  const nativeSetTimeout = globalThis.setTimeout;
  const nativeClearTimeout = globalThis.clearTimeout;
  const NativeMessageChannel = globalThis.MessageChannel;
  class TrackedMessageChannel extends NativeMessageChannel {
    constructor() {
      super();
      channels.push(this);
    }
  }
  const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', {
    url: 'https://atlas.test/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.matchMedia = query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  });
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.Element.prototype.scrollIntoView = function () {};
  window.scrollTo = function () {};
  const computedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = element => computedStyle(element);

  const globals = {
    window,
    document: window.document,
    navigator: window.navigator,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    MessageChannel: TrackedMessageChannel,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    HTMLFormElement: window.HTMLFormElement,
    Element: window.Element,
    SVGElement: window.SVGElement,
    ShadowRoot: window.ShadowRoot,
    Document: window.Document,
    DocumentFragment: window.DocumentFragment,
    Node: window.Node,
    Text: window.Text,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    FocusEvent: window.FocusEvent,
    InputEvent: window.InputEvent,
    CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver,
    ResizeObserver: window.ResizeObserver,
    getComputedStyle: window.getComputedStyle,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    setTimeout(callback, milliseconds, ...args) {
      const timer = nativeSetTimeout(() => {
        timers.delete(timer);
        callback(...args);
      }, milliseconds);
      timers.add(timer);
      return timer;
    },
    clearTimeout(timer) {
      timers.delete(timer);
      nativeClearTimeout(timer);
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const descriptors = new Map();
  for (const [name, value] of Object.entries(globals)) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  return {
    dom,
    window,
    document: window.document,
    restore() {
      // rc-select/form retain their real channels at module scope. Leave them
      // usable for later mounts but do not let idle ports keep Node running.
      for (const { port1, port2 } of channels) {
        port1.unref();
        port2.unref();
      }
      // Like window.close(), dispose test-owned timers before removing DOM globals.
      for (const timer of timers) nativeClearTimeout(timer);
      timers.clear();
      dom.window.close();
      for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

export async function mountPattern(
  exportName,
  entry = 'docs/src/react/Patterns.tsx',
  props = {},
  providerProps = {},
  csf = false,
) {
  const environment = installDom();
  const modulePath = resolve(testDirectory, `.patterns-${randomUUID()}.mjs`);
  let root;
  let act;
  try {
    const compiled = await build({
      absWorkingDir: projectDirectory,
      stdin: {
        contents: `export * as pattern from './${entry}'; export { setLocale as setTestLocale } from './docs/src/i18n.ts'; ${csf ? "export { default as preview } from './.storybook/preview.tsx';" : ''}`,
        resolveDir: projectDirectory,
        sourcefile: 'pattern-test-entry.ts',
        loader: 'ts',
      },
      bundle: true,
      packages: 'external',
      write: false,
      format: 'esm',
      platform: 'node',
      target: 'node24',
      jsx: 'automatic',
      // Styles are imported by page-specific examples. DOM tests deliberately
      // ignore them; production/style gates cover emitted CSS separately.
      plugins: [
        {
          name: 'dom-only-css',
          setup(builder) {
            builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
          },
        },
      ],
    });
    await writeFile(modulePath, compiled.outputFiles[0].contents, { flag: 'wx' });
    // rc-util caches DOM support at import time, so all React/AntD imports follow
    // environment setup. Runtime packages stay external to preserve one React.
    const [React, ReactDOM, components, AntD] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import(pathToFileURL(modulePath).href),
      import('antd'),
    ]);
    const meta = csf ? components.pattern.default : null;
    const story = csf ? components.pattern[exportName] : null;
    if (csf && (!meta?.component || !story || meta.render || story.render))
      throw new Error('CSF harness requires a declared component and a standard component story');
    const component = csf ? meta.component : components.pattern[exportName];
    const renderProps = csf ? { ...meta.args, ...story.args, ...props } : props;
    let Render = () => React.createElement(component, renderProps);
    if (csf) {
      const context = {
        parameters: { ...components.preview.parameters, ...meta.parameters, ...story.parameters },
        args: renderProps,
      };
      for (const decorate of [...(components.preview.decorators ?? [])].reverse()) {
        const Inner = Render;
        Render = () => decorate(Inner, context);
      }
    }
    act = React.act;
    root = ReactDOM.createRoot(environment.document.querySelector('#root'));
    await act(async () => {
      root.render(
        React.createElement(
          AntD.ConfigProvider,
          { ...providerProps, theme: { token: { motion: false } } },
          React.createElement(Render),
        ),
      );
    });
    return {
      ...environment,
      setLocale: components.setTestLocale,
      async act(callback) {
        await act(callback);
      },
      async click(element) {
        if (!element) throw new Error('Click target missing');
        await act(async () => {
          element.click();
          await delay(5);
        });
      },
      async type(element, value) {
        if (!element) throw new Error('Input target missing');
        const prototype =
          element.tagName === 'TEXTAREA'
            ? environment.window.HTMLTextAreaElement.prototype
            : environment.window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
        await act(async () => {
          setter.call(element, value);
          element.dispatchEvent(new environment.window.Event('input', { bubbles: true }));
          element.dispatchEvent(new environment.window.Event('change', { bubbles: true }));
        });
      },
      async submit(form) {
        if (!form) throw new Error('Form target missing');
        await act(async () => {
          form.dispatchEvent(
            new environment.window.Event('submit', { bubbles: true, cancelable: true }),
          );
        });
      },
      async waitFor(predicate, description, timeout = 1500) {
        const end = Date.now() + timeout;
        while (!predicate()) {
          if (Date.now() >= end) throw new Error(`Timed out: ${description}`);
          await act(async () => {
            await delay(10);
          });
        }
      },
      async dispose() {
        await act(async () => {
          root.unmount();
        });
        // Allow pending rc-util cleanup tasks to complete while DOM globals exist.
        await delay(0);
        environment.restore();
        await unlink(modulePath);
      },
    };
  } catch (error) {
    if (root && act)
      await act(async () => {
        root.unmount();
      });
    environment.restore();
    await unlink(modulePath).catch(failure => {
      if (failure.code !== 'ENOENT') throw failure;
    });
    throw error;
  }
}

export function buttonByText(scope, text) {
  return [...scope.querySelectorAll('button')].find(button => button.textContent.trim() === text);
}

export function headerByText(scope, text) {
  return [...scope.querySelectorAll('[role="tab"], [role="button"]')].find(
    button => button.textContent.trim() === text,
  );
}

export async function selectOption(harness, input, text) {
  if (!input) throw new Error('Select target missing');
  const control = input.closest('.ant-select');
  await harness.act(async () => {
    control.dispatchEvent(
      new harness.window.MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
  });
  await harness.waitFor(
    () =>
      [...harness.document.querySelectorAll('.ant-select-item-option')].some(
        option => option.textContent.trim() === text,
      ),
    `Select option ${text}`,
  );
  const option = [...harness.document.querySelectorAll('.ant-select-item-option')].find(
    item => item.textContent.trim() === text,
  );
  await harness.click(option);
}

/** Exercise the actual CSF component, args and preview decorators, without CSS rendering. */
export function mountStory(entry, exportName = 'Variants') {
  return mountPattern(exportName, entry, {}, {}, true);
}
