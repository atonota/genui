import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expect,
  test,
  type ElementHandle,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';
import type { LayoutProfile } from '../src/adaptive/policy';

// The user's fourteen verification widths, run in this order on one page, 320 first.
const widths = [320, 375, 430, 480, 599, 600, 768, 959, 960, 1279, 1280, 1600, 1920, 2560] as const;
const shotWidths = new Set<number>([320, 1280, 2560]);
// Real draft content carrying the words the text and table policy forbid splitting.
const draftName = 'Supplier DocType Template Proposal';
const unsplitWords = ['DocType', 'Template', 'Proposal'];
const categoryPath = ['Operations', 'Logistics', 'Inbound receiving'] as const;
const pathText = categoryPath.join(' / ');
const tableWords = [
  'Record',
  'Owner',
  'Status',
  'Updated',
  'Supplier',
  'invoices',
  'Returns',
  'handling',
  'Onboarding',
  'checklist',
];

type NodeProof = HTMLElement & { genuxNodeProof?: string };

/** Viewport and full-page PNGs in this test's own output directory, attached to the report. */
async function saveShot(page: Page, name: string) {
  const info = test.info();
  const base = name.replace(/\.png$/, '');
  for (const [kind, fullPage] of [
    ['viewport', false],
    ['full', true],
  ] as const) {
    const file = info.outputPath(`${base}-${kind}.png`);
    await page.screenshot({ path: file, fullPage });
    await info.attach(`${base}-${kind}.png`, { path: file, contentType: 'image/png' });
  }
}

/** Evidence JSON in this test's own output directory, attached to the report. */
async function saveJson(name: string, value: unknown) {
  const info = test.info();
  const file = info.outputPath(name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2));
  await info.attach(name, { path: file, contentType: 'application/json' });
}

/** Width-only web profile of the frozen policy; the web surface never resolves to TV. */
const webProfile = (width: number): LayoutProfile =>
  width < 600
    ? 'phone'
    : width < 960
      ? 'tablet'
      : width < 1280
        ? 'laptop'
        : width < 1920
          ? 'desktop'
          : 'wide';

/** AntD screens from the shared tokens: xs is a max-width of 599, every other key a min-width. */
const expectedScreens = (width: number) => ({
  xs: width <= 599,
  sm: width >= 600,
  md: width >= 768,
  lg: width >= 960,
  xl: width >= 1280,
  xxl: width >= 1600,
  xxxl: width >= 1920,
});

/** Span of the lab's Col xs=24 md=12 xl=8 at a width. */
const expectedSpan = (width: number) => (width < 768 ? 24 : width < 1280 ? 12 : 8);

/** The lab journey, found from its labelled main landmark inside the shell. */
function lab(page: Page) {
  const main = page.getByRole('main', { name: /draft review journey/i });
  const shell = main.locator('xpath=..');
  return {
    main,
    shell,
    name: main.getByRole('textbox', { name: /draft name/i }),
    category: main.getByRole('combobox', { name: /category path/i }),
    review: main.getByRole('button', { name: /^review draft$/i }),
    result: main.getByRole('status').filter({ hasText: /nothing/i }),
    nav: shell.getByRole('navigation', { name: /^navigation$/i }),
  };
}

/** The shell has delivered the requested profile module for the expected surface. */
async function expectShell(
  page: Page,
  layout: LayoutProfile,
  surface: 'web' | 'living-room' = 'web',
) {
  const { shell } = lab(page);
  await expect(shell).toHaveAttribute('data-adaptive-surface', surface);
  await expect(shell).toHaveAttribute('data-layout-requested', layout);
  await expect(shell).toHaveAttribute('data-layout', layout);
  await expect(shell).not.toHaveAttribute('data-delivery-status', /loading|error/);
}

async function expectFonts(page: Page) {
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      status: document.fonts.status,
      family: getComputedStyle(document.body).fontFamily,
      outfit: document.fonts.check('16px Outfit'),
    };
  });
  expect(fonts.status).toBe('loaded');
  expect(fonts.family.split(',')[0].toLowerCase()).toContain('outfit');
  expect(fonts.outfit).toBe(true);
  return fonts;
}

function pageOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Every painted text node and form control on the page, not a sample, below 14 CSS px. */
function readableText(page: Page) {
  return page.evaluate(() => {
    const offenders: { text: string; size: number; tag: string }[] = [];
    let checked = 0;
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      return style.visibility === 'visible' && Number(style.opacity) > 0;
    };
    const record = (el: Element, text: string) => {
      checked += 1;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 13.99) offenders.push({ text: text.slice(0, 60), size, tag: el.localName });
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('script, style, noscript, template')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      // Clipped screen-reader text paints at most 1 CSS px and is not read on screen.
      const painted = Array.from(range.getClientRects()).some(r => r.width > 1 && r.height > 1);
      if (painted && visible(el)) record(el, text);
    }
    for (const el of Array.from(document.querySelectorAll('input, textarea, select, button'))) {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1 && visible(el)) record(el, el.localName);
    }
    return { checked, offenders };
  });
}

/** Words whose own range paints on more than one line, so a split inside a word fails. */
function splitWords(scope: Locator, words: readonly string[]) {
  return scope.evaluate((root, list) => {
    const split: string[] = [];
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      for (const word of list) {
        for (let at = text.indexOf(word); at >= 0; at = text.indexOf(word, at + word.length)) {
          const range = root.ownerDocument.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + word.length);
          const lines = new Set(
            Array.from(range.getClientRects())
              .filter(r => r.width > 0)
              .map(r => Math.round(r.top)),
          );
          if (lines.size > 1) split.push(word);
        }
      }
    }
    return split;
  }, words);
}

/** Finite CSS and Web Animations still running in a scope; infinite loaders never settle. */
function runningFiniteAnimations(scope: Locator) {
  return scope.evaluate(
    el =>
      el
        .getAnimations({ subtree: true })
        .filter(
          animation =>
            animation.playState === 'running' &&
            Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity),
        ).length,
  );
}

async function settleMotion(...scopes: Locator[]) {
  for (const scope of scopes) await expect.poll(() => runningFiniteAnimations(scope)).toBe(0);
}

/** The actual Grid.useBreakpoint map the lab publishes. */
function gridScreens(page: Page) {
  return page
    .locator('[data-adaptive-grid-probe]')
    .getAttribute('data-adaptive-grid-probe')
    .then(value => JSON.parse(value ?? '{}') as Record<string, boolean>);
}

/** A grid step's Col classes and its rendered share of the Row. */
function colGeometry(page: Page, step: string) {
  return page
    .locator('[data-adaptive-grid-probe]')
    .getByText(step, { exact: true })
    .evaluate(el => {
      const col = el.closest('.ant-col');
      const row = el.closest('.ant-row');
      if (!col || !row) throw new Error('The grid step is outside an AntD Row and Col.');
      return {
        classes: Array.from(col.classList),
        ratio: col.getBoundingClientRect().width / row.getBoundingClientRect().width,
      };
    });
}

function siderState(page: Page) {
  return page.getByRole('list', { name: /sider navigation/i, includeHidden: true }).evaluate(el => {
    const sider = el.closest('.ant-layout-sider');
    if (!sider) throw new Error('The sider navigation is outside an AntD Sider.');
    return {
      collapsed: sider.classList.contains('ant-layout-sider-collapsed'),
      width: Math.round(sider.getBoundingClientRect().width),
    };
  });
}

async function expectReachable(control: Locator, width: number) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  const r = await control.boundingBox();
  expect(r).not.toBeNull();
  expect(r!.x).toBeGreaterThanOrEqual(-0.5);
  expect(r!.x + r!.width).toBeLessThanOrEqual(width + 0.5);
}

function recordTable(page: Page) {
  return page
    .getByRole('table')
    .filter({ has: page.getByRole('columnheader', { name: /^record$/i }) })
    .first();
}

/** The record table's own scroller and the wrapping rules of its first column. */
async function tableState(page: Page) {
  const table = recordTable(page);
  const state = await table.evaluate(el => {
    let scroller = el.parentElement;
    while (scroller && !['auto', 'scroll'].includes(getComputedStyle(scroller).overflowX))
      scroller = scroller.parentElement;
    const cells = Array.from(el.querySelectorAll('tr > :first-child'));
    const nodes = [...cells, ...cells.flatMap(cell => Array.from(cell.querySelectorAll('*')))];
    const wraps = nodes.map(node => {
      const style = getComputedStyle(node);
      return `${style.wordBreak}|${style.overflowWrap}`;
    });
    const page = el.ownerDocument;
    return {
      contained: Boolean(scroller) && scroller !== page.documentElement && scroller !== page.body,
      scrollWidth: scroller?.scrollWidth ?? 0,
      clientWidth: scroller?.clientWidth ?? 0,
      right: scroller?.getBoundingClientRect().right ?? Number.MAX_SAFE_INTEGER,
      wraps: [...new Set(wraps)],
    };
  });
  return { ...state, split: await splitWords(table, tableWords) };
}

async function galleryState(gallery: Locator) {
  // Exactly one scrollable gallery region; its direct figures are measured below.
  await expect(gallery).toHaveCount(1);
  await expect(gallery.getByRole('figure')).toHaveCount(6);
  return gallery.evaluate(el => {
    const r = el.getBoundingClientRect();
    return {
      widths: Array.from(el.querySelectorAll(':scope > figure')).map(figure =>
        Math.round(figure.getBoundingClientRect().width),
      ),
      overflowX: getComputedStyle(el).overflowX,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      left: r.left,
      right: r.right,
    };
  });
}

