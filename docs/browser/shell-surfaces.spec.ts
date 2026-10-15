import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * P1-C RED control: documentation shell surfaces. Exactly one browser test.
 *
 * Shared contract under test. The roles below are declared on :root by the central theme
 * output and consumed by the DocsShell owner; no other stylesheet repaints these regions.
 *
 *   role         painted by                                          light     dark
 *   --shell-bg   header, sidebar, table of contents, mobile drawer   #E6E2D7   #191302
 *   --panel-bg   the entire main content column                      #FFFFFF   #2C2C2C
 *   --field-bg   editable fields such as "Find a component"          neutral   #1B1B1B
 *                                                                    grey, darker than the panel
 *
 * The three roles are isolated: overriding one of them on :root moves only its own regions.
 * html and body never paint shell and panel together; every region paints its own role.
 * Optional shell regions (table of contents `.toc`, mobile drawer `[data-docs-drawer]`) are
 * asserted whenever they are rendered on the overview page at the measured width.
 *
 * At 320 px the DocsShell may close the sidebar behind a visible `[data-docs-menu-toggle]`. The
 * test then opens it through that toggle, measures, and closes it through `[data-docs-menu-close]`
 * before the next theme switch. Computed styles are read even when a modal drawer makes the
 * background inert; an always-visible sidebar is measured as rendered.
 *
 * The "Find a component" field must keep a functional boundary of at least 3:1 against its own
 * fill. Its recognisability against the shell it sits on is attached as a report only; it is
 * reported, never recoloured.
 */

type Mode = 'light' | 'dark';
type Rgb = readonly [number, number, number];
type Paint = Readonly<{ rgb: Rgb; alpha: number }>;

const BASE_URL = process.env.ATLAS_DOCS_URL ?? 'http://127.0.0.1:4324';
const WIDTHS = [
  { label: 'desktop', viewport: { width: 1280, height: 800 } },
  { label: '320', viewport: { width: 320, height: 640 } },
] as const;
const MODES: readonly Mode[] = ['light', 'dark'];
const EXPECTED: Readonly<
  Record<Mode, Readonly<{ shell: string; panel: string; field: string | null }>>
> = {
  light: { shell: '#e6e2d7', panel: '#ffffff', field: null },
  dark: { shell: '#191302', panel: '#2c2c2c', field: '#1b1b1b' },
};
const NEUTRAL_CHANNEL_TOLERANCE = 2;
const MIN_TEXT_CONTRAST = 4.5;
const MIN_BOUNDARY_CONTRAST = 3;
/** Below this ratio the field and the shell it sits on are hard to tell apart; reported only. */
const FIELD_RECOGNITION_RATIO = 1.5;
const PROBES = {
  '--shell-bg': '#654321',
  '--panel-bg': '#123456',
  '--field-bg': '#abcdef',
} as const;
type Role = keyof typeof PROBES;

function parseColor(value: string): Paint {
  const match = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(
    value.trim(),
  );
  if (!match) throw new Error(`Unsupported computed color "${value}"`);
  const raw = match[4];
  const alpha =
    raw === undefined ? 1 : raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
  return { rgb: [Number(match[1]), Number(match[2]), Number(match[3])], alpha };
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function linear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** Flattens a translucent paint onto its underlying surface so contrast reflects what is seen. */
function flatten(paint: Paint, under: Rgb): Rgb {
  const mix = (index: 0 | 1 | 2) =>
    Math.round(paint.rgb[index] * paint.alpha + under[index] * (1 - paint.alpha));
  return [mix(0), mix(1), mix(2)];
}

const ratio = (value: number): number => Math.round(value * 100) / 100;

const MENU_TOGGLE = '[data-docs-menu-toggle]';
const MENU_CLOSE = '[data-docs-menu-close]';
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Boundary = Readonly<{ side: (typeof SIDES)[number]; rgb: Rgb; contrast: number }>;

/** Strongest painted border edge of the field against its own fill; null when no edge is painted. */
async function strongestBoundary(field: Locator, fill: Rgb): Promise<Boundary | null> {
  const edges = await field.evaluate((element, sides) => {
    const style = getComputedStyle(element);
    return sides.map(side => ({
      side,
      width: Number.parseFloat(style.getPropertyValue(`border-${side}-width`)),
      lineStyle: style.getPropertyValue(`border-${side}-style`),
      color: style.getPropertyValue(`border-${side}-color`),
    }));
  }, SIDES);
  let strongest: Boundary | null = null;
  for (const edge of edges) {
    if (!(edge.width > 0) || edge.lineStyle === 'none' || edge.lineStyle === 'hidden') continue;
    const rgb = flatten(parseColor(edge.color), fill);
    const value = contrast(rgb, fill);
    if (!strongest || value > strongest.contrast)
      strongest = { side: edge.side, rgb, contrast: value };
  }
  return strongest;
}

/**
 * At narrow widths the DocsShell may close the sidebar behind a menu toggle. When a visible
 * toggle exists, open the drawer through it so the shell is measured as users see it; an
 * always-visible sidebar is measured as rendered. Returns whether the drawer was opened.
 */
async function openMenuIfToggled(page: Page): Promise<boolean> {
  const toggle = page.locator(MENU_TOGGLE).first();
  if ((await toggle.count()) === 0 || !(await toggle.isVisible())) return false;
  await toggle.click();
  await expect(
    page.locator(MENU_CLOSE).first(),
    'the menu toggle must open a drawer with its own close control',
  ).toBeVisible();
  return true;
}

/** Closes the drawer through its own control so the header theme switch is reachable again. */
async function closeMenu(page: Page): Promise<void> {
  await page.locator(MENU_CLOSE).first().click();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('header, main')).every(
            element => element.closest('[inert]') === null,
          ),
        ),
      { message: 'closing the drawer must release the inert header and main column' },
    )
    .toBe(true);
}

