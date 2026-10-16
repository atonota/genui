import { expect, test, type Locator, type Page } from '@playwright/test';

// Laptop preview geometry gate for every adaptive engine: the first Input workbench shows the
// MacBook as one fixed 1440x900 logical screen with a centered 1024 container and 208px
// margins. Below a 1920 CSS px page the whole 1520x942 device fits the stage width with the
// inline Expand available; from 1920 the two rails of at most 200px leave the center column
// room to draw it 1:1, with no manual zoom or inline Expand, always in the same iframe
// document and without page overflow.

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
      drawnWidth: drawn.width,
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
  const expectedScreen = { width: 1440, height: 900, containerWidth: 1024, margin: 208 };
  const caption = preview.locator('.example-preview-stage > .example-preview-caption');
  const captionPercent = async () => {
    const text = ((await caption.textContent()) ?? '').trim();
    // The caption may carry decimals (99.93%), so the whole percentage is parsed.
    return Number(/([0-9]+(?:\.[0-9]+)?)%$/.exec(text)?.[1] ?? NaN);
  };
  const fitRegion = preview.locator('.example-preview-fit');
  // The MacBook has no manual zoom: the page width alone chooses Fit or 1:1.
  const actual = preview.getByRole('button', { name: /actual size 1:1/i });
  const expand = preview.getByRole('button', { name: /^expand$/i });
  const closeExpanded = preview.getByRole('button', { name: /^close expanded preview$/i });

  // Automatic Fit below 1920: the drawn device fills the stage width, never a 720px height
  // cap, stays below 1:1 by its actual rect rather than the rounded caption, and stays inside
  // the stage by its drawn rect and scaler footprint; the inline Expand stays available.
  const expectAutoFit = async () => {
    // A narrowed stage may still sit within 2px of the old 1:1 device before the page width
    // commits, so Fit is awaited as a whole: the inline Expand is back, the stage clips as Fit
    // and the drawn device is below 1:1 while filling the stage width.
    const fitCommitted = async () => {
      const geometry = await deviceGeometry(fitRegion);
      return (
        (await expand.isVisible()) &&
        geometry.overflowX === 'hidden' &&
        geometry.drawnWidth < 1520 &&
        Math.abs(geometry.clientWidth - geometry.drawnWidth) <= 2
      );
    };
    await expect.poll(fitCommitted).toBe(true);
    await settleMotion(preview, frameRoot);
    const geometry = await deviceGeometry(fitRegion);
    const percent = await captionPercent();
    expect(geometry.drawnWidth).toBeLessThan(1520);
    expect(geometry.drawnWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(Math.abs(geometry.clientWidth - geometry.drawnWidth)).toBeLessThanOrEqual(2);
    expect(percent).toBeLessThanOrEqual(100);
    expect(Math.abs(geometry.drawnWidth - (1520 * percent) / 100)).toBeLessThanOrEqual(8);
    expectFitInside(geometry);
    await expect.poll(logicalScreen).toEqual(expectedScreen);
    await expect(caption).toContainText('1440×900');
    await expect(actual).toHaveCount(0);
    await expect(expand).toBeVisible();
    await expectNoPageOverflow(page);
    await expectDraftKept();
    return { ...geometry, percent };
  };

  // From 1920 both rails stay at most 200 CSS px including padding, flush to the page edges,
  // and the component article fills the whole column between them.
  const columns = () =>
    page.evaluate(() => {
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
        sidebarWidth: s.width,
      };
    });
  const expectColumns = async (width: number) => {
    const layout = await columns();
    expect(Math.abs(layout.sidebarLeft)).toBeLessThanOrEqual(1);
    expect(layout.sidebarWidth).toBeLessThanOrEqual(200);
    expect(layout.sidebarRight).toBeLessThanOrEqual(layout.articleLeft + 1);
    expect(Math.abs(layout.tocRight - width)).toBeLessThanOrEqual(1);
    expect(layout.tocWidth).toBeGreaterThan(0);
    expect(layout.tocWidth).toBeLessThanOrEqual(200);
    expect(Math.abs(layout.articleLeft - layout.gridLeft)).toBeLessThanOrEqual(1);
    const articleEndGap = layout.tocLeft - layout.columnGap - layout.articleRight;
    expect(Math.abs(articleEndGap)).toBeLessThanOrEqual(1);
    expect(layout.articleRight - layout.articleLeft).toBeGreaterThanOrEqual(1520);
    return layout;
  };

  // Automatic 1:1 from 1920: the whole 1520x942 device sits inside the center stage without
  // any horizontal overflow, the caption reads 100% and the inline Expand is gone.
  const expectAutoActual = async (width: number) => {
    // 1:1 is awaited as a whole: the inline Expand is gone, the device is drawn at 1520 and
    // the stage has no horizontal overflow, before motion settles and geometry is read.
    const actualCommitted = async () => {
      const geometry = await deviceGeometry(fitRegion);
      return (
        (await expand.isHidden()) &&
        geometry.deviceWidth === 1520 &&
        geometry.scrollWidth - geometry.clientWidth <= 0
      );
    };
    await expect.poll(actualCommitted).toBe(true);
    await settleMotion(preview, frameRoot);
    const geometry = await deviceGeometry(fitRegion);
    expect(geometry.deviceWidth).toBe(1520);
    expect(geometry.deviceHeight).toBe(942);
    expect(geometry.clientWidth).toBeGreaterThanOrEqual(1520);
    expect(geometry.shownStartGap).toBeGreaterThanOrEqual(-1);
    expect(geometry.shownEndGap).toBeGreaterThanOrEqual(-1);
    await expect.poll(captionPercent).toBe(100);
    await expect.poll(logicalScreen).toEqual(expectedScreen);
    await expect(actual).toHaveCount(0);
    await expect(expand).toBeHidden();
    const layout = await expectColumns(width);
    await expectNoPageOverflow(page);
    await expectDraftKept();
    return { ...geometry, columns: layout };
  };

  // After Escape the focus rests on a visible control of this workbench, not a removed Expand.
  const focusOnVisibleControl = () =>
    preview.evaluate(workbench => {
      const el = workbench.ownerDocument.activeElement;
      if (!el || el === workbench || !workbench.contains(el)) return false;
      const control = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]';
      if (!el.matches(control)) return false;
      const shown = (el.closest('label') ?? el).getBoundingClientRect();
      return shown.width > 0 && shown.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });

  // 320: the whole device fits the stage width below 100% and nothing scrolls sideways.
  const fit = await expectAutoFit();
  expect(fit.percent).toBeLessThan(100);
  await page.screenshot({ path: testInfo.outputPath('preview-fit-macbook-320.png') });

  // Laptop pages below 1920 keep automatic Fit, 1919 included, where the caption may round to
  // 100% while the drawn device is still narrower than 1520.
  const below: Record<number, unknown> = {};
  for (const [width, height] of [
    [1280, 900],
    [1919, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    below[width] = await expectAutoFit();
  }
  await fitRegion.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('preview-fit-macbook-1919.png') });

  // Expanded at 1919, then widened to 1920: the close control stays, Escape returns inline and
  // focus lands on a visible control because the inline Expand is gone from 1920.
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  await expect(closeExpanded).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  await expect(closeExpanded).toBeVisible();
  await expectDraftKept();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveAttribute('data-preview-expanded', 'false');
  await expect.poll(focusOnVisibleControl).toBe(true);

  // 1920 and wider: automatic 1:1 between the two capped rails with no inline Expand.
  const wide: Record<number, unknown> = {};
  wide[1920] = await expectAutoActual(1920);
  await fitRegion.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('preview-actual-macbook-1920.png') });
  for (const [width, height] of [
    [1921, 1080],
    [2160, 1350],
  ] as const) {
    await page.setViewportSize({ width, height });
    wide[width] = await expectAutoActual(width);
  }
  expect((await box(preview)).width).toBeGreaterThan(1120);

  // Back below 1920 the same document fits again and the inline Expand returns.
  await page.setViewportSize({ width: 1919, height: 1080 });
  const fitAgain = await expectAutoFit();
  await testInfo.attach('preview-geometry-macbook.json', {
    body: JSON.stringify({ fit, below, wide, fitAgain }, null, 2),
    contentType: 'application/json',
  });
});
