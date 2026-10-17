import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import definitions from '../src/theme-builder/definitions.json' with { type: 'json' };

// Explicit user request (2026-10-15): an GenUXBadge catalog page with fixed 20/26/32 geometry,
// and the general radius role edited as four choices without discarding numeric custom recipes.
const origin = process.env.GENUX_DOCS_ORIGIN ?? 'http://127.0.0.1:4324';
const stage = (process.env.GENUX_SOURCE_STAGE ?? 'unlabeled').replace(/[^a-z0-9-]/gi, '-');
const badgeRoute = '/components/badge/';
const inputRoute = '/components/input/';
const buttonRoute = '/components/button/';
const tokensRoute = '/tokens/';
const RECIPE_KEY = 'genux-theme-builder-v1';
const THEME_KEY = 'genux-theme';
const radiusLabel = 'Radius MD';
const radiusChoices = ['0px', '3px', '5px', '100%'];
const radiusIds = ['radius-sm', 'radius-md', 'radius-lg'];
const badgeIds = ['size-badge-sm', 'size-badge-md', 'size-badge-lg'];
const heights: Record<string, number> = { sm: 20, md: 26, lg: 32 };

type Definition = {
  id: string;
  label: string;
  kind: string;
  options?: readonly string[];
  defaults: { light: string | number; dark: string | number };
};
type Recipe = { light: Record<string, unknown>; dark: Record<string, unknown> };
const tokens = definitions as readonly Definition[];
const px = (value: unknown) => (typeof value === 'number' ? `${value}px` : String(value));
const radii = (value: string) => ({ wrapper: [value, value], slot: [value, value] });

test.use({ locale: 'en-US' });

const hydrated = (page: Page) => expect(page.locator('astro-island[ssr]')).toHaveCount(0);

// Geometry is read only after every finite animation has finished; no fixed sleeps.
function settle(page: Page) {
  return page.evaluate(async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    for (;;) {
      await frame();
      await frame();
      const pending = document.getAnimations().filter(animation => {
        const end = animation.effect?.getComputedTiming().endTime;
        return (
          animation.playState !== 'finished' && typeof end === 'number' && Number.isFinite(end)
        );
      });
      if (!pending.length) return;
      await Promise.all(pending.map(animation => animation.finished.catch(() => undefined)));
    }
  });
}