async function computed(locator: Locator, property: string): Promise<string> {
  return locator.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );
}

async function expectSurface(locator: Locator, hex: string, what: string): Promise<Rgb> {
  const paint = parseColor(await computed(locator, 'background-color'));
  expect(paint.alpha, `${what} must paint an opaque surface of its own`).toBe(1);
  expect(toHex(paint.rgb), `${what} background`).toBe(hex);
  return paint.rgb;
}

/** Switches through the native header switch and waits for the atomic theme paint to settle. */
async function ensureMode(page: Page, mode: Mode): Promise<void> {
  const html = page.locator('html');
  const toggle = page.getByRole('switch', { name: 'Dark theme' });
  if ((await html.getAttribute('data-theme')) !== mode) await toggle.click();
  await expect(html).toHaveAttribute('data-theme', mode);
  await expect(html).not.toHaveAttribute('data-theme-paint');
  await expect(toggle).toHaveAttribute('aria-checked', String(mode === 'dark'));
}

/** Overriding one role on :root must move exactly the regions that own it and nothing else. */
async function expectRoleIsolation(
  page: Page,
  regions: Readonly<{ header: Locator; sidebar: Locator; main: Locator; field: Locator }>,
): Promise<void> {
  const probes: readonly Readonly<{
    role: Role;
    moves: readonly Locator[];
    stays: readonly Locator[];
  }>[] = [
    {
      role: '--shell-bg',
      moves: [regions.header, regions.sidebar],
      stays: [regions.main, regions.field],
    },
    {
      role: '--panel-bg',
      moves: [regions.main],
      stays: [regions.header, regions.sidebar, regions.field],
    },
    {
      role: '--field-bg',
      moves: [regions.field],
      stays: [regions.header, regions.sidebar, regions.main],
    },
  ];
  const backgrounds = (locators: readonly Locator[]) =>
    Promise.all(locators.map(locator => computed(locator, 'background-color')));
  for (const probe of probes) {
    const value = PROBES[probe.role];
    const untouched = await backgrounds(probe.stays);
    await page.evaluate(
      ([name, override]) => document.documentElement.style.setProperty(name, override),
      [probe.role, value] as const,
    );
    try {
      for (const region of probe.moves)
        expect(
          toHex(parseColor(await computed(region, 'background-color')).rgb),
          `${probe.role} override must move the region that owns it`,
        ).toBe(value);
      expect(
        await backgrounds(probe.stays),
        `${probe.role} override must not move the other roles`,
      ).toEqual(untouched);
    } finally {
      await page.evaluate(name => document.documentElement.style.removeProperty(name), probe.role);
    }
  }
}

