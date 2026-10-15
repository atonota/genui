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

  await page.clock.install({ time: T0 });
  await page.goto(new URL(inputRoute, origin).href);

  // The Input Tweaker offers the general radius setting.
  let dialog = await openTweaker(page);
  await shot('input-tweaker-open');
  const inputRadius = dialog.getByRole('spinbutton', { name: radiusLabel, exact: true });
  await expect(inputRadius, 'Input Tweaker offers the general radius setting').toBeVisible();
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
  await inputRadius.fill('3');
  await inputRadius.press('Enter');
  await expect(inputRadius).toHaveValue('3');
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
  await expect(dialog.getByRole('spinbutton', { name: radiusLabel, exact: true })).toHaveValue('3');
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