async function attachShot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${name}-${stage}.png`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}

async function openTweaker(page: Page) {
  await page
    .locator('.genux-tweaker-trigger')
    .first()
    .getByRole('button', { name: 'Open tweaker' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Tweaker' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeTweaker(page: Page, dialog: Locator) {
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

const storageKeys = (page: Page) => page.evaluate(() => Object.keys(window.localStorage));

// Accepts both the legacy raw recipe and the shared store envelope.
const stored = (page: Page) =>
  page.evaluate(key => {
    const text = window.localStorage.getItem(key);
    const parsed = text ? JSON.parse(text) : null;
    return (parsed?.recipe ?? parsed) as Recipe | null;
  }, RECIPE_KEY);

const popupOptions = (page: Page) =>
  page.locator('.ant-select-dropdown:visible .ant-select-item-option');

// Opens the Radius MD choice editor and returns the offered option texts with the popup open.
async function listRadius(page: Page, dialog: Locator) {
  await dialog.getByRole('combobox', { name: radiusLabel, exact: true }).click();
  await expect(popupOptions(page).first()).toBeVisible();
  await settle(page);
  return (await popupOptions(page).allInnerTexts()).map(text => text.trim());
}

async function chooseRadius(page: Page, value: string) {
  const dialog = await openTweaker(page);
  await listRadius(page, dialog);
  await popupOptions(page).getByText(value, { exact: true }).first().click();
  await expect(popupOptions(page), `choosing ${value} closes the popup`).toHaveCount(0);
  await closeTweaker(page, dialog);
  await settle(page);
}

// Marks the first visible slot action and its rounded field well; 0px later keeps the same pair.
function markField(page: Page) {
  return page.evaluate(() => {
    document
      .querySelectorAll('[data-radius-probe]')
      .forEach(el => el.removeAttribute('data-radius-probe'));
    const shown = (el: Element) =>
      el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const slot = [...document.querySelectorAll('.genux-slot-button')].find(
      el => !el.closest('.genux-tweaker-panel') && shown(el),
    );
    let wrapper = slot?.parentElement ?? null;
    while (
      wrapper &&
      !(
        wrapper.querySelector('input:not([type=hidden])') &&
        parseFloat(getComputedStyle(wrapper).borderStartEndRadius) > 0
      )
    )
      wrapper = wrapper.parentElement;
    if (!slot || !wrapper) return false;
    slot.setAttribute('data-radius-probe', 'slot');
    wrapper.setAttribute('data-radius-probe', 'wrapper');
    return true;
  });
}

// Computed end-side corners keep percentages, so 100% is compared as the CSS string.
function fieldRadii(page: Page) {
  return page.evaluate(() => {
    const end = (probe: string) => {
      const el = document.querySelector(`[data-radius-probe=${probe}]`);
      if (!el) return null;
      const style = getComputedStyle(el);
      return [style.borderStartEndRadius, style.borderEndEndRadius];
    };
    return { wrapper: end('wrapper'), slot: end('slot') };
  });
}

function buttonRadii(page: Page) {
  return page.evaluate(() => {
    const shown = (el: Element) =>
      el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const button = [...document.querySelectorAll('.genux-button')].find(
      el =>
        !el.matches('.genux-slot-button, .genux-icon-button') &&
        !el.closest('.genux-tweaker-panel, .genux-tweaker-trigger, [data-tweaker-settings]') &&
        shown(el),
    );
    if (!button) return null;
    const style = getComputedStyle(button);
    return [
      style.borderStartStartRadius,
      style.borderStartEndRadius,
      style.borderEndStartRadius,
      style.borderEndEndRadius,
    ];
  });
}

test('Badge page: controlled native badges keep 20/26/32 geometry, Outfit 14/400 and keyboard dismissal', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const response = await page.goto(new URL(badgeRoute, origin).href);
  // RED evidence: the catalog fallback is attached only when the Badge page is explicitly absent.
  if (!response?.ok()) await attachShot(page, testInfo, 'badge-page-absent');
  expect(response?.status(), 'Badge catalog page exists').toBeLessThan(400);
  await hydrated(page);

  const demo = page.locator('[data-demo=badge]');
  await expect(demo).toHaveCount(1);
  const caseOf = (id: string) => demo.locator(`[data-badge-case=${id}]`);
  const bodyIn = (id: string) => caseOf(id).locator('.genux-badge-body').first();

  // Passive: label/count bodies, ribbon strips and the reserved dot box paint the profile height.
  async function expectGeometry(label: string) {
    for (const size of Object.keys(heights)) {
      const root = caseOf(`size-${size}`).locator('.genux-badge').first();
      await expect(root, `${label}: size-${size} is a label`).toHaveAttribute('data-kind', 'label');
      await expect(root).toHaveAttribute('data-size', size);
    }
    await settle(page);
    const painted = await demo.locator('.genux-badge').evaluateAll(roots =>
      roots.map(root => {
        const kind = root.getAttribute('data-kind');
        const pick = (selector: string) =>
          root.matches(selector) ? root : root.querySelector(selector);
        const target =
          kind === 'dot' ? root : pick(kind === 'ribbon' ? '.ant-ribbon' : '.genux-badge-body');
        return {
          kind,
          size: root.getAttribute('data-size') ?? '',
          variant: root.getAttribute('data-variant'),
          height: target ? target.getBoundingClientRect().height : -1,
          // Only the known count-zero case may lack a body; its visibility is asserted below.
          hiddenZero: kind === 'count' && !target && !!root.closest('[data-badge-case=count-zero]'),
        };
      }),
    );
    expect([...new Set(painted.map(badge => badge.kind))].sort(), `${label}: every kind`).toEqual([
      'count',
      'dot',
      'label',
      'ribbon',
    ]);
    expect(
      painted.map(badge => badge.variant),
      `${label}: every variant`,
    ).toEqual(expect.arrayContaining(['solid', 'soft', 'outlined']));
    expect(
      painted.filter(badge => badge.hiddenZero).length,
      `${label}: only the count-zero root may omit its body`,
    ).toBeLessThanOrEqual(1);
    for (const badge of painted.filter(entry => !entry.hiddenZero))
      expect(
        Math.abs(badge.height - heights[badge.size]),
        `${label}: ${badge.kind} ${badge.size} paints ${heights[badge.size]}px (measured ${badge.height}px)`,
      ).toBeLessThanOrEqual(0.5);
  }

  // Visual review (2026-10-16): headings, groups and cases keep attached overhangs clear; rows
  // wrap inside the viewport at 320 and desktop widths instead of touching or overlapping.
  async function expectLayout(label: string) {
    await settle(page);
    const layout = await demo.locator('.genux-badge-demo-group').evaluateAll(groups => {
      type Box = { top: number; bottom: number; left: number; right: number };
      const painted = (el: Element) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      };
      const box = (el: Element): Box => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      };
      // An item's extent includes every painted badge part that overhangs its host.
      const parts = '.genux-badge-body, .ant-badge-dot, .ant-ribbon, .ant-scroll-number';
      const extent = (el: Element) =>
        [el, ...el.querySelectorAll(parts)]
          .filter(painted)
          .map(box)
          .reduce((all, part) => ({
            top: Math.min(all.top, part.top),
            bottom: Math.max(all.bottom, part.bottom),
            left: Math.min(all.left, part.left),
            right: Math.max(all.right, part.right),
          }));
      return groups.map(group => {
        const heading = group.querySelector(':scope > h3');
        const row = group.querySelector(':scope > .genux-badge-demo-row');
        return {
          title: heading?.textContent?.trim() ?? '',
          heading: heading ? box(heading) : null,
          wrap: row ? getComputedStyle(row).flexWrap : null,
          items: row
            ? [...row.children].filter(painted).map(item => ({
                id: item.getAttribute('data-badge-case') ?? item.textContent?.trim() ?? '',
                ...extent(item),
              }))
            : [],
        };
      });
    });
    const viewport = await page.evaluate(() => window.innerWidth);
    const clearance = 4;
    expect(layout.length, `${label}: every example group`).toBeGreaterThanOrEqual(10);
    let previous = { title: 'page start', bottom: -Infinity };
    for (const group of layout) {
      const heading = group.heading;
      expect(heading, `${label}: ${group.title} has its heading`).not.toBeNull();
      if (!heading) continue;
      expect(group.wrap, `${label}: ${group.title} row wraps`).toBe('wrap');
      expect(group.items.length, `${label}: ${group.title} shows its cases`).toBeGreaterThan(0);
      expect(
        heading.top - previous.bottom,
        `${label}: ${group.title} heading clears ${previous.title} badges`,
      ).toBeGreaterThanOrEqual(clearance);
      for (const item of group.items) {
        expect(
          item.top - heading.bottom,
          `${label}: ${item.id} clears the ${group.title} heading`,
        ).toBeGreaterThanOrEqual(clearance);
        expect(
          item.left >= -0.5 && item.right <= viewport + 0.5,
          `${label}: ${item.id} stays inside ${viewport}px`,
        ).toBe(true);
      }
      group.items.forEach((a, index) => {
        for (const b of group.items.slice(index + 1))
          expect(
            a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
            `${label}: ${a.id} and ${b.id} do not overlap`,
          ).toBe(true);
      });
      previous = {
        title: group.title,
        bottom: Math.max(heading.bottom, ...group.items.map(item => item.bottom)),
      };
    }
  }

  await expectGeometry('default');
  await expectLayout('default');

  const type = await demo.locator('.genux-badge-body, .ant-ribbon-text').evaluateAll(nodes =>
    nodes
      .filter(node => node.textContent?.trim())
      .map(node => {
        const style = getComputedStyle(node);
        return {
          text: node.textContent?.trim(),
          size: parseFloat(style.fontSize),
          weight: style.fontWeight,
          family: style.fontFamily,
        };
      }),
  );
  expect(type.length).toBeGreaterThan(0);
  for (const entry of type) {
    expect(entry.size, `${entry.text} is at least 14px`).toBeGreaterThanOrEqual(14);
    expect(entry.weight, `${entry.text} uses weight 400`).toBe('400');
    expect(entry.family, `${entry.text} lists Outfit first`).toMatch(/^.?Outfit/);
  }

  // The dot keeps its reserved profile box with a smaller native interior dot and no outline.
  const dots = await demo.locator('.genux-badge[data-kind=dot]').evaluateAll(roots =>
    roots.map(root => {
      const dot = root.querySelector('.ant-badge-dot');
      const style = dot ? getComputedStyle(dot) : null;
      return {
        root: root.getBoundingClientRect().height,
        dot: dot ? dot.getBoundingClientRect().height : 0,
        outline: style
          ? style.outlineStyle === 'none' || parseFloat(style.outlineWidth) === 0
          : false,
      };
    }),
  );
  expect(dots.length).toBeGreaterThan(0);
  for (const dot of dots) {
    expect(dot.dot, 'native dot is painted').toBeGreaterThan(0);
    expect(dot.dot, 'native dot sits inside its reserved box').toBeLessThan(dot.root);
    expect(dot.outline, 'dot has no outline').toBe(true);
  }

  const paints: string[] = [];
  for (const variant of ['solid', 'soft', 'outlined']) {
    await expect(caseOf(`variant-${variant}`).locator('.genux-badge').first()).toHaveAttribute(
      'data-variant',
      variant,
    );
    paints.push(
      await bodyIn(`variant-${variant}`).evaluate(el => {
        const style = getComputedStyle(el);
        return [
          style.backgroundColor,
          style.borderTopColor,
          style.borderTopWidth,
          style.color,
        ].join('|');
      }),
    );
  }
  expect(new Set(paints).size, 'solid, soft and outlined paint differently').toBe(3);

  // Statuses carry readable text, never color alone.
  const statuses: string[] = [];
  for (const status of ['success', 'warning', 'danger']) {
    const body = bodyIn(`status-${status}`);
    await expect(body, `${status} has readable text`).toHaveText(/[A-Za-z]/);
    statuses.push(
      await body.evaluate(el => getComputedStyle(el).color + getComputedStyle(el).backgroundColor),
    );
  }
  expect(new Set(statuses).size, 'statuses use distinct semantic colors').toBe(3);

  await expect(bodyIn('count-overflow')).toHaveText('20+');
  await expect(
    caseOf('count-overflow').locator('[title="41"], [aria-label*="41"]').first(),
    'overflowed count still exposes the actual count 41',
  ).toBeAttached();
  await expect(bodyIn('count-zero'), 'showZero keeps 0 visible').toHaveText('0');
  await expect(
    caseOf('icon-only').getByLabel('Euro').first(),
    'icon-only badge is named',
  ).toBeVisible();

  for (const [id, host] of [
    ['attached-button', 'button'],
    ['attached-avatar', '.ant-avatar, .genux-avatar'],
  ] as const) {
    const hostBox = await caseOf(id).locator(host).first().boundingBox();
    const badgeBox = await caseOf(id)
      .locator('.genux-badge-body, .ant-badge-dot')
      .first()
      .boundingBox();
    expect(
      !!hostBox &&
        !!badgeBox &&
        badgeBox.x < hostBox.x + hostBox.width &&
        hostBox.x < badgeBox.x + badgeBox.width &&
        badgeBox.y < hostBox.y + hostBox.height &&
        hostBox.y < badgeBox.y + badgeBox.height,
      `${id} badge is attached to its host`,
    ).toBe(true);
  }

  // Live controlled counter.
  const counter = bodyIn('dynamic-count');
  await expect(counter).toHaveText('5');
  await demo.getByRole('button', { name: 'Add notification', exact: true }).click();
  await expect(counter).toHaveText('6');
  await demo.getByRole('button', { name: 'Remove notification', exact: true }).click();
  await expect(counter).toHaveText('5');
  await demo.getByRole('button', { name: 'Clear notifications', exact: true }).click();
  await expect(caseOf('dynamic-count').locator('.genux-badge-body:visible')).toHaveCount(0);
  await demo.getByRole('button', { name: 'Add notification', exact: true }).click();
  await expect(counter).toHaveText('1');

  // Keyboard dismissal in Tab mode: Escape keeps the label, Enter removes it, focus stays usable.
  const euro = caseOf('dismissible').getByText('Euro', { exact: true });
  const remove = caseOf('dismissible').getByRole('button', { name: 'Remove Euro', exact: true });
  await expect(euro).toBeVisible();
  await remove.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(remove).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(euro, 'Escape does not dismiss').toBeVisible();
  await page.keyboard.press('Enter');
  await expect(euro, 'Enter on Remove Euro dismisses').toHaveCount(0);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const active = document.activeElement;
          return !!active && active !== document.body && !!active.closest('[data-demo=badge]');
        }),
      { message: 'focus moves to the next control or Undo inside the demo' },
    )
    .toBe(true);
  const restore = demo.getByRole('button', { name: 'Restore badge', exact: true });
  await restore.focus();
  await page.keyboard.press('Enter');
  await expect(euro, 'Restore badge brings Euro back').toBeVisible();

  // Badge Tweaker keeps its own settings; explicit size demos ignore the shared profile.
  const dialog = await openTweaker(page);
  const specific = (await dialog.locator('[data-tweaker-settings]').allInnerTexts()).join(' ');
  expect(specific, 'Badge Tweaker offers size').toMatch(/size/i);
  expect(specific, 'Badge Tweaker offers count position').toMatch(/position|offset/i);
  await dialog.locator('.genux-size-control .ant-segmented-item').nth(2).click();
  await closeTweaker(page, dialog);
  await expectGeometry('lg profile');

  for (const width of [320, 1280])
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
        THEME_KEY,
        theme,
      ] as const);
      await page.reload();
      await hydrated(page);
      await expectGeometry(`${width}px ${theme}`);
      await expectLayout(`${width}px ${theme}`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${width}px ${theme}: no page overflow`,
      ).toBe(true);
      await demo.scrollIntoViewIfNeeded();
      await attachShot(page, testInfo, `badge-${width}-${theme}`);
    }
});