/** Painted text bounds of an ordinary section heading against the preview frame and its scrollers. */
async function headingState(heading: Locator, frame: Locator) {
  await expect(heading).toHaveCount(1);
  const owner = await frame.elementHandle();
  expect(owner).not.toBeNull();
  return heading.evaluate((el, frameEl) => {
    const range = el.ownerDocument.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    const box = frameEl.getBoundingClientRect();
    const frameLeft = box.left + frameEl.clientLeft;
    // Any ancestor that clips or scrolls inline while overflowing; the table and gallery sit beside headings.
    const clippers: string[] = [];
    for (
      let node = el.parentElement;
      node && node !== el.ownerDocument.documentElement;
      node = node.parentElement
    )
      if (getComputedStyle(node).overflowX !== 'visible' && node.scrollWidth > node.clientWidth + 1)
        clippers.push(
          `${node.localName}.${(node.getAttribute('class') ?? '').split(' ').filter(Boolean).join('.')} ${node.scrollWidth} > ${node.clientWidth}`,
        );
    return {
      text: (el.textContent ?? '').trim(),
      painted: rects.length,
      left: Math.min(...rects.map(r => r.left)),
      right: Math.max(...rects.map(r => r.right)),
      inFrame: frameEl.contains(el),
      frameLeft,
      frameRight: frameLeft + frameEl.clientWidth,
      frameScrollLeft: frameEl.scrollLeft,
      frameOverflow: frameEl.scrollWidth - frameEl.clientWidth,
      clippers,
    };
  }, owner!);
}

type HeadingState = Awaited<ReturnType<typeof headingState>>;

/** A heading paints wholly inside the frame and the viewport while the frame owns no inline scroll. */
function expectHeadingInside(heading: HeadingState, width: number) {
  const label = `${heading.text} at ${width}`;
  expect(heading.inFrame, `${label} inside the preview frame`).toBe(true);
  expect(heading.painted, `${label} painted text`).toBeGreaterThan(0);
  expect(heading.left, `${label} left edge in the frame`).toBeGreaterThanOrEqual(
    heading.frameLeft - 0.5,
  );
  expect(heading.right, `${label} right edge in the frame`).toBeLessThanOrEqual(
    heading.frameRight + 0.5,
  );
  expect(heading.left, `${label} left edge in the viewport`).toBeGreaterThanOrEqual(-0.5);
  expect(heading.right, `${label} right edge in the viewport`).toBeLessThanOrEqual(width + 0.5);
  expect(heading.frameScrollLeft, `${label} frame scrollLeft`).toBe(0);
  expect(heading.frameOverflow, `${label} frame inline overflow`).toBeLessThanOrEqual(1);
  expect(heading.clippers, `${label} clipping scrollers above the heading`).toEqual([]);
}

/**
 * Text, underline and backdrop of an element as sRGB bytes: computed colours, color(srgb ...) and
 * color-mix() included, are normalized by a detached canvas, composited and rated by WCAG luminance.
 */
function focusContrast(target: Locator) {
  return target.evaluate(el => {
    const canvas = el.ownerDocument.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No 2D canvas to normalize colours.');
    type Rgba = [number, number, number, number];
    const parse = (color: string): Rgba => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      return [data[0], data[1], data[2], data[3] / 255];
    };
    // Source-over compositing of one colour onto what lies beneath it.
    const over = (top: Rgba, below: Rgba): Rgba => {
      const alpha = top[3] + below[3] * (1 - top[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      const mix = (i: number) => (top[i] * top[3] + below[i] * below[3] * (1 - top[3])) / alpha;
      return [mix(0), mix(1), mix(2), alpha];
    };
    // The browser's own Canvas colour lies under an unpainted root; white if it cannot be read.
    let backdrop = over(parse('Canvas'), [255, 255, 255, 1]);
    const layers: Rgba[] = [];
    for (let node: Element | null = el; node; node = node.parentElement)
      layers.push(parse(getComputedStyle(node).backgroundColor));
    for (const layer of layers.reverse()) backdrop = over(layer, backdrop);
    const style = getComputedStyle(el);
    const text = over(parse(style.color), backdrop);
    const indicator = over(parse(style.textDecorationColor), backdrop);
    const linear = (channel: number) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb: Rgba) =>
      0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
    const ratio = (a: Rgba, b: Rgba) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
    };
    const bytes = (rgb: Rgba) =>
      rgb.map((value, i) => (i < 3 ? Math.round(value) : Math.round(value * 100) / 100));
    return {
      paint: {
        color: style.color,
        background: style.backgroundColor,
        decorationLine: style.textDecorationLine,
        decorationColor: style.textDecorationColor,
        decorationThickness: style.textDecorationThickness,
      },
      backdrop: bytes(backdrop),
      text: bytes(text),
      indicator: bytes(indicator),
      textContrast: ratio(text, backdrop),
      indicatorContrast: ratio(indicator, backdrop),
    };
  });
}

/**
 * The effective hit box of a control, or of the nearest painted frame around an unpainted proxy
 * field, and whether its centre and four inner edges hit the control.
 */
async function hitTarget(control: Locator, mode: 'self' | 'frame') {
  await control.scrollIntoViewIfNeeded();
  return control.evaluate((el, which) => {
    const clear = (color: string) => {
      const compact = color.split(' ').join('');
      return color === 'transparent' || compact.endsWith(',0)') || compact.endsWith('/0)');
    };
    const painted = (node: Element) => {
      const style = getComputedStyle(node);
      if (style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
      const edge = ['top', 'right', 'bottom', 'left'].some(
        side =>
          parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0 &&
          style.getPropertyValue(`border-${side}-style`) !== 'none' &&
          !clear(style.getPropertyValue(`border-${side}-color`)),
      );
      return (
        edge ||
        !clear(style.backgroundColor) ||
        style.boxShadow !== 'none' ||
        style.backgroundImage !== 'none'
      );
    };
    let frame: Element | null = el;
    // Invisible or unpainted proxy inputs are skipped up to the field's own painted frame.
    if (which === 'frame')
      for (let depth = 0; frame && !painted(frame); depth += 1)
        frame = depth < 6 ? frame.parentElement : null;
    if (!frame) return { found: false, tag: '', width: 0, height: 0, hits: [] as boolean[] };
    const target = frame;
    const r = target.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const points = [
      [x, y],
      [x, r.top + 1],
      [x, r.bottom - 1],
      [r.left + 1, y],
      [r.right - 1, y],
    ];
    const hits = points.map(([px, py]) => {
      const hit = el.ownerDocument.elementFromPoint(px, py);
      return Boolean(hit && (target.contains(hit) || el.contains(hit)));
    });
    const round = (value: number) => Math.round(value * 100) / 100;
    return {
      found: true,
      tag: target.localName,
      width: round(r.width),
      height: round(r.height),
      hits,
    };
  }, mode);
}

/**
 * AntD Select: open it with a real click, then move the virtual list's active option with
 * ArrowDown until aria-activedescendant names the title, and choose it with Enter.
 */
async function pick(page: Page, combobox: Locator, title: string) {
  await combobox.click();
  await expect(combobox).toHaveAttribute('aria-expanded', 'true');
  const active = () =>
    combobox.evaluate(el => {
      const id = el.getAttribute('aria-activedescendant');
      const option = id ? el.ownerDocument.getElementById(id) : null;
      return option?.getAttribute('aria-label') ?? option?.textContent?.trim() ?? '';
    });
  // The list wraps, so a bounded walk visits every option before giving up.
  const seen: string[] = [];
  let current = await active();
  while (current !== title && seen.length < 64) {
    seen.push(current);
    await page.keyboard.press('ArrowDown');
    current = await active();
  }
  expect(current, `active option after ${seen.length} ArrowDown presses`).toBe(title);
  await page.keyboard.press('Enter');
  await expect(combobox).toHaveAttribute('aria-expanded', 'false');
}

/** Fills the draft, chooses the real Cascader path and reviews it; returns the input node. */
async function fillAndReview(page: Page) {
  const l = lab(page);
  await l.name.click();
  await l.name.fill(draftName);
  await l.category.click();
  await expect(l.category).toHaveAttribute('aria-expanded', 'true');
  // GenUXCascader exposes a tree of Level N groups whose treeitems are named by their path.
  const tree = page.getByRole('tree', { name: /category path/i });
  for (const [level, label] of categoryPath.entries())
    await tree
      .getByRole('group', { name: `Level ${level + 1}`, exact: true })
      .getByRole('treeitem', { name: new RegExp(`(?:^|/ )${label}(?:$|[\\s./])`) })
      .filter({ visible: true })
      .first()
      .click();
  // A leaf closes the panel; if changeOnSelect keeps it open, Escape closes it from the field.
  if ((await l.category.getAttribute('aria-expanded')) === 'true') await l.category.press('Escape');
  await expect(l.category).toHaveAttribute('aria-expanded', 'false');
  await l.review.click();
  await expect(l.result).toContainText(draftName);
  await expect(l.result).toContainText(pathText);
  await l.name.evaluate(el => {
    (el as NodeProof).genuxNodeProof = 'kept';
  });
  const handle = await l.name.elementHandle();
  expect(handle).not.toBeNull();
  return handle!;
}

/** Same connected input node, its value and the reviewed name and category path. */
async function expectDraftKept(page: Page, handle: ElementHandle<HTMLElement | SVGElement>) {
  const l = lab(page);
  expect(await handle.evaluate(el => el.isConnected)).toBe(true);
  expect(await l.name.evaluate(el => (el as NodeProof).genuxNodeProof)).toBe('kept');
  await expect(l.name).toHaveValue(draftName);
  await expect(l.result).toContainText(draftName);
  await expect(l.result).toContainText(pathText);
}

function signalList(page: Page, heading: RegExp) {
  return page.getByRole('heading', { name: heading }).locator('xpath=following-sibling::dl[1]');
}

function signalValue(list: Locator, term: string) {
  return list
    .locator('div')
    .filter({
      has: list
        .page()
        .getByRole('term')
        .filter({ hasText: new RegExp('^' + term + '$') }),
    })
    .getByRole('definition')
    .textContent();
}

async function readSignals(list: Locator) {
  return {
    viewport: await signalValue(list, 'Viewport'),
    coarse: await signalValue(list, 'Coarse pointer'),
    fine: await signalValue(list, 'Fine pointer'),
  };
}

/** Input frames currently painting the shared bottom focus marker. */
function markedFields(page: Page) {
  return page.evaluate(
    () =>
      Array.from(document.querySelectorAll('.genux-input-frame[data-genux-input]')).filter(
        el => getComputedStyle(el).backgroundImage !== 'none',
      ).length,
  );
}

const caret = (field: Locator) => field.evaluate(el => (el as HTMLInputElement).selectionStart);

async function placeCaret(field: Locator, at: number) {
  await field.click();
  await field.evaluate(
    (el, position) => (el as HTMLInputElement).setSelectionRange(position, position),
    at,
  );
}

/** Outline, shadow, underline and box of an element and its ancestors up to the body. */
function focusPaint(target: Locator) {
  return target.evaluate(el => {
    const style = getComputedStyle(el);
    const outlines: string[] = [];
    for (
      let node: Element | null = el;
      node && node !== el.ownerDocument.body;
      node = node.parentElement
    )
      outlines.push(getComputedStyle(node).outlineStyle);
    const r = el.getBoundingClientRect();
    return {
      outlines: [...new Set(outlines)],
      boxShadow: style.boxShadow,
      textDecoration: style.textDecorationLine,
      border: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ].join(' '),
      width: r.width,
      height: r.height,
    };
  });
}

