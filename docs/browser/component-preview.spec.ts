import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { components } from '../src/data/catalog';

// Explicit human request (2026-10-16): every documentation example cluster on the 40 component
// routes sits in exactly one shared preview workbench with Device preview, Preview theme and
// Example view controls. Wide component pages show the showcase on the left, API and resources
// as one continuous stack on the right and a sticky contents rail on the far right; 320 CSS px
// stacks naturally. Code loads lazily from /preview-code/<id>.json only after Code is chosen.
// Screenshots are saved under testInfo.outputPath, labelled with ATLAS_SOURCE_STAGE.
// Routes and code payloads resolve against Playwright's configured baseURL, so the service the
// config starts is the one tested; ATLAS_DOCS_ORIGIN is only an explicit controller override.
const docsOrigin = process.env.ATLAS_DOCS_ORIGIN?.trim() || undefined;
const stage = (process.env.ATLAS_SOURCE_STAGE ?? 'unlabeled').replace(/[^a-z0-9-]/gi, '-');
const THEME_KEY = 'atlas-theme';
const tolerancePx = 1;
const wide = { width: 1920, height: 1080 };
const narrow = { width: 320, height: 800 };
// The route table is the documentation catalog itself.
const routes = components.map(component => component.slug);
const WORKBENCH = '[data-example-preview]';
// Existing leaf example markup: legacy example blocks, the Badge example groups, data-entry
// sections, the Listy patterns and each selection layout section. The no-child-leaf filter keeps
// wrapping categories out.
const LEAF =
  '.example-block, .atlas-badge-demo-group, .data-entry-section, [data-listy-pattern], .atlas-selection-variant';
// Independent leaf examples that each need their own workbench, never a shared one. Business
// choices, cells and variant comparisons inside one example are not independent leaves.
const independentLeaves = [
  { route: 'pill', selector: '[data-pill-icons] .example-block', count: 3 },
  { route: 'pill', selector: '[data-pill-checkable], [data-pill-closable]', count: 2 },
  { route: 'card', selector: '.card-interaction-example', count: 3 },
] as const;
const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const referenceSection = /api|resource/i;
const newline = String.fromCharCode(10);
const deviceWidths = { iphone: 390, ipad: 820, macbook: 1280 } as const;
const controlGroups: readonly (readonly [string, readonly string[]])[] = [
  ['Device preview', ['iPhone', 'iPad', 'MacBook']],
  ['Preview theme', ['Light', 'Dark']],
  ['Example view', ['Preview', 'Code']],
];
type CodePayload = { id: string; code: string; sourcePath: string; sourceUrl: string };

test.use({ locale: 'en-US', ...(docsOrigin ? { baseURL: docsOrigin } : {}) });

// Relative to baseURL: page.goto and page.request resolve both against the tested service.
const routeUrl = (slug: string) => `components/${slug}/`;
const codeUrl = (id: string) => `preview-code/${id}.json`;
const isCodeRequest = (url: string) => new URL(url).pathname.includes('/preview-code/');
const isCodeFor = (url: string, id: string) =>
  new URL(url).pathname.endsWith(`/preview-code/${id}.json`);

// Fails without a configured service and records which origin the run exercised.
function docsService(baseURL: string | undefined, testInfo: TestInfo) {
  expect(baseURL, 'Playwright baseURL names the tested docs service').toBeTruthy();
  testInfo.annotations.push({ type: 'docs-origin', description: String(baseURL) });
}

async function visit(page: Page, slug: string) {
  await page.goto(routeUrl(slug));
  await expect(page.locator('astro-island[ssr]'), `${slug} islands hydrate`).toHaveCount(0);
}

// Geometry is read only after the preview owners' running finite animations finish: the
// frame, screen, device, toolbar and view (stage and code pane) owners plus the root theme paint.
// Child and native control animations are not awaited (the document-wide wait hung the Listy
// acceptance); no fixed sleeps.
const SETTLE_OWNERS =
  '.example-preview-frame, .example-preview-screen, [data-preview-device], .example-preview-toolbar, ' +
  '.example-preview-stage, .example-preview-code-panel';