test('Radius MD offers 0px/3px/5px/100% for field, slot and button, keeps legacy recipes and persists', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  // Fresh context without a recipe: factory default 5px.
  await page.goto(new URL(inputRoute, origin).href);
  await hydrated(page);
  await expect
    .poll(() => markField(page), { message: 'field with trailing slot action' })
    .toBe(true);
  await settle(page);
  await expect
    .poll(() => fieldRadii(page), { message: 'default field and slot radius' })
    .toEqual(radii('5px'));
  const keysBefore = await storageKeys(page);

  // The general radius editor is a four-choice combobox, not the numeric input.
  const dialog = await openTweaker(page);
  await expect(
    dialog.getByRole('combobox', { name: radiusLabel, exact: true }),
    'Radius MD is a choice editor',
  ).toBeVisible();
  expect(await listRadius(page, dialog), 'approved choices only without a legacy value').toEqual(
    radiusChoices,
  );
  await page.keyboard.press('Escape');
  await expect(popupOptions(page), 'Escape closes the popup').toHaveCount(0);
  await expect(dialog, 'Escape on the popup keeps the Tweaker open').toBeVisible();
  await closeTweaker(page, dialog);

  expect(
    tokens.map(token => token.id),
    'badge heights are editable definitions',
  ).toEqual(expect.arrayContaining(badgeIds));
  expect(tokens).toHaveLength(65);
  for (const id of radiusIds)
    expect(
      tokens.find(token => token.id === id),
      `${id} is a four-choice role`,
    ).toMatchObject({
      kind: 'choice',
      options: radiusChoices,
      defaults: { light: '5px', dark: '5px' },
    });

  for (const value of radiusChoices) {
    await chooseRadius(page, value);
    await expect
      .poll(() => fieldRadii(page), { message: `field and slot follow ${value}` })
      .toEqual(radii(value));
  }
  await attachShot(page, testInfo, 'radius-input-100');
  const keysAfter = await storageKeys(page);
  expect(keysAfter).toContain(RECIPE_KEY);
  expect(
    keysAfter.filter(key => !keysBefore.includes(key) && key !== RECIPE_KEY),
    'no new storage key',
  ).toEqual([]);

  await page.reload();
  await hydrated(page);
  await expect.poll(() => markField(page)).toBe(true);
  await settle(page);
  await expect
    .poll(() => fieldRadii(page), { message: '100% after reload' })
    .toEqual(radii('100%'));
  await page.goto(new URL(buttonRoute, origin).href);
  await hydrated(page);
  await settle(page);
  await expect
    .poll(() => buttonRadii(page), { message: 'standalone button uses the general role' })
    .toEqual(['100%', '100%', '100%', '100%']);

  await page.goto(new URL(tokensRoute, origin).href);
  await hydrated(page);
  const radiusSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Radius', exact: true }) })
    .last();
  for (const value of radiusChoices) {
    const choice = radiusSection.getByText(value, { exact: true }).first();
    await expect(choice, `/tokens/ lists ${value}`).toBeVisible();
    await expect(choice).toHaveCSS('font-weight', '400');
  }
  await attachShot(page, testInfo, 'radius-tokens');

  // Legacy: the 61 definitions saved before badge heights and the listy surface role, with
  // numeric radius 8 and custom dark values in canonical uppercase hex, seeded once.
  const seeded = tokens.filter(
    token => !badgeIds.includes(token.id) && token.id !== 'listy-surface',
  );
  expect(seeded).toHaveLength(61);
  // The model stores colors as canonical uppercase #RRGGBB; every other default stays exact.
  const seedValue = (token: Definition, mode: keyof Recipe) => {
    const value = token.defaults[mode];
    return token.kind === 'color' && typeof value === 'string' ? value.toUpperCase() : value;
  };
  const recipe: Recipe & { version: 1 } = {
    version: 1,
    light: {
      ...Object.fromEntries(seeded.map(token => [token.id, seedValue(token, 'light')])),
      ...Object.fromEntries(radiusIds.map(id => [id, 8])),
    },
    dark: {
      ...Object.fromEntries(seeded.map(token => [token.id, seedValue(token, 'dark')])),
      ...Object.fromEntries(radiusIds.map(id => [id, 8])),
      'text-body': 20,
      primary: '#7A3CFF',
    },
  };
  const badgeDefaults = badgeIds.map(id => {
    const token = tokens.find(entry => entry.id === id);
    return [token?.defaults.light, token?.defaults.dark];
  });
  const summary = async (target: Page) => {
    const saved = await stored(target);
    if (!saved) return null;
    return {
      radius: radiusIds.flatMap(id => [px(saved.light[id]), px(saved.dark[id])]),
      changed: seeded
        .filter(token => !radiusIds.includes(token.id))
        .filter(
          token =>
            saved.light[token.id] !== recipe.light[token.id] ||
            saved.dark[token.id] !== recipe.dark[token.id],
        )
        .map(token => token.id),
      darkBody: saved.dark['text-body'],
      darkPrimary: saved.dark.primary,
      badge: badgeIds.map(id => [saved.light[id], saved.dark[id]]),
    };
  };

  const context = await browser.newContext({ locale: 'en-US' });
  try {
    await context.addInitScript(
      ([recipeKey, themeKey, text]) => {
        if (window.localStorage.getItem(recipeKey) !== null) return;
        window.localStorage.setItem(themeKey, 'light');
        window.localStorage.setItem(recipeKey, text);
      },
      [RECIPE_KEY, THEME_KEY, JSON.stringify(recipe)] as const,
    );
    const legacy = await context.newPage();
    await legacy.goto(new URL(inputRoute, origin).href);
    await hydrated(legacy);
    await expect.poll(() => markField(legacy)).toBe(true);
    await settle(legacy);
    await expect
      .poll(() => fieldRadii(legacy), { message: 'legacy 8px is neither clamped nor discarded' })
      .toEqual(radii('8px'));
    await expect
      .poll(() => summary(legacy), { message: 'initial load preserves the custom recipe' })
      .toMatchObject({
        radius: Array(6).fill('8px'),
        changed: [],
        darkBody: 20,
        darkPrimary: '#7A3CFF',
      });
    const legacyKeys = await storageKeys(legacy);

    const legacyDialog = await openTweaker(legacy);
    // `has` resolves inside each candidate, so the inner combobox locator stays unscoped.
    const legacyCombo = legacy.getByRole('combobox', { name: radiusLabel, exact: true });
    await expect(
      legacyDialog.locator('.ant-select').filter({ has: legacyCombo }).first(),
      'legacy value stays selected',
    ).toContainText('8px');
    const offered = await listRadius(legacy, legacyDialog);
    expect(offered.filter(text => radiusChoices.includes(text))).toEqual(radiusChoices);
    expect(
      offered.filter(text => !radiusChoices.includes(text)),
      'legacy 8px is offered as the current custom value',
    ).toEqual([expect.stringContaining('8px')]);
    await legacy.keyboard.press('Escape');
    await expect(popupOptions(legacy)).toHaveCount(0);
    await closeTweaker(legacy, legacyDialog);

    await chooseRadius(legacy, '3px');
    await expect
      .poll(() => fieldRadii(legacy), { message: 'legacy edit to 3px' })
      .toEqual(radii('3px'));
    const expected = {
      radius: Array(6).fill('3px'),
      changed: [],
      darkBody: 20,
      darkPrimary: '#7A3CFF',
      badge: badgeDefaults,
    };
    await expect
      .poll(() => summary(legacy), { message: 'general radius in both schemes, others untouched' })
      .toEqual(expected);
    expect(
      (await storageKeys(legacy)).filter(key => !legacyKeys.includes(key)),
      'legacy edit adds no storage key',
    ).toEqual([]);

    await legacy.reload();
    await hydrated(legacy);
    await expect.poll(() => markField(legacy)).toBe(true);
    await settle(legacy);
    await expect
      .poll(() => fieldRadii(legacy), { message: '3px after reload' })
      .toEqual(radii('3px'));
    await expect.poll(() => summary(legacy)).toEqual(expected);
  } finally {
    await context.close();
  }
});
