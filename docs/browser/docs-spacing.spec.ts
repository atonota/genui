import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

// Spacing control for the documentation shell and the overview composition. The overview (/)
// and the card page (/components/card/) are probed at 320 and 1440 CSS px in light and dark
// mode. Painted shell regions (main, header, footer and the visible sidebar) keep an inline
// inset between their edge and their direct content; the overview grid keeps visible row and
// column gaps and wraps inside the main content; major sections stay separated. Content edges
// are column-aware: showcase sections, the breadcrumb and the article share the h1 edge, API and
// resources sections inside .component-reference share that column's own edge, and the reference
// column either sits beside the showcase or stacks on the h1 edge. Assertions use landmarks,
// section anchors and computed geometry only, and are
// soft so every missing inset is reported in one run. Viewport screenshots are saved under
// testInfo.outputPath, labelled with the source stage from ATLAS_SOURCE_STAGE.

const fallbackBaseUrl = 'http://127.0.0.1:4324';
const themeStorageKey = 'atlas-theme';
const stage = (process.env.ATLAS_SOURCE_STAGE ?? 'unlabeled').replace(/[^a-z0-9-]+/gi, '-');
const tolerancePx = 0.5;
const alignTolerancePx = 1;
const minimumChromeInsetPx = 16;
const minimumGridGapPx = 16;
const minimumSectionGapPx = 24;

const routes = [
  { name: 'overview', path: '/' },
  { name: 'card', path: '/components/card/' },
] as const;
const viewports = [
  { name: '320', width: 320, height: 640, mainInset: 16 },
  { name: 'desktop', width: 1440, height: 900, mainInset: 24 },
] as const;
type Viewport = (typeof viewports)[number];
const modes = ['light', 'dark'] as const;
type Mode = (typeof modes)[number];

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
interface Block extends Rect {
  name: string;
}

const documentationNav = (scope: Page | Locator) =>
  scope.getByRole('navigation', { name: 'Documentation', exact: true });

async function rectOf(target: Locator): Promise<Rect> {
  return target.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  });
}

/** Rendered, in-flow direct children: the content a painted region must inset. */
async function directContent(container: Locator): Promise<Block[]> {
  return container.evaluate(element =>
    Array.from(element.children).flatMap(child => {
      const computed = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      if (
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        computed.position === 'absolute' ||
        computed.position === 'fixed' ||
        rect.width === 0 ||
        rect.height === 0
      )
        return [];
      const name = child.tagName.toLowerCase() + (child.id ? '#' + child.id : '');
      return [{ name, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }];
    }),
  );
}

async function expectInlineInset(container: Locator, minimum: number, label: string) {
  const edge = await rectOf(container);
  const blocks = await directContent(container);
  expect.soft(blocks.length, `${label}: has rendered direct content`).toBeGreaterThan(0);
  for (const block of blocks) {
    expect
      .soft(block.left - edge.left, `${label}: ${block.name} start inset from the painted edge`)
      .toBeGreaterThanOrEqual(minimum - tolerancePx);
    expect
      .soft(edge.right - block.right, `${label}: ${block.name} end inset from the painted edge`)
      .toBeGreaterThanOrEqual(minimum - tolerancePx);
  }
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect
    .soft(metrics.documentWidth, `${label}: document scroll width stays inside the viewport`)
    .toBeLessThanOrEqual(metrics.viewport);
  expect
    .soft(metrics.bodyWidth, `${label}: body scroll width stays inside the viewport`)
    .toBeLessThanOrEqual(metrics.viewport);
}

