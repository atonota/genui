import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

test.use({ viewport: { width: 320, height: 720 } });

type Kind = 'radio' | 'checkbox' | 'switch';

const variants = ['horizontal', 'vertical', 'boxes', 'icon-cards', 'image-cards'];
const choices = [
  ['starter', 'Starter'],
  ['team', 'Team'],
  ['enterprise', 'Enterprise'],
  ['unavailable', 'Unavailable'],
] as const;

// The [data-choice] element either wraps the labelled control or is the control itself.
const control = (choice: Locator, kind: Kind) =>
  choice.getByRole(kind).or(choice.and(choice.page().getByRole(kind)));

const spreadRings = (shadow: string) =>
  shadow === 'none'
    ? []
    : shadow
        .split(/,(?![^(]*\))/)
        .filter(raw => {
          const color =
            raw.match(/(?:rgba?|color|oklch|oklab|lab|lch|hsla?)\([^)]*\)|transparent/i)?.[0] ?? '';
          if (color === 'transparent' || /[,/]\s*0(?:\.0+)?%?\s*\)$/.test(color)) return false;
          const [, , , spread = 0] = (raw.replace(color, '').match(/-?[\d.]+px/g) ?? []).map(
            parseFloat,
          );
          return spread > 0;
        })
        .map(raw => raw.trim());

function cardFacts(card: Locator) {
  return card.evaluate(el => {
    const s = getComputedStyle(el);
    const side = (k: string) =>
      ['width', 'style', 'color'].map(p => s.getPropertyValue(`border-${k}-${p}`)).join(' ');
    return {
      outline: [s.outlineStyle, s.outlineWidth],
      boxShadow: s.boxShadow,
      top: side('top'),
      right: side('right'),
      bottom: side('bottom'),
      left: side('left'),
    };
  });
}

// Selection transitions must finish before the rest baseline is recorded.
async function settledCardFacts(card: Locator) {
  await expect
    .poll(() =>
      card.evaluate(
        el =>
          el
            .getAnimations({ subtree: true })
            .filter(
              a =>
                a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity,
            ).length,
      ),
    )
    .toBe(0);
  return cardFacts(card);
}

type Facts = Awaited<ReturnType<typeof cardFacts>>;

function focusViolations(rest: Facts, now: Facts) {
  const found: string[] = [];
  const [style, width] = now.outline;
  if (style !== 'none' && parseFloat(width) > 0) found.push('enclosing outline');
  const restRings = new Set(spreadRings(rest.boxShadow));
  if (spreadRings(now.boxShadow).some(ring => !restRings.has(ring)))
    found.push('enclosing focus ring');
  for (const side of ['top', 'right', 'left'] as const)
    if (now[side] !== rest[side]) found.push(`changed ${side} border`);
  if (now.bottom === rest.bottom && now.boxShadow === rest.boxShadow)
    found.push('no visible bottom focus marker');
  return found;
}

async function openFamily(page: Page, kind: Kind) {
  await page.goto(`/components/${kind}/`);
  const root = page.locator(`[data-selection-variants="${kind}"]`);
  await expect(root, `${kind} selection variants root`).toBeVisible({ timeout: 2_000 });
  for (const variant of variants) {
    const group = root.locator(`[data-selection-variant="${variant}"]`);
    await expect(group, variant).toHaveCount(1);
    await expect(group.getByRole(kind), `${variant} options`).toHaveCount(4);
    for (const [index, [value, title]] of choices.entries()) {
      const choice = group.locator(`[data-choice="${value}"]`);
      await expect(choice, `${variant} ${value}`).toHaveCount(1);
      await expect(choice.getByText(title, { exact: true })).toBeVisible();
      expect(
        (await choice.innerText()).replace(title, '').trim(),
        `${variant} ${value} description`,
      ).not.toBe('');
      const input = control(choice, kind);
      await expect(input, `${variant} ${value} control`).toHaveCount(1);
      if (index === 0) await expect(input).toBeChecked();
      else await expect(input).not.toBeChecked();
      if (index === 3) await expect(input).toBeDisabled();
      else await expect(input).toBeEnabled();
    }
  }
  return root;
}

