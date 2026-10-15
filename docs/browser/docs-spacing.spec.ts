import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

// Spacing control for the documentation shell and the overview composition. The overview (/)
// and the card page (/components/card/) are probed at 320 and 1440 CSS px in light and dark
// mode. Painted shell regions (main, header, footer and the visible sidebar) keep an inline
// inset between their edge and their direct content; the overview grid keeps visible row and
// column gaps and wraps inside the main content; major sections share the h1 content edge and
// stay separated. Assertions use landmarks, section anchors and computed geometry only, and are
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

/** Sections, their headings, the breadcrumb and the article start at the h1 content edge. */
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
      return [{ id: element.id, left: rect.left, titleLeft }];
    }),
  );
  expect.soft(sections.length, `${label}: renders doc sections`).toBeGreaterThan(0);
  for (const section of sections) {
    expect
      .soft(Math.abs(section.left - edge), `${label}: #${section.id} aligns to the h1 edge`)
      .toBeLessThanOrEqual(alignTolerancePx);
    expect
      .soft(Math.abs(section.titleLeft - edge), `${label}: #${section.id} h2 aligns to the h1 edge`)
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
  for (const mode of modes) {
    for (const viewport of viewports) {
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
