import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Frame, type Locator, type Page } from '@playwright/test';

// Actual evidence screenshots, written only when the conductor provides a stage directory.
async function saveShot(page: Page, name: string) {
  const stage = process.env.ATLAS_SOURCE_STAGE;
  if (stage) await page.screenshot({ path: path.join(stage, name), fullPage: true });
}

// Viewport-only evidence of the mounted page, written to the same private stage directory.
async function saveViewportShot(page: Page, name: string) {
  const stage = process.env.ATLAS_SOURCE_STAGE;
  if (stage) await page.screenshot({ path: path.join(stage, name), fullPage: false });
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** scrollTop of the nearest scrolling ancestor, so the drawer's own nav scroller is measured. */
function navScrollTop(link: Locator) {
  return link.evaluate(el => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const scrolls = /auto|scroll/.test(getComputedStyle(node).overflowY);
      if (scrolls && node.scrollHeight > node.clientHeight) return node.scrollTop;
    }
    return document.scrollingElement?.scrollTop ?? 0;
  });
}

/** Segmented options are chosen through their visible label; the native radio is hidden. */
async function choose(scope: Locator, name: RegExp) {
  await scope
    .locator('label')
    .filter({ has: scope.page().getByRole('radio', { name }) })
    .click();
  await expect(scope.getByRole('radio', { name })).toBeChecked();
}

/** Contrast of a field's own label over the surface painted behind it, alpha composited. */
function labelContrast(field: Locator) {
  return field.evaluate(el => {
    const labelledBy = el.getAttribute('aria-labelledby')?.split(/\s+/)[0];
    const label =
      (el as HTMLInputElement).labels?.[0] ??
      (labelledBy ? el.ownerDocument.getElementById(labelledBy) : null);
    if (!label) throw new Error('The field has no label.');
    // A 1px canvas resolves any computed color, including color-mix and modern spaces, to sRGB.
    const canvas = el.ownerDocument.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No 2d canvas context.');
    const paint = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return { rgb: [r, g, b], alpha: a / 255 };
    };
    const over = (top: { rgb: number[]; alpha: number }, base: number[]) =>
      top.rgb.map((channel, i) => channel * top.alpha + base[i] * (1 - top.alpha));
    const chain: Element[] = [];
    for (let node: Element | null = label; node; node = node.parentElement) chain.unshift(node);
    let surface = [255, 255, 255];
    for (const node of chain)
      surface = over(paint(getComputedStyle(node).backgroundColor), surface);
    const ink = over(paint(getComputedStyle(label).color), surface);
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map(value => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [light, dark] = [luminance(ink), luminance(surface)].sort((a, b) => b - a);
    return (light + 0.05) / (dark + 0.05);
  });
}

function box(locator: Locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width, height: r.height };
  });
}

