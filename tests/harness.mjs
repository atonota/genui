import { JSDOM } from 'jsdom';
import vm from 'node:vm';

export function setup(html, { storage } = {}) {
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'https://genux.test/',
  });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollTo = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  const getStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = node => getStyle(node);
  window.Math.random = () => 0.25;
  window.Date.now = () => 1791840000000;
  if (storage !== undefined) Object.defineProperty(window, 'localStorage', { value: storage });
  const context = dom.getInternalVMContext();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script, context);
  const doc = window.document;
  const read = source => vm.runInContext(source, context);
  const el = id => {
    const node = doc.getElementById(id);
    if (!node) throw new Error(`Missing ${id}`);
    return node;
  };
  const click = id => el(id).click();
  const change = (id, value) => {
    const node = el(id);
    if (node.type === 'checkbox') node.checked = value;
    else node.value = value;
    node.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  const key = (id, key) =>
    el(id).dispatchEvent(
      new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
  const close = () => {
    read('formDropdowns.forEach(d=>d.destroy());cancelOperationDemo()');
    window.close();
  };
  return { dom, doc, window, read, el, click, change, key, close };
}

// Explicitly no layout engine, resource loading, screenshots, or browser automation.
export function record(h) {
  const clone = h.doc.body.cloneNode(true);
  const localeDictionary = clone.querySelector('#genux-i18n-tr');
  if (
    localeDictionary?.nextSibling?.nodeType === 3 &&
    localeDictionary.nextSibling.nodeValue === '\n'
  )
    localeDictionary.nextSibling.remove();
  clone.querySelectorAll('script').forEach(node => node.remove());
  const controls = [...h.doc.querySelectorAll('input,textarea,select')].map(node => ({
    id: node.id,
    name: node.name,
    value: node.value,
    checked: node.checked,
    indeterminate: node.indeterminate,
    selectionStart: node.selectionStart,
    selectionEnd: node.selectionEnd,
    disabled: node.disabled,
    readOnly: node.readOnly,
  }));
  return { markup: clone.outerHTML, controls, focus: h.doc.activeElement?.id || '' };
}

export const settle = () => new Promise(resolve => setTimeout(resolve, 40));
