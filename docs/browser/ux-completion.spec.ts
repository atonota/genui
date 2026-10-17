import { expect, test, type Locator, type Page } from '@playwright/test';

// Public behavior of the Refactoring UI completion routes; a missing route is a real failure.
const demo = (page: Page) => page.locator('[data-doc-demo]');

async function open(page: Page, path: string) {
  expect((await page.goto(path))?.status(), path).toBe(200);
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

// Accessible images only; slides hidden from assistive technology are excluded.
const shownAlts = (scope: Locator) =>
  scope.getByRole('img').evaluateAll(nodes =>
    nodes
      .map(node => node.getAttribute('alt') ?? '')
      .filter(Boolean)
      .join('|'),
  );

const attachShot = async (name: string, target: Locator) =>
  test.info().attach(name, { body: await target.screenshot(), contentType: 'image/png' });

test('media frame reserves a captioned figure and an unavailable fallback', async ({ page }) => {
  // The missing photo fails once; retrying the same URL is then served an existing asset.
  let missingRequests = 0;
  await page.route('**/selection/missing-photo.svg', async route => {
    missingRequests += 1;
    if (missingRequests === 1) return route.fulfill({ status: 404, body: '' });
    const url = new URL('/selection/forest.svg', route.request().url()).href;
    return route.fulfill({ response: await route.fetch({ url }) });
  });
  await open(page, '/components/media/');
  // A recorded screenshot keeps its native width and scrolls inside its own named region at 320.
  await page.setViewportSize({ width: 320, height: 800 });
  const screenshot = demo(page)
    .getByRole('figure')
    .filter({ has: page.locator('figcaption', { hasText: 'Recorded GenUX Avatar example' }) })
    .first();
  const shot = screenshot.locator('img').first();
  await shot.scrollIntoViewIfNeeded();
  await expect(shot).toBeVisible();
  await expect(shot).toHaveAttribute('alt', /\S/);
  await expect
    .poll(() => shot.evaluate(node => (node as HTMLImageElement).naturalWidth))
    .toBe(1440);
  const shotScroll = screenshot.getByRole('region', { name: /Recorded GenUX Avatar example/ });
  await expect(shotScroll).toHaveClass(/(^|\s)genux-screenshot-scroll(\s|$)/);
  await expect(shotScroll.locator('img')).toHaveCount(1);
  const shotFit = await shotScroll.evaluate(node => {
    const img = node.querySelector('img') as HTMLImageElement;
    return {
      scroll: node.scrollWidth,
      client: node.clientWidth,
      box: img.getBoundingClientRect().width,
      natural: img.naturalWidth,
    };
  });
  expect(shotFit.box, 'screenshot must not be fitted down').toBeGreaterThanOrEqual(shotFit.natural);
  expect(shotFit.scroll, 'screenshot overflow stays inside its region').toBeGreaterThan(
    shotFit.client,
  );
  await shotScroll.focus();
  await expect(shotScroll).toBeFocused();
  // Keyboard focus back on the scroller shows only the central bottom marker, without animation.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(shotScroll).toBeFocused();
  const shotCue = await shotScroll.evaluate(node => {
    const probe = document.createElement('span');
    probe.style.borderBottom = 'var(--focus-marker) solid var(--focus-color)';
    node.append(probe);
    const token = getComputedStyle(probe);
    const expected = [token.borderBottomWidth, token.borderBottomColor];
    probe.remove();
    const style = getComputedStyle(node);
    const durations = style.transitionDuration.split(',').map(value => parseFloat(value));
    return {
      expected,
      bottom: [style.borderBottomWidth, style.borderBottomColor],
      enclosure: [style.outlineStyle, style.boxShadow],
      animated: style.transitionProperty
        .split(',')
        .map(name => name.trim())
        .filter((_, index) => (durations[index % durations.length] ?? 0) > 0)
        .filter(name => /^(all|box-shadow|border)/.test(name)),
    };
  });
  expect(parseFloat(shotCue.expected[0] ?? '')).toBeGreaterThan(0);
  expect(shotCue.bottom).toEqual(shotCue.expected);
  expect(shotCue.enclosure).toEqual(['none', 'none']);
  expect(shotCue.animated).toEqual([]);
  await expectNoPageOverflow(page);
  // The shared layout declares one SVG icon; fetch its declared href, not an automatic request.
  const icon = page.locator('head link[rel~="icon"]');
  await expect(icon).toHaveCount(1);
  const iconHref = await icon.evaluate(node => (node as HTMLLinkElement).href);
  const iconResponse = await page.request.get(iconHref);
  expect(iconResponse.status(), iconHref).toBe(200);
  expect(iconResponse.headers()['content-type'] ?? '').toContain('image/svg+xml');
  const iconShape = await page.evaluate(
    text => {
      const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
      return {
        root: svg.localName,
        box: (svg.getAttribute('viewBox') ?? '')
          .trim()
          .split(/[\s,]+/)
          .map(Number),
        shapes: svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line, text')
          .length,
      };
    },
    await iconResponse.text(),
  );
  expect(iconShape.root).toBe('svg');
  expect(iconShape.box).toHaveLength(4);
  for (const side of iconShape.box.slice(2)) {
    expect(side).toBeGreaterThan(0);
    expect(side).toBeLessThanOrEqual(64);
  }
  expect(iconShape.shapes).toBeGreaterThan(0);
  const figure = demo(page)
    .getByRole('figure')
    .filter({ has: page.locator('img') })
    .first();
  const image = figure.locator('img').first();
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute('alt', /\S/);
  await expect
    .poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(figure.locator('figcaption')).toHaveText(/\S/);
  const fallback = demo(page).getByRole('figure').filter({ hasText: 'Image unavailable' }).first();
  await expect(fallback).toBeVisible();
  expect((await fallback.boundingBox())?.height ?? 0).toBeGreaterThan(48);
  // Lazy images request only near the viewport; scroll without waiting on a node that may fail.
  const missingSelector = '[data-doc-demo] img[src*="missing-photo.svg"]';
  await page.evaluate(selector => {
    document.querySelector(selector)?.scrollIntoView({ block: 'center' });
  }, missingSelector);
  await expect.poll(() => missingRequests).toBe(1);
  const retry = demo(page)
    .getByRole('figure')
    .filter({ hasText: 'Image unavailable' })
    .getByRole('button', { name: 'Retry image', exact: true });
  await expect(retry).toHaveCount(1);
  await expect(page.locator(missingSelector)).toHaveCount(0);
  await retry.focus();
  await page.keyboard.press('Enter');
  // The retry reloads the original source rather than swapping in another asset.
  const restored = page.locator(missingSelector);
  await expect(restored).toHaveCount(1);
  await restored.scrollIntoViewIfNeeded();
  await expect
    .poll(() => restored.evaluate(node => (node as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(retry).toHaveCount(0);
  await expect(restored.locator('xpath=ancestor::figure[1]')).not.toContainText(
    'Image unavailable',
  );
  expect(missingRequests).toBe(2);
  // Removing the retry button moves keyboard focus to the restored figure, named by its caption.
  const restoredFigure = restored.locator('xpath=ancestor::figure[1]');
  await expect(restoredFigure).toBeFocused();
  const restoredCaption = (await restoredFigure.locator('figcaption').innerText()).trim();
  expect(restoredCaption).not.toBe('');
  await expect(restoredFigure).toHaveAccessibleName(restoredCaption);
  // The restored figure shows only the central bottom marker at once, without an enclosure.
  const figureCue = await restoredFigure.evaluate(node => {
    const probe = document.createElement('span');
    probe.style.borderBottom = 'var(--focus-marker) solid var(--focus-color)';
    node.append(probe);
    const token = getComputedStyle(probe);
    const expected = [token.borderBottomWidth, token.borderBottomColor];
    probe.remove();
    const style = getComputedStyle(node);
    const durations = style.transitionDuration.split(',').map(value => parseFloat(value));
    return {
      expected,
      bottom: [style.borderBottomWidth, style.borderBottomColor],
      enclosure: [style.outlineStyle, style.boxShadow],
      animated: style.transitionProperty
        .split(',')
        .map(name => name.trim())
        .filter((_, index) => (durations[index % durations.length] ?? 0) > 0)
        .filter(name => /^(all|box-shadow|outline|border)/.test(name)),
    };
  });
  expect(parseFloat(figureCue.expected[0] ?? '')).toBeGreaterThan(0);
  expect(figureCue.bottom).toEqual(figureCue.expected);
  expect(figureCue.enclosure).toEqual(['none', 'none']);
  expect(figureCue.animated).toEqual([]);
  await expectNoPageOverflow(page);
  await attachShot('media-frame', figure);
});

test('content patterns stay semantic and the carousel moves by keyboard', async ({ page }) => {
  await open(page, '/components/content-patterns/');
  await expect(demo(page).getByRole('list').first().getByRole('listitem').first()).toBeVisible();
  const quote = demo(page)
    .getByRole('figure')
    .filter({ has: page.locator('blockquote') })
    .first();
  await expect(quote.locator('blockquote')).toHaveText(/\S/);
  await expect(quote.locator('figcaption')).toHaveText(/\S/);
  const lines = async () =>
    (await demo(page).innerText())
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  const before = new Set(await lines());
  const expand = demo(page).getByRole('button', { name: 'Expand people' });
  await expand.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expect
    .poll(async () => (await lines()).filter(line => !before.has(line)).length)
    .toBeGreaterThan(0);

  await open(page, '/components/carousel/');
  const status = demo(page)
    .getByRole('status')
    .filter({ hasText: /Slide \d+ of \d+/ });
  await expect(status).toHaveText(/Slide 1 of \d+/);
  const first = await shownAlts(demo(page));
  expect(first).not.toBe('');
  await demo(page).getByRole('button', { name: 'Next slide' }).focus();
  await page.keyboard.press('Enter');
  await expect(status).toHaveText(/Slide 2 of \d+/);
  await expect.poll(() => shownAlts(demo(page))).not.toBe(first);
  await demo(page).getByRole('button', { name: 'Previous slide' }).focus();
  await page.keyboard.press('Enter');
  await expect(status).toHaveText(/Slide 1 of \d+/);
  await expect.poll(() => shownAlts(demo(page))).toBe(first);
  await attachShot('carousel', demo(page));
});

test('upload lists only valid local files and removes them', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', request => {
    if (request.method() !== 'GET') sent.push(request.url());
  });
  await open(page, '/components/upload/');
  const input = demo(page).locator('input[type=file]').first();
  const remove = demo(page).getByRole('button', { name: /remove/i });
  await expect(input).toHaveAttribute('accept', 'text/plain,.txt');
  await input.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('GenUX local note'),
  });
  await expect(demo(page).getByText('notes.txt').first()).toBeVisible();
  await remove.click();
  await expect(remove).toHaveCount(0);
  await expect(demo(page).getByText('notes.txt')).toHaveCount(0);
  await input.setInputFiles({
    name: 'large.txt',
    mimeType: 'text/plain',
    buffer: Buffer.alloc(2048, 'a'),
  });
  await expect(demo(page).getByRole('alert').filter({ hasText: /\S/ }).first()).toBeVisible();
  await expect(remove).toHaveCount(0);
  expect(sent).toEqual([]);
});

