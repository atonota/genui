import { expect, test, type Locator, type Page } from '@playwright/test';
import genux from '../src/data/genux.json' with { type: 'json' };
import motion from '../src/data/motion.json' with { type: 'json' };

// These are future browser acceptance contracts for the Astro documentation.
// No legacy Downloads HTML, baseline approval or snapshot update belongs here.
const slugs = [
  'button',
  'input',
  'select',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'accordion',
  'card',
  'splitter',
  'breadcrumb',
  'dropdown',
  'pagination',
  'steps',
  'autocomplete',
  'cascader',
  'form',
  'drawer',
  'data-table',
  'collection-views',
  'record-details',
  'record-forms',
  'record-workspace',
];

test('documentation uses exact blue and readable foreground in both themes before and after hydration', async ({
  page,
}) => {
  await page.goto('/');
  const action = page.locator('.docs-action');
  for (const mode of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== mode)
      await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
    await page.mouse.move(0, 0);
    await expect
      .poll(() => action.evaluate(node => getComputedStyle(node).backgroundColor))
      .toBe('rgb(0, 153, 255)');
    expect(await action.evaluate(node => getComputedStyle(node).color)).toBe('rgb(0, 0, 0)');
    expect(await action.evaluate(node => getComputedStyle(node).opacity)).toBe('1');
  }
  await visit(page, 'form');
  const button = page
    .locator(
      '.genux-button[data-docs-brand-default="true"][data-docs-brand-tone="middle"][data-fill="solid"]:not([disabled])',
    )
    .first();
  await page.mouse.move(0, 0);
  await expect
    .poll(() => button.evaluate(node => getComputedStyle(node, '::before').backgroundColor))
    .toBe('rgb(0, 153, 255)');
  expect(await button.evaluate(node => getComputedStyle(node).opacity)).toBe('1');
  await page.setViewportSize({ width: 320, height: 640 });
  await assertReadableLayout(page);
  await visit(page, 'drawer');
  await page.getByRole('button', { name: 'Open panel', exact: true }).click();
  const portalAction = page
    .getByRole('dialog')
    .getByRole('button', { name: 'Validate locally', exact: true });
  await page.mouse.move(0, 0);
  await expect
    .poll(() => portalAction.evaluate(node => getComputedStyle(node, '::before').backgroundColor))
    .toBe('rgb(0, 153, 255)');
  expect(await portalAction.evaluate(node => getComputedStyle(node).color)).toBe('rgb(0, 0, 0)');
  expect(await portalAction.evaluate(node => getComputedStyle(node).opacity)).toBe('1');
  await page.keyboard.press('Escape');
});

test('portable inspector preserves relation return trail and exposes one native overlay', async ({
  page,
}) => {
  await visit(page, 'record-workspace');
  const example = page.locator('.kit-panel-example');
  await example.getByRole('button', { name: 'Reopen current inspector', exact: true }).click();
  const record = page.locator('[data-panel-record]').first();
  const originalId = await record.getAttribute('data-panel-record');
  await example.getByRole('button', { name: 'Open related equipment', exact: true }).click();
  await expect(record).not.toHaveAttribute('data-panel-record', originalId ?? '');
  await example
    .getByRole('button', { name: /^Return to / })
    .first()
    .click();
  await expect(record).toHaveAttribute('data-panel-record', originalId ?? '');
  for (const mode of ['Modal', 'Drawer']) {
    await example.locator('.kit-panel-control').getByRole('combobox').click();
    await page.getByRole('option', { name: mode, exact: true }).click();
    const reopen = example.getByRole('button', { name: 'Reopen current inspector', exact: true });
    if (await reopen.isEnabled()) await reopen.click();
    const dialog = page.locator('.kit-record-panel-overlay [role="dialog"]');
    await expect(dialog).toHaveCount(1);
    await expect(dialog.locator('[data-panel-record]')).toHaveAttribute(
      'data-panel-record',
      originalId ?? '',
    );
    await page.setViewportSize({ width: 320, height: 320 });
    const close = dialog.getByRole('button', { name: 'Close inspector at end', exact: true });
    await close.scrollIntoViewIfNeeded();
    await close.click();
    await expect(dialog).toHaveCount(0);
    await example.getByRole('button', { name: 'Reopen current inspector', exact: true }).click();
    await expect(dialog).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});

test('connected workspace retains drafts across layout changes and commits one stable record identity', async ({
  page,
}) => {
  await visit(page, 'record-workspace');
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  const form = page.locator('[data-kit-form]');
  const recordId = await form.getAttribute('data-kit-form');
  const title = form.getByLabel(/^Title/);
  await title.fill('Retained workspace draft');
  await form.getByLabel(/^Customer/).fill('Example customer');
  await page.getByRole('button', { name: 'Desktop example', exact: true }).click();
  await expect(title).toHaveValue('Retained workspace draft');
  for (const width of [320, 360, 375, 390, 568, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 568 ? 320 : 800 });
    await assertReadableLayout(page);
    await expect(title).toHaveValue('Retained workspace draft');
  }
  await page.getByRole('button', { name: 'Mobile example', exact: true }).click();
  await form.getByRole('button', { name: 'Commit draft', exact: true }).click();
  await expect(form).toHaveCount(0);
  const display = page.locator('[data-kit-display]');
  await expect(display).toHaveAttribute('data-kit-display', recordId ?? '');
  await expect(display).toContainText('Retained workspace draft');
  await expect(page.locator('.kit-collection')).toContainText(recordId ?? '');
  await page.getByRole('button', { name: 'Turkish', exact: true }).click();
  await expect(display).toContainText('Retained workspace draft');
  await expect(display).toHaveAttribute('data-kit-display', recordId ?? '');
});

