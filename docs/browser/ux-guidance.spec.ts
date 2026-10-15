import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const ROOT_TIMEOUT = 2_000;

test.use({ viewport: { width: 320, height: 720 } });

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow, 'page must not overflow horizontally').toBeLessThanOrEqual(0);
}

/** Targeted setup, then a real Shift+Tab/Tab roundtrip so focus ends keyboard-sourced. */
async function focusByKeyboardRoundtrip(page: Page, target: Locator) {
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(target).not.toBeFocused();
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}

/** Inspects the element that paints the cue (Checkbox label underline or Select bottom
    edge): it must be painted, untransitioned and never enclose the control. */
async function expectVisibleNonEncirclingFocus(target: Locator) {
  await expect(target).toBeFocused();
  const focus = await target.evaluate(el => {
    const isTransparent = (color: string) => {
      const compact = color.split(' ').join('');
      return (
        compact === 'transparent' ||
        (compact.startsWith('rgba(') && compact.endsWith(',0)')) ||
        compact.endsWith('/0)')
      );
    };
    const outlined = (style: CSSStyleDeclaration) =>
      style.outlineStyle !== 'none' && (Number.parseFloat(style.outlineWidth) || 0) > 0;
    // A zero-offset shadow with blur or spread draws a ring around the box.
    const ringShadow = (style: CSSStyleDeclaration) => {
      const layers: string[] = [];
      let layer = '';
      let depth = 0;
      for (const char of style.boxShadow === 'none' ? '' : style.boxShadow) {
        if (char === '(') depth += 1;
        else if (char === ')') depth -= 1;
        else if (char === ',' && depth === 0) {
          layers.push(layer);
          layer = '';
        } else if (depth === 0) layer += char;
      }
      layers.push(layer);
      return layers.some(part => {
        const [x = 0, y = 0, blur = 0, spread = 0] = part
          .split(' ')
          .filter(token => token.endsWith('px'))
          .map(token => Number.parseFloat(token));
        return x === 0 && y === 0 && (blur > 0 || spread > 0);
      });
    };
    const encircles = (nodes: (Element | null)[]) =>
      nodes.some(node => {
        if (!node) return false;
        const style = getComputedStyle(node);
        return outlined(style) || ringShadow(style);
      });
    const animates = (style: CSSStyleDeclaration, paints: (property: string) => boolean) => {
      const durations = style.transitionDuration
        .split(',')
        .map(value => Number.parseFloat(value) || 0);
      return style.transitionProperty.split(',').some((value, index) => {
        const property = value.trim();
        const duration = durations[index % durations.length] ?? 0;
        return (property === 'all' || paints(property)) && duration > 0;
      });
    };
    const focusVisible = el.matches(':focus-visible');
    const checkbox = el.closest('.ant-checkbox-wrapper');
    if (checkbox) {
      const label = checkbox.lastElementChild;
      const style = label ? getComputedStyle(label) : null;
      return {
        owner: 'checkbox label underline',
        focusVisible,
        painted:
          style !== null &&
          style.textDecorationLine.includes('underline') &&
          (Number.parseFloat(style.textDecorationThickness) || 0) > 0 &&
          !isTransparent(style.textDecorationColor) &&
          Number(style.opacity) > 0,
        instant:
          style !== null && !animates(style, property => property.startsWith('text-decoration')),
        encircling: encircles([el, checkbox, checkbox.querySelector('.ant-checkbox-inner')]),
      };
    }
    const select = el.closest('.ant-select');
    if (select) {
      const style = getComputedStyle(select);
      return {
        owner: 'select bottom edge',
        focusVisible,
        painted:
          style.borderBottomStyle !== 'none' &&
          (Number.parseFloat(style.borderBottomWidth) || 0) > 0 &&
          !isTransparent(style.borderBottomColor) &&
          style.borderBottomColor !== style.borderTopColor,
        instant: !animates(
          style,
          property =>
            property === 'border' ||
            property === 'border-color' ||
            property.startsWith('border-bottom') ||
            property.startsWith('border-block'),
        ),
        encircling: encircles([el, select]),
      };
    }
    return { owner: 'unknown', focusVisible, painted: false, instant: false, encircling: false };
  });
  expect(focus.owner, 'focus cue needs a known paint owner').not.toBe('unknown');
  expect(focus.focusVisible, 'keyboard focus must be visible').toBe(true);
  expect(focus.painted, `${focus.owner} must be painted`).toBe(true);
  expect(focus.instant, `${focus.owner} must appear without a transition`).toBe(true);
  expect(focus.encircling, 'focus indicator must not encircle the control').toBe(false);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

async function isMixed(checkbox: Locator) {
  return checkbox.evaluate(
    el => (el as HTMLInputElement).indeterminate || el.getAttribute('aria-checked') === 'mixed',
  );
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactText = (text: string) => new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`);

/** Visible items of the open AntD Select popup; AntD renders its own listbox, not an OS select. */
function visibleSelectOptions(page: Page) {
  return page.locator('.ant-select-dropdown .ant-select-item-option:visible');
}

async function chooseSelectOption(page: Page, combobox: Locator, label: string) {
  await combobox.click();
  const option = visibleSelectOptions(page).filter({ hasText: exactText(label) });
  await expect(option).toHaveCount(1);
  await option.click();
}

test('bulk checkbox selects available options and switch card updates status immediately', async ({
  page,
}, testInfo) => {
  await page.goto('/components/checkbox/');
  const root = page.locator('[data-selection-variants="checkbox"]');
  await expect(root).toBeVisible({ timeout: ROOT_TIMEOUT });
  const group = root.locator('[data-selection-variant="vertical"]');
  await expect(group).toBeVisible({ timeout: ROOT_TIMEOUT });
  // The bulk toolbar shares the group's fieldset but stays outside the option scope.
  const fieldset = root
    .locator('fieldset')
    .filter({ has: page.locator('[data-selection-variant="vertical"]') });
  await expect(fieldset).toHaveCount(1);

  const choices = await group
    .locator('[data-choice]')
    .evaluateAll(els => els.map(el => el.getAttribute('data-choice')));
  expect(choices).toEqual(['starter', 'team', 'enterprise', 'unavailable']);
  await expect(group.getByRole('checkbox')).toHaveCount(4);

  const parent = fieldset.getByRole('checkbox', { name: 'Select available options' });
  await expect(parent).toBeVisible({ timeout: ROOT_TIMEOUT });
  await expect(fieldset.locator('[data-selection-bulk="true"]')).toHaveCount(1);
  await expect(group.getByRole('checkbox', { name: 'Select available options' })).toHaveCount(0);
  const option = (choice: string) =>
    group.locator(`[data-choice="${choice}"]`).getByRole('checkbox');
  const available = ['starter', 'team', 'enterprise'].map(option);
  const unavailable = option('unavailable');

  await expect(option('starter')).toBeChecked();
  expect(await isMixed(parent), 'parent must be mixed with a partial selection').toBe(true);

  const cardHeights = () =>
    group
      .locator('[data-choice]')
      .evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
  await focusByKeyboardRoundtrip(page, parent);
  await expectVisibleNonEncirclingFocus(parent);
  // Selecting must not resize cards: the badge space is reserved in both states.
  const heightsBefore = await cardHeights();
  expect(heightsBefore).toHaveLength(4);
  await page.keyboard.press('Space');

  for (const checkbox of available) await expect(checkbox).toBeChecked();
  const heightsAfter = await cardHeights();
  expect(heightsAfter).toHaveLength(4);
  for (const [index, height] of heightsAfter.entries()) {
    const before = heightsBefore[index] ?? Number.NaN;
    expect(Math.abs(height - before), `${choices[index]} card height`).toBeLessThanOrEqual(0.5);
  }
  await expect(unavailable).toBeDisabled();
  await expect(unavailable).not.toBeChecked();
  await expect(parent).toBeChecked();
  expect(await isMixed(parent)).toBe(false);
  await expectNoPageOverflow(page);
  await attachScreenshot(page, testInfo, 'checkbox-bulk-selected');

  const clear = fieldset.locator('button[data-selection-clear="true"]');
  await expect(clear).toBeEnabled();
  await clear.click();
  for (const checkbox of available) await expect(checkbox).not.toBeChecked();
  await expect(parent).not.toBeChecked();
  expect(await isMixed(parent)).toBe(false);
  await expect(clear).toBeDisabled();
  await attachScreenshot(page, testInfo, 'checkbox-cleared');

  await page.goto('/components/switch/');
  const switchRoot = page.locator('[data-selection-variants="switch"]');
  await expect(switchRoot).toBeVisible({ timeout: ROOT_TIMEOUT });
  const switchGroup = switchRoot.locator('[data-selection-variant="vertical"]');
  const teamSwitch = switchGroup.getByRole('switch', { name: /Team/ });
  await expect(teamSwitch).toBeVisible({ timeout: ROOT_TIMEOUT });
  const teamTitle = switchGroup
    .locator('label')
    .filter({ has: teamSwitch })
    .getByText('Team', { exact: true });
  const status = switchGroup.getByRole('status');

  const wasChecked = await teamSwitch.isChecked();
  await teamTitle.click();
  await expect(teamSwitch).toBeChecked({ checked: !wasChecked });
  if (wasChecked) {
    await expect(status).not.toContainText('Team');
    await teamTitle.click();
    await expect(teamSwitch).toBeChecked();
  }
  await expect(status).toBeVisible();
  await expect(status).toContainText('Team');
  await expect(switchGroup.getByRole('button', { name: /apply/i })).toHaveCount(0);
  await expectNoPageOverflow(page);
  await attachScreenshot(page, testInfo, 'switch-team-immediate');
});

test('report date range keeps draft separate until apply and restores on cancel', async ({
  page,
}, testInfo) => {
  await page.goto('/components/date-time/');
  const root = page.locator('[data-date-range-filter]');
  await expect(root).toBeVisible({ timeout: ROOT_TIMEOUT });
  const shortcut = root.getByRole('combobox', { name: 'Date range shortcut' });
  const shortcutRoot = root
    .locator('.ant-select')
    .filter({ has: page.getByRole('combobox', { name: 'Date range shortcut' }) });
  const result = root.locator('output[data-date-filter-result]');
  const apply = root.getByRole('button', { name: 'Apply', exact: true });
  const cancel = root.getByRole('button', { name: 'Cancel', exact: true });

  await expect(root.locator('time[datetime^="2026-10-14"]').first()).toBeVisible();
  await expect(result).toContainText('2026-10-08');
  await expect(result).toContainText('2026-10-14');

  await chooseSelectOption(page, shortcut, 'Last 30 days');
  await expect(shortcutRoot).toContainText('Last 30 days');
  await expect(result).toContainText('2026-10-08');
  await expect(result).not.toContainText('2026-09-15');

  await apply.click();
  await expect(result).toContainText('2026-09-15');
  await expect(result).toContainText('2026-10-14');
  await expect(result).not.toContainText('2026-10-08');

  await chooseSelectOption(page, shortcut, 'Latest available day');
  await expect(shortcutRoot).toContainText('Latest available day');
  await expect(result).toContainText('2026-09-15');
  await cancel.click();
  await expect(shortcutRoot).toContainText('Last 30 days');
  await expect(result).toContainText('2026-09-15');
  await expect(result).toContainText('2026-10-14');
  await attachScreenshot(page, testInfo, 'date-range-applied-after-cancel');

  const compare = root.getByRole('checkbox', { name: 'Compare with another period' });
  await focusByKeyboardRoundtrip(page, compare);
  await expectVisibleNonEncirclingFocus(compare);
  const appliedText = await result.textContent();
  await page.keyboard.press('Space');
  await expect(compare).toBeChecked();
  const comparison = root.getByRole('group', { name: 'Comparison period' });
  await expect(comparison).toBeVisible();
  const comparisonStart = comparison.getByPlaceholder('Start date');
  const comparisonEnd = comparison.getByPlaceholder('End date');
  await expect(comparisonStart).toBeVisible();
  await expect(comparisonEnd).toBeVisible();
  await expect(root.getByPlaceholder('Start date')).toHaveCount(2);
  await expect(comparisonStart).toHaveValue('2026-08-16');
  await expect(comparisonEnd).toHaveValue('2026-09-14');
  await expect(result).toHaveText(appliedText ?? '');
  await expect(result).not.toContainText('2026-08-16');

  // An edited comparison stays an unapplied change even after it is switched off.
  await comparisonStart.fill('2026-08-15');
  await page.keyboard.press('Enter');
  await compare.focus();
  await expect(comparisonStart).toHaveValue('2026-08-15');
  await page.keyboard.press('Space');
  await expect(compare).not.toBeChecked();
  await expect(comparison).toHaveCount(0);
  await expect(cancel).toBeEnabled();
  await expect(result).toHaveText(appliedText ?? '');
  await cancel.click();
  await expect(cancel).toBeDisabled();
  await expect(compare).not.toBeChecked();
  await expect(shortcutRoot).toContainText('Last 30 days');
  await compare.focus();
  await page.keyboard.press('Space');
  await expect(compare).toBeChecked();
  await expect(comparisonStart).toHaveValue('2026-08-16');
  await expect(comparisonEnd).toHaveValue('2026-09-14');
  await expect(result).toHaveText(appliedText ?? '');

  await apply.click();
  await expect(result).toContainText('2026-09-15');
  await expect(result).toContainText('2026-08-16');
  await expect(result).toContainText('2026-09-14');
  await expectNoPageOverflow(page);
  await attachScreenshot(page, testInfo, 'date-range-comparison-applied');
});

test('department select creates a missing option once and clear returns focus', async ({
  page,
}, testInfo) => {
  await page.goto('/components/select/');
  const root = page.locator('[data-department-select]');
  await expect(root).toBeVisible({ timeout: ROOT_TIMEOUT });
  const combobox = root.getByRole('combobox', { name: 'Department' });
  const result = root.locator('output[data-department-result]');
  const options = visibleSelectOptions(page);
  const option = (label: string) => options.filter({ hasText: exactText(label) });
  const createOptions = options.filter({ hasText: /^\s*Create/ });

  await focusByKeyboardRoundtrip(page, combobox);
  await expectVisibleNonEncirclingFocus(combobox);
  await combobox.fill('Engineering');
  await expect(option('Engineering')).toHaveCount(1);
  await option('Engineering').click();
  await expect(result).toContainText('Engineering');
  await attachScreenshot(page, testInfo, 'department-engineering');

  await root.getByRole('button', { name: 'Clear department' }).click();
  await expect(combobox).toBeFocused();
  await expect(combobox).toHaveValue('');
  await expect(result).not.toContainText('Engineering');
  await expect(result).toHaveText(/\S/);

  await combobox.fill('Research');
  await expect(option('Create “Research”')).toHaveCount(1);
  await expect(option('Research')).toHaveCount(0);
  await option('Create “Research”').click();
  await expect(result).toContainText('Research');
  await attachScreenshot(page, testInfo, 'department-research-created');

  await root.getByRole('button', { name: 'Clear department' }).click();
  await expect(combobox).toBeFocused();
  await combobox.fill('research');
  await expect(option('Research')).toHaveCount(1);
  await expect(createOptions).toHaveCount(0);
  await expect(root.getByText('Department', { exact: true }).first()).toBeVisible();
  await expect(combobox).toBeVisible();
  await expectNoPageOverflow(page);
  await attachScreenshot(page, testInfo, 'department-research-existing');
});
