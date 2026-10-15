import { expect, test, type Locator, type Page } from '@playwright/test';
import definitions from '../src/theme-builder/definitions.json' with { type: 'json' };

// Explicit user request (2026-10-15): one general radius role shared by field wells, their slot
// actions and standalone buttons, editable from every Tweaker and kept with the existing theme
// recipe for about 30 days.
const origin = process.env.ATLAS_DOCS_ORIGIN ?? 'http://127.0.0.1:4324';
const inputRoute = process.env.ATLAS_INPUT_ROUTE ?? '/components/input/';
const buttonRoute = process.env.ATLAS_BUTTON_ROUTE ?? '/components/button/';
const stage = (process.env.ATLAS_SOURCE_STAGE ?? 'unlabeled').replace(/[^a-z0-9-]/gi, '-');
const RECIPE_KEY = 'atlas-theme-builder-v1';
const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-10-15T09:00:00Z').getTime();
const radiusLabel = 'Radius MD';

type Definition = { id: string; label: string; kind: string };
// Derived from the definitions the model validates; never a hardcoded count.
const tokens = definitions as readonly Definition[];
const tokenLabels = new Set(tokens.map(token => token.label));

test.use({ locale: 'en-US' });

// End-side corners face the trailing slot action, so wrapper and slot are compared coaxially.
function measureField(page: Page) {
  return page.evaluate(() => {
    const shown = (el: Element) =>
      el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const end = (el: Element) => {
      const style = getComputedStyle(el);
      return [parseFloat(style.borderStartEndRadius), parseFloat(style.borderEndEndRadius)];
    };
    const slot = [...document.querySelectorAll('.atlas-slot-button')].find(
      el => !el.closest('.atlas-tweaker-panel') && shown(el),
    );
    if (!slot) return null;
    let wrapper = slot.parentElement;
    while (
      wrapper &&
      !(
        wrapper.querySelector('input:not([type="hidden"])') &&
        parseFloat(getComputedStyle(wrapper).borderStartEndRadius) > 0
      )
    )
      wrapper = wrapper.parentElement;
    return { wrapper: wrapper ? end(wrapper) : null, slot: end(slot) };
  });
}

function measureButton(page: Page) {
  return page.evaluate(() => {
    const shown = (el: Element) =>
      el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const button = [...document.querySelectorAll('.atlas-button')].find(
      el =>
        !el.matches('.atlas-slot-button, .atlas-icon-button') &&
        !el.closest('.atlas-tweaker-panel, .atlas-tweaker-trigger, [data-tweaker-settings]') &&
        shown(el),
    );
    if (!button) return null;
    const style = getComputedStyle(button);
    return [
      style.borderStartStartRadius,
      style.borderStartEndRadius,
      style.borderEndStartRadius,
      style.borderEndEndRadius,
    ].map(value => parseFloat(value));
  });
}