test('Slider shares Radio thumb size and preserves numeric, range, vertical and reverse keyboard behavior', async ({
  page,
}) => {
  await visit(page, 'radio');
  const radioSize = await page
    .locator('.ant-radio')
    .first()
    .evaluate(node => node.getBoundingClientRect().width);
  await visit(page, 'slider');
  const integer = page.getByRole('spinbutton', { name: 'Integer value', exact: true });
  const handle = page.getByRole('slider', { name: 'Integer value', exact: true });
  await integer.fill('11');
  await expect(handle).toHaveAttribute('aria-valuenow', '11');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(integer).toHaveValue('12');
  await page.keyboard.press('Home');
  await expect(integer).toHaveValue('1');
  await page.keyboard.press('End');
  await expect(integer).toHaveValue('20');
  expect(
    await handle.evaluate(node => parseFloat(getComputedStyle(node, '::after').width)),
  ).toBeCloseTo(
    await page.evaluate(
      size => (matchMedia('(any-pointer: coarse)').matches ? Math.max(44, size) : size),
      radioSize,
    ),
    1,
  );
  const box = await handle.boundingBox();
  await handle.hover();
  const hovered = await handle.boundingBox();
  expect(hovered!.width).toBeCloseTo(box!.width, 1);
  expect(hovered!.height).toBeCloseTo(box!.height, 1);
  expect(await handle.evaluate(node => getComputedStyle(node, '::after').boxShadow)).toBe('none');
  const decimal = page.getByRole('spinbutton', { name: 'Decimal value', exact: true });
  await decimal.fill('0.47');
  await expect(page.getByRole('slider', { name: 'Decimal value', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '0.47',
  );
  const lower = page.getByRole('slider', { name: 'Range start', exact: true });
  const upper = page.getByRole('slider', { name: 'Range end', exact: true });
  const upperValue = await upper.getAttribute('aria-valuenow');
  await lower.focus();
  await page.keyboard.press('ArrowRight');
  await expect(upper).toHaveAttribute('aria-valuenow', upperValue!);
  await expect(page.getByRole('slider', { name: 'Vertical value', exact: true })).toHaveAttribute(
    'aria-orientation',
    'vertical',
  );
  const reversed = page.getByRole('slider', { name: 'Reversed value', exact: true });
  const reverseValue = await reversed.getAttribute('aria-valuenow');
  await reversed.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(reversed).toHaveAttribute('aria-valuenow', String(Number(reverseValue) + 1));
  await page.keyboard.press('ArrowRight');
  await expect(reversed).toHaveAttribute('aria-valuenow', reverseValue!);
  for (const width of [320, 360, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await assertReadableLayout(page);
    await expect(decimal).toHaveValue('0.47');
  }
  await page.getByRole('button', { name: 'Turkish', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Ondalık değer', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '0.47',
  );
});

test('Color controls retain two equal preset rows, equal method halves and taller boundary-marked ramps', async ({
  page,
}) => {
  await page.goto('/color-system/');
  await page.locator('astro-island[ssr]').waitFor({ state: 'detached' });
  const methods = page.locator('.color-method .ant-segmented-item');
  const viewport = page.locator('.color-presets-viewport');
  const presets = viewport.locator('.color-preset');
  await expect(methods.first()).toHaveText('Color presets');
  await page.getByRole('radio', { name: 'Color presets', exact: true }).check();
  for (const width of [320, 360, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(viewport).toBeVisible();
    const geometry = await presets.evaluateAll(nodes =>
      nodes.map(node => {
        const { width, height, top } = node.getBoundingClientRect();
        return { width, height, top: Math.round(top) };
      }),
    );
    const rows = await page
      .locator('.color-presets')
      .evaluate(node => Number(getComputedStyle(node).getPropertyValue('--color-preset-rows')));
    expect(new Set(geometry.map(item => item.top)).size).toBe(rows);
    expect(await viewport.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(
      await viewport.evaluate(node => node.clientWidth + 1),
    );
    for (const item of geometry) {
      expect(item.width).toBeCloseTo(geometry[0].width, 1);
      expect(item.height).toBeCloseTo(geometry[0].height, 1);
    }
    const sizes = await methods.evaluateAll(nodes =>
      nodes.map(node => node.getBoundingClientRect().width),
    );
    expect(sizes[0]).toBeCloseTo(sizes[1], 1);
    const methodWidth = await page
      .locator('.color-method')
      .evaluate(node => node.getBoundingClientRect().width);
    expect(methodWidth).toBeCloseTo(
      await page.locator('.color-controls').evaluate(node => node.getBoundingClientRect().width),
      1,
    );
    await assertReadableLayout(page);
  }
  await presets.last().locator('input').focus();
  await expect(presets.last().locator('input')).toBeFocused();
  expect(await viewport.evaluate(node => node.scrollLeft)).toBe(0);
  await page.getByRole('radio', { name: 'Detailed selection', exact: true }).check();
  for (const spectrum of await page.locator('.color-spectrum').all()) {
    await expect(spectrum.locator('span')).toHaveCount(41);
    expect(await spectrum.evaluate(node => node.getBoundingClientRect().height)).toBeCloseTo(36);
  }
  expect(
    await page
      .locator('.color-composition-strip')
      .evaluate(node => node.getBoundingClientRect().height),
  ).toBeCloseTo(48);
  await page.getByRole('spinbutton', { name: 'Whiteness · percent', exact: true }).fill('10');
  await page.getByRole('spinbutton', { name: 'Blackness · percent', exact: true }).fill('0.1');
  await expect(
    page.locator('.color-composition-marker[data-boundary="white-end"]'),
  ).toHaveAttribute('data-position', '99.9');
  for (const marker of await page.locator('.color-composition-marker').all()) {
    const markerBox = await marker.boundingBox();
    const stripBox = await page.locator('.color-composition-strip').boundingBox();
    expect(markerBox!.y + markerBox!.height).toBeLessThanOrEqual(stripBox!.y);
    expect(markerBox!.x).toBeGreaterThanOrEqual(stripBox!.x - 1);
    expect(markerBox!.x + markerBox!.width).toBeLessThanOrEqual(stripBox!.x + stripBox!.width + 1);
  }
});

test('Color system preserves its seed and draft while dynamic tokens and narrow layout adapt', async ({
  page,
}) => {
  const response = await page.goto('/color-system/');
  expect(response?.status()).toBe(200);
  await page.locator('astro-island[ssr]').waitFor({ state: 'detached' });
  await page.evaluate(() => document.fonts.ready);
  const name = page.getByRole('textbox', { name: 'Workspace name', exact: true });
  await name.fill('Retained color draft');
  const seed = page.locator('[data-color-seed]');
  const initial = await seed.innerText();
  await page.getByRole('radio', { name: 'Color presets', exact: true }).check();
  await expect(seed).toHaveText(initial);
  await page.locator('.color-presets input[value="red-repeat"]').check();
  await expect(seed).toHaveText('#E01F1F');
  await expect(page.locator('.color-presets input:checked')).toHaveCount(1);
  await page.getByRole('radio', { name: 'Detailed selection', exact: true }).check();
  const action = page.getByRole('button', { name: 'Preview action', exact: true });
  const before = await action.evaluate(node => getComputedStyle(node, '::before').backgroundColor);
  await page.getByRole('spinbutton', { name: 'Main hue · degrees', exact: true }).fill('180');
  await name.focus();
  await expect
    .poll(() => action.evaluate(node => getComputedStyle(node, '::before').backgroundColor))
    .not.toBe(before);
  const selected = await seed.innerText();
  await expect(page.locator('[data-color-hex]')).toHaveText(selected);
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(seed).toHaveText(selected);
  await expect(name).toHaveValue('Retained color draft');
  for (const width of [320, 360, 375, 390, 568, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 568 ? 320 : 800 });
    await assertReadableLayout(page);
    await expect(name).toHaveValue('Retained color draft');
    await expect(seed).toHaveText(selected);
  }
  const slider = page.getByRole('slider', { name: 'Main hue · degrees', exact: true });
  await keyboardFocus(page, slider);
  expect(await slider.evaluate(node => getComputedStyle(node, '::after').boxShadow)).toBe('none');
  await page.getByRole('button', { name: 'Turkish', exact: true }).click();
  await expect(seed).toHaveText(selected);
  await expect(name).toHaveValue('Retained color draft');
});

async function visit(page: Page, slug: string) {
  const response = await page.goto(`/components/${slug}/`);
  expect(response?.status()).toBe(200);
  await page.locator('astro-island').first().waitFor({ state: 'attached' });
  await page.locator('astro-island[ssr]').waitFor({ state: 'detached' });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('#examples .genux-demo').first()).toBeVisible();
}

async function choose(page: Page, field: Locator, label: string) {
  await field.click();
  const popup = page.locator('.ant-select-dropdown:visible');
  await expect(popup).toHaveCount(1);
  // rc-select virtualizes long lists and renders a separate hidden ARIA mirror.
  // Follow the actual visible active option; ArrowDown scrolls/render-wraps it.
  const active = popup.locator('.ant-select-item-option-active:visible');
  const visited = new Set<string>();
  for (let step = 0; step < 64; step++) {
    await expect(active).toHaveCount(1);
    const current = (await active.innerText()).trim();
    if (current === label) {
      await field.press('Enter');
      await expect(popup).toHaveCount(0);
      return;
    }
    if (visited.has(current)) break;
    visited.add(current);
    await field.press('ArrowDown');
    await expect(active).not.toHaveText(current);
  }
  throw new Error(
    `No enabled option “${label}” in the visible list; visited ${[...visited].join(', ')}`,
  );
}

async function assertReadableLayout(page: Page) {
  const violations = await page.evaluate(() => {
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const failures: string[] = [];
    if (rootSize < 16) failures.push(`Root font reduced to ${rootSize}px`);
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      failures.push(
        `Page overflow: ${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`,
      );
    }
    for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
      if (element.closest('style, script, template, noscript, svg, [hidden], [aria-hidden="true"]'))
        continue;
      const style = getComputedStyle(element);
      if (
        !element.getClientRects().length ||
        style.visibility === 'hidden' ||
        style.opacity === '0'
      )
        continue;
      const readable =
        [...element.childNodes].some(
          node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        ) || element.matches('input, textarea');
      if (readable && parseFloat(style.fontSize) + 0.01 < 14) {
        failures.push(
          `${element.tagName}.${element.className}: ${style.fontSize} (${element.textContent?.trim().slice(0, 45)})`,
        );
      }
    }
    return failures;
  });
  expect(violations).toEqual([]);
}

async function keyboardFocus(page: Page, element: Locator) {
  await element.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(element).toBeFocused();
  expect(await element.evaluate(node => node.matches(':focus-visible'))).toBe(true);
}

async function fieldAppearance(field: Locator) {
  return field.evaluate(element => {
    const owner =
      element.closest('.ant-input-affix-wrapper, .ant-input-number, .ant-select') || element;
    const style = getComputedStyle(owner);
    const target = getComputedStyle(element);
    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
    return {
      border: Object.fromEntries(
        sides.map(side => [
          side,
          {
            color: style[`border${side}Color`],
            width: style[`border${side}Width`],
            style: style[`border${side}Style`],
          },
        ]),
      ),
      outlineWidth: style.outlineWidth,
      outlineStyle: style.outlineStyle,
      shadow: style.boxShadow,
      targetOutlineWidth: target.outlineWidth,
      targetOutlineStyle: target.outlineStyle,
      targetShadow: target.boxShadow,
    };
  });
}

async function fieldGeometry(field: Locator) {
  return field.evaluate(element => {
    const owner =
      element.closest('.ant-input-affix-wrapper, .ant-input-number, .ant-select') || element;
    const style = getComputedStyle(owner);
    const rect = owner.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      boxSizing: style.boxSizing,
      edges: ['Top', 'Right', 'Bottom', 'Left'].map(side => {
        const edge = side as 'Top' | 'Right' | 'Bottom' | 'Left';
        return [style[`border${edge}Width`], style[`border${edge}Style`], style[`padding${edge}`]];
      }),
    };
  });
}

function hasPaintedShadow(value: string) {
  if (value === 'none') return false;
  return value.split(/,(?![^()]*\))/).some(shadow => {
    if (/rgba\([^)]*,\s*0(?:\.0+)?\)/.test(shadow) || shadow.includes('transparent')) return false;
    const lengths = shadow.replace(/rgba?\([^)]*\)/g, '').match(/-?\d*\.?\d+px/g) || [];
    return lengths.some(length => parseFloat(length) !== 0);
  });
}

function expectNoRing(appearance: Awaited<ReturnType<typeof fieldAppearance>>) {
  expect(parseFloat(appearance.outlineWidth) === 0 || appearance.outlineStyle === 'none').toBe(
    true,
  );
  expect(
    parseFloat(appearance.targetOutlineWidth) === 0 || appearance.targetOutlineStyle === 'none',
  ).toBe(true);
  expect(hasPaintedShadow(appearance.shadow)).toBe(false);
  expect(hasPaintedShadow(appearance.targetShadow)).toBe(false);
}

async function assertFieldFocus(page: Page, field: Locator) {
  await page.locator('h1').click();
  const resting = await fieldAppearance(field);
  await field.click();
  expectNoRing(await fieldAppearance(field));
  await keyboardFocus(page, field);
  const focused = await fieldAppearance(field);
  expectNoRing(focused);
  for (const side of ['Top', 'Right', 'Left']) {
    expect(focused.border[side], `Focus changed ${side} surrounding border`).toEqual(
      resting.border[side],
    );
  }
  expect(parseFloat(focused.border.Bottom.width)).toBeGreaterThanOrEqual(2);
  expect(focused.border.Bottom.style).toBe('solid');
  expect(focused.border.Bottom.color).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
  expect(focused.border.Bottom.color).not.toBe(resting.border.Bottom.color);
}