test('rich menu opens by keyboard and commits a described action', async ({ page }) => {
  await open(page, '/components/rich-menu/');
  const trigger = demo(page).getByRole('button', { name: 'Workspace shortcuts' });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Workspace shortcuts' });
  await expect(menu).toBeVisible();
  const draft = menu.getByRole('menuitem', { name: /Draft report/ });
  await expect(draft).toContainText('Create a report from the current workspace.');
  await expect(menu.getByRole('menuitem', { name: /Publish remotely/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await draft.focus();
  await page.keyboard.press('Enter');
  await expect(demo(page).getByText('Selected: Draft report')).toBeVisible();
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expectNoPageOverflow(page);
});

test('chart pairs labelled bars and a legend with an aligned numeric table', async ({ page }) => {
  await open(page, '/components/chart/');
  const figure = demo(page).getByRole('figure').filter({ hasText: 'Weekly activity' }).first();
  await expect(figure.locator('svg').first()).toBeVisible();
  for (const value of ['8', '10', '11', '12', '15']) {
    const label = figure.locator('svg text').filter({ hasText: new RegExp('^' + value + '$') });
    await expect(label.first()).toBeAttached();
  }
  await expect(figure.getByText('Planned').first()).toBeVisible();
  await expect(figure.getByText('Completed').first()).toBeVisible();
  const table = demo(page).getByRole('table').filter({ hasText: 'Planned' }).first();
  await expect(table.locator('caption')).toHaveText(/\S/);
  const cells = await table.getByRole('cell').evaluateAll(nodes =>
    nodes
      .filter(node => /^\d+$/.test(node.textContent?.trim() ?? ''))
      .map(node => {
        const style = getComputedStyle(node);
        return {
          value: Number(node.textContent),
          align: style.textAlign,
          nums: style.fontVariantNumeric,
        };
      }),
  );
  expect(cells.map(cell => cell.value).sort((a, b) => a - b)).toEqual([8, 10, 11, 12, 12, 15]);
  for (const cell of cells) {
    expect(['end', 'right']).toContain(cell.align);
    expect(cell.nums).toContain('tabular-nums');
  }
  // Keyboard focus on each scroller shows only the central bottom marker, without animation.
  const focusCue = (target: Locator) =>
    target.evaluate(node => {
      const probe = document.createElement('span');
      probe.style.borderBottom = 'var(--focus-marker) solid var(--focus-color)';
      node.append(probe);
      const token = getComputedStyle(probe);
      const expected = [token.borderBottomWidth, token.borderBottomColor];
      probe.remove();
      const style = getComputedStyle(node);
      const durations = style.transitionDuration.split(',').map(value => parseFloat(value));
      return {
        expected,
        bottom: [style.borderBottomWidth, style.borderBottomColor],
        sides: [style.borderTopWidth, style.borderLeftWidth, style.borderRightWidth],
        enclosure: [style.outlineStyle, style.boxShadow],
        animated: style.transitionProperty
          .split(',')
          .map(name => name.trim())
          .filter((_, index) => (durations[index % durations.length] ?? 0) > 0)
          .filter(name => /^(all|box-shadow|outline|border)/.test(name)),
      };
    });
  const scrollers = [
    figure.locator('.genux-chart-plot-scroll'),
    figure.locator('.genux-chart-table-scroll'),
  ];
  const resting = await Promise.all(scrollers.map(focusCue));
  const expectCue = async (index: number) => {
    await expect(scrollers[index]!).toBeFocused();
    const rest = resting[index]!;
    const focused = await focusCue(scrollers[index]!);
    expect(rest.bottom).not.toEqual(rest.expected);
    expect(focused.animated).toEqual([]);
    expect(focused.bottom).toEqual(focused.expected);
    expect(focused.sides).toEqual(rest.sides);
    expect(focused.enclosure).toEqual(rest.enclosure);
  };
  await scrollers[0]!.focus();
  await page.keyboard.press('Tab');
  await expectCue(1);
  await page.keyboard.press('Shift+Tab');
  await expectCue(0);
  await expectNoPageOverflow(page);
});
