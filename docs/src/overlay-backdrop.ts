/**
 * GenUX overlay backdrop controller (paint only).
 *
 * Tracks visible non-modal popups (Select/Cascader/AutoComplete, Picker,
 * Dropdown, Popover/Popconfirm, Tooltip) and publishes the shared paint contract:
 *   body[data-genux-overlay-open]  set to true while any popup is visible
 *   --genux-overlay-clip           clip-path for the body scrim pseudo element:
 *                                  outer scope rect with evenodd holes for every
 *                                  active popup rect and bound trigger paint rect
 *   --genux-overlay-active-z       derived scrim z, base --overlay-scrim-z
 * On close only the attribute drops: clip and z stay frozen until the body::before fade
 * really ends, so the fading scrim keeps the trigger hole and never doubles a native mask.
 * Colour, opacity and blur live in the stylesheet tokens. This module never
 * calls preventDefault/focus/blur, never reparents nodes, never closes layers.
 */

const POPUP_SELECTOR =
  '.ant-select-dropdown, .ant-cascader-dropdown, .ant-picker-dropdown, .ant-dropdown, .ant-popover, .ant-tooltip';
const EXCLUDE_SELECTOR = '.ant-message, .genux-toast, .ant-notification, .genux-notification';
const TRIGGER_ID_ATTRS = ['aria-controls', 'aria-describedby', 'aria-owns'] as const;
const TRIGGER_FALLBACK =
  '.ant-dropdown-open, .ant-popover-open, .ant-select-open, .ant-picker-focused, [aria-haspopup][aria-expanded=true]';
const PICKER_CONTROL = '.genux-date-time-control';
const TRIGGER_PAINT_ROOT =
  '.ant-select, .ant-picker, .ant-input-affix-wrapper, .ant-input-number, .ant-btn, .ant-dropdown-trigger, .ant-dropdown-open, .ant-popover-open';
const DIALOG_CONTENT = '.ant-modal-content, .ant-drawer-content, .ant-drawer-section'; // AntD 6 Drawer paints its dialog as .ant-drawer-section
const DIALOG_ROOT = '.ant-modal-wrap, .ant-drawer';
const OPEN_ATTR = 'data-genux-overlay-open';
const CLIP_VAR = '--genux-overlay-clip';
const Z_VAR = '--genux-overlay-active-z';
const BASE_Z_VAR = '--overlay-scrim-z';
const OBSERVED_ATTRS = [
  'class',
  'style',
  'hidden',
  'aria-hidden',
  'aria-expanded',
  ...TRIGGER_ID_ATTRS,
];

type Box = { x: number; y: number; w: number; h: number };
type Popup = { el: Element; box: Box; triggers: Element[] };

function toBox(rect: DOMRect): Box | null {
  const b = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
  return b.w > 0 && b.h > 0 && [b.x, b.y, b.w, b.h].every(Number.isFinite) ? b : null;
}

function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** Pieces of `a` not covered by `b` (at most four rectangles). */
function subtract(a: Box, b: Box): Box[] {
  const o = intersect(a, b);
  if (!o) return [a];
  const ax2 = a.x + a.w,
    ay2 = a.y + a.h,
    ox2 = o.x + o.w,
    oy2 = o.y + o.h;
  const out: Box[] = [];
  if (o.y > a.y) out.push({ x: a.x, y: a.y, w: a.w, h: o.y - a.y });
  if (oy2 < ay2) out.push({ x: a.x, y: oy2, w: a.w, h: ay2 - oy2 });
  if (o.x > a.x) out.push({ x: a.x, y: o.y, w: o.x - a.x, h: o.h });
  if (ox2 < ax2) out.push({ x: ox2, y: o.y, w: ax2 - ox2, h: o.h });
  return out;
}

/** Clip every hole to the scope and keep holes pairwise disjoint so evenodd never re-fills overlaps. */
function disjointHoles(scope: Box, boxes: Box[]): Box[] {
  const holes: Box[] = [];
  for (const raw of boxes) {
    const clipped = intersect(raw, scope);
    if (!clipped) continue;
    let pieces = [clipped];
    for (const hole of holes) pieces = pieces.flatMap(p => subtract(p, hole));
    holes.push(...pieces);
  }
  return holes;
}

const px = (n: number): string => String(Math.round(n * 100) / 100);
const rectPath = (b: Box): string =>
  `M${px(b.x)} ${px(b.y)}H${px(b.x + b.w)}V${px(b.y + b.h)}H${px(b.x)}Z`;

function visibleBox(el: Element, viewport: Box): Box | null {
  if (el.closest(EXCLUDE_SELECTOR)) return null;
  const box = toBox(el.getBoundingClientRect()); // zero rect when el or any ancestor is display:none
  if (!box || !intersect(box, viewport)) return null;
  const cs = getComputedStyle(el); // visibility is inherited, so ancestor hidden is covered too
  return cs.display === 'none' || cs.visibility === 'hidden' ? null : box;
}