async function keyboardFocus(page: Page, input: Locator) {
  await input.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(input).not.toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  expect(await input.evaluate(el => el.matches(':focus-visible'))).toBe(true);
}

async function expectFocusMarker(card: Locator, facts: Record<string, unknown>) {
  const rest = facts.rest as Facts;
  await expect
    .poll(async () => focusViolations(rest, (facts.focused = await cardFacts(card)) as Facts))
    .toEqual([]);
}

async function expectLoadedImage(root: Locator) {
  const images = root.locator('[data-selection-variant="image-cards"] img');
  await expect(images.first()).toBeAttached();
  await images.first().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      images.evaluateAll(els =>
        els.some(
          el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
}

async function expectFits(page: Page, root: Locator) {
  expect(await root.evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
}

async function attachEvidence(page: Page, testInfo: TestInfo, facts: Record<string, unknown>) {
  await testInfo.attach('selection-focus-facts', {
    body: JSON.stringify(facts, null, 2),
    contentType: 'application/json',
  });
  await testInfo.attach('selection-variants', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}

test('radio variants select one card and move with arrow keys', async ({ page }, testInfo) => {
  const facts: Record<string, unknown> = {};
  try {
    const root = await openFamily(page, 'radio');
    const group = root.locator('[data-selection-variant="icon-cards"]');
    const card = (value: string) => group.locator(`[data-choice="${value}"]`);
    const radio = (value: string) => control(card(value), 'radio');

    await card('team').getByText('Team', { exact: true }).click();
    await expect(radio('team')).toBeChecked();
    await expect(radio('starter')).not.toBeChecked();
    await expect(group.getByRole('radio', { checked: true })).toHaveCount(1);

    facts.rest = await settledCardFacts(card('team'));
    await keyboardFocus(page, radio('team'));
    await expectFocusMarker(card('team'), facts);

    await page.keyboard.press('ArrowRight');
    await expect(radio('enterprise')).toBeChecked();
    await expect(radio('enterprise')).toBeFocused();
    await expect(group.getByRole('radio', { checked: true })).toHaveCount(1);

    await card('unavailable').getByText('Unavailable', { exact: true }).click({ force: true });
    await expect(radio('unavailable')).not.toBeChecked();
    await expect(radio('enterprise')).toBeChecked();

    await expectLoadedImage(root);
    await expectFits(page, root);
  } finally {
    await attachEvidence(page, testInfo, facts);
  }
});

for (const kind of ['checkbox', 'switch'] as const) {
  test(`${kind} variants toggle cards independently`, async ({ page }, testInfo) => {
    const facts: Record<string, unknown> = {};
    try {
      const root = await openFamily(page, kind);
      const group = root.locator('[data-selection-variant="icon-cards"]');
      const card = (value: string) => group.locator(`[data-choice="${value}"]`);
      const toggle = (value: string) => control(card(value), kind);

      await card('team').getByText('Team', { exact: true }).click();
      await expect(toggle('starter')).toBeChecked();
      await expect(toggle('team')).toBeChecked();

      facts.rest = await settledCardFacts(card('team'));
      await keyboardFocus(page, toggle('team'));
      await expectFocusMarker(card('team'), facts);

      await page.keyboard.press('Space');
      await expect(toggle('team')).not.toBeChecked();
      await expect(toggle('starter')).toBeChecked();
      await expect(toggle('enterprise')).not.toBeChecked();

      await card('unavailable').getByText('Unavailable', { exact: true }).click({ force: true });
      await expect(toggle('unavailable')).toBeDisabled();
      await expect(toggle('unavailable')).not.toBeChecked();
      await expect(toggle('starter')).toBeChecked();

      await expectLoadedImage(root);
      await expectFits(page, root);
    } finally {
      await attachEvidence(page, testInfo, facts);
    }
  });
}
