import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

/**
 * P1-B red control for sidebar navigation row states.
 *
 * Specified contract (DocsNav; the P1-C shell contract shares the surface):
 * - Clickable rows touch (gap and margin 0); the painted background lives on a
 *   `::before` pseudo inset `2px 0` with its own radius, so the visible
 *   backgrounds of adjacent rows keep a gap of at least 2px.
 * - `--nav-item-bg-hover` is a weak neutral, `--nav-item-bg-active` is a
 *   low-alpha accent wash and `--nav-item-fg-active` is the accent; hover and
 *   active resolve to different computed colors in both themes.
 * - Same-origin CSSOM proves the `::before` hover and active rules consume
 *   `var(--nav-item-bg-hover)` and `var(--nav-item-bg-active)`, not merely declare them.
 * - Visual references are never approved by this file: before/after images are
 *   attached for human review instead of being written as baselines.
 *
 * The anchors under `.sidebar .navigation` are the stable API before and after
 * the DocsNav extraction, so every selector stays on them.
 */

const PREVIEW_URL = process.env.ATLAS_PREVIEW_URL ?? 'http://127.0.0.1:4324';
const PAGE_PATH = '/getting-started/';
const THEMES = ['light', 'dark'] as const;
type ThemeMode = (typeof THEMES)[number];

const NAV = '.sidebar .navigation';
const ACTIVE_ROW = `${NAV} li:has(> a[aria-current='page']) > a`;
const ADJACENT_ROW = `${NAV} li:has(> a[aria-current='page']) + li > a`;

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  return raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
}

/** Chromium reports sRGB colors as rgb()/rgba() and color-mix() results as color(srgb ...). */
function parseColor(value: string): Rgba | null {
  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)$/,
  );
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: parseAlpha(rgb[4]) };
  }
  const srgb = value.match(
    /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/,
  );
  if (srgb) {
    return {
      r: Number(srgb[1]) * 255,
      g: Number(srgb[2]) * 255,
      b: Number(srgb[3]) * 255,
      a: parseAlpha(srgb[4]),
    };
  }
  return null;
}

