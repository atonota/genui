import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

// P2-B layout control for the documentation shell. One browser test covers the
// desktop landmarks, the narrow menu Drawer with its close button, the narrow
// <details> contents, the breadcrumb and prev/next navigation and the absence of
// page horizontal overflow. Screenshot evidence for 320, 375, tablet and desktop
// in light and dark mode is attached from this same control. Assertions use roles,
// native attributes and computed layout only, never implementation class names, so
// the current shell fails on the missing Drawer, details contents, breadcrumb
// landmark and rel="prev"/rel="next" links rather than on a renamed selector.

const route = '/components/card/';
const fallbackBaseUrl = 'http://127.0.0.1:4324';
const themeStorageKey = 'genux-theme';
const minimumTextPx = 14;
const minimumTargetPx = 44;
const componentRoute = /^\/components\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
// documentation-rules.json componentSections; the build gate keeps these eight.
const expectedSections = [
  'usage',
  'examples',
  'code',
  'astro',
  'api',
  'accessibility',
  'notes',
  'resources',
];

interface Viewport {
  name: string;
  width: number;
  height: number;
  menu: 'drawer' | 'aside';
  contents: 'details' | 'rail';
}
const viewports: readonly Viewport[] = [
  { name: '320', width: 320, height: 640, menu: 'drawer', contents: 'details' },
  { name: '375', width: 375, height: 812, menu: 'drawer', contents: 'details' },
  { name: 'tablet', width: 768, height: 1024, menu: 'drawer', contents: 'details' },
  { name: 'desktop', width: 1440, height: 900, menu: 'aside', contents: 'rail' },
];
const modes = ['light', 'dark'] as const;
type Mode = (typeof modes)[number];

const documentationNav = (scope: Page | Locator) =>
  scope.getByRole('navigation', { name: 'Documentation', exact: true });
const menuToggle = (page: Page) =>
  page.getByRole('banner').locator('button[aria-expanded][aria-controls]');
const sectionLink = (page: Page, id: string) => page.locator(`a[href="#${id}"]`);

async function box(target: Locator, label: string) {
  const rect = await target.boundingBox();
  expect(rect, `${label}: has a layout box`).not.toBeNull();
  return rect!;
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

async function expectReadableText(target: Locator, label: string) {
  const style = await target.evaluate(element => {
    const computed = getComputedStyle(element);
    return { fontSize: parseFloat(computed.fontSize), fontFamily: computed.fontFamily };
  });
  const family = style.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  expect.soft(style.fontSize, `${label}: computed text size`).toBeGreaterThanOrEqual(minimumTextPx);
  expect.soft(family, `${label}: primary font family`).toBe('Outfit');
}

async function expectTouchTarget(target: Locator, viewportWidth: number, label: string) {
  const rect = await box(target, label);
  expect
    .soft(Math.min(rect.width, rect.height), `${label}: interaction target size`)
    .toBeGreaterThanOrEqual(minimumTargetPx);
  expect.soft(rect.x, `${label}: starts inside the viewport`).toBeGreaterThanOrEqual(0);
  expect
    .soft(rect.x + rect.width, `${label}: ends inside the viewport`)
    .toBeLessThanOrEqual(viewportWidth + 0.5);
}

async function expectListsEverySection(nav: Locator, label: string) {
  const listed = await nav
    .locator('a[href^="#"]')
    .evaluateAll(links =>
      links.map(link => decodeURIComponent((link.getAttribute('href') ?? '').slice(1))),
    );
  for (const id of expectedSections) expect.soft(listed, `${label}: lists #${id}`).toContain(id);
}

/** Visible navigations that list every section and do not live inside a <details>. */
async function countOpenContentsNavs(page: Page) {
  return page
    .locator('nav')
    .filter({ visible: true })
    .filter({ has: sectionLink(page, expectedSections[expectedSections.length - 1]) })
    .evaluateAll(navs => navs.filter(nav => !nav.closest('details')).length);
}

/** FOCUS-01: keyboard focus stays inside the container and never paints a surrounding ring. */
async function expectKeyboardFocusWithoutRing(page: Page, container: Locator, label: string) {
  await page.keyboard.press('Tab');
  const focus = await container.evaluate(element => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !element.contains(active)) return null;
    const computed = getComputedStyle(active);
    return {
      tag: active.tagName.toLowerCase(),
      focusVisible: active.matches(':focus-visible'),
      outlineStyle: computed.outlineStyle,
      outlineWidth: parseFloat(computed.outlineWidth),
    };
  });
  expect.soft(focus, `${label}: Tab keeps focus inside`).not.toBeNull();
  if (!focus) return;
  expect.soft(focus.focusVisible, `${label}: keyboard focus is focus-visible`).toBe(true);
  expect
    .soft(
      focus.outlineStyle === 'none' || focus.outlineWidth === 0,
      `${label}: ${focus.tag} paints no surrounding outline (${focus.outlineStyle} ${focus.outlineWidth}px)`,
    )
    .toBe(true);
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
}