function settle(page: Page) {
  return page.evaluate(async ownerSelector => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    await frame();
    await frame();
    if (!document.querySelector('[data-example-preview]')) return;
    const owners = [document.documentElement, ...document.querySelectorAll(ownerSelector)];
    const running = owners.flatMap(owner =>
      owner.getAnimations().filter(animation => {
        const end = animation.effect?.getComputedTiming().endTime;
        return animation.playState === 'running' && typeof end === 'number' && Number.isFinite(end);
      }),
    );
    if (!running.length) return;
    await Promise.all(running.map(animation => animation.finished.catch(() => undefined)));
    await frame();
    await frame();
  }, SETTLE_OWNERS);
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`component-preview-${stage}-${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`component-preview-${stage}-${name}`, { path, contentType: 'image/png' });
}

// Captures one workbench (not the whole page) as device evidence for independent review.
// Finite transitions are fast-forwarded, so the image shows the settled state, not a mid-move.
async function workbenchShot(scope: Locator, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`component-preview-${stage}-${name}.png`);
  await scope.screenshot({ path, animations: 'disabled' });
  await testInfo.attach(`component-preview-${stage}-${name}`, { path, contentType: 'image/png' });
}

const workbench = (page: Page, id: string) =>
  page.locator(`[data-example-preview='${id}']`).first();
const group = (scope: Locator, name: string) =>
  scope.getByRole('radiogroup', { name, exact: true });
const option = (scope: Locator, groupName: string, name: string) =>
  group(scope, groupName).getByRole('radio', { name, exact: true });
// Antd keeps the native radio as the zero-size checked and focus owner; pointers use its label.
const choose = (radio: Locator) => radio.locator('xpath=ancestor::label[1]').click();
const frame = (scope: Locator) => scope.locator('[data-preview-device]').first();
const screen = (scope: Locator) => scope.locator('.example-preview-screen').first();
const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const viewStage = (scope: Locator) => scope.locator('.example-preview-stage').first();
const codePane = (scope: Locator) => scope.locator('.example-preview-code-panel').first();
// Read once right after the choice, never polled: ARIA and inert switch with the view at once.
const paneState = (target: Locator) =>
  target.evaluate(el => ({
    ariaHidden: el.getAttribute('aria-hidden') === 'true',
    inert: (el as HTMLElement).inert,
  }));

// Motion contract: base rules ease both directions with the exact symmetric Cubic curve and a
// positive central duration role; geometry and view visibility move, semantics do not wait.
const CUBIC = 'cubic-bezier(0.65, 0, 0.35, 1)';
const DURATION_ROLES = [
  '--motion-duration-fast',
  '--motion-duration-feedback',
  '--motion-duration-standard',
] as const;
const geometryProperties = ['inline-size', 'width', 'max-inline-size', 'max-width'];
const viewProperties = ['opacity', 'visibility'];

function transitionOf(target: Locator) {
  return target.evaluate((el, roles) => {
    const ms = (value: string) => {
      const text = value.trim();
      const amount = parseFloat(text);
      const scaled = text.endsWith('ms') ? amount : text.endsWith('s') ? amount * 1000 : NaN;
      return Math.round(scaled * 100) / 100;
    };
    const style = getComputedStyle(el);
    const root = getComputedStyle(document.documentElement);
    return {
      properties: style.transitionProperty.split(',').map(item => item.trim()),
      durations: style.transitionDuration.split(',').map(ms),
      easings: style.transitionTimingFunction.match(/[a-z-]+[(][^)]*[)]|[a-z-]+/g) ?? [],
      central: roles
        .map(role => ms(root.getPropertyValue(role)))
        .filter(value => Number.isFinite(value) && value > 0),
    };
  }, DURATION_ROLES);
}
type Motion = Awaited<ReturnType<typeof transitionOf>>;

function expectEased(motion: Motion, label: string, wanted: readonly string[]) {
  const eased = motion.properties
    .map((property, index) => ({
      property,
      duration: motion.durations[index % motion.durations.length],
      easing: motion.easings[index % motion.easings.length],
    }))
    .filter(entry => wanted.includes(entry.property));
  expect(
    eased.map(entry => entry.property),
    `${label}: transitions ${wanted.join(' or ')}`,
  ).not.toEqual([]);
  expect(motion.central.length, `${label}: central duration roles are declared`).toBeGreaterThan(0);
  for (const entry of eased) {
    expect(entry.duration, `${label}: ${entry.property} has a positive duration`).toBeGreaterThan(
      0,
    );
    expect(motion.central, `${label}: ${entry.property} uses a central duration`).toContain(
      entry.duration,
    );
    expect(entry.easing, `${label}: ${entry.property} eases with the Cubic curve`).toBe(CUBIC);
  }
}

// Marks the first rendered child of the preview screen; a remount drops the attribute.
async function probe(scope: Locator, token: string) {
  await screen(scope).evaluate((el, value) => {
    (el.firstElementChild ?? el).setAttribute('data-remount-probe', value);
  }, token);
}
const probed = (scope: Locator, token: string) => scope.locator(`[data-remount-probe='${token}']`);
const sameDocument = (page: Page) =>
  page.evaluate(() => (window as unknown as { previewProbe?: boolean }).previewProbe === true);

// The preview keeps real CSS pixels: no transform, scale or zoom between screen and workbench.
const unscaled = (scope: Locator) =>
  screen(scope).evaluate(el => {
    const nodes: Element[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      nodes.push(node);
      if (node.matches('[data-example-preview]')) break;
    }
    return nodes.every(node => {
      const style = getComputedStyle(node);
      const scale = style.getPropertyValue('scale');
      const zoom = style.getPropertyValue('zoom');
      return (
        style.transform === 'none' &&
        (scale === '' || scale === 'none') &&
        (zoom === '' || zoom === '1' || zoom === 'normal')
      );
    });
  });

const focusedWithin = (target: Locator) =>
  target.evaluate(el => {
    const active = document.activeElement;
    return (
      !!active &&
      (el === active || el.contains(active) || (el.closest('label')?.contains(active) ?? false))
    );
  });

// Focus marker of a radio, its label and the label's visible paint target: focus-fields.css
// scales the Segmented item label child by --focus-choice-scale, so that child is read too.
// Surrounding rings are rejected on every part, the rest is compared; cue is the child scale.
function focusMarker(target: Locator) {
  return target.evaluate(el => {
    const host = el.closest('label') ?? el.parentElement;
    const cue = host?.querySelector('.ant-segmented-item-label') ?? null;
    const parts = [el, host, cue].filter((node): node is Element => node !== null);
    let ring = false;
    const signature: string[] = [];
    for (const node of parts) {
      const style = getComputedStyle(node);
      const after = getComputedStyle(node, '::after');
      const before = getComputedStyle(node, '::before');
      if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ring = true;
      if (/0px 0px 0px [1-9]/.test(style.boxShadow)) ring = true;
      signature.push(
        style.scale,
        style.transform,
        style.boxShadow,
        style.borderBottomColor,
        style.borderBottomWidth,
        style.backgroundColor,
        style.textDecorationLine,
        style.color,
        after.content,
        after.backgroundColor,
        after.opacity,
        after.transform,
        before.content,
        before.backgroundColor,
        before.opacity,
      );
    }
    return {
      ring,
      signature: signature.join('|'),
      cue: cue ? getComputedStyle(cue).scale : '',
    };
  });
}

function auditWorkbenches(page: Page) {
  return page.evaluate(
    ([workbenchSelector, leafSelector, independentSelectors]) => {
      const empty = {
        ids: [] as string[],
        nested: [] as string[],
        sectionWrappers: [] as string[],
        uncovered: [] as string[],
        badgeOwners: [] as (string | null)[],
        listyOwners: [] as { pattern: string; owner: string | null }[],
        selectionOwners: [] as (string | null)[],
        independentOwners: [] as { selector: string; leaf: string; owner: string | null }[],
      };
      const main = document.querySelector('main');
      if (!main) return empty;
      const shown = (el: Element) =>
        el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const idOf = (el: Element) => el.getAttribute('data-example-preview') ?? '';
      const owners = (el: Element) => {
        let count = 0;
        for (let parent = el.parentElement; parent; parent = parent.parentElement)
          if (parent.matches(workbenchSelector)) count++;
        return count;
      };
      const describe = (el: Element) => {
        const heading = el.querySelector('h2, h3, h4, h5');
        const text = heading?.textContent ?? el.textContent ?? '';
        return [el.tagName.toLowerCase(), el.id ? '#' + el.id : '', text.trim().slice(0, 48)]
          .filter(Boolean)
          .join(' ');
      };
      const workbenches = [...main.querySelectorAll(workbenchSelector)];
      const leaves = [...main.querySelectorAll(leafSelector)].filter(
        el =>
          !el.querySelector(leafSelector) &&
          shown(el) &&
          !el.closest('.atlas-tweaker-panel, [data-tweaker-settings], [role=dialog]'),
      );
      return {
        ids: workbenches.map(idOf),
        nested: workbenches.filter(el => owners(el) > 0).map(idOf),
        sectionWrappers: workbenches
          .filter(el => el.querySelector('[data-doc-section]') !== null)
          .map(idOf),
        uncovered: leaves
          .filter(
            el =>
              owners(el) === 0 &&
              !el.matches(workbenchSelector) &&
              !el.querySelector(workbenchSelector),
          )
          .map(describe),
        badgeOwners: [...main.querySelectorAll('.atlas-badge-demo-group')].map(el => {
          const owner = el.closest(workbenchSelector) ?? el.querySelector(workbenchSelector);
          return owner ? idOf(owner) : null;
        }),
        listyOwners: [...main.querySelectorAll('[data-listy-pattern]')]
          .filter(
            el =>
              shown(el) &&
              !el.closest('.atlas-tweaker-panel, [data-tweaker-settings], [role=dialog]'),
          )
          .map(el => {
            const owner = el.closest(workbenchSelector) ?? el.querySelector(workbenchSelector);
            return {
              pattern: el.getAttribute('data-listy-pattern') ?? '',
              owner: owner ? idOf(owner) : null,
            };
          }),
        selectionOwners: [...main.querySelectorAll('.atlas-selection-variant')]
          .filter(el => !el.closest('.atlas-tweaker-panel, [data-tweaker-settings], [role=dialog]'))
          .map(el => {
            const owner = el.closest(workbenchSelector) ?? el.querySelector(workbenchSelector);
            return owner ? idOf(owner) : null;
          }),
        independentOwners: independentSelectors.flatMap(selector =>
          [...main.querySelectorAll(selector)]
            .filter(
              el =>
                shown(el) &&
                !el.closest('.atlas-tweaker-panel, [data-tweaker-settings], [role=dialog]'),
            )
            .map(el => {
              const owner = el.closest(workbenchSelector) ?? el.querySelector(workbenchSelector);
              return { selector, leaf: describe(el), owner: owner ? idOf(owner) : null };
            }),
        ),
      };
    },
    [WORKBENCH, LEAF, independentLeaves.map(leaf => leaf.selector)] as const,
  );
}

function columns(page: Page) {
  return page.evaluate(() => {
    const shown = (el: Element) =>
      el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const sections = [...document.querySelectorAll('main [data-doc-section]')]
      .filter(shown)
      .map(el => {
        const rect = el.getBoundingClientRect();
        return {
          id: el.id,
          title: el.querySelector('h2')?.textContent?.trim() ?? '',
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
        };
      });
    const toc = document.querySelector(`[data-docs-shell] .page-grid > .toc[data-doc-nav='toc']`);
    const contents = document.querySelector('main details[data-doc-contents]');
    return {
      sections,
      toc:
        toc && shown(toc)
          ? { left: toc.getBoundingClientRect().left, position: getComputedStyle(toc).position }
          : null,
      contents: !!contents && shown(contents),
    };
  });
}
type Layout = Awaited<ReturnType<typeof columns>>;

function expectDesktopColumns(layout: Layout, label: string) {
  const refs = layout.sections.filter(
    section => referenceSection.test(section.id) || referenceSection.test(section.title),
  );
  const showcase = layout.sections.filter(section => !refs.includes(section));
  expect.soft(layout.sections.length, `${label}: keeps eight documentation sections`).toBe(8);
  expect
    .soft(refs.length, `${label}: API and resources form the reference column`)
    .toBeGreaterThanOrEqual(2);
  expect.soft(showcase.length, `${label}: showcase sections`).toBeGreaterThan(0);
  if (!refs.length || !showcase.length) return;
  const showcaseRight = Math.max(...showcase.map(section => section.right));
  const showcaseBottom = Math.max(...showcase.map(section => section.bottom));
  const refRight = Math.max(...refs.map(section => section.right));
  for (const section of showcase)
    expect
      .soft(
        Math.abs(section.left - showcase[0].left),
        `${label}: #${section.id} on the showcase edge`,
      )
      .toBeLessThanOrEqual(tolerancePx);
  const stack = [...refs].sort((a, b) => a.top - b.top);
  stack.forEach((section, index) => {
    expect
      .soft(section.left, `${label}: #${section.id} sits right of the showcase`)
      .toBeGreaterThanOrEqual(showcaseRight - tolerancePx);
    expect
      .soft(
        Math.abs(section.left - stack[0].left),
        `${label}: #${section.id} on the reference edge`,
      )
      .toBeLessThanOrEqual(tolerancePx);
    if (index > 0)
      expect
        .soft(section.top, `${label}: #${section.id} continues the reference stack`)
        .toBeGreaterThanOrEqual(stack[index - 1].bottom - tolerancePx);
  });
  expect
    .soft(stack[0].top, `${label}: reference column runs beside the showcase`)
    .toBeLessThan(showcaseBottom);
  expect
    .soft(Math.min(...showcase.map(section => section.width)), `${label}: readable showcase width`)
    .toBeGreaterThanOrEqual(560);
  expect
    .soft(Math.min(...refs.map(section => section.width)), `${label}: readable reference width`)
    .toBeGreaterThanOrEqual(320);
  expect.soft(layout.toc, `${label}: far-right contents rail is visible`).not.toBeNull();
  if (!layout.toc) return;
  expect
    .soft(layout.toc.left, `${label}: contents rail sits right of the reference column`)
    .toBeGreaterThanOrEqual(refRight - tolerancePx);
  expect.soft(layout.toc.position, `${label}: contents rail is sticky`).toBe('sticky');
}