/** WebKit leaves a pressed link unfocused; the start point is then focused directly and reported. */
async function focusAfterPointer(link: Locator) {
  const focused = await link.evaluate(el => el === el.ownerDocument.activeElement);
  if (!focused) await link.focus();
  await expect(link).toBeFocused();
  return focused;
}

/** The lab's preview theme is an AntD Segmented radiogroup; a click on the option's label picks it. */
async function choosePreviewTheme(page: Page, mode: 'Dark' | 'Light') {
  const group = page.getByRole('radiogroup', { name: /^preview theme$/i });
  await expect(group).toBeVisible();
  const name = new RegExp('^' + mode + '$', 'i');
  const option = group.getByRole('radio', { name });
  // `has` resolves inside each label, so its inner locator starts from the page, not the group.
  const label = group.locator('label').filter({ has: page.getByRole('radio', { name }) });
  await expect(label).toHaveCount(1);
  await label.click();
  await expect(option).toBeChecked();
}

type ResourceFile = { sha256: string; bytes: number };
/** One static group of the map: base-prefixed URLs and the hash and size of every file read. */
type ResourceGroup = {
  js: string[];
  css: string[];
  assets: string[];
  files: Record<string, ResourceFile>;
};
type EntryGroup = ResourceGroup & { entry: string };
type AdaptiveOwner = LayoutProfile | 'genuxLab';
/** One adaptive-ownership.json record, keyed in the map by its base-prefixed URL. */
type OwnershipRecord = { sources: string[]; owners: AdaptiveOwner[] };
type AdaptiveResourceMap = {
  base: string;
  manifestPath: string;
  profiles: Record<LayoutProfile, EntryGroup>;
  baseline: ResourceGroup & { html: string; roots: string[] };
  features: { genuxLab: EntryGroup & { entries: string[] } };
  ownership: Record<string, OwnershipRecord>;
};
type BuildAdaptiveResourceMap = (options: { outDir: string; base?: string }) => Promise<unknown>;
/** The helper's production validator: true, or a throw naming the file and its foreign owners. */
type AssertAdaptiveResourceIsolation = (
  map: unknown,
  allowedOwners?: readonly AdaptiveOwner[],
) => true;

const layoutProfiles: readonly LayoutProfile[] = [
  'phone',
  'tablet',
  'laptop',
  'desktop',
  'wide',
  'living-room',
];

/** A group of the helper's actual shape: URL path arrays and a SHA-256 for each JS and CSS file. */
function expectGroup(value: unknown, label: string, withEntry: boolean) {
  const group = (value ?? {}) as Partial<EntryGroup>;
  for (const key of ['js', 'css', 'assets'] as const) {
    const list: unknown = group[key];
    expect(
      Array.isArray(list) && list.every(url => typeof url === 'string' && url.startsWith('/')),
      `${label}.${key} lists URL paths`,
    ).toBe(true);
  }
  expect(typeof group.files, `${label}.files`).toBe('object');
  for (const url of [...group.js!, ...group.css!])
    expect(group.files?.[url]?.sha256, `${label} hashes ${url}`).toMatch(/^[0-9a-f]{64}$/);
  if (!withEntry) return;
  expect(typeof group.entry, `${label}.entry`).toBe('string');
  expect(group.js, `${label} closure includes its entry`).toContain(group.entry);
}

const adaptiveOwners: readonly AdaptiveOwner[] = [...layoutProfiles, 'genuxLab'];

/**
 * Emitted adaptive resources read from the production docs dist by the committed helper's
 * buildAdaptiveResourceMap; its real shape is checked here instead of guessing hashed filenames.
 * The helper's own assertAdaptiveResourceIsolation is returned with it, never reimplemented.
 */
async function loadAdaptiveResourceMap(
  base: string,
): Promise<{ map: AdaptiveResourceMap; assertIsolation: AssertAdaptiveResourceIsolation }> {
  const helper = new URL('../../tools/docs-adaptive-resource-map.mjs', import.meta.url);
  const tool = (await import(helper.href)) as {
    buildAdaptiveResourceMap?: BuildAdaptiveResourceMap;
    assertAdaptiveResourceIsolation?: AssertAdaptiveResourceIsolation;
  };
  expect(
    typeof tool.buildAdaptiveResourceMap,
    'docs-adaptive-resource-map.mjs exports buildAdaptiveResourceMap',
  ).toBe('function');
  expect(
    typeof tool.assertAdaptiveResourceIsolation,
    'docs-adaptive-resource-map.mjs exports assertAdaptiveResourceIsolation',
  ).toBe('function');
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
  const map = (await tool.buildAdaptiveResourceMap!({
    outDir: path.join(repoRoot, 'docs/dist'),
    base,
  })) as Partial<AdaptiveResourceMap>;
  expect(map.base).toBe(base.endsWith('/') ? base : `${base}/`);
  expect(typeof map.manifestPath, 'manifestPath').toBe('string');
  for (const profile of layoutProfiles)
    expectGroup(map.profiles?.[profile], `profiles.${profile}`, true);
  expectGroup(map.baseline, 'baseline', false);
  expect(map.baseline?.roots?.length ?? 0, 'baseline roots').toBeGreaterThan(0);
  expectGroup(map.features?.genuxLab, 'features.genuxLab', true);
  expect(Array.isArray(map.features?.genuxLab?.entries), 'features.genuxLab.entries').toBe(true);
  // Every record is one build-emitted owner list; unknown owners or missing sources fail here.
  const ownership = map.ownership;
  expect(
    ownership !== null && typeof ownership === 'object' && !Array.isArray(ownership),
    'map.ownership is a record',
  ).toBe(true);
  for (const [url, record] of Object.entries(ownership ?? {})) {
    expect(url.startsWith(map.base ?? '/'), `${url} is a base-prefixed URL`).toBe(true);
    expect(Array.isArray(record?.sources) && record.sources.length > 0, `${url} sources`).toBe(
      true,
    );
    expect(
      Array.isArray(record?.owners) && record.owners.every(owner => adaptiveOwners.includes(owner)),
      `${url} owners`,
    ).toBe(true);
  }
  // Unknown ownership of mapped code fails the loader; it never passes as shared.
  const groups = [
    map.baseline!,
    map.features!.genuxLab,
    ...layoutProfiles.map(profile => map.profiles![profile]),
  ];
  const unowned = [...new Set(groups.flatMap(group => [...group.js, ...group.css]))].filter(
    url => !ownership?.[url],
  );
  expect(unowned, 'mapped JS and CSS without an adaptive-ownership.json record').toEqual([]);
  for (const profile of layoutProfiles)
    expect(ownership?.[map.profiles![profile].entry]?.owners, `${profile} entry owner`).toContain(
      profile,
    );
  for (const entry of map.features!.genuxLab.entries)
    expect(ownership?.[entry]?.owners, `genuxLab entry ${entry} owner`).toContain('genuxLab');
  return {
    map: map as AdaptiveResourceMap,
    assertIsolation: tool.assertAdaptiveResourceIsolation!,
  };
}

/** Every adaptive layout profile selector, whichever profile it scopes. */
const anyProfileSelector = new RegExp(
  `\\.adaptive-layout-(?:${layoutProfiles.join('|')})(?![\\w-])`,
  'g',
);
/** Source-only Sass syntax that compiled CSS never carries. */
const scssSyntax = /\$[A-Za-z_][\w-]*|@(?:use|forward|mixin|include|extend|each|function)\b|#\{/g;

/** Raw style blocks of the server's HTML, read before any script can add or remove one. */
function htmlStyleBlocks(html: string) {
  return Array.from(html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi), match => ({
    attributes: match[1],
    css: match[2],
  }));
}

/** Profile style tags in the live document and profile selectors in every readable sheet. */
function profileStyles(page: Page) {
  return page.evaluate(profiles => {
    const tags = Array.from(document.querySelectorAll('style[data-adaptive-layout-style]')).map(
      el => ({
        profile: el.getAttribute('data-adaptive-layout-style') ?? '',
        bytes: (el.textContent ?? '').length,
      }),
    );
    const selectors: Record<string, number> = {};
    let unreadable = 0;
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule)
          for (const profile of profiles)
            if (new RegExp(`\\.adaptive-layout-${profile}(?![\\w-])`).test(rule.selectorText))
              selectors[profile] = (selectors[profile] ?? 0) + 1;
        if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        // A cross-origin sheet cannot be read; it is counted and reported.
        unreadable += 1;
      }
    }
    return { tags, selectors, unreadable };
  }, layoutProfiles);
}