async function applyMode(page: Page, mode: Mode) {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: themeStorageKey,
    value: mode,
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
  await expect(page.getByRole('switch').first()).toHaveAttribute(
    'aria-checked',
    String(mode === 'dark'),
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

async function saveViewport(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`docs-spacing-${stage}-${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`docs-spacing-${stage}-${name}`, { path, contentType: 'image/png' });
}

/** The main panel fits the viewport, adds no border and insets its direct content. */
async function expectMainPanel(page: Page, viewport: Viewport, label: string) {
  const main = page.getByRole('main');
  await expect(main, `${label}: one main landmark`).toHaveCount(1);
  const edge = await rectOf(main);
  expect
    .soft(edge.left, `${label}: main border box starts inside the viewport`)
    .toBeGreaterThanOrEqual(-tolerancePx);
  expect
    .soft(edge.right, `${label}: main border box ends inside the viewport`)
    .toBeLessThanOrEqual(viewport.width + tolerancePx);
  const border = await main.evaluate(element => {
    const computed = getComputedStyle(element);
    return (
      parseFloat(computed.borderTopWidth) +
      parseFloat(computed.borderRightWidth) +
      parseFloat(computed.borderBottomWidth) +
      parseFloat(computed.borderLeftWidth)
    );
  });
  expect.soft(border, `${label}: main adds no decorative border`).toBe(0);
  await expectInlineInset(main, viewport.mainInset, `${label}: main`);
  return edge;
}

async function expectChromeInsets(page: Page, label: string) {
  await expectInlineInset(page.getByRole('banner'), minimumChromeInsetPx, `${label}: header`);
  await expectInlineInset(page.getByRole('contentinfo'), minimumChromeInsetPx, `${label}: footer`);
  const aside = page
    .getByRole('complementary')
    .filter({ has: documentationNav(page) })
    .first();
  if (await aside.isVisible())
    await expectInlineInset(aside, minimumChromeInsetPx, `${label}: sidebar`);
}

/**
 * Column-aware content edges. Showcase sections, their headings, the breadcrumb and the article
 * start at the h1 content edge. API and resources sections inside .component-reference start at
 * that column's own edge; the column sits right of the showcase beside it, or stacks on the h1
 * edge when the detail columns collapse.
 */
async function expectSharedContentEdge(page: Page, label: string) {
  const main = page.getByRole('main');
  const heading = main.getByRole('heading', { level: 1 });
  await expect(heading, `${label}: one h1`).toHaveCount(1);
  const edge = (await rectOf(heading)).left;
  const sections = await main.locator('[data-doc-section]').evaluateAll(elements =>
    elements.flatMap(element => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      const title = element.querySelector('h2');
      const titleLeft = title ? title.getBoundingClientRect().left : rect.left;
      const reference = element.closest('.component-reference');
      const referenceLeft = reference ? reference.getBoundingClientRect().left : null;
      return [{ id: element.id, left: rect.left, titleLeft, referenceLeft }];
    }),
  );
  expect.soft(sections.length, `${label}: renders doc sections`).toBeGreaterThan(0);
  const detail = await main.evaluate(root => {
    const box = (selector: string) => {
      const element = root.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    return { showcase: box('.component-showcase'), reference: box('.component-reference') };
  });
  const reference = detail.reference;
  if (reference) {
    const showcase = detail.showcase;
    const beside =
      showcase !== null &&
      reference.left >= showcase.right - alignTolerancePx &&
      reference.top < showcase.bottom;
    const stacked = Math.abs(reference.left - edge) <= alignTolerancePx;
    expect
      .soft(
        beside || stacked,
        `${label}: API and resources sit beside the showcase or stack on the h1 edge`,
      )
      .toBe(true);
  }
  for (const section of sections) {
    const target = section.referenceLeft ?? edge;
    const name = section.referenceLeft === null ? 'the h1 edge' : 'the reference column edge';
    expect
      .soft(Math.abs(section.left - target), `${label}: #${section.id} aligns to ${name}`)
      .toBeLessThanOrEqual(alignTolerancePx);
    expect
      .soft(Math.abs(section.titleLeft - target), `${label}: #${section.id} h2 aligns to ${name}`)
      .toBeLessThanOrEqual(alignTolerancePx);
  }
  const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i }).first();
  if (await breadcrumb.isVisible()) {
    const left = (await rectOf(breadcrumb)).left;
    expect
      .soft(Math.abs(left - edge), `${label}: breadcrumb aligns to the h1 edge`)
      .toBeLessThanOrEqual(alignTolerancePx);
  }
  const article = main.getByRole('article').first();
  if (await article.isVisible()) {
    const left = (await rectOf(article)).left;
    expect
      .soft(Math.abs(left - edge), `${label}: article aligns to the h1 edge`)
      .toBeLessThanOrEqual(alignTolerancePx);
  }
}

/** Each major overview section is separated from the rendered block before it. */
async function expectSectionRhythm(page: Page, label: string) {
  const gaps = await page
    .getByRole('main')
    .locator('[data-doc-section]')
    .evaluateAll(elements => {
      const rendered = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const position = getComputedStyle(element).position;
        return rect.width > 0 && rect.height > 0 && position !== 'absolute' && position !== 'fixed';
      };
      return elements.flatMap(element => {
        let previous = element.previousElementSibling;
        while (previous && !rendered(previous)) previous = previous.previousElementSibling;
        if (!previous) return [];
        return [
          {
            id: element.id,
            previous: previous.tagName.toLowerCase() + (previous.id ? '#' + previous.id : ''),
            gap: element.getBoundingClientRect().top - previous.getBoundingClientRect().bottom,
          },
        ];
      });
    });
  expect.soft(gaps.length, `${label}: sections follow other content`).toBeGreaterThan(0);
  for (const { id, previous, gap } of gaps)
    expect
      .soft(gap, `${label}: #${id} is separated from ${previous}`)
      .toBeGreaterThanOrEqual(minimumSectionGapPx - tolerancePx);
}

/** Component cards keep visible gaps, wrap inside the main content and add no border. */
async function expectOverviewGrid(page: Page, mainEdge: Rect, inset: number, label: string) {
  const cards = await page
    .locator(`#component-library a[href^='/components/']`)
    .evaluateAll(links =>
      links.map(link => {
        const rect = link.getBoundingClientRect();
        const computed = getComputedStyle(link);
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          border:
            parseFloat(computed.borderTopWidth) +
            parseFloat(computed.borderRightWidth) +
            parseFloat(computed.borderBottomWidth) +
            parseFloat(computed.borderLeftWidth),
        };
      }),
    );
  expect.soft(cards.length, `${label}: overview lists components`).toBeGreaterThan(1);
  const rows: (typeof cards)[] = [];
  for (const card of [...cards].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const row = rows.find(candidate => Math.abs(candidate[0].top - card.top) <= alignTolerancePx);
    if (row) row.push(card);
    else rows.push([card]);
  }
  rows.forEach((row, index) => {
    row.sort((a, b) => a.left - b.left);
    for (let column = 1; column < row.length; column++)
      expect
        .soft(
          row[column].left - row[column - 1].right,
          `${label}: grid column gap, row ${index + 1}`,
        )
        .toBeGreaterThanOrEqual(minimumGridGapPx - tolerancePx);
    if (index > 0) {
      const above = rows[index - 1];
      const gap =
        Math.min(...row.map(card => card.top)) - Math.max(...above.map(card => card.bottom));
      expect
        .soft(gap, `${label}: grid row gap before row ${index + 1}`)
        .toBeGreaterThanOrEqual(minimumGridGapPx - tolerancePx);
    }
  });
  cards.forEach((card, index) => {
    expect
      .soft(card.left, `${label}: card ${index + 1} starts inside the main content`)
      .toBeGreaterThanOrEqual(mainEdge.left + inset - tolerancePx);
    expect
      .soft(card.right, `${label}: card ${index + 1} wraps inside the main content`)
      .toBeLessThanOrEqual(mainEdge.right - inset + tolerancePx);
    expect.soft(card.border, `${label}: card ${index + 1} adds no decorative border`).toBe(0);
  });
}

