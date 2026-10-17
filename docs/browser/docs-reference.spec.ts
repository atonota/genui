import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Actual evidence screenshots, written only when the conductor provides a stage directory.
async function saveShot(page: Page, name: string) {
  const stage = process.env.GENUX_SOURCE_STAGE;
  if (stage) await page.screenshot({ path: path.join(stage, name), fullPage: true });
}

// Viewport-only evidence of the mounted page, written to the same private stage directory.
async function saveViewportShot(page: Page, name: string) {
  const stage = process.env.GENUX_SOURCE_STAGE;
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
  profiles: Record<'small' | 'medium' | 'large' | 'tv', ProfileResources>;
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
  await page.exposeBinding('genuxRecordNavClickScroll', (_source, scroll: number) => {
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
        const view = window as Window & { genuxRecordNavClickScroll?: (value: number) => void };
        if (typeof view.genuxRecordNavClickScroll !== 'function')
          throw new Error('The genuxRecordNavClickScroll binding is missing.');
        view.genuxRecordNavClickScroll(scroll);
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
  // Both desktop rails stay within 200 CSS px including their padding; their links keep 14px
  // or larger text that wraps between words instead of clipping or ending in an ellipsis.
  expect(tocBox.width).toBeLessThanOrEqual(200);
  expect((await box(sidebar)).width).toBeLessThanOrEqual(200);
  const clippedRailText = await page.evaluate(() =>
    Array.from(document.querySelectorAll('aside.sidebar a, [data-doc-nav=toc] a'))
      .filter(link => link.getClientRects().length > 0)
      .filter(link => {
        const style = getComputedStyle(link);
        return (
          Number.parseFloat(style.fontSize) < 14 ||
          style.textOverflow === 'ellipsis' ||
          link.scrollWidth > link.clientWidth + 1
        );
      })
      .map(link => link.textContent?.trim() ?? ''),
  );
  expect(clippedRailText).toEqual([]);
  await expectNoPageOverflow(page);
  await saveShot(page, 'docs-reference-1920.png');
});

test('Input preview renders inline with kept node, state, profile and delivery', async ({
  page,
  browser,
}) => {
  // Real OS/browser QA provenance for this run.
  await test.info().attach('browser-runtime.json', {
    body: JSON.stringify(
      {
        engine: browser.browserType().name(),
        version: browser.version(),
        platform: process.platform,
        playwrightVersion: '1.64.0',
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  // Every iframe ever inserted is counted, so a transient embed fails as well as a kept one.
  await page.addInitScript(() => {
    const seen = { count: 0 };
    (window as Window & { genuxIframesSeen?: typeof seen }).genuxIframesSeen = seen;
    new MutationObserver(records => {
      for (const record of records)
        for (const node of Array.from(record.addedNodes))
          if (
            node instanceof Element &&
            (node.localName === 'iframe' || node.querySelector('iframe'))
          )
            seen.count += 1;
    }).observe(document, { childList: true, subtree: true });
  });
  const expectNoIframes = async () => {
    await expect(page.locator('iframe')).toHaveCount(0);
    const seen = await page.evaluate(
      () => (window as Window & { genuxIframesSeen?: { count: number } }).genuxIframesSeen?.count,
    );
    expect(seen).toBe(0);
  };
  // Page requests with their type: an inline preview fetches no preview document or route.
  const requests: { url: string; type: string }[] = [];
  page.on('request', request => {
    requests.push({ url: request.url(), type: request.resourceType() });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/components/input/');
  // The production component page holds zero iframe elements right after load.
  await expectNoIframes();
  const preview = page.locator('[data-example-preview]').first();
  await expect(preview).toHaveAttribute('data-preview-mode', 'preview');
  await expect(preview.getByRole('radio', { name: /^preview$/i })).toBeChecked();
  const id = await preview.getAttribute('data-example-preview');
  expect(id).toBeTruthy();

  // The example's actual controls render directly inside this preview's device screen.
  const screen = preview.locator('.example-preview-screen');
  await expect(screen).toHaveCount(1);
  const content = screen.locator('[data-preview-content]');
  await expect(content).toHaveCount(1);
  const hydrated = screen.locator('[data-preview-hydrated=true]');
  await expect(hydrated).toBeAttached();
  const workspace = content.getByRole('textbox', { name: /workspace name/i });
  await expect(workspace).toBeEditable();
  await expectNoIframes();
  // Before any preview radio, control or form focus, the Inspector's Component settings opens
  // the first example's Tweaker: a 3px corner edit lands on that preview's screen only, while
  // the shell, its saved recipe and the sibling preview keep theirs, and reset restores it.
  const builderKey = 'genux-theme-builder-v1';
  const parentRecipe = () => page.evaluate(key => localStorage.getItem(key), builderKey);
  // Shell inline declarations on html and body compared as sorted name/value/priority entries.
  // Excluded are exactly the two transient overlay roles the existing overlay runtime writes
  // while the native Tweaker is open: --genux-overlay-clip (overlay clip geometry) and
  // --genux-overlay-active-z (active overlay stacking). They measure overlay placement, not
  // theme; every other declaration (theme, radius, color, font, header) must stay identical.
  const transientOverlayRoles = ['--genux-overlay-clip', '--genux-overlay-active-z'];
  const shellTheme = () =>
    page.evaluate(
      excluded =>
        JSON.stringify(
          [document.documentElement, document.body].map(node => {
            const style = node.style;
            return Array.from(style)
              .filter(name => !excluded.includes(name))
              .sort()
              .map(name => [
                name,
                style.getPropertyValue(name).trim(),
                style.getPropertyPriority(name),
              ]);
          }),
        ),
      transientOverlayRoles,
    );
  const sibling = page.locator('[data-example-preview]').nth(1);
  const siblingScreen = sibling.locator('.example-preview-screen');
  await expect(siblingScreen).toHaveCount(1);
  // Inline declarations compared as sorted name/value/priority entries: SSR and CSSOM
  // serialize the same declarations with different spacing.
  const inlineTheme = (scope: Locator) =>
    scope.evaluate(el => {
      const style = (el as HTMLElement).style;
      return JSON.stringify(
        Array.from(style)
          .sort()
          .map(name => [
            name,
            style.getPropertyValue(name).trim(),
            style.getPropertyPriority(name),
          ]),
      );
    });
  const tokenValues = (scope: Locator, names: string[]) =>
    scope.evaluate((el, list) => {
      const style = getComputedStyle(el);
      return list.map(name => style.getPropertyValue(name).trim());
    }, names);
  const ownedTokens = () =>
    screen.evaluate(el =>
      Array.from((el as HTMLElement).style).filter(name => name.startsWith('--')),
    );
  const editors = page.locator('[data-theme-token-editors]');
  const inspectorRecipe = await parentRecipe();
  const inspectorShell = await shellTheme();
  const inspectorScreen = await inlineTheme(screen);
  const inspectorSibling = await inlineTheme(siblingScreen);
  const inspector = page.locator('dialog[data-docs-inspector]');
  await page
    .locator('[aria-controls=docs-inspector]:not([data-docs-inspector-close])')
    .first()
    .click();
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('[data-docs-inspector-focus]')).toBeVisible();
  const settings = inspector.getByRole('button', { name: /^component settings$/i });
  await expect(settings).toBeEnabled();
  await settings.click();
  const corner = editors.getByRole('combobox', { name: /radius|corner/i }).first();
  await expect(corner).toBeVisible();
  await corner.click();
  await page.getByTitle('3px', { exact: true }).click();
  await expect.poll(() => inlineTheme(screen)).not.toBe(inspectorScreen);
  // Device geometry roles are not theme tokens; only the edited corner roles are judged.
  const cornerNames = await screen.evaluate(el => {
    const style = getComputedStyle(el);
    return Array.from((el as HTMLElement).style).filter(
      name =>
        name.startsWith('--') &&
        !name.startsWith('--preview-') &&
        style.getPropertyValue(name).trim() === '3px',
    );
  });
  expect(cornerNames).not.toEqual([]);
  const siblingCorners = await tokenValues(siblingScreen, cornerNames);
  const shellCorners = await tokenValues(page.locator('html'), cornerNames);
  await test.info().attach('inspector-local-corner.json', {
    body: JSON.stringify({ cornerNames, siblingCorners, shellCorners }, null, 2),
    contentType: 'application/json',
  });
  expect(siblingCorners).not.toContain('3px');
  expect(shellCorners).not.toContain('3px');
  expect(await inlineTheme(siblingScreen)).toBe(inspectorSibling);
  expect(await shellTheme()).toBe(inspectorShell);
  expect(await parentRecipe()).toBe(inspectorRecipe);
  await editors.getByRole('button', { name: /reset theme/i }).click();
  await expect.poll(() => inlineTheme(screen)).toBe(inspectorScreen);
  expect(await tokenValues(screen, cornerNames)).toEqual(siblingCorners);
  expect(await inlineTheme(siblingScreen)).toBe(inspectorSibling);
  expect(await shellTheme()).toBe(inspectorShell);
  expect(await parentRecipe()).toBe(inspectorRecipe);
  await page.getByRole('button', { name: /close tweaker/i }).click();
  await expect(editors).toBeHidden();
  if (await inspector.evaluate(dialog => (dialog as HTMLDialogElement).open))
    await inspector.locator('[data-docs-inspector-close]').click();
  await expect(inspector).toBeHidden();
  // A kept handle and an expando prove the same input element stays mounted throughout.
  const workspaceNode = await workspace.elementHandle();
  if (!workspaceNode) throw new Error('The Workspace name field is missing.');
  // Code mode hides the preview (aria-hidden + inert), so the role locator rightly finds no
  // textbox there; identity checks use a DOM locator keyed to this actual node's id.
  const workspaceId = await workspaceNode.evaluate(el => el.id);
  if (!workspaceId) throw new Error('The Workspace name field has no id.');
  const mountedWorkspace = content.locator(`[id=${JSON.stringify(workspaceId)}]`);
  await expect(mountedWorkspace).toHaveCount(1);
  await workspaceNode.evaluate(el => {
    (el as Element & { genuxNodeProof?: string }).genuxNodeProof = 'kept';
  });
  const sameNode = async () => {
    const current = await mountedWorkspace.elementHandle();
    return page.evaluate(
      ([kept, now]) =>
        Boolean(kept?.isConnected) &&
        kept === now &&
        (kept as Element & { genuxNodeProof?: string }).genuxNodeProof === 'kept',
      [workspaceNode, current],
    );
  };
  await choose(preview, /iphone/i);
  await expect(preview).toHaveAttribute('data-preview-device', 'iphone');
  await expect(preview).toHaveAttribute('data-preview-profile', 'small');
  expect(await sameNode()).toBe(true);

  // Native Tab from the preview's standalone link enters Workspace name in this same document
  // with no bridge; the field shows one bottom marker at readable size, never a ring.
  const pageRoot = page.locator('html');
  const fieldFocus = () =>
    workspace.evaluate(el => {
      const style = getComputedStyle(el);
      const owner = getComputedStyle(el.closest('.genux-input-frame[data-genux-input]') ?? el);
      const labelledBy = el.getAttribute('aria-labelledby')?.split(/\s+/)[0];
      const label =
        (el as HTMLInputElement).labels?.[0] ??
        (labelledBy ? el.ownerDocument.getElementById(labelledBy) : null);
      return {
        backgroundImage: owner.backgroundImage,
        outlineStyle: style.outlineStyle,
        fontSize: Number.parseFloat(style.fontSize),
        labelFontSize: label ? Number.parseFloat(getComputedStyle(label).fontSize) : 0,
      };
    });
  await preview.getByRole('link', { name: /open\s+(?:stand)?alone/i }).press('Tab');
  await expect(workspace).toBeFocused();
  await expect(pageRoot).toHaveAttribute('data-input-modality', 'keyboard');
  await expect.poll(async () => (await fieldFocus()).backgroundImage).not.toBe('none');
  const keyboardFocus = await fieldFocus();
  expect(keyboardFocus.outlineStyle).toBe('none');
  expect(keyboardFocus.fontSize).toBeGreaterThanOrEqual(14);
  expect(keyboardFocus.labelFontSize).toBeGreaterThanOrEqual(14);
  // A native pointer press turns the one visual mode off again.
  await workspace.click();
  await expect(pageRoot).toHaveAttribute('data-input-modality', 'pointer');
  await expect.poll(async () => (await fieldFocus()).backgroundImage).toBe('none');
  await test.info().attach('preview-focus-modality.json', {
    body: JSON.stringify({ keyboard: keyboardFocus, pointer: await fieldFocus() }, null, 2),
    contentType: 'application/json',
  });
  // A private draft with markup characters; neither it nor an escaped form may reach Code.
  const draft = 'Zq7 <private> & draft';
  const privateMarker = 'Zq7';
  await workspace.fill(draft);
  expect(await sameNode()).toBe(true);

  // A controlled Department choice is React state that later changes must keep.
  const department = content.getByRole('combobox', { name: /department/i });
  await department.click();
  await page.getByTitle('Finance', { exact: true }).click();
  const expectDepartmentSelected = async () => {
    await department.click();
    await expect(page.getByRole('option', { name: /^finance$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await department.press('Escape');
  };
  await expectDepartmentSelected();

  // The example Tweaker belongs to this preview; its native switch is example state as well.
  const countSwitch = page.locator('#input-tweaker-count');
  await preview
    .getByRole('button', { name: /open tweaker/i })
    .first()
    .click();
  await expect(countSwitch).toHaveCount(1);
  await expect(countSwitch).toBeVisible();
  await expect(countSwitch).toHaveAttribute('aria-checked', 'false');
  await countSwitch.click();
  await expect(countSwitch).toHaveAttribute('aria-checked', 'true');

  // A token edited through this preview's Tweaker lands on this preview's screen only: the docs
  // shell, its saved recipe and a sibling preview keep their values, and reset restores this.
  const parentBefore = await parentRecipe();
  const shellBefore = await shellTheme();
  const firstBefore = await inlineTheme(screen);
  const siblingBefore = await inlineTheme(siblingScreen);
  const token = editors.getByRole('spinbutton').first();
  const tokenValue = Number(await token.inputValue());
  const tokenMax = Number((await token.getAttribute('aria-valuemax')) ?? Infinity);
  await token.fill(String(tokenValue + 1 <= tokenMax ? tokenValue + 1 : tokenValue - 1));
  await expect.poll(() => inlineTheme(screen)).not.toBe(firstBefore);
  // Device geometry roles are not theme tokens; only the edited recipe is judged.
  const names = (await ownedTokens()).filter(name => !name.startsWith('--preview-'));
  expect(names).not.toEqual([]);
  const edited = await tokenValues(screen, names);
  const siblingEdited = await tokenValues(siblingScreen, names);
  expect(await parentRecipe()).toBe(parentBefore);
  expect(await shellTheme()).toBe(shellBefore);
  expect(await inlineTheme(siblingScreen)).toBe(siblingBefore);
  await editors.getByRole('button', { name: /reset theme/i }).click();
  await expect.poll(() => inlineTheme(screen)).toBe(firstBefore);
  const restored = await tokenValues(screen, names);
  const changed = names.filter((_, index) => edited[index] !== restored[index]);
  await test.info().attach('preview-local-recipe.json', {
    body: JSON.stringify({ parentBefore, changed, edited, restored, siblingEdited }, null, 2),
    contentType: 'application/json',
  });
  expect(changed).not.toEqual([]);
  expect(await tokenValues(siblingScreen, names)).toEqual(siblingEdited);
  expect(await inlineTheme(siblingScreen)).toBe(siblingBefore);
  expect(await parentRecipe()).toBe(parentBefore);
  expect(await shellTheme()).toBe(shellBefore);
  await page.getByRole('button', { name: /close tweaker/i }).click();
  await expect(countSwitch).toBeHidden();

  const expectDemoStateKept = async () => {
    expect(await sameNode()).toBe(true);
    await expect(workspace).toHaveValue(draft);
    await expectDepartmentSelected();
    await expect(countSwitch).toHaveAttribute('aria-checked', 'true');
  };

  // The preview theme belongs to this preview's screen; the shell and the sibling keep theirs.
  await expect(pageRoot).not.toHaveAttribute('data-theme', 'dark');
  await choose(preview, /dark/i);
  await expect(screen).toHaveAttribute('data-theme', 'dark');
  await expect(pageRoot).not.toHaveAttribute('data-theme', 'dark');
  await expect(siblingScreen).not.toHaveAttribute('data-theme', 'dark');
  expect(await shellTheme()).toBe(shellBefore);
  // Dark field labels read on the dark panel the screen actually paints, not light-mode ink.
  await expect.poll(() => labelContrast(workspace)).toBeGreaterThanOrEqual(4.5);
  // The shared web controls apply inside the screen: the stepper is one three-track row.
  const stepper = content.locator('.genux-number-stepper').first();
  const stepperLayout = await stepper.evaluate(el => {
    const style = getComputedStyle(el);
    return { display: style.display, tracks: style.gridTemplateColumns.trim().split(/\s+/).length };
  });
  expect(stepperLayout).toEqual({ display: 'grid', tracks: 3 });
  await expectDemoStateKept();

  // Each device is an explicit surface naming its profile. The logical screen is the layout
  // size from the central model, never the scaled drawing and never the page width.
  const viewport = preview.locator('[data-preview-viewport]');
  const logicalSize = () =>
    viewport.evaluate(el => {
      const screenBox = el as HTMLElement;
      return `${screenBox.offsetWidth}x${screenBox.offsetHeight}`;
    });
  const rotate = preview.getByRole('button', { name: /landscape|orientation|rotate/i });
  const caption = preview.locator('.example-preview-stage > .example-preview-caption');
  const devices = [
    { name: /iphone/i, value: 'iphone', profile: 'small', sizes: /^402x874$/, rotatable: true },
    {
      name: /ipad/i,
      value: 'ipad',
      profile: 'medium',
      sizes: /^(744x1133|1133x744)$/,
      rotatable: true,
    },
    { name: /macbook/i, value: 'macbook', profile: 'large', sizes: /^1440x900$/, rotatable: false },
    // TV is chosen explicitly on a 1280 page: a 1920x1080 living-room logical reference.
    { name: /^tv$/i, value: 'tv', profile: 'tv', sizes: /^1920x1080$/, rotatable: false },
  ];

  // Source opens lazily, only on Code; the preview stays mounted but inert meanwhile.
  await expect(preview.getByRole('region', { name: /source code/i })).toHaveCount(0);
  const expectCode = async (profile: string, viaBack = false) => {
    await choose(preview, /^code$/i);
    await expect(preview).toHaveAttribute('data-preview-mode', 'code');
    const source = preview.getByRole('region', { name: /source code/i });
    await expect(source).toBeVisible();
    await expect(preview.getByRole('radio', { name: /iphone|ipad|macbook|^tv$/i })).toHaveCount(0);
    expect(await sameNode()).toBe(true);
    // Hidden from the accessibility tree while inert; the DOM node itself stays mounted.
    await expect(content.getByRole('textbox', { name: /workspace name/i })).toHaveCount(0);
    expect(await mountedWorkspace.evaluate(el => el.closest('[inert]') !== null)).toBe(true);
    // The Profile entry block names the selected profile's actual entry file.
    const profileEntry = source.locator('.preview-source-block').filter({
      has: page.getByRole('heading', {
        name: new RegExp(String.raw`^profile entry:\s*${profile}$`, 'i'),
      }),
    });
    await expect(profileEntry).toHaveCount(1);
    await expect(profileEntry.locator('p > code')).toHaveText(
      new RegExp(String.raw`^docs/src/(?:[\w.-]+/)*\w*${profile}\w*\.tsx$`, 'i'),
    );
    // The primary usage imports the real React component and renders it as JSX, no embed;
    // only line comments, such as the internal-entry and standalone-page notes, may precede it.
    const usage = source.locator('.preview-source-block').first().locator('pre').first();
    await expect(usage).toContainText(/^(?:[ \t]*\/\/[^\n]*\n)*\s*import\s[^]*\sfrom\s+\S+/);
    await expect(usage).toContainText(/<[A-Z][\w.]*[\s/>]/);
    await expect(usage).not.toContainText(/<\/?iframe\b/i);
    // The private draft never reaches the source, raw or escaped.
    const shown = await source.evaluate(el => [el.textContent ?? '', el.innerHTML].join(' '));
    expect(shown).not.toContain(privateMarker);
    if (viaBack) {
      // Keyboard Enter on Code's Back to Preview returns to the checked, focused Preview radio
      // with the same mounted form and the central modality left exactly as it was.
      const modality = await pageRoot.getAttribute('data-input-modality');
      await preview.getByRole('button', { name: /back to preview/i }).press('Enter');
      const previewView = preview.getByRole('radio', { name: /^preview$/i });
      await expect(previewView).toBeChecked();
      await expect(previewView).toBeFocused();
      await expect(
        preview
          .locator('label.ant-segmented-item')
          .filter({ has: page.getByRole('radio', { name: /^preview$/i }) }),
      ).toBeVisible();
      expect(await pageRoot.getAttribute('data-input-modality')).toBe(modality);
    } else {
      await choose(preview, /^preview$/i);
    }
    await expect(preview).toHaveAttribute('data-preview-mode', 'preview');
    await expect(workspace).toBeEditable();
    expect(await workspace.evaluate(el => el.closest('[inert]') === null)).toBe(true);
    await expectDemoStateKept();
  };

  for (const device of devices) {
    await choose(preview, device.name);
    await expect(preview).toHaveAttribute('data-preview-device', device.value);
    await expect(preview).toHaveAttribute('data-preview-profile', device.profile);
    await expect.poll(logicalSize).toMatch(device.sizes);
    const opened = await logicalSize();
    const [width, height] = opened.split('x');
    await expect(caption).toContainText(`${width}×${height}`);
    if (device.rotatable) {
      await rotate.click();
      await expect.poll(logicalSize).toBe(`${height}x${width}`);
      await expectDemoStateKept();
      await rotate.click();
      await expect.poll(logicalSize).toBe(opened);
    }
    await expectDemoStateKept();
    await expectCode(device.profile, device === devices[0]);
  }
  await expectNoIframes();

  // Back on the portrait iPhone for the segmented focus checks below.
  await choose(preview, /iphone/i);
  await expect(preview).toHaveAttribute('data-preview-profile', 'small');
  await expect.poll(logicalSize).toBe('402x874');
  await expect(workspace).toHaveValue(draft);
  expect(await sameNode()).toBe(true);

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
  // Each group keeps exactly one explicit native Tab stop on its checked radio; WebKit skips
  // implicit radio stops, so unchecked radios carry -1 rather than no index.
  await expect(previewRadio).toBeChecked();
  await expect(previewRadio).toHaveAttribute('tabindex', '0');
  const uncheckedViews = await viewTabs.getByRole('radio', { checked: false }).all();
  expect(uncheckedViews.length).toBeGreaterThan(0);
  for (const radio of uncheckedViews) await expect(radio).toHaveAttribute('tabindex', '-1');
  await expect(preview.getByRole('radio', { name: /iphone/i })).toBeChecked();
  await expect(preview.getByRole('radio', { name: /iphone/i })).toHaveAttribute('tabindex', '0');
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

  // Phone evidence waits for the requested theme, hydration and settled finite motion.
  const settledShot = async (name: string) => {
    await expect(screen).toHaveAttribute('data-theme', 'dark');
    await expect(hydrated).toBeAttached();
    await expect(screen).toBeVisible();
    await settleMotion(preview);
    await saveViewportShot(page, name);
  };
  await expect.poll(logicalSize).toBe('402x874');
  await settledShot('preview-phone-portrait.png');
  await rotate.click();
  await expect.poll(logicalSize).toBe('874x402');
  await expect(workspace).toHaveValue(draft);
  expect(await sameNode()).toBe(true);
  await settledShot('preview-phone-landscape.png');
  await rotate.click();
  await expect.poll(logicalSize).toBe('402x874');

  // Actual size 1:1 and back to Fit only rescale the same node.
  const actual = preview.getByRole('button', { name: /actual size 1:1/i });
  await expect(actual).toHaveAttribute('aria-pressed', 'false');
  await actual.click();
  await expect(actual).toHaveAttribute('aria-pressed', 'true');
  await expect(caption).toContainText('100%');
  await expect(workspace).toHaveValue(draft);
  await actual.click();
  await expect(actual).toHaveAttribute('aria-pressed', 'false');
  await expect(workspace).toHaveValue(draft);
  expect(await sameNode()).toBe(true);

  // Expand shows the same node in one reused dialog; keyboard Escape and the close button
  // return inline with focus back on Expand.
  const expand = preview.getByRole('button', { name: /^(expand|close expanded preview)$/i });
  const expandedDialog = () => workspace.evaluateHandle(el => el.closest('dialog, [role=dialog]'));
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  await expect(expand).toHaveAccessibleName(/close expanded preview/i);
  const firstDialog = await expandedDialog();
  expect(await firstDialog.evaluate(dialog => dialog !== null)).toBe(true);
  await expect(workspace).toHaveValue(draft);
  expect(await sameNode()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveAttribute('data-preview-expanded', 'false');
  await expect(preview).toBeVisible();
  await expect(expand).toBeFocused();
  await expect(workspace).toHaveValue(draft);
  expect(await sameNode()).toBe(true);
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  const secondDialog = await expandedDialog();
  const sameDialog = await page.evaluate(
    ([first, second]) => first !== null && first === second,
    [firstDialog, secondDialog],
  );
  expect(sameDialog).toBe(true);
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'false');
  await expect(expand).toHaveAccessibleName(/^expand$/i);
  await expect(expand).toBeFocused();
  await expect(workspace).toHaveValue(draft);
  expect(await sameNode()).toBe(true);

  // MacBook: the central 1440x900 (16:10) logical screen with a centered 1024 container and
  // 208px margins, read as layout lengths so the stage scale never changes them.
  await choose(preview, /macbook/i);
  await expect(preview).toHaveAttribute('data-preview-profile', 'large');
  await expect.poll(logicalSize).toBe('1440x900');
  await expect(caption).toContainText('1440×900');
  const logicalContainer = await viewport.evaluate(el => {
    const screenBox = el as HTMLElement;
    const inner = screenBox.querySelector<HTMLElement>('[data-preview-container]');
    if (!inner) throw new Error('The logical screen has no container.');
    const scale = screenBox.getBoundingClientRect().width / screenBox.offsetWidth;
    const drawnMargin = inner.getBoundingClientRect().left - screenBox.getBoundingClientRect().left;
    return { width: inner.offsetWidth, margin: drawnMargin / scale };
  });
  expect(logicalContainer.width).toBe(1024);
  expect(logicalContainer.margin).toBeCloseTo(208, 0);
  await expectDemoStateKept();

  // Automatic Fit below 1920, automatic 1:1 from 1920, the 200px rails and the wide column
  // are gated on every adaptive engine by preview-geometry.spec.ts.

  // Expanded MacBook evidence just below 1920, where the inline Expand exists; widening to
  // 1920 while expanded keeps the close control and Escape still returns inline.
  await page.setViewportSize({ width: 1919, height: 1080 });
  await expand.click();
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  await expect(preview.locator('[data-preview-container]')).toBeVisible();
  // The whole fitted device stays inside the expanded stage and the page viewport.
  await settleMotion(preview);
  const stage = preview.locator('.example-preview-stage');
  const stageBox = await rect(stage);
  const deviceBox = await rect(stage.locator('.example-preview-device'));
  expect(deviceBox.left).toBeGreaterThanOrEqual(Math.max(stageBox.left, 0) - 1);
  expect(deviceBox.top).toBeGreaterThanOrEqual(Math.max(stageBox.top, 0) - 1);
  expect(deviceBox.right).toBeLessThanOrEqual(Math.min(stageBox.right, 1919) + 1);
  expect(deviceBox.bottom).toBeLessThanOrEqual(stageBox.bottom + 1);
  // The fitted device keeps its full height: a short expanded dialog owns the vertical scroll
  // instead of shrinking the device, and scrolling it to the end reaches the device bottom.
  const dialogScroll = await stage.locator('.example-preview-device').evaluate(device => {
    const viewportHeight = device.ownerDocument.documentElement.clientHeight;
    const dialog = device.closest('dialog, [role=dialog]');
    let scroller: Element | null = null;
    for (
      let node = device.parentElement;
      node && dialog?.contains(node);
      node = node.parentElement
    ) {
      const scrolls = /auto|scroll/.test(getComputedStyle(node).overflowY);
      if (scrolls && node.scrollHeight > node.clientHeight) {
        scroller = node;
        break;
      }
    }
    const bottom = device.getBoundingClientRect().bottom;
    const measured = {
      dialog: Boolean(dialog),
      scrolls: Boolean(scroller),
      viewportHeight,
      bottom,
      scrollHeight: 0,
      clientHeight: 0,
      kept: 0,
      atEnd: 0,
      restored: 0,
      bottomAtEnd: bottom,
      scrollportBottom: viewportHeight,
    };
    if (!scroller) return measured;
    measured.scrollHeight = scroller.scrollHeight;
    measured.clientHeight = scroller.clientHeight;
    measured.kept = scroller.scrollTop;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' });
    measured.atEnd = scroller.scrollTop;
    measured.bottomAtEnd = device.getBoundingClientRect().bottom;
    const port = scroller.getBoundingClientRect();
    const portBottom = port.top + scroller.clientTop + scroller.clientHeight;
    measured.scrollportBottom = Math.min(portBottom, viewportHeight);
    scroller.scrollTo({ top: measured.kept, behavior: 'instant' });
    measured.restored = scroller.scrollTop;
    return measured;
  });
  await test.info().attach('preview-expanded-macbook-scroll.json', {
    body: JSON.stringify(dialogScroll, null, 2),
    contentType: 'application/json',
  });
  if (dialogScroll.bottom > dialogScroll.viewportHeight + 1) {
    expect(dialogScroll.dialog).toBe(true);
    expect(dialogScroll.scrolls).toBe(true);
    expect(dialogScroll.bottomAtEnd).toBeLessThanOrEqual(dialogScroll.scrollportBottom + 1);
  }
  expect(Math.abs(dialogScroll.restored - dialogScroll.kept)).toBeLessThanOrEqual(1);
  await expectNoPageOverflow(page);
  await settledShot('preview-expanded-macbook-1919.png');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(preview).toHaveAttribute('data-preview-expanded', 'true');
  await expect(preview.getByRole('button', { name: /^close expanded preview$/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveAttribute('data-preview-expanded', 'false');
  await expect(preview.getByRole('button', { name: /^expand$/i })).toBeHidden();
  // A 1920 page never turns the MacBook into the TV surface.
  await expect(preview).toHaveAttribute('data-preview-device', 'macbook');
  await expect(preview).toHaveAttribute('data-preview-profile', 'large');
  await expect.poll(logicalSize).toBe('1440x900');
  await expect(workspace).toHaveValue(draft);
  expect(await sameNode()).toBe(true);

  // Every switch rendered in place: the page loaded only its own document, never this
  // preview's standalone route, and no iframe was ever inserted.
  await expectNoIframes();
  const documents = requests
    .filter(({ type }) => type === 'document')
    .map(({ url }) => new URL(url).pathname);
  const routeRequests = requests
    .map(({ url }) => url)
    .filter(url => new URL(url).pathname.includes(`/preview/${id}/`));
  await test.info().attach('inline-preview-requests.json', {
    body: JSON.stringify({ documents, routeRequests, requests }, null, 2),
    contentType: 'application/json',
  });
  expect(documents).toEqual([new URL(page.url()).pathname]);
  expect(routeRequests).toEqual([]);

  // Production delivery: each standalone profile route opens directly in a cold context with
  // no service worker or HTTP cache and without any iframe host; it loads its own emitted entry
  // and static closure and no other profile's entry roots.
  const baseURL = test.info().project.use.baseURL;
  expect(baseURL).toBeTruthy();
  const resources = await loadPreviewResourceMap(id!, new URL(baseURL!).pathname);
  // The TV preview must ship the living-room layout controller. Its emitted entry comes from the
  // canonical production map, which also passes the cold phone isolation gate before returning.
  const { dirname, resolve } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const helperURL = pathToFileURL(
    resolve(dirname(test.info().file), '../../tools/docs-adaptive-resource-map.mjs'),
  ).href;
  const { buildAdaptiveResourceMap } = (await import(helperURL)) as {
    buildAdaptiveResourceMap: (options: {
      outDir: string;
      base?: string;
    }) => Promise<{ profiles: Record<string, { entry: string }> }>;
  };
  const adaptiveMap = await buildAdaptiveResourceMap({
    outDir: resolve(dirname(test.info().file), '../dist'),
    base: new URL(baseURL!).pathname,
  });
  const livingRoomEntry = adaptiveMap.profiles['living-room'].entry;
  expect(livingRoomEntry).toMatch(/[.]m?js$/);
  const profileNames = ['small', 'medium', 'large', 'tv'] as const;
  // Every profile's static closure reaches past its island and renderer roots, so an import
  // walk that silently follows nothing cannot satisfy the delivery checks below.
  for (const name of profileNames) {
    const profile = resources.profiles[name];
    expect(profile.js.length).toBeGreaterThan(profile.entries.length + 1);
  }
  for (const name of profileNames) {
    const profile = resources.profiles[name];
    const required = [...profile.js, ...profile.stylesheets].map(resource => resource.url);
    const otherRoots = profileNames
      .filter(other => other !== name)
      .flatMap(other => resources.profiles[other].entries)
      .filter(url => !profile.entries.includes(url) && !required.includes(url));
    expect(otherRoots).not.toEqual([]);
    // TV opens on a short 320x200 host; its logical 1920x1080 viewport must still win after
    // hydration, not only in the initial SSR seed. Other profiles keep the default viewport.
    const hostViewport = name === 'tv' ? { width: 320, height: 200 } : null;
    const cold = await browser.newContext({
      baseURL,
      serviceWorkers: 'block',
      ...(hostViewport ? { viewport: hostViewport } : {}),
    });
    const coldRequests: string[] = [];
    cold.on('request', request => coldRequests.push(request.url()));
    try {
      const coldPage = await cold.newPage();
      await coldPage.goto(profile.url);
      await expect(coldPage.locator('[data-preview-hydrated=true]').first()).toBeAttached();
      await expect(coldPage.locator(`[data-profile=${name}]`).first()).toBeAttached();
      let adaptive: { surface: string | null; shortHeight: string | null } | null = null;
      if (name === 'tv') {
        const adaptiveRoot = coldPage.locator('.genux-demo[data-adaptive-short-height]').first();
        await expect(adaptiveRoot).toHaveAttribute('data-adaptive-surface', 'living-room');
        await expect(adaptiveRoot).toHaveAttribute('data-adaptive-short-height', 'false');
        adaptive = {
          surface: await adaptiveRoot.getAttribute('data-adaptive-surface'),
          shortHeight: await adaptiveRoot.getAttribute('data-adaptive-short-height'),
        };
        // The living-room controller must be requested and own the native Workspace field; a
        // pointer focus followed by one real ArrowDown moves focus spatially to another owned
        // control inside the TV root and switches the central modality to keyboard.
        await expect
          .poll(() => coldRequests.some(url => new URL(url).pathname === livingRoomEntry))
          .toBe(true);
        const workspace = adaptiveRoot.getByRole('textbox', {
          name: 'Workspace name',
          exact: true,
        });
        await expect(workspace).toHaveAttribute('data-spatial-target', 'living-room');
        const documentRoot = coldPage.locator('html');
        const workspaceHandle = await workspace.elementHandle();
        const rootHandle = await adaptiveRoot.elementHandle();
        await workspace.click();
        await expect(workspace).toBeFocused();
        await expect(documentRoot).toHaveAttribute('data-input-modality', 'pointer');
        await coldPage.keyboard.press('ArrowDown');
        await expect
          .poll(() =>
            coldPage.evaluate(
              ([field, tvRoot]) => {
                const active = document.activeElement;
                return {
                  moved: active !== null && active !== field,
                  inside: active !== null && tvRoot !== null && tvRoot.contains(active),
                  target: active?.getAttribute('data-spatial-target') ?? null,
                };
              },
              [workspaceHandle, rootHandle],
            ),
          )
          .toEqual({ moved: true, inside: true, target: 'living-room' });
        await expect(documentRoot).toHaveAttribute('data-input-modality', 'keyboard');
      }
      await expect(coldPage.locator('iframe')).toHaveCount(0);
      const requested = new Set(coldRequests.map(url => new URL(url).pathname));
      await test.info().attach(`cold-${name}-delivery.json`, {
        body: JSON.stringify(
          {
            baseURL,
            cache: { context: 'fresh', serviceWorkers: 'block' },
            hostViewport,
            adaptive,
            profile,
            otherRoots,
            livingRoomEntry,
            requests: coldRequests,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });
      expect(required.filter(url => !requested.has(url))).toEqual([]);
      expect(otherRoots.filter(url => requested.has(url))).toEqual([]);
      // Only the TV profile may load the living-room controller.
      expect(requested.has(livingRoomEntry)).toBe(name === 'tv');
    } finally {
      await cold.close();
    }
  }

  // The generated Code entry also mounts as an explicit client-rendered (CSR) island on an
  // ordinary docs route. The standalone route renders its preloaded demo without a Suspense
  // boundary, so its SSR markup is not the embedded tree and this fixture claims no embedded SSR
  // hydration. It keeps the selected standalone page's own emitted island, assets and allowlisted
  // props, removes only the internal standalone prop, and switches only that island to Astro's
  // installed client:only contract: the only client mode, the ssr marker the React renderer
  // requires and no server children, so the embed loads its demo through React.lazy. It is served
  // from a non-/preview/ URL whose host html keeps its own opposite theme.
  const entryProfile = resources.profiles.small;
  const standalone = await page.request.get(new URL(entryProfile.url, baseURL).href);
  expect(standalone.ok()).toBe(true);
  const fixture = await page.evaluate(
    html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const islands = Array.from(doc.querySelectorAll('astro-island'));
      // Read the emitted theme before the CSR island's server children are cleared.
      const previewTheme =
        doc.querySelector('[data-preview-document]')?.getAttribute('data-theme') ?? '';
      const removed: string[] = [];
      const cleared: number[] = [];
      for (const island of islands) {
        const props = JSON.parse(island.getAttribute('props') ?? '{}') as Record<string, unknown>;
        if (!('standalone' in props)) continue;
        delete props.standalone;
        island.setAttribute('props', JSON.stringify(props));
        // CSR: client:only renders through createRoot and keeps the ssr marker until it mounts.
        island.setAttribute('client', 'only');
        island.removeAttribute('await-children');
        cleared.push(island.querySelectorAll('[data-preview-document]').length);
        island.replaceChildren();
        // An ordinary docs page already owns its main landmark, so the embed is served inside it.
        const hostMain = doc.createElement('main');
        hostMain.id = 'code-host-main';
        island.replaceWith(hostMain);
        hostMain.append(island);
        removed.push(island.getAttribute('component-url') ?? '');
      }
      // A page inlines only the directives it uses, so add the installed client:only directive
      // (astro/dist/runtime/client/only.js) the way Astro inlines a directive.
      const only = doc.createElement('script');
      only.textContent = `(self.Astro||(self.Astro={})).only=async load=>{await (await load())()};dispatchEvent(new Event('astro:only'));`;
      doc.head.append(only);
      // The standalone body marks the memory-only preview document (data-preview-body and the
      // live-preview class); an ordinary docs host carries neither, so drop only those markers.
      const standaloneBody = {
        previewBody: doc.body.hasAttribute('data-preview-body'),
        livePreview: doc.body.classList.contains('live-preview'),
      };
      doc.body.removeAttribute('data-preview-body');
      doc.body.classList.remove('live-preview');
      if (doc.body.classList.length === 0) doc.body.removeAttribute('class');
      const hostTheme = previewTheme === 'dark' ? 'light' : 'dark';
      doc.documentElement.setAttribute('data-theme', hostTheme);
      return {
        html: `<!doctype html>${doc.documentElement.outerHTML}`,
        islands: islands.map(island => island.getAttribute('component-url') ?? ''),
        removed,
        cleared,
        previewTheme,
        hostTheme,
        hostStyle: doc.documentElement.getAttribute('style'),
        standaloneBody,
        hostBody: {
          previewBody: doc.body.hasAttribute('data-preview-body'),
          classes: Array.from(doc.body.classList),
        },
      };
    },
    await standalone.text(),
  );
  expect(fixture.islands.length).toBeGreaterThan(0);
  expect(fixture.removed).toHaveLength(1);
  // The standalone SSR route emitted its preview document; only this CSR host clears it.
  expect(fixture.cleared).toEqual([1]);
  expect(fixture.previewTheme).toMatch(/^(light|dark)$/);
  // The standalone route is the memory-only preview body; the ordinary host must not be.
  expect(fixture.standaloneBody).toEqual({ previewBody: true, livePreview: true });
  expect(fixture.hostBody.previewBody).toBe(false);
  expect(fixture.hostBody.classes).not.toContain('live-preview');
  expect(entryProfile.entries.some(url => fixture.islands.includes(url))).toBe(true);
  const fixtureBase = new URL(baseURL!);
  if (!fixtureBase.pathname.endsWith('/')) fixtureBase.pathname += '/';
  const fixtureURL = new URL('code-example-fixture/', fixtureBase).href;
  expect(new URL(fixtureURL).pathname).not.toContain('/preview/');
  const host = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
    viewport: { width: 402, height: 874 },
  });
  const hostErrors: string[] = [];
  const hostRequests: string[] = [];
  host.on('request', request => hostRequests.push(request.url()));
  try {
    await host.route(fixtureURL, route =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture.html }),
    );
    const hostPage = await host.newPage();
    hostPage.on('console', message => {
      if (message.type() === 'error') hostErrors.push(message.text());
    });
    hostPage.on('pageerror', error => hostErrors.push(error.message));
    await hostPage.goto(fixtureURL);
    expect(new URL(hostPage.url()).pathname).toBe(new URL(fixtureURL).pathname);
    const hostDocument = hostPage.locator('[data-preview-document]');
    await expect(hostDocument).toHaveCount(1);
    await expect(hostDocument).toHaveAttribute('data-profile', 'small');
    await expect(hostPage.locator('[data-preview-hydrated=true]')).toHaveCount(1);
    await expect(hostDocument).toHaveAttribute('data-preview-hydrated', 'true');
    // The embed sits inside the host page's existing main and adds no landmark of its own.
    await expect(hostPage.locator('main')).toHaveCount(1);
    await expect(hostPage.locator('main#code-host-main')).toHaveCount(1);
    await expect(hostPage.locator('main main')).toHaveCount(0);
    await expect(hostPage.locator('main#code-host-main [data-preview-document]')).toHaveCount(1);
    // The CSR island completed Astro's client:only mount, so it dropped its ssr marker.
    await expect(hostPage.locator('astro-island[client=only]:not([ssr])')).toHaveCount(1);
    await expect(hostDocument.getByRole('textbox', { name: /workspace name/i })).toBeEditable();
    await expect(hostDocument).toHaveAttribute('data-theme', fixture.previewTheme);
    await expect(hostPage.locator('html')).toHaveAttribute('data-theme', fixture.hostTheme);
    expect(await hostPage.evaluate(() => document.documentElement.getAttribute('style'))).toBe(
      fixture.hostStyle,
    );
    // Embedded Tweaker isolation: the native Input demo renders the one Tweaker trigger. Its
    // corner edit and reset own only this preview document; the ordinary host keeps its theme
    // globals and stored builder state. The two overlay roles are host overlay plumbing.
    const readHostTheme = () =>
      hostPage.evaluate(() => {
        const overlayRoles = new Set(['--genux-overlay-clip', '--genux-overlay-active-z']);
        const declarations = (element: HTMLElement) =>
          Array.from(element.style)
            .filter(name => !overlayRoles.has(name))
            .sort()
            .map(name => ({
              name,
              value: element.style.getPropertyValue(name),
              priority: element.style.getPropertyPriority(name),
            }));
        return {
          html: declarations(document.documentElement),
          body: declarations(document.body),
          stored: localStorage.getItem('genux-theme-builder-v1'),
        };
      });
    const readOwnRadius = () =>
      hostDocument.evaluate((root: HTMLElement) => {
        const computed = getComputedStyle(root);
        const names = new Set(['--radius', '--radius-md']);
        for (const name of Array.from(root.style)) if (name.startsWith('--radius')) names.add(name);
        return Object.fromEntries(
          [...names].sort().map(name => [name, computed.getPropertyValue(name).trim()]),
        ) as Record<string, string>;
      });
    const hostThemeBefore = await readHostTheme();
    const ownRadiusBefore = await readOwnRadius();
    // Compare the canonical owned radius roles at the 5px default, not the whole own style.
    const ownRadiusRoles = Object.keys(ownRadiusBefore).filter(
      name => ownRadiusBefore[name] === '5px',
    );
    expect(ownRadiusRoles).toContain('--radius');
    const ownRadius = async () => {
      const radius = await readOwnRadius();
      return ownRadiusRoles.map(name => radius[name]);
    };
    const trigger = hostPage.locator('.genux-tweaker-trigger');
    await expect(trigger).toHaveCount(1);
    await trigger.click();
    const editors = hostPage.locator('[data-theme-token-editors]');
    await expect(editors).toBeVisible();
    await editors
      .getByRole('combobox', { name: /radius|corner/i })
      .first()
      .click();
    await hostPage.locator('.ant-select-item-option[title="3px"]:visible').click();
    await expect.poll(ownRadius).toEqual(ownRadiusRoles.map(() => '3px'));
    expect(await readHostTheme()).toEqual(hostThemeBefore);
    await hostPage.getByRole('button', { name: /reset theme/i }).click();
    await expect.poll(ownRadius).toEqual(ownRadiusRoles.map(name => ownRadiusBefore[name]));
    expect(await readHostTheme()).toEqual(hostThemeBefore);
    await expect(hostDocument).toHaveAttribute('data-theme', fixture.previewTheme);
    await hostPage.keyboard.press('Escape');
    await expect(editors).toBeHidden();
    await expect(hostPage.locator('iframe')).toHaveCount(0);
    const hostRequested = new Set(hostRequests.map(url => new URL(url).pathname));
    const hostRequired = [...entryProfile.js, ...entryProfile.stylesheets].map(
      resource => resource.url,
    );
    await test.info().attach('code-entry-ordinary-route.json', {
      body: JSON.stringify(
        {
          fixtureURL,
          islands: fixture.islands,
          removed: fixture.removed,
          previewTheme: fixture.previewTheme,
          hostTheme: fixture.hostTheme,
          errors: hostErrors,
          requests: hostRequests,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    expect(hostRequired.filter(url => !hostRequested.has(url))).toEqual([]);
    expect(hostErrors).toEqual([]);
  } finally {
    await host.close();
  }
});