/** The optional native GenUX style is a React 19 hoisted resource keyed by its href. */
const nativeStyleSelector = 'style[data-href=genux-native-styles]';
/** Native control selectors that only the optional GenUX style may carry. */
const nativeCssSelector = /[.]genux-(?:slider|rich-menu)/g;

/** Optional native GenUX style tags in the live document: compiled text and parsed rule count. */
function nativeStyles(page: Page) {
  return page.evaluate(
    selector =>
      Array.from(document.querySelectorAll(selector)).map(el => {
        const count = (rules: CSSRuleList): number =>
          Array.from(rules).reduce(
            (total, rule) =>
              total + 1 + ('cssRules' in rule ? count((rule as CSSGroupingRule).cssRules) : 0),
            0,
          );
        const sheet = (el as HTMLStyleElement).sheet;
        const text = el.textContent ?? '';
        return {
          precedence: el.getAttribute('data-precedence') ?? '',
          text,
          bytes: text.length,
          parsedRules: sheet ? count(sheet.cssRules) : -1,
        };
      }),
    nativeStyleSelector,
  );
}

/** Native control selectors in every live style block, whichever code installed it. */
function liveNativeSelectors(page: Page) {
  return page.evaluate(
    source =>
      Array.from(document.querySelectorAll('style')).flatMap(
        el => (el.textContent ?? '').match(new RegExp(source, 'g')) ?? [],
      ),
    nativeCssSelector.source,
  );
}

/** Only allowed profiles have style tags or selectors; the selected one has exactly one tag. */
async function expectProfileStyles(
  page: Page,
  allowed: readonly LayoutProfile[],
  selected: LayoutProfile,
) {
  await expect
    .poll(
      async () => (await profileStyles(page)).tags.filter(tag => tag.profile === selected).length,
      `${selected} style tags`,
    )
    .toBe(1);
  const state = await profileStyles(page);
  const foreign = (profile: string) => !allowed.includes(profile as LayoutProfile);
  expect(
    state.tags.map(tag => tag.profile).filter(foreign),
    'unselected profile style tags',
  ).toEqual([]);
  expect(
    Object.keys(state.selectors).filter(foreign),
    'unselected profile selectors in document CSS',
  ).toEqual([]);
  expect(state.selectors[selected] ?? 0, `${selected} selectors in document CSS`).toBeGreaterThan(
    0,
  );
  return state;
}

/**
 * The selected tag's compiled text, its style rules and any rule outside its profile root or,
 * for living-room only, outside the bounded explicit TV scope its source declares.
 */
function profileStyleRules(page: Page, profile: LayoutProfile) {
  return page.locator(`style[data-adaptive-layout-style='${profile}']`).evaluate((el, name) => {
    const scope = new RegExp(`\\.adaptive-layout-${name}(?![\\w-])`);
    const unscoped: string[] = [];
    let styleRules = 0;
    // Top-level selector list items; commas inside :is() or attribute brackets stay in one item.
    const items = (selector: string) => {
      const list: string[] = [];
      let depth = 0;
      let start = 0;
      for (let at = 0; at < selector.length; at += 1) {
        const char = selector[at];
        if (char === '(' || char === '[') depth += 1;
        else if (char === ')' || char === ']') depth -= 1;
        else if (char === ',' && depth === 0) {
          list.push(selector.slice(start, at).trim());
          start = at + 1;
        }
      }
      return [...list, selector.slice(start).trim()];
    };
    // Quotes and spaces as each engine serializes them; the selector meaning is unchanged.
    const normal = (selector: string) =>
      selector.split("'").join('"').split(' ').filter(Boolean).join(' ');
    /** A CSSScopeRule start or end: its top-level selector list items, outer parentheses removed. */
    const limits = (selector: string | null) => {
      let text = (selector ?? '').trim();
      if (text.startsWith('(') && text.endsWith(')')) text = text.slice(1, -1).trim();
      return text ? items(text).map(normal) : [];
    };
    // The only admitted scope is the explicit TV surface: it starts at the TV roots of
    // living-room.scss and ends at every non-TV shell and surface.
    const tvSurface = normal("[data-adaptive-surface='living-room']");
    const tvStarts = [normal('.adaptive-layout-living-room'), tvSurface];
    const tvEnds = [
      normal('.adaptive-shell:not(.adaptive-layout-living-room)'),
      normal("[data-adaptive-surface]:not([data-adaptive-surface='living-room'])"),
    ].sort();
    const boundedTvScope = (rule: CSSScopeRule) => {
      const start = limits(rule.start);
      const end = limits(rule.end).sort();
      return (
        name === 'living-room' &&
        start.length > 0 &&
        start.every(item => tvStarts.includes(item)) &&
        end.length === tvEnds.length &&
        end.every((item, at) => item === tvEnds[at])
      );
    };
    // Inside that scope a selector may name no other profile root.
    const foreignProfile = new RegExp(
      `[.]adaptive-layout-(?!${name}(?![0-9A-Za-z_-]))[0-9A-Za-z_-]`,
    );
    // Outside any scope, the TV surface attribute alone may only define the top-level TV roles.
    const tvRoles = (rule: CSSStyleRule, item: string) =>
      name === 'living-room' &&
      rule.parentRule === null &&
      normal(item) === tvSurface &&
      rule.style.length > 0 &&
      Array.from(rule.style).every(property => property.startsWith('--adaptive-tv-'));
    const walk = (rules: CSSRuleList, inTvScope: boolean) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSKeyframesRule || rule.constructor.name === 'CSSLayerStatementRule')
          continue;
        if (rule instanceof CSSStyleRule) {
          styleRules += 1;
          // A rule outside the profile root or its bounded TV scope, or one that retargets the
          // document or theme, leaks.
          for (const item of items(rule.selectorText))
            if (
              (inTvScope ? foreignProfile.test(item) : !scope.test(item) && !tvRoles(rule, item)) ||
              /^(?::root|html|body)\b/.test(item) ||
              item.includes('[data-theme')
            )
              unscoped.push(item);
        } else if (typeof CSSScopeRule !== 'undefined' && rule instanceof CSSScopeRule) {
          // A nested, unbounded or foreign scope leaks, whatever its children select.
          if (!inTvScope && boundedTvScope(rule)) walk(rule.cssRules, true);
          else unscoped.push(`@scope (${rule.start ?? ''}) to (${rule.end ?? ''})`);
        } else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules, inTvScope);
        else unscoped.push(rule.cssText.slice(0, 80));
      }
    };
    const sheet = (el as HTMLStyleElement).sheet;
    if (sheet) walk(sheet.cssRules, false);
    else unscoped.push('no parsed sheet');
    const text = el.textContent ?? '';
    return { text, bytes: text.length, styleRules, unscoped };
  }, profile);
}

/** The selected tag carries compiled CSS whose every rule is scoped to its own profile root. */
async function expectCompiledProfileCss(page: Page, profile: LayoutProfile) {
  const css = await profileStyleRules(page, profile);
  expect(css.bytes, `${profile} style tag CSS`).toBeGreaterThan(0);
  expect(css.styleRules, `${profile} compiled style rules`).toBeGreaterThan(0);
  expect(css.text.match(scssSyntax) ?? [], `${profile} SCSS syntax`).toEqual([]);
  expect(css.unscoped, `${profile} rules outside .adaptive-layout-${profile}`).toEqual([]);
  return { bytes: css.bytes, styleRules: css.styleRules };
}

/** The shell's profile root, its computed display and the selected tag's rule that makes it a grid. */
function activeRoot(shell: Locator, profile: LayoutProfile) {
  return shell.evaluate((el, name) => {
    const className = `adaptive-layout-${name}`;
    const root = el.classList.contains(className)
      ? el
      : (el.closest(`.${className}`) ?? el.querySelector(`.${className}`));
    const tags = el.ownerDocument.querySelectorAll(`style[data-adaptive-layout-style='${name}']`);
    let gridRule = '';
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          try {
            if (
              !gridRule &&
              root?.matches(rule.selectorText) &&
              rule.style.getPropertyValue('display').trim() === 'grid'
            )
              gridRule = rule.selectorText;
          } catch {
            // A selector this engine cannot match is not the rule that made the root a grid.
          }
        } else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    const sheet = (tags[0] as HTMLStyleElement | undefined)?.sheet;
    if (sheet) walk(sheet.cssRules);
    return {
      found: Boolean(root),
      tags: tags.length,
      display: root ? getComputedStyle(root).display : '',
      gridRule,
    };
  }, profile);
}

type Measured = {
  url: string;
  phase: string;
  status: number;
  resourceType: string;
  contentType: string;
  encoding: string;
  encodedBodySize: number;
  transferSize: number;
  decodedBodySize: number;
};

/** Encoded body and transfer sizes from the browser; the decoded size from the body itself. */
async function measure(request: Request, phase: string): Promise<Measured | null> {
  try {
    const response = await request.response();
    if (!response) return null;
    const sizes = await request.sizes();
    const headers = await response.allHeaders();
    // Header names are case-insensitive; the lookup does not rely on the browser lowercasing them.
    const header = (name: string) =>
      Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1] ?? '';
    const status = response.status();
    let decodedBodySize = -1;
    if (status === 304) {
      // A 304 carries no body by HTTP design; 0 is its actual size and no cached copy is read.
      decodedBodySize = 0;
    } else {
      try {
        decodedBodySize = (await response.body()).length;
      } catch {
        // Redirects have no readable body; -1 marks that honestly.
      }
    }
    return {
      url: request.url(),
      phase,
      status,
      resourceType: request.resourceType(),
      contentType: header('content-type'),
      encoding: header('content-encoding') || 'identity',
      encodedBodySize: sizes.responseBodySize,
      transferSize: sizes.responseHeadersSize + sizes.responseBodySize,
      decodedBodySize,
    };
  } catch {
    return null;
  }
}

