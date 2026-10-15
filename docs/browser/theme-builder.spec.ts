import { expect, test, type Locator, type Page } from '@playwright/test';

const ROUTE = '/theme-builder/';
const STORAGE_KEY = 'atlas-theme-builder-v1';
const DEFAULT_PRIMARY = '#0099ff';
const CUSTOM_PRIMARY = '#7c3aed';
const CUSTOM_PRIMARY_RGB = 'rgb(124, 58, 237)';
const LIGHT_PANEL = 'rgb(255, 255, 255)';
const LIGHT_FIELD = 'rgb(239, 241, 244)';
const DARK_FIELD = 'rgb(35, 43, 53)';

// Serialized into the page: must stay self-contained.
const surfaceColors = (input: Element) => {
  const isPainted = (color: string) => {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return false;
    const parts = match[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return parts.length < 4 || parts[3] > 0;
  };
  const paintedFrom = (start: Element | null) => {
    let node = start;
    while (node) {
      if (isPainted(getComputedStyle(node).backgroundColor)) return node;
      node = node.parentElement;
    }
    return null;
  };
  const field = paintedFrom(input);
  const panel = paintedFrom(field?.parentElement ?? null);
  return {
    field: field ? getComputedStyle(field).backgroundColor : null,
    panel: panel ? getComputedStyle(panel).backgroundColor : null,
  };
};

// Serialized into the page: must stay self-contained.
const focusSnapshot = (input: Element) => {
  const isPainted = (color: string) => {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return false;
    const parts = match[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return parts.length < 4 || parts[3] > 0;
  };
  let field: Element | null = input;
  while (field && !isPainted(getComputedStyle(field).backgroundColor)) field = field.parentElement;
  const owners = field && field !== input ? [input, field] : [input];
  return owners.map(owner => {
    const style = getComputedStyle(owner);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      backgroundColor: style.backgroundColor,
      borders: ['Top', 'Right', 'Bottom', 'Left'].map(side => ({
        width: style.getPropertyValue(`border-${side.toLowerCase()}-width`),
        color: style.getPropertyValue(`border-${side.toLowerCase()}-color`),
      })),
    };
  });
};

function luminance(color: string) {
  const [r, g, b] = (color.match(/\d+(\.\d+)?/g) ?? [])
    .slice(0, 3)
    .map(Number)
    .map(channel => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function splitShadows(boxShadow: string) {
  if (!boxShadow || boxShadow === 'none') return [];
  const shadows: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of boxShadow) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      shadows.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) shadows.push(current.trim());
  return shadows;
}

function surroundingShadows(boxShadow: string) {
  return splitShadows(boxShadow).filter(shadow => {
    const [x = 0, y = 0, blur = 0, spread = 0] = (
      shadow.replace(/rgba?\([^)]*\)/g, '').match(/-?\d*\.?\d+px/g) ?? []
    ).map(parseFloat);
    return x === 0 && y === 0 && (blur > 0 || spread > 0);
  });
}

async function openBuilder(page: Page) {
  await page.goto(ROUTE);
  await expect(page.getByRole('heading', { name: 'Theme Builder', exact: true })).toBeVisible();
}

async function readStorage(page: Page) {
  return page.evaluate(key => window.localStorage.getItem(key), STORAGE_KEY);
}

async function applyPrimary(page: Page, primary: Locator, value: string) {
  await primary.fill(value);
  await page.getByRole('button', { name: 'Apply theme', exact: true }).click();
}