async function expectOverviewLinks(page: Page, label: string) {
  const main = page.getByRole('main');
  const links = [
    ['Explore components', '/components/button/'],
    ['Setup and usage', '/getting-started/'],
    ['Design tokens', '/tokens/'],
  ] as const;
  for (const [name, href] of links)
    await expect
      .soft(main.getByRole('link', { name, exact: true }), `${label}: ${name} link is kept`)
      .toHaveAttribute('href', href);
}

test('docs spacing: shell regions inset their content and the overview keeps one rhythm', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  for (const route of routes) {
    for (const mode of modes) {
      for (const viewport of viewports) {
        const label = `${route.name} ${viewport.name} ${mode}`;
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(new URL(route.path, testInfo.project.use.baseURL ?? fallbackBaseUrl).href);
        await applyMode(page, mode);
        await saveViewport(page, testInfo, `${route.name}-${viewport.name}-${mode}`);
        const mainEdge = await expectMainPanel(page, viewport, label);
        await expectChromeInsets(page, label);
        await expectSharedContentEdge(page, label);
        await expectNoHorizontalOverflow(page, label);
        if (route.name !== 'overview') continue;
        await expectOverviewGrid(page, mainEdge, viewport.mainInset, label);
        await expectSectionRhythm(page, label);
        await expectOverviewLinks(page, label);
        if (viewport.name === 'desktop') {
          await page.locator('#shared-foundation').scrollIntoViewIfNeeded();
          await saveViewport(page, testInfo, `${route.name}-${viewport.name}-${mode}-foundation`);
        }
      }
    }
  }
});

/** Text in a contents panel: inset from the painted edge, clipping, word breaks and size. */
async function contentsText(panel: Locator) {
  return panel.evaluate(root => {
    const edge = root.getBoundingClientRect();
    return Array.from(root.querySelectorAll('p span, summary span, a span')).map(span => {
      const rect = span.getBoundingClientRect();
      const link = span.closest('a');
      let brokenWords = 0;
      for (const node of Array.from(span.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, word.index ?? 0);
          range.setEnd(node, (word.index ?? 0) + word[0].length);
          const lines = new Set(Array.from(range.getClientRects(), line => Math.round(line.top)));
          if (lines.size > 1) brokenWords++;
        }
      }
      return {
        text: (span.textContent ?? '').trim(),
        start: rect.left - edge.left,
        end: edge.right - rect.right,
        top: rect.top - edge.top,
        bottom: edge.bottom - rect.bottom,
        clipped: link ? link.scrollWidth > link.clientWidth + 1 : false,
        brokenWords,
        fontSize: parseFloat(getComputedStyle(span).fontSize),
        tabIndex: link ? link.tabIndex : 0,
        tabindex: link?.getAttribute('tabindex') ?? null,
      };
    });
  });
}

