import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * FOCUS-01 (P1-A) RED control.
 * (a) Real Tab traversal of every documentation route listed by the shared shell: keyboard
 *     focus paints one allowed, non-surrounding indicator resolved from --focus-bg,
 *     --focus-indicator-color and --focus-indicator-width, with >= 3:1 contrast, >= 14px
 *     text and no obscuring layer (WCAG 2.4.11).
 * (b) Pointer focus on representative native controls paints nothing beyond hover.
 * Forced colors are inactive here, so every painted outline is a violation.
 */

type Capture = { done: boolean; stuck: boolean; label: string; violations: string[] };

interface Focus01Probe {
  settle(): Promise<void>;
  capture(): Capture;
  flush(): string[];
  pointerBaseline(target: Element): void;
  pointerCompare(target: Element, stateful: boolean): string[];
}

declare global {
  interface Window {
    __focus01?: Focus01Probe;
  }
}

const NL = String.fromCharCode(10);
const MAX_TAB_STOPS = 1500;

/* Serialized into every document by addInitScript; it must stay self-contained. */
function installFocusProbe(): void {
  const PROPS = [
    'outline-style',
    'outline-width',
    'box-shadow',
    'background-color',
    'background-image',
    'color',
    'text-decoration-line',
    'text-decoration-color',
    'text-decoration-thickness',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'transform',
    'scale',
    'opacity',
    'content',
    'width',
    'height',
    'bottom',
    'position',
    'background-size',
    'background-position',
    'background-repeat',
  ];
  const PSEUDOS = ['', '::before', '::after'];
  const EDGES = ['top', 'right', 'bottom', 'left'];
  const STRUCTURAL = [
    'outline-style',
    'outline-width',
    'text-decoration-line',
    'text-decoration-thickness',
    'background-image',
    ...EDGES.map(edge => `border-${edge}-width`),
  ];
  const PAINT = [
    'background-color',
    'color',
    'box-shadow',
    'text-decoration-color',
    'transform',
    'scale',
    'opacity',
    ...EDGES.map(edge => `border-${edge}-color`),
  ];
  const ROLES = ['--focus-bg', '--focus-indicator-color', '--focus-indicator-width'];
  /* Layout channels locate focus markers; they are not an indicator on their own. */
  const LAYOUT = ['width', 'height', 'bottom', 'position'];
  const TEXT_BUTTON =
    '.ant-btn-link, .ant-btn-text, .ant-btn-variant-link, .ant-btn-variant-text, [data-fill=text], [data-fill=link]';
  const ICON_BUTTON =
    '.ant-btn-icon-only, [data-icon-only], .genux-slot-button, [data-slot-button]';
  const FIELD_OWNER = '.ant-input-affix-wrapper, .ant-input-number, .ant-select, .ant-picker';
  const ITEM_OWNER =
    'li, [role=option], [role=menuitem], [role=treeitem], [role=tab], .ant-menu-item, .ant-dropdown-menu-item, .ant-select-item, .ant-tabs-tab';
  const CHOICE_OWNER =
    '.ant-checkbox-wrapper, .ant-radio-wrapper, .ant-radio-button-wrapper, .ant-segmented-item, .ant-switch, .ant-slider, .ant-rate, .ant-collapse-header';
  const VISIBLE_OWNER =
    'label, .ant-checkbox-wrapper, .ant-radio-wrapper, .ant-radio-button-wrapper, .ant-segmented-item, .ant-switch, .ant-select, .ant-slider, .ant-rate';

  type Style = Record<string, string>;
  type Snap = Style[][];
  type RGBA = [number, number, number, number];
  type Kind = 'field' | 'choice' | 'list' | 'link' | 'button' | 'other';
  type Pending = {
    el: Element;
    owners: Element[];
    focused: Snap;
    kind: Kind;
    nav: boolean;
    share: Element | null;
    indicator: string;
    focusBg: string;
    label: string;
    violations: string[];
  };

  const read = (el: Element, pseudo: string): Style => {
    const cs = getComputedStyle(el, pseudo || null);
    const out: Style = {};
    for (const prop of PROPS) out[prop] = cs.getPropertyValue(prop).trim();
    return out;
  };
  const snap = (els: readonly Element[]): Snap => els.map(el => PSEUDOS.map(p => read(el, p)));
  const at = (s: Snap, i: number, j: number): Style => s[i]?.[j] ?? {};
  const v = (st: Style, prop: string): string => st[prop] ?? '';
  const painted = (st: Style): boolean => !['', 'none', 'normal'].includes(v(st, 'content'));
  const outlined = (st: Style): boolean =>
    v(st, 'outline-style') !== 'none' &&
    v(st, 'outline-style') !== '' &&
    parseFloat(v(st, 'outline-width')) > 0;

  const describe = (el: Element): string => {
    const input = el as HTMLInputElement;
    const raw =
      el.getAttribute('aria-label') || el.textContent || input.value || input.placeholder || '';
    const name = [...raw]
      .map(ch => (ch.charCodeAt(0) < 33 ? ' ' : ch))
      .join('')
      .split(' ')
      .filter(Boolean)
      .join(' ')
      .slice(0, 48);
    const cls =
      typeof el.className === 'string'
        ? el.className
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(c => `.${c}`)
            .join('')
        : '';
    const role = el.getAttribute('role');
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}${role ? `[role=${role}]` : ''} '${name}'`;
  };

  let ctx: CanvasRenderingContext2D | null = null;
  const numbers = (body: string): number[] =>
    body
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(n => (n.endsWith('%') ? Number(n.slice(0, -1)) / 100 : Number(n)));
  const fromRgb = (body: string): RGBA => {
    const n = numbers(body);
    return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
  };
  const parseColor = (value: string): RGBA | null => {
    const text = value.trim();
    if (!text || text === 'none') return null;
    const rgb = text.match(/^rgba?[(]([^)]+)[)]$/i)?.[1];
    if (rgb) return fromRgb(rgb);
    const srgb = text.match(/^color[(]srgb ([^)]+)[)]$/i)?.[1];
    if (srgb) {
      const n = numbers(srgb);
      return [(n[0] ?? 0) * 255, (n[1] ?? 0) * 255, (n[2] ?? 0) * 255, n[3] ?? 1];
    }
    ctx ??= document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = text;
    const normalized = String(ctx.fillStyle);
    if (normalized.startsWith('#'))
      return [
        parseInt(normalized.slice(1, 3), 16),
        parseInt(normalized.slice(3, 5), 16),
        parseInt(normalized.slice(5, 7), 16),
        1,
      ];
    const again = normalized.match(/^rgba?[(]([^)]+)[)]$/i)?.[1];
    return again ? fromRgb(again) : null;
  };
  const sameColor = (a: string, b: string): boolean => {
    const x = parseColor(a);
    const y = parseColor(b);
    if (!x || !y) return a === b;
    if (x[3] < 0.02 && y[3] < 0.02) return true;
    return (
      Math.abs(x[0] - y[0]) < 1.5 &&
      Math.abs(x[1] - y[1]) < 1.5 &&
      Math.abs(x[2] - y[2]) < 1.5 &&
      Math.abs(x[3] - y[3]) < 0.02
    );
  };
  const blend = (top: RGBA, under: RGBA): RGBA => {
    const a = top[3];
    return [
      top[0] * a + under[0] * (1 - a),
      top[1] * a + under[1] * (1 - a),
      top[2] * a + under[2] * (1 - a),
      1,
    ];
  };
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (c: RGBA): number =>
    0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  const contrast = (a: RGBA, b: RGBA): number => {
    const x = luminance(a);
    const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const backdrop = (start: Element | null): RGBA => {
    const found: RGBA[] = [];
    for (let e = start; e; e = e.parentElement) {
      const c = parseColor(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0) {
        found.push(c);
        if (c[3] >= 1) break;
      }
    }
    let base: RGBA = [255, 255, 255, 1];
    for (const c of found.reverse()) base = blend(c, base);
    return base;
  };

  const layers = (shadow: string): string[] =>
    shadow === '' || shadow === 'none' ? [] : shadow.split(/,(?![^(]*[)])/).map(s => s.trim());
  const lengths = (layer: string): number[] =>
    (
      layer
        .replace(/(rgba?|color|hsla?|oklch|oklab|lab|lch)[(][^)]*[)]/gi, '')
        .match(/-?[0-9]*[.]?[0-9]+/g) ?? []
    ).map(Number);
  const isSingleEdge = (layer: string): boolean => {
    const [x = 0, y = 0, blur = 0, spread = 0] = lengths(layer);
    return blur === 0 && spread === 0 && (x === 0) !== (y === 0);
  };
  /* A zero-extent layer in a fully transparent color paints nothing, so it is no ring. */
  const paintsNothing = (layer: string): boolean => {
    const color = parseColor(layer.match(/(rgba?|color)[(][^)]*[)]/i)?.[0] ?? '');
    return color !== null && color[3] === 0 && lengths(layer).every(n => n === 0);
  };
  const addedRings = (focused: string, rest: string): string[] => {
    const before = new Set(layers(rest));
    return layers(focused).filter(
      layer => !before.has(layer) && !isSingleEdge(layer) && !paintsNothing(layer),
    );
  };

  const ownerCache = new WeakMap<Element, Element[]>();
  const ownersOf = (el: Element): Element[] => {
    const cached = ownerCache.get(el);
    if (cached) return cached;
    const set = new Set<Element>();
    const add = (e: Element | null | undefined) => {
      if (e && e !== document.body && e !== document.documentElement) set.add(e);
    };
    add(el);
    add(el.parentElement);
    for (const selector of ['label', '.genux-input-frame', FIELD_OWNER, ITEM_OWNER, CHOICE_OWNER])
      add(el.closest(selector));
    for (const scope of [el, el.closest('label')])
      if (scope) for (const d of Array.from(scope.querySelectorAll('*')).slice(0, 40)) add(d);
    const list = [...set];
    ownerCache.set(el, list);
    return list;
  };

  const kindOf = (el: Element): Kind => {
    const role = el.getAttribute('role') ?? '';
    if (
      ['option', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'treeitem', 'tab'].includes(role)
    )
      return 'list';
    if (
      el.matches('input[type=checkbox], input[type=radio], input[type=range]') ||
      ['switch', 'checkbox', 'radio', 'slider'].includes(role) ||
      el.closest('.ant-rate')
    )
      return 'choice';
    if (el.matches('input[type=button], input[type=submit], input[type=reset]')) return 'button';
    if (
      el.matches(
        'input, textarea, select, [contenteditable=true], [contenteditable=plaintext-only]',
      ) ||
      ['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(role)
    )
      return 'field';
    if (el.matches('a[href]')) return 'link';
    if (el.matches('button, summary, [role=button]')) return 'button';
    return 'other';
  };

  /* The field paint owner: the frame or Ant wrapper that paints the well and bottom marker. */
  const fieldOwner = (el: Element): Element =>
    el.closest('.genux-input-frame') ?? el.closest(FIELD_OWNER) ?? el;
  /* A field wrapper shared with sibling inputs (e.g. a range picker) keeps focus while Tab moves
     between them, so its rest style is only readable once focus leaves that owner. */
  const sharedOwner = (el: Element): Element | null => {
    if (kindOf(el) !== 'field') return null;
    const owner = fieldOwner(el);
    return owner === el || owner === document.body || owner === document.documentElement
      ? null
      : owner;
  };

  const resolveRoles = (el: Element): { indicator: string; focusBg: string } => {
    const host = el.parentElement ?? document.body;
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:absolute;inline-size:0;block-size:0;overflow:hidden;pointer-events:none;color:var(--focus-indicator-color);background-color:var(--focus-bg)';
    host.appendChild(probe);
    const cs = getComputedStyle(probe);
    const resolved = { indicator: cs.color, focusBg: cs.backgroundColor };
    probe.remove();
    return resolved;
  };

  const reachable = (el: Element, owners: readonly Element[]): boolean => {
    const own = el.getBoundingClientRect();
    const target =
      own.width >= 1 && own.height >= 1 && getComputedStyle(el).opacity !== '0'
        ? el
        : (el.closest(VISIBLE_OWNER) ?? el);
    const r = target.getBoundingClientRect();
    const dx = Math.min(1, r.width / 4);
    const dy = Math.min(1, r.height / 4);
    const left = Math.max(r.left + dx, 0);
    const right = Math.min(r.right - dx, innerWidth - 1);
    const top = Math.max(r.top + dy, 0);
    const bottom = Math.min(r.bottom - dy, innerHeight - 1);
    if (r.width <= 0 || r.height <= 0 || right < left || bottom < top) return false;
    for (const x of [left, (left + right) / 2, right])
      for (const y of [top, (top + bottom) / 2, bottom]) {
        const hit = document.elementFromPoint(x, y);
        if (hit && (owners.includes(hit) || target.contains(hit) || hit.contains(target)))
          return true;
      }
    return false;
  };

  const focusChecks = (el: Element, owners: readonly Element[], focused: Snap): string[] => {
    const out: string[] = [];
    owners.forEach((owner, i) =>
      PSEUDOS.forEach((p, j) => {
        const st = at(focused, i, j);
        if (j > 0 && !painted(st)) return;
        if (outlined(st))
          out.push(
            `surrounding outline ${v(st, 'outline-width')} ${v(st, 'outline-style')} on ${describe(owner)}${p}`,
          );
      }),
    );
    const cs = getComputedStyle(el);
    for (const role of ROLES)
      if (!cs.getPropertyValue(role).trim()) out.push(`shared focus role ${role} is not defined`);
    const hasText = (el.textContent ?? '').trim() !== '' || kindOf(el) === 'field';
    if (hasText && parseFloat(cs.fontSize) < 14)
      out.push(`focused text is ${cs.fontSize}, below 14px`);
    if (!reachable(el, owners))
      out.push('focused element is off-screen or entirely obscured by another layer (WCAG 2.4.11)');
    return out;
  };

  /* Splits a computed list value on commas outside parentheses. */
  const topLevel = (value: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let k = 0; k < value.length; k++) {
      const ch = value[k];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) {
        parts.push(value.slice(start, k).trim());
        start = k + 1;
      }
    }
    parts.push(value.slice(start).trim());
    return parts.filter(Boolean);
  };
  const pick = (list: readonly string[], k: number): string =>
    list[k % Math.max(list.length, 1)] ?? '';
  const solidColor = (image: string): string | null => {
    const stops = image.match(/(rgba?|color)[(][^)]*[)]/gi) ?? [];
    const first = stops[0];
    return first && stops.every(stop => sameColor(stop, first)) ? first : null;
  };
  const noVerticalRepeat = (repeat: string): boolean => {
    const [x = '', y] = repeat.split(' ');
    return y === undefined ? x === 'no-repeat' || x === 'repeat-x' : y === 'no-repeat';
  };

  type Marker = { color: string; via: string };
  /* A focus-added 2px bottom marker separate from the border, read from focused vs rest styles. */
  const bottomMarker = (owner: Element, i: number, focused: Snap, rest: Snap): Marker | null => {
    const f = at(focused, i, 0);
    const r = at(rest, i, 0);
    const restShadows = layers(v(r, 'box-shadow'));
    for (const layer of layers(v(f, 'box-shadow'))) {
      const [x = 0, y = 0, blur = 0, spread = 0] = lengths(layer);
      if (
        layer.includes('inset') &&
        x === 0 &&
        y === -2 &&
        blur === 0 &&
        spread === 0 &&
        !restShadows.includes(layer)
      )
        return {
          color: layer.replace(/inset|-?[0-9]*[.]?[0-9]+px/g, '').trim(),
          via: 'bottom inset box-shadow',
        };
    }
    const images = topLevel(v(f, 'background-image'));
    const sizes = topLevel(v(f, 'background-size'));
    const positions = topLevel(v(f, 'background-position'));
    const repeats = topLevel(v(f, 'background-repeat'));
    const restSizes = topLevel(v(r, 'background-size'));
    const restPositions = topLevel(v(r, 'background-position'));
    const restLayers = new Set(
      topLevel(v(r, 'background-image')).map(
        (image, k) => `${image}|${pick(restSizes, k)}|${pick(restPositions, k)}`,
      ),
    );
    for (let k = 0; k < images.length; k++) {
      const image = images[k] ?? '';
      const [w = '', h = ''] = pick(sizes, k).split(' ');
      const [, y = ''] = pick(positions, k).split(' ');
      const color = image.includes('gradient(') ? solidColor(image) : null;
      if (
        color &&
        w === '100%' &&
        h === '2px' &&
        (y === '100%' || y === 'bottom') &&
        noVerticalRepeat(pick(repeats, k)) &&
        !restLayers.has(`${image}|${pick(sizes, k)}|${pick(positions, k)}`)
      )
        return { color, via: 'bottom background gradient' };
    }
    const span = owner.getBoundingClientRect().width;
    for (const j of [1, 2]) {
      const fp = at(focused, i, j);
      const rp = at(rest, i, j);
      const fill = parseColor(v(fp, 'background-color'));
      const visible =
        painted(fp) &&
        ['absolute', 'fixed'].includes(v(fp, 'position')) &&
        v(fp, 'height') === '2px' &&
        v(fp, 'bottom') === '0px' &&
        parseFloat(v(fp, 'width')) >= Math.max(1, span / 2) &&
        fill !== null &&
        fill[3] > 0 &&
        v(fp, 'opacity') !== '0' &&
        v(fp, 'scale') !== '0' &&
        !v(fp, 'transform').startsWith('matrix(0,');
      const added = !painted(rp) || PROPS.some(prop => v(fp, prop) !== v(rp, prop));
      if (visible && added)
        return { color: v(fp, 'background-color'), via: `bottom ${PSEUDOS[j] ?? ''}` };
    }
    return null;
  };

  /*
   * Fields keep a fixed border on every edge; focus adds --focus-bg and a separate 2px bottom
   * marker (bottom-only inset shadow, 100% x 2px bottom gradient or 2px bottom pseudo-element).
   */
  const fieldCheck = (pd: Pending, rest: Snap): string[] => {
    const owner = fieldOwner(pd.el);
    const i = pd.owners.indexOf(owner);
    const f = at(pd.focused, i, 0);
    const r = at(rest, i, 0);
    const out: string[] = [];
    const moved = EDGES.filter(
      edge =>
        v(f, `border-${edge}-width`) !== v(r, `border-${edge}-width`) ||
        !sameColor(v(f, `border-${edge}-color`), v(r, `border-${edge}-color`)),
    );
    if (moved.length > 0)
      out.push(
        `field border must stay fixed on focus; ${moved
          .map(
            edge =>
              `${edge} ${v(r, `border-${edge}-width`)} ${v(r, `border-${edge}-color`)} -> ${v(f, `border-${edge}-width`)} ${v(f, `border-${edge}-color`)}`,
          )
          .join(', ')}`,
      );
    if (
      !sameColor(v(f, 'background-color'), pd.focusBg) ||
      sameColor(v(f, 'background-color'), v(r, 'background-color'))
    )
      out.push(
        `field background must change to --focus-bg (${pd.focusBg}); rest ${v(r, 'background-color')}, focus ${v(f, 'background-color')}`,
      );
    const marker = bottomMarker(owner, i, pd.focused, rest);
    if (!marker)
      out.push(
        'field focus must add a separate 2px bottom marker: bottom-only inset box-shadow (0 -2px 0 0), 100% x 2px bottom background gradient or 2px bottom pseudo-element',
      );
    else {
      if (!sameColor(marker.color, pd.indicator))
        out.push(
          `field ${marker.via} ${marker.color} is not --focus-indicator-color (${pd.indicator})`,
        );
      const c = parseColor(marker.color);
      const page = backdrop(owner.parentElement);
      const fill = parseColor(v(f, 'background-color'));
      const surface = fill ? blend(fill, page) : page;
      if (c) {
        const ratio = Math.min(
          contrast(blend(c, surface), surface),
          contrast(blend(c, page), page),
        );
        if (ratio < 3) out.push(`field ${marker.via} contrast ${ratio.toFixed(2)}:1 is below 3:1`);
      }
    }
    return out;
  };

  /* Link/text buttons with visible text may use the link indicator; icon-only and slot buttons need fill. */
  const textButton = (el: Element): boolean =>
    el.matches(TEXT_BUTTON) &&
    !el.closest(ICON_BUTTON) &&
    (el as HTMLElement).innerText.trim() !== '';

  const buttonCheck = (pd: Pending, rest: Snap): string[] => {
    const i = pd.owners.indexOf(pd.el);
    const back = backdrop(pd.el.parentElement);
    let best = 0;
    for (const j of [0, 1, 2]) {
      const f = at(pd.focused, i, j);
      const r = at(rest, i, j);
      if (j > 0 && !painted(f)) continue;
      const fc = parseColor(v(f, 'background-color'));
      const rc = parseColor(v(r, 'background-color'));
      if (!fc || !rc || sameColor(v(f, 'background-color'), v(r, 'background-color'))) continue;
      best = Math.max(best, contrast(blend(fc, back), blend(rc, back)));
    }
    return best >= 3
      ? []
      : [`button focus must change its fill by at least 3:1 (best ${best.toFixed(2)}:1)`];
  };

  const linkCheck = (pd: Pending, rest: Snap): string[] => {
    const i = pd.owners.indexOf(pd.el);
    const f = at(pd.focused, i, 0);
    const r = at(rest, i, 0);
    const out: string[] = [];
    if (!v(f, 'text-decoration-line').includes('underline'))
      out.push('link focus must underline the link');
    if (sameColor(v(f, 'color'), v(r, 'color')))
      out.push(`link focus must change its color (stays ${v(f, 'color')})`);
    const deco = parseColor(v(f, 'text-decoration-color'));
    /* compare runs after focus left the link, so the live host already reads its rest fill.
       Composite the focused host fill over the unchanged parent backdrop; transparent links
       keep the parent backdrop. */
    const page = backdrop(pd.el.parentElement);
    const fill = parseColor(v(f, 'background-color'));
    const back = fill ? blend(fill, page) : page;
    if (deco) {
      const ratio = contrast(blend(deco, back), back);
      if (ratio < 3) out.push(`link focus underline contrast ${ratio.toFixed(2)}:1 is below 3:1`);
    }
    return out;
  };

  const listCheck = (pd: Pending, rest: Snap): string[] => {
    const item = pd.el.closest(ITEM_OWNER) ?? pd.el;
    const targets = [...new Set([pd.el, item])];
    const out: string[] = [];
    /* The fill may live on the host or a visibly painted ::before/::after covering the row; a thin bar alone does not count. */
    const filled = (t: Element): boolean => {
      const i = pd.owners.indexOf(t);
      if (i < 0) return false;
      const box = t.getBoundingClientRect();
      return [0, 1, 2].some(j => {
        const f = at(pd.focused, i, j);
        const r = at(rest, i, j);
        if (
          j > 0 &&
          !(
            painted(f) &&
            box.width > 0 &&
            box.height > 0 &&
            parseFloat(v(f, 'width')) >= box.width * 0.8 &&
            parseFloat(v(f, 'height')) >= box.height * 0.5 &&
            v(f, 'opacity') !== '0' &&
            v(f, 'scale') !== '0' &&
            !v(f, 'transform').startsWith('matrix(0,')
          )
        )
          return false;
        const fill = parseColor(v(f, 'background-color'));
        const restFill = j === 0 || painted(r) ? v(r, 'background-color') : 'rgba(0, 0, 0, 0)';
        return (
          fill !== null &&
          fill[3] > 0.02 &&
          sameColor(v(f, 'background-color'), pd.focusBg) &&
          !sameColor(v(f, 'background-color'), restFill)
        );
      });
    };
    if (!targets.some(filled))
      out.push(
        `list item focus must change the host or row-covering ::before/::after background to --focus-bg (${pd.focusBg})`,
      );
    let bar: string | null = null;
    for (const t of targets) {
      const i = pd.owners.indexOf(t);
      const f = at(pd.focused, i, 0);
      const r = at(rest, i, 0);
      if (
        v(f, 'border-left-width') === '3px' &&
        (v(r, 'border-left-width') !== '3px' ||
          !sameColor(v(f, 'border-left-color'), v(r, 'border-left-color')))
      )
        bar = v(f, 'border-left-color');
      for (const layer of layers(v(f, 'box-shadow'))) {
        const [x = 0, y = 0, blur = 0, spread = 0] = lengths(layer);
        if (
          layer.includes('inset') &&
          x === 3 &&
          y === 0 &&
          blur === 0 &&
          spread === 0 &&
          !layers(v(r, 'box-shadow')).includes(layer)
        )
          bar = layer.replace(/inset|-?[0-9]*[.]?[0-9]+px/g, '').trim();
      }
      for (const j of [1, 2]) {
        const fp = at(pd.focused, i, j);
        const rp = at(rest, i, j);
        if (
          painted(fp) &&
          v(fp, 'width') === '3px' &&
          (!painted(rp) ||
            v(rp, 'width') !== '3px' ||
            !sameColor(v(fp, 'background-color'), v(rp, 'background-color')))
        )
          bar = v(fp, 'background-color');
      }
    }
    if (!bar) out.push('list item focus must add a 3px start-edge bar');
    else {
      const c = parseColor(bar);
      const back = backdrop(item);
      if (c) {
        const ratio = contrast(blend(c, back), back);
        if (ratio < 3) out.push(`list item focus bar contrast ${ratio.toFixed(2)}:1 is below 3:1`);
      }
    }
    return out;
  };

  const choiceCheck = (pd: Pending, rest: Snap): string[] => {
    let ok = false;
    let best = 0;
    pd.owners.forEach((owner, i) =>
      PSEUDOS.forEach((_p, j) => {
        const f = at(pd.focused, i, j);
        const r = at(rest, i, j);
        if (j > 0 && !painted(f) && !painted(r)) return;
        if (v(f, 'transform') !== v(r, 'transform') || v(f, 'scale') !== v(r, 'scale')) ok = true;
        const fc = parseColor(v(f, 'background-color'));
        const rc = parseColor(v(r, 'background-color'));
        if (fc && rc && !sameColor(v(f, 'background-color'), v(r, 'background-color'))) {
          const back = backdrop(owner.parentElement);
          const ratio = contrast(blend(fc, back), blend(rc, back));
          best = Math.max(best, ratio);
          if (ratio >= 3) ok = true;
        }
      }),
    );
    return ok
      ? []
      : [
          `checkbox/radio/switch/slider/rate focus must change fill by at least 3:1 or scale (best fill ${best.toFixed(2)}:1)`,
        ];
  };

  const checkKind = (pd: Pending, rest: Snap): string[] => {
    if (pd.kind === 'field') return fieldCheck(pd, rest);
    if (pd.kind === 'button') {
      const asFill = buttonCheck(pd, rest);
      if (!textButton(pd.el)) return asFill;
      const asLink = linkCheck(pd, rest);
      return asLink.length === 0 || asFill.length === 0 ? [] : [...asLink, ...asFill];
    }
    if (pd.kind === 'list') return listCheck(pd, rest);
    if (pd.kind === 'choice') return choiceCheck(pd, rest);
    if (pd.kind === 'link') {
      const asLink = linkCheck(pd, rest);
      if (!pd.nav) return asLink;
      const asList = listCheck(pd, rest);
      return asLink.length === 0 || asList.length === 0 ? [] : [...asLink, ...asList];
    }
    return [];
  };

  const compare = (pd: Pending): string[] => {
    const rest = snap(pd.owners);
    const out = [...pd.violations];
    let changed = false;
    pd.owners.forEach((owner, i) =>
      PSEUDOS.forEach((p, j) => {
        const f = at(pd.focused, i, j);
        const r = at(rest, i, j);
        if (j > 0 && !painted(f) && !painted(r)) return;
        if (PROPS.some(prop => !LAYOUT.includes(prop) && v(f, prop) !== v(r, prop))) changed = true;
        for (const ring of addedRings(v(f, 'box-shadow'), v(r, 'box-shadow')))
          out.push(
            `focus adds surrounding or blurred box-shadow ${ring} on ${describe(owner)}${p}`,
          );
        const edges = EDGES.filter(edge => {
          const fw = v(f, `border-${edge}-width`);
          const rw = v(r, `border-${edge}-width`);
          if (!(parseFloat(fw) > 0 || parseFloat(rw) > 0)) return false;
          return (
            fw !== rw || !sameColor(v(f, `border-${edge}-color`), v(r, `border-${edge}-color`))
          );
        });
        if (edges.length > 1)
          out.push(
            `focus repaints ${edges.join('/')} edges of ${describe(owner)}${p}: multi-edge ring`,
          );
      }),
    );
    if (!changed) out.push('keyboard focus paints no visible indicator');
    out.push(...checkKind(pd, rest));
    return out.map(x => `${pd.label}: ${x}`);
  };

  const seen = new WeakSet<Element>();
  let pending: Pending | null = null;
  /* Comparisons whose shared field paint owner still held focus when Tab moved on. */
  let deferred: Pending[] = [];

  const holds = (pd: Pending, el: Element | null): boolean =>
    pd.share !== null && el !== null && pd.share.contains(el);
  const unresolved = (pd: Pending, why: string): string[] => [
    ...pd.violations.map(x => `${pd.label}: ${x}`),
    `${pd.label}: rest comparison unresolved: ${why}`,
  ];
  /* Compares each deferred item once its shared owner loses focus; the rest keep waiting. */
  const release = (el: Element | null): string[] => {
    const out: string[] = [];
    const waiting: Pending[] = [];
    for (const pd of deferred) {
      if (!pd.el.isConnected || !pd.share?.isConnected)
        out.push(...unresolved(pd, 'its shared field paint owner left the document'));
      else if (holds(pd, el)) waiting.push(pd);
      else out.push(...compare(pd));
    }
    deferred = waiting;
    return out;
  };

  const capture = (): Capture => {
    const el = document.activeElement;
    const prev = pending;
    if (prev && el === prev.el)
      return { done: false, stuck: true, label: prev.label, violations: [] };
    const violations = release(el);
    if (prev) {
      pending = null;
      if (!prev.el.isConnected) violations.push(...prev.violations.map(x => `${prev.label}: ${x}`));
      else if (holds(prev, el)) deferred.push(prev);
      else violations.push(...compare(prev));
    }
    if (!el || el === document.body || el === document.documentElement)
      return { done: true, stuck: false, label: 'document', violations };
    if (seen.has(el)) return { done: true, stuck: false, label: describe(el), violations };
    seen.add(el);
    const owners = ownersOf(el);
    const focused = snap(owners);
    const roles = resolveRoles(el);
    pending = {
      el,
      owners,
      focused,
      kind: kindOf(el),
      nav: el.matches('.navigation a[href]'),
      share: sharedOwner(el),
      indicator: roles.indicator,
      focusBg: roles.focusBg,
      label: describe(el),
      violations: focusChecks(el, owners, focused),
    };
    return { done: false, stuck: false, label: pending.label, violations };
  };

  const flush = (): string[] => {
    const prev = pending;
    pending = null;
    const active = document.activeElement;
    const out = release(active);
    for (const pd of deferred)
      out.push(...unresolved(pd, 'its shared field paint owner still holds focus'));
    deferred = [];
    if (!prev) return out;
    if (!prev.el.isConnected) out.push(...prev.violations.map(x => `${prev.label}: ${x}`));
    else if (active === prev.el || holds(prev, active))
      out.push(...unresolved(prev, 'it or its shared field owner still holds focus'));
    else out.push(...compare(prev));
    return out;
  };

  let pointerScope: Element[] = [];
  let pointerBase: Snap = [];
  const pointerBaseline = (target: Element): void => {
    const set = new Set<Element>();
    let a = target.parentElement;
    for (let k = 0; k < 2 && a && a !== document.body; k++, a = a.parentElement) set.add(a);
    set.add(target);
    for (const d of Array.from(target.querySelectorAll('*')).slice(0, 80)) set.add(d);
    pointerScope = [...set];
    pointerBase = snap(pointerScope);
  };
  const pointerCompare = (_target: Element, stateful: boolean): string[] => {
    const now = snap(pointerScope);
    const channels = stateful ? STRUCTURAL : [...STRUCTURAL, ...PAINT];
    const out: string[] = [];
    pointerScope.forEach((owner, i) => {
      /* A node the control removed (e.g. the native Select arrow on open) cannot paint focus; detached styles read empty. */
      if (!owner.isConnected) return;
      PSEUDOS.forEach((p, j) => {
        const b = at(pointerBase, i, j);
        const n = at(now, i, j);
        if (j > 0 && painted(b) !== painted(n)) {
          out.push(`${describe(owner)}${p} appears or disappears after pointer focus`);
          return;
        }
        if (j > 0 && !painted(n)) return;
        for (const ch of channels)
          if (v(b, ch) !== v(n, ch))
            out.push(
              `${describe(owner)}${p} ${ch}: hover ${v(b, ch)} -> pointer focus ${v(n, ch)}`,
            );
        for (const ring of addedRings(v(n, 'box-shadow'), v(b, 'box-shadow')))
          out.push(`${describe(owner)}${p} pointer focus adds box-shadow ${ring}`);
        if (outlined(n))
          out.push(
            `${describe(owner)}${p} pointer focus shows outline ${v(n, 'outline-width')} ${v(n, 'outline-style')}`,
          );
      });
    });
    const active = document.activeElement;
    if (active && active !== document.body && !pointerScope.includes(active)) {
      const owners = ownersOf(active);
      snap(owners).forEach((row, i) =>
        row.forEach((st, j) => {
          const owner = owners[i];
          if (owner && (j === 0 || painted(st)) && outlined(st))
            out.push(
              `${describe(owner)}${PSEUDOS[j] ?? ''} pointer focus shows outline ${v(st, 'outline-width')}`,
            );
        }),
      );
    }
    return out;
  };

  const settle = (): Promise<void> =>
    new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        const running = document
          .getAnimations()
          .filter(a => a.effect?.getComputedTiming().iterations !== Infinity);
        const done = Promise.all(
          running.map(a =>
            a.finished.then(
              () => undefined,
              () => undefined,
            ),
          ),
        );
        const limit = new Promise<void>(r => setTimeout(r, 2000));
        void Promise.race([done, limit]).then(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
    });

  window.__focus01 = { settle, capture, flush, pointerBaseline, pointerCompare };
}

const route = (path: string): string =>
  new URL(
    path,
    test.info().project.use.baseURL ?? process.env.GENUX_DOCS_URL ?? 'http://127.0.0.1:4324',
  ).href;

const settle = async (page: Page): Promise<void> => {
  await page.evaluate(() => window.__focus01?.settle());
};

const capture = (page: Page): Promise<Capture> =>
  page.evaluate(() => {
    const probe = window.__focus01;
    if (!probe) throw new Error('FOCUS-01 probe was not installed');
    return probe.capture();
  });

async function traverse(page: Page, path: string, failures: Set<string>): Promise<void> {
  await page.goto(route(path), { waitUntil: 'load' });
  await expect(page.locator('main#content')).toBeVisible();
  await settle(page);
  let modalityChecked = false;
  for (let step = 0; ; step++) {
    if (step >= MAX_TAB_STOPS) {
      failures.add(`${path}: Tab traversal exceeded ${MAX_TAB_STOPS} stops without completing`);
      break;
    }
    await page.keyboard.press('Tab');
    await settle(page);
    let result = await capture(page);
    for (let retry = 0; result.stuck && retry < 2; retry++) {
      await page.keyboard.press('Tab');
      await settle(page);
      result = await capture(page);
    }
    if (result.stuck) {
      failures.add(`${path} ${result.label}: Tab traversal is trapped`);
      break;
    }
    for (const violation of result.violations) failures.add(`${path} ${violation}`);
    if (!modalityChecked && !result.done) {
      modalityChecked = true;
      const modality = await page.evaluate(
        () => document.documentElement.dataset.inputModality ?? null,
      );
      if (modality !== 'keyboard')
        failures.add(`${path}: Tab must set html[data-input-modality=keyboard] (got ${modality})`);
    }
    if (result.done) break;
  }
  const tail = await page.evaluate(
    () => window.__focus01?.flush() ?? ['FOCUS-01 probe was not installed'],
  );
  for (const violation of tail) failures.add(`${path} ${violation}`);
}

test.use({
  viewport: { width: 1280, height: 900 },
  forcedColors: 'none',
  reducedMotion: 'no-preference',
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFocusProbe);
});

test('FOCUS-01a: Tab reaches every documentation control with one allowed non-surrounding indicator', async ({
  page,
}) => {
  test.setTimeout(3 * 60 * 60_000);
  await page.goto(route('/'));
  const componentLinks = await page.locator('[data-component-link]').count();
  expect(componentLinks).toBeGreaterThan(0);
  const paths = await page.evaluate(() => [
    ...new Set(
      Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          '.docs-header a[href], .navigation nav a[href], .docs-footer a[href]',
        ),
      )
        .map(a => new URL(a.href))
        .filter(url => url.origin === location.origin)
        .map(url => url.pathname),
    ),
  ]);
  expect(paths).toContain('/');
  expect(paths.filter(p => p.startsWith('/components/'))).toHaveLength(componentLinks);

  const failures = new Set<string>();
  for (const path of paths) await traverse(page, path, failures);
  const list = [...failures];
  expect(list.length, list.slice(0, 150).join(NL)).toBe(0);
});

type Representative = {
  name: string;
  path: string;
  target: (page: Page) => Locator;
  stateful: boolean;
  keepPage?: boolean;
};

const representatives: Representative[] = [
  {
    name: 'Select',
    path: '/components/select/',
    target: page => page.locator('.genux-demo .ant-select').first(),
    stateful: true,
  },
  {
    name: 'Dropdown trigger',
    path: '/components/dropdown/',
    target: page => page.locator('main').getByRole('button', { name: 'Workspace actions' }).first(),
    stateful: true,
  },
  {
    name: 'Input',
    path: '/components/input/',
    target: page =>
      page.locator('main').getByRole('textbox', { name: 'Workspace name', exact: true }).first(),
    stateful: false,
  },
  {
    name: 'Sidebar link',
    path: '/components/button/',
    target: page => page.locator(`.navigation nav a[href='/components/input/']`),
    stateful: false,
    keepPage: true,
  },
  {
    name: 'Button',
    path: '/components/button/',
    target: page => page.locator('.genux-demo .genux-button').first(),
    stateful: false,
  },
  {
    name: 'Checkbox',
    path: '/components/checkbox/',
    target: page => page.locator('.genux-demo .ant-checkbox-wrapper').first(),
    stateful: true,
  },
  {
    name: 'Switch',
    path: '/components/switch/',
    target: page => page.locator('.genux-demo .ant-switch').first(),
    stateful: true,
  },
];

test('FOCUS-01b: pointer focus paints nothing beyond hover on representative controls', async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  const failures: string[] = [];
  for (const rep of representatives) {
    await page.goto(route(rep.path));
    const target = rep.target(page);
    await expect(target, `${rep.name} representative`).toBeVisible();
    await target.scrollIntoViewIfNeeded();
    if (rep.keepPage)
      await target.evaluate(el => el.addEventListener('click', event => event.preventDefault()));
    const box = await target.boundingBox();
    if (!box) {
      failures.push(`${rep.name}: representative has no layout box`);
      continue;
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await settle(page);
    await target.evaluate(el => window.__focus01?.pointerBaseline(el));
    await page.mouse.down();
    await page.mouse.up();
    await settle(page);
    const modality = await page.evaluate(
      () => document.documentElement.dataset.inputModality ?? null,
    );
    if (modality !== 'pointer')
      failures.push(
        `${rep.name}: pointer activation must set html[data-input-modality=pointer] (got ${modality})`,
      );
    const diffs = await target.evaluate(
      (el, stateful) =>
        window.__focus01?.pointerCompare(el, stateful) ?? ['FOCUS-01 probe was not installed'],
      rep.stateful,
    );
    for (const diff of diffs) failures.push(`${rep.name}: ${diff}`);
  }
  expect(failures.length, failures.join(NL)).toBe(0);
});

type FocusState = {
  modality: string | null;
  active: string;
  isTarget: boolean;
  name: string | null;
  value: string | null;
  caret: [number | null, number | null];
  checked: boolean | null;
  cue: boolean;
  outlines: string[];
  shadows: string[];
  canvasText: string;
};

/* Serialized into the page; it must stay self-contained. Reads the target, or the focused element. */
function focusState(target?: Element | null): FocusState {
  const active = document.activeElement;
  const el = target ?? active ?? document.body;
  const frame =
    el.closest('.genux-input-frame') ??
    el.closest('.ant-input-affix-wrapper, .ant-input-number, .ant-select, .ant-picker') ??
    el;
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:absolute;inline-size:0;block-size:0;overflow:hidden;pointer-events:none;color:CanvasText;background-color:var(--focus-bg);border-top-color:var(--focus-button-bg);border-bottom-color:var(--focus-link-ink)';
  (frame.parentElement ?? document.body).appendChild(probe);
  const roles = getComputedStyle(probe);
  const focusBg = roles.backgroundColor;
  const canvasText = roles.color;
  /* An undefined role falls back to currentColor, so only defined, non-transparent roles count. */
  const own = getComputedStyle(el);
  const role = (name: string, resolved: string): string | null =>
    own.getPropertyValue(name).trim() !== '' && resolved !== 'rgba(0, 0, 0, 0)' ? resolved : null;
  const buttonBg = role('--focus-button-bg', roles.borderTopColor);
  const linkInk = role('--focus-link-ink', roles.borderBottomColor);
  probe.remove();
  const fieldCue =
    focusBg !== 'rgba(0, 0, 0, 0)' && getComputedStyle(frame).backgroundColor === focusBg;
  /* Actions (e.g. a field's clear slot button) show focus as a painted --focus-button-bg fill on
     the host or a drawn ::before/::after face, or as a --focus-link-ink underline plus color on
     visible text. Mode, class or :focus-visible alone never counts. */
  const rect = el.getBoundingClientRect();
  const action =
    rect.width > 0 &&
    rect.height > 0 &&
    el.matches('button, [role=button], input[type=button], input[type=submit], input[type=reset]');
  const faces = [
    own,
    ...['::before', '::after']
      .map(p => getComputedStyle(el, p))
      .filter(
        cs =>
          !['', 'none', 'normal'].includes(cs.content) &&
          parseFloat(cs.width) > 0 &&
          parseFloat(cs.height) > 0 &&
          cs.opacity !== '0',
      ),
  ];
  const buttonFill =
    action && buttonBg !== null && faces.some(cs => cs.backgroundColor === buttonBg);
  const linkCue =
    action &&
    linkInk !== null &&
    (el.textContent ?? '').trim() !== '' &&
    [el, ...Array.from(el.querySelectorAll('.genux-button-content > span'))].some(t => {
      const cs = getComputedStyle(t);
      return (
        cs.textDecorationLine.includes('underline') &&
        cs.color === linkInk &&
        cs.textDecorationColor === linkInk
      );
    });
  const outlines: string[] = [];
  const shadows: string[] = [];
  for (const owner of [...new Set([el, frame])]) {
    const cs = getComputedStyle(owner);
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0)
      outlines.push(`${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`);
    if (cs.boxShadow !== 'none') shadows.push(cs.boxShadow);
  }
  const field = el as HTMLInputElement;
  const editable = el.matches('input, textarea');
  return {
    modality: document.documentElement.dataset.inputModality ?? null,
    active: active ? `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ''}` : 'none',
    isTarget: active === el,
    name: el.getAttribute('name'),
    value: editable ? field.value : null,
    caret: editable ? [field.selectionStart, field.selectionEnd] : [null, null],
    checked: el.matches('input[type=checkbox], input[type=radio]') ? field.checked : null,
    cue: fieldCue || buttonFill || linkCue,
    outlines,
    shadows,
    canvasText,
  };
}

/*
 * FOCUS-01c: visible focus mode starts off and only Tab/Shift+Tab turns it on. Typing, arrows and
 * Escape before Tab keep it off; once on, native arrow navigation keeps it on. Pointer turns the
 * visual mode off without blur, input or caret loss. Forced colors paint a 2px CanvasText outline
 * only in keyboard mode.
 */
test('FOCUS-01c: only Tab/Shift+Tab turns visible focus mode on; pointer turns it off without losing focus', async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);
  const failures: string[] = [];
  const check = (ok: boolean, message: string, state: FocusState): void => {
    if (!ok) failures.push(`${message} (${JSON.stringify(state)})`);
  };
  const press = async (key: string): Promise<void> => {
    await page.keyboard.press(key);
    await settle(page);
  };
  const point = async (target: Locator, xRatio: number): Promise<void> => {
    /* Keyboard navigation may scroll the field away; bring it back before measuring. */
    await target.scrollIntoViewIfNeeded();
    await settle(page);
    const box = await target.boundingBox();
    if (!box) throw new Error('FOCUS-01c target has no layout box');
    const x = box.x + box.width * xRatio;
    const y = box.y + box.height / 2;
    /* Never send a mislocated click: the point must hit the target or a node inside it. */
    const miss = await target.evaluate(
      (el, [px, py]) => {
        const hit = document.elementFromPoint(px, py);
        if (hit && el.contains(hit)) return null;
        return hit ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}` : 'nothing';
      },
      [x, y] as const,
    );
    if (miss !== null) {
      failures.push(
        `pointer at (${x.toFixed(1)}, ${y.toFixed(1)}) hits ${miss}, not the target; click not sent`,
      );
      return;
    }
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await settle(page);
  };
  const modality = () =>
    page.evaluate(() => document.documentElement.dataset.inputModality ?? null);
  const active = () => page.evaluate(focusState, null);
  const workspace = page
    .locator('main')
    .getByRole('textbox', { name: 'Workspace name', exact: true })
    .first();
  const field = () => workspace.evaluate(focusState);
  const off = (s: FocusState): boolean =>
    s.modality === 'pointer' && !s.cue && s.outlines.length === 0;

  await page.goto(route('/components/input/'));
  await expect(page.locator('main#content')).toBeVisible();
  await expect(workspace).toBeVisible();
  await settle(page);
  await expect
    .poll(modality, { message: 'visible focus mode must start off (pointer) on load' })
    .toBe('pointer');
  let state = await active();
  check(state.active === 'body', 'load must not focus a control', state);

  await workspace.scrollIntoViewIfNeeded();
  await point(workspace, 0.5);
  state = await field();
  check(state.isTarget && off(state), 'pointer focus must keep visible focus mode off', state);
  await page.keyboard.type('GenUX');
  await settle(page);
  state = await field();
  check(
    state.isTarget && off(state) && state.value === 'GenUX',
    'typing before Tab must not turn visible focus mode on',
    state,
  );
  for (const key of ['ArrowLeft', 'Escape']) {
    await press(key);
    state = await field();
    check(
      state.isTarget && off(state),
      `${key} before Tab must not turn visible focus mode on`,
      state,
    );
  }

  await press('Tab');
  state = await active();
  check(
    state.modality === 'keyboard' && state.active !== 'input#input-filled' && state.cue,
    'Tab must turn visible focus mode on and mark the next field',
    state,
  );
  await press('Shift+Tab');
  state = await field();
  check(
    state.isTarget && state.modality === 'keyboard' && state.cue && state.outlines.length === 0,
    'Shift+Tab must keep visible focus mode on and mark Workspace name',
    state,
  );
  await press('End');
  await point(workspace, 0.97);
  state = await field();
  check(
    state.isTarget &&
      off(state) &&
      state.value === 'GenUX' &&
      state.caret[0] === 5 &&
      state.caret[1] === 5,
    'pointer must turn visible focus mode off without blur, input or caret loss',
    state,
  );
  await press('Shift+Tab');
  state = await active();
  check(
    state.modality === 'keyboard' && state.active !== 'input#input-filled',
    'Shift+Tab must turn visible focus mode back on',
    state,
  );

  await page.emulateMedia({ forcedColors: 'active' });
  await point(workspace, 0.5);
  state = await field();
  check(
    state.isTarget &&
      state.modality === 'pointer' &&
      state.outlines.length === 0 &&
      state.shadows.length === 0,
    'forced colors: pointer focus must paint no outline or glow',
    state,
  );
  await press('Tab');
  state = await active();
  const ring = state.outlines[0] ?? '';
  check(
    state.modality === 'keyboard' &&
      state.outlines.length === 1 &&
      ring.startsWith('2px ') &&
      ring.endsWith(` ${state.canvasText}`),
    'forced colors: keyboard focus must paint one 2px CanvasText outline',
    state,
  );
  await page.emulateMedia({ forcedColors: 'none' });
  await settle(page);
  state = await active();
  check(
    state.modality === 'keyboard' && state.outlines.length === 0 && state.cue,
    'normal colors: keyboard focus must paint no outline',
    state,
  );

  await page.goto(route('/components/radio/'));
  await expect(page.locator('main#content')).toBeVisible();
  await expect(page.locator('main input[type=radio][name=team]').first()).toBeAttached();
  await settle(page);
  await expect
    .poll(modality, { message: 'visible focus mode must start off (pointer) on the Radio page' })
    .toBe('pointer');
  let where: string = 'other';
  for (let step = 0; step < MAX_TAB_STOPS && where === 'other'; step++) {
    await page.keyboard.press('Tab');
    where = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return 'end';
      return el.matches('input[type=radio][name=team]') ? 'team' : 'other';
    });
  }
  await settle(page);
  state = await active();
  check(
    where === 'team' &&
      state.modality === 'keyboard' &&
      state.checked === true &&
      state.value === 'Tasarım',
    'Tab must reach the checked Team radio in visible focus mode',
    state,
  );
  if (where === 'team')
    for (const [key, value] of [
      ['ArrowDown', 'Mühendislik'],
      ['ArrowDown', 'Operasyon'],
      ['ArrowUp', 'Mühendislik'],
    ] as const) {
      await press(key);
      state = await active();
      check(
        state.modality === 'keyboard' &&
          state.name === 'team' &&
          state.value === value &&
          state.checked === true,
        `${key} must move focus and selection to ${value} while visible focus mode persists`,
        state,
      );
    }
  expect(failures.length, failures.join(NL)).toBe(0);
});