test('320-first draft journey keeps one business subtree across the fourteen web widths', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/adaptive/');
  await expectShell(page, 'phone');
  const fonts = await expectFonts(page);
  const l = lab(page);
  const handle = await fillAndReview(page);
  // The labelled section and its scrollable gallery share one name; the gallery is the region inside it.
  const galleryName = /card container widths/i;
  const gallery = page
    .getByRole('region', { name: galleryName })
    .getByRole('region', { name: galleryName });
  // Only the record table and the gallery scroll inline; the preview frame and headings never do.
  const frame = page.locator('[data-adaptive-preview-mode]');
  await expect(frame).toHaveCount(1);
  const sectionHeadings = [
    page.getByRole('heading', { name: /^responsive data examples$/i }),
    page.getByRole('heading', { name: /^card container widths$/i }),
  ];
  const readHeadings = async () => {
    const list: HeadingState[] = [];
    for (const heading of sectionHeadings) list.push(await headingState(heading, frame));
    return list;
  };
  const rows: Record<string, unknown>[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const profile = webProfile(width);
    await expectShell(page, profile);
    // The profile's own compiled style tag, not a class or data attribute alone, makes the root a grid.
    await expect
      .poll(() => activeRoot(l.shell, profile), `${profile} root at ${width}`)
      .toMatchObject({ found: true, tags: 1, display: 'grid' });
    const root = await activeRoot(l.shell, profile);
    expect(root.gridRule, `${profile} style tag rule that makes the root a grid`).not.toBe('');
    const screens = expectedScreens(width);
    await expect.poll(() => gridScreens(page)).toEqual(screens);
    const span = expectedSpan(width);
    const cols: Record<string, unknown>[] = [];
    for (const step of ['Intake', 'Review', 'Approval']) {
      const col = await colGeometry(page, step);
      expect(col.classes).toEqual(
        expect.arrayContaining(['ant-col-xs-24', 'ant-col-md-12', 'ant-col-xl-8']),
      );
      expect(Math.abs(col.ratio * 24 - span), `${step} span at ${width}`).toBeLessThan(0.6);
      cols.push({ step, ...col });
    }
    // AdaptiveSider follows the shared laptop width, 960, from the actual environment.
    await expect.poll(async () => (await siderState(page)).collapsed).toBe(width < 960);
    const sider = await siderState(page);
    await expectDraftKept(page, handle);
    for (const control of [l.name, l.category, l.review]) await expectReachable(control, width);
    expect(await splitWords(l.result, unsplitWords)).toEqual([]);

    const table = await tableState(page);
    expect(table.contained).toBe(true);
    expect(table.right).toBeLessThanOrEqual(width + 1);
    expect(
      table.wraps.filter(wrap => wrap.startsWith('break-all') || wrap.endsWith('anywhere')),
    ).toEqual([]);
    expect(table.split).toEqual([]);
    if (width === 320) expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);

    // Six fixed card containers scroll inside the gallery, never the page.
    const cards = await galleryState(gallery);
    expect(cards.widths).toEqual([240, 288, 320, 480, 640, 960]);
    expect(cards.overflowX).toBe('auto');
    expect(cards.scrollWidth).toBeGreaterThan(cards.clientWidth);
    expect(cards.right).toBeLessThanOrEqual(width + 1);
    // Ordinary section headings stay inside the frame and the viewport at every width.
    const headings = await readHeadings();
    for (const heading of headings) expectHeadingInside(heading, width);
    let galleryScroll: Record<string, unknown> | null = null;
    if (width === 320) {
      await gallery.scrollIntoViewIfNeeded();
      await gallery.hover();
      await page.mouse.wheel(320, 0);
      await expect.poll(() => gallery.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      // Wheeling on toward the gallery's end moves only the gallery; the frame and headings stay put.
      const firstScroll = await gallery.evaluate(el => el.scrollLeft);
      await page.mouse.wheel(4000, 0);
      await expect.poll(() => gallery.evaluate(el => el.scrollLeft)).toBeGreaterThan(firstScroll);
      await settleMotion(page.locator('body'));
      const scrolled = await readHeadings();
      for (const [index, heading] of scrolled.entries()) {
        expectHeadingInside(heading, width);
        expect(
          Math.abs(heading.left - headings[index].left),
          `${heading.text} left edge after the gallery scroll`,
        ).toBeLessThanOrEqual(0.5);
        expect(
          Math.abs(heading.right - headings[index].right),
          `${heading.text} right edge after the gallery scroll`,
        ).toBeLessThanOrEqual(0.5);
      }
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      await saveShot(page, 'adaptive-ui-320-gallery-scrolled.png');
      galleryScroll = {
        scrollLeft: await gallery.evaluate(el => el.scrollLeft),
        headings: scrolled,
      };
    }

    const overflow = await pageOverflow(page);
    expect(overflow, `page overflow at ${width}`).toBeLessThanOrEqual(0);
    const text = await readableText(page);
    expect(text.offenders, `text under 14 CSS px at ${width}`).toEqual([]);
    expect(text.checked).toBeGreaterThan(30);
    if (shotWidths.has(width)) {
      await expectFonts(page);
      await settleMotion(page.locator('body'));
      await saveShot(page, `adaptive-ui-${width}.png`);
    }
    rows.push({
      width,
      profile,
      screens,
      span,
      cols,
      sider,
      table,
      cards,
      overflow,
      textChecked: text.checked,
      root,
      headings,
      galleryScroll,
    });
  }
  // Reviewing again reads the current draft: the category path itself survived every width.
  await l.review.click();
  await expect(l.result).toContainText(draftName);
  await expect(l.result).toContainText(pathText);
  await saveJson('adaptive-ui-widths.json', { fonts, widths: rows });
});