async function assertIconFocus(page: Page, icon: Locator) {
  expect(await icon.evaluate(node => (node as HTMLElement).tabIndex)).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Tab');
  await icon.focus();
  await expect(icon).toBeFocused();
  const evidence = await icon.evaluate(element => {
    const owner = getComputedStyle(element);
    const parts = [element, element.querySelector('.ant-btn-icon')].filter(Boolean) as Element[];
    const markers = parts.map(part => {
      const style = getComputedStyle(part, '::after');
      return {
        content: style.content,
        height: parseFloat(style.height),
        background: style.backgroundColor,
        top: style.top,
        border: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ],
        shadow: style.boxShadow,
      };
    });
    return {
      visible: element.matches(':focus-visible'),
      outline: owner.outlineStyle,
      outlineWidth: parseFloat(owner.outlineWidth),
      shadow: owner.boxShadow,
      markers,
    };
  });
  expect(evidence.visible).toBe(true);
  expect(evidence.outlineWidth === 0 || evidence.outline === 'none').toBe(true);
  expect(hasPaintedShadow(evidence.shadow)).toBe(false);
  const marker = evidence.markers.find(
    item =>
      item.content !== 'none' &&
      item.content !== 'normal' &&
      item.height >= 2 &&
      item.height <= 6 &&
      item.background !== 'rgba(0, 0, 0, 0)' &&
      item.background !== 'transparent',
  );
  expect(marker, 'Icon-only control needs a visible single-edge marker').toBeTruthy();
  expect(marker!.border.every(width => parseFloat(width) === 0)).toBe(true);
  expect(marker!.shadow).toBe('none');
}

async function documentRect(element: Locator) {
  return element.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
  });
}

function expectFixedRect(
  actual: Awaited<ReturnType<typeof documentRect>>,
  expected: Awaited<ReturnType<typeof documentRect>>,
) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key]), `${key} moved`).toBeLessThanOrEqual(0.25);
  }
}

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const path = info.outputPath('candidate-failure.png');
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach('candidate-failure', { path, contentType: 'image/png' });
});

for (const slug of slugs) {
  test(`${slug}: 320px readable text and contained page width`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await visit(page, slug);
    await assertReadableLayout(page);
    await expect(page.locator('h1')).toHaveCount(1);
    const table = page.locator('#api .table-scroll[role="region"]');
    await expect(table).toBeVisible();
    const scroll = await table.evaluate(element => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(scroll.scroll).toBeGreaterThan(scroll.client);
    await keyboardFocus(page, table);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  });
}

test('Button catalog navigation preserves preview drafts and keyboard access in both themes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await visit(page, 'button');
  const catalog = page.locator('[data-button-catalog]');
  await expect(catalog.locator(':scope > section > header > h3')).toHaveText([
    'Playground',
    'Action patterns',
    'Surfaces and states',
    'Size and shape',
    'Color and depth',
  ]);
  await expect(catalog.locator('[data-approved-axis="palette"]')).toHaveCount(24);
  const trigger = page.getByRole('button', { name: 'Open tweaker', exact: true });
  await trigger.click();
  await page.getByRole('textbox', { name: 'Text', exact: true }).fill('Retained button draft');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  const preview = catalog.locator('.playground-preview .genux-button');
  for (const mode of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== mode)
      await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(preview).toHaveText('Retained button draft');
      await assertReadableLayout(page);
      const navigation = catalog.getByRole('navigation', { name: 'Button example sections' });
      const actions = navigation.getByRole('link', { name: 'Action patterns', exact: true });
      await keyboardFocus(page, actions);
      await actions.press('Enter');
      await expect(page).toHaveURL(/#button-actions$/);
      await page.keyboard.press('Tab');
      const decrease = catalog.getByRole('button', { name: 'Decrease', exact: true });
      await expect(decrease).toBeFocused();
      const focus = await decrease.evaluate(node => {
        const owner = getComputedStyle(node);
        const content = node.querySelector('.genux-button-content');
        if (!content) throw new Error('Icon action is missing the shared content/focus layer');
        const marker = getComputedStyle(content, '::after');
        return {
          visible: node.matches(':focus-visible'),
          outline: owner.outlineStyle,
          shadow: owner.boxShadow,
          markerHeight: parseFloat(marker.height),
          markerWidth: parseFloat(marker.width),
          markerOpacity: parseFloat(marker.opacity),
          markerColor: marker.backgroundColor,
        };
      });
      expect(focus.visible).toBe(true);
      expect(focus.outline).toBe('none');
      expect(hasPaintedShadow(focus.shadow)).toBe(false);
      expect(focus.markerHeight).toBeGreaterThanOrEqual(3);
      expect(focus.markerHeight).toBeLessThanOrEqual(6);
      expect(focus.markerWidth).toBeGreaterThan(0);
      expect(focus.markerOpacity).toBeGreaterThan(0);
      expect(focus.markerColor).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
    }
  }
});

test('Data entry example sections stay readable and retain drafts through theme and width changes', async ({
  page,
}) => {
  for (const slug of ['input', 'select', 'checkbox', 'radio', 'switch', 'slider', 'form']) {
    await page.setViewportSize({ width: 320, height: 800 });
    await visit(page, slug);
    const catalog = page.locator(`[data-entry-catalog="${slug}"]`);
    const links = catalog.locator(':scope > nav a');
    const sections = catalog.locator(':scope > section');
    await expect(catalog).toBeVisible();
    expect(await links.count()).toBe(await sections.count());
    const draft =
      slug === 'input'
        ? page.locator('#input-filled')
        : slug === 'form'
          ? page.locator('#profile-example_fullName')
          : null;
    if (draft) await draft.fill('Preserved example draft');
    const last = links.last();
    const target = await last.getAttribute('href');
    await last.click();
    expect(new URL(page.url()).hash).toBe(target);
    await expect(page.locator(target!)).toBeVisible();
    for (const mode of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== mode)
        await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await assertReadableLayout(page);
        if (draft) await expect(draft).toHaveValue('Preserved example draft');
      }
    }
    await keyboardFocus(page, links.first());
    await page.keyboard.press('Enter');
    expect(new URL(page.url()).hash).toBe(await links.first().getAttribute('href'));
  }
});

test('Responsive boundaries preserve edits and usable navigation', async ({ page }) => {
  await visit(page, 'button');
  await page.getByLabel('Text', { exact: true }).fill('Korunan kullanıcı girdisi');
  for (const width of [639, 640, 641, 991, 992, 993, 1279, 1280, 1281]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel('Text', { exact: true })).toHaveValue('Korunan kullanıcı girdisi');
    await expect(page.locator('.playground-preview .genux-button')).toHaveText(
      'Korunan kullanıcı girdisi',
    );
    await expect(page.locator('#navigation nav')).toBeVisible();
    await expect(page.locator('#component-search')).toBeVisible();
    await expect(page.locator('#navigation details, #navigation summary')).toHaveCount(0);
    await assertReadableLayout(page);
  }
});

test('Filled Input focus preserves frameless fields and error/warning borders without a surrounding ring', async ({
  page,
}) => {
  await visit(page, 'input');
  const resting = await fieldAppearance(page.locator('#input-filled'));
  for (const side of ['Top', 'Right', 'Bottom', 'Left'])
    expect(resting.border[side].color, `Normal filled Input ${side} border`).toMatch(
      /^(transparent|rgba\(0, 0, 0, 0\))$/,
    );
  for (const field of [
    page.locator('#input-filled'),
    page.getByLabel('Invalid value', { exact: true }),
    page.getByLabel('Needs review', { exact: true }),
  ])
    await assertFieldFocus(page, field);
  const themeSwitch = page.getByRole('switch', { name: 'Dark theme', exact: true });
  if ((await themeSwitch.getAttribute('aria-checked')) !== 'true') await themeSwitch.click();
  for (const id of ['error', 'warning']) {
    const field = page.locator(`#${id}`);
    await expect(field).toHaveCSS('border-bottom-width', '3px');
    await expect(field).not.toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)');
  }
});

test('Filled Select focus and popup preserve frameless fields and error/warning borders', async ({
  page,
}) => {
  await visit(page, 'select');
  // Record the reported searchable/open Select hover path, including transient frames.
  const searchable = page.locator('#select-single');
  await searchable.click();
  await expect(page.locator('.ant-select-dropdown:visible')).toBeVisible();
  const control = page.locator('.ant-select:has(#select-single)');
  const content = control.locator('.ant-select-content');
  await page.mouse.move(0, 0);
  const outerBox = await control.boundingBox();
  const contentBox = await content.boundingBox();
  expect(outerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  for (const inside of [true, false, true, false]) {
    await page.mouse.move(
      inside ? outerBox!.x + outerBox!.width / 2 : 0,
      inside ? outerBox!.y + outerBox!.height / 2 : 0,
    );
    for (const delay of [60, 180]) {
      await page.waitForTimeout(delay);
      expect(await control.boundingBox()).toEqual(outerBox);
      expect(await content.boundingBox()).toEqual(contentBox);
      const clearBox = await control.locator('.ant-select-clear').boundingBox();
      const suffixBox = await control.locator('.ant-select-suffix').boundingBox();
      expect(clearBox).toEqual(suffixBox);
      await expect(searchable).toHaveAttribute('aria-expanded', 'true');
    }
  }
  await searchable.press('Escape');
  const resting = await fieldAppearance(page.locator('#select-filled'));
  for (const side of ['Top', 'Right', 'Bottom', 'Left'])
    expect(resting.border[side].color, `Normal filled Select ${side} border`).toMatch(
      /^(transparent|rgba\(0, 0, 0, 0\))$/,
    );
  for (const id of ['select-filled', 'select-error', 'select-warning']) {
    const field = page.locator(`#${id}`);
    await assertFieldFocus(page, field);
    await field.press('ArrowDown');
    const popup = page.locator('.ant-select-dropdown:visible');
    await expect(popup).toBeVisible();
    await expect
      .poll(() =>
        page.locator('body').evaluate(body => getComputedStyle(body, '::before').backdropFilter),
      )
      .toBe('blur(1px)');
    await assertReadableLayout(page);
    await field.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect
      .poll(() =>
        page.locator('body').evaluate(body => getComputedStyle(body, '::before').backgroundColor),
      )
      .toBe('rgba(0, 0, 0, 0)');
  }
  await expect(page.locator('select')).toHaveCount(0);
});

test('Password, clear and search controls expose a single-edge icon focus marker', async ({
  page,
}) => {
  await visit(page, 'input');
  const clearInput = page.locator('#input-filled');
  await clearInput.fill('Silinecek metin');
  const clear = page
    .locator('.ant-input-affix-wrapper')
    .filter({ has: clearInput })
    .locator('.ant-input-clear-icon');
  await assertIconFocus(page, clear);
  await page.keyboard.press('Enter');
  await expect(clearInput).toHaveValue('');
  const password = page.locator('#input-password');
  await password.fill('Yerel örnek parola');
  const visibility = page
    .locator('.ant-input-affix-wrapper')
    .filter({ has: password })
    .locator('.ant-input-password-icon');
  await assertIconFocus(page, visibility);
  await page.keyboard.press('Space');
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Istanbul');
  const search = page.getByRole('button', { name: 'search', exact: true });
  await assertIconFocus(page, search);
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('status').filter({ hasText: 'Local search preview: Istanbul' }),
  ).toBeVisible();

  await visit(page, 'select');
  const singleSelect = page.locator('.ant-select').filter({ has: page.locator('#select-single') });
  const selectClear = singleSelect.locator('.ant-select-clear');
  await page.locator('#select-single').focus();
  await assertIconFocus(page, selectClear);
  await page.keyboard.press('Enter');
  await expect(singleSelect).not.toContainText('Design');
});

