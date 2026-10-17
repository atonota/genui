import { expect, test, type Locator, type Page } from '@playwright/test';

const origin = process.env.GENUX_DOCS_URL ?? 'http://127.0.0.1:4324';
// RED and GREEN runs keep separate evidence; the conductor supplies the stage label.
const stage = (process.env.GENUX_TDD_STAGE ?? 'unlabelled').replace(/[^a-z0-9-]/gi, '-');
const sizes = ['sm', 'md', 'lg'] as const;
type Size = (typeof sizes)[number];
const regular: Record<Size, number> = { sm: 48, md: 56, lg: 64 };
const compact: Record<Size, number> = { sm: 32, md: 40, lg: 48 };

type Surface = {
  name: string;
  /** A docs/src/data/catalog.ts slug, or a navigation title for other catalog pages. */
  route: string | RegExp;
  family: Record<Size, number>;
  /** min: description-bearing surfaces start at the base height and grow with content. */
  fit: 'exact' | 'min';
  /** cross: the thinner side of a separator whose length follows its panels. */
  axis?: 'cross';
  /** Visible artwork drawn in this pseudo-element; the host box stays the pointer hit area. */
  pseudo?: '::before' | '::after';
  /** Minimum pointer hit area in px on both sides of the host box. */
  hit?: number;
  /** Identifies the example island that owns the Component size Tweaker. */
  island: string;
  open?: (page: Page, demo: Locator) => Promise<void>;
  /** Escape closes the opened popup before the next profile is chosen. */
  dismiss?: boolean;
  target: (page: Page, demo: Locator, size: Size) => Locator;
};

const inDemo = (selector: string) => (_page: Page, demo: Locator) => demo.locator(selector).first();
const shown = (selector: string) => (page: Page) => page.locator(`${selector}:visible`).last();
const clickIn = (selector: string) => async (_page: Page, demo: Locator) => {
  await demo.locator(selector).first().click();
};
const menuTrigger = '[aria-haspopup="menu"]';