interface RowPaint {
  paintsOnPseudo: boolean;
  background: string;
  color: string;
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function applyTheme(page: Page, mode: ThemeMode): Promise<void> {
  await page.evaluate(theme => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, mode);
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
  await settle(page);
}

async function restPointer(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await settle(page);
}

/** Effective paint of a row: the `::before` layer once it exists, otherwise the host box. */
function readRowPaint(row: Locator): Promise<RowPaint> {
  return row.evaluate(element => {
    const pseudo = getComputedStyle(element, '::before');
    const paintsOnPseudo =
      pseudo.content !== 'none' && pseudo.content !== 'normal' && pseudo.content !== '';
    const source = paintsOnPseudo ? pseudo : getComputedStyle(element);
    return {
      paintsOnPseudo,
      background: source.backgroundColor,
      color: getComputedStyle(element).color,
    };
  });
}

/** Resolves a token exactly as a navigation descendant would, through a temporary probe. */
function probeToken(
  page: Page,
  property: 'background-color' | 'color',
  token: string,
): Promise<string> {
  return page.evaluate(
    ([selector, prop, name]) => {
      const host = document.querySelector(selector);
      if (!host) throw new Error(`Navigation host missing: ${selector}`);
      const probe = document.createElement('span');
      probe.style.setProperty(prop, `var(${name})`);
      host.append(probe);
      const value = getComputedStyle(probe).getPropertyValue(prop);
      probe.remove();
      return value;
    },
    [`${NAV} nav`, property, token] as const,
  );
}

interface ConsumingRule {
  selector: string;
  declaration: string;
  stylesheet: string;
}

/**
 * Walks same-origin CSSOM (grouping, nested and imported rules) for `::before` rules that carry
 * `state`, match this row once the pseudo-element is dropped, and declare a background consuming
 * `var(token)`. Proves the state paint is wired to the token rather than that the token exists.
 */
function findConsumingRules(
  row: Locator,
  state: ':hover' | 'aria-current',
  token: string,
): Promise<ConsumingRule[]> {
  return row.evaluate(
    (element, [stateMarker, name]) => {
      const found: ConsumingRule[] = [];
      const splitList = (list: string): string[] => {
        const parts: string[] = [];
        let depth = 0;
        let start = 0;
        for (let index = 0; index < list.length; index += 1) {
          const char = list[index];
          if (char === '(') depth += 1;
          else if (char === ')') depth -= 1;
          else if (char === ',' && depth === 0) {
            parts.push(list.slice(start, index).trim());
            start = index + 1;
          }
        }
        parts.push(list.slice(start).trim());
        return parts;
      };
      const resolve = (rule: CSSStyleRule): string => {
        const parent = rule.parentRule;
        if (!(parent instanceof CSSStyleRule)) return rule.selectorText;
        const outer = `:is(${resolve(parent)})`;
        return splitList(rule.selectorText)
          .map(part => (part.includes('&') ? part.split('&').join(outer) : `${outer} ${part}`))
          .join(', ');
      };
      const consumes = (value: string): boolean => {
        const compact = value.split(' ').join('');
        return compact.includes(`var(${name})`) || compact.includes(`var(${name},`);
      };
      const visitSheet = (sheet: CSSStyleSheet): void => {
        if (sheet.href && new URL(sheet.href, location.href).origin !== location.origin) return;
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          return;
        }
        visitRules(rules, sheet.href ?? 'inline <style>');
      };
      const visitRules = (rules: CSSRuleList, stylesheet: string): void => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSImportRule) {
            if (rule.styleSheet) visitSheet(rule.styleSheet);
            continue;
          }
          if (rule instanceof CSSStyleRule) {
            const declaration = ['background-color', 'background']
              .map(property => rule.style.getPropertyValue(property))
              .find(consumes);
            if (declaration !== undefined) {
              for (const part of splitList(resolve(rule))) {
                if (!/::?before/.test(part) || !part.includes(stateMarker)) continue;
                let matches = false;
                try {
                  matches = element.matches(part.replace(/::?before/g, ''));
                } catch {
                  matches = false;
                }
                if (matches) found.push({ selector: part, declaration, stylesheet });
              }
            }
          }
          if ('cssRules' in rule) visitRules((rule as CSSGroupingRule).cssRules, stylesheet);
        }
      };
      for (const sheet of [...Array.from(document.styleSheets), ...document.adoptedStyleSheets])
        visitSheet(sheet);
      return found;
    },
    [state, token] as const,
  );
}

async function attachImage(testInfo: TestInfo, name: string, body: Buffer): Promise<void> {
  await testInfo.attach(`${name}.png`, { body, contentType: 'image/png' });
}

test.use({ viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page }) => {
  // Zero-length transitions keep computed colors immediate; the motion contract is untouched.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${PREVIEW_URL}${PAGE_PATH}`);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator(ACTIVE_ROW)).toHaveAttribute('href', PAGE_PATH);
  await expect(page.locator(ADJACENT_ROW)).toBeVisible();
});