test('shared click feedback uses native Button paint and the committed Slider position', async ({
  page,
}) => {
  const aligned = async (handle: Locator) =>
    expect
      .poll(() =>
        handle.evaluate(node => {
          const overlay = document.querySelector('[data-genux-feedback="click"]');
          if (!overlay) return false;
          const actual = overlay.getBoundingClientRect(),
            expected = node.getBoundingClientRect();
          return (['left', 'top', 'width', 'height'] as const).every(
            key => Math.abs(actual[key] - expected[key]) < 0.5,
          );
        }),
      )
      .toBe(true);
  await page.goto('/color-system/');
  const action = page.locator('.color-preview-button');
  await action.click();
  const wave = page.locator('[data-genux-feedback="click"]');
  await action.click();
  await expect(wave).toHaveCount(1);
  const painted = await action.evaluate(node => getComputedStyle(node, '::before').backgroundColor);
  expect(await wave.evaluate(node => getComputedStyle(node).color)).toBe(painted);
  await visit(page, 'slider');
  const handle = page.getByRole('slider', { name: 'Integer value', exact: true });
  await handle.focus();
  await page.keyboard.press('End');
  await expect(handle).toHaveAttribute('aria-valuenow', '20');
  await expect(wave).toHaveCount(1);
  await aligned(handle);
  await page.keyboard.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '1');
  await expect(wave).toHaveCount(1);
  await aligned(handle);
  const start = page.getByRole('slider', { name: 'Range start', exact: true });
  const end = page.getByRole('slider', { name: 'Range end', exact: true });
  for (const [target, key, focused, value] of [
    [start, 'End', end, '100'],
    [end, 'Home', start, '0'],
  ] as const) {
    await target.focus();
    await page.keyboard.press(key);
    await expect(focused).toBeFocused();
    await expect(focused).toHaveAttribute('aria-valuenow', value);
    await expect(wave).toHaveCount(1);
    await aligned(focused);
  }
});

test('Quantity actions stay flat and borderless through profile changes and pressing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await visit(page, 'input');
  const stepper = page.locator('.genux-number-stepper').first();
  const action = stepper.getByRole('button', { name: 'Increase', exact: true });
  for (const mode of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== mode)
      await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
    for (const [index, height] of [48, 56, 64].entries()) {
      await page.getByRole('button', { name: 'Open tweaker', exact: true }).click();
      await page.locator('.genux-size-options .ant-segmented-item').nth(index).click();
      await page.getByRole('button', { name: 'Close tweaker', exact: true }).click();
      for (const button of await stepper.locator('.genux-button').all()) {
        const appearance = await button.evaluate(node => {
          const style = getComputedStyle(node),
            face = getComputedStyle(node, '::before');
          return {
            height: node.getBoundingClientRect().height,
            border: style.borderWidth,
            inset: [face.top, face.right, face.bottom, face.left],
            depth: [
              style.getPropertyValue('--lip').trim(),
              style.getPropertyValue('--top-lip').trim(),
            ],
          };
        });
        expect(appearance).toEqual({
          height,
          border: '0px',
          inset: ['0px', '0px', '0px', '0px'],
          depth: ['0px', '0px'],
        });
      }
      await action.scrollIntoViewIfNeeded();
      const box = await action.boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      expect(await action.boundingBox()).toEqual(box);
      expect(await action.evaluate(node => getComputedStyle(node, '::before').top)).toBe('0px');
      expect(await action.evaluate(node => getComputedStyle(node, '::before').bottom)).toBe('0px');
      await page.mouse.up();
      await assertReadableLayout(page);
    }
  }
});

test('All ten shadow choices paint correctly and pressing removes shadow', async ({ page }) => {
  await visit(page, 'button');
  const button = page.locator('.playground-preview .genux-button');
  expect(genux.experiments.shadow_variants).toHaveLength(10);
  for (const shadow of genux.experiments.shadow_variants) {
    await choose(page, page.locator('#button-shadow'), shadow.label);
    if (shadow.value === 'none') await expect(button).toHaveCSS('box-shadow', 'none');
    else {
      await expect
        .poll(async () =>
          hasPaintedShadow(await button.evaluate(node => getComputedStyle(node).boxShadow)),
        )
        .toBe(true);
      expect(await button.evaluate(node => getComputedStyle(node).boxShadow)).not.toContain(
        'inset',
      );
    }
  }
  await choose(
    page,
    page.locator('#button-state'),
    genux.decisions.buttons.state_variants.find(item => item.value === 'pressed')!.label,
  );
  await expect(button).toHaveCSS('box-shadow', 'none');
});

test('Hover and press keep button root and label fixed while flat depth changes', async ({
  page,
}, info) => {
  await visit(page, 'button');
  await choose(
    page,
    page.locator('#button-palette'),
    genux.decisions.buttons.palette_variants.find(item => item.value === 'coral')!.label,
  );
  const button = page.locator('.playground-preview .genux-button');
  const label = button.locator('.genux-button-content > span');
  await page.mouse.move(0, 0);
  await expect(button).toHaveCSS('opacity', '0.9');
  const rootBefore = await documentRect(button);
  const textBefore = await documentRect(label);
  await choose(
    page,
    page.locator('#button-state'),
    genux.decisions.buttons.state_variants.find(item => item.value === 'hover')!.label,
  );
  await expect(button).toHaveCSS('opacity', '1');
  expectFixedRect(await documentRect(button), rootBefore);
  expectFixedRect(await documentRect(label), textBefore);
  await choose(
    page,
    page.locator('#button-state'),
    genux.decisions.buttons.state_variants.find(item => item.value === 'pressed')!.label,
  );
  await expect(button).toHaveCSS('opacity', '1');
  await expect
    .poll(() => button.evaluate(node => getComputedStyle(node, '::before').top))
    .toBe('2px');
  await expect
    .poll(() => button.evaluate(node => getComputedStyle(node, '::before').bottom))
    .toBe('0px');
  expectFixedRect(await documentRect(button), rootBefore);
  expectFixedRect(await documentRect(label), textBefore);
  await choose(page, page.locator('#button-state'), 'Normal');
  await page.mouse.move(0, 0);
  await expect(button).toHaveCSS('opacity', '0.9');
  await expect
    .poll(() => button.evaluate(node => getComputedStyle(node, '::before').bottom))
    .toBe('4px');
  if (info.project.name.endsWith('-desktop')) {
    await button.hover();
    await expect(button).toHaveCSS('opacity', '1');
    await page.mouse.down();
    try {
      await expect
        .poll(() => button.evaluate(node => getComputedStyle(node, '::before').top))
        .toBe('2px');
      expectFixedRect(await documentRect(button), rootBefore);
      expectFixedRect(await documentRect(label), textBefore);
    } finally {
      await page.mouse.up();
    }
    await page.mouse.move(0, 0);
    await expect(button).toHaveCSS('opacity', '0.9');
  }
});

test('Button feedback caps every press and release layer below Switch motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await visit(page, 'button');
  const expectedMs = motion.durationMs['button-feedback'];
  expect(expectedMs).toBeLessThanOrEqual(motion.durationMs.selection);
  for (const fill of ['solid', 'outline']) {
    const button = page.locator(`.genux-button-visuals .genux-button[data-fill='${fill}']`).first();
    const restOpacity =
      (await button.getAttribute('data-docs-brand-default')) === 'true' ? '1' : '0.9';
    const label = button.locator('.genux-button-content');
    const timing = () =>
      button.evaluate(node => {
        const lip = node.querySelector('.genux-button-lip');
        return [
          getComputedStyle(node),
          getComputedStyle(node, '::before'),
          ...(lip ? [getComputedStyle(lip, '::before'), getComputedStyle(lip, '::after')] : []),
        ].map(style => ({
          durationMs: style.transitionDuration.split(',').map(value => parseFloat(value) * 1000),
          delayMs: style.transitionDelay.split(',').map(value => parseFloat(value) * 1000),
          easing: style.transitionTimingFunction,
        }));
      });
    const assertTiming = async () => {
      const layers = await timing();
      expect(layers.length).toBe(fill === 'outline' ? 4 : 2);
      for (const layer of layers) {
        for (const duration of layer.durationMs) expect(duration).toBeCloseTo(expectedMs, 2);
        for (const delay of layer.delayMs) expect(delay).toBe(0);
        for (const curve of layer.easing.match(/cubic-bezier\([^)]*\)/g) ?? [])
          expect(curve.replaceAll(' ', '')).toBe(motion.easing.replaceAll(' ', ''));
        expect(layer.easing).toContain('cubic-bezier');
      }
    };
    const depth = () =>
      button.evaluate(node => {
        const lip = node.querySelector('.genux-button-lip');
        return lip
          ? getComputedStyle(lip, '::after').height
          : getComputedStyle(node, '::before').bottom;
      });
    await button.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expect(button).toHaveCSS('opacity', restOpacity);
    const initialDepth = await depth();
    const rootBefore = await documentRect(button);
    const textBefore = await documentRect(label);
    await assertTiming();
    await button.hover();
    await page.mouse.down();
    try {
      expect(await button.evaluate(node => node.matches(':active'))).toBe(true);
      await assertTiming();
      expectFixedRect(await documentRect(button), rootBefore);
      expectFixedRect(await documentRect(label), textBefore);
    } finally {
      await page.mouse.up();
    }
    await page.mouse.move(0, 0);
    await assertTiming();
    await expect.poll(depth).toBe(initialDepth);
    await expect(button).toHaveCSS('opacity', restOpacity);
    await keyboardFocus(page, button);
    await page.keyboard.down('Space');
    try {
      expect(await button.evaluate(node => node.matches(':active'))).toBe(true);
      await assertTiming();
    } finally {
      await page.keyboard.up('Space');
    }
    await assertTiming();
    await expect.poll(depth).toBe(initialDepth);
    expectFixedRect(await documentRect(button), rootBefore);
    expectFixedRect(await documentRect(label), textBefore);
  }
});

