import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * P1-C RED control: documentation shell surfaces. Exactly one browser test.
 *
 * Shared contract under test. The roles below are declared on :root by the central theme
 * output and consumed by the DocsShell owner; no other stylesheet repaints these regions.
 *
 *   role         painted by                                          light     dark
 *   --shell-bg   header, sidebar, table of contents, mobile drawer   #E6E2D7   #000000
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
 * The "Find a component" field is the canonical GenUX input well: exactly one
 * `.genux-input-frame[data-genux-input]` paints the --field-bg fill, and the native search inside
 * it paints no fill, border or shadow of its own. The frame uses the shared underlined variant, so
 * its strongest resting edge is the functional field border on the bottom and needs 3:1 against
 * the unfocused fill. Separately, the keyboard focus marker the shared frame paints on its bottom
 * edge needs 3:1 against the focused fill after Shift+Tab, Tab; neither state stands in for the
 * other. Recognisability against the shell it sits on is attached as a report only; it is
 * reported, never recoloured.
 */

type Mode = 'light' | 'dark';
type Rgb = readonly [number, number, number];
type Paint = Readonly<{ rgb: Rgb; alpha: number }>;

const BASE_URL = process.env.GENUX_DOCS_URL ?? 'http://127.0.0.1:4324';
const WIDTHS = [
  { label: 'desktop', viewport: { width: 1280, height: 800 } },
  { label: '320', viewport: { width: 320, height: 640 } },
] as const;
const MODES: readonly Mode[] = ['light', 'dark'];
const EXPECTED: Readonly<
  Record<Mode, Readonly<{ shell: string; panel: string; field: string | null }>>
