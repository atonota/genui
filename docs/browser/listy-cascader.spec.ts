import { expect, test, type Locator, type Page } from '@playwright/test';

const origin = 'http://127.0.0.1:4324';
const stage = process.env.ATLAS_TDD_STAGE === 'after' ? 'after' : 'before';

async function snap(page: Page, name: string) {
  await page.screenshot({
    path: test.info().outputPath(`listy-cascader-${stage}-${name}.png`),
    fullPage: true,
  });
}

async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 120; step += 1) {
    if (await target.evaluate(element => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

const rowHeight = (row: Locator) =>
  row.evaluate(element => Math.round(element.getBoundingClientRect().height));

const typography = (row: Locator) =>
  row.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      size: parseFloat(style.fontSize),
      weight: Number(style.fontWeight),
      family: style.fontFamily,
    };
  });

const withoutRing = (element: Locator) =>
  element.evaluate(node => {
    const style = getComputedStyle(node);
    return style.outlineStyle === 'none' || parseFloat(style.outlineWidth) === 0;
  });

test('Listy rows share Atlas sizes and Cascader rows keep native keyboard semantics', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const response = await page.goto(`${origin}/components/listy/`);
  expect(response?.status()).toBe(200);

  const row = page.locator('[data-atlas-listy-item]').first();
  await expect(row).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const listyText = await typography(row);
  expect(listyText.size).toBeGreaterThanOrEqual(14);
  expect(listyText.weight).toBeGreaterThanOrEqual(300);
  expect(listyText.family).toContain('Outfit');

  // Default inset presentation: rows sit inside the list, with one decorative boundary at most.
  const frame = await row.evaluate(item => {
    const root = item.parentElement?.closest('.ant-listy');
    if (!root) return null;
    const bordered = (element: Element) => {
      const style = getComputedStyle(element);
      return ['top', 'right', 'bottom', 'left'].some(
        side =>
          parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0 &&
          style.getPropertyValue(`border-${side}-style`) !== 'none',
      );
    };
    const outer = root.getBoundingClientRect(),
      inner = item.getBoundingClientRect();
    return {
      inset: inner.left - outer.left,
      doubleBorder: bordered(root) && bordered(item),
    };
  });
  expect(frame).not.toBeNull();
  expect(frame?.inset).toBeGreaterThan(0);
  expect(frame?.doubleBorder).toBe(false);
  await snap(page, 'listy-320');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('[data-tweaker-trigger]').click();
  const sizes = page.locator('.atlas-tweaker-panel [data-size-control] .ant-segmented-item');
  await expect(sizes).toHaveCount(3);
  for (const [index, height] of [
    [0, 32],
    [1, 40],
    [2, 48],
  ] as const) {
    await sizes.nth(index).click();
    await expect.poll(() => rowHeight(row)).toBe(height);
  }
  await sizes.nth(1).click();
  await page.keyboard.press('Escape');
  await snap(page, 'listy-desktop');

  const cascader = await page.goto(`${origin}/components/cascader/`);
  expect(cascader?.ok()).toBe(true);
  const field = page.locator('[data-cascader-primary] [data-cascader-field]');
  const input = field.locator('input[role="combobox"]');
  await tabTo(page, input);
  expect(await withoutRing(field.locator('.atlas-cascader-control'))).toBe(true);

  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  const treeId = await input.getAttribute('aria-controls');
  expect(treeId).toBeTruthy();
  const tree = page.locator(`[id="${treeId}"]`);
  await expect(tree).toHaveAttribute('role', 'tree');
  const studio = tree.getByRole('treeitem', { name: new RegExp('^Studio[.]') });
  await expect(studio).toBeVisible();

  // Native Cascader rows reuse the shared Listy row primitive without losing tree semantics.
  const contract = await tree.evaluate(element => {
    const items = [...element.querySelectorAll('[role="treeitem"]')];
    return {
      items: items.length,
      shared: items.filter(
        item =>
          item.hasAttribute('data-atlas-listy-item') ||
          !!item.querySelector('[data-atlas-listy-item]'),
      ).length,
    };
  });
  expect(contract.items).toBeGreaterThan(0);
  expect(contract.shared).toBe(contract.items);
  const cascaderText = await typography(studio);
  expect(cascaderText.size).toBeGreaterThanOrEqual(14);
  expect(cascaderText.family).toContain('Outfit');

  const studioId = await studio.getAttribute('id');
  for (let step = 0; step < 5; step += 1) {
    if ((await input.getAttribute('aria-activedescendant')) === studioId) break;
    await page.keyboard.press('ArrowDown');
  }
  await expect(input).toHaveAttribute('aria-activedescendant', studioId ?? '');
  expect(await withoutRing(studio)).toBe(true);

  await page.keyboard.press('ArrowRight');
  await expect(studio).toHaveAttribute('aria-expanded', 'true');
  const design = tree.getByRole('treeitem', { name: new RegExp('^Studio / Design[.]') });
  await expect(design).toBeVisible();
  await expect(input).toHaveAttribute(
    'aria-activedescendant',
    (await design.getAttribute('id')) ?? '',
  );

  await page.keyboard.press('ArrowRight');
  await expect(design).toHaveAttribute('aria-expanded', 'true');
  const library = tree.getByRole('treeitem', {
    name: new RegExp('^Studio / Design / Component library[.]'),
  });
  await expect(library).toBeVisible();
  await expect(input).toHaveAttribute(
    'aria-activedescendant',
    (await library.getAttribute('id')) ?? '',
  );
  expect(await withoutRing(library)).toBe(true);
  await snap(page, 'cascader-keyboard');

  await page.keyboard.press('Enter');
  await expect(page.locator('[data-cascader-primary] [data-cascader-selection]')).toHaveAttribute(
    'data-cascader-selection',
    'studio/design/library',
  );
  await expect(input).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toBeFocused();
});