test('theme builder renders 65 token editors at 320px with a darker inner preview field', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openBuilder(page);

  await expect(page.locator('[data-theme-token]')).toHaveCount(65);

  const overflow = await page.evaluate(() => ({
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.root).toBeLessThanOrEqual(0);
  expect(overflow.body).toBeLessThanOrEqual(0);

  const previewName = page.locator('input#theme-preview-name');
  await expect(previewName).toBeVisible();

  await expect
    .poll(() => previewName.evaluate(surfaceColors))
    .toEqual({ field: LIGHT_FIELD, panel: LIGHT_PANEL });
  const { field, panel } = await previewName.evaluate(surfaceColors);
  expect(luminance(field!)).toBeLessThan(luminance(panel!));
});

test('applied primary token restyles the preview, survives reload and reaches shared demos', async ({
  page,
}) => {
  await openBuilder(page);

  const previewName = page.locator('#theme-preview-name');
  const primary = page.locator('#tb-token-primary');
  const action = page.locator('[data-theme-preview-action]');
  const draft = 'Quarterly launch draft';

  await previewName.fill(draft);
  await applyPrimary(page, primary, CUSTOM_PRIMARY);

  expect(await action.evaluate(el => el.tagName)).toBe('BUTTON');
  await expect(action).toHaveCSS('background-color', CUSTOM_PRIMARY_RGB);
  await expect(previewName).toHaveValue(draft);

  await page.reload();
  await expect(page.locator('#tb-token-primary')).toHaveValue(
    new RegExp(`^${CUSTOM_PRIMARY}$`, 'i'),
  );

  await page.goto('/components/input/');
  const demos = page.locator('.atlas-demo');
  await expect(demos.first()).toBeAttached();
  await expect
    .poll(() =>
      demos.evaluateAll(owners =>
        owners.map(owner =>
          getComputedStyle(owner).getPropertyValue('--primary').trim().toLowerCase(),
        ),
      ),
    )
    .toContain(CUSTOM_PRIMARY);
});

test('invalid import keeps the applied theme, reset restores defaults and dark field focus has no ring', async ({
  page,
}) => {
  await openBuilder(page);

  const primary = page.locator('#tb-token-primary');
  const action = page.locator('[data-theme-preview-action]');
  const json = page.locator('#theme-json');
  const error = page.locator('[data-theme-error]');
  const importButton = page.getByRole('button', { name: 'Import JSON', exact: true });

  await applyPrimary(page, primary, CUSTOM_PRIMARY);
  await expect(action).toHaveCSS('background-color', CUSTOM_PRIMARY_RGB);
  await expect.poll(() => readStorage(page)).not.toBeNull();
  const storedSeed = await readStorage(page);

  for (const payload of [
    '{"tokens": {"primary": "#112233", ',
    JSON.stringify({ tokens: { primary: '#112233', notARealToken: '#445566' } }),
  ]) {
    await json.fill(payload);
    await importButton.click();
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/\S/);
    await expect(primary).toHaveValue(new RegExp(`^${CUSTOM_PRIMARY}$`, 'i'));
    await expect(action).toHaveCSS('background-color', CUSTOM_PRIMARY_RGB);
    expect(await readStorage(page)).toBe(storedSeed);
  }

  await page.getByRole('button', { name: 'Reset theme', exact: true }).click();
  await expect(primary).toHaveValue(new RegExp(`^${DEFAULT_PRIMARY}$`, 'i'));
  await expect.poll(() => readStorage(page)).toBeNull();

  await page.locator('[data-theme-toggle]').first().click();
  const previewName = page.locator('#theme-preview-name');
  await expect.poll(async () => (await previewName.evaluate(surfaceColors)).field).toBe(DARK_FIELD);

  const resting = await previewName.evaluate(focusSnapshot);
  await previewName.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(previewName).not.toBeFocused();
  await page.keyboard.press('Tab');
  await expect(previewName).toBeFocused();
  await expect.poll(() => previewName.evaluate(el => el.matches(':focus-visible'))).toBe(true);

  await expect
    .poll(async () => JSON.stringify(await previewName.evaluate(focusSnapshot)))
    .not.toBe(JSON.stringify(resting));
  const focused = await previewName.evaluate(focusSnapshot);

  focused.forEach((owner, index) => {
    const outlineVisible = owner.outlineStyle !== 'none' && parseFloat(owner.outlineWidth) > 0;
    expect(outlineVisible, `owner ${index} draws a focus outline`).toBe(false);
    expect(
      surroundingShadows(owner.boxShadow),
      `owner ${index} draws a surrounding shadow ring`,
    ).toEqual([]);
    const changedSides = owner.borders.filter(
      (side, sideIndex) =>
        side.color !== resting[index].borders[sideIndex].color ||
        side.width !== resting[index].borders[sideIndex].width,
    );
    expect(changedSides.length, `owner ${index} changes all four borders on focus`).toBeLessThan(4);
  });
});