> = {
  light: { shell: '#e6e2d7', panel: '#ffffff', field: null },
  dark: { shell: '#000000', panel: '#2c2c2c', field: '#1b1b1b' },
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

const RGB_COLOR = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/;
/** CSS Color 4 computed sRGB, e.g. from color-mix() or a tweened value; channels are 0..1. */
const SRGB_COLOR =
  /^color\(\s*srgb\s+([-+.\deE]+)\s+([-+.\deE]+)\s+([-+.\deE]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/;

function parseAlpha(raw: string | undefined): number {
  return raw === undefined ? 1 : raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
}

/** Maps a 0..1 sRGB channel onto the 0..255 byte scale, clamped to the sRGB gamut. */
function toByte(channel: number): number {
  return Math.round(Math.min(Math.max(channel, 0), 1) * 255);
}

function parseColor(value: string): Paint {
  const text = value.trim();
  const rgb = RGB_COLOR.exec(text);
  if (rgb)
    return { rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])], alpha: parseAlpha(rgb[4]) };
  const srgb = SRGB_COLOR.exec(text);
  if (srgb) {
    const channels = [Number(srgb[1]), Number(srgb[2]), Number(srgb[3])] as const;
    const alpha = parseAlpha(srgb[4]);
    if (channels.every(Number.isFinite) && Number.isFinite(alpha))
      return { rgb: [toByte(channels[0]), toByte(channels[1]), toByte(channels[2])], alpha };
  }
  throw new Error(`Unsupported computed color "${value}"`);
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
/** The canonical GenUX input well: the single paint owner of an editable field. */
const FIELD_OWNER = '.genux-input-frame[data-genux-input]';
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

type Marker = Readonly<{ rgb: Rgb; contrast: number; outline: number; boxShadow: string }>;

/**
 * Keyboard focus marker of the shared well. Shift+Tab, Tab gives the field keyboard modality and
 * :focus-visible; the first color stop of the frame's background image is the bottom marker,
 * flattened onto the focused fill. Null when the frame paints no marker image.
 */
async function focusMarker(page: Page, input: Locator, well: Locator): Promise<Marker | null> {
  await input.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(input, 'Shift+Tab then Tab must return keyboard focus to the field').toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'keyboard');
  // Visual paint is read after the finite native animations of the well and its dialog finish,
  // so the focused fill and marker are final values; infinite animations are ignored.
  const paint = await well.evaluate(async element => {
    const scopes = [element.closest('dialog'), element].filter(
      (scope): scope is HTMLElement | SVGElement => scope !== null,
    );
    await Promise.all(
      scopes
        .flatMap(scope => scope.getAnimations({ subtree: true }))
        .filter(animation => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
        .map(animation => animation.finished.catch(() => undefined)),
    );
    const style = getComputedStyle(element);
    return {
      image: style.backgroundImage,
      fill: style.backgroundColor,
      outline: style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
    };
  });
  const stop = /(?:rgba?|color)\([^)]*\)/.exec(paint.image);
  if (!stop) return null;
  const fill = parseColor(paint.fill).rgb;
  const rgb = flatten(parseColor(stop[0]), fill);
  return { rgb, contrast: contrast(rgb, fill), outline: paint.outline, boxShadow: paint.boxShadow };
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
  // A native modal dialog makes the rest of the page inert without an [inert] attribute, so the
  // dialog itself must report closed and the toggle collapsed.
  await expect(
    page.locator(`dialog:has(${MENU_CLOSE})`).first(),
    'the close control must close the native drawer dialog',
  ).not.toHaveAttribute('open');
  await expect(
    page.locator(MENU_TOGGLE).first(),
    'closing the drawer must collapse the menu toggle',
  ).toHaveAttribute('aria-expanded', 'false');
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
  // A focused sidebar control reopens the modal drawer across a resize to keep its focus; close
  // it through its own control first so the header theme switch is reachable.
  const close = page.locator(MENU_CLOSE).first();
  if ((await close.count()) > 0 && (await close.isVisible())) await closeMenu(page);
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
      localStorage.setItem('genux-theme', 'light');
    } catch {
      // The theme bootstrap then falls back to the emulated light scheme.
    }
  });
  await page.setViewportSize(WIDTHS[0].viewport);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

  const header = page.getByRole('banner').first();
  const sidebar = page.getByRole('complementary').first();
  const main = page.getByRole('main');
  const fieldInput = page.getByRole('searchbox', { name: 'Find a component' });
  const field = page.locator(FIELD_OWNER).filter({ has: fieldInput });
  const optionalShell = [
    { name: 'table of contents', locator: page.locator('.toc').first() },
    { name: 'mobile drawer', locator: page.locator('[data-docs-drawer]').first() },
  ] as const;
  await expect(header).toBeAttached();
  await expect(sidebar).toBeAttached();
  await expect(main).toBeAttached();
  await expect(fieldInput).toHaveAttribute('id', 'component-search');
  await expect(field, 'the search field has exactly one canonical well paint owner').toHaveCount(1);

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

      // Field: the canonical well paints a neutral grey fill, darker than the panel, exact in
      // dark; the native search inside it paints nothing of its own and keeps readable text.
      const fieldPaint = parseColor(await computed(field, 'background-color'));
      expect(fieldPaint.alpha, `${where} field well must paint an opaque surface`).toBe(1);
      const native = await fieldInput.evaluate(element => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          borders: ['top', 'right', 'bottom', 'left'].map(side =>
            Number.parseFloat(style.getPropertyValue(`border-${side}-width`)),
          ),
          boxShadow: style.boxShadow,
        };
      });
      expect(
        parseColor(native.background).alpha,
        `${where} native search must leave the fill to its well`,
      ).toBe(0);
      expect(native.borders, `${where} native search must draw no border of its own`).toEqual([
        0, 0, 0, 0,
      ]);
      expect(native.boxShadow, `${where} native search must paint no shadow of its own`).toBe(
        'none',
      );
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
      const ink = flatten(parseColor(await computed(fieldInput, 'color')), fieldPaint.rgb);
      const inkContrast = contrast(ink, fieldPaint.rgb);
      expect(inkContrast, `${where} field text contrast`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);

      // Two separate 3:1 cues (soft, so the report still attaches): the resting edge against the
      // unfocused fill here, and the keyboard focus marker against the focused fill below.
      // Recognisability against the shell is reported only.
      const restEdge = await strongestBoundary(field, fieldPaint.rgb);
      const restContrast = restEdge?.contrast ?? 1;
      expect
        .soft(
          restContrast,
          `${where} field ${fieldHex} resting edge needs at least ${MIN_BOUNDARY_CONTRAST}:1 against the unfocused fill (edge ${restEdge ? `${restEdge.side} ${toHex(restEdge.rgb)}` : 'none'})`,
        )
        .toBeGreaterThanOrEqual(MIN_BOUNDARY_CONTRAST);
      const shellContrast = contrast(fieldPaint.rgb, shellRgb);
      await testInfo.attach(`shell-surfaces-${mode}-${label}.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      if (label === 'desktop') await expectRoleIsolation(page, { header, sidebar, main, field });
      const marker = await focusMarker(page, fieldInput, field);
      const markerContrast = marker?.contrast ?? 1;
      expect
        .soft(
          markerContrast,
          `${where} field ${fieldHex} keyboard focus marker needs at least ${MIN_BOUNDARY_CONTRAST}:1 against the focused fill (marker ${marker ? toHex(marker.rgb) : 'none'})`,
        )
        .toBeGreaterThanOrEqual(MIN_BOUNDARY_CONTRAST);
      expect.soft(marker?.outline ?? 0, `${where} field focus draws no outline`).toBe(0);
      expect
        .soft(marker?.boxShadow ?? 'none', `${where} field focus draws no box-shadow ring`)
        .not.toMatch(/ 0px 0px 0px [1-9]/);
      report.push({
        width: label,
        mode,
        drawer: drawerOpened ? 'opened via menu toggle' : 'no visible menu toggle',
        shell: { header: expected.shell, sidebar: expected.shell, ...optional },
        panel: expected.panel,
        field: {
          owner: FIELD_OWNER,
          background: fieldHex,
          ink: toHex(ink),
          inkContrast: ratio(inkContrast),
          restEdge: restEdge ? toHex(restEdge.rgb) : 'none',
          restEdgeSide: restEdge?.side ?? 'none',
          restBoundaryContrast: ratio(restContrast),
          meetsFunctionalBoundary: restContrast >= MIN_BOUNDARY_CONTRAST,
          focusMarker: marker ? toHex(marker.rgb) : 'none',
          focusMarkerContrast: ratio(markerContrast),
          meetsFocusMarkerContrast: markerContrast >= MIN_BOUNDARY_CONTRAST,
          shellContrast: ratio(shellContrast),
          ambiguousOnShell: shellContrast < FIELD_RECOGNITION_RATIO,
        },
      });
      if (drawerOpened) await closeMenu(page);
    }
  }
  await testInfo.attach('shell-surfaces-report.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
});