function expectNarrowStack(layout: Layout, label: string) {
  expect.soft(layout.sections.length, `${label}: keeps eight documentation sections`).toBe(8);
  expect.soft(layout.contents, `${label}: Contents disclosure is visible`).toBe(true);
  const stack = [...layout.sections].sort((a, b) => a.top - b.top);
  stack.forEach((section, index) => {
    expect
      .soft(Math.abs(section.left - stack[0].left), `${label}: #${section.id} stacks on one edge`)
      .toBeLessThanOrEqual(tolerancePx);
    expect
      .soft(section.width, `${label}: #${section.id} keeps a full-width column`)
      .toBeGreaterThanOrEqual(280);
    if (index > 0)
      expect
        .soft(section.top, `${label}: #${section.id} follows the previous section`)
        .toBeGreaterThanOrEqual(stack[index - 1].bottom - tolerancePx);
  });
}

test('every component route wraps each example cluster in one preview workbench with columns', async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(600_000);
  docsService(baseURL, testInfo);
  expect(routes, 'the catalog lists 40 component routes').toHaveLength(40);
  expect(new Set(routes).size).toBe(routes.length);
  const codeRequests: string[] = [];
  page.on('request', request => {
    if (isCodeRequest(request.url())) codeRequests.push(request.url());
  });
  const owners = new Map<string, string>();
  await page.setViewportSize(wide);

  // Soft checks keep the full route table in one report.
  for (const slug of routes) {
    const label = `${slug} 1920`;
    await visit(page, slug);
    const audit = await auditWorkbenches(page);
    expect
      .soft(audit.ids.length, `${label}: examples sit in preview workbenches`)
      .toBeGreaterThan(0);
    expect.soft(audit.nested, `${label}: no nested workbenches`).toEqual([]);
    expect.soft(audit.sectionWrappers, `${label}: no route- or section-level wrapper`).toEqual([]);
    expect.soft(audit.uncovered, `${label}: every leaf example has its workbench`).toEqual([]);
    expect
      .soft(new Set(audit.ids).size, `${label}: ids are unique on the page`)
      .toBe(audit.ids.length);
    if (slug === 'badge') {
      expect
        .soft(audit.badgeOwners.length, `${label}: ten Badge groups`)
        .toBeGreaterThanOrEqual(10);
      expect.soft(audit.badgeOwners, `${label}: every Badge group is wrapped`).not.toContain(null);
      expect
        .soft(new Set(audit.badgeOwners).size, `${label}: Badge groups are wrapped individually`)
        .toBe(audit.badgeOwners.length);
    }
    if (slug === 'listy') {
      expect.soft(audit.ids.length, `${label}: 16 Listy patterns`).toBeGreaterThanOrEqual(16);
      const listyOwners = audit.listyOwners.map(entry => entry.owner);
      expect
        .soft(
          new Set(audit.listyOwners.map(entry => entry.pattern)).size,
          `${label}: 16 distinct Listy patterns`,
        )
        .toBe(16);
      expect.soft(listyOwners, `${label}: every Listy pattern is wrapped`).not.toContain(null);
      expect
        .soft(new Set(listyOwners).size, `${label}: Listy patterns are wrapped individually`)
        .toBe(16);
    }
    if (['radio', 'checkbox', 'switch'].includes(slug))
      expect
        .soft(audit.selectionOwners.length, `${label}: selection layout sections render`)
        .toBeGreaterThan(0);
    if (audit.selectionOwners.length) {
      expect
        .soft(audit.selectionOwners, `${label}: every selection layout is wrapped`)
        .not.toContain(null);
      expect
        .soft(
          new Set(audit.selectionOwners).size,
          `${label}: selection layouts are wrapped individually`,
        )
        .toBe(audit.selectionOwners.length);
    }
    // Each independent leaf owns one workbench; one owner never spans two such leaves.
    for (const leaf of independentLeaves)
      if (leaf.route === slug)
        expect
          .soft(
            audit.independentOwners.filter(entry => entry.selector === leaf.selector).length,
            `${label}: ${leaf.count} independent leaves for ${leaf.selector}`,
          )
          .toBe(leaf.count);
    expect
      .soft(
        audit.independentOwners.filter(entry => entry.owner === null).map(entry => entry.leaf),
        `${label}: every independent leaf has its own workbench`,
      )
      .toEqual([]);
    const independentIds = audit.independentOwners.map(entry => entry.owner);
    expect
      .soft(
        independentIds.filter((owner, index) => independentIds.indexOf(owner) !== index),
        `${label}: no workbench owns two independent leaves`,
      )
      .toEqual([]);

    for (const id of new Set(audit.ids)) {
      expect.soft(id, `${label}: workbench id is kebab-case`).toMatch(kebab);
      expect.soft(id.startsWith(`${slug}-`), `${label}: ${id} is prefixed by ${slug}`).toBe(true);
      const previous = owners.get(id);
      expect.soft(previous, `${label}: ${id} is globally unique`).toBeUndefined();
      owners.set(id, slug);

      const wb = workbench(page, id);
      for (const [name, labels] of controlGroups) {
        await expect
          .soft(group(wb, name), `${label} ${id}: ${name} radiogroup`)
          .toHaveCount(1, { timeout: 1_000 });
        for (const text of labels)
          await expect
            .soft(option(wb, name, text), `${label} ${id}: ${name} offers ${text}`)
            .toHaveCount(1, { timeout: 1_000 });
      }
      await expect
        .soft(option(wb, 'Device preview', 'MacBook'), `${label} ${id}: MacBook is the default`)
        .toBeChecked({ timeout: 1_000 });
      await expect
        .soft(option(wb, 'Example view', 'Preview'), `${label} ${id}: Preview is the default`)
        .toBeChecked({ timeout: 1_000 });
      await expect
        .soft(frame(wb), `${label} ${id}: MacBook frame`)
        .toHaveAttribute('data-preview-device', 'macbook', { timeout: 1_000 });
      await expect
        .soft(screen(wb), `${label} ${id}: preview screen is shown`)
        .toBeVisible({ timeout: 1_000 });

      const response = await page.request.get(codeUrl(id));
      expect.soft(response.status(), `${label} ${id}: code payload exists`).toBe(200);
      if (!response.ok()) continue;
      const payload = (await response.json()) as CodePayload;
      expect.soft(payload.id, `${label} ${id}: payload id`).toBe(id);
      expect
        .soft(String(payload.code ?? '').trim().length, `${label} ${id}: actual authored code`)
        .toBeGreaterThan(0);
      expect
        .soft(String(payload.sourcePath), `${label} ${id}: source path`)
        .toMatch(/^docs[/]src[/]react[/].+[.]tsx$/);
      expect
        .soft(String(payload.sourceUrl ?? '').length, `${label} ${id}: source link`)
        .toBeGreaterThan(0);
      expect
        .soft(String(payload.code), `${label} ${id}: no machine home prefix`)
        .not.toMatch(/[/]Users[/]|[/]home[/]/);
      expect
        .soft(String(payload.code), `${label} ${id}: authored JSX, not rendered HTML`)
        .not.toContain(' class=');
    }
    expect.soft(codeRequests, `${label}: no code request on page load`).toEqual([]);
    expectDesktopColumns(await columns(page), label);
  }

  // Representative layout geometry: Button at 1920 and 320 CSS px.
  await visit(page, 'button');
  await settle(page);
  const first = page.locator(WORKBENCH).first();
  const desktopScreen = await screen(first).evaluate(el => el.getBoundingClientRect().width);
  expect
    .soft(desktopScreen, 'MacBook screen fits its preferred width')
    .toBeLessThanOrEqual(deviceWidths.macbook + tolerancePx);
  expect.soft(await unscaled(first), 'MacBook preview is not scaled').toBe(true);
  // The first workbench wraps the playground preview and spans its whole playground row; a
  // legacy control-panel placement must not squeeze it into one of two columns.
  const playgroundSpan = await first.evaluate(el => {
    const parent = el.parentElement;
    return {
      playground: parent?.matches('.button-playground') ?? false,
      width: el.getBoundingClientRect().width,
      parent: parent?.getBoundingClientRect().width ?? 0,
    };
  });
  expect
    .soft(playgroundSpan.playground, 'first Button workbench sits in the playground')
    .toBe(true);
  expect.soft(playgroundSpan.parent, 'Button playground is painted').toBeGreaterThan(0);
  expect
    .soft(
      Math.abs(playgroundSpan.width - playgroundSpan.parent),
      'first Button workbench spans its full playground width',
    )
    .toBeLessThanOrEqual(tolerancePx);
  await shot(page, testInfo, 'button-layout-1920');

  await page.setViewportSize(narrow);
  await visit(page, 'button');
  await settle(page);
  expectNarrowStack(await columns(page), 'button 320');
  expect.soft(await pageOverflow(page), 'button 320: no page overflow').toBeLessThanOrEqual(0);
  const controls = await page
    .locator(WORKBENCH)
    .first()
    .getByRole('radio')
    .evaluateAll(radios =>
      radios.map(radio => {
        const host = radio.closest('label') ?? radio;
        const rect = host.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          font: parseFloat(getComputedStyle(host).fontSize),
          viewport: window.innerWidth,
        };
      }),
    );
  expect.soft(controls.length, 'button 320: workbench controls render').toBeGreaterThanOrEqual(7);
  for (const control of controls) {
    expect
      .soft(control.left, 'button 320: control starts inside the viewport')
      .toBeGreaterThanOrEqual(-0.5);
    expect
      .soft(control.right, 'button 320: controls wrap inside the viewport')
      .toBeLessThanOrEqual(control.viewport + 0.5);
    expect
      .soft(control.font, 'button 320: control text is at least 14px')
      .toBeGreaterThanOrEqual(14);
  }
  const narrowScreen = await screen(first).evaluate(el => ({
    right: el.getBoundingClientRect().right,
    viewport: window.innerWidth,
  }));
  expect
    .soft(narrowScreen.right, 'button 320: device screen fits the available width')
    .toBeLessThanOrEqual(narrowScreen.viewport + 0.5);
  await shot(page, testInfo, 'button-layout-320');
});