test('TOC rail has readable width and inner padding', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const minimumTocWidthPx = 240;
  const inset = minimumChromeInsetPx - tolerancePx;
  // The far-right rail starts at the 1600px detail breakpoint; the desktop probe reads it at 1920.
  const tocViewports = [viewports[0], { ...viewports[1], width: 1920, height: 1000 }] as const;
  for (const mode of modes) {
    for (const viewport of tocViewports) {
      const label = `input toc ${viewport.name} ${mode}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const url = new URL('/components/input/', testInfo.project.use.baseURL ?? fallbackBaseUrl);
      await page.goto(url.href);
      await applyMode(page, mode);
      await expect(page.locator('[data-docs-shell]').first()).toHaveAttribute(
        'data-docs-shell-ready',
        /.*/,
      );
      let panel: Locator;
      if (viewport.name === 'desktop') {
        panel = page.locator(`[data-docs-shell] .page-grid > .toc[data-doc-nav='toc']`);
        await expect.soft(panel, `${label}: contents rail is visible`).toBeVisible();
        const box = await panel.evaluate(element => {
          const computed = getComputedStyle(element);
          const { paddingTop, paddingRight, paddingBottom, paddingLeft } = computed;
          return {
            width: element.getBoundingClientRect().width,
            padding: [paddingTop, paddingRight, paddingBottom, paddingLeft].map(v => parseFloat(v)),
            overflow: element.scrollWidth - element.clientWidth,
          };
        });
        expect
          .soft(box.width, `${label}: rail width`)
          .toBeGreaterThanOrEqual(minimumTocWidthPx - tolerancePx);
        ['top', 'right', 'bottom', 'left'].forEach((side, index) =>
          expect
            .soft(box.padding[index], `${label}: rail padding-${side}`)
            .toBeGreaterThanOrEqual(inset),
        );
        expect.soft(box.overflow, `${label}: rail has no inline scroll`).toBeLessThanOrEqual(0);
      } else {
        panel = page.getByRole('main').locator('details[data-doc-contents]');
        await panel.locator('summary').click();
        await expect
          .soft(panel, `${label}: summary opens the contents`)
          .toHaveAttribute('open', '');
        await expectNoHorizontalOverflow(page, label);
      }
      await expect.soft(panel.getByRole('link'), `${label}: all 8 section links`).toHaveCount(8);
      await panel.scrollIntoViewIfNeeded();
      await saveViewport(page, testInfo, `toc-${viewport.name}-${mode}`);
      const texts = await contentsText(panel);
      expect.soft(texts.length, `${label}: renders contents text`).toBeGreaterThan(0);
      for (const text of texts) {
        const name = `${label}: ${text.text}`;
        expect.soft(text.start, `${name} start inset`).toBeGreaterThanOrEqual(inset);
        expect.soft(text.end, `${name} end inset, no right clipping`).toBeGreaterThanOrEqual(inset);
        expect.soft(text.clipped, `${name} fits its link`).toBe(false);
        expect.soft(text.brokenWords, `${name} wraps between words only`).toBe(0);
        expect.soft(text.fontSize, `${name} font size`).toBeGreaterThanOrEqual(14);
        expect.soft(text.tabindex, `${name} keeps native tab order`).toBeNull();
        expect.soft(text.tabIndex, `${name} is keyboard reachable`).toBe(0);
      }
      if (viewport.name === 'desktop') continue;
      expect
        .soft(Math.min(...texts.map(text => text.top)), `${label}: block-start inset`)
        .toBeGreaterThanOrEqual(inset);
      expect
        .soft(Math.min(...texts.map(text => text.bottom)), `${label}: block-end inset`)
        .toBeGreaterThanOrEqual(inset);
    }
  }
});

/**
 * Frozen shell, panel and field surfaces per theme for the shell aesthetic case. The dark shell
 * canvas is black; the dark panel and field and every light role are unchanged.
 */
const frozenColors = {
  light: { shell: 'rgb(230, 226, 215)', panel: 'rgb(255, 255, 255)', field: 'rgb(236, 236, 236)' },
  dark: { shell: 'rgb(0, 0, 0)', panel: 'rgb(44, 44, 44)', field: 'rgb(27, 27, 27)' },
} as const;

/** The shell helper, eager React islands and fonts are ready after navigation. */
async function waitForShell(page: Page) {
  await expect(page.locator('[data-docs-shell]').first()).toHaveAttribute(
    'data-docs-shell-ready',
    /.*/,
  );
  await expect(page.locator(`astro-island[client='load'][ssr]`)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

async function expectFrozenColors(page: Page, colors: (typeof frozenColors)[Mode], label: string) {
  const surfaces = [
    ['shell root', page.locator('[data-docs-shell]').first(), colors.shell],
    ['header', page.getByRole('banner'), colors.shell],
    ['footer', page.getByRole('contentinfo'), colors.shell],
    ['main panel', page.getByRole('main'), colors.panel],
    [
      'search field well',
      page
        .locator('.atlas-input-frame[data-atlas-input]')
        .filter({ has: page.locator('#component-search') }),
      colors.field,
    ],
    ['native search field', page.locator('#component-search'), 'rgba(0, 0, 0, 0)'],
  ] as const;
  for (const [name, target, color] of surfaces)
    await expect.soft(target, `${label}: ${name} surface`).toHaveCSS('background-color', color);
}

/**
 * Visible header controls: centre hit, clipping and placement inside the header. A control clips
 * only on an axis whose overflow is not visible (a text field always clips its value) while its
 * scroll content exceeds the client box on that axis. Decorative SVG parts may stay clipped on
 * purpose; their painted boxes, including visible overflow, stay inside the header and viewport.
 * Readable text is measured by its full Range rects before any clip: text cut by a clip-path or by
 * an overflow-clipping box up to the header is reported, never discarded, and clips its control.
 * Text inside a box of 1px or less is assistive-only. `text` covers every readable header text.
 */
async function headerControls(header: Locator) {
  return header.evaluate((root, tolerance) => {
    const edge = root.getBoundingClientRect();
    const shown = { opacityProperty: true, visibilityProperty: true };
    const within = (box: Rect) =>
      box.left >= Math.max(edge.left, 0) - tolerance &&
      box.right <= Math.min(edge.right, window.innerWidth) + tolerance &&
      box.top >= edge.top - tolerance &&
      box.bottom <= edge.bottom + tolerance;
    /** The painted box of a part after every overflow clip from the part up to its control. */
    const paintedBox = (part: Element, control: Element, rect: DOMRect): Rect | null => {
      let { left, right, top, bottom } = rect;
      let node: Element | null = part;
      while (node) {
        const style = getComputedStyle(node);
        if (style.clipPath !== 'none') return null;
        const box = node.getBoundingClientRect();
        if (style.overflowX !== 'visible') {
          left = Math.max(left, box.left);
          right = Math.min(right, box.right);
        }
        if (style.overflowY !== 'visible') {
          top = Math.max(top, box.top);
          bottom = Math.min(bottom, box.bottom);
        }
        node = node === control ? null : node.parentElement;
      }
      return right > left && bottom > top ? { left, right, top, bottom } : null;
    };
    /** Painted boxes of decorative SVG parts, including parts that overflow a control visibly. */
    const decorativeParts = (control: HTMLElement) =>
      Array.from(control.querySelectorAll('svg')).flatMap(svg => {
        const rect = svg.getBoundingClientRect();
        if (!svg.checkVisibility(shown) || rect.width === 0 || rect.height === 0) return [];
        const box = paintedBox(svg, control, rect);
        return box ? [box] : [];
      });
    /** Full Range rects of readable text in a scope, before any clip, and the text a clip cuts. */
    const readableText = (scope: Element) => {
      const rects: Rect[] = [];
      const cut: string[] = [];
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        const text = (node.textContent ?? '').trim();
        if (!parent || !text || parent.closest('script') || !parent.checkVisibility(shown))
          continue;
        const boxes: Element[] = [];
        for (let item: Element | null = parent; item; item = item.parentElement) {
          if (getComputedStyle(item).display !== 'contents') boxes.push(item);
          if (item === root) break;
        }
        const assistive = boxes.some(item => {
          const box = item.getBoundingClientRect();
          return scope.contains(item) && (box.width <= 1 || box.height <= 1);
        });
        if (assistive) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const lines = Array.from(range.getClientRects()).filter(
          line => line.width * line.height > 0,
        );
        rects.push(...lines);
        const isCut = boxes.some(item => {
          const style = getComputedStyle(item);
          if (style.clipPath !== 'none') return true;
          if (style.display === 'inline') return false;
          const box = item.getBoundingClientRect();
          const clipsX = style.overflowX !== 'visible';
          const clipsY = style.overflowY !== 'visible';
          return lines.some(line => {
            const inline = line.left < box.left - tolerance || line.right > box.right + tolerance;
            const block = line.top < box.top - tolerance || line.bottom > box.bottom + tolerance;
            return (clipsX && inline) || (clipsY && block);
          });
        });
        if (isCut) cut.push(text);
      }
      return { rects, cut, inside: rects.every(within) };
    };
    const controls = Array.from(root.querySelectorAll<HTMLElement>('a[href], button, input'));
    return {
      text: readableText(root),
      controls: controls.flatMap(control => {
        const rect = control.getBoundingClientRect();
        if (!control.checkVisibility() || rect.width === 0 || rect.height === 0) return [];
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        const computed = getComputedStyle(control);
        const field = control instanceof HTMLInputElement;
        const clipsInline = field || computed.overflowX !== 'visible';
        const clipsBlock = field || computed.overflowY !== 'visible';
        const labels = readableText(control);
        return [
          {
            name: control.getAttribute('aria-label') ?? (control.textContent ?? '').trim(),
            target: control.matches('[data-docs-menu-toggle], .locale-option, .header-link'),
            width: rect.width,
            height: rect.height,
            inside: within(rect) && labels.inside && decorativeParts(control).every(within),
            clipped:
              labels.cut.length > 0 ||
              (control.clientWidth > 0 &&
                ((clipsInline && control.scrollWidth > control.clientWidth + 1) ||
                  (clipsBlock && control.scrollHeight > control.clientHeight + 1))),
            cutText: labels.cut,
            hit: hit !== null && control.contains(hit),
          },
        ];
      }),
    };
  }, tolerancePx);
}

/** Settled paint of a control and its parts, to compare rest with keyboard focus. */
async function focusPaint(target: Locator) {
  return target.evaluate(async element => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map(animation => animation.finished.catch(() => undefined)),
    );
    const parts = [element, ...Array.from(element.querySelectorAll('*'))];
    const computed = getComputedStyle(element);
    return {
      focusVisible: element.matches(':focus-visible'),
      outline: computed.outlineStyle === 'none' ? 0 : parseFloat(computed.outlineWidth),
      boxShadow: computed.boxShadow,
      paint: parts
        .map(part => {
          const style = getComputedStyle(part);
          return [
            style.backgroundColor,
            style.backgroundImage,
            style.color,
            style.textDecorationLine,
            style.boxShadow,
            style.scale,
          ].join(' ');
        })
        .join('|'),
    };
  });
}

/** Outer border-box height of an md field well, from the shared Atlas size profile. */
const mdFieldHeightPx = 56;

/**
 * Paint of a search field: its `.atlas-input-frame[data-atlas-input]` paint owners, the shared
 * frame paint and the native child. The general radius and the canonical inset shadow resolve
 * where the frame reads them, through a momentary out-of-flow probe. Geometry and paint are
 * read after the finite native animations of the containing dialog and the paint owners finish,
 * such as the Drawer opening translate or a focus fill transition; infinite ones are ignored.
 */
async function searchWell(search: Locator) {
  return search.evaluate(async input => {
    const edges = (style: CSSStyleDeclaration) =>
      ['top', 'right', 'bottom', 'left'].map(side =>
        parseFloat(style.getPropertyValue(`border-${side}-width`)),
      );
    const outline = (style: CSSStyleDeclaration) =>
      style.outlineStyle === 'none' ? 0 : parseFloat(style.outlineWidth);
    const owners: Element[] = [];
    for (let node = input.parentElement; node; node = node.parentElement)
      if (node.matches('.atlas-input-frame[data-atlas-input]')) owners.push(node);
    const scopes = [input.closest('dialog'), ...owners].filter(
      (scope): scope is Element => scope !== null,
    );
    await Promise.all(
      scopes
        .flatMap(scope => scope.getAnimations({ subtree: true }))
        .filter(animation => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
        .map(animation => animation.finished.catch(() => undefined)),
    );
    const paintOf = (frame: Element) => {
      const resolve = (property: string, value: string) => {
        const probe = document.createElement('span');
        probe.style.position = 'absolute';
        probe.style.setProperty(property, value);
        frame.append(probe);
        const resolved = getComputedStyle(probe).getPropertyValue(property);
        probe.remove();
        return resolved;
      };
      const style = getComputedStyle(frame);
      const rect = frame.getBoundingClientRect();
      return {
        size: frame.getAttribute('data-size'),
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        borders: edges(style),
        radius: style.borderTopLeftRadius,
        background: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        backgroundSize: style.backgroundSize,
        backgroundPosition: style.backgroundPosition,
        boxShadow: style.boxShadow,
        outline: outline(style),
        generalRadius: resolve('border-top-left-radius', 'var(--radius)'),
        insetShadow: resolve('box-shadow', 'var(--field-inner-shadow)'),
      };
    };
    const native = getComputedStyle(input);
    return {
      owners: owners.length,
      well: owners[0] ? paintOf(owners[0]) : null,
      native: {
        background: native.backgroundColor,
        borders: edges(native),
        boxShadow: native.boxShadow,
        outline: outline(native),
        fontSize: parseFloat(native.fontSize),
        fontWeight: native.fontWeight,
        focusVisible: input.matches(':focus-visible'),
      },
    };
  });
}

/**
 * The search has exactly one shared frame paint owner at the md profile with the general radius,
 * the neutral field fill and the canonical inset shadow; the native search inside paints no fill,
 * border or shadow and keeps 14px/400 text. Returns the resting paint for the focus check.
 */
async function expectSearchWell(search: Locator, field: string, label: string) {
  const rest = await searchWell(search);
  expect.soft(rest.owners, `${label}: one .atlas-input-frame paint owner`).toBe(1);
  const well = rest.well;
  if (well) {
    expect.soft(well.size, `${label}: well uses the md size profile`).toBe('md');
    expect
      .soft(Math.abs(well.height - mdFieldHeightPx), `${label}: md well outer height`)
      .toBeLessThanOrEqual(tolerancePx);
    expect.soft(well.generalRadius, `${label}: general radius resolves`).not.toBe('');
    expect.soft(well.radius, `${label}: well uses the general radius`).toBe(well.generalRadius);
    expect.soft(well.background, `${label}: well paints the neutral field fill`).toBe(field);
    expect.soft(well.insetShadow, `${label}: canonical inset shadow resolves`).not.toBe('none');
    expect
      .soft(well.boxShadow, `${label}: well paints the canonical inset shadow`)
      .toBe(well.insetShadow);
  }
  const { native } = rest;
  expect
    .soft(native.background, `${label}: native search leaves the fill to its well`)
    .toBe('rgba(0, 0, 0, 0)');
  expect.soft(native.borders, `${label}: native search draws no border`).toEqual([0, 0, 0, 0]);
  expect.soft(native.boxShadow, `${label}: native search paints no shadow`).toBe('none');
  expect.soft(native.fontSize, `${label}: native search font size`).toBeGreaterThanOrEqual(14);
  expect.soft(native.fontWeight, `${label}: native search font weight`).toBe('400');
  return rest;
}

/** A region scrolls on its own: overflow, height, last link reachable and link heights. */
async function ownScroll(region: Locator) {
  return region.evaluate(element => {
    const links = Array.from(element.querySelectorAll('a'));
    const linkHeights = links.map(link => link.getBoundingClientRect().height);
    const previous = element.scrollTop;
    element.scrollTo({ top: element.scrollHeight, behavior: 'instant' });
    const rect = element.getBoundingClientRect();
    const last = links.at(-1)?.getBoundingClientRect();
    element.scrollTo({ top: previous, behavior: 'instant' });
    return {
      overflowY: getComputedStyle(element).overflowY,
      height: rect.height,
      bottom: rect.bottom,
      lastLinkBottom: last ? last.bottom : Number.MAX_VALUE,
      linkHeights,
    };
  });
}

test('shell aesthetic: compact header, navigation rhythm and frozen colors', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL;
  if (!baseURL) throw new Error('shell aesthetic: testInfo.project.use.baseURL must be configured');
  const url = new URL('/components/button/', baseURL).href;
  const maximumHeaderHeightPx = 192;
  const minimumTargetPx = 48;
  const minimumHitAreaPx = 24;
  const maximumGroupGapPx = 24;
  const minimumRailWidthPx = 240;
  const desktop = { width: 1920, height: 1000 };

  // 320 light: compact header, header controls, keyboard focus and the menu Drawer.
  let label = 'button shell 320 light';
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(url);
  await applyMode(page, 'light');
  await waitForShell(page);
  await saveViewport(page, testInfo, 'shell-aesthetic-320-light');
  const header = page.getByRole('banner');
  const headerBox = await rectOf(header);
  expect
    .soft(headerBox.bottom - headerBox.top, `${label}: header height`)
    .toBeLessThanOrEqual(maximumHeaderHeightPx + tolerancePx);
  const expectedControls = [
    ['menu toggle', header.locator('button[data-docs-menu-toggle]')],
    ['GenUI home wordmark', header.locator(`a[href='/']`)],
    ['EN · English', header.getByRole('button', { name: 'EN · English', exact: true })],
    ['TR · Turkish', header.getByRole('button', { name: 'TR · Turkish', exact: true })],
    ['dark theme switch', header.getByRole('switch')],
    ['Getting started', header.getByRole('link', { name: 'Getting started', exact: true })],
  ] as const;
  for (const [name, control] of expectedControls) {
    await expect.soft(control, `${label}: one ${name} control`).toHaveCount(1);
    await expect.soft(control, `${label}: ${name} is visible`).toBeVisible();
  }
  await expect
    .soft(header.locator(`a[href='/']`), `${label}: the home wordmark names GenUI`)
    .toHaveAccessibleName(/GenUI/);
  const { controls, text: readable } = await headerControls(header);
  expect.soft(controls.length, `${label}: header renders controls`).toBeGreaterThan(0);
  for (const control of controls) {
    const name = `${label}: header ${control.name}`;
    expect.soft(control.hit, `${name} receives pointer hits at its centre`).toBe(true);
    expect.soft(control.inside, `${name} stays inside the header and viewport`).toBe(true);
    expect.soft(control.clipped, `${name} is not clipped`).toBe(false);
    expect.soft(control.cutText, `${name} keeps its full text label`).toEqual([]);
    expect
      .soft(Math.min(control.width, control.height), `${name} hit area`)
      .toBeGreaterThanOrEqual(minimumHitAreaPx - tolerancePx);
    if (control.target)
      expect
        .soft(control.height, `${name} keeps its target height`)
        .toBeGreaterThanOrEqual(minimumTargetPx - tolerancePx);
  }
  const headerText = await header.evaluate(root => {
    const sizes: { text: string; size: number }[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      const text = (node.textContent ?? '').trim();
      if (!parent || !text || parent.closest('script') || !parent.checkVisibility()) continue;
      sizes.push({ text, size: parseFloat(getComputedStyle(parent).fontSize) });
    }
    return sizes;
  });
  expect.soft(headerText.length, `${label}: header renders text`).toBeGreaterThan(0);
  for (const { text, size } of headerText)
    expect.soft(size, `${label}: header text ${text} font size`).toBeGreaterThanOrEqual(14);
  expect.soft(readable.cut, `${label}: header text, metadata included, is not cut off`).toEqual([]);
  expect
    .soft(readable.inside, `${label}: header text stays inside the header and viewport`)
    .toBe(true);
  await expect
    .soft(header.getByRole('button', { name: 'EN · English', exact: true }), `${label}: EN label`)
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .soft(header.getByRole('button', { name: 'TR · Turkish', exact: true }), `${label}: TR label`)
    .toHaveAttribute('aria-pressed', 'false');
  await expectNoHorizontalOverflow(page, label);
  await expectFrozenColors(page, frozenColors.light, label);

  const firstControl = header.locator('a[href], button, input').filter({ visible: true }).first();
  const resting = await focusPaint(firstControl);
  for (let press = 0; press < 8; press++) {
    if (await header.evaluate(root => root.contains(document.activeElement))) break;
    await page.keyboard.press('Tab');
  }
  await expect.soft(firstControl, `${label}: Tab reaches the first header control`).toBeFocused();
  await expect
    .soft(page.locator('html'), `${label}: Tab turns on keyboard modality`)
    .toHaveAttribute('data-input-modality', 'keyboard');
  const focused = await focusPaint(firstControl);
  expect.soft(focused.focusVisible, `${label}: first header control is focus-visible`).toBe(true);
  expect.soft(focused.outline, `${label}: first header control has no outline`).toBe(0);
  expect
    .soft(focused.boxShadow, `${label}: first header control has no box-shadow ring`)
    .not.toMatch(/ 0px 0px 0px [1-9]/);
  expect
    .soft(focused.paint, `${label}: first header control shows one focus indicator`)
    .not.toBe(resting.paint);

  const toggle = header.locator('button[data-docs-menu-toggle]');
  const drawer = page.locator('dialog[data-docs-drawer]');
  await expect
    .soft(toggle, `${label}: menu toggle is a native button`)
    .toHaveAttribute('type', 'button');
  await toggle.click();
  await expect.soft(drawer, `${label}: menu opens the Drawer`).toHaveAttribute('open', '');
  await expect
    .soft(toggle, `${label}: menu toggle reports the open Drawer`)
    .toHaveAttribute('aria-expanded', 'true');
  await expect
    .soft(documentationNav(page), `${label}: one Documentation navigation`)
    .toHaveCount(1);
  await expect
    .soft(documentationNav(drawer), `${label}: Documentation navigation is in the Drawer`)
    .toBeVisible();
  const search = drawer.getByRole('searchbox', { name: 'Find a component' });
  await expect.soft(search, `${label}: native search field`).toHaveAttribute('type', 'search');
  const inputRow = drawer.locator(`[data-component-link^='Input ']`);
  const buttonRow = drawer.locator(`[data-component-link^='Button ']`);
  await expect.soft(inputRow, `${label}: one Input row`).toHaveCount(1);
  await search.fill('Button');
  await expect.soft(buttonRow, `${label}: search keeps the Button row`).toBeVisible();
  await expect.soft(inputRow, `${label}: search filters the Input row`).toBeHidden();
  await search.fill('');
  await expect.soft(inputRow, `${label}: clearing returns the Input row`).toBeVisible();
  await expect
    .soft(search, `${label}: native search keeps its id`)
    .toHaveAttribute('id', 'component-search');
  const restingSearch = await expectSearchWell(
    search,
    frozenColors.light.field,
    `${label}: Drawer search`,
  );
  // Keyboard focus on the search: the shared frame paints one bottom marker, no ring, and keeps
  // its rest geometry.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect.soft(search, `${label}: Shift+Tab, Tab returns to the search`).toBeFocused();
  await expect
    .soft(page.locator('html'), `${label}: Tab turns on keyboard modality in the Drawer`)
    .toHaveAttribute('data-input-modality', 'keyboard');
  const focusedSearch = await searchWell(search);
  expect.soft(focusedSearch.native.focusVisible, `${label}: search is focus-visible`).toBe(true);
  expect.soft(focusedSearch.native.outline, `${label}: native search has no outline`).toBe(0);
  const restWell = restingSearch.well;
  const focusWell = focusedSearch.well;
  if (restWell && focusWell) {
    const name = `${label}: Drawer search well`;
    expect.soft(focusWell.outline, `${name} has no outline`).toBe(0);
    expect
      .soft(focusWell.boxShadow, `${name} has no box-shadow ring`)
      .not.toMatch(/ 0px 0px 0px [1-9]/);
    expect.soft(focusWell.borders, `${name} keeps its rest edges`).toEqual(restWell.borders);
    for (const side of ['left', 'top', 'width', 'height'] as const)
      expect
        .soft(Math.abs(focusWell[side] - restWell[side]), `${name} keeps its ${side}`)
        .toBeLessThanOrEqual(tolerancePx);
    expect.soft(restWell.backgroundImage, `${name} paints no marker at rest`).toBe('none');
    expect
      .soft(focusWell.backgroundImage, `${name} paints the shared focus marker`)
      .toMatch(/gradient/);
    expect
      .soft(focusWell.backgroundPosition, `${name} marker sits on the bottom edge`)
      .toMatch(/100%$/);
    const markerHeight = parseFloat(focusWell.backgroundSize.split(' ')[1] ?? '');
    expect.soft(markerHeight, `${name} marker has a height`).toBeGreaterThan(0);
    expect
      .soft(markerHeight, `${name} marker stays a bottom edge`)
      .toBeLessThanOrEqual(restWell.height / 4);
  }
  await page.keyboard.press('Escape');
  await expect.soft(drawer, `${label}: Escape closes the Drawer`).not.toHaveAttribute('open', /.*/);
  await expect
    .soft(toggle, `${label}: menu toggle reports the closed Drawer`)
    .toHaveAttribute('aria-expanded', 'false');
  await expect.soft(toggle, `${label}: focus returns to the menu toggle`).toBeFocused();

  // 1920 dark: sidebar and contents rail, navigation rhythm and the detail columns.
  label = 'button shell 1920 dark';
  await page.setViewportSize(desktop);
  await page.goto(url);
  await applyMode(page, 'dark');
  await waitForShell(page);
  await saveViewport(page, testInfo, 'shell-aesthetic-1920-dark');
  await expectNoHorizontalOverflow(page, label);
  await expectFrozenColors(page, frozenColors.dark, label);
  const aside = page
    .getByRole('complementary')
    .filter({ has: documentationNav(page) })
    .first();
  const rail = page.locator(`[data-docs-shell] .page-grid > .toc[data-doc-nav='toc']`);
  await expect.soft(aside, `${label}: sidebar is visible`).toBeVisible();
  await expect.soft(rail, `${label}: contents rail is visible`).toBeVisible();
  await expect
    .soft(aside, `${label}: sidebar paints the black shell`)
    .toHaveCSS('background-color', frozenColors.dark.shell);
  await expect
    .soft(rail, `${label}: contents rail paints the black shell`)
    .toHaveCSS('background-color', frozenColors.dark.shell);
  if ((await aside.count()) > 0) {
    await expectInlineInset(aside, minimumChromeInsetPx, `${label}: sidebar`);
    await expectSearchWell(
      documentationNav(aside).getByRole('searchbox', { name: 'Find a component' }),
      frozenColors.dark.field,
      `${label}: sidebar search`,
    );
    const groupGap = await documentationNav(aside).evaluate(nav => {
      const groups = Array.from(nav.querySelectorAll(':scope > section'));
      const list = groups[0]?.querySelector('ul');
      const heading = groups[1]?.querySelector('h2');
      if (!list || !heading) return null;
      return heading.getBoundingClientRect().top - list.getBoundingClientRect().bottom;
    });
    expect.soft(groupGap, `${label}: sidebar renders two navigation groups`).not.toBeNull();
    expect
      .soft(groupGap ?? Number.MAX_VALUE, `${label}: first group end to the next heading`)
      .toBeLessThanOrEqual(maximumGroupGapPx + tolerancePx);
  }
  if ((await rail.count()) > 0) {
    const railBox = await rail.evaluate(element => {
      const { paddingTop, paddingRight, paddingBottom, paddingLeft } = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        padding: [paddingTop, paddingRight, paddingBottom, paddingLeft].map(v => parseFloat(v)),
      };
    });
    expect
      .soft(railBox.width, `${label}: rail width`)
      .toBeGreaterThanOrEqual(minimumRailWidthPx - tolerancePx);
    ['top', 'right', 'bottom', 'left'].forEach((side, index) =>
      expect
        .soft(railBox.padding[index], `${label}: rail padding-${side}`)
        .toBeGreaterThanOrEqual(minimumChromeInsetPx - tolerancePx),
    );
  }
  const regions = [
    ['sidebar', aside],
    ['contents rail', rail],
  ] as const;
  for (const [name, region] of regions) {
    if ((await region.count()) === 0) continue;
    const scroll = await ownScroll(region);
    expect
      .soft(['auto', 'scroll'], `${label}: ${name} scrolls on its own`)
      .toContain(scroll.overflowY);
    expect
      .soft(scroll.height, `${label}: ${name} fits the viewport`)
      .toBeLessThanOrEqual(desktop.height + tolerancePx);
    expect
      .soft(scroll.lastLinkBottom, `${label}: ${name} reaches its last link`)
      .toBeLessThanOrEqual(scroll.bottom + tolerancePx);
    expect.soft(scroll.linkHeights.length, `${label}: ${name} renders links`).toBeGreaterThan(0);
    scroll.linkHeights.forEach((height, index) =>
      expect
        .soft(height, `${label}: ${name} link ${index + 1} height`)
        .toBeGreaterThanOrEqual(minimumTargetPx - tolerancePx),
    );
  }
  const showcase = page.locator('[data-docs-shell] .component-showcase').first();
  const reference = page.locator('[data-docs-shell] .component-reference').first();
  await expect.soft(showcase, `${label}: showcase is visible`).toBeVisible();
  await expect.soft(reference, `${label}: API and resources are visible`).toBeVisible();
  if ((await showcase.count()) > 0 && (await reference.count()) > 0) {
    const left = await rectOf(showcase);
    const right = await rectOf(reference);
    expect
      .soft(right.left, `${label}: API and resources sit right of the showcase`)
      .toBeGreaterThanOrEqual(left.right - tolerancePx);
    expect
      .soft(right.top, `${label}: API and resources start beside the showcase`)
      .toBeLessThan(left.bottom);
  }
});