test('Simulation, phone lock, preview theme and explicit TV focus keep one draft', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/adaptive/');
  await expectShell(page, 'desktop');
  await expectFonts(page);
  const l = lab(page);
  const html = page.locator('html');
  const handle = await fillAndReview(page);
  const actualSignals = signalList(page, /^actual signals$/i);
  // The nearest GenUXProvider owner around the journey publishes the resolved short height.
  const journeyOwner = l.main.locator('xpath=ancestor::*[@data-adaptive-short-height][1]');

  // Actual rotation without a lock: an established phone survives 430x932 to 932x430.
  await page.setViewportSize({ width: 430, height: 932 });
  await expectShell(page, 'phone');
  await expect(l.shell).toHaveAttribute('data-orientation', 'portrait');
  await l.name.click();
  await expect(l.name).toBeFocused();
  await page.setViewportSize({ width: 932, height: 430 });
  await expect(l.shell).toHaveAttribute('data-orientation', 'landscape');
  // Width alone resolves 932 to tablet; only the measured journey keeps the phone.
  await expectShell(page, 'phone');
  await expect(l.name).toBeFocused();
  await expectDraftKept(page, handle);
  // Releasing the retained journey resolves the current width again, which is a tablet.
  const resetJourney = page.getByRole('button', { name: /^reset\b/i });
  await expect(resetJourney).toHaveCount(1);
  await resetJourney.click();
  await expectShell(page, 'tablet');
  await expect(l.shell).toHaveAttribute('data-orientation', 'landscape');
  await expectDraftKept(page, handle);

  // A short desktop window stays desktop without a lock; the draft and its focus stay.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expectShell(page, 'desktop');
  await l.name.click();
  await page.setViewportSize({ width: 1280, height: 400 });
  await expect(journeyOwner).toHaveAttribute('data-adaptive-short-height', 'true');
  await expectShell(page, 'desktop');
  await expect(l.name).toBeFocused();
  await expectDraftKept(page, handle);
  await expectReachable(l.review, 1280);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(journeyOwner).toHaveAttribute('data-adaptive-short-height', 'false');
  await expectShell(page, 'desktop');

  // Emulated reduced motion: semantic clicks still act and opened layers settle.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => signalValue(actualSignals, 'Reduced motion')).toBe('Yes');
  await l.category.click();
  await expect(l.category).toHaveAttribute('aria-expanded', 'true');
  // Measured only: the shared motion contract decides how reduce maps to durations.
  const reducedRunning = await runningFiniteAnimations(page.locator('body'));
  await l.category.press('Escape');
  await expect(l.category).toHaveAttribute('aria-expanded', 'false');
  await l.review.click();
  await expectDraftKept(page, handle);
  await settleMotion(page.locator('body'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => signalValue(actualSignals, 'Reduced motion')).toBe('No');

  // A temporary 200% root text size at 320: nothing shrinks, overflows or becomes unreachable.
  await page.setViewportSize({ width: 320, height: 900 });
  await expectShell(page, 'phone');
  const rootText = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect
    .poll(() => html.evaluate(el => parseFloat(getComputedStyle(el).fontSize)))
    .toBeGreaterThanOrEqual(32);
  await expectDraftKept(page, handle);
  for (const control of [l.name, l.category, l.review]) await expectReachable(control, 320);
  expect(await pageOverflow(page), 'page overflow at 320 with 200% root text').toBeLessThanOrEqual(
    0,
  );
  const enlargedText = await readableText(page);
  expect(enlargedText.offenders, 'text under 14 CSS px with 200% root text').toEqual([]);
  await rootText.evaluate(el => {
    el.parentNode?.removeChild(el);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expectShell(page, 'desktop');
  await expectDraftKept(page, handle);
  await expect
    .poll(async () => (await readSignals(actualSignals)).viewport)
    .toBe('1280 by 900 CSS px');
  const actualBefore = await readSignals(actualSignals);
  expect(actualBefore.viewport).toBe('1280 by 900 CSS px');

  // Simulation replaces only the chosen signals; the explicit phone lock survives landscape.
  await page.getByRole('button', { name: /^start simulation$/i }).click();
  await expect(page.getByRole('button', { name: /^use actual signals$/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const simulatedWidth = page.getByRole('combobox', { name: /^simulated width/i });
  const simulatedHeight = page.getByRole('combobox', { name: /^simulated height/i });
  const lock = page.getByRole('combobox', { name: /^layout profile lock/i });
  await pick(page, simulatedWidth, '430 CSS px');
  await pick(page, simulatedHeight, '932 CSS px');
  await pick(page, lock, 'Phone');
  await expectShell(page, 'phone');
  await expect(l.shell).toHaveAttribute('data-orientation', 'portrait');
  await expectDraftKept(page, handle);
  await pick(page, simulatedWidth, '932 CSS px');
  await pick(page, simulatedHeight, '430 CSS px');
  await expect(l.shell).toHaveAttribute('data-orientation', 'landscape');
  // Width alone would resolve 932 to tablet; only the explicit lock keeps the phone journey.
  await expectShell(page, 'phone');
  await expect(signalList(page, /^simulated resolution$/i)).toContainText('Phone');
  await expectDraftKept(page, handle);

  // Simulated coarse and fine pointers add both input layers; actual signals stay measured.
  const coarse = page.getByRole('switch', { name: /^simulated coarse pointer$/i });
  const fine = page.getByRole('switch', { name: /^simulated fine pointer and hover$/i });
  await expect(coarse).toBeChecked();
  await fine.click();
  await expect(fine).toBeChecked();
  await expect(l.shell).toHaveAttribute('data-input-layers', 'coarse precision');
  const layers = await l.shell.getAttribute('data-input-layers');
  const simulatedSignals = await readSignals(signalList(page, /^simulated signals$/i));
  expect(simulatedSignals).toEqual({ viewport: '932 by 430 CSS px', coarse: 'Yes', fine: 'Yes' });
  expect(await readSignals(actualSignals)).toEqual(actualBefore);
  await expectShell(page, 'phone');

  // The local preview theme changes only the inner preview root, never the host document.
  const hostTheme = () =>
    html.evaluate(el => ({
      theme: el.getAttribute('data-theme'),
      className: el.className,
      colorScheme: getComputedStyle(el).colorScheme,
    }));
  // The preview owner is the first GenUXProvider inside the lab frame.
  const frame = page.locator('[data-adaptive-preview-mode]');
  await expect(frame).toHaveCount(1);
  const previewOwner = frame.locator('[data-theme-mode]').first();
  /** Custom properties the owner inlines, the record table's surface and the nearest field paint. */
  const previewPaint = async () => ({
    ...(await previewOwner.evaluate(el => {
      const style = (el as HTMLElement).style;
      const tokens: Record<string, string> = {};
      for (const name of Array.from(style))
        if (name.startsWith('--')) tokens[name] = style.getPropertyValue(name).trim();
      const table = el.querySelector('.ant-table');
      return { tokens, tableBackground: table ? getComputedStyle(table).backgroundColor : '' };
    })),
    // The draft name field: its resolved --field-bg and the first painted well up to its frame.
    field: await l.name.evaluate(input => {
      const owner = input.closest('[data-adaptive-preview-mode] [data-theme-mode]');
      if (!owner) throw new Error('The draft field is outside the preview owner.');
      const frame = input.closest('.genux-input-frame') ?? owner;
      const clear = (color: string) => {
        const compact = color.replace(/\s/g, '');
        return color === 'transparent' || compact.endsWith(',0)') || compact.endsWith('/0)');
      };
      let background = '';
      for (let node: Element | null = input; node && !background; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (!clear(color)) background = color;
        if (node === frame) break;
      }
      return {
        fieldBg: getComputedStyle(input).getPropertyValue('--field-bg').trim(),
        background,
      };
    }),
  });
  const hostBefore = await hostTheme();
  await expect(previewOwner).toHaveAttribute('data-theme-mode', 'light');
  const paintBefore = await previewPaint();
  expect(paintBefore.tableBackground).not.toBe('');
  expect(paintBefore.field.fieldBg, 'light preview --field-bg').not.toBe('');
  expect(paintBefore.field.background, 'light preview field well').not.toBe('');
  await choosePreviewTheme(page, 'Dark');
  await expect(frame).toHaveAttribute('data-adaptive-preview-mode', 'dark');
  await expect(previewOwner).toHaveAttribute('data-theme-mode', 'dark');
  await expect
    .poll(async () => (await previewPaint()).field.background)
    .not.toBe(paintBefore.field.background);
  await expect
    .poll(async () => (await previewPaint()).tableBackground)
    .not.toBe(paintBefore.tableBackground);
  const paintAfter = await previewPaint();
  expect(paintAfter.field.fieldBg, 'preview field reads the dark --field-bg').not.toBe(
    paintBefore.field.fieldBg,
  );
  expect(paintAfter.tokens, 'preview owner tokens follow the dark theme').not.toEqual(
    paintBefore.tokens,
  );
  expect(await hostTheme()).toEqual(hostBefore);
  await expectDraftKept(page, handle);

  // Generic web: ArrowLeft after a pointer press only moves the caret; Tab opens one marker.
  await placeCaret(l.name, 5);
  await expect(html).toHaveAttribute('data-input-modality', 'pointer');
  await l.name.press('ArrowLeft');
  await expect(l.name).toBeFocused();
  expect(await caret(l.name)).toBe(4);
  await expect(html).toHaveAttribute('data-input-modality', 'pointer');
  await expect.poll(() => markedFields(page)).toBe(0);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(l.name).toBeFocused();
  await expect(html).toHaveAttribute('data-input-modality', 'keyboard');
  await expect.poll(() => markedFields(page)).toBe(1);
  const webKeyboard = await focusPaint(l.name);
  expect(webKeyboard.outlines).toEqual(['none']);

  // Explicit living-room: a handled ArrowDown moves between nav links with the same ringless focus.
  const surface = page.getByRole('combobox', { name: /^product surface/i });
  await pick(page, surface, 'Living room (TV)');
  await expectShell(page, 'living-room', 'living-room');
  await expect(l.shell).toHaveAttribute('data-navigation', 'spatial');
  await expectDraftKept(page, handle);
  const draftLink = l.nav.getByRole('link', { name: /^draft review$/i });
  const hostLink = l.nav.getByRole('link', { name: /^host integration$/i });
  await draftLink.click();
  await expect(html).toHaveAttribute('data-input-modality', 'pointer');
  const pointerFocusedLink = await focusAfterPointer(draftLink);
  const hostBeforeFocus = await focusPaint(hostLink);
  const hostContrastBefore = await focusContrast(hostLink);
  await page.evaluate(() => {
    const view = window as Window & { genuxHashChanges?: number };
    view.genuxHashChanges = 0;
    view.addEventListener('hashchange', () => {
      view.genuxHashChanges = (view.genuxHashChanges ?? 0) + 1;
    });
  });
  await page.keyboard.press('ArrowDown');
  await expect(hostLink).toBeFocused();
  await expect(html).toHaveAttribute('data-input-modality', 'keyboard');
  await expect.poll(async () => (await focusPaint(hostLink)).textDecoration).toContain('underline');
  const tvFocus = await focusPaint(hostLink);
  expect(tvFocus.outlines).toEqual(['none']);
  expect(tvFocus.boxShadow).toBe('none');
  expect(tvFocus.border).toBe(hostBeforeFocus.border);
  expect(Math.abs(tvFocus.width - hostBeforeFocus.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(tvFocus.height - hostBeforeFocus.height)).toBeLessThanOrEqual(0.5);
  await settleMotion(l.shell);
  // Focus itself changes the link's settled paint, readable on its actual dark-preview backdrop.
  const hostContrastFocused = await focusContrast(hostLink);
  expect(hostContrastFocused.paint, 'TV link paint changes on keyboard focus').not.toEqual(
    hostContrastBefore.paint,
  );
  expect(hostContrastFocused.textContrast, 'focused TV link text contrast').toBeGreaterThanOrEqual(
    4.5,
  );
  expect(
    hostContrastFocused.indicatorContrast,
    'focused TV link underline contrast',
  ).toBeGreaterThanOrEqual(3);
  await saveShot(page, 'adaptive-ui-tv-focus.png');
  // Remote targets: each control's effective hit box, or the painted frame around a proxy field.
  const tvTargets = {
    hostLink: await hitTarget(hostLink, 'self'),
    review: await hitTarget(l.review, 'self'),
    name: await hitTarget(l.name, 'frame'),
    category: await hitTarget(l.category, 'frame'),
  };
  for (const [name, target] of Object.entries(tvTargets)) {
    expect(target.found, `${name} painted target`).toBe(true);
    expect(target.width, `${name} target width`).toBeGreaterThanOrEqual(63.5);
    expect(target.height, `${name} target height`).toBeGreaterThanOrEqual(63.5);
    expect(target.hits, `${name} centre and inner edges hit the control`).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  }
  await expect(hostLink).toBeFocused();
  // Enter activates the native anchor once and changes no business state.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#integration$/);
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { genuxHashChanges?: number }).genuxHashChanges),
    )
    .toBe(1);
  await expectDraftKept(page, handle);

  // Inside a TV field ArrowLeft stays a caret key and never forces the visual mode.
  await placeCaret(l.name, 5);
  await expect(html).toHaveAttribute('data-input-modality', 'pointer');
  await l.name.press('ArrowLeft');
  await expect(l.name).toBeFocused();
  expect(await caret(l.name)).toBe(4);
  await expect(html).toHaveAttribute('data-input-modality', 'pointer');
  await expect.poll(() => markedFields(page)).toBe(0);
  // Escape closes the Cascader's own layer and leaves the TV journey in place.
  await l.category.click();
  await expect(l.category).toHaveAttribute('aria-expanded', 'true');
  await l.category.press('Escape');
  await expect(l.category).toHaveAttribute('aria-expanded', 'false');
  await expect(l.category).toBeFocused();
  await expectShell(page, 'living-room', 'living-room');
  await expectDraftKept(page, handle);

  // Back on the web surface the TV arrow handler is gone at once.
  await pick(page, surface, 'Web');
  await expectShell(page, 'phone');
  await expectDraftKept(page, handle);
  await page.getByRole('button', { name: /^use actual signals$/i }).click();
  await expect(page.getByRole('button', { name: /^start simulation$/i })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await pick(page, lock, 'Automatic');
  await expectShell(page, 'desktop');
  await draftLink.click();
  const webPointerFocusedLink = await focusAfterPointer(draftLink);
  await page.keyboard.press('ArrowDown');
  await expect(draftLink).toBeFocused();
  await expect(hostLink).not.toBeFocused();
  await expect(html).toHaveAttribute('data-input-modality', 'pointer');
  await expectDraftKept(page, handle);
  await settleMotion(l.shell);
  await saveShot(page, 'adaptive-ui-state-web.png');
  await saveJson('adaptive-ui-focus-state.json', {
    actual: actualBefore,
    simulated: simulatedSignals,
    layers,
    theme: { host: hostBefore, preview: { before: paintBefore, after: paintAfter } },
    webKeyboard,
    tv: {
      before: hostBeforeFocus,
      focused: tvFocus,
      pointerFocusedLink,
      contrast: { before: hostContrastBefore, focused: hostContrastFocused },
      targets: tvTargets,
    },
    webPointerFocusedLink,
    continuity: {
      rotation: '430 by 932 to 932 by 430 CSS px kept the phone without a lock',
      reset: 'tablet at 932 by 430 CSS px',
      shortHeight: '1280 by 400 CSS px stayed desktop',
    },
    preferences: {
      reducedMotion: { status: 'pass', emulated: true, runningFiniteAfterOpen: reducedRunning },
      rootText: {
        status: 'pass',
        emulated: 'temporary author stylesheet html font-size 200%',
        checked: enlargedText.checked,
      },
      browserTextSetting: {
        status: 'not_run',
        reason: 'No real browser or OS text-size preference was changed.',
      },
    },
    hardwareBack: {
      status: 'not_run',
      reason:
        'No real platform Back key or remote hardware; only browser-delivered keys were used.',
    },
  });
});

test('Cold 320 delivery loads only baseline and phone until the user asks for more', async ({
  browser,
  browserName,
}) => {
  test.setTimeout(180_000);
  const baseURL = test.info().project.use.baseURL;
  expect(baseURL).toBeTruthy();
  const origin = new URL(baseURL!).origin;
  const { map: resources, assertIsolation } = await loadAdaptiveResourceMap(
    new URL(baseURL!).pathname,
  );
  // The production validator itself accepts the initial phone delivery before anything is derived.
  expect(assertIsolation(resources)).toBe(true);
  expect(assertIsolation(resources, ['phone'])).toBe(true);
  // Negative oracle on cloned metadata only: an actual genuxLab-owned non-entry JS dependency the
  // baseline does not ship is added to a cloned baseline, which the validator must then reject.
  const genuxLab = resources.features.genuxLab;
  const genuxEntries = new Set([genuxLab.entry, ...genuxLab.entries]);
  const injected = genuxLab.js.find(
    url =>
      url.endsWith('.js') &&
      !genuxEntries.has(url) &&
      !resources.baseline.js.includes(url) &&
      (resources.ownership[url]?.owners ?? []).includes('genuxLab'),
  );
  expect(
    injected,
    'an actual genuxLab-owned non-entry JS dependency outside the baseline',
  ).toBeTruthy();
  const injectedBaseline = {
    ...resources,
    baseline: { ...resources.baseline, js: [...resources.baseline.js, injected!] },
  };
  expect(injectedBaseline.baseline.js).toContain(injected);
  expect(() => assertIsolation(injectedBaseline)).toThrow(/owned by \[[^\]]*genuxLab/);
  // Two unselected owners are still foreign: a multi-owner file is never treated as shared.
  const twoUnselected = {
    ...injectedBaseline,
    ownership: {
      ...resources.ownership,
      [injected!]: {
        ...resources.ownership[injected!],
        owners: ['tablet', 'desktop'] as AdaptiveOwner[],
      },
    },
  };
  expect(() => assertIsolation(twoUnselected)).toThrow(/owned by \[tablet, desktop\]/);
  // The clones left the actual map untouched, and it still passes.
  expect(resources.baseline.js).not.toContain(injected);
  expect(resources.ownership[injected!].owners).toContain('genuxLab');
  expect(assertIsolation(resources)).toBe(true);
  const isolation = {
    initialPhone: 'pass',
    negative: {
      injected,
      actualOwners: [...resources.ownership[injected!].owners],
      rejected: ['genuxLab in baseline', 'tablet and desktop in baseline'],
    },
  };
  const pathOf = (url: string) => new URL(url, baseURL).pathname;
  const paths = (group: ResourceGroup) => [...group.js, ...group.css].map(pathOf);
  // Static closures are readiness expectations only; ownership alone decides what may load.
  const baseline = new Set(paths(resources.baseline));
  const phone = new Set(paths(resources.profiles.phone));
  const required = new Set([...baseline, ...phone]);
  const genuxPaths = paths(genuxLab);
  // The map must name real phone, TV and AI code, so empty walks cannot pass the checks below.
  expect(required.has(pathOf(resources.profiles.phone.entry))).toBe(true);
  expect(resources.baseline.js).not.toEqual([]);
  for (const [owner, group] of [
    ['living-room', resources.profiles['living-room']],
    ['genuxLab', genuxLab],
  ] as const)
    expect(
      paths(group).filter(
        file => !required.has(file) && (resources.ownership[file]?.owners ?? []).includes(owner),
      ),
      owner,
    ).not.toEqual([]);
  // Touch is emulated in the installed Chromium only; it is never a physical touch device.
  const touch = browserName === 'chromium';

  let phase = 'initial';
  const phases = new Map<Request, string>();
  const requests: { url: string; resourceType: string; phase: string }[] = [];
  const failures: { url: string; error: string; phase: string }[] = [];
  const measured: Promise<Measured | null>[] = [];
  const cold = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
    viewport: { width: 320, height: 800 },
    ...(touch ? { hasTouch: true } : {}),
  });
  cold.on('request', request => {
    phases.set(request, phase);
    requests.push({ url: request.url(), resourceType: request.resourceType(), phase });
  });
  cold.on('requestfailed', request =>
    failures.push({
      url: request.url(),
      error: request.failure()?.errorText ?? '',
      phase: phases.get(request) ?? phase,
    }),
  );
  cold.on('requestfinished', request =>
    measured.push(measure(request, phases.get(request) ?? phase)),
  );
  const requested = (only?: string) =>
    new Set(requests.filter(r => !only || r.phase === only).map(r => new URL(r.url).pathname));
  /** Same-origin JS and CSS the given phases initiated without a record or with a foreign owner. */
  const leaks = (phaseNames: readonly string[], allowed: readonly AdaptiveOwner[]) => {
    const seen = new Set(
      requests
        .filter(r => phaseNames.includes(r.phase) && new URL(r.url).origin === origin)
        .map(r => ({ type: r.resourceType, file: new URL(r.url).pathname }))
        .filter(r => ['script', 'stylesheet'].includes(r.type) || /[.](m?js|css)$/.test(r.file))
        .map(r => r.file),
    );
    // Any owner outside the allowed set is a leak, however many owners the file has.
    return [...seen].flatMap(file => {
      const owners = resources.ownership[file]?.owners;
      if (!owners) return [`unowned ${file}`];
      return owners.filter(owner => !allowed.includes(owner)).map(owner => `${owner} ${file}`);
    });
  };
  try {
    const page = await cold.newPage();
    const navigation = await page.goto('/adaptive/', { waitUntil: 'domcontentloaded' });
    expect(navigation?.status(), 'initial HTML status').toBe(200);
    // The server's HTML ships no profile CSS: no selected style tag and no profile selector at all.
    const initialHtml = await navigation!.text();
    const htmlStyles = htmlStyleBlocks(initialHtml);
    const htmlProfileSelectors = htmlStyles.flatMap(
      block => block.css.match(anyProfileSelector) ?? [],
    );
    expect(htmlProfileSelectors, 'profile selectors in initial HTML style blocks').toEqual([]);
    // The optional native GenUX CSS is neither a server style tag nor inlined in a style block.
    const htmlNative = {
      tags: htmlStyles.filter(block => /genux-native-styles/i.test(block.attributes)).length,
      selectors: htmlStyles.flatMap(block => block.css.match(nativeCssSelector) ?? []),
    };
    expect(htmlNative, 'native GenUX styles in initial HTML').toEqual({ tags: 0, selectors: [] });
    expect(
      htmlStyles.filter(block => /data-adaptive-layout-style/i.test(block.attributes)).length,
      'profile style tags in initial HTML',
    ).toBe(0);
    await expectShell(page, 'phone');
    await expectFonts(page);
    // After the phone shell resolves, only its own compiled, scoped style tag is installed.
    const phoneStyles = await expectProfileStyles(page, ['phone'], 'phone');
    const phoneCss = await expectCompiledProfileCss(page, 'phone');
    // The phone shell renders no GenUX surface, so no native style tag or control CSS is live.
    expect(await nativeStyles(page), 'native GenUX style tags at the phone shell').toEqual([]);
    expect(await liveNativeSelectors(page), 'native GenUX selectors in live style blocks').toEqual(
      [],
    );
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    // Readiness is the required subset initiated, not a quiet network.
    await expect
      .poll(() => [...required].filter(file => !requested('initial').has(file)))
      .toEqual([]);
    expect(leaks(['initial'], ['phone'])).toEqual([]);
    const initial = [...requested('initial')];

    // The simulation toggle keeps the draft and the phone profile under touch, or mouse and keyboard.
    phase = 'interaction';
    const handle = await fillAndReview(page);
    const l = lab(page);

    // Actual rotation without a lock keeps the phone journey and loads no other profile or AI code.
    phase = 'orientation';
    await l.name.click();
    await expect(l.name).toBeFocused();
    await page.setViewportSize({ width: 800, height: 320 });
    await expect(l.shell).toHaveAttribute('data-orientation', 'landscape');
    await expectShell(page, 'phone');
    await expect(l.name).toBeFocused();
    await expectDraftKept(page, handle);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(l.shell).toHaveAttribute('data-orientation', 'portrait');
    await expectShell(page, 'phone');
    await expect(l.name).toBeFocused();
    await expectDraftKept(page, handle);
    // Rotation installs no tablet style: the phone tag stays the only profile CSS.
    const orientationStyles = await expectProfileStyles(page, ['phone'], 'phone');
    expect(leaks(['initial', 'interaction', 'orientation'], ['phone'])).toEqual([]);
    const orientationRequests = [...requested('orientation')];

    phase = 'interaction';
    const start = page.getByRole('button', { name: /^start simulation$/i });
    const useActual = page.getByRole('button', { name: /^use actual signals$/i });
    const activeInput = () => signalValue(signalList(page, /^actual signals$/i), 'Active input');
    if (touch) await start.tap();
    else await start.click();
    await expect(useActual).toHaveAttribute('aria-pressed', 'true');
    await expectShell(page, 'phone');
    await expectDraftKept(page, handle);
    if (touch) await expect.poll(activeInput).toBe('Touch');
    if (touch) await useActual.tap();
    else await useActual.press('Enter');
    await expect(start).toHaveAttribute('aria-pressed', 'false');
    await expectShell(page, 'phone');
    await expectDraftKept(page, handle);
    const observedInput = await activeInput();
    if (touch) expect(observedInput).toBe('Touch');
    else expect(observedInput).toMatch(/^(Mouse|Keyboard)$/);
    const touchEvidence = touch
      ? { status: 'pass', emulated: true, physical: false, activeInput: observedInput }
      : {
          status: 'not_run',
          reason: `${browserName} ran the mouse and keyboard case; touch is emulated in Chromium only.`,
          activeInput: observedInput,
        };
    expect(leaks(['initial', 'interaction', 'orientation'], ['phone'])).toEqual([]);

    // Interaction, rotation and simulation still render no surface and install no native CSS.
    const beforeGenUX = {
      tags: (await nativeStyles(page)).length,
      selectors: await liveNativeSelectors(page),
    };
    expect(beforeGenUX, 'native GenUX styles before the AI story').toEqual({
      tags: 0,
      selectors: [],
    });

    // The recorded GenUX lab loads only from the explicit button and says it is a fixture.
    phase = 'genux';
    const open = page.getByRole('button', { name: /^open ai result story$/i });
    const labId = await open.getAttribute('aria-controls');
    expect(labId).toBeTruthy();
    await open.click();
    await expect(page.getByRole('button', { name: /^close ai result story$/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const story = page.locator(`[id='${labId}']`);
    await expect(story).toContainText(/recorded/i);
    await expect(story.getByText(/loading the optional genux lab/i)).toHaveCount(0);
    await expect(story.getByRole('alert')).toHaveCount(0);
    // The explicit story renders a surface, which installs exactly one hoisted, compiled native style.
    await expect
      .poll(async () => (await nativeStyles(page)).length, 'native GenUX style tags')
      .toBe(1);
    const [nativeStyle] = await nativeStyles(page);
    expect(nativeStyle.bytes, 'native GenUX style text').toBeGreaterThan(0);
    expect(nativeStyle.text.match(scssSyntax) ?? [], 'native GenUX SCSS syntax').toEqual([]);
    expect(nativeStyle.parsedRules, 'native GenUX parsed CSS rules').toBeGreaterThan(0);
    expect(
      nativeStyle.text.match(nativeCssSelector) ?? [],
      'native control selectors in the GenUX style',
    ).not.toEqual([]);
    const genuxNative = {
      precedence: nativeStyle.precedence,
      bytes: nativeStyle.bytes,
      parsedRules: nativeStyle.parsedRules,
    };
    // Its static closure and CSS are now loaded, shared earlier or seen here; dynamic adapters are not required.
    await expect.poll(() => genuxPaths.filter(file => !requested().has(file))).toEqual([]);
    expect(leaks(['genux'], ['phone', 'genuxLab'])).toEqual([]);
    await expectProfileStyles(page, ['phone'], 'phone');
    expect(requests.filter(r => r.phase === 'genux' && new URL(r.url).origin !== origin)).toEqual(
      [],
    );

    // An explicit TV choice may load the TV closure; the phone code already loaded stays counted.
    phase = 'tv';
    await pick(page, page.getByRole('combobox', { name: /^product surface/i }), 'Living room (TV)');
    await expectShell(page, 'living-room', 'living-room');
    const tvPaths = paths(resources.profiles['living-room']);
    await expect.poll(() => tvPaths.filter(file => !requested().has(file))).toEqual([]);
    expect(leaks(['tv'], ['phone', 'genuxLab', 'living-room'])).toEqual([]);
    // The explicit TV choice installs its own scoped style; cached phone styles may honestly remain.
    const tvStyles = await expectProfileStyles(page, ['phone', 'living-room'], 'living-room');
    const tvCss = await expectCompiledProfileCss(page, 'living-room');
    // React dedupes the hoisted resource by href: the TV switch keeps exactly one native style.
    const dedupeStyleCount = (await nativeStyles(page)).length;
    expect(dedupeStyleCount, 'native GenUX style tags after the TV switch').toBe(1);
    await expectDraftKept(page, handle);
    await settleMotion(page.locator('body'));
    await saveShot(page, 'adaptive-cold-320-tv.png');

    const finished = (await Promise.all(measured)).filter((m): m is Measured => m !== null);
    const sameOrigin = finished.filter(m => new URL(m.url).origin === origin);
    expect(failures.filter(f => new URL(f.url).origin === origin)).toEqual([]);
    expect(
      requests
        .map(r => new URL(r.url).pathname)
        .filter(file => /[.](tsx?|jsx|s[ac]ss|less)$/.test(file)),
    ).toEqual([]);
    const expectedMime: Record<string, string> = { script: 'javascript', stylesheet: 'text/css' };
    const cachedNotModified: Record<string, unknown>[] = [];
    for (const [index, m] of sameOrigin.entries()) {
      const mime = expectedMime[m.resourceType];
      if (mime && m.status === 304) {
        // A 304 revalidation may omit Content-Type by HTTP design; the representation it keeps
        // must be proven by an earlier 200 for the same URL and resource type in this context.
        const proven = sameOrigin
          .slice(0, index)
          .filter(
            prior =>
              prior.url === m.url && prior.resourceType === m.resourceType && prior.status === 200,
          )
          .pop();
        expect(proven, `${m.url} 304 follows a 200 for the same URL`).toBeDefined();
        expect(proven!.contentType.toLowerCase(), `${m.url} proven 200`).toContain(mime);
        if (m.contentType) expect(m.contentType.toLowerCase(), m.url).toContain(mime);
        cachedNotModified.push({
          url: m.url,
          phase: m.phase,
          resourceType: m.resourceType,
          status: m.status,
          contentType: m.contentType,
          encodedBodySize: m.encodedBodySize,
          transferSize: m.transferSize,
          provenBy: {
            phase: proven!.phase,
            status: proven!.status,
            contentType: proven!.contentType,
            encodedBodySize: proven!.encodedBodySize,
            decodedBodySize: proven!.decodedBodySize,
          },
        });
      } else if (mime) expect(m.contentType.toLowerCase(), m.url).toContain(mime);
      // An uncompressed label must match: the encoded body equals the decoded body.
      if (m.encoding === 'identity' && m.encodedBodySize > 0 && m.decodedBodySize >= 0)
        expect(m.encodedBodySize, m.url).toBe(m.decodedBodySize);
    }
    const budgets = Object.fromEntries(
      ['initial', 'interaction', 'orientation', 'genux', 'tv'].map(name => {
        const list = sameOrigin.filter(m => m.phase === name);
        const sum = (pick: (m: Measured) => number) =>
          list.reduce((total, m) => total + Math.max(0, pick(m)), 0);
        return [
          name,
          {
            responses: list.length,
            encodedBodyBytes: sum(m => m.encodedBodySize),
            transferBytes: sum(m => m.transferSize),
            decodedBodyBytes: sum(m => m.decodedBodySize),
          },
        ];
      }),
    );
    await saveJson('adaptive-cold-network.json', {
      baseURL,
      browserName,
      cache: { context: 'fresh', serviceWorkers: 'block' },
      manifest: resources,
      required: [...required],
      isolation,
      styleDelivery: {
        mode: 'compiled CSS in the selected profile module',
        externalCss: {
          phone: resources.profiles.phone.css,
          'living-room': resources.profiles['living-room'].css,
        },
        initialHtml: { styleBlocks: htmlStyles.length, profileSelectors: htmlProfileSelectors },
        phone: {
          tags: phoneStyles.tags,
          unreadableSheets: phoneStyles.unreadable,
          compiled: phoneCss,
        },
        orientation: { tags: orientationStyles.tags },
        tv: { tags: tvStyles.tags, compiled: tvCss },
        optionalNative: {
          selector: nativeStyleSelector,
          initialHtml: htmlNative,
          beforeGenUX,
          genux: genuxNative,
          dedupeStyleCount,
        },
      },
      initial,
      orientation: orientationRequests,
      touch: touchEvidence,
      requests,
      failures,
      responses: sameOrigin,
      cachedNotModified,
      budgets,
      note: 'Measured only; no budget limit is asserted.',
    });
  } finally {
    await cold.close();
  }
});