test('Icons occupy all four real positions for both icon families', async ({ page }) => {
  await visit(page, 'button');
  const button = page.locator('.playground-preview .genux-button');
  await choose(
    page,
    page.locator('#button-icon'),
    genux.experiments.icon_options.name.find(item => item.value === 'arrowRight')!.label,
  );
  for (const library of genux.experiments.icon_options.library.map(item => item.label)) {
    await choose(page, page.locator('#button-icon-library'), library);
    for (const [name, direction] of [
      ['Left', 'left'],
      ['Right', 'right'],
      ['Top', 'top'],
      ['Bottom', 'bottom'],
    ]) {
      await choose(page, page.locator('#button-icon-position'), name);
      const icon = await documentRect(button.locator('.genux-icon'));
      const label = await documentRect(button.locator('.genux-button-content > span'));
      if (direction === 'left') expect(icon.x + icon.width).toBeLessThanOrEqual(label.x + 1);
      if (direction === 'right') expect(icon.x).toBeGreaterThanOrEqual(label.x + label.width - 1);
      if (direction === 'top') expect(icon.y + icon.height).toBeLessThanOrEqual(label.y + 1);
      if (direction === 'bottom') expect(icon.y).toBeGreaterThanOrEqual(label.y + label.height - 1);
      await assertReadableLayout(page);
    }
  }
});

test('Manual statuses remain explicit previews with correct busy and disabled semantics', async ({
  page,
}) => {
  await visit(page, 'button');
  const mutations: string[] = [];
  page.on('request', request => {
    if (
      !['GET', 'HEAD'].includes(request.method()) ||
      ['fetch', 'xhr'].includes(request.resourceType())
    )
      mutations.push(request.url());
  });
  const button = page.locator('.playground-preview .genux-button');
  await expect(page.getByText('State · approved / experimental', { exact: true })).toBeVisible();
  for (const state of [
    ...genux.decisions.buttons.state_variants,
    ...genux.experiments.state_variants,
  ]) {
    await choose(page, page.locator('#button-state'), state.label);
    await expect(button).toHaveAttribute('aria-busy', String(state.busy));
    if (state.blocked && !state.busy) await expect(button).toBeDisabled();
    else if (!state.busy) await expect(button).toBeEnabled();
    await expect(page.locator('.button-playground .form-result')).toContainText(`${state.label}:`);
  }
  expect(mutations).toEqual([]);
});