function paintRoot(trigger: Element): Element | null {
  const root = trigger.closest(PICKER_CONTROL) ?? trigger.closest(TRIGGER_PAINT_ROOT) ?? trigger;
  // Never punch out a whole card; the popup hole alone is enough in that case.
  return root.classList.contains('ant-card') || root.querySelector('.ant-card') ? null : root;
}

function collectTriggers(popups: Popup[]): Set<Element> {
  const all = new Set<Element>();
  const refs = document.querySelectorAll(TRIGGER_ID_ATTRS.map(a => `[${a}]`).join(','));
  refs.forEach(el => {
    for (const attr of TRIGGER_ID_ATTRS) {
      for (const id of (el.getAttribute(attr) ?? '').split(/\s+/)) {
        const target = id ? document.getElementById(id) : null; // exact id lookup, never a built selector
        const popup = target && popups.find(p => p.el === target || p.el.contains(target));
        if (popup && !all.has(el)) {
          all.add(el);
          popup.triggers.push(el);
        }
      }
    }
  });
  const fallback = Array.from(document.querySelectorAll(TRIGGER_FALLBACK)).filter(
    el => !all.has(el),
  );
  for (const p of popups)
    if (!p.triggers.length) p.triggers.push(...fallback.filter(t => !p.el.contains(t)));
  fallback.forEach(el => all.add(el));
  return all;
}

function dialogOf(p: Popup): Element | null {
  for (const t of p.triggers) {
    const d = t.closest(DIALOG_CONTENT); // dialog comes from the trigger; the popup portal may live outside
    if (d) return d;
  }
  return p.el.closest(DIALOG_CONTENT);
}

/** Central scrim z token, body first (inherits root); without it sit right under the lowest popup instead of a fixed role value. */
function readBaseZ(popups: Popup[]): number {
  for (const el of [document.body, document.documentElement]) {
    const raw = parseInt(getComputedStyle(el).getPropertyValue(BASE_Z_VAR), 10);
    if (Number.isFinite(raw)) return raw;
  }
  const zs = popups.map(p => parseInt(getComputedStyle(p.el).zIndex, 10)).filter(Number.isFinite);
  return zs.length ? Math.min(...zs) - 1 : 0;
}

let installed = false;
let running = false;
let frame = 0;
let observer: MutationObserver | null = null;
let ownStyleWrites = 0; // html style mutation records produced by write(); onMutate skips exactly these
let bindings = new Map<Element, Element[]>(); // popup -> triggers bound while open, kept through its native leave
let closing = false;
let closeGen = 0; // bumped by reopen/suspend so a stale fade end never clears a live scrim
let closeTimer = 0;
let bound: Array<[EventTarget, string, AddEventListenerOptions]> = [];
let lifecycle: Array<[EventTarget, string, () => void]> = [];

function setVar(name: string, value: string): void {
  const style = document.documentElement.style;
  if (style.getPropertyValue(name) === value) return;
  value ? style.setProperty(name, value) : style.removeProperty(name);
  ownStyleWrites += 1;
}

/**
 * Compares against the live DOM, not a cache, so an external reset of html style or the body attribute
 * self-heals on the next paint. Vars land before the attribute so the scrim is never active without its
 * clip; every write is synchronous inside the one scheduled animation frame.
 */
function write(open: boolean, clip: string, z: string): void {
  setVar(CLIP_VAR, clip);
  setVar(Z_VAR, z);
  const body = document.body;
  if (open !== body.hasAttribute(OPEN_ATTR))
    open ? body.setAttribute(OPEN_ATTR, 'true') : body.removeAttribute(OPEN_ATTR);
}

/** Longest computed body::before fade (duration + delay) in ms; 0 when reduced motion removes it. */
function fadeMs(): number {
  const cs = getComputedStyle(document.body, '::before');
  const ms = (list: string): number[] =>
    list.split(',').map(v => (parseFloat(v) || 0) * (/ms\s*$/.test(v) ? 1 : 1000));
  const delays = ms(cs.transitionDelay);
  return Math.max(
    0,
    ...ms(cs.transitionDuration).map((d, i) => d + (delays[i % delays.length] ?? 0)),
  );
}

function cancelClose(): void {
  closing = false;
  closeGen += 1;
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = 0;
}

function finishClose(gen: number): void {
  if (!closing || gen !== closeGen) return;
  cancelClose();
  write(false, '', '');
}

/**
 * Drops only the open attribute so the scrim fades out with the close tokens while clip and z stay
 * frozen; both clear when the real body::before transition ends, computed timing as the fallback.
 */
