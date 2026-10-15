import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * P2-A: one table-driven browser control for field slots.
 *
 * Specified behavior: every slot in an Atlas field well (number stepper minus
 * and plus, password eye, read-only lock, search action) sits inside the
 * CONTENT box of the single wrapper that owns the well, and that wrapper's
 * border box is exactly the shared 48/56/64 CSS px profile for sm/md/lg.
 * Only the wrapper paints a border or background; the native input and the
 * slot controls paint neither. Sizes are switched through the real size
 * control (inline or inside the Tweaker), never through injected CSS.
 *
 * The 48/56/64 values are the specification and are written here on purpose
 * so the control cannot drift with the implementation it checks.
 *
 * Screenshots are attached to the report for human before/after review only;
 * nothing here writes or approves a snapshot baseline.
 *
 * Keyboard focus (FOCUS-01) is owned by P1-A and is not asserted here.
 */

const INPUT_PATH = process.env.ATLAS_INPUT_PATH ?? '/components/input/';
const TOLERANCE_PX = 0.5;
const NO_BORDER = ['0px', '0px', '0px', '0px'];
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const SIZES = [
  { value: 'sm', height: 48 },
  { value: 'md', height: 56 },
  { value: 'lg', height: 64 },
] as const;
const THEMES = ['light', 'dark'] as const;

type Box = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};
type Paint = { borderWidths: string[]; background: string };
type Field = {
  name: string;
  stepper: boolean;
  wrapper: Locator;
  inner: Locator;
  slots: Locator;
};

async function borderBox(locator: Locator): Promise<Box> {
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function contentBox(locator: Locator): Promise<Box> {
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const px = (value: string) => Number.parseFloat(value) || 0;
    const top = rect.top + px(style.borderTopWidth) + px(style.paddingTop);
    const right = rect.right - px(style.borderRightWidth) - px(style.paddingRight);
    const bottom = rect.bottom - px(style.borderBottomWidth) - px(style.paddingBottom);
    const left = rect.left + px(style.borderLeftWidth) + px(style.paddingLeft);
    return { top, right, bottom, left, width: right - left, height: bottom - top };
  });
}

async function paint(locator: Locator): Promise<Paint> {
  return locator.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ],
      background: style.backgroundColor,
    };
  });
}

/** Theme actually rendered: a declared html/body mode first, the painted page background second. */
async function observedTheme(page: Page): Promise<'light' | 'dark' | 'unknown'> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const declared = [
      html.dataset.theme,
      html.dataset.colorMode,
      html.className,
      document.body.className,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (/\bdark\b/.test(declared)) return 'dark';
    if (/\blight\b/.test(declared)) return 'light';
    for (const element of [document.body, html]) {
      const color = getComputedStyle(element).backgroundColor;
      const channels = color.match(/[\d.]+/g)?.map(Number) ?? [];
      if (channels.length < 3 || (channels.length === 4 && channels[3] === 0)) continue;
      const red = channels[0] ?? 0;
      const green = channels[1] ?? 0;
      const blue = channels[2] ?? 0;
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      return luminance < 0.5 ? 'dark' : 'light';
    }
    return 'unknown';
  });
}

/** Pick a size through the real size control. If it lives in the Tweaker, open it, pick, close it. */
async function selectSize(page: Page, value: string) {
  const control = page.locator('[data-size-control]').first();
  let openedTweaker = false;
  if (!(await control.isVisible())) {
    const opener = page.locator('[data-tweaker-trigger]').first();
    await expect(opener, 'PRECONDITION: size control or Tweaker opener on the page').toBeVisible();
    await opener.click();
    openedTweaker = true;
    await expect(control, 'PRECONDITION: size control inside the Tweaker').toBeVisible();
  }
  // AntD 6 Segmented renders its native radios without a value attribute, so
  // the option is located by its accessible label, which carries the height.
  const height = SIZES.find(size => size.value === value)?.height;
  expect(height, `PRECONDITION: ${value} is a specified size`).toBeDefined();
  const option = control
    .locator('.ant-segmented-item')
    .filter({ hasText: new RegExp(`(^|[^0-9])${height}.?px`) });
  await expect(option, `PRECONDITION: one size option labelled ${height} px`).toHaveCount(1);
  await option.click();
  await expect(
    option.locator('input.ant-segmented-item-input'),
    `PRECONDITION: size ${value} selected`,
  ).toBeChecked();
  if (openedTweaker) {
    await page.keyboard.press('Escape');
    await expect(page.locator('.atlas-tweaker-panel.ant-drawer-open')).toHaveCount(0);
  }
}

function frame(page: Page, kind: string, id: string): Locator {
  return page
    .locator(`.atlas-input-frame[data-atlas-input='${kind}']`, { has: page.locator(`#${id}`) })
    .first();
}