test('Drawer preserves edits through resize, Escape and reopening with focus return', async ({
  page,
}, info) => {
  await visit(page, 'drawer');
  const trigger = page.getByRole('button', { name: 'Open panel', exact: true });
  await keyboardFocus(page, trigger);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Local draft' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Draft title', { exact: true }).fill('Korunan taslak');
  await dialog.getByLabel('Note', { exact: true }).fill('Yön ve alan değişiminde korunan not');
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 640, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(dialog.getByLabel('Draft title', { exact: true })).toHaveValue('Korunan taslak');
    await expect(
      dialog.getByRole('button', { name: 'Validate locally', exact: true }),
    ).toBeInViewport();
    await assertReadableLayout(page);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Draft title', { exact: true })).toHaveValue('Korunan taslak');
  await expect(dialog.getByLabel('Note', { exact: true })).toHaveValue(
    'Yön ve alan değişiminde korunan not',
  );
  await dialog.getByRole('button', { name: 'Close panel', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  if (info.project.use.hasTouch) {
    await trigger.tap();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Draft title', { exact: true })).toHaveValue('Korunan taslak');
    await dialog.getByRole('button', { name: 'Close panel', exact: true }).tap();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test('Form validation, layout changes and reset remain local and preserve edits', async ({
  page,
}) => {
  await visit(page, 'form');
  const mutations: string[] = [];
  page.on('request', request => {
    if (
      !['GET', 'HEAD'].includes(request.method()) ||
      ['fetch', 'xhr'].includes(request.resourceType())
    )
      mutations.push(request.url());
  });
  const form = page.locator('#profile-example');
  const result = page.locator('[data-demo="forms"] .form-result');
  const name = form.getByLabel('Full name', { exact: true });
  const team = form.getByLabel('Team', { exact: true });
  const restingName = await fieldGeometry(name);
  const restingTeam = await fieldGeometry(team);
  await expect(result).toBeEmpty();
  await expect(result).toHaveCSS('height', '0px');
  await form.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(form.getByText('Enter your full name.', { exact: true })).toBeVisible();
  expect(await fieldGeometry(name)).toEqual(restingName);
  expect(await fieldGeometry(team)).toEqual(restingTeam);
  await form.getByLabel('Full name', { exact: true }).fill('Ada Kullanıcı');
  await form.getByLabel('Email', { exact: true }).fill('gecersiz');
  await choose(page, form.getByLabel('Team', { exact: true }), 'Design');
  await expect(name).not.toHaveClass(/ant-input-status-error/);
  expect(await fieldGeometry(name)).toEqual(restingName);
  expect(await fieldGeometry(team)).toEqual(restingTeam);
  await form.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(form.getByText('Provide a valid email address.', { exact: true })).toBeVisible();
  await form.getByLabel('Email', { exact: true }).fill('ada@example.com');
  for (const layout of ['Horizontal', 'Inline', 'Vertical']) {
    await choose(page, page.getByLabel('Form layout', { exact: true }), layout);
    await expect(form.getByLabel('Full name', { exact: true })).toHaveValue('Ada Kullanıcı');
    await assertReadableLayout(page);
  }
  await form.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(result).toContainText('no data was sent');
  await form.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(form.getByLabel('Full name', { exact: true })).toHaveValue('');
  await expect(form.getByLabel('Email', { exact: true })).toHaveValue('');
  await expect(result).toBeEmpty();
  await expect(result).toHaveCSS('height', '0px');
  expect(mutations).toEqual([]);
});

test('Accordion keyboard and disabled behavior retain nested state', async ({ page }) => {
  await visit(page, 'accordion');
  const single = page.locator('section[aria-labelledby="accordion-single"]');
  const first = single.getByRole('tab', { name: 'When to use it?', exact: true });
  const second = single.getByRole('tab', { name: 'Keyboard use', exact: true });
  await keyboardFocus(page, second);
  await page.keyboard.press('Space');
  await expect(second).toHaveAttribute('aria-expanded', 'true');
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(second).toHaveAttribute('aria-expanded', 'false');
  const disabled = page.getByRole('button', { name: 'Unavailable section', exact: true });
  await expect(disabled).toHaveAttribute('aria-disabled', 'true');
  await expect(disabled).toBeDisabled();
  await disabled.dispatchEvent('click');
  await expect(disabled).toHaveAttribute('aria-expanded', 'false');
  const nested = page.locator('section[aria-labelledby="accordion-nested"]');
  await nested.getByRole('button', { name: 'Channels', exact: true }).click();
  await nested.getByLabel('In-app notifications', { exact: true }).uncheck();
  await nested.getByRole('button', { name: 'Notification settings', exact: true }).click();
  await nested.getByRole('button', { name: 'Notification settings', exact: true }).click();
  await expect(nested.getByLabel('In-app notifications', { exact: true })).not.toBeChecked();
});

test('selection profiles keep exact visual dimensions and independent hit and focus layers', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const sizes = [32, 40, 50];
  const chooseSize = async (index: number) => {
    await page.getByRole('button', { name: 'Open tweaker', exact: true }).click();
    await expect(page.locator('.genux-size-options .ant-segmented-item-label')).toHaveText([
      'Small · 32 px',
      'Medium · 40 px',
      'Large · 50 px',
    ]);
    await page.locator('.genux-size-options .ant-segmented-item').nth(index).click();
    await page.getByRole('button', { name: 'Close tweaker', exact: true }).click();
  };
  for (const mode of ['light', 'dark']) {
    for (const slug of ['checkbox', 'radio', 'switch']) {
      await visit(page, slug);
      if ((await page.locator('html').getAttribute('data-theme')) !== mode)
        await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
      for (const [index, height] of sizes.entries()) {
        await chooseSize(index);
        const controls = page.locator(`.live-preview .ant-${slug}`);
        for (const control of await controls.all()) {
          const fixed = { 'switch-small': 32, 'switch-medium': 40, 'switch-large': 50 };
          const id = (await control.getAttribute('id')) ?? '';
          const expected = fixed[id as keyof typeof fixed] ?? height;
          await expect
            .poll(() => control.evaluate(node => node.getBoundingClientRect().height))
            .toBe(expected);
          if (slug === 'switch') {
            const thumb = control.locator('.ant-switch-handle');
            expect(await thumb.evaluate(node => node.getBoundingClientRect().height)).toBeCloseTo(
              expected * 0.8,
              1,
            );
            const loading = control.locator('.ant-switch-loading-icon');
            if (await loading.count()) {
              expect(
                await loading.evaluate(node => parseFloat(getComputedStyle(node).fontSize)),
              ).toBe(expected * 0.5);
              expect(
                await loading.evaluate(node => parseFloat(getComputedStyle(node).top)),
              ).toBeCloseTo(expected * 0.15, 1);
            }
            if (!(await control.getAttribute('data-switch-content')))
              expect(await control.evaluate(node => node.getBoundingClientRect().width)).toBe(
                expected * 2,
              );
          } else {
            expect(await control.evaluate(node => node.getBoundingClientRect().width)).toBe(
              expected,
            );
            expect(
              await control.evaluate(node => node.closest('label')!.getBoundingClientRect().width),
            ).toBeGreaterThanOrEqual(48);
          }
        }
        await assertReadableLayout(page);
      }
    }
    await chooseSize(0);
    const toggle = page.locator('#switch-notify');
    await keyboardFocus(page, toggle);
    const focusAndHit = await toggle.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const focus = getComputedStyle(node, '::before');
      const hit = getComputedStyle(node, '::after');
      return {
        focusHeight: parseFloat(focus.height),
        focusTop: parseFloat(focus.top),
        hitTop: parseFloat(hit.top),
        hitBottom: parseFloat(hit.bottom),
        hitTarget: document.elementFromPoint(rect.x + rect.width / 2, rect.y - 4) === node,
      };
    });
    expect(focusAndHit).toEqual({
      focusHeight: 3,
      focusTop: 36,
      hitTop: -8,
      hitBottom: -8,
      hitTarget: true,
    });
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  }
  await visit(page, 'collection-views');
  const unlabeled = page.locator('.live-preview .ant-checkbox-wrapper').first();
  expect(
    await unlabeled.evaluate(node => node.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(48);
});

test('Choice controls support keyboard activation and honest loading preview', async ({ page }) => {
  await visit(page, 'checkbox');
  const all = page.getByRole('checkbox', { name: 'Select all', exact: true });
  await keyboardFocus(page, all);
  await page.keyboard.press('Space');
  await expect(page.getByRole('status')).toHaveText('3 teams selected.');
  await visit(page, 'radio');
  const radio = page.getByRole('radio', { name: 'Design', exact: true }).first();
  await radio.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Engineering', exact: true }).first()).toBeChecked();
  await visit(page, 'switch');
  const toggle = page.locator('#switch-notify');
  await keyboardFocus(page, toggle);
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Processing preview', { exact: true })).toBeVisible();
});

test('Reduced motion removes animated icon motion and component transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await visit(page, 'button');
  await choose(page, page.locator('#button-icon'), 'Loader');
  await choose(
    page,
    page.locator('#button-icon-motion'),
    genux.experiments.icon_options.motion.find(item => item.value === 'spin')!.label,
  );
  const button = page.locator('.playground-preview .genux-button');
  await expect(button.locator('.genux-icon')).toHaveCSS('animation-name', 'none');
  const durations = await button.evaluate(node =>
    getComputedStyle(node).transitionDuration.split(',').map(parseFloat),
  );
  expect(durations.every(duration => duration === 0)).toBe(true);
  const faceDurations = await button.evaluate(node =>
    getComputedStyle(node, '::before').transitionDuration.split(',').map(parseFloat),
  );
  expect(faceDurations.every(duration => duration === 0)).toBe(true);
});

test('Workspace table scroll is contained and tree expansion uses an GenUX target', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await visit(page, 'data-table');
  const scroller = page.locator('.collection-table-scroll');
  await expect(scroller).toBeVisible();
  await assertReadableLayout(page);
  expect(await scroller.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await keyboardFocus(page, scroller);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => scroller.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  await choose(page, page.locator('#collection-view'), 'Tree table');
  const expand = page.getByRole('button', { name: 'Collapse children SP-26-0401', exact: true });
  const box = await expand.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await keyboardFocus(page, expand);
  await page.keyboard.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
});

test('Workspace form keeps draft and caret through locale, size and organization changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await visit(page, 'record-forms');
  const customer = page.locator('#record-form-customer');
  await customer.fill('A retained customer');
  await customer.focus();
  await customer.evaluate(node => (node as HTMLInputElement).setSelectionRange(2, 7));
  await page.setViewportSize({ width: 720, height: 320 });
  await expect(customer).toBeFocused();
  expect(
    await customer.evaluate(node => [
      (node as HTMLInputElement).selectionStart,
      (node as HTMLInputElement).selectionEnd,
    ]),
  ).toEqual([2, 7]);
  await page.locator('[data-locale-button="tr"]').click();
  await expect(customer).toHaveValue('A retained customer');
  await page.locator('[data-locale-button="en"]').click();
  await choose(page, page.locator('#record-form-mode'), 'Tabbed form');
  await expect(customer).toHaveValue('A retained customer');
  await page.locator('#record-form-submit').click();
  await expect(page.locator('#record-form-email')).toBeFocused();
  await assertReadableLayout(page);
});

test('Workspace native overlays retain drafts and restore their connected opener', async ({
  page,
}) => {
  await visit(page, 'record-details');
  await choose(page, page.locator('#details-presentation'), 'Bottom sheet');
  const opener = page.locator('[data-record-open="SP-26-0401"]');
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.locator('#details-edit').click();
  await page.locator('#details-notes').fill('Retained sheet note');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(page.locator('#details-notes')).toHaveValue('Retained sheet note');
  await assertReadableLayout(page);
});

test('Docked details preserve two reachable scroll regions at phone landscape height', async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await visit(page, 'record-details');
  await choose(page, page.locator('#details-presentation'), 'Docked panel');
  await page.locator('[data-record-open="SP-26-0401"]').click();
  const pane = page.locator('#record-details-splitter .ant-splitter-panel').nth(1);
  const results = page.locator('#record-details-splitter .ant-splitter-panel').nth(0);
  await expect(pane).toBeVisible();
  await expect(results).toBeVisible();
  const geometry = await page
    .locator('#record-details-splitter .genux-splitter-native')
    .evaluate(node => {
      const root = node.getBoundingClientRect();
      return [...node.querySelectorAll(':scope > .ant-splitter-panel')].map(child => ({
        bottom: child.getBoundingClientRect().bottom,
        limit: root.bottom,
        height: child.getBoundingClientRect().height,
      }));
    });
  for (const region of geometry) {
    expect(region.height).toBeGreaterThan(0);
    expect(region.bottom).toBeLessThanOrEqual(region.limit + 1);
  }
  await keyboardFocus(page, pane);
  await page.keyboard.press('End');
  await expect.poll(() => pane.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await assertReadableLayout(page);
});

test('Non-modal disclosure exits retain the draft and use central motion', async ({ page }) => {
  await visit(page, 'record-details');
  await page.locator('[data-record-open="SP-26-0401"]').click();
  await page.locator('#details-edit').click();
  const customer = page.locator('#details-customer');
  await customer.fill('Persistent non-modal draft');
  await page.locator('#details-close').click();
  const disclosure = page.locator('.workspace-details-panel.workspace-disclosure');
  await expect(disclosure).toHaveAttribute('aria-hidden', 'true');
  await expect(disclosure).toHaveAttribute('inert', '');
  const motion = await disclosure.evaluate(node => {
    const style = getComputedStyle(node);
    return {
      duration: style.transitionDuration,
      easing: style.transitionTimingFunction,
      count: node.querySelectorAll('#details-customer').length,
    };
  });
  expect(motion.count).toBe(1);
  expect(motion.duration.split(',').some(value => parseFloat(value) > 0)).toBe(true);
  expect(motion.easing).toContain('cubic-bezier(0.65, 0, 0.35, 1)');
  await page.locator('[data-record-open="SP-26-0401"]').click();
  await expect(customer).toHaveValue('Persistent non-modal draft');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await disclosure.evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
});

test('Documentation spans wide desktops while retaining fluid navigation and examples', async ({
  page,
}) => {
  for (const width of [1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit(page, 'record-forms');
    const geometry = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const header = document.querySelector<HTMLElement>('.docs-header')!;
      const shell = document.querySelector<HTMLElement>('.docs-shell')!;
      const footer = document.querySelector<HTMLElement>('.docs-footer')!;
      const main = document.querySelector<HTMLElement>('main')!;
      const article = document.querySelector<HTMLElement>('article')!;
      const preview = document.querySelector<HTMLElement>('.live-preview')!;
      const wordmark = document.querySelector<HTMLElement>('.wordmark')!;
      const sidebar = document.querySelector<HTMLElement>('.sidebar')!;
      const shellBox = shell.getBoundingClientRect();
      return {
        viewport,
        outer: [header, shell, footer].map(node => node.getBoundingClientRect().width),
        headerGutter: wordmark.getBoundingClientRect().left,
        sidebarGutter: sidebar.getBoundingClientRect().left,
        mainRight: main.getBoundingClientRect().right,
        shellContentRight: shellBox.right - parseFloat(getComputedStyle(shell).paddingRight),
        articleWidth: article.getBoundingClientRect().width,
        previewWidth: preview.getBoundingClientRect().width,
      };
    });
    for (const outer of geometry.outer)
      expect(Math.abs(outer - geometry.viewport)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.headerGutter - geometry.sidebarGutter)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.mainRight - geometry.shellContentRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.articleWidth - geometry.previewWidth)).toBeLessThanOrEqual(1);
    await assertReadableLayout(page);
  }
});