async function expectPageChrome(page: Page, label: string) {
  await expect(page.getByRole('banner'), `${label}: banner landmark`).toBeVisible();
  await expect(page.getByRole('main'), `${label}: main landmark`).toBeVisible();
  await expect(page.getByRole('contentinfo'), `${label}: contentinfo landmark`).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const sectionIds = await page
    .locator('main [data-doc-section]')
    .evaluateAll(sections => sections.map(section => section.id));
  expect(sectionIds, `${label}: the eight shared sections are unchanged`).toEqual(expectedSections);

  // The shell breadcrumb precedes the page title; any demo breadcrumb comes later.
  const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i }).first();
  await expect(breadcrumb, `${label}: breadcrumb landmark`).toBeVisible();
  await expect(
    breadcrumb.getByRole('link').first(),
    `${label}: breadcrumb parent link`,
  ).toBeVisible();
  const current = breadcrumb.locator('[aria-current="page"]');
  await expect(current, `${label}: breadcrumb current page`).toHaveCount(1);
  await expect(current).toContainText(/card/i);
  await expectReadableText(current, `${label}: breadcrumb current page`);

  for (const rel of ['prev', 'next'] as const) {
    const link = page.getByRole('main').locator(`a[rel~="${rel}"]`);
    await expect(link, `${label}: one rel="${rel}" component link`).toHaveCount(1);
    await expect(link).toBeVisible();
    const href = (await link.getAttribute('href')) ?? '';
    expect.soft(href, `${label}: rel="${rel}" points to a component page`).toMatch(componentRoute);
    expect.soft(href, `${label}: rel="${rel}" leaves the current page`).not.toBe(route);
    await expectReadableText(link, `${label}: rel="${rel}" link`);
  }
}

/** The Drawer slides in with the central motion tokens; measure geometry only once it has settled. */
async function expectDrawerSettled(dialog: Locator, label: string) {
  await dialog.evaluate(async element => {
    await Promise.all(
      element.getAnimations().map(animation => animation.finished.catch(() => undefined)),
    );
  });
  await expect
    .poll(
      () =>
        dialog.evaluate(element => {
          const translate = getComputedStyle(element).translate;
          return (
            translate === 'none' || translate.split(/\s+/).every(part => parseFloat(part) === 0)
          );
        }),
      { message: `${label}: Drawer finishes its slide at translate 0` },
    )
    .toBe(true);
}

async function expectDrawerMenu(page: Page, viewport: Viewport, mode: Mode, testInfo: TestInfo) {
  const label = `${viewport.name} ${mode}`;
  const toggle = menuToggle(page);
  await expect(toggle, `${label}: one menu toggle in the banner`).toHaveCount(1);
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expectTouchTarget(toggle, viewport.width, `${label}: menu toggle`);
  await expect(
    documentationNav(page),
    `${label}: documentation navigation is collapsed`,
  ).toBeHidden();
  await expect(page.getByRole('dialog'), `${label}: no dialog before opening`).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const controlledId = (await toggle.getAttribute('aria-controls')) ?? '';
  await expect(
    page.locator(`[id="${controlledId}"]`),
    `${label}: aria-controls resolves`,
  ).toHaveCount(1);
  const dialog = page.getByRole('dialog').filter({ has: documentationNav(page) });
  await expect(dialog, `${label}: menu Drawer dialog`).toBeVisible();
  await expectDrawerSettled(dialog, label);
  await expect(documentationNav(dialog)).toBeVisible();
  const currentLink = dialog.locator('a[aria-current="page"]');
  await expect(currentLink, `${label}: Drawer marks the current page`).toHaveCount(1);
  await expect(currentLink).toHaveAttribute('href', route);
  await expectReadableText(currentLink, `${label}: Drawer navigation link`);
  const dialogRect = await box(dialog, `${label}: Drawer`);
  expect
    .soft(dialogRect.x + dialogRect.width, `${label}: Drawer fits the viewport`)
    .toBeLessThanOrEqual(viewport.width + 0.5);
  await expectNoHorizontalOverflow(page, `${label} Drawer open`);

  const close = dialog.getByRole('button', { name: /close|kapat/i }).first();
  await expect(close, `${label}: Drawer close button`).toBeVisible();
  await expectTouchTarget(close, viewport.width, `${label}: Drawer close button`);
  await expectKeyboardFocusWithoutRing(page, dialog, `${label}: Drawer`);
  if (viewport.name === '320')
    await testInfo.attach(`docs-shell-320-${mode}-drawer-open`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

  await close.click();
  await expect(dialog, `${label}: Drawer closes`).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle, `${label}: focus returns to the menu toggle`).toBeFocused();
  await expect(documentationNav(page)).toBeHidden();
}

