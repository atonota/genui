import { expect, test, type Locator, type Page } from '@playwright/test';

const FAB_ROUTE = '/components/fab/';
const FAB_SIZES = [48, 56, 64];
const DEFAULT_FAB_SIZE = 56;
// Visible mockup and scheme labels from the PreviewWorkbench options (exact spacing).
const SURFACES = ['iPhone 18', 'iPad mini', 'MacBook 13', 'TV'];
const SCHEMES = ['Light', 'Dark'];
const FAB_CASES = [
  'foundations',
  'geometry',
  'appearance',
  'content',
  'interaction',
  'positioning',
  'motion',
  'backdrop',
  'scroll',
  'actions',
  'adaptive',
  'playground',
];
const LONG_LABELS = [
  'Create a new customer onboarding checklist',
  'Export quarterly financial records for review',
  'Schedule the regional planning meeting',
  'Share the project status summary with stakeholders',
  'Archive completed support conversations',
  'Review pending contract changes before signing',
];
const TV_PROFILE_LABEL = 'TV profile';
const SHAPE_COUNT = 6;
const APPEARANCE_COUNT = 10;
const MIN_TEXT = 14;
const MIN_TARGET = 48;
// CI run 39015675304 traced the three long Chromium journeys passing every functional check until the cumulative 90 s
// cap near their end, with no failed predicate. Each case gets 120 s of aggregate allowance; zero retries and the
// action, expect and navigation timeouts stay unchanged.
const FAB_CASE_TIMEOUT = 120_000;

const fabCase = (page: Page, name: string) => page.locator(`[data-fab-case=${name}]`);
// The .genux-fab-trigger wrapper is a DIV; the native control is the button inside it.
const triggerOf = (scope: Locator) => scope.locator('.genux-fab .genux-fab-trigger button').first();
// The server-rendered page is inert until React hydrates the demo; InlinePreview's own effect marks its preview
// document hydrated, so no action or input lands on server markup that hydration would reset.
const expectHydrated = (page: Page) =>
  expect(fabCase(page, 'foundations').locator('[data-preview-document]').first()).toHaveAttribute(
    'data-preview-hydrated',
    'true',
  );

/** Collects uncaught application errors; failed network requests are not page errors. */
function capturePageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

/** Clicks the visible segmented label, never the hidden radio input. */
async function chooseRadio(scope: Locator, name: string) {
  const radio = scope.getByRole('radio', { name, exact: true }).first();
  await scope
    .locator('label')
    .filter({ has: scope.page().getByRole('radio', { name, exact: true }) })
    .first()
    .click();
  await expect(radio).toBeChecked();
}

async function openMenu(trigger: Locator) {
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
}

const focusedActionId = (page: Page) =>
  page.evaluate(
    () =>
      document.activeElement?.closest('[data-fab-action-id]')?.getAttribute('data-fab-action-id') ??
      null,
  );

const enabledActionIds = (fab: Locator) =>
  fab.locator('.genux-fab-action').evaluateAll(nodes =>
    nodes
      .filter(node => {
        const item = node.querySelector('[role=menuitem]');
        return item !== null && !item.matches(':disabled, [aria-disabled=true]');
      })
      .map(node => node.getAttribute('data-fab-action-id')),
  );

/** Smallest computed font size of visible text; unaffected by the mockup scale transform. */
const minFontSize = (scope: Locator) =>
  scope.evaluate(root => {
    let min = Number.POSITIVE_INFINITY;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || !node.textContent?.trim() || element.getClientRects().length === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden') continue;
      min = Math.min(min, Number.parseFloat(style.fontSize));
    }
    return min;
  });

// offsetWidth and offsetHeight ignore the mockup scale transform.
const targetSize = (control: Locator) =>
  control.evaluate(element =>
    Math.min((element as HTMLElement).offsetWidth, (element as HTMLElement).offsetHeight),
  );

const stageSize = (fab: Locator) =>
  fab.evaluate(element => {
    const stage =
      ((element as HTMLElement).offsetParent as HTMLElement | null) ?? element.parentElement;
    return { width: stage?.clientWidth ?? 0, height: stage?.clientHeight ?? 0 };
  });

async function expectBoundedOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
  // Wide tables scroll inside their own container instead of widening the page.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll('table')).filter(
            table =>
              (table.parentElement?.getBoundingClientRect().right ?? 0) >
              document.documentElement.clientWidth + 0.5,
          ).length,
      ),
    )
    .toBe(0);
}

const openDropdown = (page: Page) =>
  page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();

/** Reads every option of a branded Select, scrolling its virtual list. */
async function selectOptionLabels(page: Page, combobox: Locator): Promise<string[]> {
  await combobox.click();
  const dropdown = openDropdown(page);
  await expect(dropdown).toBeVisible();
  return dropdown.evaluate(async element => {
    const seen = new Set<string>();
    // @rc-component/select prefixes its virtual list `${prefixCls}-dropdown-list`;
    // .rc-virtual-list-holder is the legacy holder class.
    const holder =
      element.querySelector<HTMLElement>(
        '.ant-select-dropdown-list-holder, .rc-virtual-list-holder',
      ) ?? (element as HTMLElement);
    for (let step = 0; step < 8; step += 1) {
      element
        .querySelectorAll('.ant-select-item-option')
        .forEach(option => seen.add(option.textContent?.trim() ?? ''));
      holder.scrollTop += holder.clientHeight;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    holder.scrollTop = 0;
    await new Promise(resolve => requestAnimationFrame(resolve));
    return [...seen].filter(Boolean);
  });
}

/**
 * Clicks an option with the real pointer inside the popup this combobox names through aria-controls or aria-owns,
 * never another Select's outgoing popup. The click waits until the option and its popup hold the same box across
 * consecutive animation frames, and the combobox must then report the committed close.
 */
async function chooseOption(page: Page, combobox: Locator, label: string) {
  if ((await combobox.getAttribute('aria-expanded')) !== 'true') await combobox.click();
  await expect(combobox).toHaveAttribute('aria-expanded', 'true');
  const list =
    (await combobox.getAttribute('aria-controls')) ?? (await combobox.getAttribute('aria-owns'));
  expect(list, `the combobox choosing ${label} names its own popup list`).toBeTruthy();
  const dropdown = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .filter({ has: page.locator(`[id=${JSON.stringify(list ?? '')}]`) });
  await expect(dropdown, 'exactly one open popup owns this combobox list').toHaveCount(1);
  await expect(dropdown).toBeVisible();
  const option = dropdown
    .locator('.ant-select-item-option')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first();
  await expect(option).toBeVisible();
  // One evaluation compares two consecutive frames, so a popup that keeps moving keeps failing the poll.
  await expect
    .poll(() =>
      option.evaluate(
        element =>
          new Promise<boolean>(resolve => {
            const popup = element.closest('.ant-select-dropdown') ?? element;
            const read = () =>
              [element, popup]
                .map(node => {
                  const box = node.getBoundingClientRect();
                  return [box.left, box.top, box.width, box.height].join(' ');
                })
                .join('|');
            requestAnimationFrame(() => {
              const first = read();
              requestAnimationFrame(() => resolve(read() === first));
            });
          }),
      ),
    )
    .toBe(true);
  await option.click();
  await expect(combobox).not.toHaveAttribute('aria-expanded', 'true');
}

/**
 * Evidence photo, never a pixel assertion: once the target and its own preview screen keep the same box across two
 * consecutive animation frames, only the part of the target inside the viewport is captured, so a tall preview group
 * never waits on the locator screenshot's auto-scroll stability check.
 */
async function captureVisible(page: Page, target: Locator, path: string) {
  await target.evaluate(element =>
    element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' }),
  );
  await expect
    .poll(() =>
      target.evaluate(
        element =>
          new Promise<boolean>(resolve => {
            const screen = element.querySelector('[data-preview-document]') ?? element;
            const read = () =>
              [element, screen]
                .map(node => {
                  const box = node.getBoundingClientRect();
                  return [box.left, box.top, box.width, box.height].join(' ');
                })
                .join('|');
            requestAnimationFrame(() => {
              const first = read();
              requestAnimationFrame(() => resolve(read() === first));
            });
          }),
      ),
    )
    .toBe(true);
  const box = await target.boundingBox();
  const viewport = page.viewportSize();
  expect(box, 'the evidence target has a box').not.toBeNull();
  expect(viewport, 'the page has a viewport').not.toBeNull();
  const left = Math.max(box?.x ?? 0, 0);
  const top = Math.max(box?.y ?? 0, 0);
  const right = Math.min((box?.x ?? 0) + (box?.width ?? 0), viewport?.width ?? 0);
  const bottom = Math.min((box?.y ?? 0) + (box?.height ?? 0), viewport?.height ?? 0);
  expect(right > left && bottom > top, 'the evidence target is inside the viewport').toBe(true);
  await page.screenshot({
    path,
    clip: { x: left, y: top, width: right - left, height: bottom - top },
  });
}

const circular = (control: Locator) =>
  control.evaluate(element => {
    const radius = getComputedStyle(element).borderTopLeftRadius;
    return radius.endsWith('%')
      ? Number.parseFloat(radius) >= 50
      : Number.parseFloat(radius) >= (element as HTMLElement).offsetHeight / 2 - 0.5;
  });

/**
 * Visible paint of a native master button: its own box, the ::before face GenUXButton paints
 * and, when present, the .genux-button-lip layer with its edge pseudo-elements.
 */
const paint = (control: Locator) =>
  control.evaluate(element => {
    const lip = element.querySelector('.genux-button-lip');
    const boxes: Array<[Element, string | null]> = [
      [element, null],
      [element, '::before'],
    ];
    if (lip) boxes.push([lip, null], [lip, '::before'], [lip, '::after']);
    return boxes
      .map(([box, pseudo]) => {
        const style = getComputedStyle(box, pseudo);
        return [
          style.content,
          style.display,
          style.backgroundColor,
          style.backgroundImage,
          style.borderTopColor,
          style.borderTopWidth,
          style.boxShadow,
        ].join('|');
      })
      .join('||');
  });

/**
 * Focus paint of a menu item: the outline, all-round border and spread ring roles of the native
 * control, its .genux-button-content child and their pseudo-elements, plus the shared slotted
 * marker box components.css paints on .genux-button-content::after.
 */
const focusMarker = (control: Locator) =>
  control.evaluate(element => {
    const host = element as HTMLElement;
    const content = host.querySelector('.genux-button-content');
    const boxes: Array<[Element, string | null]> = [
      [host, null],
      [host, '::before'],
      [host, '::after'],
    ];
    if (content) boxes.push([content, null], [content, '::before'], [content, '::after']);
    const rings = boxes.map(([box, pseudo]) => {
      const style = getComputedStyle(box, pseudo);
      const outline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
      const border = ['top', 'right', 'bottom', 'left'].every(
        side => Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0,
      );
      const spread = style.boxShadow
        .replace(/rgba?[(][^)]*[)]/g, '')
        .split(',')
        .some(shadow => {
          const [x = 0, y = 0, , size = 0] = shadow
            .trim()
            .split(' ')
            .filter(part => part.endsWith('px'))
            .map(Number.parseFloat);
          return x === 0 && y === 0 && size > 0;
        });
      return [outline, border, spread].join('|');
    });
    // Computed width and height ignore the mockup scale transform, like offsetWidth.
    const marker = content ? getComputedStyle(content, '::after') : null;
    const width = marker ? Number.parseFloat(marker.width) || 0 : 0;
    const height = marker ? Number.parseFloat(marker.height) || 0 : 0;
    const fill = marker?.backgroundColor ?? 'transparent';
    const clear =
      fill === 'transparent' || /^rgba[(].*,[ ]*0[)]$/.test(fill) || /[/][ ]*0[)]$/.test(fill);
    return {
      rings,
      outlined: rings.some(ring => ring.startsWith('true|')),
      marker: {
        visible:
          marker !== null &&
          !['none', 'normal'].includes(marker.content) &&
          marker.display !== 'none' &&
          marker.visibility === 'visible' &&
          Number.parseFloat(marker.opacity) > 0 &&
          width > 0 &&
          height > 0 &&
          !clear,
        // One edge bar; a box covering half the control on both axes would surround it.
        enclosing: width >= host.offsetWidth / 2 && height >= host.offsetHeight / 2,
        paint: [marker?.content, fill, marker?.opacity, width, height].join('|'),
      },
    };
  });