test('Button and Input workbenches keep device, shared theme, lazy code, state and keyboard focus', async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(240_000);
  docsService(baseURL, testInfo);
  const codeRequests: string[] = [];
  page.on('request', request => {
    if (isCodeRequest(request.url())) codeRequests.push(request.url());
  });
  await page.addInitScript(key => {
    if (window.sessionStorage.getItem('preview-seeded')) return;
    window.localStorage.setItem(key, 'light');
    window.sessionStorage.setItem('preview-seeded', '1');
  }, THEME_KEY);
  await page.setViewportSize(wide);
  await visit(page, 'button');
  await settle(page);
  await shot(page, testInfo, 'button-1920-before');

  const allIds = await page
    .locator(`main ${WORKBENCH}`)
    .evaluateAll(els => els.map(el => el.getAttribute('data-example-preview') ?? ''));
  expect(allIds.length, 'Button offers at least two workbenches').toBeGreaterThanOrEqual(2);
  const [idA, idB] = allIds;
  const a = workbench(page, idA);
  const b = workbench(page, idB);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  for (const wb of [a, b]) {
    await expect(option(wb, 'Device preview', 'MacBook')).toBeChecked();
    await expect(frame(wb)).toHaveAttribute('data-preview-device', 'macbook');
  }
  await page.evaluate(() => {
    (window as unknown as { previewProbe?: boolean }).previewProbe = true;
  });
  await probe(a, 'button-a');
  await probe(b, 'button-b');

  // Device memory is per group.
  await choose(option(a, 'Device preview', 'iPhone'));
  await expect(option(a, 'Device preview', 'iPhone')).toBeChecked();
  await expect(frame(a)).toHaveAttribute('data-preview-device', 'iphone');
  await expect(
    option(b, 'Device preview', 'MacBook'),
    'other group keeps its device',
  ).toBeChecked();
  await expect(frame(b)).toHaveAttribute('data-preview-device', 'macbook');
  await settle(page);
  const iphoneWidth = await screen(a).evaluate(el => el.getBoundingClientRect().width);
  expect(iphoneWidth, 'iPhone screen is painted').toBeGreaterThan(0);
  expect(iphoneWidth, 'iPhone screen fits 390px').toBeLessThanOrEqual(
    deviceWidths.iphone + tolerancePx,
  );
  expect(await unscaled(a), 'iPhone preview is not scaled').toBe(true);
  await workbenchShot(a, testInfo, 'iphone-workbench-1920');

  // Theme is the shared shell theme: every group and the header switch read the same value.
  const shellSwitch = page.getByRole('banner').getByRole('switch').first();
  await choose(option(a, 'Preview theme', 'Dark'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(shellSwitch, 'shell theme switch follows').toHaveAttribute('aria-checked', 'true');
  for (const id of allIds)
    await expect(
      option(workbench(page, id), 'Preview theme', 'Dark'),
      `${id} reads Dark`,
    ).toBeChecked();
  await expect
    .poll(() => page.evaluate(key => window.localStorage.getItem(key), THEME_KEY))
    .toBe('dark');
  await expect(option(a, 'Device preview', 'iPhone'), 'theme keeps the device').toBeChecked();
  await expect(frame(b)).toHaveAttribute('data-preview-device', 'macbook');
  await choose(option(b, 'Preview theme', 'Light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(shellSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(option(a, 'Preview theme', 'Light'), 'first group reads Light').toBeChecked();
  await expect(probed(a, 'button-a'), 'theme does not remount the first group').toHaveCount(1);
  await expect(probed(b, 'button-b'), 'theme does not remount the second group').toHaveCount(1);
  expect(await sameDocument(page), 'theme changes without reload').toBe(true);

  // Device and view owners ease on their base rules, so entering and leaving a state share the
  // central Cubic duration roles.
  expectEased(await transitionOf(frame(a)), 'device frame', geometryProperties);
  for (const property of viewProperties)
    expectEased(await transitionOf(viewStage(a)), 'preview stage', [property]);

  // Code is fetched lazily for the chosen group only and shown as escaped text.
  expect(codeRequests, 'no code request before Code is chosen').toEqual([]);
  const codeResponse = page.waitForResponse(response => isCodeFor(response.url(), idA));
  await choose(option(a, 'Example view', 'Code'));
  expect(await paneState(viewStage(a)), 'Code hides the stage from assistive tech at once').toEqual(
    {
      ariaHidden: true,
      inert: true,
    },
  );
  expect(await paneState(codePane(a)), 'Code exposes the code pane at once').toEqual({
    ariaHidden: false,
    inert: false,
  });
  const response = await codeResponse;
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as CodePayload;
  expect(payload.id).toBe(idA);
  expect(payload.code.trim().length, 'actual authored code').toBeGreaterThan(0);
  expect(payload.sourcePath).toMatch(/^docs[/]src[/]react[/].+[.]tsx$/);
  expect(codeRequests.length).toBeGreaterThan(0);
  expect(
    codeRequests.filter(url => !isCodeFor(url, idA)),
    'only the chosen group requests code',
  ).toEqual([]);
  await expect(a.getByText('Source excerpt').first()).toBeVisible();
  const code = a.locator('pre').first();
  await expect(code).toBeVisible();
  const markup = payload.code
    .split(newline)
    .map(line => line.trim())
    .find(line => line.startsWith('<') && line.length > 3);
  expect(markup, 'payload carries authored JSX').toBeTruthy();
  await expect(code, 'JSX is rendered as escaped text').toContainText(markup ?? '<');
  await expect(
    a.locator(`a[href='${payload.sourceUrl}']`).first(),
    'full source link',
  ).toBeVisible();
  await expect(a.getByText(payload.sourcePath).first(), 'source path is shown').toBeVisible();
  await expect(screen(a), 'Code hides the preview').toBeHidden();
  await expect(probed(a, 'button-a'), 'preview stays mounted under Code').toHaveCount(1);
  for (const property of viewProperties)
    expectEased(await transitionOf(codePane(a)), 'code pane', [property]);
  await choose(option(a, 'Example view', 'Preview'));
  expect(
    await a.locator('.example-preview-code-panel').count(),
    'Preview keeps the code pane mounted',
  ).toBe(1);
  expect(await paneState(viewStage(a)), 'Preview exposes the stage at once').toEqual({
    ariaHidden: false,
    inert: false,
  });
  expect(
    await paneState(codePane(a)),
    'Preview hides the code pane from assistive tech at once',
  ).toEqual({
    ariaHidden: true,
    inert: true,
  });
  await expect(screen(a)).toBeVisible();
  await expect(codePane(a), 'the inactive code pane ends hidden').toBeHidden();
  await expect(probed(a, 'button-a'), 'Preview returns the same mounted demo').toHaveCount(1);
  await expect(option(a, 'Device preview', 'iPhone'), 'view keeps the device').toBeChecked();
  // Reduced motion is the explicit instant exception; the semantic state does not change.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [name, target] of [
    ['device frame', frame(a)],
    ['preview stage', viewStage(a)],
    ['code pane', codePane(a)],
  ] as const)
    expect(
      Math.max(...(await transitionOf(target)).durations),
      `reduced motion: ${name} applies instantly`,
    ).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expectEased(
    await transitionOf(frame(a)),
    'device frame after reduced motion',
    geometryProperties,
  );

  // Keyboard: Tab enters, arrows select, the marker is visible and never a surrounding ring.
  const iphone = option(a, 'Device preview', 'iPhone');
  const ipad = option(a, 'Device preview', 'iPad');
  await iphone.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect
    .poll(() => focusedWithin(iphone), { message: 'Tab reaches the checked device' })
    .toBe(true);
  expect((await focusMarker(iphone)).ring, 'no surrounding focus ring').toBe(false);
  await page.keyboard.press('ArrowRight');
  await expect(ipad).toBeChecked();
  await expect(frame(a)).toHaveAttribute('data-preview-device', 'ipad');
  await expect(frame(b), 'arrows change only their group').toHaveAttribute(
    'data-preview-device',
    'macbook',
  );
  await expect.poll(() => focusedWithin(ipad)).toBe(true);
  await settle(page);
  // The visible cue is the central choice step on the segment label, read from the root role.
  const choiceScale = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--focus-choice-scale').trim(),
  );
  expect(choiceScale, 'central choice step is declared').not.toBe('');
  await expect
    .poll(async () => (await focusMarker(ipad)).cue, {
      message: 'keyboard focus scales the visible segment label',
    })
    .toBe(choiceScale);
  const keyboardMarker = await focusMarker(ipad);
  expect(keyboardMarker.ring, 'no surrounding focus ring after arrows').toBe(false);
  await workbenchShot(a, testInfo, 'ipad-workbench-1920');
  await choose(ipad);
  await settle(page);
  await expect
    .poll(async () => (await focusMarker(ipad)).cue, {
      message: 'pointer use drops the segment label scale',
    })
    .toMatch(/^(none|1)$/);
  const pointerMarker = await focusMarker(ipad);
  expect(pointerMarker.ring).toBe(false);
  expect(keyboardMarker.signature, 'keyboard focus shows a marker that pointer use hides').not.toBe(
    pointerMarker.signature,
  );
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect.poll(() => focusedWithin(option(a, 'Example view', 'Preview'))).toBe(true);
  expect((await focusMarker(option(a, 'Example view', 'Preview'))).ring).toBe(false);
  await page.keyboard.press('ArrowRight');
  await expect(option(a, 'Example view', 'Code')).toBeChecked();
  await expect(a.locator('pre').first()).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(option(a, 'Example view', 'Preview')).toBeChecked();
  await expect(screen(a)).toBeVisible();
  await expect(probed(a, 'button-a')).toHaveCount(1);

  // A failed code load is visible, never shown as code, and Retry (Enter) recovers.
  const pattern = `**/preview-code/${idB}.json`;
  let failures = 0;
  await page.route(pattern, route => {
    failures++;
    return route.fulfill({ status: 503, contentType: 'text/plain', body: 'unavailable' });
  });
  await choose(option(b, 'Example view', 'Code'));
  await expect(b.getByRole('alert').first(), 'failed code load is announced').toBeVisible();
  await expect(b.locator('pre'), 'no code is claimed after a failure').toHaveCount(0);
  expect(failures, 'the failure came from the code request').toBeGreaterThan(0);
  await page.unroute(pattern);
  const retry = b.getByRole('button', { name: /retry/i }).first();
  await retry.focus();
  const retried = page.waitForResponse(next => isCodeFor(next.url(), idB));
  await page.keyboard.press('Enter');
  expect((await retried).status()).toBe(200);
  await expect(b.locator('pre').first(), 'Retry shows the code').toBeVisible();
  await expect(probed(b, 'button-b'), 'failure keeps the preview mounted').toHaveCount(1);
  await choose(option(b, 'Example view', 'Preview'));
  await expect(screen(b)).toBeVisible();
  expect(await sameDocument(page), 'no reload during the Button session').toBe(true);
  await shot(page, testInfo, 'button-1920-after');

  // Input: a typed value survives device, theme, Code/Preview and a 320px resize.
  const draft = 'Preview keeps this draft';
  await visit(page, 'input');
  const field = page.locator('#input-filled');
  await field.fill(draft);
  const owner = page.locator(WORKBENCH).filter({ has: field });
  await expect(owner, 'the field belongs to one workbench').toHaveCount(1);
  await field.evaluate(el => el.setAttribute('data-remount-probe', 'input-field'));
  const kept = owner.locator(`#input-filled[data-remount-probe='input-field']`);
  await choose(option(owner, 'Device preview', 'iPad'));
  await expect(frame(owner)).toHaveAttribute('data-preview-device', 'ipad');
  await settle(page);
  expect(
    await screen(owner).evaluate(el => el.getBoundingClientRect().width),
    'iPad screen fits 820px',
  ).toBeLessThanOrEqual(deviceWidths.ipad + tolerancePx);
  await choose(option(owner, 'Preview theme', 'Dark'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await choose(option(owner, 'Example view', 'Code'));
  await expect(owner.locator('pre').first()).toBeVisible();
  await choose(option(owner, 'Example view', 'Preview'));
  await expect(field, 'value survives device, theme and view').toHaveValue(draft);
  await expect(kept, 'the field is the same element').toHaveCount(1);
  await choose(option(owner, 'Preview theme', 'Light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(field).toHaveValue(draft);

  await page.setViewportSize(narrow);
  await settle(page);
  await shot(page, testInfo, 'input-320-before');
  await expect(field, 'value survives the resize').toHaveValue(draft);
  await expect(kept).toHaveCount(1);
  expect(await pageOverflow(page), 'input 320: no page overflow').toBeLessThanOrEqual(0);
  await choose(option(owner, 'Example view', 'Code'));
  const narrowCode = owner.locator('pre').first();
  await expect(narrowCode).toBeVisible();
  expect(
    await pageOverflow(page),
    'input 320: code scrolls inside its own container',
  ).toBeLessThanOrEqual(0);
  const codeBox = await narrowCode.evaluate(el => ({
    left: el.getBoundingClientRect().left,
    right: el.getBoundingClientRect().right,
    viewport: window.innerWidth,
  }));
  expect(codeBox.left).toBeGreaterThanOrEqual(-0.5);
  expect(codeBox.right, 'input 320: code stays inside the viewport').toBeLessThanOrEqual(
    codeBox.viewport + 0.5,
  );
  await shot(page, testInfo, 'input-320-after');
  await choose(option(owner, 'Example view', 'Preview'));
  await expect(field).toHaveValue(draft);
  await expect(kept).toHaveCount(1);
});
