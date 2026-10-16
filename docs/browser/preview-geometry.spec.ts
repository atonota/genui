import { expect, test, type Locator, type Page } from '@playwright/test';

// Laptop preview geometry gate for every adaptive engine: the first Input workbench shows the
// MacBook as one fixed 1440x900 logical screen with a centered 1280 container and 80px
// margins, fits it at 320 and draws the whole 1520x942 device 1:1 from a laptop page to 2160,
// always in the same iframe document and without page overflow.

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

function box(locator: Locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width, height: r.height };
  });
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

/** Segmented options are chosen through their visible label; the native radio is hidden. */
async function choose(scope: Locator, name: RegExp) {
  await scope
    .locator('label')
    .filter({ has: scope.page().getByRole('radio', { name }) })
    .click();
  await expect(scope.getByRole('radio', { name })).toBeChecked();
}

/** The drawn device and the stage's own scroll extent, with the gaps at both inline edges. */
function deviceGeometry(fitRegion: Locator) {
  return fitRegion.evaluate(region => {
    const device = region.querySelector('.example-preview-device');
    const scaler = region.querySelector('.example-preview-scaler');
    if (!device || !scaler) throw new Error('The stage has no scaled device.');
    // Gaps between an element and the scrollport, inside the start-edge focus border.
    const gaps = (el: Element) => {
      const outer = region.getBoundingClientRect();
      const inner = el.getBoundingClientRect();
      const start = outer.left + region.clientLeft;
      return { start: inner.left - start, end: start + region.clientWidth - inner.right };
    };
    const kept = region.scrollLeft;
    region.scrollLeft = 0;
    const atStart = gaps(device);
    region.scrollLeft = region.scrollWidth;
    const atEnd = gaps(device);
    region.scrollLeft = kept;
    // What the reader sees now: the drawn device and its scaler footprint in the scrollport.
    const shown = gaps(device);
    const footprint = gaps(scaler);
    const drawn = device.getBoundingClientRect();
    const style = getComputedStyle(region);
    return {
      deviceWidth: Math.round(drawn.width),
      deviceHeight: Math.round(drawn.height),
      clientWidth: region.clientWidth,
      scrollWidth: region.scrollWidth,
      clientHeight: region.clientHeight,
      scrollHeight: region.scrollHeight,
      startGap: atStart.start,
      endGap: atEnd.end,
      scalerWidth: Math.round(scaler.getBoundingClientRect().width),
      shownStartGap: shown.start,
      shownEndGap: shown.end,
      scalerStartGap: footprint.start,
      scalerEndGap: footprint.end,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
    };
  });
}

// Fit clips its stage, so a raw scrollWidth may still count the unscaled layout box (Firefox).
// The oracle is the drawn device and its scaler footprint inside the scrollport, with the
// stage computed as overflow hidden so no wheel or touch can scroll it.
function expectFitInside(geometry: Awaited<ReturnType<typeof deviceGeometry>>) {
  expect(geometry.overflowX).toBe('hidden');
  expect(geometry.overflowY).toBe('hidden');
  expect(Math.abs(geometry.scalerWidth - geometry.deviceWidth)).toBeLessThanOrEqual(1);
  expect(geometry.shownStartGap).toBeGreaterThanOrEqual(-1);
  expect(geometry.shownEndGap).toBeGreaterThanOrEqual(-1);
  expect(geometry.scalerStartGap).toBeGreaterThanOrEqual(-1);
  expect(geometry.scalerEndGap).toBeGreaterThanOrEqual(-1);
}