test('docs shell, panel and field roles paint exact isolated surfaces in both themes', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // Zero-duration transitions: computed colors are final values, never mid-transition frames.
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('atlas-theme', 'light');
    } catch {
      // The theme bootstrap then falls back to the emulated light scheme.
    }
  });
  await page.setViewportSize(WIDTHS[0].viewport);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

  const header = page.getByRole('banner').first();
  const sidebar = page.getByRole('complementary').first();
  const main = page.getByRole('main');
  const field = page.getByRole('searchbox', { name: 'Find a component' });
  const optionalShell = [
    { name: 'table of contents', locator: page.locator('.toc').first() },
    { name: 'mobile drawer', locator: page.locator('[data-docs-drawer]').first() },
  ] as const;
  await expect(header).toBeAttached();
  await expect(sidebar).toBeAttached();
  await expect(main).toBeAttached();
  await expect(field).toBeAttached();

  const report: Record<string, unknown>[] = [];
  for (const { label, viewport } of WIDTHS) {
    await page.setViewportSize(viewport);
    for (const mode of MODES) {
      await ensureMode(page, mode);
      const drawerOpened = await openMenuIfToggled(page);
      const expected = EXPECTED[mode];
      const where = `${label} ${mode}`;

      // Shell: header and sidebar always; table of contents and drawer whenever rendered.
      const shellRgb = await expectSurface(header, expected.shell, `${where} header`);
      await expectSurface(sidebar, expected.shell, `${where} sidebar`);
      const optional: Record<string, string> = {};
      for (const { name, locator } of optionalShell) {
        if ((await locator.count()) === 0) {
          optional[name] = 'not rendered';
          continue;
        }
        await expectSurface(locator, expected.shell, `${where} ${name}`);
        optional[name] = expected.shell;
      }

      // Panel: the main column paints its own opaque surface; html/body leave that role to it.
      const panelRgb = await expectSurface(main, expected.panel, `${where} main column`);
      for (const name of ['html', 'body'] as const) {
        const paint = parseColor(await computed(page.locator(name), 'background-color'));
        if (paint.alpha === 1)
          expect(
            toHex(paint.rgb),
            `${where} ${name} must leave the panel role to the main column`,
          ).not.toBe(expected.panel);
      }

      // Field: neutral grey, darker than the panel, exact in dark, readable text.
      const fieldPaint = parseColor(await computed(field, 'background-color'));
      expect(fieldPaint.alpha, `${where} field must paint an opaque surface`).toBe(1);
      const fieldHex = toHex(fieldPaint.rgb);
      if (expected.field) {
        expect(fieldHex, `${where} field background`).toBe(expected.field);
      } else {
        const spread = Math.max(...fieldPaint.rgb) - Math.min(...fieldPaint.rgb);
        expect(
          spread,
          `${where} field ${fieldHex} must be neutral grey (RGB channels within ${NEUTRAL_CHANNEL_TOLERANCE})`,
        ).toBeLessThanOrEqual(NEUTRAL_CHANNEL_TOLERANCE);
      }
      expect(
        luminance(fieldPaint.rgb),
        `${where} field ${fieldHex} must be darker than the panel ${expected.panel}`,
      ).toBeLessThan(luminance(panelRgb));
      const ink = flatten(parseColor(await computed(field, 'color')), fieldPaint.rgb);
      const inkContrast = contrast(ink, fieldPaint.rgb);
      expect(inkContrast, `${where} field text contrast`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);

      // Functional boundary is asserted (soft, so the report still attaches); recognisability
      // against the shell is measured and reported only.
      const boundary = await strongestBoundary(field, fieldPaint.rgb);
      const boundaryContrast = boundary?.contrast ?? 1;
      expect
        .soft(
          boundaryContrast,
          `${where} field ${fieldHex} needs a painted border edge of at least ${MIN_BOUNDARY_CONTRAST}:1 (strongest ${boundary ? `${boundary.side} ${toHex(boundary.rgb)}` : 'none'})`,
        )
        .toBeGreaterThanOrEqual(MIN_BOUNDARY_CONTRAST);
      const shellContrast = contrast(fieldPaint.rgb, shellRgb);
      report.push({
        width: label,
        mode,
        drawer: drawerOpened ? 'opened via menu toggle' : 'no visible menu toggle',
        shell: { header: expected.shell, sidebar: expected.shell, ...optional },
        panel: expected.panel,
        field: {
          background: fieldHex,
          ink: toHex(ink),
          inkContrast: ratio(inkContrast),
          boundary: boundary ? toHex(boundary.rgb) : 'none',
          boundarySide: boundary?.side ?? 'none',
          boundaryContrast: ratio(boundaryContrast),
          meetsFunctionalBoundary: boundaryContrast >= MIN_BOUNDARY_CONTRAST,
          shellContrast: ratio(shellContrast),
          ambiguousOnShell: shellContrast < FIELD_RECOGNITION_RATIO,
        },
      });
      await testInfo.attach(`shell-surfaces-${mode}-${label}.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      if (label === 'desktop') await expectRoleIsolation(page, { header, sidebar, main, field });
      if (drawerOpened) await closeMenu(page);
    }
  }
  await testInfo.attach('shell-surfaces-report.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
});