test('Pill master retains distinct managed surfaces and component-owned automatic colors', async ({
  page,
}) => {
  await visit(page, 'pill');
  for (const mode of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== mode)
      await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
    const filled = page.locator('[data-pill-status="filled"] .ant-tag-processing');
    const solid = page.locator('[data-pill-status="solid"] .ant-tag-processing');
    const outlined = page.locator('[data-pill-status="outlined"] .ant-tag-processing');
    await expect
      .poll(() => solid.evaluate(node => getComputedStyle(node).backgroundColor))
      .toBe('rgb(0, 153, 255)');
    expect(await solid.evaluate(node => getComputedStyle(node).color)).toBe('rgb(0, 0, 0)');
    expect(await outlined.evaluate(node => getComputedStyle(node).backgroundColor)).toBe(
      'rgba(0, 0, 0, 0)',
    );
    expect(await filled.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(
      'rgb(0, 153, 255)',
    );
    const check = page.locator('[data-pill-checkable] [role="checkbox"]').first();
    const checked = await check.getAttribute('aria-checked');
    await keyboardFocus(page, check);
    expect(
      await check.evaluate(node => ({
        outline: getComputedStyle(node).outlineStyle,
        marker: getComputedStyle(node, '::after').content,
      })),
    ).toEqual({ outline: 'none', marker: '""' });
    await page.keyboard.press('Space');
    await expect(check).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true');
    expect(
      await check.evaluate(node => node.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(48);
    const group = page.locator('[data-pill-automatic]');
    const before = await group
      .locator('.genux-pill')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-pill-color')));
    await group.getByRole('button', { name: 'Add tag', exact: true }).click();
    await expect(group.locator('.genux-pill[data-pill-color]')).toHaveCount(before.length + 1);
    const after = await group
      .locator('.genux-pill')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-pill-color')));
    expect(after.slice(0, -1)).toEqual(before);
    expect(after.at(-1)).not.toBe(before.at(-1));
    await assertReadableLayout(page);
  }
});

test('Card purpose catalog preserves task focus, form drafts and optional GenUX from 320 px upward', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await visit(page, 'card');
  const catalog = page.locator('[data-card-preview]');
  await expect(catalog.locator(':scope > section')).toHaveCount(5);
  await expect(catalog.locator('#card-catalog')).toHaveAttribute('data-purpose-count', '23');
  await expect(catalog.locator('#card-catalog')).toHaveAttribute('data-recipe-count', '37');
  await expect(catalog.locator('.genux-genux-runtime')).toHaveCount(0);
  const interactions = catalog.locator('#card-interactions');
  const draft = interactions.getByRole('textbox', { name: /Review title/ });
  await draft.fill('');
  await interactions.getByRole('button', { name: 'Save draft locally', exact: true }).click();
  await expect(draft).toHaveAttribute('aria-invalid', 'true');
  await expect(
    interactions.getByText('Enter a review title before saving.', { exact: true }),
  ).toBeVisible();
  await draft.fill('A retained Card review note.');
  await interactions.getByRole('button', { name: 'Save draft locally', exact: true }).click();
  await expect(interactions.locator('[data-form-result]')).toContainText(
    'A retained Card review note.',
  );
  const move = interactions.getByRole('button', { name: 'Move to In progress', exact: true });
  await keyboardFocus(page, move);
  await move.press('Enter');
  await expect(interactions.locator('[data-task-lane="active"] [data-task-grip]')).toBeFocused();
  await page.getByRole('button', { name: 'Open tweaker', exact: true }).click();
  await page.locator('[data-size-control] .ant-segmented-item').first().click();
  await expect(catalog).toHaveAttribute('data-card-profile', 'sm');
  await page.keyboard.press('Escape');
  for (const width of [320, 360, 375, 390, 640, 768, 1280]) {
    await page.setViewportSize({ width, height: width === 640 ? 360 : 800 });
    await expect(draft).toHaveValue('A retained Card review note.');
    await assertReadableLayout(page);
  }
  await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
  await expect(draft).toHaveValue('A retained Card review note.');
  await catalog.getByRole('button', { name: 'Open GenUX lab', exact: true }).click();
  await expect(catalog.locator('[data-genux-lab]')).toBeVisible();
  await catalog.getByRole('button', { name: 'Run recorded stream', exact: true }).click();
  await expect(catalog.locator('.genux-run-result')).toContainText('Recorded stream complete');
  await expect(catalog.locator('.genux-genux-runtime .genux-card')).toHaveCount(3);
  await catalog.getByRole('button', { name: 'Close GenUX lab', exact: true }).click();
  await expect(draft).toHaveValue('A retained Card review note.');
});

test('GenUX Task Card keeps grouped selections and scrolls tables inside320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await visit(page, 'card');
  await page.getByRole('button', { name: 'Open GenUX lab', exact: true }).click();
  const lab = page.locator('[data-genux-lab]');
  const scenario = lab.getByRole('combobox', { name: 'Recorded scenario', exact: true });
  await scenario.click();
  for (let index = 0; index < 8; index++) await scenario.press('ArrowDown');
  await scenario.press('Enter');
  await lab.getByRole('button', { name: 'Run recorded stream', exact: true }).click();
  await expect(lab.locator('.genux-run-result')).toContainText('5 frames received · 5 accepted');
  const table = lab.locator('.genux-data-block .ant-table-content').first();
  const geometry = await table.evaluate(node => ({
    width: node.clientWidth,
    scroll: node.scrollWidth,
    overflow: getComputedStyle(node).overflowX,
  }));
  expect(geometry.width).toBeLessThan(320);
  expect(geometry.scroll).toBeGreaterThan(geometry.width);
  expect(geometry.overflow).toBe('auto');
  const rows = lab.locator('tr[data-row-key]');
  await rows.filter({ hasText: 'SO-1042' }).getByRole('checkbox').check();
  await rows.filter({ hasText: 'SO-1043' }).getByRole('checkbox').check();
  await expect(rows.filter({ hasText: 'SO-1042' }).getByRole('checkbox')).toBeChecked();
  const note = lab.getByRole('textbox', { name: /Order review note/ });
  await note.fill('');
  await lab.getByRole('button', { name: 'Review local order draft', exact: true }).click();
  await expect(note).toHaveAttribute('aria-invalid', 'true');
  await expect(lab.locator('[data-genux-local-error]')).toHaveText(
    'Complete the required fields before continuing.',
  );
  await assertReadableLayout(page);
});

test('Color hue families share live channels and retain native field and selection state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/color-system/');
  await page.getByRole('button', { name: 'Reset color', exact: true }).click();
  const families = page.locator('[data-color-family-preview]');
  await expect(families).toHaveCount(6);
  const first = families.first();
  const input = first.getByRole('textbox');
  await input.fill('Keep the live preview draft.');
  const team = first.getByRole('combobox');
  await team.click();
  await team.press('ArrowDown');
  await team.press('Enter');
  await first.getByRole('checkbox').check();
  const amount = first.getByRole('slider');
  await amount.press('ArrowRight');
  const amountValue = await amount.getAttribute('aria-valuenow');
  const before = await families.evaluateAll(nodes =>
    nodes.map(n => n.getAttribute('data-seed-hex')),
  );
  await page.getByRole('spinbutton', { name: 'Whiteness · percent', exact: true }).fill('75');
  await page.getByRole('spinbutton', { name: 'Blackness · percent', exact: true }).fill('5');
  await expect
    .poll(() => families.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-seed-hex'))))
    .not.toEqual(before);
  const after = await families.evaluateAll(nodes =>
    nodes.map(n => n.getAttribute('data-seed-hex')),
  );
  expect(after.every((seed, index) => seed !== before[index])).toBe(true);
  expect(new Set(after).size).toBe(6);
  await expect(input).toHaveValue('Keep the live preview draft.');
  await expect(first.locator('.ant-select')).toContainText('Engineering');
  await expect(first.getByRole('checkbox')).toBeChecked();
  await expect(amount).toHaveAttribute('aria-valuenow', amountValue ?? '');
  const white = page.getByRole('slider', { name: 'Whiteness · percent', exact: true });
  await white.hover();
  const thumbPaint = () =>
    white.evaluate(node => ({
      face: getComputedStyle(node, '::after').backgroundColor,
      expected: getComputedStyle(
        document.querySelector('[data-color-family-preview] input.ant-input')!,
      ).backgroundColor,
    }));
  await expect
    .poll(async () => {
      const p = await thumbPaint();
      return p.face === p.expected;
    })
    .toBe(true);
  const box = (await white.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2);
    await expect
      .poll(async () => {
        const p = await thumbPaint();
        return p.face === p.expected;
      })
      .toBe(true);
  } finally {
    await page.mouse.up();
  }
  await page.getByRole('spinbutton', { name: 'Whiteness · percent', exact: true }).fill('40');
  await page.getByRole('spinbutton', { name: 'Blackness · percent', exact: true }).fill('60');
  const arrow = first.locator('.ant-select-suffix');
  expect(await arrow.evaluate(node => getComputedStyle(node).color)).toBe(
    await input.evaluate(node => getComputedStyle(node).color),
  );
  await page.locator('.color-palette .ant-segmented-item').filter({ hasText: 'Dark' }).click();
  await expect(input).toHaveValue('Keep the live preview draft.');
  await expect
    .poll(() =>
      first
        .getByRole('button', { name: 'Reset action', exact: true })
        .evaluate(node => getComputedStyle(node).color),
    )
    .toBe(await first.evaluate(node => getComputedStyle(node).color));
  expect(
    await first
      .locator('.ant-checkbox')
      .evaluate(node =>
        getComputedStyle(node).getPropertyValue('--ant-color-primary').trim().toLowerCase(),
      ),
  ).toBe(
    await first.evaluate(node =>
      getComputedStyle(node).getPropertyValue('--color-preview-primary').trim().toLowerCase(),
    ),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(amount).toHaveAttribute('aria-valuenow', amountValue ?? '');
  await assertReadableLayout(page);
  await page.getByRole('button', { name: 'TR · Turkish', exact: true }).click();
  await expect(input).toHaveValue('Keep the live preview draft.');
  await expect(first.getByRole('checkbox')).toBeChecked();
});

test('Splitter retains draft, bounded keyboard sizing and named panel scroll owners across available space', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await visit(page, 'splitter');
  const splitter = page.locator('#splitter-records');
  const handle = splitter.getByRole('separator');
  const note = page.locator('#splitter-review-note');
  await note.fill('A persistent panel review.');
  await expect(splitter).toHaveAttribute('data-splitter-orientation', 'vertical');
  await expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
  await keyboardFocus(page, handle);
  await page.keyboard.press('End');
  await expect(handle).toHaveAttribute('aria-valuenow', '80');
  await page.keyboard.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '20');
  await page.keyboard.press('ArrowDown');
  await expect(handle).toHaveAttribute('aria-valuenow', '25');
  const regions = splitter.locator('.ant-splitter-panel[role="region"]');
  await expect(regions).toHaveCount(2);
  await expect(regions.nth(0)).toHaveAttribute('tabindex', '0');
  await expect(handle).toHaveCSS('outline-style', 'none');
  await expect(handle).toHaveCSS('box-shadow', 'none');
  await assertReadableLayout(page);
  await page.setViewportSize({ width: 1680, height: 1000 });
  await expect(splitter).toHaveAttribute('data-splitter-orientation', 'horizontal');
  await expect(handle).toHaveAttribute('aria-orientation', 'vertical');
  await expect(note).toHaveValue('A persistent panel review.');
  await expect(handle).toHaveAttribute('aria-valuenow', '25');
  await assertReadableLayout(page);
});