test('FAB documentation and defaults are available', async ({ page }, testInfo) => {
  test.setTimeout(FAB_CASE_TIMEOUT);
  const errors = capturePageErrors(page);
  const response = await page.goto(FAB_ROUTE);
  expect(response, 'FAB route must respond').not.toBeNull();
  expect(response?.status()).toBe(200);
  await expectHydrated(page);

  await expect(page.getByRole('heading', { name: 'FAB', exact: true }).first()).toBeVisible();

  // Examples is the default documentation view (tab or route link).
  await expect(
    page
      .locator('[role="tab"][aria-selected="true"], [aria-current="page"]')
      .filter({ hasText: /^\s*Examples\s*$/ })
      .first(),
  ).toBeVisible();

  // Previews render inline in device mockups; iframes are forbidden.
  await expect(page.locator('iframe')).toHaveCount(0);

  const preview = page.locator('[data-fab-case="foundations"]').first();
  await expect(preview).toBeVisible();

  const fabs = preview.locator('.genux-fab');
  expect(await fabs.count()).toBeGreaterThanOrEqual(1);

  // Preview-local device and color scheme controls.
  for (const name of [...SURFACES, ...SCHEMES]) {
    await expect(preview.getByRole('radio', { name, exact: true })).toBeAttached();
  }

  const fab = fabs.first();
  // The .genux-fab-trigger wrapper is a DIV; the native control is the button inside it.
  const trigger = fab.locator('.genux-fab-trigger button').first();
  await expect(trigger).toBeVisible();
  expect(await trigger.evaluate(element => element.tagName)).toBe('BUTTON');
  await expect(trigger).toHaveAccessibleName(/\S/);

  // offsetHeight ignores the mockup scale transform.
  await expect(fab).toHaveAttribute('data-fab-size', 'md');
  const height = await trigger.evaluate(element => (element as HTMLElement).offsetHeight);
  expect(FAB_SIZES).toContain(height);
  expect(height).toBe(DEFAULT_FAB_SIZE);

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  // Open glyph: once motion settles, the decorative overlay paints a real SVG above the native
  // control instead of being buried under the expanded trigger's own stacking role.
  await expect(fab).toHaveAttribute('data-fab-state', 'open');
  await expect
    .poll(async () => {
      const phase = await fab.getAttribute('data-fab-phase');
      return phase === null || phase === 'open';
    })
    .toBe(true);
  const triggerHost = fab.locator('.genux-fab-trigger').first();
  const overlay = triggerHost.locator(':scope > .genux-fab-trigger-icon-overlay');
  await expect(overlay).toHaveCount(1);
  // A computed auto z-index stacks like 0.
  const zIndex = (value: string) => (value === 'auto' ? 0 : Number.parseInt(value, 10));
  const native = await trigger.evaluate(element => {
    const box = element.getBoundingClientRect();
    return {
      box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
      z: getComputedStyle(element).zIndex,
    };
  });
  const glyph = await overlay.evaluate(element => {
    const shapes = 'path, circle, ellipse, line, polyline, polygon, rect, use';
    // Effective paint: no layer from the SVG up to the overlay is undisplayed or transparent.
    const painted = (node: Element) => {
      for (let layer: Element | null = node; layer; layer = layer.parentElement) {
        const style = getComputedStyle(layer);
        if (style.display === 'none' || Number.parseFloat(style.opacity) === 0) return false;
        if (layer === element) break;
      }
      return getComputedStyle(node).visibility === 'visible';
    };
    const svg = Array.from(element.querySelectorAll('svg')).find(node => {
      const box = node.getBoundingClientRect();
      return (
        box.width > 0 && box.height > 0 && node.querySelector(shapes) !== null && painted(node)
      );
    });
    const own = element.getBoundingClientRect();
    const icon = svg?.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      pointerEvents: style.pointerEvents,
      z: style.zIndex,
      overlay: { left: own.left, top: own.top, right: own.right, bottom: own.bottom },
      icon: icon
        ? { left: icon.left, top: icon.top, right: icon.right, bottom: icon.bottom }
        : null,
    };
  });
  expect(glyph.pointerEvents).toBe('none');
  expect(glyph.icon, 'the open trigger paints a visible, non-empty SVG glyph').not.toBeNull();
  type Box = { left: number; top: number; right: number; bottom: number };
  const inside = (inner: Box, outer: Box) =>
    inner.left >= outer.left - 1 &&
    inner.top >= outer.top - 1 &&
    inner.right <= outer.right + 1 &&
    inner.bottom <= outer.bottom + 1;
  if (glyph.icon) {
    // The glyph sits in the measured icon slot: centred in the overlay, inside the native control.
    const x = (glyph.icon.left + glyph.icon.right) / 2;
    const y = (glyph.icon.top + glyph.icon.bottom) / 2;
    expect(inside({ left: x, top: y, right: x, bottom: y }, glyph.overlay)).toBe(true);
    expect(inside(glyph.icon, native.box)).toBe(true);
  }
  expect(inside(glyph.overlay, native.box)).toBe(true);
  // The decorative overlay stacks at or above the expanded native button.
  expect(zIndex(glyph.z)).toBeGreaterThanOrEqual(zIndex(native.z));
  await triggerHost.screenshot({ path: testInfo.outputPath('fab-trigger-open.png') });

  // The .genux-fab-action wrapper is a DIV; the native menu item is the control inside it.
  const firstAction = fab.locator('.genux-fab-actions .genux-fab-action [role=menuitem]').first();
  await expect(firstAction).toBeVisible();
  expect(['BUTTON', 'A']).toContain(await firstAction.evaluate(element => element.tagName));
  await expect(firstAction).toBeEnabled();
  await expect(firstAction).not.toHaveAccessibleName('');

  // Closing retains the real action markup: semantics close at once while the exit finishes.
  const actions = fab.locator('.genux-fab-actions');
  const firstActionHandle = await firstAction.elementHandle();
  expect(firstActionHandle).not.toBeNull();
  const closure = () =>
    fab.evaluate((root, node) => {
      const item = node as Element | null;
      const panel = root.querySelector('.genux-fab-actions');
      const style = panel ? getComputedStyle(panel) : null;
      return {
        phase: root.getAttribute('data-fab-phase'),
        connected: item !== null && item.isConnected && panel !== null && panel.contains(item),
        visibility: style?.visibility ?? null,
        pointerEvents: style?.pointerEvents ?? null,
        itemPointerEvents: item ? getComputedStyle(item).pointerEvents : null,
      };
    }, firstActionHandle);

  // The closing phase lasts one motion duration, often less than the cross-process checks after Escape take. A page-side
  // recorder installed before the real Escape samples the same item on every phase mutation and animation frame and
  // keeps the first closing state, so the assertion below judges the real closing frame instead of racing it.
  const closingProbe = '__genuxFabClosingProbe';
  await fab.evaluate(
    (root, { node, key }) => {
      const item = node as Element | null;
      const read = () => {
        const panel = root.querySelector('.genux-fab-actions');
        const style = panel ? getComputedStyle(panel) : null;
        return {
          phase: root.getAttribute('data-fab-phase'),
          connected: item !== null && item.isConnected && panel !== null && panel.contains(item),
          visibility: style?.visibility ?? null,
          pointerEvents: style?.pointerEvents ?? null,
          itemPointerEvents: item ? getComputedStyle(item).pointerEvents : null,
        };
      };
      const probe = {
        phases: [] as (string | null)[],
        closing: null as ReturnType<typeof read> | null,
      };
      let stopped = false;
      let frame = 0;
      let observer: MutationObserver | null = null;
      const sample = () => {
        if (stopped) return;
        const state = read();
        if (probe.phases[probe.phases.length - 1] !== state.phase) probe.phases.push(state.phase);
        if (state.phase === 'closing' && probe.closing === null) probe.closing = state;
        // A missed closing phase stops at closed with no closing sample, so the assertion below fails.
        if (state.phase === 'closing' || state.phase === 'closed') {
          stopped = true;
          observer?.disconnect();
          cancelAnimationFrame(frame);
        }
      };
      observer = new MutationObserver(sample);
      observer.observe(root, { attributes: true, attributeFilter: ['data-fab-phase'] });
      const tick = () => {
        sample();
        if (!stopped) frame = requestAnimationFrame(tick);
      };
      (window as unknown as Record<string, unknown>)[key] = probe;
      tick();
    },
    { node: firstActionHandle, key: closingProbe },
  );
  const closingFrame = () =>
    page.evaluate(key => {
      const probe = (
        window as unknown as Record<string, { closing: unknown; phases: unknown[] } | undefined>
      )[key];
      return probe?.closing ?? { missed: probe?.phases ?? null };
    }, closingProbe);

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  // A closed menu is inert, so its items are unreachable.
  await expect(actions).toHaveAttribute('inert', '');
  await expect(actions).toHaveAttribute('aria-hidden', 'true');
  // Closing phase: the same item stays mounted and visible but takes no pointer input.
  await expect.poll(closingFrame).toEqual({
    phase: 'closing',
    connected: true,
    visibility: 'visible',
    pointerEvents: 'none',
    itemPointerEvents: 'none',
  });
  await page.evaluate(key => {
    delete (window as unknown as Record<string, unknown>)[key];
  }, closingProbe);
  // Closed phase: the same item is still retained, now hidden.
  await expect
    .poll(async () => {
      const { phase, connected, visibility } = await closure();
      return { phase, connected, visibility };
    })
    .toEqual({ phase: 'closed', connected: true, visibility: 'hidden' });

  // Geometry starts on a known wide host before its own phone and wide recovery journey.
  await page.setViewportSize({ width: 1920, height: 1080 });
  // Geometry: Multi directional chosen through this preview's own toolbar Tweaker fans each named group out its own way.
  const geometryCase = fabCase(page, 'geometry');
  const geometryFab = geometryCase.locator('.genux-fab').first();
  const geometryTrigger = triggerOf(geometryCase);
  const geometryOpener = geometryCase.getByRole('button', { name: 'Open tweaker', exact: true });
  const geometryCloseTweaker = page.getByRole('button', { name: 'Close tweaker', exact: true });
  // Only the two layouts this journey requests; each lies along the real list order from the other.
  const layoutKeys = { 'Multi directional': 'ArrowDown', Linear: 'ArrowUp' } as const;
  // At most one press per approved layout option.
  const layoutKeyLimit = 12;
  const setGeometryLayout = async (label: keyof typeof layoutKeys) => {
    if (await geometryCloseTweaker.isVisible()) {
      await geometryCloseTweaker.click();
      await expect(geometryCloseTweaker).toBeHidden();
    }
    await geometryTrigger.focus();
    await geometryOpener.click();
    // The toolbar button carries no expanded state; the visible Tweaker drawer is the evidence.
    await expect(geometryCloseTweaker).toBeVisible();
    const layout = page.getByRole('combobox', { name: 'Layout', exact: true });
    await expect(layout).toBeVisible();
    await layout.click();
    const dropdown = openDropdown(page);
    await expect(dropdown).toBeVisible();
    // The virtual list renders a window of options; the real combobox keyboard moves the active option
    // until the wanted one renders inside the open panel. Arrows never commit; only the click below does.
    const wanted = dropdown
      .locator('.ant-select-item-option')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .first();
    const wantedShown = async () => {
      if ((await wanted.count()) === 0 || !(await wanted.isVisible())) return false;
      const [box, panel] = await Promise.all([wanted.boundingBox(), dropdown.boundingBox()]);
      return (
        box !== null &&
        panel !== null &&
        box.y >= panel.y - 1 &&
        box.y + box.height <= panel.y + panel.height + 1
      );
    };
    let shown = await wantedShown();
    for (let press = 0; press < layoutKeyLimit && !shown; press += 1) {
      const active = await layout.getAttribute('aria-activedescendant');
      await layout.press(layoutKeys[label]);
      // The popup stays open and, when exposed, the active option really moved before the next look.
      await expect(dropdown).toBeVisible();
      await expect(layout).toHaveAttribute('aria-expanded', 'true');
      if (active !== null)
        await expect(layout).not.toHaveAttribute('aria-activedescendant', active);
      shown = await wantedShown();
    }
    expect(shown, `${label} renders inside the open Layout list`).toBe(true);
    await chooseOption(page, layout, label);
    await expect(page.locator('.ant-select').filter({ has: layout }).first()).toContainText(label);
    await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')).toHaveCount(
      0,
    );
    // The Tweaker closes first so its drawer never covers the preview.
    await geometryCloseTweaker.click();
    await expect(geometryCloseTweaker).toBeHidden();
  };
  await chooseRadio(geometryCase, 'MacBook 13');
  await setGeometryLayout('Multi directional');
  await geometryCase.scrollIntoViewIfNeeded();
  await openMenu(geometryTrigger);
  await expect(geometryFab).toHaveAttribute('data-fab-state', 'open');
  // The Stage keeps the selected layout instead of forcing a circle.
  await expect(geometryFab).toHaveAttribute('data-fab-layout', 'multi-directional');
  await expect(geometryFab.locator('.genux-fab-action')).toHaveCount(6);
  for (const name of ['Up', 'Start', 'End']) {
    // Group wrappers may have no height of their own: they are attached and named, their headings carry the paint.
    const group = geometryFab.getByRole('group', { name, exact: true });
    await expect(group).toBeAttached();
    await expect(group).toHaveAccessibleName(name);
    await expect(
      geometryFab.locator('.genux-fab-group-name').filter({ hasText: new RegExp(`^${name}$`) }),
    ).toBeVisible();
  }
  // Real direction in LTR: native control centres sit above, left of and right of the trigger box.
  const fanOut = () =>
    geometryFab.evaluate(root => {
      const trigger = root.querySelector('.genux-fab-trigger button')?.getBoundingClientRect();
      const centres = (group: string) =>
        Array.from(root.querySelectorAll(`.genux-fab-action[data-fab-group=${group}]`)).flatMap(
          node => {
            const box = node
              .querySelector(':is(button, a)[role=menuitem]')
              ?.getBoundingClientRect();
            return box ? [{ x: box.left + box.width / 2, y: box.top + box.height / 2 }] : [];
          },
        );
      const up = centres('up');
      const start = centres('start');
      const end = centres('end');
      return trigger
        ? {
            up: up.length === 2 && up.every(centre => centre.y < trigger.top),
            start: start.length === 2 && start.every(centre => centre.x < trigger.left),
            end: end.length === 2 && end.every(centre => centre.x > trigger.right),
          }
        : null;
    });
  await expect.poll(fanOut).toEqual({ up: true, start: true, end: true });
  // Reserved geometry: each short-labelled native control reports a finite, positive --fab-control-width/height
  // on its own .genux-fab-action matching its real box within 1 CSS px, so the animated reserve never outgrows
  // the hit target. offsetWidth and offsetHeight ignore the mockup scale transform.
  const controlFit = () =>
    geometryFab.evaluate(root =>
      Array.from(root.querySelectorAll<HTMLElement>('.genux-fab-action')).map(node => {
        const control = node.querySelector<HTMLElement>(':is(button, a)[role=menuitem]');
        const style = getComputedStyle(node);
        return {
          id: node.getAttribute('data-fab-action-id'),
          width: Number.parseFloat(style.getPropertyValue('--fab-control-width')),
          height: Number.parseFloat(style.getPropertyValue('--fab-control-height')),
          offsetWidth: control?.offsetWidth ?? 0,
          offsetHeight: control?.offsetHeight ?? 0,
        };
      }),
    );
  // One DOM read per poll; misfits carry their reported and real sizes for the failure message.
  const controlMisfits = async () => {
    const fits = await controlFit();
    return {
      count: fits.length,
      misfits: fits.filter(
        fit =>
          !(
            Number.isFinite(fit.width) &&
            Number.isFinite(fit.height) &&
            fit.width > 0 &&
            fit.height > 0 &&
            Math.abs(fit.width - fit.offsetWidth) <= 1 &&
            Math.abs(fit.height - fit.offsetHeight) <= 1 &&
            Math.min(fit.offsetWidth, fit.offsetHeight) >= MIN_TARGET
          ),
      ),
    };
  };
  await expect.poll(controlMisfits).toEqual({ count: 6, misfits: [] });
  // Reserved outside labels: every dial host showing its .genux-fab-label (here the Up, Start and End group headings)
  // carries finite, positive --fab-label-width/height holding the label's whole rendered box, and that box sits inside
  // the reserved --fab-action-width/height union. The trigger host reserves the native trigger height within 1 CSS px.
  // Offset and scroll sizes ignore the mockup scale transform.
  const reserveMisfits = () =>
    geometryFab.evaluate(root => {
      const read = (style: CSSStyleDeclaration, name: string) =>
        Number.parseFloat(style.getPropertyValue(name));
      const labels = Array.from(
        root.querySelectorAll<HTMLElement>(
          '.genux-fab-action[data-fab-mode=dial] > .genux-fab-label',
        ),
      ).filter(label => label.getClientRects().length > 0);
      const misfits = labels.flatMap(label => {
        const host = label.parentElement as HTMLElement;
        const style = getComputedStyle(host);
        const width = Math.max(label.offsetWidth, label.scrollWidth);
        const height = Math.max(label.offsetHeight, label.scrollHeight);
        const reserved = {
          width: read(style, '--fab-label-width'),
          height: read(style, '--fab-label-height'),
        };
        const union = {
          width: read(style, '--fab-action-width'),
          height: read(style, '--fab-action-height'),
        };
        const fits =
          host.hasAttribute('data-fab-label-geometry') &&
          [reserved.width, reserved.height, union.width, union.height].every(
            value => Number.isFinite(value) && value > 0,
          ) &&
          reserved.width >= width - 1 &&
          reserved.height >= height - 1 &&
          label.offsetLeft >= -1 &&
          label.offsetTop >= -1 &&
          label.offsetLeft + width <= union.width + 1 &&
          label.offsetTop + height <= union.height + 1;
        return fits
          ? []
          : [
              {
                id: host.getAttribute('data-fab-action-id'),
                width,
                height,
                left: label.offsetLeft,
                top: label.offsetTop,
                reserved,
                union,
              },
            ];
      });
      const control = root.querySelector<HTMLElement>('.genux-fab-trigger button');
      const reservedTrigger = read(getComputedStyle(root), '--fab-trigger-height');
      return {
        labels: labels.length,
        misfits,
        trigger:
          control !== null &&
          Number.isFinite(reservedTrigger) &&
          Math.abs(control.offsetHeight - reservedTrigger) <= 1,
      };
    });
  await expect.poll(reserveMisfits).toEqual({ labels: 3, misfits: [], trigger: true });
  const openFits = await controlFit();
  await page.keyboard.press('Escape');
  await expect(geometryTrigger).toHaveAttribute('aria-expanded', 'false');
  // The exit never inflates the reserve: once closed, no reported size grows past its open control.
  await expect
    .poll(async () => {
      const phase = await geometryFab.getAttribute('data-fab-phase');
      return phase === null || phase === 'closed';
    })
    .toBe(true);
  const closedFits = await controlFit();
  expect(
    closedFits.filter(fit => {
      const open = openFits.find(entry => entry.id === fit.id);
      return (
        open === undefined ||
        (Number.isFinite(fit.width) && fit.width > open.width + 1) ||
        (Number.isFinite(fit.height) && fit.height > open.height + 1)
      );
    }),
  ).toEqual([]);

  // Recovery: a narrow phone may fall back from the requested fan, but returning to the MacBook restores
  // Multi directional on the same mounted FAB with the same six actions; a fallback measured once never sticks.
  const geometryRoot = await geometryFab.elementHandle();
  const geometryIds = () =>
    geometryFab
      .locator('.genux-fab-action')
      .evaluateAll(nodes =>
        nodes.map(node => node.getAttribute('data-fab-action-id') ?? '').sort(),
      );
  const stableIds = await geometryIds();
  expect(stableIds).toHaveLength(6);
  expect(new Set(stableIds).size).toBe(6);
  const expectSameGeometryMount = async () => {
    expect(await geometryRoot?.evaluate(node => node.isConnected)).toBe(true);
    await expect(geometryFab.locator('.genux-fab-action')).toHaveCount(6);
    expect(await geometryIds()).toEqual(stableIds);
  };
  // Motion has settled: the root reports the open state and no mid-stagger phase.
  const openGeometrySettled = async () => {
    await geometryCase.scrollIntoViewIfNeeded();
    await openMenu(geometryTrigger);
    await expect(geometryFab).toHaveAttribute('data-fab-state', 'open');
    await expect
      .poll(async () => {
        const phase = await geometryFab.getAttribute('data-fab-phase');
        return phase === null || phase === 'open';
      })
      .toBe(true);
  };
  const expectNamedGroups = async () => {
    for (const name of ['Up', 'Start', 'End']) {
      const group = geometryFab.getByRole('group', { name, exact: true });
      await expect(group).toBeAttached();
      await expect(group).toHaveAccessibleName(name);
      await expect(
        geometryFab.locator('.genux-fab-group-name').filter({ hasText: new RegExp(`^${name}$`) }),
      ).toBeVisible();
    }
  };
  // Every native control sits inside the visible box of this preview's own mockup screen.
  const onScreen = () =>
    geometryFab.evaluate(root => {
      const screen = root.closest('[data-preview-document]')?.getBoundingClientRect();
      const boxes = Array.from(
        root.querySelectorAll('.genux-fab-action :is(button, a)[role=menuitem]'),
      ).map(node => node.getBoundingClientRect());
      return (
        screen !== undefined &&
        boxes.length === 6 &&
        boxes.every(
          box =>
            box.left >= screen.left - 1 &&
            box.top >= screen.top - 1 &&
            box.right <= screen.right + 1 &&
            box.bottom <= screen.bottom + 1,
        )
      );
    });

  // Narrow portrait phone host: the real iPhone mockup button.
  await page.setViewportSize({ width: 320, height: 800 });
  await expectBoundedOverflow(page);
  await chooseRadio(geometryCase, 'iPhone 18');
  await expectSameGeometryMount();
  await openGeometrySettled();
  await expect
    .poll(() => geometryFab.getAttribute('data-fab-layout'))
    .toMatch(/^(multi-directional|menu|sheet)$/);
  const phoneLayout = await geometryFab.getAttribute('data-fab-layout');
  if (phoneLayout === 'multi-directional') {
    // The natural footprints fit the phone screen, so the fan must be real rather than clipped.
    await expect.poll(fanOut).toEqual({ up: true, start: true, end: true });
    await expect.poll(onScreen).toBe(true);
  } else {
    // Otherwise the six actions fall back to a menu or a bounded sheet.
    await expect(geometryFab.locator('.genux-fab-actions')).toHaveAttribute(
      'data-fab-mode',
      /^(menu|sheet)$/,
    );
  }
  await page.keyboard.press('Escape');
  await expect(geometryTrigger).toHaveAttribute('aria-expanded', 'false');
  await expectSameGeometryMount();

  // Back on the wide host's MacBook, the requested Multi directional layout recovers with its named groups.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expectBoundedOverflow(page);
  await chooseRadio(geometryCase, 'MacBook 13');
  await expectSameGeometryMount();
  await openGeometrySettled();
  await expect(geometryFab).toHaveAttribute('data-fab-layout', 'multi-directional');
  await expectNamedGroups();
  await expect.poll(fanOut).toEqual({ up: true, start: true, end: true });
  await expectSameGeometryMount();
  // The recovered fan reserves exactly the real native control boxes again.
  await expect.poll(controlMisfits).toEqual({ count: 6, misfits: [] });
  // The recovered fan reserves its group headings and the native trigger height again.
  await expect.poll(reserveMisfits).toEqual({ labels: 3, misfits: [], trigger: true });
  await geometryCase.screenshot({ path: testInfo.outputPath('fab-geometry-multi-1920.png') });
  await page.keyboard.press('Escape');
  await expect(geometryTrigger).toHaveAttribute('aria-expanded', 'false');
  // Restore the Linear baseline through the same Tweaker so the Scroll checks below keep their layout.
  await setGeometryLayout('Linear');

  // closeOnScroll set in the Tweaker decides what scrolling the Scroll case region does; it never runs an action.
  const scrollCase = fabCase(page, 'scroll');
  const scrollTrigger = triggerOf(scrollCase);
  const scrollOpener = scrollCase.getByRole('button', { name: 'Open tweaker', exact: true });
  const scrollCloseTweaker = page.getByRole('button', { name: 'Close tweaker', exact: true });
  const region = scrollCase.getByRole('region', { name: 'Scrollable records', exact: true });
  const counter = page.locator('.genux-fab-demo-status');
  const counted = (await counter.textContent()) ?? '';
  const setCloseOnScroll = async (value: boolean) => {
    if (!(await scrollCloseTweaker.isVisible())) await scrollOpener.click();
    await expect(scrollCloseTweaker).toBeVisible();
    const flag = page.getByRole('switch', { name: 'Close on scroll', exact: true });
    await expect(flag).toBeVisible();
    if ((await flag.getAttribute('aria-checked')) !== String(value)) await flag.click();
    await expect(flag).toHaveAttribute('aria-checked', String(value));
    // The Tweaker closes first so its drawer never covers the case controls.
    await scrollCloseTweaker.click();
    await expect(scrollCloseTweaker).toBeHidden();
  };
  const scrollRegion = (to: 'end' | 'middle' | 'start') =>
    region.evaluate(async (element, position) => {
      const max = element.scrollHeight - element.clientHeight;
      element.scrollTop =
        position === 'end' ? max : position === 'middle' ? Math.floor(max / 2) : 0;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, to);
  const openThenScroll = async () => {
    await scrollCase.scrollIntoViewIfNeeded();
    expect(await region.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
    // Down while closed, then partly back up so a hide-on-scroll-down FAB is shown again.
    await scrollRegion('end');
    await scrollRegion('middle');
    await expect(scrollTrigger).toBeVisible();
    await openMenu(scrollTrigger);
    await scrollRegion('start');
  };

  await setCloseOnScroll(false);
  await openThenScroll();
  await expect(scrollTrigger).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(scrollTrigger).toHaveAttribute('aria-expanded', 'false');

  await setCloseOnScroll(true);
  await openThenScroll();
  await expect(scrollTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(counter).toHaveText(counted);

  expect(errors).toEqual([]);
});

test('FAB actions preserve confirmation, async errors and keyboard state', async ({ page }) => {
  test.setTimeout(FAB_CASE_TIMEOUT);
  const errors = capturePageErrors(page);
  await page.goto(FAB_ROUTE);
  await expectHydrated(page);

  const actionsCase = fabCase(page, 'actions');
  const fab = actionsCase.locator('.genux-fab').first();
  const trigger = triggerOf(actionsCase);
  const item = (id: string) => fab.locator(`[data-fab-action-id=${id}] [role=menuitem]`);
  const alert = fab.locator('.genux-fab-status [role=alert]');
  const resolve = actionsCase.getByRole('button', { name: 'Resolve action', exact: true });
  const reject = actionsCase.getByRole('button', { name: 'Reject action', exact: true });
  const root = await fab.elementHandle();
  // The gallery counter counts completed runs only; rejected and cancelled actions never add to it.
  const completed = page.locator('.genux-fab-demo-status');
  const expectCompleted = (count: number) =>
    expect(completed).toContainText(`Completed actions: ${count}.`);
  await expectCompleted(0);

  // Keyboard: Enter opens the menu; Arrow, Home and End rove over the enabled native items.
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const tags = await fab
    .locator('.genux-fab-action [role=menuitem]')
    .evaluateAll(items => items.map(node => node.tagName));
  expect(tags.length).toBeGreaterThanOrEqual(2);
  for (const tag of tags) expect(['BUTTON', 'A']).toContain(tag);
  const enabled = await enabledActionIds(fab);
  expect(enabled[0]).toBe('sync');
  await expect.poll(() => focusedActionId(page)).toBe('sync');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => focusedActionId(page)).toBe(enabled[1]);
  await page.keyboard.press('End');
  await expect.poll(() => focusedActionId(page)).toBe(enabled[enabled.length - 1]);
  await page.keyboard.press('Home');
  await expect.poll(() => focusedActionId(page)).toBe('sync');

  // Enter runs Sync once: it stays pending, other items are disabled meanwhile, and one Reject settles it.
  await page.keyboard.press('Enter');
  await expect(resolve).toBeEnabled();
  await expect(item('save')).toBeDisabled();
  await reject.click();
  await expect(resolve).toBeDisabled();
  await expect(reject).toBeDisabled();
  await expectCompleted(0);
  // Reject sits outside the FAB and may close it under closeOnOutside; the error stays visible regardless.
  await expect(alert).toBeVisible();
  await expect(alert).not.toHaveText('');
  await expect(item('save')).toBeEnabled();

  // Retrying the same action and resolving it clears the error.
  await openMenu(trigger);
  await item('sync').click();
  await expect(resolve).toBeEnabled();
  await resolve.click();
  await expect(resolve).toBeDisabled();
  await expect(alert).toHaveText('');
  await expectCompleted(1);

  // Permission: Publish release appears in place without remounting the FAB.
  await expect(fab.locator('[data-fab-action-id=publish]')).toHaveCount(0);
  await actionsCase.getByRole('button', { name: 'Toggle permission', exact: true }).click();
  await expect(fab.locator('[data-fab-action-id=publish]')).toHaveCount(1);
  expect(await root?.evaluate(node => node.isConnected)).toBe(true);

  // Offline: only actions without offline support are disabled.
  const online = actionsCase.getByRole('switch', { name: 'Online', exact: true });
  await expect(online).toBeChecked();
  await online.click();
  await expect(online).not.toBeChecked();
  await expect(item('upload')).toBeDisabled();
  await expect(item('save')).toBeEnabled();
  await online.click();
  await expect(item('upload')).toBeEnabled();

  // Confirmation: Cancel leaves the action unrun; Confirm settles it once and closes the dialog.
  // The renderer's GenUXOverlay modal belongs to this preview, never to another FAB or the page.
  const dialog = actionsCase.getByRole('dialog', { name: 'Confirm action', exact: true });
  await openMenu(trigger);
  await item('delete').click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Confirm action', exact: true })).toHaveCount(1);
  await expect(dialog).toContainText('Delete this draft?');
  // No callback runs before an explicit confirmation.
  await expectCompleted(1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(fab.locator('[data-fab-action-id=delete]')).toHaveCount(1);
  await expect(alert).toHaveText('');
  await expectCompleted(1);
  // Cancel keeps focus with this FAB instead of dropping it to the page.
  await expect
    .poll(() => fab.evaluate(element => element.contains(document.activeElement)))
    .toBe(true);
  await openMenu(trigger);
  await item('delete').click();
  await expect(dialog).toBeVisible();
  await expectCompleted(1);
  await dialog.getByRole('button', { name: 'Confirm action', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(alert).toHaveText('');
  // Confirm runs the action exactly once.
  await expectCompleted(2);

  // Drag: button alternatives and the keyboard handle both report through the position output.
  const interaction = fabCase(page, 'interaction');
  const position = interaction.locator('output').first();
  const initial = (await position.textContent()) ?? '';
  await interaction.getByRole('button', { name: 'Move left', exact: true }).click();
  await expect(position).not.toHaveText(initial);
  await expect(position).toHaveText(/[0-9]/);
  const moved = (await position.textContent()) ?? '';
  await interaction.getByRole('button', { name: 'Reset position', exact: true }).click();
  await expect(position).not.toHaveText(moved);
  const reset = (await position.textContent()) ?? '';
  await interaction.getByRole('button', { name: 'Move actions', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(position).not.toHaveText(reset);
  await page.keyboard.press('Home');
  await expect(position).toHaveText(reset);

  // Actual drag on the same controlled gallery: every move reports through the visible position output, the native
  // trigger box follows inside its own stage, and no movement opens the menu or runs an action.
  const dragFab = interaction.locator('.genux-fab').first();
  const dragTrigger = triggerOf(interaction);
  const dragHandle = interaction.locator('.genux-fab-drag-handle').first();
  const moveActions = interaction.getByRole('button', { name: 'Move actions', exact: true });
  const dragPoint = async () => {
    const match = /(-?[0-9]+), (-?[0-9]+)/.exec((await position.textContent()) ?? '');
    return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
  };
  // Client box of the native trigger control and whether it stays inside this preview's own stage.
  const dragLayout = () =>
    dragFab.evaluate(root => {
      const stage = root.closest('.genux-fab-demo-stage')?.getBoundingClientRect();
      const box = root.querySelector('.genux-fab-trigger button')?.getBoundingClientRect();
      if (!stage || !box) return null;
      return {
        left: box.left,
        inside:
          box.left >= stage.left - 1 &&
          box.top >= stage.top - 1 &&
          box.right <= stage.right + 1 &&
          box.bottom <= stage.bottom + 1,
      };
    });
  const dragLeft = async () => (await dragLayout())?.left ?? Number.NaN;
  const dragRoot = await dragFab.elementHandle();
  const dragIds = () =>
    dragFab
      .locator('.genux-fab-action')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-fab-action-id')));
  const stableDragIds = await dragIds();
  const expectDragUntouched = async () => {
    expect(await dragRoot?.evaluate(node => node.isConnected)).toBe(true);
    expect(await dragIds()).toEqual(stableDragIds);
    expect((await dragLayout())?.inside).toBe(true);
    await expect(dragTrigger).toHaveAttribute('aria-expanded', 'false');
    await expectCompleted(2);
  };
  const home = await dragPoint();
  expect(home, 'Reset position reports the home coordinates').not.toBeNull();
  const homeX = home?.x ?? Number.NaN;
  const homeY = home?.y ?? Number.NaN;
  const homeLeft = await dragLeft();
  await expectDragUntouched();

  // Preset alternatives: Move left shifts only x and the native trigger; Move right brings back the same step.
  await interaction.getByRole('button', { name: 'Move left', exact: true }).click();
  await expect.poll(async () => (await dragPoint())?.x ?? homeX).toBeLessThan(homeX);
  const stepped = await dragPoint();
  expect(stepped?.y).toBe(homeY);
  const step = homeX - (stepped?.x ?? homeX);
  await expect.poll(dragLeft).toBeLessThan(homeLeft);
  await expectDragUntouched();
  await interaction.getByRole('button', { name: 'Move right', exact: true }).click();
  await expect.poll(dragPoint).toEqual({ x: homeX, y: homeY });
  await expect.poll(dragLeft).toBeCloseTo(homeLeft, 0);

  // Keyboard: one ArrowLeft on the focused handle moves exactly one preset step, and Home returns to the default.
  await moveActions.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(dragPoint).toEqual({ x: homeX - step, y: homeY });
  await expect.poll(dragLeft).toBeLessThan(homeLeft);
  await expectDragUntouched();
  await page.keyboard.press('Home');
  await expect(position).toHaveText(reset);
  await expect.poll(dragLeft).toBeCloseTo(homeLeft, 0);

  // Pointer: a real mouse drag on Move actions past the threshold moves the native trigger and reports the point.
  const grip = async () => {
    await moveActions.scrollIntoViewIfNeeded();
    const box = await moveActions.boundingBox();
    expect(box, 'Move actions has a pointer target').not.toBeNull();
    return {
      x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
      y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
    };
  };
  let start = await grip();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 48, start.y - 32, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await dragPoint())?.x ?? homeX).toBeLessThan(homeX);
  expect((await dragPoint())?.y ?? Number.NaN).toBeLessThanOrEqual(homeY);
  await expect.poll(dragLeft).toBeLessThan(homeLeft);
  const draggedLeft = await dragLeft();
  await expectDragUntouched();

  // A drag far past the stage edge stays clamped inside the stage.
  start = await grip();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(1, 1, { steps: 12 });
  await page.mouse.up();
  await expect.poll(dragLeft).toBeLessThan(draggedLeft);
  await expectDragUntouched();

  // Lost pointer capture mid-drag cancels back to the start point instead of committing the move.
  await interaction.getByRole('button', { name: 'Reset position', exact: true }).click();
  await expect(position).toHaveText(reset);
  start = await grip();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 40, start.y - 24, { steps: 8 });
  await expect(position).not.toHaveText(reset);
  const released = await dragHandle.evaluate(element => {
    for (let id = 0; id <= 16; id += 1) {
      if (element.hasPointerCapture(id)) {
        element.releasePointerCapture(id);
        return true;
      }
    }
    return false;
  });
  expect(released, 'the drag handle captures the real pointer').toBe(true);
  // The next pointer event delivers lostpointercapture first.
  await page.mouse.move(start.x - 41, start.y - 24);
  await expect(position).toHaveText(reset);
  await page.mouse.up();
  await expect(position).toHaveText(reset);
  await expect.poll(dragLeft).toBeCloseTo(homeLeft, 0);
  await expectDragUntouched();

  // Modal menu: this preview's shared native Modal traps focus, honours closeOnOutside and closeOnEscape,
  // and a nested confirmation takes Escape first. Flags are set through the Tweaker this preview's own toolbar opens.
  const opener = actionsCase.getByRole('button', { name: 'Open tweaker', exact: true });
  const closeTweaker = page.getByRole('button', { name: 'Close tweaker', exact: true });
  const setFlags = async (values: Readonly<Record<string, boolean>>) => {
    await trigger.focus();
    await opener.click();
    // The toolbar button carries no expanded state; the visible Tweaker drawer is the evidence.
    await expect(closeTweaker).toBeVisible();
    for (const [name, value] of Object.entries(values)) {
      const flag = page.getByRole('switch', { name, exact: true });
      await expect(flag).toBeVisible();
      if ((await flag.getAttribute('aria-checked')) !== String(value)) await flag.click();
      await expect(flag).toHaveAttribute('aria-checked', String(value));
    }
    // The Tweaker closes first so its drawer never covers the preview.
    await closeTweaker.click();
    await expect(closeTweaker).toBeHidden();
  };
  const preview = actionsCase.locator('.example-preview').first();
  const menuDialog = page.getByRole('dialog', { name: 'Actions', exact: true });
  const confirmDialog = page.getByRole('dialog', { name: 'Confirm action', exact: true });
  const modalItem = (id: string) =>
    menuDialog.locator(`[data-fab-action-id=${id}] [role=menuitem]`);
  const focusInMenu = () =>
    menuDialog.evaluate(element => element.contains(document.activeElement));
  const openModalMenu = async () => {
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(menuDialog).toHaveCount(1);
    // The modal root renders inside the originating preview, never in another FAB or the page body.
    await expect(preview.getByRole('dialog', { name: 'Actions', exact: true })).toBeVisible();
  };
  /** Clicks a viewport point where the native mask or wrapper itself is hit, outside the visible panel. */
  const clickMask = async () => {
    await menuDialog.scrollIntoViewIfNeeded();
    const point = await menuDialog.evaluate(dialog => {
      const root = dialog.closest('.ant-modal-root') ?? dialog.parentElement;
      const wrap = dialog.closest('.ant-modal-wrap');
      const layers = [wrap, root?.querySelector('.ant-modal-mask') ?? null];
      const panel = (dialog.querySelector('.ant-modal-content') ?? dialog).getBoundingClientRect();
      const area = (wrap ?? root ?? dialog).getBoundingClientRect();
      const left = Math.max(area.left, 0);
      const top = Math.max(area.top, 0);
      const right = Math.min(area.right, window.innerWidth);
      const bottom = Math.min(area.bottom, window.innerHeight);
      for (let y = top + 2; y < bottom; y += 8) {
        for (let x = left + 2; x < right; x += 8) {
          if (x >= panel.left && x <= panel.right && y >= panel.top && y <= panel.bottom) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit !== null && layers.includes(hit)) return { x, y };
        }
      }
      return null;
    });
    expect(point, 'the modal mask must be hittable outside the panel').not.toBeNull();
    if (point) await page.mouse.click(point.x, point.y);
  };

  await setFlags({ Modal: true, 'Close on outside': false });
  await openModalMenu();
  // The native first action owns focus, and Tab and Shift+Tab never reach background controls.
  await expect.poll(() => focusedActionId(page)).toBe('sync');
  await expect.poll(focusInMenu).toBe(true);
  for (const key of [
    'Tab',
    'Tab',
    'Tab',
    'Tab',
    'Tab',
    'Shift+Tab',
    'Shift+Tab',
    'Shift+Tab',
    'Shift+Tab',
    'Shift+Tab',
  ]) {
    await page.keyboard.press(key);
    expect(await focusInMenu(), `${key} keeps focus inside the modal menu`).toBe(true);
  }
  // closeOnOutside false: a real mask click keeps the modal menu open and runs nothing.
  await clickMask();
  await expect(menuDialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expectCompleted(2);

  // Nested confirmation: Escape closes only the confirmation; the parent modal menu stays open.
  await modalItem('delete').click();
  await expect(preview.getByRole('dialog', { name: 'Confirm action', exact: true })).toBeVisible();
  await expect(confirmDialog).toHaveCount(1);
  await expectCompleted(2);
  await page.keyboard.press('Escape');
  await expect(confirmDialog).toBeHidden();
  await expect(menuDialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expectCompleted(2);
  // closeOnEscape true: the next Escape closes the modal menu and returns focus to the real trigger.
  await page.keyboard.press('Escape');
  await expect(menuDialog).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await expectCompleted(2);

  // closeOnOutside true: the same mask click closes the modal menu without running an action.
  await setFlags({ 'Close on outside': true });
  await openModalMenu();
  await clickMask();
  await expect(menuDialog).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expectCompleted(2);
  await setFlags({ Modal: false });

  // Hover trigger chosen through the same Tweaker: a real mouse crossing the gap from the trigger to an action keeps the
  // menu open and the native action clickable; leaving the FAB's own parts closes a hover-opened menu and runs nothing.
  const triggerField = page.getByRole('combobox', { name: 'Trigger', exact: true });
  const triggerSelect = page.locator('.ant-select').filter({ has: triggerField }).first();
  const setTrigger = async (label: string) => {
    await trigger.focus();
    await opener.click();
    // The toolbar button carries no expanded state; the visible Tweaker drawer is the evidence.
    await expect(closeTweaker).toBeVisible();
    await expect(triggerField).toBeVisible();
    const previous = (await triggerSelect.innerText()).trim();
    await chooseOption(page, triggerField, label);
    await expect(triggerSelect).toContainText(label);
    await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')).toHaveCount(
      0,
    );
    // The Tweaker closes first so its drawer never covers the preview.
    await closeTweaker.click();
    await expect(closeTweaker).toBeHidden();
    return previous;
  };
  const centre = async (target: Locator) => {
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box, 'the hover target has a pointer box').not.toBeNull();
    return { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 };
  };
  const hoverCapable = await page.evaluate(
    () => matchMedia('(any-hover: hover)').matches && matchMedia('(any-pointer: fine)').matches,
  );
  const previousTrigger = await setTrigger('Hover');
  // An empty corner of this preview's own stage lies outside every FAB part; the FAB layer itself takes no pointer.
  const hoverStage = actionsCase.locator('.genux-fab-demo-stage').first();
  await hoverStage.scrollIntoViewIfNeeded();
  const corner = await hoverStage.boundingBox();
  expect(corner, 'the stage has a pointer box').not.toBeNull();
  const away = { x: (corner?.x ?? 0) + 8, y: (corner?.y ?? 0) + 8 };
  await page.mouse.move(away.x, away.y);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  const enter = await centre(trigger);
  await page.mouse.move(enter.x, enter.y, { steps: 8 });
  if (!hoverCapable) {
    // Without a hovering fine pointer the hover option never opens from pointer movement; click and keyboard still do.
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  } else {
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // Gradual native movement from the trigger across the gap to Save offline copy keeps the menu open.
    const save = item('save');
    const aim = await centre(save);
    await page.mouse.move(aim.x, aim.y, { steps: 16 });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(save).toBeEnabled();
    await page.mouse.down();
    await page.mouse.up();
    await expectCompleted(3);
    // Reopened by hover, the menu closes once the pointer leaves the FAB's own parts, without running an action.
    await page.mouse.move(away.x, away.y, { steps: 8 });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await page.mouse.move(enter.x, enter.y, { steps: 8 });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.move(away.x, away.y, { steps: 12 });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expectCompleted(3);
  }
  await setTrigger(previousTrigger);

  expect(errors).toEqual([]);
});

test('FAB previews adapt without losing drafts or page theme', async ({ page }, testInfo) => {
  test.setTimeout(FAB_CASE_TIMEOUT);
  const errors = capturePageErrors(page);
  // Mobile first: the 320 CSS px host is accepted before wider hosts.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(FAB_ROUTE);
  await expectHydrated(page);
  await expectBoundedOverflow(page);

  await expect(page.locator('[data-fab-case]')).toHaveCount(FAB_CASES.length);
  for (const name of FAB_CASES) {
    await expect(fabCase(page, name).locator('.example-preview').first()).toBeAttached();
  }

  const pageTheme = await page.locator('html').getAttribute('data-theme-mode');
  const adaptive = fabCase(page, 'adaptive');
  const fab = adaptive.locator('.genux-fab').first();
  const trigger = triggerOf(adaptive);
  const menu = fab.locator('.genux-fab-actions');
  const draft = adaptive.getByLabel('Draft action label', { exact: true });
  const addAction = adaptive.getByRole('button', { name: 'Add action', exact: true });

  // Six long labels drive the adaptive circle into its fallback layouts.
  for (const label of LONG_LABELS) {
    if ((await fab.locator('.genux-fab-action').count()) >= LONG_LABELS.length) break;
    await draft.fill(label);
    await addAction.click();
  }
  await expect
    .poll(() => fab.locator('.genux-fab-action').count())
    .toBeGreaterThanOrEqual(LONG_LABELS.length);

  // Preview switches keep the FAB mounted inside ExamplePreview, not only the draft outside it.
  const mounted = await fab.elementHandle();
  const actionCount = await fab.locator('.genux-fab-action').count();
  const expectSameMount = async () => {
    expect(await mounted?.evaluate(node => node.isConnected)).toBe(true);
    await expect(fab.locator('.genux-fab-action')).toHaveCount(actionCount);
  };

  // The draft lives outside the preview and must survive every preview-local switch.
  const kept = 'Draft kept across preview switches';
  await draft.fill(kept);
  // React committed the typed draft before any switch: the controlled value holds and Add action is enabled, since six
  // actions stay below the 64 action limit. A fill hydration later reset leaves the field blank and Add action disabled.
  await expect(draft).toHaveValue(kept);
  await expect(addAction).toBeEnabled();

  await expect.poll(() => minFontSize(adaptive)).toBeGreaterThanOrEqual(MIN_TEXT);
  await expect.poll(() => targetSize(trigger)).toBeGreaterThanOrEqual(MIN_TARGET);

  // Phone: long labels fall back to a menu or a bounded, scrollable sheet.
  await chooseRadio(adaptive, 'iPhone 18');
  // Genuine 320 logical component region inside the fixed iPhone mockup, not a 320 CSS px phone viewport: the explicit
  // local fixture narrows only the FAB's own stage, the container the hook measures, to a 320 CSS px client box. The
  // device frame and the preview document keep their natural geometry, and the stage's inline style alone is restored
  // before the rotation below.
  const logicalPhone = 320;
  const usableWidth = () =>
    fab.evaluate(root =>
      Number.parseFloat(getComputedStyle(root).getPropertyValue('--fab-usable-width')),
    );
  // Switching mockups animates the device frame. Wait until the natural phone document and its parent screen both
  // reach the central --preview-screen-width/height they inherit and the hook has remeasured that stage, so the
  // baselines below never capture a mid-animation frame. The unchanged frame comparison stays strict against this
  // settled state.
  const naturalPhone = () =>
    fab.evaluate(root => {
      const screen = root.closest<HTMLElement>('[data-preview-document]');
      const stage = root.closest<HTMLElement>('.genux-fab-demo-stage');
      if (!screen || !stage) return null;
      // The fixture below records this parent screen as the frame, so its own animation must settle too.
      const frame = screen.parentElement;
      const read = (element: Element, name: string) =>
        Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
      const expected = {
        width: read(screen, '--preview-screen-width'),
        height: read(screen, '--preview-screen-height'),
      };
      const safe = (read(root, '--fab-safe-left') || 0) + (read(root, '--fab-safe-right') || 0);
      const usable = read(root, '--fab-usable-width');
      const settled =
        Number.isFinite(expected.width) &&
        Number.isFinite(expected.height) &&
        expected.width > 0 &&
        expected.height > 0 &&
        Math.abs(screen.offsetWidth - expected.width) <= 1 &&
        Math.abs(screen.offsetHeight - expected.height) <= 1 &&
        frame !== null &&
        Math.abs(frame.offsetWidth - expected.width) <= 1 &&
        Math.abs(frame.offsetHeight - expected.height) <= 1 &&
        stage.clientWidth > 0 &&
        stage.clientWidth <= screen.offsetWidth &&
        Number.isFinite(usable) &&
        Math.abs(usable - (stage.clientWidth - safe)) <= 0.5;
      return settled
        ? 'settled'
        : {
            expected,
            screen: { width: screen.offsetWidth, height: screen.offsetHeight },
            frame: frame ? { width: frame.offsetWidth, height: frame.offsetHeight } : null,
            stage: stage.clientWidth,
            safe,
            usable,
          };
    });
  await expect.poll(naturalPhone).toBe('settled');
  const phoneUsable = await usableWidth();
  const fixture = await fab.evaluate((root, width) => {
    const stage = root.closest<HTMLElement>('.genux-fab-demo-stage');
    const screen = root.closest<HTMLElement>('[data-preview-document]');
    if (!stage || !screen) return null;
    const frame = screen.parentElement;
    const saved = stage.getAttribute('style');
    const geometry = {
      screen: { width: screen.offsetWidth, height: screen.offsetHeight },
      frame: frame ? { width: frame.offsetWidth, height: frame.offsetHeight } : null,
    };
    // Borders and a scrollbar sit outside the client box, so the border box grows by them.
    const chrome = stage.offsetWidth - stage.clientWidth;
    stage.style.setProperty('box-sizing', 'border-box', 'important');
    stage.style.setProperty('flex', 'none', 'important');
    for (const name of ['width', 'min-width', 'max-width']) {
      stage.style.setProperty(name, `${width + chrome}px`, 'important');
    }
    return { saved, ...geometry };
  }, logicalPhone);
  expect(fixture, 'the adaptive FAB renders inside its own preview document').not.toBeNull();
  try {
    // Usable width the hook measured against the 320 CSS px stage: its client box minus safe areas, in logical px.
    const logical = () =>
      fab.evaluate(root => {
        const screen = root.closest<HTMLElement>('[data-preview-document]');
        const stage = root.closest<HTMLElement>('.genux-fab-demo-stage');
        const style = getComputedStyle(root);
        const safe = (side: string) =>
          Number.parseFloat(style.getPropertyValue(`--fab-safe-${side}`)) || 0;
        const frame = screen?.parentElement;
        return {
          stage: stage?.clientWidth ?? 0,
          safe: safe('left') + safe('right'),
          usable: Number.parseFloat(style.getPropertyValue('--fab-usable-width')),
          screen: screen ? { width: screen.offsetWidth, height: screen.offsetHeight } : null,
          frame: frame ? { width: frame.offsetWidth, height: frame.offsetHeight } : null,
        };
      });
    await expect.poll(async () => (await logical()).stage).toBe(logicalPhone);
    await expect
      .poll(async () => {
        const state = await logical();
        return Math.abs(state.usable - (logicalPhone - state.safe)) <= 0.5 ? 'logical' : state;
      })
      .toBe('logical');
    const narrowed = await logical();
    expect(narrowed.stage).toBe(logicalPhone);
    expect(narrowed.usable).toBeLessThanOrEqual(logicalPhone);
    expect(narrowed.usable).toBeLessThan(phoneUsable);
    // The fixed phone mockup keeps its natural frame and preview document geometry.
    expect(narrowed.screen).toEqual(fixture?.screen ?? null);
    expect(narrowed.frame).toEqual(fixture?.frame ?? null);

    await openMenu(trigger);
    await expect(menu).toHaveAttribute('data-fab-mode', /^(menu|sheet)$/);
    // Containment: the native trigger and the bounded panel stay inside the 320 CSS px stage border box, the fixed
    // phone screen and the usable width.
    const contained = () =>
      fab.evaluate(root => {
        const screen = root
          .closest<HTMLElement>('[data-preview-document]')
          ?.getBoundingClientRect();
        const stage = root.closest<HTMLElement>('.genux-fab-demo-stage')?.getBoundingClientRect();
        const panel = root.querySelector<HTMLElement>('.genux-fab-actions');
        const control = root.querySelector<HTMLElement>('.genux-fab-trigger button');
        if (!screen || !stage || !panel || !control) return null;
        const inside = (box: DOMRect, outer: DOMRect) =>
          box.left >= outer.left - 1 &&
          box.top >= outer.top - 1 &&
          box.right <= outer.right + 1 &&
          box.bottom <= outer.bottom + 1;
        const within = (box: DOMRect) => inside(box, stage) && inside(box, screen);
        const usable = Number.parseFloat(
          getComputedStyle(root).getPropertyValue('--fab-usable-width'),
        );
        return {
          trigger: within(control.getBoundingClientRect()),
          panel: within(panel.getBoundingClientRect()),
          width: panel.offsetWidth <= usable + 1,
        };
      });
    await expect.poll(contained).toEqual({ trigger: true, panel: true, width: true });
    // Reachability: the last long action scrolls into view inside the bounded panel as an enabled native item.
    const lastAction = menu.locator('[role=menuitem]').last();
    await lastAction.scrollIntoViewIfNeeded();
    await expect(lastAction).toBeVisible();
    await expect(lastAction).toBeEnabled();
    expect(
      await lastAction.evaluate(item => {
        const panel = item.closest('.genux-fab-actions')?.getBoundingClientRect();
        const box = item.getBoundingClientRect();
        return panel !== undefined && box.top >= panel.top - 1 && box.bottom <= panel.bottom + 1;
      }),
    ).toBe(true);
    expect(await menu.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto');
    // Motion has settled: the root reports the open state, so the photo is never a mid-stagger frame.
    await expect(fab).toHaveAttribute('data-fab-state', 'open');
    await adaptive.screenshot({ path: testInfo.outputPath('fab-phone-open-320.png') });
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  } finally {
    await fab.evaluate((root, saved) => {
      const stage = root.closest<HTMLElement>('.genux-fab-demo-stage');
      if (!stage) return;
      if (saved === null) stage.removeAttribute('style');
      else stage.setAttribute('style', saved);
    }, fixture?.saved ?? null);
  }
  // The restored stage measures its own width again before the rotation below.
  await expect.poll(usableWidth).toBe(phoneUsable);
  await expect(draft).toHaveValue(kept);
  await expectSameMount();

  // Rotating the phone widens the logical viewport without losing the draft; rotating back restores it.
  const portrait = await stageSize(fab);
  const rotate = adaptive.getByRole('button', { name: 'Rotate', exact: true });
  await rotate.click();
  await expect.poll(async () => (await stageSize(fab)).width).toBeGreaterThan(portrait.width);
  await expect(draft).toHaveValue(kept);
  await rotate.click();
  await expect.poll(async () => (await stageSize(fab)).width).toBe(portrait.width);
  await expectSameMount();

  await chooseRadio(adaptive, 'iPad mini');
  await expect(draft).toHaveValue(kept);
  await expectSameMount();
  await chooseRadio(adaptive, 'MacBook 13');
  await expect(draft).toHaveValue(kept);
  await expectSameMount();

  // TV: a labelled menu where ArrowDown moves the visible, ringless keyboard focus exactly one item.
  await chooseRadio(adaptive, 'TV');
  await expect(draft).toHaveValue(kept);
  await expectSameMount();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toHaveAttribute('data-fab-mode', 'menu');
  const labels = await menu
    .locator('[role=menuitem]')
    .evaluateAll(items => items.map(node => (node as HTMLElement).innerText.trim()));
  expect(labels.length).toBeGreaterThanOrEqual(LONG_LABELS.length);
  for (const label of labels) expect(label).not.toBe('');
  const enabled = await enabledActionIds(fab);
  await expect.poll(() => focusedActionId(page)).toBe(enabled[0]);
  // Programmatic focus and Enter keep the central mode off; only the handled TV arrow turns it on.
  const modality = page.locator('html');
  await expect(modality).toHaveAttribute('data-input-modality', 'pointer');
  const target = menu.locator(`[data-fab-action-id=${enabled[1]}] [role=menuitem]`);
  // Pointer mode: the unfocused item has no outline and no painted marker.
  const rest = await focusMarker(target);
  expect(rest.outlined).toBe(false);
  expect(rest.marker.visible).toBe(false);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => focusedActionId(page)).toBe(enabled[1]);
  await expect(modality).toHaveAttribute('data-input-modality', 'keyboard');
  const focused = menu.locator('[role=menuitem]:focus');
  await expect(focused).toHaveCount(1);
  await expect(focused).toBeVisible();
  expect(await focused.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('none');
  // The central marker paints a visible, non-enclosing bar on the moved item's content child,
  // and no box gains an outline, all-round border or spread ring over its rest roles.
  await expect.poll(async () => (await focusMarker(target)).marker.visible).toBe(true);
  const marker = await focusMarker(target);
  expect(marker.rings).toEqual(rest.rings);
  expect(marker.outlined).toBe(false);
  expect(marker.marker.enclosing).toBe(false);
  expect(marker.marker.paint).not.toBe(rest.marker.paint);
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  // Local Dark themes only the preview; the documentation page keeps its own theme.
  await chooseRadio(adaptive, 'Dark');
  await expect(adaptive.locator('[data-theme-mode=dark]').first()).toBeAttached();
  expect(await page.locator('html').getAttribute('data-theme-mode')).toBe(pageTheme);

  // Code view names the profile the selected TV mockup renders with.
  await expect(adaptive.locator('[data-preview-profile]').first()).toHaveAttribute(
    'data-preview-profile',
    'tv',
  );
  await chooseRadio(adaptive, 'Code');
  await expect(
    adaptive
      .getByText(TV_PROFILE_LABEL, { exact: true })
      .or(adaptive.locator('[data-preview-profile=tv]:visible'))
      .first(),
  ).toBeVisible();
  await chooseRadio(adaptive, 'Preview');
  await expect(draft).toHaveValue(kept);
  await expectSameMount();
  await expect.poll(() => minFontSize(adaptive)).toBeGreaterThanOrEqual(MIN_TEXT);
  await adaptive.screenshot({ path: testInfo.outputPath('fab-adaptive-320.png') });

  // Wide host: the MacBook renders 1:1 inline, so this preview offers no Expand.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expectBoundedOverflow(page);
  await chooseRadio(adaptive, 'MacBook 13');
  await expect(adaptive.locator('[data-preview-expand]')).toHaveCount(0);
  await expect(draft).toHaveValue(kept);
  await expectSameMount();
  await captureVisible(page, adaptive, testInfo.outputPath('fab-macbook-1920.png'));

  // Default web input: ArrowDown on the closed trigger opens neither the menu nor a focus mode.
  await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'pointer');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'pointer');
  expect(await trigger.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('none');

  // Viewport anchor: an open menu's backdrop covers this preview's own mockup screen, never only its stage.
  // Choices go through this preview's own toolbar Tweaker and its labelled branded Selects.
  const tweakerOpener = adaptive.getByRole('button', { name: 'Open tweaker', exact: true });
  const tweakerClose = page.getByRole('button', { name: 'Close tweaker', exact: true });
  const setTweakerChoices = async (values: Readonly<Record<string, string>>) => {
    await trigger.focus();
    await tweakerOpener.click();
    // The toolbar button carries no expanded state; the visible Tweaker drawer is the evidence.
    await expect(tweakerClose).toBeVisible();
    for (const [name, label] of Object.entries(values)) {
      const field = page.getByRole('combobox', { name, exact: true });
      await expect(field).toBeVisible();
      await chooseOption(page, field, label);
      // The labelled Select wrapper shows the chosen option text; the renderer emits no data-fab-anchor attribute.
      await expect(page.locator('.ant-select').filter({ has: field }).first()).toContainText(label);
      await expect(
        page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
      ).toHaveCount(0);
    }
    // The Tweaker closes first so its drawer never covers the preview.
    await tweakerClose.click();
    await expect(tweakerClose).toBeHidden();
  };
  await setTweakerChoices({ Anchor: 'Viewport', Positioning: 'Absolute', Backdrop: 'Dim blur' });
  await adaptive.scrollIntoViewIfNeeded();
  await openMenu(trigger);
  const backdrop = fab.locator('.genux-fab-backdrop');
  await expect(backdrop).toBeVisible();
  // Largest per-edge distance from the visible logical box of the backdrop's own preview screen.
  const backdropFit = () =>
    backdrop.evaluate(element => {
      const screen = element.closest<HTMLElement>('[data-preview-document]');
      if (!screen) return { drift: Number.POSITIVE_INFINITY, scale: 0 };
      const box = screen.getBoundingClientRect();
      const scale = screen.offsetWidth > 0 ? box.width / screen.offsetWidth : 1;
      const left = box.left + screen.clientLeft * scale;
      const top = box.top + screen.clientTop * scale;
      const right = left + screen.clientWidth * scale;
      const bottom = top + screen.clientHeight * scale;
      const own = element.getBoundingClientRect();
      const drift = Math.max(
        Math.abs(own.left - left),
        Math.abs(own.top - top),
        Math.abs(own.right - right),
        Math.abs(own.bottom - bottom),
      );
      return { drift, scale };
    });
  await expect.poll(async () => (await backdropFit()).drift).toBeLessThanOrEqual(2);
  // The 1920 host renders the MacBook mockup at scale 1.
  expect(Math.abs((await backdropFit()).scale - 1)).toBeLessThanOrEqual(0.01);
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  // Restore the baseline so the following checks see the default container layer without a backdrop.
  await setTweakerChoices({ Anchor: 'Container', Positioning: 'Absolute', Backdrop: 'None' });

  // Shape via the Tweaker: all options are offered and circle and square change the rendered corners.
  // This preview's own toolbar opens the Tweaker for its example; focus starts on this preview's FAB.
  await trigger.focus();
  const opener = adaptive.getByRole('button', { name: 'Open tweaker', exact: true });
  await expect(opener).toBeVisible();
  await opener.click();
  // The toolbar button carries no expanded state; the visible Tweaker drawer is the evidence.
  const closeTweaker = page.getByRole('button', { name: 'Close tweaker', exact: true });
  await expect(closeTweaker).toBeVisible();
  const shape = page.getByLabel('Shape', { exact: true });
  await expect(shape).toBeVisible();
  const shapes = await selectOptionLabels(page, shape);
  expect(shapes).toHaveLength(SHAPE_COUNT);
  expect(shapes).toEqual(expect.arrayContaining(['Circle', 'Square']));
  await chooseOption(page, shape, 'Circle');
  await expect(fab).toHaveAttribute('data-fab-shape', 'circle');
  await expect.poll(() => circular(trigger)).toBe(true);
  await chooseOption(page, shape, 'Square');
  await expect(fab).toHaveAttribute('data-fab-shape', 'square');
  await expect.poll(() => circular(trigger)).toBe(false);
  await page.keyboard.press('Escape');

  // Appearance: all options are offered and another choice visibly repaints the trigger.
  const appearanceCase = fabCase(page, 'appearance');
  const appearance = appearanceCase.getByRole('combobox', { name: 'Appearance', exact: true });
  const appearanceTrigger = triggerOf(appearanceCase);
  const before = await paint(appearanceTrigger);
  // The rendered FAB root reports the current appearance value; option labels are its human form.
  const current = await appearanceCase
    .locator('.genux-fab')
    .first()
    .getAttribute('data-fab-appearance');
  const appearances = await selectOptionLabels(page, appearance);
  expect(appearances).toHaveLength(APPEARANCE_COUNT);
  const valueOf = (label: string) => label.trim().toLowerCase().replace(/ /g, '-');
  const next = appearances.find(label => valueOf(label) !== current);
  expect(next).toBeDefined();
  await chooseOption(page, appearance, next ?? '');
  await expect.poll(() => paint(appearanceTrigger)).not.toBe(before);

  // Tonal glyph ink: the open master's visible animated overlay glyph paints the computed ink of the native master SVG
  // it covers, in the preview's Light and local Dark modes; the mounted FAB and its control survive the mode change.
  const appearanceFab = appearanceCase.locator('.genux-fab').first();
  const appearanceRoot = await appearanceFab.elementHandle();
  const appearanceControl = await appearanceTrigger.elementHandle();
  await chooseOption(page, appearance, 'Tonal');
  await expect(appearanceFab).toHaveAttribute('data-fab-appearance', 'tonal');
  const glyphInk = () =>
    appearanceFab.evaluate(root => {
      const native = root.querySelector('.genux-fab-trigger-button .genux-button-content svg');
      const overlay = root.querySelector('.genux-fab-trigger > .genux-fab-trigger-icon-overlay');
      // The default rotate transition paints one SVG; only a displayed, non-transparent, non-empty one counts.
      const visible = Array.from(overlay?.querySelectorAll('svg') ?? []).find(node => {
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;
        for (let layer: Element | null = node; layer; layer = layer.parentElement) {
          const style = getComputedStyle(layer);
          if (style.display === 'none' || Number.parseFloat(style.opacity) === 0) return false;
          if (layer === overlay) break;
        }
        return getComputedStyle(node).visibility === 'visible';
      });
      return {
        native: native ? getComputedStyle(native).color : null,
        overlay: visible ? getComputedStyle(visible).color : null,
      };
    });
  const expectMatchingGlyphInk = async () => {
    await openMenu(appearanceTrigger);
    await expect(appearanceFab).toHaveAttribute('data-fab-state', 'open');
    await expect
      .poll(async () => {
        const ink = await glyphInk();
        return ink.native !== null && ink.overlay === ink.native ? 'matched' : ink;
      })
      .toEqual('matched');
    await page.keyboard.press('Escape');
    await expect(appearanceTrigger).toHaveAttribute('aria-expanded', 'false');
  };
  const expectSameAppearanceMount = async () => {
    expect(await appearanceRoot?.evaluate(node => node.isConnected)).toBe(true);
    expect(await appearanceControl?.evaluate(node => node.isConnected)).toBe(true);
  };
  await expectMatchingGlyphInk();
  // Local Dark themes only this preview; the documentation page keeps its own theme.
  await chooseRadio(appearanceCase, 'Dark');
  await expect(appearanceCase.locator('[data-theme-mode=dark]').first()).toBeAttached();
  expect(await page.locator('html').getAttribute('data-theme-mode')).toBe(pageTheme);
  await expectSameAppearanceMount();
  await expectMatchingGlyphInk();
  await expectSameAppearanceMount();

  await captureVisible(page, adaptive, testInfo.outputPath('fab-adaptive-1920.png'));
  expect(errors).toEqual([]);
});