const surfaces: Surface[] = [
  {
    name: 'Button',
    route: 'button',
    family: regular,
    fit: 'exact',
    // ButtonDemo's playground preview inherits the shared size profile; #continue-action exists only in a catalog snippet.
    island: '.playground-preview .genux-button',
    target: inDemo('.playground-preview .genux-button'),
  },
  {
    name: 'Input',
    route: 'input',
    family: regular,
    fit: 'exact',
    // InputDemo names the Workspace name field through Form.Item htmlFor; the outer frame owns the height.
    island: '#input-filled',
    target: inDemo('.genux-input-frame:has(#input-filled)'),
  },
  // NumberStepper frames its slot buttons and the unframed InputNumber together.
  {
    name: 'Input spinner',
    route: 'input',
    family: regular,
    fit: 'exact',
    island: '#input-number',
    target: inDemo('.genux-number-stepper:has(#input-number)'),
  },
  {
    name: 'Avatar',
    route: /^avatars?$/i,
    family: regular,
    fit: 'exact',
    island: '.genux-avatar-people',
    // AvatarDemo passes no size prop, so every listed avatar inherits the profile.
    target: inDemo('.genux-avatar-person .genux-avatar'),
  },
  {
    name: 'Select items',
    // The Input example's controlled Department Select shares its size Tweaker island.
    route: 'input',
    family: regular,
    fit: 'exact',
    island: '#input-department',
    open: async (_page, demo) => {
      await demo.locator('.ant-select:has(#input-department)').first().click();
    },
    dismiss: true,
    target: shown('.ant-select-dropdown .ant-select-item-option'),
  },
  {
    name: 'Dropdown items',
    route: 'dropdown',
    family: regular,
    fit: 'exact',
    island: menuTrigger,
    open: clickIn(menuTrigger),
    dismiss: true,
    target: shown('.ant-dropdown [role="menuitem"]'),
  },
  {
    name: 'Rich menu items',
    route: /^rich menus?$/i,
    family: regular,
    fit: 'min',
    island: '.genux-rich-menu-demo',
    open: clickIn(`.genux-rich-menu-demo ${menuTrigger}`),
    dismiss: true,
    target: shown('.genux-rich-menu-popup [role="menuitem"]'),
  },
  {
    name: 'Toast',
    route: /^(toasts?|messages?)$/i,
    family: regular,
    fit: 'exact',
    island: '[data-demo="toast"]',
    open: async (page, demo) => {
      // Let earlier notices expire so the measured notice is the one opened at this size.
      await expect(page.locator('.genux-toast-content')).toHaveCount(0, { timeout: 10_000 });
      await demo
        .locator('[data-demo="toast"] button:not([disabled]):not([data-tweaker-trigger])')
        .first()
        .click();
    },
    // GenUXFeedback marks each native message notice with classNames.wrapper genux-toast-content.
    target: page => page.locator('.genux-toast-content:visible').last(),
  },
  {
    name: 'Alert',
    route: /^alerts?$/i,
    family: regular,
    fit: 'min',
    island: '[data-demo="alert"]',
    target: inDemo('[data-demo="alert"] .ant-alert'),
  },
  {
    name: 'Notification',
    route: /^notifications?$/i,
    family: regular,
    fit: 'min',
    island: '[data-demo="notification"]',
    // The notice holder renders before the card, so a generic button query reaches Keep editing once a notice is open.
    open: async (_page, demo) => {
      await demo
        .locator('[data-demo="notification"]')
        .getByRole('button', { name: 'Show notification', exact: true })
        .click();
    },
    target: shown('.ant-notification-notice'),
  },
  {
    name: 'Pagination',
    route: 'pagination',
    family: regular,
    fit: 'exact',
    island: '[data-pagination-primary]',
    target: inDemo('[data-pagination-primary] [aria-current="page"]'),
  },
  {
    name: 'Breadcrumb',
    route: 'breadcrumb',
    family: regular,
    fit: 'exact',
    island: '#breadcrumb-quick',
    target: (_page, demo) =>
      demo
        .locator('#breadcrumb-quick')
        .getByRole('button', { name: 'Navigate Data workspace pages' })
        .first(),
  },
  // The catalog has no generic Table page and Collection views starts with its mobile record list;
  // Data table renders the shared workspace Ant Design Table inside the CollectionDemo provider.
  {
    name: 'Table',
    route: 'data-table',
    family: regular,
    fit: 'exact',
    island: '[data-collection-view="table"] .ant-table-tbody',
    target: inDemo('[data-collection-view="table"] .ant-table-tbody > tr.ant-table-row'),
  },
  {
    name: 'Data table',
    route: 'data-table',
    family: regular,
    fit: 'exact',
    island: '.ant-table-tbody',
    target: inDemo('.ant-table-tbody > tr.ant-table-row'),
  },
  {
    name: 'Splitter handle',
    route: 'splitter',
    family: regular,
    fit: 'exact',
    axis: 'cross',
    island: '#splitter-records',
    target: inDemo('#splitter-records [role="separator"]'),
  },
  {
    name: 'Pill',
    route: 'pill',
    family: compact,
    fit: 'exact',
    island: '.ant-tag',
    target: inDemo('.ant-tag'),
  },
  // No standalone Chips/Tag page: GenUXCheckablePill on the Pill page is the native Ant Design CheckableTag.
  {
    name: 'Chips/Tag',
    route: 'pill',
    family: compact,
    fit: 'exact',
    island: '[data-pill-checkable] .ant-tag',
    target: inDemo('[data-pill-checkable] .ant-tag'),
  },
  // GenUXSlider paints the visible thumb in handle::after at --radio-size; the handle box keeps the 48px hit area.
  {
    name: 'Slider thumb',
    route: 'slider',
    family: compact,
    fit: 'exact',
    pseudo: '::after',
    hit: 48,
    island: '[data-slider-example="linear"]',
    target: inDemo('[data-slider-example="linear"] .ant-slider-handle'),
  },
  {
    name: 'Checkbox',
    route: 'checkbox',
    family: compact,
    fit: 'exact',
    island: '.ant-checkbox',
    target: inDemo('.ant-checkbox'),
  },
  {
    name: 'Radio',
    route: 'radio',
    family: compact,
    fit: 'exact',
    island: '.ant-radio',
    target: inDemo('.ant-radio'),
  },
  {
    name: 'Switch',
    route: 'switch',
    family: compact,
    fit: 'exact',
    island: '.ant-switch',
    target: inDemo('.ant-switch'),
  },
  {
    name: 'Cascader items',
    route: 'cascader',
    family: compact,
    // GenUXCascader optionRender adds a description line to first-column branches, so rows start at the base and grow.
    fit: 'min',
    island: '[role="combobox"]',
    open: clickIn('[role="combobox"]'),
    dismiss: true,
    target: page =>
      page.locator('.ant-cascader-menu:visible').first().locator('.ant-cascader-menu-item').first(),
  },
  // The Listy adapter marks its rows itself rather than rendering the deprecated List.
  {
    name: 'List items',
    route: 'listy',
    family: compact,
    fit: 'min',
    island: '[data-genux-listy-item]',
    target: inDemo('[data-genux-listy-item]'),
  },
];

// Astro removes the ssr marker from an astro-island once its client:load hydration has run;
// before that the server markup has no handlers and a keypress is lost.
async function awaitHydration(demo: Locator) {
  await expect(
    demo.locator('xpath=ancestor::astro-island[1][not(@ssr)]'),
    'example island is hydrated',
  ).toHaveCount(1);
}

// Popups and notices mount mid-motion (the Select popup slides up from scaleY(0.8)); geometry is
// read once every finite animation on the target and its ancestors has finished at normal motion.
async function settleAnimations(target: Locator) {
  await target.evaluate(async element => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    for (;;) {
      // rc-motion applies its enter classes over the next frames.
      await frame();
      await frame();
      const pending: Animation[] = [];
      for (let node: Element | null = element; node; node = node.parentElement)
        for (const animation of node.getAnimations()) {
          const end = animation.effect?.getComputedTiming().endTime;
          if (animation.playState !== 'finished' && typeof end === 'number' && Number.isFinite(end))
            pending.push(animation);
        }
      if (!pending.length) return;
      await Promise.all(pending.map(animation => animation.finished.catch(() => undefined)));
    }
  });
}