test('MacBook preview geometry holds from 320 Fit to 2160 Actual', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/components/input/');
  const preview = page.locator('[data-example-preview]').first();
  await expect(preview).toHaveAttribute('data-preview-mode', 'preview');
  const iframe = preview.locator('iframe[data-preview-iframe]');
  const frame = preview.frameLocator('iframe[data-preview-iframe]');
  const frameRoot = frame.locator('html');
  const root = frame.locator('[data-preview-document]');
  // The iframe loads lazily, so the first workbench is brought into view before it is judged.
  await preview.scrollIntoViewIfNeeded();
  await choose(preview, /macbook/i);
  await expect(preview).toHaveAttribute('data-preview-device', 'macbook');
  await expect(iframe).toBeVisible();
  await expect(frame.locator('[data-preview-hydrated=true]')).toBeAttached();

  // A form draft and a window property survive only while the same document stays mounted.
  const workspace = frame.getByRole('textbox', { name: /workspace name/i });
  await expect(workspace).toBeEditable();
  await workspace.fill('Atlas operations');
  await root.evaluate(() => {
    (window as Window & { atlasGeometryProof?: string }).atlasGeometryProof = 'kept';
  });
  const expectDraftKept = async () => {
    await expect(workspace).toHaveValue('Atlas operations');
    const kept = await root.evaluate(
      () => (window as Window & { atlasGeometryProof?: string }).atlasGeometryProof === 'kept',
    );
    expect(kept).toBe(true);
  };

  // The logical screen is measured inside the iframe, so the stage scale never changes it.
  const viewport = frame.locator('[data-preview-viewport]');
  const container = frame.locator('[data-preview-container]');
  const logicalScreen = async () => {
    const [screen, inner] = [await box(viewport), await box(container)];
    return {
      width: Math.round(screen.width),
      height: Math.round(screen.height),
      containerWidth: Math.round(inner.width),
      margin: Math.round(inner.left - screen.left),
    };
  };
  const expectedScreen = { width: 1440, height: 900, containerWidth: 1280, margin: 80 };
  const caption = preview.locator('.example-preview-stage > .example-preview-caption');
  const captionPercent = async () =>
    Number(/([0-9]+)%$/.exec(((await caption.textContent()) ?? '').trim())?.[1] ?? NaN);
  const fitRegion = preview.locator('.example-preview-fit');
  const actual = preview.getByRole('button', { name: /actual size 1:1/i });

  // 320 Fit: the whole device scales into the stage below 100% and nothing scrolls sideways.
  await expect.poll(logicalScreen).toEqual(expectedScreen);
  await expect(caption).toContainText('1440×900');
  await expect(actual).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(captionPercent).toBeLessThan(100);
  await settleMotion(preview, frameRoot);
  const fit = await deviceGeometry(fitRegion);
  const fitPercent = await captionPercent();
  expect(Math.abs(fit.deviceWidth - (1520 * fitPercent) / 100)).toBeLessThanOrEqual(8);
  expect(fit.deviceWidth).toBeLessThanOrEqual(fit.clientWidth + 1);
  expectFitInside(fit);
  await expectNoPageOverflow(page);
  await expectDraftKept();
  await page.screenshot({ path: testInfo.outputPath('preview-fit-macbook-320.png') });

  // Actual 1:1 on laptop and desktop pages: a stage narrower than the 1520px device scrolls
  // only itself with both inline edges reachable; the page never overflows.
  await page.setViewportSize({ width: 1280, height: 900 });
  await actual.click();
  await expect(actual).toHaveAttribute('aria-pressed', 'true');
  await expect(caption).toContainText('100%');
  const narrow: Record<string, unknown> = {};
  for (const [width, height] of [
    [1280, 900],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => (await deviceGeometry(fitRegion)).deviceWidth).toBe(1520);
    await settleMotion(preview, frameRoot);
    const geometry = await deviceGeometry(fitRegion);
    narrow[width] = geometry;
    expect(geometry.deviceHeight).toBe(942);
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    expect(Math.abs(geometry.startGap)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.endGap)).toBeLessThanOrEqual(1);
    await expect.poll(logicalScreen).toEqual(expectedScreen);
    await expect(caption).toContainText('100%');
    await expectNoPageOverflow(page);
    await expectDraftKept();
    await fitRegion.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`preview-actual-macbook-${width}.png`) });
  }

  // At 2160 the component article fills the whole column between the flush sidebar and the
  // flush contents rail, past the old 1120px (70rem) ceiling, so the device width fits 1:1.
  await page.setViewportSize({ width: 2160, height: 1350 });
  const columns = await page.evaluate(() => {
    const grid = document.querySelector('[data-docs-shell] .page-grid');
    const article = grid?.querySelector(':scope > .component-detail');
    const toc = grid?.querySelector(':scope > [data-doc-nav=toc]');
    const sidebar = document.querySelector('aside.sidebar');
    if (!grid || !article || !toc || !sidebar) throw new Error('The page columns are missing.');
    const [g, a, t, s] = [grid, article, toc, sidebar].map(el => el.getBoundingClientRect());
    return {
      gridLeft: g.left,
      columnGap: Number.parseFloat(getComputedStyle(grid).columnGap),
      articleLeft: a.left,
      articleRight: a.right,
      tocLeft: t.left,
      tocRight: t.right,
      tocWidth: t.width,
      sidebarLeft: s.left,
      sidebarRight: s.right,
    };
  });
  expect(columns.articleRight - columns.articleLeft).toBeGreaterThan(1121);
  expect(Math.abs(columns.articleLeft - columns.gridLeft)).toBeLessThanOrEqual(1);
  const articleEndGap = columns.tocLeft - columns.columnGap - columns.articleRight;
  expect(Math.abs(articleEndGap)).toBeLessThanOrEqual(1);
  expect(Math.abs(columns.tocRight - 2160)).toBeLessThanOrEqual(1);
  expect(columns.tocWidth).toBeCloseTo(240, 0);
  expect(Math.abs(columns.sidebarLeft)).toBeLessThanOrEqual(1);
  expect(columns.sidebarRight).toBeLessThan(columns.articleLeft);
  expect((await box(preview)).width).toBeGreaterThan(1120);
  await expect
    .poll(async () => {
      const geometry = await deviceGeometry(fitRegion);
      return geometry.scrollWidth - geometry.clientWidth;
    })
    .toBeLessThanOrEqual(0);
  await settleMotion(preview, frameRoot);
  const wide = await deviceGeometry(fitRegion);
  expect(wide.deviceWidth).toBe(1520);
  expect(wide.deviceHeight).toBe(942);
  expect(wide.clientWidth).toBeGreaterThanOrEqual(1520);
  expect(wide.startGap).toBeGreaterThanOrEqual(-1);
  expect(wide.endGap).toBeGreaterThanOrEqual(-1);
  await expect.poll(logicalScreen).toEqual(expectedScreen);
  await expectNoPageOverflow(page);
  await expectDraftKept();
  await fitRegion.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('preview-actual-macbook-2160.png') });

  // Expanded at the same width, the whole 1520x942 device fits 1:1 without any scroll.
  const expand = preview.getByRole('button', { name: /^(expand|close expanded preview)$/i });
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  await expect
    .poll(async () => {
      const geometry = await deviceGeometry(fitRegion);
      return Math.max(
        geometry.scrollWidth - geometry.clientWidth,
        geometry.scrollHeight - geometry.clientHeight,
      );
    })
    .toBeLessThanOrEqual(0);
  await settleMotion(preview, frameRoot);
  const expanded = await deviceGeometry(fitRegion);
  expect(expanded.deviceWidth).toBe(1520);
  expect(expanded.deviceHeight).toBe(942);
  await expectDraftKept();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveAttribute('data-preview-expanded', 'false');

  // Back to Fit rescales the same document; the logical screen and the draft stay.
  await actual.click();
  await expect(actual).toHaveAttribute('aria-pressed', 'false');
  await settleMotion(preview, frameRoot);
  const fitAgain = await deviceGeometry(fitRegion);
  expectFitInside(fitAgain);
  await expect.poll(logicalScreen).toEqual(expectedScreen);
  await expectNoPageOverflow(page);
  await expectDraftKept();
  await testInfo.attach('preview-geometry-macbook.json', {
    body: JSON.stringify({ fit, fitPercent, narrow, columns, wide, expanded, fitAgain }, null, 2),
    contentType: 'application/json',
  });
});