test('All Data workspace default flows expose the shared adaptive panels at320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const slug of [
    'data-table',
    'collection-views',
    'record-details',
    'record-forms',
    'record-workspace',
  ]) {
    await visit(page, slug);
    const splitter = page.locator('[data-genux-splitter]').first();
    await expect(splitter).toHaveAttribute('data-splitter-orientation', 'vertical');
    await expect(splitter.getByRole('separator')).toHaveAttribute('tabindex', '0');
    await expect(splitter.locator('.ant-splitter-panel[role="region"]')).toHaveCount(2);
    await assertReadableLayout(page);
  }
});

test('Breadcrumb supports keyboard sibling navigation and named current paths from320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await visit(page, 'breadcrumb');
  const trigger = page.getByRole('button', { name: 'Navigate Data workspace pages', exact: true });
  await keyboardFocus(page, trigger);
  await page.keyboard.press('ArrowDown');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('menu', { name: 'Navigate Data workspace pages', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(5);
  await expect
    .poll(() =>
      menu
        .getByRole('menuitem')
        .nth(0)
        .evaluate(item => item.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(() =>
      menu
        .getByRole('menuitem')
        .nth(1)
        .evaluate(item => item.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.genux-breadcrumb-current[aria-current="page"]')).toHaveCount(2);
  await expect(
    page.locator('#breadcrumb-icons').getByRole('link', { name: 'Overview', exact: true }),
  ).toHaveAttribute('href', '/');
  await assertReadableLayout(page);
});

test('Dropdown keeps native focus, action outcomes and cascading menus usable at320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await visit(page, 'dropdown');
  const trigger = page.getByRole('button', { name: 'Workspace actions', exact: true });
  await trigger.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: 'Save to local collection', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Add review note', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('.dropdown-status')).toContainText('Review note added. 1 local notes.');
  await expect(trigger).toBeFocused();
  const organize = page.getByRole('button', { name: 'Organize workspace', exact: true });
  await organize.press('ArrowDown');
  const folder = page.getByRole('menuitem', { name: 'Move to folder', exact: true });
  await folder.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'Planning', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Planning', exact: true }).press('Enter');
  await expect(page.locator('.dropdown-status')).toContainText(
    'Workspace moved to Planning locally.',
  );
  await expect(organize).toBeFocused();
  await assertReadableLayout(page);
});

test('Pagination boundaries, existing Button surfaces and drafts remain usable at320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await visit(page, 'pagination');
  const primary = page.locator('[data-pagination-primary]');
  await expect(primary.getByRole('button', { name: 'Page 2', exact: true })).toBeVisible();
  await expect(primary.getByRole('button', { name: 'Page 49', exact: true })).toBeVisible();
  await primary.getByRole('button', { name: 'Last page', exact: true }).press('Enter');
  await expect(primary.getByRole('button', { name: 'Page 50', exact: true })).toBeFocused();
  await expect(primary.getByRole('button', { name: 'Last page', exact: true })).toBeDisabled();
  const jump = primary.getByRole('textbox', { name: 'Go to page', exact: true });
  await jump.fill('51');
  await primary.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(jump).toHaveAttribute('aria-invalid', 'true');
  await jump.fill('12');
  await jump.press('Enter');
  await expect(primary.getByRole('button', { name: 'Page 12', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const note = page.locator('[data-pagination-note]');
  await note.fill('Retained pagination note');
  await page.getByRole('button', { name: 'Open tweaker', exact: true }).click();
  await page.locator('[data-size-control] .ant-segmented-item').first().click();
  await page.keyboard.press('Escape');
  await expect(note).toHaveValue('Retained pagination note');
  for (const width of [320, 360, 375, 390, 640, 768, 1280]) {
    await page.setViewportSize({ width, height: width === 640 ? 360 : 800 });
    await assertReadableLayout(page);
    await expect(note).toHaveValue('Retained pagination note');
  }
  await expect(page.locator('[data-pagination-surface]')).toHaveCount(5);
});

test('Steps guides a validated local sequence and keeps drafts through narrow layout and settings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await visit(page, 'steps');
  const main = page.locator('[data-steps-primary]');
  await expect(
    main.locator('.ant-steps-filled .ant-steps-item-active .ant-steps-item-icon'),
  ).toHaveCSS('color', 'rgb(0, 0, 0)');
  const name = main.locator('[data-steps-workspace-name]');
  await main.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(name).toBeFocused();
  await expect(main.getByRole('alert')).toContainText('at least 2');
  await name.fill('Design studio');
  await main.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(main.locator('[aria-current="step"]')).toContainText('Review details');
  await main.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(name).toHaveValue('Design studio');
  await expect(name).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(name).toHaveValue('Design studio');
  await expect(name).toBeFocused();
  const navigation = page.locator('[data-steps-navigation-preview]');
  await navigation.getByRole('button', { name: /Overview/ }).press('End');
  await expect(navigation.getByRole('button', { name: /Activity/ })).toBeFocused();
  await navigation.getByRole('button', { name: /Activity/ }).press('Enter');
  await expect(navigation.locator('[aria-current="step"]')).toContainText('Activity');
  await expect(navigation.getByRole('button', { name: /Access/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await navigation.getByRole('button', { name: /Access/ }).hover();
  await expect(navigation.getByRole('button', { name: /Access/ })).toHaveCSS(
    'cursor',
    'not-allowed',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('AutoComplete keeps free text, native keyboard selection and clear usable at320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await visit(page, 'autocomplete');
  const main = page.locator('[data-autocomplete-primary]');
  const field = main.getByRole('combobox', { name: 'Find in the documentation', exact: true });
  await field.fill('but');
  await field.press('ArrowDown');
  await expect(field).toHaveValue('but');
  await field.press('Enter');
  await expect(field).toHaveValue('Button');
  await expect(main.locator('[data-autocomplete-context]')).toHaveAttribute(
    'data-selected-key',
    'button',
  );
  await main.getByRole('button', { name: 'Clear value', exact: true }).press('Enter');
  await expect(field).toHaveValue('');
  await expect(main.locator('[data-autocomplete-context]')).toHaveAttribute(
    'data-selected-key',
    '',
  );
  await field.fill('no matching resource');
  await expect(page.getByText('No suggestions match', { exact: true })).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(0);
  await field.press('Escape');
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('no matching resource');
  await assertReadableLayout(page);
});

test('Documentation backgrounds use warm light and neutral dark paper across navigation and reload', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.locator('astro-island[ssr]').waitFor({ state: 'detached' });
  const html = page.locator('html');
  const themeSwitch = page.getByRole('switch', { name: 'Dark theme', exact: true });
  const palette = () =>
    page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        paper: root.backgroundColor,
        panel: root.getPropertyValue('--panel').trim().toLowerCase(),
        field: root.getPropertyValue('--field-bg').trim().toLowerCase(),
      };
    });
  const expectPaper = async (paper: string, panel: string) => {
    await expect.poll(async () => (await palette()).paper).toBe(paper);
    expect((await palette()).panel).toBe(panel);
  };
  if ((await html.getAttribute('data-theme')) !== 'light') await themeSwitch.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expectPaper('rgb(230, 226, 215)', '#fffefa');
  const lightField = (await palette()).field;
  await info.attach('background-light', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await themeSwitch.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expectPaper('rgb(36, 36, 36)', '#2c2c2c');
  await visit(page, 'radio');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expectPaper('rgb(36, 36, 36)', '#2c2c2c');
  await expect
    .poll(() =>
      page
        .locator('.live-preview')
        .first()
        .evaluate(node => getComputedStyle(node).backgroundColor),
    )
    .toBe('rgb(44, 44, 44)');
  await page.goto('/');
  await page.reload();
  await page.locator('astro-island[ssr]').waitFor({ state: 'detached' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expectPaper('rgb(36, 36, 36)', '#2c2c2c');
  await assertReadableLayout(page);
  await info.attach('background-dark', { body: await page.screenshot(), contentType: 'image/png' });
  await themeSwitch.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expectPaper('rgb(230, 226, 215)', '#fffefa');
  expect((await palette()).field).toBe(lightField);
});

test('Dropdown restores the 1px background blur without blocking native dismissal', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await visit(page, 'dropdown');
  const trigger = page.getByRole('button', { name: 'Workspace actions', exact: true });
  const status = page.locator('.dropdown-status');
  const menu = page.locator('.ant-dropdown:visible');
  const backdrop = () =>
    page.locator('body').evaluate(body => {
      const style = getComputedStyle(body, '::before');
      return { blur: style.backdropFilter, pointer: style.pointerEvents };
    });
  const layer = (target: Locator) =>
    target.evaluate(node => {
      const style = getComputedStyle(node);
      return { zIndex: style.zIndex, filter: style.filter };
    });
  const before = await status.innerText();
  await trigger.press('ArrowDown');
  await expect(menu).toHaveCount(1);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => (await backdrop()).blur).toBe('blur(1px)');
  expect((await backdrop()).pointer).toBe('none');
  expect(await layer(trigger)).toEqual({ zIndex: '1041', filter: 'none' });
  expect(await layer(menu)).toEqual({ zIndex: '1050', filter: 'none' });
  await info.attach('dropdown-backdrop-open', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(async () => (await backdrop()).blur).toBe('blur(0px)');
  await trigger.click();
  await expect(menu).toHaveCount(1);
  await expect.poll(async () => (await backdrop()).blur).toBe('blur(1px)');
  await page.locator('h1').click();
  await expect(menu).toHaveCount(0);
  await expect(status).toHaveText(before);
  await expect.poll(async () => (await backdrop()).blur).toBe('blur(0px)');
});