async function expectDesktopShell(page: Page, label: string) {
  await expect(menuToggle(page), `${label}: no menu toggle on desktop`).toBeHidden();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const nav = documentationNav(page);
  await expect(nav, `${label}: documentation navigation visible`).toBeVisible();
  const aside = page.getByRole('complementary').filter({ has: nav });
  await expect(
    aside,
    `${label}: documentation navigation sits in one complementary aside`,
  ).toHaveCount(1);
  const asideRect = await box(aside, `${label}: aside`);
  const mainRect = await box(page.getByRole('main'), `${label}: main`);
  expect
    .soft(asideRect.x + asideRect.width, `${label}: aside sits left of main`)
    .toBeLessThanOrEqual(mainRect.x + 0.5);
  const currentLink = nav.locator('a[aria-current="page"]');
  await expect(currentLink, `${label}: aside marks the current page`).toHaveCount(1);
  await expect(currentLink).toHaveAttribute('href', route);
  await expectReadableText(currentLink, `${label}: aside navigation link`);
}

async function expectDetailsContents(page: Page, viewport: Viewport, label: string) {
  expect
    .soft(
      await countOpenContentsNavs(page),
      `${label}: narrow contents live only inside a disclosure`,
    )
    .toBe(0);
  const details = page
    .getByRole('main')
    .locator('details')
    .filter({ has: sectionLink(page, expectedSections[expectedSections.length - 1]) });
  await expect(details, `${label}: one details contents`).toHaveCount(1);
  const summary = details.locator('summary').first();
  await expect(summary, `${label}: contents summary`).toBeVisible();
  await expect(details, `${label}: contents start closed`).toHaveJSProperty('open', false);
  await expect(details.locator('a[href^="#"]').first()).toBeHidden();
  await expectReadableText(summary, `${label}: contents summary`);
  await expectTouchTarget(summary, viewport.width, `${label}: contents summary`);

  await summary.click();
  await expect(details, `${label}: contents open on tap`).toHaveJSProperty('open', true);
  await expect(details.locator('a[href^="#"]').first()).toBeVisible();
  await expectListsEverySection(details, `${label}: details contents`);
  await expectReadableText(details.locator('a[href^="#"]').first(), `${label}: contents link`);
  const rect = await box(details, `${label}: details contents`);
  expect
    .soft(rect.x + rect.width, `${label}: open contents fit the viewport`)
    .toBeLessThanOrEqual(viewport.width + 0.5);
  await expectNoHorizontalOverflow(page, `${label} contents open`);

  await summary.click();
  await expect(details, `${label}: contents close again`).toHaveJSProperty('open', false);
}

async function expectContentsRail(page: Page, label: string) {
  const details = page
    .getByRole('main')
    .locator('details')
    .filter({ has: sectionLink(page, expectedSections[0]) });
  await expect(details, `${label}: details contents hidden on desktop`).toBeHidden();
  const rail = page
    .locator('nav')
    .filter({ visible: true })
    .filter({ has: sectionLink(page, expectedSections[expectedSections.length - 1]) });
  await expect(rail, `${label}: one visible contents rail`).toHaveCount(1);
  expect
    .soft(
      await rail.evaluate(nav => nav.closest('details') === null),
      `${label}: rail is not a disclosure`,
    )
    .toBe(true);
  await expectListsEverySection(rail, `${label}: contents rail`);
  const railRect = await box(rail, `${label}: contents rail`);
  const articleRect = await box(page.getByRole('article').first(), `${label}: article`);
  expect
    .soft(railRect.x, `${label}: rail sits right of the article`)
    .toBeGreaterThanOrEqual(articleRect.x + articleRect.width - 0.5);
  await expectReadableText(rail.locator('a[href^="#"]').first(), `${label}: rail link`);
}

test('docs shell layout: landmarks, narrow menu Drawer, details contents and no horizontal overflow', async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const url = new URL(route, testInfo.project.use.baseURL ?? fallbackBaseUrl).href;
  for (const mode of modes) {
    for (const viewport of viewports) {
      const label = `${viewport.name} ${mode}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(url);
      await applyMode(page, mode);
      await expectPageChrome(page, label);
      await expectNoHorizontalOverflow(page, label);
      await testInfo.attach(`docs-shell-${viewport.name}-${mode}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      if (viewport.menu === 'drawer') await expectDrawerMenu(page, viewport, mode, testInfo);
      else await expectDesktopShell(page, label);
      if (viewport.contents === 'details') await expectDetailsContents(page, viewport, label);
      else await expectContentsRail(page, label);
    }
  }
});