test.describe('Sidebar navigation row states', () => {
  test('active row and hovered neighbour paint the specified states in light and dark; before/after images are attached, never auto-approved', async ({
    page,
  }, testInfo) => {
    for (const mode of THEMES) {
      await test.step(`${mode} theme`, async () => {
        await applyTheme(page, mode);
        await restPointer(page);
        const nav = page.locator(NAV);
        const active = page.locator(ACTIVE_ROW);
        const adjacent = page.locator(ADJACENT_ROW);

        const activeRest = await readRowPaint(active);
        const adjacentRest = await readRowPaint(adjacent);
        await attachImage(testInfo, `sidebar-${mode}-before-hover`, await nav.screenshot());

        await adjacent.hover();
        await settle(page);
        const adjacentHover = await readRowPaint(adjacent);
        const activeDuringHover = await readRowPaint(active);
        await attachImage(testInfo, `sidebar-${mode}-after-hover`, await nav.screenshot());
        await restPointer(page);

        const activeBg = parseColor(activeRest.background);
        const hoverBg = parseColor(adjacentHover.background);
        expect(
          activeBg,
          `${mode}: active background is not a parseable color: ${activeRest.background}`,
        ).not.toBeNull();
        expect(
          hoverBg,
          `${mode}: hover background is not a parseable color: ${adjacentHover.background}`,
        ).not.toBeNull();
        // Active identity is a low-alpha accent wash, not an opaque fill.
        expect(
          activeBg?.a ?? 0,
          `${mode}: active background must be visible, got ${activeRest.background}`,
        ).toBeGreaterThan(0);
        expect(
          activeBg?.a ?? 1,
          `${mode}: active background must be a low-alpha accent wash, got ${activeRest.background}`,
        ).toBeLessThan(1);
        // Hover is its own visible state on the neighbour and differs from the active wash.
        expect(
          hoverBg?.a ?? 0,
          `${mode}: hovered background must be visible, got ${adjacentHover.background}`,
        ).toBeGreaterThan(0);
        expect(
          adjacentHover.background,
          `${mode}: hover must change the neighbour background`,
        ).not.toBe(adjacentRest.background);
        expect(
          adjacentHover.background,
          `${mode}: hover and active backgrounds must differ`,
        ).not.toBe(activeRest.background);
        // Hovering the neighbour never disturbs the active row's identity.
        expect(
          activeDuringHover.background,
          `${mode}: active background must survive neighbour hover`,
        ).toBe(activeRest.background);
        expect(
          activeDuringHover.color,
          `${mode}: active text color must survive neighbour hover`,
        ).toBe(activeRest.color);
        expect(activeRest.color, `${mode}: active text must differ from resting rows`).not.toBe(
          adjacentRest.color,
        );
      });
    }
  });

  test('visible row backgrounds keep a gap of at least 2px while clickable rows stay adjacent', async ({
    page,
  }) => {
    for (const mode of THEMES) {
      await test.step(`${mode} theme`, async () => {
        await applyTheme(page, mode);
        await restPointer(page);
        const geometry = await page.evaluate(
          ([activeSelector, adjacentSelector]) => {
            const read = (selector: string) => {
              const element = document.querySelector<HTMLElement>(selector);
              if (!element) throw new Error(`Row missing: ${selector}`);
              const host = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              const pseudo = getComputedStyle(element, '::before');
              return {
                host: { top: host.top, bottom: host.bottom },
                margin: { top: style.marginTop, bottom: style.marginBottom },
                pseudo: {
                  exists:
                    pseudo.content !== 'none' &&
                    pseudo.content !== 'normal' &&
                    pseudo.content !== '',
                  position: pseudo.position,
                  top: pseudo.top,
                  bottom: pseudo.bottom,
                  borderRadius: pseudo.borderRadius,
                },
              };
            };
            return { active: read(activeSelector), adjacent: read(adjacentSelector) };
          },
          [ACTIVE_ROW, ADJACENT_ROW] as const,
        );

        const clickableGap = geometry.adjacent.host.top - geometry.active.host.bottom;
        expect(
          Math.abs(clickableGap),
          `${mode}: clickable rows must touch, measured gap ${clickableGap}px`,
        ).toBeLessThanOrEqual(0.5);

        for (const [name, row] of Object.entries(geometry)) {
          expect(row.margin.top, `${mode}: ${name} row margin-top must be 0`).toBe('0px');
          expect(row.margin.bottom, `${mode}: ${name} row margin-bottom must be 0`).toBe('0px');
          expect(
            row.pseudo.exists,
            `${mode}: ${name} row must paint its background on ::before`,
          ).toBe(true);
          expect(
            row.pseudo.position,
            `${mode}: ${name} row ::before must be absolutely positioned`,
          ).toBe('absolute');
          expect(
            Number.parseFloat(row.pseudo.top),
            `${mode}: ${name} row ::before top inset must resolve, got ${row.pseudo.top}`,
          ).toBeGreaterThanOrEqual(0);
          expect(
            Number.parseFloat(row.pseudo.bottom),
            `${mode}: ${name} row ::before bottom inset must resolve, got ${row.pseudo.bottom}`,
          ).toBeGreaterThanOrEqual(0);
          expect(
            row.pseudo.borderRadius,
            `${mode}: ${name} row ::before must carry the row radius`,
          ).not.toBe('0px');
        }

        const visibleActiveBottom =
          geometry.active.host.bottom - Number.parseFloat(geometry.active.pseudo.bottom);
        const visibleAdjacentTop =
          geometry.adjacent.host.top + Number.parseFloat(geometry.adjacent.pseudo.top);
        const visibleGap = visibleAdjacentTop - visibleActiveBottom;
        expect(
          visibleGap,
          `${mode}: visible backgrounds must keep at least 2px apart, measured ${visibleGap}px`,
        ).toBeGreaterThanOrEqual(2);
      });
    }
  });

  test('hover and active rows consume separate tokens that resolve to different colors', async ({
    page,
  }) => {
    for (const mode of THEMES) {
      await test.step(`${mode} theme`, async () => {
        await applyTheme(page, mode);
        await restPointer(page);
        const active = page.locator(ACTIVE_ROW);
        const adjacent = page.locator(ADJACENT_ROW);

        const declared = await active.evaluate(element => {
          const style = getComputedStyle(element);
          const read = (name: string) => style.getPropertyValue(name).trim();
          return {
            hover: read('--nav-item-bg-hover'),
            active: read('--nav-item-bg-active'),
            fgActive: read('--nav-item-fg-active'),
          };
        });
        expect(declared.hover, `${mode}: --nav-item-bg-hover must reach the row`).not.toBe('');
        expect(declared.active, `${mode}: --nav-item-bg-active must reach the row`).not.toBe('');
        expect(declared.fgActive, `${mode}: --nav-item-fg-active must reach the row`).not.toBe('');
        expect(
          declared.hover,
          `${mode}: hover and active must be separate tokens, both are ${declared.hover}`,
        ).not.toBe(declared.active);

        const hoverToken = await probeToken(page, 'background-color', '--nav-item-bg-hover');
        const activeToken = await probeToken(page, 'background-color', '--nav-item-bg-active');
        const fgActiveToken = await probeToken(page, 'color', '--nav-item-fg-active');
        const accent = await probeToken(page, 'color', '--accent');
        expect(
          parseColor(hoverToken)?.a ?? 0,
          `${mode}: --nav-item-bg-hover must resolve to a visible color, got ${hoverToken}`,
        ).toBeGreaterThan(0);
        expect(
          parseColor(activeToken)?.a ?? 0,
          `${mode}: --nav-item-bg-active must resolve to a visible color, got ${activeToken}`,
        ).toBeGreaterThan(0);
        expect(
          hoverToken,
          `${mode}: hover and active tokens must compute to different colors`,
        ).not.toBe(activeToken);
        expect(fgActiveToken, `${mode}: --nav-item-fg-active must be the accent (${accent})`).toBe(
          accent,
        );

        const activePaint = await readRowPaint(active);
        expect(
          activePaint.background,
          `${mode}: active row must paint --nav-item-bg-active (${activeToken})`,
        ).toBe(activeToken);
        expect(
          activePaint.color,
          `${mode}: active row text must use --nav-item-fg-active (${fgActiveToken})`,
        ).toBe(fgActiveToken);

        const activeRules = await findConsumingRules(
          active,
          'aria-current',
          '--nav-item-bg-active',
        );
        expect(
          activeRules,
          `${mode}: a same-origin ::before rule for the active row must paint var(--nav-item-bg-active)`,
        ).not.toEqual([]);

        await adjacent.hover();
        await settle(page);
        const hoverPaint = await readRowPaint(adjacent);
        const hoverRules = await findConsumingRules(adjacent, ':hover', '--nav-item-bg-hover');
        await restPointer(page);
        expect(
          hoverRules,
          `${mode}: a same-origin ::before :hover rule for the row must paint var(--nav-item-bg-hover)`,
        ).not.toEqual([]);
        expect(
          hoverPaint.background,
          `${mode}: hovered row must paint --nav-item-bg-hover (${hoverToken})`,
        ).toBe(hoverToken);
        expect(
          hoverPaint.background,
          `${mode}: hovered neighbour and active row must not share a background`,
        ).not.toBe(activePaint.background);
      });
    }
  });
});