async function chooseSize(demo: Locator, size: Size) {
  // Several islands share the fixed opener position; keyboard activation targets this one.
  const trigger = demo.locator('[data-tweaker-trigger]').first();
  await awaitHydration(demo);
  await trigger.press('Enter');
  const panel = demo.locator('.genux-tweaker-panel').first();
  await expect(panel, 'Tweaker panel opens from the keyboard').toBeVisible();
  await panel.locator('.genux-size-control .ant-segmented-item').nth(sizes.indexOf(size)).click();
  await expect(demo).toHaveAttribute('data-size-profile', size);
  await demo.page().keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

test.use({ viewport: { width: 1280, height: 900 } });

test('Component size profiles reach every named surface', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await page.goto(new URL('/components/button/', origin).href);
  const links = await page.locator('a[href*="/components/"]').evaluateAll(anchors =>
    anchors.map(anchor => ({
      text: (anchor.textContent ?? '').trim(),
      path: new URL((anchor as HTMLAnchorElement).href).pathname,
    })),
  );
  const results: Record<string, unknown>[] = [];
  for (const surface of surfaces) {
    const route = surface.route;
    const path =
      typeof route === 'string'
        ? `/components/${route}/`
        : links.find(link => route.test(link.text))?.path;
    if (!path) {
      testInfo.annotations.push({ type: 'not_in_catalog', description: surface.name });
      expect.soft(path, `${surface.name} has a catalog page`).toBeTruthy();
      continue;
    }
    await page.goto(new URL(path, origin).href);
    const demo = page
      .locator('.genux-demo[data-size-profile]')
      .filter({ has: page.locator('[data-tweaker-trigger]') })
      .filter({ has: page.locator(surface.island) })
      .first();
    const owned = (await demo.count()) > 0;
    expect.soft(owned, `${surface.name} example owns a Component size Tweaker`).toBe(true);
    if (!owned) continue;
    const slug = surface.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    for (const size of sizes) {
      await chooseSize(demo, size);
      await surface.open?.(page, demo);
      const target = surface.target(page, demo, size);
      const visible = await target.waitFor({ state: 'visible', timeout: 5_000 }).then(
        () => true,
        () => false,
      );
      expect.soft(visible, `${surface.name} ${size} is visible`).toBe(true);
      const expected = surface.family[size];
      if (visible) {
        await target.scrollIntoViewIfNeeded();
        await settleAnimations(target);
        const box = await target.boundingBox();
        // A rendered pseudo-element resolves width/height to its used size; add padding and border unless border-box.
        const art = surface.pseudo
          ? await target.evaluate((element, pseudo) => {
              const style = getComputedStyle(element, pseudo);
              const px = (value: string) => parseFloat(value) || 0;
              const content = style.boxSizing !== 'border-box';
              const inline = content
                ? px(style.paddingLeft) +
                  px(style.paddingRight) +
                  px(style.borderLeftWidth) +
                  px(style.borderRightWidth)
                : 0;
              const block = content
                ? px(style.paddingTop) +
                  px(style.paddingBottom) +
                  px(style.borderTopWidth) +
                  px(style.borderBottomWidth)
                : 0;
              return { width: px(style.width) + inline, height: px(style.height) + block };
            }, surface.pseudo)
          : undefined;
        const hit = box ? Math.min(box.width, box.height) : NaN;
        const measured = art
          ? art.height
          : box
            ? surface.axis === 'cross'
              ? Math.min(box.width, box.height)
              : box.height
            : NaN;
        results.push({
          surface: surface.name,
          path,
          size,
          fit: surface.fit,
          expected,
          measured,
          ...(art && { width: art.width, hit }),
        });
        if (art) {
          expect
            .soft(
              Math.abs(art.width - expected),
              `${surface.name} ${size} width equals ${expected}px (measured ${art.width}px)`,
            )
            .toBeLessThanOrEqual(1);
          expect
            .soft(hit, `${surface.name} ${size} hit area covers its visible artwork`)
            .toBeGreaterThanOrEqual(Math.max(art.width, art.height) - 1);
        }
        if (surface.hit !== undefined)
          expect
            .soft(hit, `${surface.name} ${size} hit area reaches at least ${surface.hit}px`)
            .toBeGreaterThanOrEqual(surface.hit - 1);
        const label = `${surface.name} ${size} ${surface.fit === 'min' ? 'reaches at least' : 'equals'} ${expected}px`;
        if (surface.fit === 'min')
          expect.soft(measured, label).toBeGreaterThanOrEqual(expected - 1);
        else
          expect
            .soft(Math.abs(measured - expected), `${label} (measured ${measured}px)`)
            .toBeLessThanOrEqual(1);
      }
      await page.screenshot({
        path: testInfo.outputPath(`component-sizes-${stage}`, `${slug}-${size}.png`),
      });
      if (surface.dismiss) {
        await page.keyboard.press('Escape');
        await expect.soft(target, `${surface.name} popup closes`).toBeHidden();
      }
    }
  }
  await testInfo.attach(`component-sizes-${stage}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
});