async function openTweaker(page: Page) {
  await page
    .locator('.atlas-tweaker-trigger')
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

// The general radius is a choice role offered through an accessible combobox.
const radiusControl = (dialog: Locator) =>
  dialog.getByRole('combobox', { name: radiusLabel, exact: true });

// AntD Select shows the chosen value on its owner; the search input itself may stay empty.
const selectOwner = (combo: Locator) =>
  combo.locator(
    'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " ant-select ")][1]',
  );

// Keyboard choice: Enter opens, ArrowDown walks the active option, Enter commits it.
async function chooseOption(combo: Locator, value: string) {
  await combo.focus();
  if (await combo.evaluate(el => el instanceof HTMLSelectElement)) {
    await combo.selectOption(value);
    return;
  }
  await combo.press('Enter');
  await expect(combo).toHaveAttribute('aria-expanded', 'true');
  const active = () =>
    combo.evaluate(el => {
      const id = el.getAttribute('aria-activedescendant');
      const option = id ? document.getElementById(id) : null;
      return option
        ? {
            id: option.id,
            text: option.getAttribute('aria-label') ?? option.textContent?.trim() ?? '',
          }
        : null;
    });
  const seen = new Set<string>();
  let current = await active();
  while (current && !seen.has(current.id)) {
    if (current.text.toLowerCase() === value.toLowerCase()) {
      await combo.press('Enter');
      await expect(combo).toHaveAttribute('aria-expanded', 'false');
      return;
    }
    seen.add(current.id);
    const previous = current.id;
    await combo.press('ArrowDown');
    await expect.poll(async () => (await active())?.id).not.toBe(previous);
    current = await active();
  }
  throw new Error(`${value} is not an offered option`);
}

async function expectEveryTokenEditable(dialog: Locator, route: string) {
  for (const token of tokens) {
    const control = dialog.getByLabel(token.label, { exact: true }).first();
    await expect(control, `${token.id} is editable from the ${route} Tweaker`).toBeEnabled();
    if (token.kind !== 'choice')
      await expect(control, `${token.id} accepts input on ${route}`).toBeEditable();
  }
}

// Example-registered option text, excluding the shared token editors.
async function specificOptions(dialog: Locator) {
  const texts = await dialog.locator('[data-tweaker-settings]').allInnerTexts();
  return new Set(
    texts
      .flatMap(text => text.split('\n'))
      .map(line => line.trim())
      .filter(line => line !== '' && !tokenLabels.has(line)),
  );
}

const storageKeys = (page: Page) => page.evaluate(() => Object.keys(window.localStorage));

test('Tweaker edits every token; one radius drives field, slot and button and persists ~30 days', async ({
  page,
}, testInfo) => {
  const shot = (name: string) =>
    page.screenshot({ path: testInfo.outputPath(`tweaker-token-contract-${stage}-${name}.png`) });
  expect(new Set(tokens.map(token => token.id)).size).toBe(tokens.length);
  expect(tokenLabels.size).toBe(tokens.length);
  expect(
    tokens.find(token => token.id === 'radius-md'),
    'the general radius is an approved choice',
  ).toMatchObject({ kind: 'choice', options: ['0px', '3px', '5px', '100%'] });

  await page.clock.install({ time: T0 });
  await page.goto(new URL(inputRoute, origin).href);

  // The Input Tweaker offers the general radius setting.
  let dialog = await openTweaker(page);
  await shot('input-tweaker-open');
  const inputRadius = radiusControl(dialog);
  await expect(inputRadius, 'Input Tweaker offers the general radius setting').toBeVisible();
  await expect(selectOwner(inputRadius), 'default general radius').toContainText('5px');
  await expectEveryTokenEditable(dialog, 'Input');
  const inputOptions = await specificOptions(dialog);
  expect([...inputOptions], 'Input Tweaker keeps Input-specific options').not.toEqual([]);
  await closeTweaker(page, dialog);

  // Fresh context without a recipe: wrapper and nested slot share the general 5px radius.
  await expect
    .poll(() => measureField(page), { message: 'default field and slot radius' })
    .toEqual({ wrapper: [5, 5], slot: [5, 5] });

  const keysBefore = await storageKeys(page);
  dialog = await openTweaker(page);
  await chooseOption(inputRadius, '3px');
  await expect(selectOwner(inputRadius)).toContainText('3px');
  await closeTweaker(page, dialog);
  await expect
    .poll(() => measureField(page), { message: 'radius 3 on field and slot' })
    .toEqual({ wrapper: [3, 3], slot: [3, 3] });
  await shot('input-radius-3');

  // Persistence reuses the existing recipe storage instead of a new key.
  const keysAfter = await storageKeys(page);
  expect(keysAfter).toContain(RECIPE_KEY);
  expect(keysAfter.filter(key => !keysBefore.includes(key) && key !== RECIPE_KEY)).toEqual([]);

  await page.reload();
  await expect
    .poll(() => measureField(page), { message: 'radius 3 after reload' })
    .toEqual({ wrapper: [3, 3], slot: [3, 3] });

  // Cross-route: the standalone Button follows the same radius and its Tweaker shows it.
  await page.goto(new URL(buttonRoute, origin).href);
  await expect
    .poll(() => measureButton(page), { message: 'standalone button radius 3' })
    .toEqual([3, 3, 3, 3]);
  await shot('button-radius-3');
  dialog = await openTweaker(page);
  await expect(selectOwner(radiusControl(dialog))).toContainText('3px');
  await expectEveryTokenEditable(dialog, 'Button');
  const buttonOptions = await specificOptions(dialog);
  expect([...buttonOptions], 'Button Tweaker keeps Button-specific options').not.toEqual([]);
  expect(
    [...inputOptions].some(option => !buttonOptions.has(option)),
    'Input options differ from Button options',
  ).toBe(true);
  expect(
    [...buttonOptions].some(option => !inputOptions.has(option)),
    'Button options differ from Input options',
  ).toBe(true);
  await closeTweaker(page, dialog);

  // Deterministic retention: kept within 30 days, defaults return once expired.
  await page.clock.setSystemTime(T0 + 29 * DAY);
  await page.reload();
  await expect
    .poll(() => measureButton(page), { message: 'radius kept at day 29' })
    .toEqual([3, 3, 3, 3]);

  await page.clock.setSystemTime(T0 + 31 * DAY);
  await page.reload();
  await expect
    .poll(() => measureButton(page), { message: 'expired recipe returns button to 5' })
    .toEqual([5, 5, 5, 5]);
  await shot('button-expired');
  await page.goto(new URL(inputRoute, origin).href);
  await expect
    .poll(() => measureField(page), { message: 'expired recipe returns field and slot to 5' })
    .toEqual({ wrapper: [5, 5], slot: [5, 5] });
});

// Explicit regression exception (2026-10-15): editing one scheme must keep the other scheme's
// saved values, even when both factory defaults are equal.
test('cross-theme: editing a light token keeps the custom dark values', async ({ page }) => {
  type Seeded = Definition & { defaults: { light: string | number; dark: string | number } };
  const seeded = tokens as readonly Seeded[];
  const body = seeded.find(token => token.id === 'text-body');
  expect(body, 'text-body is a numeric definition').toMatchObject({ kind: 'number' });
  const recipe = {
    version: 1,
    light: Object.fromEntries(seeded.map(token => [token.id, token.defaults.light])),
    dark: {
      ...Object.fromEntries(seeded.map(token => [token.id, token.defaults.dark])),
      'text-body': 20,
      density: 'comfortable',
    },
  };
  await page.addInitScript(
    ([key, text]) => {
      window.localStorage.setItem('atlas-theme', 'light');
      window.localStorage.setItem(key, text);
    },
    [RECIPE_KEY, JSON.stringify(recipe)] as const,
  );
  // Reads the recipe the shared store persisted in its existing envelope.
  const stored = () =>
    page.evaluate(key => {
      const text = window.localStorage.getItem(key);
      const saved = text ? JSON.parse(text)?.recipe : undefined;
      return saved
        ? {
            light: saved.light['text-body'],
            dark: saved.dark['text-body'],
            density: saved.dark.density,
          }
        : null;
    }, RECIPE_KEY);

  await page.goto(new URL(inputRoute, origin).href);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect
    .poll(stored, { message: 'seeded recipe accepted and stored' })
    .toEqual({ light: 14, dark: 20, density: 'comfortable' });

  const dialog = await openTweaker(page);
  const bodyText = dialog.getByRole('spinbutton', { name: body!.label, exact: true });
  await expect(bodyText, 'light mode shows the light value').toHaveValue('14');
  await bodyText.fill('16');
  await bodyText.press('Enter');
  await expect(bodyText).toHaveValue('16');
  await expect
    .poll(stored, { message: 'light edit keeps the custom dark values' })
    .toEqual({ light: 16, dark: 20, density: 'comfortable' });
});

// Explicit human request (2026-10-16): every documentation component route opens settings of its
// own in the Tweaker, beside the shared token editors, starting at 320px. Slugs mirror the demos
// map in docs/src/pages/components/[slug].astro.
const componentRoutes = [
  'button',
  'input',
  'select',
  'pill',
  'card',
  'splitter',
  'breadcrumb',
  'pagination',
  'steps',
  'autocomplete',
  'cascader',
  'dropdown',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'accordion',
  'form',
  'drawer',
  'empty-state',
  'avatar',
  'toast',
  'alert',
  'notification',
  'modal',
  'popconfirm',
  'date-time',
  'data-table',
  'collection-views',
  'record-details',
  'record-forms',
  'record-workspace',
  'media',
  'content-patterns',
  'carousel',
  'upload',
  'rich-menu',
  'chart',
  'listy',
  'badge',
] as const;
// Interactive controls; disabled ones never count as an offered setting.
const settingControl =
  ':is(input:not([type="hidden"]), button, select, [role="switch"], [role="combobox"], [role="checkbox"], [role="radio"]):not(:disabled, [aria-disabled="true"])';

test('every component route Tweaker offers its own settings beside every token editor', async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const shot = (name: string) =>
    page.screenshot({ path: testInfo.outputPath(`tweaker-token-contract-${stage}-${name}.png`) });
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  const visit = async (slug: string) => {
    await page.goto(new URL(`/components/${slug}/`, origin).href);
    await expect(page.locator('astro-island[ssr]'), `${slug} island hydrates`).toHaveCount(0);
  };
  expect(componentRoutes).toHaveLength(40);
  expect(new Set(componentRoutes).size).toBe(componentRoutes.length);

  // Soft checks keep the full route table in one report.
  await page.setViewportSize({ width: 320, height: 800 });
  for (const slug of componentRoutes) {
    await visit(slug);
    expect
      .soft(await overflow(), `${slug} has no horizontal page overflow at 320px`)
      .toBeLessThanOrEqual(0);
    const dialog = await openTweaker(page);
    expect
      .soft(await overflow(), `${slug} has no horizontal page overflow with Tweaker open`)
      .toBeLessThanOrEqual(0);
    // Registrations exclude the common size control and the shared token editors; Listy's own
    // parameter is the central Listy surface role.
    const specific = dialog
      .locator('.atlas-tweaker-registrations .atlas-tweaker-settings, .atlas-badge-settings')
      .locator(settingControl);
    const offered =
      slug === 'listy'
        ? specific.or(dialog.getByRole('combobox', { name: 'Listy surface', exact: true }))
        : specific;
    await expect
      .soft(offered.first(), `${slug} Tweaker offers an enabled component-specific setting`)
      .toBeEnabled({ timeout: 2_000 });
    const tokenEditors = tokens
      .map(token => dialog.getByLabel(token.label, { exact: true }))
      .reduce((all, next) => all.or(next));
    expect
      .soft(await tokenEditors.count(), `${slug} Tweaker keeps every token editor`)
      .toBeGreaterThanOrEqual(tokens.length);
  }

  // Representative functional setting: Avatar shape drives the rendered avatar's shape prop.
  await visit('avatar');
  const dialog = await openTweaker(page);
  const shape = dialog.getByRole('combobox', { name: 'Avatar shape', exact: true });
  const avatar = page.locator('[data-doc-demo] [data-avatar-shape]').first();
  await expect(shape, 'Avatar Tweaker offers the shape setting').toBeEnabled();
  await expect(avatar).toHaveAttribute('data-avatar-shape', 'circle');
  await chooseOption(shape, 'square');
  await expect(avatar, 'square shape reaches the avatar').toHaveAttribute(
    'data-avatar-shape',
    'square',
  );
  await chooseOption(shape, 'circle');
  await expect(avatar, 'circle shape returns').toHaveAttribute('data-avatar-shape', 'circle');
  await shot('avatar-320');

  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await overflow(), 'Avatar desktop has no horizontal page overflow').toBeLessThanOrEqual(0);
  await shot('avatar-desktop');
});