function rect(locator: Locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
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

type ResourceFile = { url: string; file: string; sha256: string };
type ProfileResources = {
  url: string;
  html: { file: string; sha256: string };
  entries: string[];
  js: ResourceFile[];
  stylesheets: ResourceFile[];
};
type PreviewResourceMap = {
  id: string;
  base: string;
  distDir: string;
  profiles: Record<'small' | 'medium' | 'large', ProfileResources>;
};

/** One preview id's emitted profile documents, read from the production docs dist. */
async function loadPreviewResourceMap(id: string, base: string) {
  const helper = new URL('../../tools/docs-preview-resource-map.mjs', import.meta.url);
  const { previewResourceMap } = (await import(helper.href)) as {
    previewResourceMap: (options: {
      repoRoot: string;
      id: string;
      base: string;
    }) => Promise<PreviewResourceMap>;
  };
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
  return previewResourceMap({ repoRoot, id, base });
}

test('320 drawer keeps nav scroll; desktop tabs, sidebar and TOC fit', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/components/input/');
  const toggle = page.locator('button[data-docs-menu-toggle]');
  const drawer = page.locator('dialog[data-docs-drawer]');
  await toggle.click();
  await expect(drawer).toBeVisible();
  const alertLink = drawer.getByRole('link', { name: /^alert$/i });
  await alertLink.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  // Diagnostic only: locator.click may scroll the list again before it dispatches the click.
  const programmaticScrollBeforeClick = await navScrollTop(alertLink);
  // The baseline is the list scroll at the actual click, reported through a test-only binding
  // by a one-shot capture listener on the link before the browser navigates away.
  const clickScrolls: number[] = [];
  await page.exposeBinding('atlasRecordNavClickScroll', (_source, scroll: number) => {
    clickScrolls.push(scroll);
  });
  await alertLink.evaluate(link => {
    link.addEventListener(
      'click',
      () => {
        let scroll = document.scrollingElement?.scrollTop ?? 0;
        for (let node = link.parentElement; node; node = node.parentElement) {
          const scrolls = /auto|scroll/.test(getComputedStyle(node).overflowY);
          if (scrolls && node.scrollHeight > node.clientHeight) {
            scroll = node.scrollTop;
            break;
          }
        }
        const view = window as Window & { atlasRecordNavClickScroll?: (value: number) => void };
        if (typeof view.atlasRecordNavClickScroll !== 'function')
          throw new Error('The atlasRecordNavClickScroll binding is missing.');
        view.atlasRecordNavClickScroll(scroll);
      },
      { capture: true, once: true },
    );
  });
  await alertLink.click();
  await expect.poll(() => clickScrolls.length).toBe(1);
  const [actualClickScroll] = clickScrolls;
  expect(Number.isFinite(actualClickScroll)).toBe(true);
  await expect(page).toHaveURL(/\/components\/alert\//);

  // The reopened drawer lands where the reader left the navigation.
  await toggle.click();
  await expect(drawer).toBeVisible();
  const current = drawer.getByRole('link', { name: /^alert$/i });
  await expect(current).toHaveAttribute('aria-current', 'page');
  const restoredScroll = await navScrollTop(current);
  await test.info().attach('drawer-nav-scroll.json', {
    body: JSON.stringify(
      { programmaticScrollBeforeClick, actualClickScroll, restoredScroll },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(Math.abs(restoredScroll - actualClickScroll)).toBeLessThanOrEqual(2);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expectNoPageOverflow(page);
  await saveShot(page, 'docs-reference-320.png');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/components/input/');
  const tabs = page.locator('[data-doc-tab]');
  await expect(tabs).toHaveCount(4);
  await expect(page.locator('[data-doc-tab][aria-selected="true"]')).toHaveCount(1);
  await expect(tabs.filter({ hasText: /examples/i })).toHaveAttribute('aria-selected', 'true');
  await page.goto('/components/alert/#api');
  await expect(tabs.filter({ hasText: /^\s*api\s*$/i })).toHaveAttribute('aria-selected', 'true');
  const sidebar = page.locator('aside.sidebar');
  await expect(sidebar).toBeVisible();
  expect(Math.abs((await box(sidebar)).left)).toBeLessThanOrEqual(1);
  await expectNoPageOverflow(page);

  await page.setViewportSize({ width: 1920, height: 1080 });
  const toc = page.locator('[data-doc-nav="toc"]');
  await expect(toc).toBeVisible();
  const tocBox = await box(toc);
  expect(tocBox.left).toBeGreaterThan(1920 / 2);
  expect(Math.abs(tocBox.left + tocBox.width - 1920)).toBeLessThanOrEqual(1);
  expect(Math.abs((await box(sidebar)).left)).toBeLessThanOrEqual(1);
  await expectNoPageOverflow(page);
  await saveShot(page, 'docs-reference-1920.png');
});

test('Input preview isolates its iframe document, state, profile and delivery', async ({
  page,
  browser,
}) => {
  // Requests tagged with the frame that issued them, so only the selected iframe is judged.
  const requests: { url: string; frame: Frame | null; frameUrl: string }[] = [];
  page.on('request', request => {
    let frame: Frame | null = null;
    try {
      frame = request.frame();
    } catch {
      // Service worker requests have no frame.
    }
    requests.push({ url: request.url(), frame, frameUrl: frame?.url() ?? '' });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/components/input/');
  const preview = page.locator('[data-example-preview]').first();
  await expect(preview).toHaveAttribute('data-preview-mode', 'preview');
  await expect(preview.getByRole('radio', { name: /^preview$/i })).toBeChecked();

  const id = await preview.getAttribute('data-example-preview');
  expect(id).toBeTruthy();
  const iframe = preview.locator('iframe[data-preview-iframe]');
  await expect(iframe).toHaveCount(1);
  const frame = preview.frameLocator('iframe[data-preview-iframe]');
  const root = frame.locator('[data-preview-document]');
  const hydrated = frame.locator('[data-preview-hydrated=true]');
  // A profile change keeps the same iframe document, so the small delivery is judged only by
  // requests that iframe issues after the switch.
  const switchedAt = requests.length;
  await choose(preview, /iphone/i);
  await expect(root).toBeAttached();
  await expect(iframe).toBeVisible();
  await expect(preview).toHaveAttribute('data-preview-profile', /small/i);
  const previewFrame = await (await iframe.elementHandle())?.contentFrame();
  expect(previewFrame).toBeTruthy();
  const selectedRequests = () => requests.slice(switchedAt).filter(r => r.frame === previewFrame);

  // Fill only once the small delivery entry has loaded in that same document.
  await expect.poll(() => selectedRequests().some(r => /SmallDelivery/.test(r.url))).toBe(true);
  const workspace = frame.getByRole('textbox', { name: /workspace name/i });
  // Native Tab from the parent's preview link enters the iframe on Workspace name; the shared
  // modality crosses the frame boundary and the field shows one bottom marker, never a ring.
  const frameRoot = frame.locator('html');
  const fieldFocus = () =>
    workspace.evaluate(el => {
      const style = getComputedStyle(el);
      const owner = getComputedStyle(el.closest('.atlas-input-frame[data-atlas-input]') ?? el);
      return { backgroundImage: owner.backgroundImage, outlineStyle: style.outlineStyle };
    });
  await preview.getByRole('link', { name: /open\s+(?:stand)?alone/i }).press('Tab');
  await expect(workspace).toBeFocused();
  await expect(frameRoot).toHaveAttribute('data-input-modality', 'keyboard');
  await expect.poll(async () => (await fieldFocus()).backgroundImage).not.toBe('none');
  const keyboardFocus = await fieldFocus();
  expect(keyboardFocus.outlineStyle).toBe('none');
  // A native pointer press in the frame turns the visual mode off in both documents.
  await workspace.click();
  await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'pointer');
  await expect(frameRoot).toHaveAttribute('data-input-modality', 'pointer');
  await expect.poll(async () => (await fieldFocus()).backgroundImage).toBe('none');
  await test.info().attach('preview-focus-modality.json', {
    body: JSON.stringify({ keyboard: keyboardFocus, pointer: await fieldFocus() }, null, 2),
    contentType: 'application/json',
  });
  await workspace.fill('Atlas operations');
  // A window property survives only while the same iframe browsing context stays mounted.
  await root.evaluate(() => {
    (window as Window & { atlasFrameProof?: string }).atlasFrameProof = 'kept';
  });
  const sameFrameWindow = () =>
    root.evaluate(
      () => (window as Window & { atlasFrameProof?: string }).atlasFrameProof === 'kept',
    );

  // A controlled Department choice is React state that later profile changes must keep.
  const department = frame.getByRole('combobox', { name: /department/i });
  await department.click();
  await frame.getByTitle('Finance', { exact: true }).click();
  const expectDepartmentSelected = async () => {
    await department.click();
    await expect(frame.getByRole('option', { name: /^finance$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await department.press('Escape');
  };
  await expectDepartmentSelected();

  // The example Tweaker lives in the iframe; its native switch is example state as well.
  const countSwitch = frame.locator('#input-tweaker-count');
  await frame
    .getByRole('button', { name: /open tweaker/i })
    .first()
    .click();
  await expect(countSwitch).toBeVisible();
  await expect(countSwitch).toHaveAttribute('aria-checked', 'false');
  await countSwitch.click();
  await expect(countSwitch).toHaveAttribute('aria-checked', 'true');

  // A token edited through this preview's Tweaker stays in this preview document: the docs
  // shell's saved recipe and a sibling preview keep their values, and reset restores only this.
  const builderKey = 'atlas-theme-builder-v1';
  const parentRecipe = () => page.evaluate(key => localStorage.getItem(key), builderKey);
  const parentBefore = await parentRecipe();
  const sibling = page.locator('[data-example-preview]').nth(1);
  await sibling.scrollIntoViewIfNeeded();
  const siblingFrame = sibling.frameLocator('iframe[data-preview-iframe]');
  const siblingRoot = siblingFrame.locator('html');
  await expect(sibling.locator('iframe[data-preview-iframe]')).toBeVisible();
  await expect(siblingFrame.locator('[data-preview-document]')).toBeAttached();
  const inlineTheme = (scope: Locator) =>
    scope.evaluate(el =>
      [el, el.ownerDocument.body].map(node => node?.getAttribute('style') ?? '').join('|'),
    );
  const tokenValues = (scope: Locator, names: string[]) =>
    scope.evaluate((el, list) => {
      const style = getComputedStyle(el.ownerDocument.body ?? el);
      return list.map(name => style.getPropertyValue(name).trim());
    }, names);
  const ownedTokens = () =>
    frameRoot.evaluate(el => Array.from(el.style).filter(name => name.startsWith('--')));
  const firstBefore = await inlineTheme(frameRoot);
  const siblingBefore = await inlineTheme(siblingRoot);
  // Hydrating the sibling scrolled the first iframe away; bring it back so its Tweaker drawer,
  // which cannot scroll the outer page, is reachable by real clicks.
  await iframe.scrollIntoViewIfNeeded();
  const editors = frame.locator('[data-theme-token-editors]');
  const token = editors.getByRole('spinbutton').first();
  const tokenValue = Number(await token.inputValue());
  const tokenMax = Number((await token.getAttribute('aria-valuemax')) ?? Infinity);
  await token.fill(String(tokenValue + 1 <= tokenMax ? tokenValue + 1 : tokenValue - 1));
  await expect.poll(ownedTokens).not.toEqual([]);
  const names = await ownedTokens();
  const edited = await tokenValues(frameRoot, names);
  const siblingEdited = await tokenValues(siblingRoot, names);
  expect(await parentRecipe()).toBe(parentBefore);
  expect(await inlineTheme(siblingRoot)).toBe(siblingBefore);
  await iframe.scrollIntoViewIfNeeded();
  await editors.getByRole('button', { name: /reset theme/i }).click();
  await expect.poll(() => inlineTheme(frameRoot)).toBe(firstBefore);
  const restored = await tokenValues(frameRoot, names);
  const changed = names.filter((_, index) => edited[index] !== restored[index]);
  await test.info().attach('preview-local-recipe.json', {
    body: JSON.stringify({ parentBefore, changed, edited, restored, siblingEdited }, null, 2),
    contentType: 'application/json',
  });
  expect(changed).not.toEqual([]);
  expect(await tokenValues(siblingRoot, names)).toEqual(siblingEdited);
  expect(await inlineTheme(siblingRoot)).toBe(siblingBefore);
  expect(await parentRecipe()).toBe(parentBefore);
  await frame.getByRole('button', { name: /close tweaker/i }).click();
  await expect(countSwitch).toBeHidden();

  const expectDemoStateKept = async () => {
    expect(await sameFrameWindow()).toBe(true);
    await expect(workspace).toHaveValue('Atlas operations');
    await expectDepartmentSelected();
    await expect(countSwitch).toHaveAttribute('aria-checked', 'true');
  };

  // The preview theme belongs to the iframe document; the docs shell keeps its own theme.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await choose(preview, /dark/i);
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  // Dark field labels read on the dark panel the iframe actually paints, not light-mode ink.
  await expect.poll(() => labelContrast(workspace)).toBeGreaterThanOrEqual(4.5);
  // The shared web controls apply inside the iframe: the stepper is one three-track row.
  const stepper = frame.locator('.atlas-number-stepper').first();
  const stepperLayout = await stepper.evaluate(el => {
    const style = getComputedStyle(el);
    return { display: style.display, tracks: style.gridTemplateColumns.trim().split(/\s+/).length };
  });
  expect(stepperLayout).toEqual({ display: 'grid', tracks: 3 });
  await expect(workspace).toHaveValue('Atlas operations');

  // Source is opened lazily, only on Code.
  await expect(preview.getByRole('region', { name: /source code/i })).toHaveCount(0);
  await choose(preview, /^code$/i);
  await expect(preview).toHaveAttribute('data-preview-mode', 'code');
  const source = preview.getByRole('region', { name: /source code/i });
  await expect(source).toContainText(/small/i);
  // Code hides the device selector and names the actual small entry file, not just the word.
  await expect(preview.getByRole('radio', { name: /iphone|ipad|macbook/i })).toHaveCount(0);
  // The first block is the preview configuration; the path lives in the Profile entry block.
  const profileEntry = source
    .locator('.preview-source-block')
    .filter({ has: page.getByRole('heading', { name: /^profile entry:\s*small$/i }) });
  await expect(profileEntry).toHaveCount(1);
  await expect(profileEntry.locator('p > code')).toHaveText(
    /^docs\/src\/react\/(?:[\w.-]+\/)*\w*SmallDelivery\w*\.tsx$/,
  );
  // The primary usage is the documented HTML embed of the existing small preview route in the
  // current dark theme, not an import of an internal entry module.
  const usage = source.locator('.preview-source-block').first().locator('pre').first();
  await expect(usage).toContainText(/^\s*<iframe\b[^]*<\/iframe>\s*$/);
  await expect(usage).not.toContainText(/\bimport\b/);
  // The exact displayed markup is what a reader copies; the cold host below embeds it as-is.
  const usageMarkup = (await usage.textContent()) ?? '';
  // Parsed inert in a template, so nothing in it runs in the docs page.
  const usageEmbed = await page.evaluate(markup => {
    const template = document.createElement('template');
    template.innerHTML = markup;
    const embed = template.content.querySelector('iframe');
    return {
      elements: Array.from(template.content.querySelectorAll('*')).map(el => el.localName),
      src: embed?.getAttribute('src') ?? '',
      width: embed?.getAttribute('width') ?? '',
      height: embed?.getAttribute('height') ?? '',
    };
  }, usageMarkup);
  expect(usageEmbed.elements).toEqual(['iframe']);
  // The embed is sized to the selected small profile's portrait logical screen.
  expect([usageEmbed.width, usageEmbed.height]).toEqual(['402', '874']);
  expect(usageEmbed.src).toContain(`/preview/${id}/small`);
  // The canonical route path ends in a slash, so the host loads it without a redirect.
  expect(new URL(usageEmbed.src).pathname.endsWith('/small/')).toBe(true);
  expect(usageEmbed.src).toContain('theme=dark');
  // An ordinary host page has no docs base URL, so the embed names this site's origin.
  expect(new URL(usageEmbed.src).origin).toBe(new URL(page.url()).origin);
  // The selected small iframe loads its own entry and no medium/large entry after the switch;
  // other frames are not judged.
  const selected = selectedRequests().map(({ url, frameUrl }) => ({ url, frameUrl }));
  await test.info().attach('selected-preview-requests.json', {
    body: JSON.stringify(selected, null, 2),
    contentType: 'application/json',
  });
  expect(selected.map(r => r.url).filter(url => /SmallDelivery/.test(url))).not.toEqual([]);
  expect(selected.map(r => r.url).filter(url => /(Medium|Large)Delivery/.test(url))).toEqual([]);
  await choose(preview, /^preview$/i);
  await expect(workspace).toHaveValue('Atlas operations');
  expect(await sameFrameWindow()).toBe(true);

  // Back on Preview, the same native radio follows the shared modality: the pointer press shows
  // no ring and no marker, real Shift+Tab from the checked device radio returns to it with only
  // the central bottom marker, and the next pointer press clears that marker again.
  const viewTabs = preview.locator('.example-preview-view-tabs');
  const previewRadio = viewTabs.getByRole('radio', { name: /^preview$/i });
  // `has` is resolved inside each label, so it must be page-relative rather than rooted at the
  // preview; the viewTabs scope already selects this preview's group.
  const previewItem = viewTabs
    .locator('label.ant-segmented-item')
    .filter({ has: page.getByRole('radio', { name: /^preview$/i }) });
  const parentRoot = page.locator('html');
  const segmentFocus = () =>
    previewItem.evaluate(label => {
      const group = label.closest('.example-preview-view-tabs');
      const outlines: string[] = [];
      for (
        let node: Element | null = label.querySelector('input');
        node;
        node = node.parentElement
      ) {
        outlines.push(getComputedStyle(node).outlineStyle);
        if (node === group) break;
      }
      // The label's own inner wrappers can carry a library focus outline as well.
      for (const node of Array.from(label.querySelectorAll('*')))
        outlines.push(getComputedStyle(node).outlineStyle);
      // The focus surface and bottom marker are painted on the inner item label wrapper; the
      // outer label keeps the library's own selected fill.
      const paint = label.querySelector('.ant-segmented-item-label');
      if (!paint) throw new Error('The segmented item has no label wrapper.');
      return {
        backgroundImage: getComputedStyle(paint).backgroundImage,
        outlines: [...new Set(outlines)],
      };
    });
  await expect(previewItem).toHaveCount(1);
  await expect(parentRoot).toHaveAttribute('data-input-modality', 'pointer');
  await expect.poll(async () => (await segmentFocus()).backgroundImage).toBe('none');
  const pointerSegment = await segmentFocus();
  expect(pointerSegment.outlines).toEqual(['none']);
  // Segmented roots leave the Tab order, so Shift+Tab lands on the checked Preview radio.
  await preview.getByRole('radio', { name: /iphone/i }).press('Shift+Tab');
  await expect(previewRadio).toBeFocused();
  await expect(parentRoot).toHaveAttribute('data-input-modality', 'keyboard');
  await expect.poll(async () => (await segmentFocus()).backgroundImage).not.toBe('none');
  const keyboardSegment = await segmentFocus();
  expect(keyboardSegment.outlines).toEqual(['none']);
  await expect(previewRadio).toBeChecked();
  // Forced colors: the icon-only device labels hold only an SVG and screen-reader text, so a
  // text underline paints nothing. Real Tab from the checked Preview radio reaches the checked
  // iPhone radio, whose label shows one CanvasText bottom bar and no enclosing outline.
  const iphoneRadio = preview.getByRole('radio', { name: /iphone/i });
  const iphoneItem = preview
    .locator('label.ant-segmented-item')
    .filter({ has: page.getByRole('radio', { name: /iphone/i }) });
  await expect(iphoneItem).toHaveCount(1);
  const forcedSegmentFocus = () =>
    iphoneItem.evaluate(label => {
      // The bar is painted on the inner item label wrapper's ::after.
      const wrapper = label.querySelector('.ant-segmented-item-label');
      if (!wrapper) throw new Error('The segmented item has no label wrapper.');
      const bar = getComputedStyle(wrapper, '::after');
      // The system CanvasText as this document resolves it, unadjusted by forced colors.
      const probe = label.ownerDocument.createElement('span');
      probe.style.setProperty('forced-color-adjust', 'none');
      probe.style.setProperty('background-color', 'CanvasText');
      label.ownerDocument.body.append(probe);
      const canvasText = getComputedStyle(probe).backgroundColor;
      probe.remove();
      // The hidden native input may take the global forced keyboard outline; the label may not.
      const outlines = [label, ...Array.from(label.querySelectorAll('*'))]
        .filter(node => node.localName !== 'input')
        .map(node => getComputedStyle(node).outlineStyle);
      return {
        content: bar.content,
        position: bar.position,
        width: parseFloat(bar.width),
        height: parseFloat(bar.height),
        backgroundColor: bar.backgroundColor,
        canvasText,
        textDecoration: getComputedStyle(label).textDecorationLine,
        outlines: [...new Set(outlines)],
      };
    });
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  await previewRadio.press('Tab');
  await expect(iphoneRadio).toBeFocused();
  await expect(iphoneRadio).toBeChecked();
  await expect(parentRoot).toHaveAttribute('data-input-modality', 'keyboard');
  await expect.poll(async () => (await forcedSegmentFocus()).content).not.toBe('none');
  const forcedSegment = await forcedSegmentFocus();
  await test.info().attach('preview-forced-segmented-focus.json', {
    body: JSON.stringify(forcedSegment, null, 2),
    contentType: 'application/json',
  });
  expect(forcedSegment.position).toBe('absolute');
  expect(forcedSegment.width).toBeGreaterThan(0);
  expect(forcedSegment.height).toBeGreaterThan(0);
  expect(['', 'transparent', 'rgba(0, 0, 0, 0)']).not.toContain(forcedSegment.backgroundColor);
  expect(forcedSegment.backgroundColor).toBe(forcedSegment.canvasText);
  expect(forcedSegment.textDecoration).toBe('none');
  expect(forcedSegment.outlines).toEqual(['none']);
  // Back in normal colors, the real Preview label press below returns to the pointer state.
  await page.emulateMedia({ forcedColors: 'none' });
  await previewItem.click();
  await expect(parentRoot).toHaveAttribute('data-input-modality', 'pointer');
  await expect.poll(async () => (await segmentFocus()).backgroundImage).toBe('none');
  const pointerAgainSegment = await segmentFocus();
  expect(pointerAgainSegment.outlines).toEqual(['none']);
  await expect(previewRadio).toBeChecked();
  await expect(preview).toHaveAttribute('data-preview-mode', 'preview');
  await test.info().attach('preview-view-segmented-focus.json', {
    body: JSON.stringify(
      { pointer: pointerSegment, keyboard: keyboardSegment, pointerAgain: pointerAgainSegment },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  const viewport = frame.locator('[data-preview-viewport]');
  const rotate = preview.getByRole('button', { name: /landscape|orientation|rotate/i });
  const size = async () => {
    const b = await box(viewport);
    return `${Math.round(b.width)}x${Math.round(b.height)}`;
  };
  await expect.poll(size).toBe('402x874');
  // Evidence waits for the requested theme, hydration, a ready frame and settled finite motion.
  const settledShot = async (name: string) => {
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(hydrated).toBeAttached();
    await expect(iframe).toBeVisible();
    await settleMotion(preview, frameRoot);
    await saveViewportShot(page, name);
  };
  await settledShot('preview-phone-portrait.png');
  await rotate.click();
  await expect.poll(size).toBe('874x402');
  await expect(workspace).toHaveValue('Atlas operations');
  expect(await sameFrameWindow()).toBe(true);
  await settledShot('preview-phone-landscape.png');

  // Actual size 1:1 and back to Fit only rescale the same document.
  const actual = preview.getByRole('button', { name: /actual size 1:1/i });
  const caption = preview.locator('.example-preview-stage > .example-preview-caption');
  await expect(actual).toHaveAttribute('aria-pressed', 'false');
  await actual.click();
  await expect(actual).toHaveAttribute('aria-pressed', 'true');
  await expect(caption).toContainText('100%');
  await expect(workspace).toHaveValue('Atlas operations');
  await actual.click();
  await expect(actual).toHaveAttribute('aria-pressed', 'false');
  await expect(workspace).toHaveValue('Atlas operations');
  expect(await sameFrameWindow()).toBe(true);

  // Expand reuses the same dialog and iframe; keyboard Escape and the close button return inline.
  const expand = preview.getByRole('button', { name: /^(expand|close expanded preview)$/i });
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  await expect(expand).toHaveAccessibleName(/close expanded preview/i);
  await expect(workspace).toHaveValue('Atlas operations');
  expect(await sameFrameWindow()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveAttribute('data-preview-expanded', 'false');
  await expect(preview).toBeVisible();
  await expect(workspace).toHaveValue('Atlas operations');
  expect(await sameFrameWindow()).toBe(true);
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'false');
  await expect(expand).toHaveAccessibleName(/^expand$/i);
  await expect(workspace).toHaveValue('Atlas operations');
  expect(await sameFrameWindow()).toBe(true);

  // iPad: 744x1133 portrait and 1133x744 landscape, whichever it opens in.
  await choose(preview, /ipad/i);
  await expect.poll(size).toMatch(/^(744x1133|1133x744)$/);
  const ipad = await size();
  await rotate.click();
  await expect.poll(size).toBe(ipad === '744x1133' ? '1133x744' : '744x1133');
  await expectDemoStateKept();

  // MacBook: 1440x900 (16:10) logical screen with a centered 1280 container and 80px margins;
  // the caption reads the same central size.
  await choose(preview, /macbook/i);
  await expect.poll(size).toBe('1440x900');
  await expect(caption).toContainText('1440×900');
  const screen = await box(viewport);
  const container = await box(frame.locator('[data-preview-container]'));
  expect(container.width).toBeCloseTo(1280, 0);
  expect(container.left - screen.left).toBeCloseTo(80, 0);
  await expectDemoStateKept();

  // Actual 1:1 scrolling, the 2160 wide column and the expanded 1:1 fit are gated on every
  // adaptive engine by preview-geometry.spec.ts.

  // Expanded MacBook evidence on a desktop-sized page, then Escape returns inline.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  await expect(frame.locator('[data-preview-container]')).toBeVisible();
  // The whole fitted device stays inside the expanded stage and the page viewport.
  await settleMotion(preview, frameRoot);
  const stage = preview.locator('.example-preview-stage');
  const stageBox = await rect(stage);
  const deviceBox = await rect(
    stage.locator(':scope > *').filter({ has: page.locator('iframe[data-preview-iframe]') }),
  );
  expect(deviceBox.left).toBeGreaterThanOrEqual(Math.max(stageBox.left, 0) - 1);
  expect(deviceBox.top).toBeGreaterThanOrEqual(Math.max(stageBox.top, 0) - 1);
  expect(deviceBox.right).toBeLessThanOrEqual(Math.min(stageBox.right, 1920) + 1);
  expect(deviceBox.bottom).toBeLessThanOrEqual(Math.min(stageBox.bottom, 1080) + 1);
  await settledShot('preview-expanded-macbook-1920.png');
  await page.keyboard.press('Escape');
  await expect(preview).toHaveAttribute('data-preview-expanded', 'false');

  // Production delivery: a cold context with no service worker or HTTP cache hosts only the
  // documented usage markup in an ordinary page; the embedded small profile document, its
  // emitted entry and static closure load, other profile entry roots do not.
  const baseURL = test.info().project.use.baseURL;
  expect(baseURL).toBeTruthy();
  const resources = await loadPreviewResourceMap(id!, new URL(baseURL!).pathname);
  const { small, medium, large } = resources.profiles;
  // Every profile's static closure reaches past its island and renderer roots, so an import
  // walk that silently follows nothing cannot satisfy the delivery checks below.
  for (const profile of [small, medium, large])
    expect(profile.js.length).toBeGreaterThan(profile.entries.length + 1);
  const smallRequired = [...small.js, ...small.stylesheets].map(resource => resource.url);
  const otherRoots = [...medium.entries, ...large.entries].filter(
    url => !small.entries.includes(url) && !smallRequired.includes(url),
  );
  expect(otherRoots).not.toEqual([]);
  const cold = await browser.newContext({ baseURL, serviceWorkers: 'block' });
  const coldRequests: string[] = [];
  cold.on('request', request => coldRequests.push(request.url()));
  try {
    const coldPage = await cold.newPage();
    // An ordinary host page holding only the usage markup exactly as the Code view displayed it.
    await coldPage.setContent(usageMarkup);
    const host = await coldPage.evaluate(() => ({
      url: location.href,
      elements: Array.from(document.body.querySelectorAll('*')).map(el => el.localName),
      scripts: document.scripts.length,
    }));
    expect(host.elements).toEqual(['iframe']);
    expect(host.scripts).toBe(0);
    // The ordinary host lays the embed out at the small portrait size its attributes declare.
    const embedSize = await coldPage.locator('iframe').evaluate(el => ({
      width: el.getAttribute('width'),
      height: el.getAttribute('height'),
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    }));
    expect(embedSize).toEqual({ width: '402', height: '874', clientWidth: 402, clientHeight: 874 });
    const embedded = coldPage.frameLocator('iframe');
    await expect(embedded.locator('[data-preview-hydrated=true]')).toBeAttached();
    await expect(embedded.locator('[data-profile="small"]').first()).toBeAttached();
    await expect(embedded.locator('[data-preview-document]')).toHaveAttribute('data-theme', 'dark');
    const requested = new Set(coldRequests.map(url => new URL(url).pathname));
    await test.info().attach('cold-small-delivery.json', {
      body: JSON.stringify(
        {
          baseURL,
          cache: { context: 'fresh', serviceWorkers: 'block' },
          usageMarkup,
          host,
          embedSize,
          manifest: resources,
          requests: coldRequests,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    expect(smallRequired.filter(url => !requested.has(url))).toEqual([]);
    expect(otherRoots.filter(url => requested.has(url))).toEqual([]);
  } finally {
    await cold.close();
  }
});
