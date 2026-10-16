// Component page Inspector (DocsInspector.astro): one closed native dialog. From 1900px it
// opens non-modal with show() and docks before the contents rail; below it opens with
// showModal(). It only speaks the preview stage contract on the document: stages publish
// genui-preview-focus and the Inspector dispatches genui-preview-control.
export type PreviewDevice = 'iphone' | 'ipad' | 'macbook' | 'tv';
export type PreviewTheme = 'light' | 'dark';
export interface PreviewControlDetail {
  scope: 'focused' | 'all';
  device?: PreviewDevice;
  theme?: PreviewTheme;
  grid?: boolean;
  action?: 'settings';
}
export interface PreviewFocusDetail {
  id: string;
  title: string;
  device: PreviewDevice;
  theme: PreviewTheme;
  grid: boolean;
}
export const previewControlEvent = 'genui-preview-control';
export const previewFocusEvent = 'genui-preview-focus';
// 118.75rem = 1900px; rem keeps zoomed text on the modal layout, as in layout.css.
const dockedQuery = '(min-width: 118.75rem)';
const devices: readonly unknown[] = ['iphone', 'ipad', 'macbook', 'tv'];
const isDevice = (value: unknown): value is PreviewDevice => devices.includes(value);
const isTheme = (value: unknown): value is PreviewTheme => value === 'light' || value === 'dark';

function focusDetail(value: unknown): PreviewFocusDetail | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { id, title, device, theme, grid } = value as Record<string, unknown>;
  return typeof id === 'string' &&
    typeof title === 'string' &&
    isDevice(device) &&
    isTheme(theme) &&
    typeof grid === 'boolean'
    ? { id, title, device, theme, grid }
    : undefined;
}

/** Wires the opener, dialog lifecycle and controls; the disposer restores the SSR state. */
export function installDocsInspector(root: Document): () => void {
  const view = root.defaultView;
  const dialog = root.querySelector<HTMLDialogElement>('dialog[data-docs-inspector]');
  if (!view || !dialog || dialog.hasAttribute('data-docs-inspector-ready')) return () => {};

  const openers = [...root.querySelectorAll<HTMLButtonElement>('[data-docs-inspector-open]')];
  const closer = dialog.querySelector<HTMLButtonElement>('[data-docs-inspector-close]');
  const groups = [
    ...dialog.querySelectorAll<HTMLFieldSetElement>('[data-docs-inspector-controls]'),
  ];
  const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('[data-preview-control]')];
  const empty = dialog.querySelector<HTMLElement>('[data-docs-inspector-empty]');
  const focused = dialog.querySelector<HTMLElement>('[data-docs-inspector-focus]');
  const title = dialog.querySelector<HTMLElement>('[data-docs-inspector-title]');
  const docked = view.matchMedia(dockedQuery);
  const controller = new AbortController();
  const { signal } = controller;
  const state: Required<Omit<PreviewControlDetail, 'action'>> = {
    scope: 'focused',
    device: 'macbook',
    theme: 'light',
    grid: false,
  };
  let opener: HTMLElement | undefined;

  const paint = () => {
    for (const button of buttons) {
      const { previewControl: key, previewValue: value } = button.dataset;
      if (key === 'grid') button.setAttribute('aria-pressed', String(state.grid));
      else if (key === 'scope' || key === 'device' || key === 'theme')
        button.setAttribute('aria-pressed', String(state[key] === value));
    }
  };
  const sync = () => {
    for (const button of closer ? [...openers, closer] : openers)
      button.setAttribute('aria-expanded', String(dialog.open));
  };
  const show = () => (docked.matches ? dialog.show() : dialog.showModal());
  const send = (detail: PreviewControlDetail) =>
    root.dispatchEvent(new view.CustomEvent(previewControlEvent, { detail }));

  for (const button of openers) {
    button.addEventListener(
      'click',
      () => {
        opener = button;
        if (dialog.open) return closer?.focus();
        show();
        sync();
      },
      { signal },
    );
    button.hidden = false;
  }
  closer?.addEventListener('click', () => dialog.close(), { signal });
  // Reopening after a breakpoint change queues a close event while the dialog is open again.
  dialog.addEventListener(
    'close',
    () => {
      if (dialog.open) return;
      sync();
      const active = root.activeElement;
      if (!active || active === root.body || dialog.contains(active)) opener?.focus();
    },
    { signal },
  );
  // The docked dialog has no native close request; Escape closes it like the modal one.
  dialog.addEventListener(
    'keydown',
    event => {
      if (event.key !== 'Escape' || !docked.matches) return;
      event.preventDefault();
      dialog.close();
    },
    { signal },
  );
  dialog.addEventListener(
    'click',
    event => {
      if (event.target !== dialog || docked.matches) return;
      const box = dialog.getBoundingClientRect();
      const { clientX: x, clientY: y } = event;
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) dialog.close();
    },
    { signal },
  );
  // Crossing 1900px reopens the same element in the other mode; controls and focus stay.
  docked.addEventListener(
    'change',
    () => {
      if (!dialog.open) return;
      const active = root.activeElement;
      dialog.close();
      show();
      sync();
      if (active instanceof view.HTMLElement && dialog.contains(active)) active.focus();
    },
    { signal },
  );

  for (const button of buttons)
    button.addEventListener(
      'click',
      () => {
        const { previewControl: key, previewValue: value } = button.dataset;
        let detail: PreviewControlDetail;
        if (key === 'grid') {
          state.grid = !state.grid;
          detail = { scope: state.scope, grid: state.grid };
        } else if (key === 'scope' && (value === 'focused' || value === 'all')) {
          state.scope = value;
          detail = { scope: value };
        } else if (key === 'device' && isDevice(value)) {
          state.device = value;
          detail = { scope: state.scope, device: value };
        } else if (key === 'theme' && isTheme(value)) {
          state.theme = value;
          detail = { scope: state.scope, theme: value };
        } else if (key === 'action' && value === 'settings') {
          // The real props editor is the Tweaker inside the focused preview document.
          if (!docked.matches) dialog.close();
          detail = { scope: 'focused', action: 'settings' };
        } else return;
        paint();
        send(detail);
      },
      { signal },
    );

  root.addEventListener(
    previewFocusEvent,
    event => {
      const detail = focusDetail((event as CustomEvent<unknown>).detail);
      if (!detail) return;
      state.device = detail.device;
      state.theme = detail.theme;
      state.grid = detail.grid;
      dialog.dataset.previewFocus = detail.id;
      if (title) title.textContent = detail.title;
      if (empty) empty.hidden = true;
      if (focused) focused.hidden = false;
      for (const group of groups) group.disabled = false;
      paint();
    },
    { signal },
  );

  paint();
  sync();
  dialog.setAttribute('data-docs-inspector-ready', '');

  return () => {
    controller.abort();
    if (dialog.open) dialog.close();
    for (const button of openers) button.hidden = true;
    for (const group of groups) group.disabled = true;
    dialog.removeAttribute('data-docs-inspector-ready');
  };
}