/** Every existing slot owner: all number steppers plus the password, lock and search fields. */
async function collectFields(page: Page): Promise<Field[]> {
  const fields: Field[] = [];
  const steppers = page.locator('.atlas-number-stepper');
  const count = await steppers.count();
  for (let index = 0; index < count; index += 1) {
    const wrapper = steppers.nth(index);
    const inner = wrapper.locator('input').first();
    const id = (await inner.getAttribute('id')) ?? String(index);
    fields.push({
      name: `stepper-${id}`,
      stepper: true,
      wrapper,
      inner,
      slots: wrapper.locator('button'),
    });
  }
  const password = frame(page, 'password', 'input-password');
  fields.push({
    name: 'password-eye',
    stepper: false,
    wrapper: password,
    inner: password.locator('input').first(),
    slots: password.locator('.ant-input-suffix > *'),
  });
  const readonly = frame(page, 'text', 'input-readonly');
  fields.push({
    name: 'readonly-lock',
    stepper: false,
    wrapper: readonly,
    inner: readonly.locator('input').first(),
    slots: readonly.locator('.atlas-readonly-indicator'),
  });
  const search = frame(page, 'search', 'input-search');
  fields.push({
    name: 'search-action',
    stepper: false,
    wrapper: search,
    inner: search.locator('input').first(),
    slots: search.locator('.ant-input-search-btn'),
  });
  return fields;
}

test('P2-A field slots fit the wrapper content box: sm/md/lg x light/dark', async ({ page }) => {
  test.setTimeout(240_000);
  for (const theme of THEMES) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(INPUT_PATH);
    await expect(
      page.locator('#input-password'),
      'PRECONDITION: input page rendered',
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await observedTheme(page), `PRECONDITION: page renders the ${theme} theme`).toBe(theme);

    for (const size of SIZES) {
      await selectSize(page, size.value);
      await expect(
        frame(page, 'password', 'input-password'),
        `PRECONDITION: size ${size.value} reached the field frames`,
      ).toHaveAttribute('data-size', size.value);
      const fields = await collectFields(page);
      const stepperCount = fields.filter(field => field.stepper).length;
      expect(stepperCount, 'PRECONDITION: a number stepper on the page').toBeGreaterThan(0);

      for (const field of fields) {
        const label = `${theme}/${size.value}/${field.name}`;
        await expect(field.wrapper, `${label}: wrapper rendered`).toBeVisible();
        const outer = await borderBox(field.wrapper);
        const content = await contentBox(field.wrapper);

        const heightNote =
          `${label}: wrapper border-box height ${outer.height.toFixed(2)}px, ` +
          `expected ${size.height}px (tolerance ${TOLERANCE_PX}px)`;
        expect.soft(outer.height, heightNote).toBeGreaterThanOrEqual(size.height - TOLERANCE_PX);
        expect.soft(outer.height, heightNote).toBeLessThanOrEqual(size.height + TOLERANCE_PX);

        const innerPaint = await paint(field.inner);
        expect
          .soft(innerPaint.borderWidths, `${label}: native input paints no border`)
          .toEqual(NO_BORDER);
        expect
          .soft(innerPaint.background, `${label}: native input paints no background`)
          .toBe(TRANSPARENT);

        const slots: Locator[] = [];
        for (const slot of await field.slots.all()) if (await slot.isVisible()) slots.push(slot);
        expect
          .soft(slots.length, `${label}: visible slot count`)
          .toBeGreaterThanOrEqual(field.stepper ? 2 : 1);

        for (const [index, slot] of slots.entries()) {
          const tag = `${label}#${index}`;
          const box = await borderBox(slot);
          const gaps = {
            top: box.top - content.top,
            right: content.right - box.right,
            bottom: content.bottom - box.bottom,
            left: box.left - content.left,
          };
          const detail = `slot ${JSON.stringify(box)}; wrapper content ${JSON.stringify(content)}`;
          for (const [edge, gap] of Object.entries(gaps)) {
            const note =
              `${tag}: slot ${edge} edge inside wrapper content box, ` +
              `gap ${gap.toFixed(2)}px; ${detail}`;
            expect.soft(gap, note).toBeGreaterThanOrEqual(-TOLERANCE_PX);
          }
          const symmetryNote =
            `${tag}: slot inset symmetric, ` +
            `top ${gaps.top.toFixed(2)}px vs bottom ${gaps.bottom.toFixed(2)}px`;
          expect
            .soft(Math.abs(gaps.top - gaps.bottom), symmetryNote)
            .toBeLessThanOrEqual(TOLERANCE_PX);
          const slotPaint = await paint(slot);
          expect.soft(slotPaint.borderWidths, `${tag}: slot paints no border`).toEqual(NO_BORDER);
          expect.soft(slotPaint.background, `${tag}: slot paints no background`).toBe(TRANSPARENT);
        }

        await test.info().attach(`p2-a/${theme}/${size.value}/${field.name}.png`, {
          body: await field.wrapper.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        });
      }
    }
  }
});
