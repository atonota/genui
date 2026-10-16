// Remembers the DocsNav categories list scroll position for the browser session, so ordinary
// links and back/forward navigation keep the list where the reader left it. Only the
// [data-docs-nav-scroll] container scrolls; the document and focus are never moved.
const storageKey = 'atlas-docs-nav-scroll';
// Dispatched on the document by docs-shell once the menu Drawer has opened and has layout.
const shownEvent = 'atlas-docs-nav-shown';

const readStored = (view: Window): number | null => {
  try {
    const raw = view.sessionStorage.getItem(storageKey);
    const value = raw == null || raw === '' ? Number.NaN : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
};

/** Restores and records the navigation scroll; the returned disposer removes its listeners. */
export function installDocsNavState(root: Document): () => void {
  const view = root.defaultView;
  const scroller = root.querySelector<HTMLElement>('[data-docs-nav-scroll]');
  if (!view || !scroller || scroller.hasAttribute('data-docs-nav-state-ready')) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  // Inside the closed Drawer the list is unrendered and has no scroll range, so it neither
  // saves (which would overwrite the position with 0) nor restores.
  const rendered = () => scroller.clientHeight > 0;
  let frame = 0;
  let shown = false;

  const save = () => {
    if (!rendered()) return;
    try {
      view.sessionStorage.setItem(storageKey, String(Math.round(scroller.scrollTop)));
    } catch {
      // Storage can be unavailable; the list still works without memory.
    }
  };
  // A visible active link never moves the list; a clipped one is revealed by the minimal
  // scroll of this container only, never scrollIntoView, so the document stays put.
  const revealActive = () => {
    const active = scroller.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!active || active.getClientRects().length === 0) return;
    const box = scroller.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.top < box.top) scroller.scrollTop -= box.top - item.top;
    else if (item.bottom > box.bottom)
      scroller.scrollTop += Math.min(item.bottom - box.bottom, item.top - box.top);
  };
  const restore = () => {
    shown = rendered();
    if (!shown) return;
    const stored = readStored(view);
    if (stored != null) {
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTop = Math.min(stored, max);
    }
    revealActive();
  };

  scroller.addEventListener(
    'scroll',
    () => {
      if (frame) return;
      frame = view.requestAnimationFrame(() => {
        frame = 0;
        save();
      });
    },
    { passive: true, signal },
  );
  scroller.addEventListener('click', save, { capture: true, signal });
  view.addEventListener('pagehide', save, { signal });
  view.addEventListener(
    'pageshow',
    event => {
      if (event.persisted) restore();
    },
    { signal },
  );
  // The opened Drawer restores synchronously, before focus moves or the reader scrolls; the
  // later ResizeObserver callback then finds it shown and leaves a fresh scroll alone.
  root.addEventListener(shownEvent, restore, { signal });
  // Moving the sidebar into or out of the Drawer resets its scroll; restore when it shows again.
  const observer =
    'ResizeObserver' in view
      ? new view.ResizeObserver(() => {
          const next = rendered();
          if (next && !shown) restore();
          shown = next;
        })
      : null;
  scroller.setAttribute('data-docs-nav-state-ready', '');
  restore();
  observer?.observe(scroller);

  return () => {
    controller.abort();
    observer?.disconnect();
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    scroller.removeAttribute('data-docs-nav-state-ready');
  };
}