function close(): void {
  bindings = new Map();
  if (closing) return;
  const body = document.body;
  if (!body.hasAttribute(OPEN_ATTR)) return write(false, '', '');
  closing = true;
  const gen = ++closeGen;
  body.removeAttribute(OPEN_ATTR);
  const done = (): void => finishClose(gen);
  const fades =
    typeof body.getAnimations === 'function'
      ? body.getAnimations({ subtree: true }).filter(a => {
          const effect = a.effect as KeyframeEffect | null;
          return effect?.target === body && effect.pseudoElement === '::before';
        })
      : [];
  if (fades.length) {
    Promise.all(fades.map(a => a.finished)).then(done, done); // a reopen cancels the fade and bumps closeGen
    return;
  }
  const wait = fadeMs();
  if (wait > 0) closeTimer = window.setTimeout(done, wait);
  else done();
}

function paint(): void {
  const viewport: Box = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  const popups: Popup[] = [];
  document.querySelectorAll(POPUP_SELECTOR).forEach(el => {
    const box = visibleBox(el, viewport);
    if (box) popups.push({ el, box, triggers: [] });
  });
  if (!popups.length) return close();
  if (closing) cancelClose(); // reopen during the fade reverses it from the current level, never a second scrim
  const triggers = collectTriggers(popups);
  const next = new Map<Element, Element[]>();
  for (const p of popups) {
    // Native leave drops .ant-*-open/aria-expanded while the popup still paints; keep its bound trigger hole.
    for (const t of bindings.get(p.el) ?? [])
      if (t.isConnected && !p.triggers.includes(t)) {
        p.triggers.push(t);
        triggers.add(t);
      }
    next.set(p.el, p.triggers.slice());
  }
  bindings = next;
  let scope = viewport;
  let z = readBaseZ(popups);
  const dialogs = popups.map(dialogOf);
  const dialog = dialogs.every(Boolean) ? dialogs[dialogs.length - 1] : null;
  if (dialog) {
    const raw = toBox(dialog.getBoundingClientRect());
    const box = raw && intersect(raw, viewport);
    if (box) {
      scope = box; // native Modal/Drawer mask already dims outside the dialog; never double it
      const rootZ = parseInt(getComputedStyle(dialog.closest(DIALOG_ROOT) ?? dialog).zIndex, 10);
      if (Number.isFinite(rootZ)) z = Math.max(z, rootZ + 1);
    }
  }
  const boxes = popups.map(p => p.box);
  triggers.forEach(t => {
    const root = paintRoot(t);
    const box = root && toBox(root.getBoundingClientRect());
    if (box) boxes.push(box);
  });
  const path = [rectPath(scope), ...disjointHoles(scope, boxes).map(rectPath)].join(' ');
  write(true, `path(evenodd, "${path}")`, String(z));
}

function schedule(): void {
  if (!running || frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    paint();
  });
}

function onMutate(records: MutationRecord[]): void {
  let external = false;
  for (const r of records) {
    if (r.target === document.documentElement && r.attributeName === 'style') {
      // Only this controller's own property writes are skipped; an external theme or custom z edit repaints.
      if (ownStyleWrites > 0) ownStyleWrites -= 1;
      else external = true;
    } else if (!(r.target === document.body && r.attributeName === OPEN_ATTR)) {
      external = true;
    }
  }
  if (external) schedule(); // a spurious repaint writes nothing (write is idempotent), so no observer loop
}

/** Built lazily on the client: module load must not touch window/document (SSR pages import this file). */
function listeners(): Array<[EventTarget, string, AddEventListenerOptions]> {
  return [
    [window, 'resize', { passive: true }],
    [document, 'scroll', { capture: true, passive: true }],
    [document, 'transitionend', { capture: true, passive: true }],
    [document, 'animationend', { capture: true, passive: true }],
  ];
}

function resume(): void {
  if (!installed || running) return;
  running = true;
  ownStyleWrites = 0; // records queued before suspend() were dropped with the old observer
  observer = new MutationObserver(onMutate);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: OBSERVED_ATTRS,
  });
  bound = listeners();
  for (const [target, type, opts] of bound) target.addEventListener(type, schedule, opts);
  schedule();
}

function suspend(): void {
  if (!running) return;
  running = false;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  observer?.disconnect();
  observer = null;
  for (const [target, type, opts] of bound) target.removeEventListener(type, schedule, opts);
  bound = [];
  cancelClose();
  bindings = new Map();
  write(false, '', '');
}

function lifecycleHandlers(): Array<[EventTarget, string, () => void]> {
  return [
    [window, 'pagehide', suspend],
    [window, 'pageshow', resume],
    [document, 'astro:before-swap', suspend],
    [document, 'astro:after-swap', resume],
  ];
}

function uninstall(): void {
  if (!installed) return;
  installed = false;
  suspend();
  for (const [target, type, fn] of lifecycle) target.removeEventListener(type, fn);
  lifecycle = [];
}

/** Installs the singleton controller; returns its disposer. Safe to call during SSR. */
export function installOverlayBackdrop(): () => void {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof MutationObserver === 'undefined'
  )
    return () => {};
  if (installed) return uninstall;
  installed = true;
  lifecycle = lifecycleHandlers();
  for (const [target, type, fn] of lifecycle) target.addEventListener(type, fn);
  resume();
  return uninstall;
}
