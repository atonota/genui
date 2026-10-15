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

test('Listy reference variants and shared inset surface are functional', async ({ page }) => {
  // Contract: every reference pattern is a live section [data-listy-pattern=<id>] rendering a native
  // AntD Listy (key-value lives under plain, loading/empty under status). Controls use the English
  // names below; outcomes are announced by a role="status" region inside the same section.
  const ids = (
    'plain unordered ordered icon select checkbox settings actions ' +
    'draggable steps status rich nested market grouped virtual'
  ).split(' ');
  const pattern = (id: string) => page.locator(`[data-listy-pattern="${id}"]`);
  const noOverflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
  // Central listy-surface role: inset draws an inner shadow, outlined one outer border; rows never.
  const surface = () =>
    pattern('plain').evaluate(section => {
      const edges = (element: Element | null | undefined) => {
        if (!element) return [0, 0, 0, 0];
        const style = getComputedStyle(element);
        return ['top', 'right', 'bottom', 'left'].map(side =>
          style.getPropertyValue(`border-${side}-style`) === 'none'
            ? 0
            : parseFloat(style.getPropertyValue(`border-${side}-width`)),
        );
      };
      const root = section.querySelector('.ant-listy');
      const rows = [...section.querySelectorAll('[data-atlas-listy-item]')];
      if (!root || !rows.length) return null;
      return {
        outlined: root.classList.contains('atlas-listy-outlined'),
        outer: edges(root).every(width => width > 0),
        frame: edges(root.parentElement?.closest('.atlas-listy-frame')).some(width => width > 0),
        rows: rows.flatMap(row => edges(row)).reduce((sum, width) => sum + width, 0),
        insetShadow: getComputedStyle(root).boxShadow.includes('inset'),
      };
    });
  // Readable visual-QA captures: viewport-sized, plain pattern in view, Tweaker closed (no blur).
  const captureReference = async (name: string) => {
    // Deterministic screenshot preparation, not an Escape assertion: a single Escape after the
    // native Listy surface Select is not asserted to close the outer Tweaker, so close it through
    // its real Close tweaker button when it is still visible.
    // Settle only the Tweaker Drawer's own closing motion: a Drawer still closing after Escape
    // would otherwise read as visible while its Close button moves out of the viewport. Owners are
    // the Drawer root, mask and content wrapper themselves (no subtree), so Listy spinners, virtual
    // lists and native controls elsewhere are never sampled. Only running finite animations are
    // awaited (paused/idle/infinite ignored) and re-sampled after two frames; no fixed sleeps.
    await page.evaluate(async () => {
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
      const owners = () => {
        const roots = new Set<Element>();
        for (const panel of document.querySelectorAll('.atlas-tweaker-panel')) {
          roots.add(panel);
          const drawer = panel.closest('.ant-drawer');
          if (drawer) roots.add(drawer);
        }
        const found = new Set<Element>(roots);
        for (const root of roots)
          for (const part of root.querySelectorAll(
            '.ant-drawer, .ant-drawer-mask, .ant-drawer-content-wrapper',
          ))
            found.add(part);
        return [...found];
      };
      for (;;) {
        await frame();
        await frame();
        const pending = owners()
          .flatMap(owner => owner.getAnimations())
          .filter(animation => {
            const end = animation.effect?.getComputedTiming().endTime;
            return (
              animation.playState === 'running' && typeof end === 'number' && Number.isFinite(end)
            );
          });
        if (!pending.length) return;
        await Promise.all(pending.map(animation => animation.finished.catch(() => undefined)));
      }
    });
    const dialog = page.locator('.atlas-tweaker-panel [role="dialog"]');
    if (await dialog.isVisible())
      await dialog.getByRole('button', { name: 'Close tweaker', exact: true }).click();
    // The fixed Drawer root stays mounted while closed; wait until its dialog is physically hidden.
    await expect(dialog).toBeHidden();
    await pattern('plain').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath(`listy-cascader-${stage}-${name}.png`),
      fullPage: false,
    });
  };

  await page.setViewportSize({ width: 320, height: 720 });
  const response = await page.goto(`${origin}/components/listy/`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  for (const id of ids) {
    await expect(pattern(id), id).toHaveCount(1);
    await expect(pattern(id).locator('.ant-listy').first(), id).toBeVisible();
  }
  // Native Listy hosts are the visible rows: the first plain host holds the default 40px compact
  // height and draws no border on any physical or logical side; sections keep whitespace apart.
  const host = await pattern('plain')
    .locator('[data-atlas-listy-item]')
    .first()
    .evaluate(row => {
      const item = row.closest('.ant-listy-item');
      if (!item) return null;
      const style = getComputedStyle(item);
      const sides = [
        'top',
        'right',
        'bottom',
        'left',
        'block-start',
        'block-end',
        'inline-start',
        'inline-end',
      ];
      return {
        height: Math.round(item.getBoundingClientRect().height),
        border: sides.reduce((sum, side) => {
          const line = style.getPropertyValue(`border-${side}-style`);
          return !line || line === 'none'
            ? sum
            : sum + (parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0);
        }, 0),
      };
    });
  expect(host).toEqual({ height: 40, border: 0 });
  const sectionGap = await page.evaluate(() => {
    const [first, second] = [...document.querySelectorAll('[data-listy-pattern]')];
    if (!first || !second) return null;
    return second.getBoundingClientRect().top - first.getBoundingClientRect().bottom;
  });
  expect(sectionGap).toBeGreaterThanOrEqual(16);
  expect(await noOverflow()).toBe(true);
  const richText = await typography(pattern('rich').locator('[data-atlas-listy-item]').first());
  expect(richText.size).toBeGreaterThanOrEqual(14);
  expect(richText.family).toContain('Outfit');
  await expect.poll(surface).toMatchObject({ outlined: false, rows: 0, insetShadow: true });
  await captureReference('patterns-320-inset');

  const select = pattern('select');
  const product = select.getByRole('radio', { name: 'Product design' });
  await product.check();
  await expect(product).toBeChecked();
  await expect(select.getByRole('status')).toContainText('Selected');
  await expect(select.getByRole('status')).toContainText('Product design');

  const multi = pattern('checkbox');
  const picks = ['Design', 'Engineering'].map(name =>
    multi.getByRole('checkbox', { name, exact: true }),
  );
  for (const pick of picks) await pick.check();
  await expect(multi.getByRole('status')).toContainText('2 selected');
  await expect
    .poll(() =>
      multi
        .getByRole('checkbox', { name: 'Select all' })
        .evaluate(
          box =>
            (box as HTMLInputElement).indeterminate || box.getAttribute('aria-checked') === 'mixed',
        ),
    )
    .toBe(true);
  await multi.getByRole('button', { name: 'Clear selection' }).click();
  for (const pick of picks) await expect(pick).not.toBeChecked();
  await expect(multi.getByRole('status')).toContainText('0 selected');

  const toggle = pattern('settings').getByRole('switch', { name: 'Notifications' });
  const wasOn = (await toggle.getAttribute('aria-checked')) === 'true';
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(!wasOn));

  const actions = pattern('actions');
  const opens = actions.getByRole('button', { name: /^Open record / });
  expect(await opens.count()).toBeGreaterThan(1);
  for (const index of [0, 1]) {
    const record = await opens
      .nth(index)
      .evaluate(button =>
        (button.getAttribute('aria-label') ?? button.textContent ?? '')
          .replace('Open record', '')
          .trim(),
      );
    await opens.nth(index).click();
    await expect(actions.getByRole('status')).toContainText(`Opened ${record}`);
  }

  // Reorder: the named native radio selects Documentation by keyboard; a toolbar outside the
  // list moves it while the radio keeps its checked state.
  const drag = pattern('draggable');
  const order = () => drag.locator('[data-atlas-listy-item] .atlas-listy-label').allTextContents();
  const initial = await order();
  expect(initial).toHaveLength(3);
  const docs = drag.getByRole('radio', { name: /^Documentation, position [0-9] of 3$/ });
  await expect(docs).toHaveCount(1);
  await expect(docs).not.toBeChecked();
  await docs.focus();
  await page.keyboard.press('Space');
  await expect(docs).toBeChecked();
  await expect(drag.getByRole('status')).toContainText('Selected Documentation');
  const from = initial.indexOf('Documentation'),
    to = from < 2 ? from + 1 : from - 1;
  const moved = [...initial];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  const [forward, back] = from < 2 ? ['Move down', 'Move up'] : ['Move up', 'Move down'];
  for (const [name, expected] of [
    [forward, moved],
    [back, initial],
  ] as const) {
    const button = drag.getByRole('button', { name, exact: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect.poll(order).toEqual(expected);
    await expect(button).toBeFocused();
  }
  await expect(docs).toBeChecked();
  await expect(drag.getByRole('status')).toContainText('Documentation moved to position');

  const grouped = pattern('grouped');
  // The callback classNames form resolves through AtlasListy and keeps the shared header class.
  const teamHeader = grouped.locator('.atlas-listy-team-header').first();
  await expect(teamHeader).toBeVisible();
  await expect(teamHeader).toHaveClass(/(^| )atlas-listy-group-header( |$)/);
  await grouped.locator('.ant-listy').first().hover();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() =>
      grouped.evaluate(root => {
        const scroller = [...root.querySelectorAll<HTMLElement>('*')].find(
          element => element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1,
        );
        if (!scroller || scroller.scrollTop <= 0) return false;
        const box = scroller.getBoundingClientRect();
        return [...scroller.querySelectorAll<HTMLElement>('*')].some(header => {
          if (getComputedStyle(header).position !== 'sticky') return false;
          const rect = header.getBoundingClientRect();
          return rect.height > 0 && rect.top >= box.top - 1 && rect.top <= box.top + 24;
        });
      }),
    )
    .toBe(true);

  const virtual = pattern('virtual');
  const virtualRows = virtual.locator('[data-atlas-listy-item]');
  // Only rendered row labels count; the live status region may echo the jumped record.
  const virtualRow = (label: string) =>
    virtualRows.filter({
      has: page.locator('.atlas-listy-label', { hasText: new RegExp(`^${label}$`) }),
    });
  await expect(virtualRow('Record 1')).toBeVisible();
  await expect(virtualRow('Record 10000')).toHaveCount(0);
  const extent = await virtual.evaluate(root => {
    const scroller = [...root.querySelectorAll<HTMLElement>('*')].find(
      element => element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1,
    );
    const row = root.querySelector('[data-atlas-listy-item]');
    if (!scroller || !row) return null;
    return {
      bounded: scroller.clientHeight <= window.innerHeight,
      rows: scroller.scrollHeight / row.getBoundingClientRect().height,
    };
  });
  expect(extent?.bounded).toBe(true);
  expect(extent?.rows).toBeGreaterThan(5000);
  await virtual.getByRole('button', { name: 'Jump to last item' }).click();
  await expect(virtualRow('Record 10000')).toBeVisible();
  await expect(virtualRow('Record 1')).toHaveCount(0);
  expect(await virtualRows.count()).toBeGreaterThan(0);
  expect(await virtualRows.count()).toBeLessThan(100);

  await page.setViewportSize({ width: 1280, height: 900 });
  await captureReference('patterns-desktop-inset');
  await page.locator('[data-tweaker-trigger]').click();
  const combo = page
    .locator('.atlas-tweaker-panel')
    .getByRole('combobox', { name: 'Listy surface' });
  await combo.focus();
  await page.keyboard.press('ArrowDown');
  for (let step = 0; step < 4; step += 1) {
    const active = await combo.getAttribute('aria-activedescendant');
    const text = active
      ? await page
          .locator(`[id="${active}"]`)
          .evaluate(option => `${option.getAttribute('aria-label') ?? ''} ${option.textContent}`)
      : '';
    if (/outlined/i.test(text)) break;
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect.poll(surface).toMatchObject({ outlined: true, outer: true, frame: false, rows: 0 });
  await captureReference('patterns-desktop-outlined');
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await noOverflow()).toBe(true);
  await captureReference('patterns-320-outlined');

  // The same central role reaches native Cascader rows; native keyboard stays intact.
  const cascader = await page.goto(`${origin}/components/cascader/`);
  expect(cascader?.ok()).toBe(true);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  const input = page.locator(
    '[data-cascader-primary] [data-cascader-field] input[role="combobox"]',
  );
  await tabTo(page, input);
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  const popup = page.locator('[data-cascader-primary] .atlas-cascader-popup');
  await expect(popup).toHaveClass(/(^| )atlas-listy-outlined( |$)/);
  const rowBorder = await popup
    .locator('[data-atlas-listy-item]')
    .first()
    .evaluate(row => {
      const style = getComputedStyle(row);
      return ['top', 'right', 'bottom', 'left'].reduce(
        (sum, side) =>
          style.getPropertyValue(`border-${side}-style`) === 'none'
            ? sum
            : sum + parseFloat(style.getPropertyValue(`border-${side}-width`)),
        0,
      );
    });
  expect(rowBorder).toBe(0);
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', /.+/);
  await page.keyboard.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toBeFocused();
});
