import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { init, parse } from 'es-module-lexer';

const LAB_TIMEOUT = 10_000;
const RUN_TIMEOUT = 15_000;
// Atlas card surface rendered by AtlasGenUISurface inside the session.
const GENUI_CANVAS = '.atlas-genui-runtime';
const GENUI_CARD = `${GENUI_CANVAS} .atlas-card`;
const NATIVE_X = '.ant-sender, .ant-bubble-list, .ant-prompts';

test.use({ viewport: { width: 320, height: 720 } });

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactText = (text: string) => new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`);

type Marked = HTMLElement & { __hybridIdentity?: string };

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow, 'page must not overflow horizontally').toBeLessThanOrEqual(0);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

/**
 * Production assets only the lab needs. JS is the static import closure of the lab entry and the
 * pure CSS `?url` helper modules the launch loader imports, minus non-root chunks independently
 * shared with other component pages and the host chunk that owns the dynamic launch import;
 * nothing is excluded merely because the card page delivers it. CSS is every emitted stylesheet
 * carrying a lab or runtime selector. Dynamic imports are not followed; they stay behind the
 * explicit launch boundary.
 */
async function labExclusiveAssets(testFile: string) {
  await init;
  const dist = resolve(dirname(testFile), '..', 'dist');
  const assets = join(dist, '_astro');
  const files = readdirSync(assets);
  const read = (name: string) => readFileSync(join(assets, name), 'utf8');
  const closure = (entries: string[]) => {
    const seen = new Set<string>();
    const pending = [...entries];
    for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
      if (seen.has(name) || !files.includes(name)) continue;
      seen.add(name);
      if (!name.endsWith('.js')) continue;
      // es-module-lexer 3 exposes decoded requests through static/reexport records.
      for (const item of parse(read(name))[0]) {
        if (item.type === 'static' || item.type === 'reexport-star')
          pending.push(basename(item.specifier));
      }
    }
    return seen;
  };
  const pageRefs = (html: string) =>
    html
      .split('/_astro/')
      .slice(1)
      .map(part => part.split(/[^A-Za-z0-9._-]/)[0]!);
  // Shared ownership comes from the other built component pages, never from the card page.
  const components = join(dist, 'components');
  const otherPages = readdirSync(components, { withFileTypes: true })
    .filter(item => item.isDirectory() && item.name !== 'card')
    .map(item => join(components, item.name, 'index.html'))
    .filter(path => existsSync(path));
  expect(otherPages.length, 'other component pages establish shared ownership').toBeGreaterThan(0);
  const shared = closure(otherPages.flatMap(path => pageRefs(readFileSync(path, 'utf8'))));
  // docs/src/data/card-model.ts is a source-owned, serializable presentation contract: the card
  // gallery imports CARD_PURPOSES on its own and the GenUI lab reuses the same module, so its
  // emitted card-model.<hash>.js chunk is shared even though no other component page references
  // it. Only this exact stem is shared; every other card page asset still counts as lab-owned.
  for (const name of files) if (/^card-model\.[A-Za-z0-9_-]+\.js$/.test(name)) shared.add(name);
  // Every emitted stylesheet carrying a lab or runtime selector is required.
  const css = files.filter(
    name =>
      name.endsWith('.css') &&
      ['.genui-sender', '.atlas-genui-runtime'].some(selector => read(name).includes(selector)),
  );
  // Vite `?url` helpers are pure: no import records, a default export and a literal URL of a
  // required stylesheet. The launch loader imports them, so they are required roots, never shared.
  const cssUrlModules = files.filter(name => {
    if (!name.endsWith('.js')) return false;
    const source = read(name);
    return (
      parse(source)[0].length === 0 &&
      /export *(default|[{][^}]* as default *[}])/.test(source) &&
      css.some(sheet => ['`', "'", '"'].some(q => source.includes(`${q}/_astro/${sheet}${q}`)))
    );
  });
  const entries = files.filter(
    name => name.endsWith('.js') && read(name).includes('data-hybrid-mode'),
  );
  expect(entries, 'exactly one emitted chunk renders the hybrid session').toHaveLength(1);
  const entry = entries[0]!;
  // The host dynamically imports the entry: it owns the launch boundary, not lab code.
  const hosts = files.filter(
    name =>
      name !== entry &&
      name.endsWith('.js') &&
      parse(read(name))[0].some(
        item =>
          item.type === 'dynamic' &&
          item.specifier !== undefined &&
          basename(item.specifier) === entry,
      ),
  );
  expect(hosts.length, 'the lab entry stays behind a dynamic import').toBeGreaterThan(0);
  // Required roots are never subtracted; only their other transitives may be shared or host-owned.
  const roots = [entry, ...cssUrlModules];
  return {
    entry,
    cssUrlModules,
    js: [...closure(roots)].filter(
      name => roots.includes(name) || !(shared.has(name) || hosts.includes(name)),
    ),
    css,
  };
}

async function openHybridLab(page: Page) {
  await page.goto('/components/card/');
  await page.getByRole('button', { name: 'Open GenUI lab', exact: true }).click();
  const root = page.locator('[data-genui-session]');
  await expect(root).toHaveCount(1, { timeout: LAB_TIMEOUT });
  await expect(root).toBeVisible();
  return root;
}

function modeButton(page: Page, label: string) {
  return page
    .getByRole('group', { name: 'Hybrid UI mode' })
    .getByRole('button', { name: label, exact: true });
}

async function switchMode(page: Page, label: string, value: string) {
  await modeButton(page, label).click();
  const shell = page.locator('[data-hybrid-mode]');
  await expect(shell).toHaveCount(1);
  await expect(shell).toHaveAttribute('data-hybrid-mode', value);
}

/** The intent field must be the textarea owned by the native Ant Design X Sender. */
function senderInput(page: Page) {
  return page
    .locator('.ant-sender')
    .getByRole('textbox', { name: 'Recorded request intent', exact: true });
}

async function markElement(target: Locator, token: string) {
  await target.evaluate((el, value) => {
    (el as Marked).__hybridIdentity = value;
  }, token);
}

async function readMark(target: Locator) {
  return target.evaluate(el => (el as Marked).__hybridIdentity ?? null);
}

async function readEvidence(root: Locator, term: string) {
  const value = root
    .locator('.genui-evidence-panel dt')
    .filter({ hasText: exactText(term) })
    .locator('xpath=following-sibling::dd[1]');
  await expect(value).toHaveCount(1);
  return ((await value.textContent()) ?? '').trim();
}

async function runRecord(root: Locator) {
  return {
    requestId: await readEvidence(root, 'Request identifier'),
    revision: await readEvidence(root, 'Current revision'),
    messages: await readEvidence(root, 'Native SDK messages'),
    status: ((await root.locator('.genui-run-result').textContent()) ?? '').trim(),
  };
}

interface PaintSnapshot {
  node: string;
  bottomBorder: string;
  shadow: string;
  bottomShadow: string;
  sides: string;
  outlined: boolean;
  ring: boolean;
  borderCue: boolean;
  shadowCue: boolean;
  borderAnimated: boolean;
  shadowAnimated: boolean;
}

/** Computed paint of the Sender textarea, its Atlas input frame and the Sender wrapper. */
async function senderPaint(input: Locator): Promise<PaintSnapshot[]> {
  return input.evaluate(el => {
    const isTransparent = (color: string) => {
      const compact = color.split(' ').join('');
      return (
        compact === 'transparent' ||
        (compact.startsWith('rgba(') && compact.endsWith(',0)')) ||
        compact.endsWith('/0)')
      );
    };
    const shadowLayers = (value: string) => {
      const layers: { outer: string; full: string }[] = [];
      let outer = '';
      let full = '';
      let depth = 0;
      for (const char of value === 'none' ? '' : value) {
        if (char === '(') depth += 1;
        else if (char === ')') depth -= 1;
        if (char === ',' && depth === 0) {
          layers.push({ outer, full });
          outer = '';
          full = '';
          continue;
        }
        full += char;
        if (depth === 0 && char !== ')') outer += char;
      }
      if (full.trim()) layers.push({ outer, full });
      return layers.map(({ outer: text, full: source }) => {
        const [x = 0, y = 0, blur = 0, spread = 0] = text
          .split(' ')
          .filter(token => token.endsWith('px'))
          .map(token => Number.parseFloat(token));
        return {
          x,
          y,
          blur,
          spread,
          inset: text.includes('inset'),
          source: source.trim(),
          visible: !/transparent|rgba\([^)]*,\s*0\)|\/\s*0\)/.test(source),
        };
      });
    };
    const nodes: [string, Element | null][] = [
      ['native input', el],
      ['Atlas input frame', el.closest('.atlas-input-frame')],
      ['Sender wrapper', el.closest('.ant-sender')],
    ];
    return nodes
      .filter((entry): entry is [string, Element] => entry[1] !== null)
      .map(([node, element]) => {
        const style = getComputedStyle(element);
        const shadows = shadowLayers(style.boxShadow);
        const bottomWidth = Number.parseFloat(style.borderBottomWidth) || 0;
        const topWidth = Number.parseFloat(style.borderTopWidth) || 0;
        const borderCue =
          style.borderBottomStyle !== 'none' &&
          bottomWidth > 0 &&
          !isTransparent(style.borderBottomColor) &&
          (style.borderBottomColor !== style.borderTopColor || bottomWidth > topWidth);
        // A bottom-only shadow is offset vertically, unblurred and never spread around the box.
        // Compare only those layers: blurred upper inset depth may still interpolate from hover.
        const bottomShadow = shadows
          .filter(
            layer =>
              layer.visible &&
              layer.x === 0 &&
              layer.blur === 0 &&
              layer.spread <= 0 &&
              (layer.inset ? layer.y < 0 : layer.y > 0),
          )
          .map(layer => layer.source)
          .join(', ');
        const shadowCue = bottomShadow !== '';
        const durations = style.transitionDuration
          .split(',')
          .map(value => Number.parseFloat(value) || 0);
        // Only a transition of the property that paints the cue delays its appearance.
        const transitioned = (names: string[]) =>
          style.transitionProperty.split(',').some((value, index) => {
            const duration = durations[index % durations.length] ?? 0;
            return duration > 0 && names.includes(value.trim());
          });
        return {
          node,
          bottomBorder: `${style.borderBottomStyle} ${style.borderBottomWidth} ${style.borderBottomColor}`,
          shadow: style.boxShadow,
          bottomShadow,
          // Unstyled, zero-width or transparent edges are unpainted whatever their computed color.
          sides: ['top', 'left', 'right']
            .map(side => {
              const line = style.getPropertyValue(`border-${side}-style`);
              const width = style.getPropertyValue(`border-${side}-width`);
              const color = style.getPropertyValue(`border-${side}-color`);
              return ['none', 'hidden'].includes(line) ||
                !(Number.parseFloat(width) > 0) ||
                isTransparent(color)
                ? `${side} unpainted`
                : `${side} ${line} ${width} ${color}`;
            })
            .join(' | '),
          outlined:
            style.outlineStyle !== 'none' && (Number.parseFloat(style.outlineWidth) || 0) > 0,
          ring: shadows.some(
            layer =>
              layer.visible &&
              layer.x === 0 &&
              layer.y === 0 &&
              (layer.blur > 0 || layer.spread > 0),
          ),
          borderCue,
          shadowCue,
          borderAnimated: transitioned([
            'all',
            'border',
            'border-color',
            'border-width',
            'border-bottom',
            'border-bottom-color',
            'border-bottom-width',
            'border-block-end',
            'border-block-end-color',
            'border-block-end-width',
          ]),
          shadowAnimated: transitioned(['all', 'box-shadow']),
        };
      });
  });
}

/** Composited luminance of the Sender interior, its outer painted panel and the page. */
async function senderLuminance(input: Locator) {
  return input.evaluate(el => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data] as [number, number, number, number];
    };
    const effective = (start: Element | null) => {
      const layers: [number, number, number, number][] = [];
      for (let node = start; node; node = node.parentElement) {
        const color = rgba(getComputedStyle(node).backgroundColor);
        if (color[3] > 0) layers.push(color);
        if (color[3] >= 255) break;
      }
      let base = [255, 255, 255];
      for (const [r, g, b, a] of layers.reverse()) {
        const k = a / 255;
        base = [r * k + base[0]! * (1 - k), g * k + base[1]! * (1 - k), b * k + base[2]! * (1 - k)];
      }
      const linear = (value: number) => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(base[0]!) + 0.7152 * linear(base[1]!) + 0.0722 * linear(base[2]!);
    };
    const sender = el.closest('.ant-sender');
    return {
      interior: effective(el),
      outer: effective(sender?.parentElement ?? null),
      page: effective(document.body),
    };
  });
}

async function undersizedText(scopes: Locator) {
  return scopes.evaluateAll(nodes => {
    const offenders: string[] = [];
    for (const scope of nodes) {
      for (const el of [scope, ...scope.querySelectorAll('*')]) {
        if (!el.getClientRects().length) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden') continue;
        const ownText = [...el.childNodes].some(
          node => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
        );
        const field = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
        const size = Number.parseFloat(style.fontSize);
        if ((ownText || field) && size < 14)
          offenders.push(
            `${el.tagName.toLowerCase()} ${size}px ${(el.textContent ?? '').trim().slice(0, 40)}`,
          );
      }
    }
    return offenders;
  });
}

async function undersizedButtons(buttons: Locator) {
  return buttons.evaluateAll(nodes =>
    nodes
      .map(node => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
      .filter(({ rect }) => rect.width < 47.5 || rect.height < 47.5)
      .map(
        ({ node, rect }) =>
          `${(node.getAttribute('aria-label') ?? node.textContent ?? '').trim()} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      ),
  );
}

test('mode switches keep one native Sender, runtime and recorded request without rerunning', async ({
  page,
}, testInfo) => {
  const root = await openHybridLab(page);
  await switchMode(page, 'Do + Chat', 'balanced');
  const status = root.locator('.genui-run-result');
  const scenario = page
    .locator('.ant-select')
    .filter({ has: page.getByRole('combobox', { name: 'Recorded scenario' }) });
  await expect(scenario).toContainText('Workspace cards');

  await root.getByRole('button', { name: 'Run recorded stream', exact: true }).click();
  await expect(status).toHaveAttribute('data-genui-run-status', 'success', {
    timeout: RUN_TIMEOUT,
  });
  await expect(root.locator(GENUI_CARD)).toHaveCount(3);

  // Existing SDK messages are projected through the native Bubble.List, one bubble each.
  await expect(page.locator('.ant-bubble-list')).toHaveCount(1);
  await expect(root.locator('.ant-bubble-list')).toHaveCount(1);
  const messageCount = Number(await readEvidence(root, 'Native SDK messages'));
  expect(messageCount).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.ant-bubble-list .ant-bubble')).toHaveCount(messageCount);

  const intent = senderInput(page);
  await expect(intent).toHaveCount(1);
  const draft = 'Compare overdue orders by region before the review.';
  await intent.fill(draft);
  await expect(intent).toHaveValue(draft);
  await markElement(intent, 'hybrid-sender-input');
  await markElement(root, 'hybrid-session-root');
  const before = await runRecord(root);
  expect(before.requestId).not.toBe('No request yet');

  for (const [label, value] of [
    ['Chat', 'chat'],
    ['Do', 'do'],
    ['Do + Chat', 'balanced'],
  ] as const) {
    await switchMode(page, label, value);
    await expect(intent).toHaveCount(1);
    expect(await readMark(intent), `${label} keeps the same textarea`).toBe('hybrid-sender-input');
    expect(await readMark(root), `${label} keeps the same session runtime`).toBe(
      'hybrid-session-root',
    );
    await expect(intent).toHaveValue(draft);
    await expect(page.locator('.ant-sender')).toHaveCount(1);
    await expect(page.locator('.ant-bubble-list')).toHaveCount(1);
    await expect(root.locator(GENUI_CANVAS)).toHaveCount(1);
    await expect(root.locator(GENUI_CARD)).toHaveCount(3);
    await expect(status).toHaveAttribute('data-genui-run-status', 'success');
    expect(await runRecord(root), `${label} must not start a new run`).toEqual(before);
  }
  await expectNoPageOverflow(page);
  await attachScreenshot(page, testInfo, 'hybrid-modes-320');
});

test('order review prompt prepares without running and mode switches keep review state', async ({
  page,
}, testInfo) => {
  const root = await openHybridLab(page);
  await switchMode(page, 'Do + Chat', 'balanced');
  const status = root.locator('.genui-run-result');
  const intent = senderInput(page);
  const placeholder = 'Placeholder intent before the prompt';
  await intent.fill(placeholder);

  const prompt = page
    .locator('.ant-prompts')
    .getByRole('button', { name: 'Prepare order review', exact: true });
  await expect(prompt).toHaveCount(1);
  await expect(prompt).toHaveClass(/\batlas-button\b/);
  await prompt.focus();
  await expect(prompt).toBeFocused();
  await page.keyboard.press('Enter');

  // The prompt only prepares the request: intent and scenario change, nothing runs.
  await expect(intent).toBeFocused();
  await expect(intent).not.toHaveValue(placeholder);
  await expect(intent).not.toHaveValue('');
  const scenario = page
    .locator('.ant-select')
    .filter({ has: page.getByRole('combobox', { name: 'Recorded scenario' }) });
  await expect(scenario).toContainText('Orders · query to review');
  await expect(status).toHaveAttribute('data-genui-run-status', 'idle');
  // Adjacent status paragraphs concatenate in container text, so read the summary itself.
  await expect(status.getByText('0 frames received · 0 accepted', { exact: true })).toHaveCount(1);
  expect(await readEvidence(root, 'Request identifier')).toBe('No request yet');
  const prepared = await intent.inputValue();

  await root.getByRole('button', { name: 'Run recorded stream', exact: true }).click();
  await expect(status).toHaveAttribute('data-genui-run-status', 'success', {
    timeout: RUN_TIMEOUT,
  });
  await expect(status.getByText(/^[0-9]+ frames received · 5 accepted$/)).toHaveCount(1);

  // The native label may append a required marker to the accessible name.
  const note = root.getByRole('textbox', { name: /^Order review note\b/ });
  await expect(note).toHaveCount(1);
  const noteText = 'Call the customer before releasing SO-1042.';
  await note.fill(noteText);
  await expect(note).toHaveValue(noteText);
  const row = root.getByRole('row', { name: /SO-1042/ });
  await expect(row).toHaveCount(1);
  const rowSelect = row.getByRole('checkbox').or(row.getByRole('radio'));
  await rowSelect.check();
  await expect(rowSelect).toBeChecked();
  const revision = await readEvidence(root, 'Current revision');
  const requestId = await readEvidence(root, 'Request identifier');

  for (const [label, value] of [
    ['Chat', 'chat'],
    ['Do', 'do'],
  ] as const) {
    await switchMode(page, label, value);
    await expect(note).toHaveValue(noteText);
    await expect(rowSelect).toBeChecked();
    await expect(intent).toHaveValue(prepared);
    await expect(status).toHaveAttribute('data-genui-run-status', 'success');
    await expect(status.getByText(/^[0-9]+ frames received · 5 accepted$/)).toHaveCount(1);
    expect(await readEvidence(root, 'Current revision'), `${label} keeps the revision`).toBe(
      revision,
    );
    expect(await readEvidence(root, 'Request identifier')).toBe(requestId);
  }
  await expect(note).toBeVisible();

  await expect(page.getByText('Local demo workspace', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-hybrid-mode]')).not.toContainText(
    /live model|model is connected|connected to (?:a|the) (?:live )?model|AI is (?:thinking|typing)/i,
  );
  await expectNoPageOverflow(page);
  await attachScreenshot(page, testInfo, 'hybrid-order-review-task');
});

test('native X UI mounts on launch with bottom-only focus, readable sizing and stable resize', async ({
  page,
}, testInfo) => {
  // The page fixture is a fresh context: record every request before the first navigation.
  const requested: { url: string; type: string }[] = [];
  page.on('request', request =>
    requested.push({ url: request.url(), type: request.resourceType() }),
  );
  await page.goto('/components/card/');
  const launch = page.getByRole('button', { name: 'Open GenUI lab', exact: true });
  await expect(launch).toBeVisible({ timeout: LAB_TIMEOUT });
  await expect(page.locator(NATIVE_X)).toHaveCount(0);
  // Let hydration and any eager preload settle before drawing the launch boundary.
  await page.waitForLoadState('networkidle');
  const launchIndex = requested.length;
  const lab = await labExclusiveAssets(testInfo.file);

  await launch.click();
  const root = page.locator('[data-genui-session]');
  await expect(root).toHaveCount(1, { timeout: LAB_TIMEOUT });
  await expect(page.locator('.ant-sender')).toHaveCount(1);
  await switchMode(page, 'Do + Chat', 'balanced');
  await expect(page.locator('.ant-sender')).toBeVisible();
  const preLaunch = requested.slice(0, launchIndex);
  const postLaunch = requested.slice(launchIndex);
  await testInfo.attach('requests-before-and-after-launch', {
    body: JSON.stringify({ mapped: lab, before: preLaunch, after: postLaunch }, null, 2),
    contentType: 'application/json',
  });
  const fetched = (items: typeof requested, name: string) =>
    items.some(item => new URL(item.url).pathname.endsWith(`/_astro/${name}`));
  expect(lab.js, 'the lab entry is always mapped as lab-exclusive').toContain(lab.entry);
  expect(lab.css.length, 'lab CSS is emitted apart from the card page').toBeGreaterThan(0);
  for (const name of [...lab.js, ...lab.css])
    expect(fetched(preLaunch, name), `${name} must not load before launch`).toBe(false);
  expect(fetched(postLaunch, lab.entry), 'launch loads the lab entry').toBe(true);
  for (const name of [...lab.js, ...lab.css])
    expect(fetched(postLaunch, name), `launch loads ${name}`).toBe(true);

  const intent = senderInput(page);
  await intent.focus();
  await expect(intent).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(intent).not.toBeFocused();
  const resting = await senderPaint(intent);
  await page.keyboard.press('Tab');
  await expect(intent).toBeFocused();
  expect(await intent.evaluate(el => el.matches(':focus-visible'))).toBe(true);
  const focused = await senderPaint(intent);
  const paintNodes = ['native input', 'Atlas input frame', 'Sender wrapper'];
  expect(resting.map(item => item.node)).toEqual(paintNodes);
  expect(focused.map(item => item.node)).toEqual(paintNodes);

  const cueOwners = focused.flatMap((paint, index) => {
    const rest = resting[index];
    const borderChanged = paint.borderCue && paint.bottomBorder !== rest?.bottomBorder;
    const shadowChanged = paint.shadowCue && paint.bottomShadow !== rest?.bottomShadow;
    if (!borderChanged && !shadowChanged) return [];
    return [
      {
        node: paint.node,
        animated:
          (borderChanged && paint.borderAnimated) || (shadowChanged && paint.shadowAnimated),
      },
    ];
  });
  expect(
    cueOwners.map(item => item.node),
    'exactly one element paints a new bottom cue',
  ).toHaveLength(1);
  expect(cueOwners[0]?.animated, 'focus cue must appear without a transition').toBe(false);
  for (const [index, paint] of focused.entries()) {
    expect(paint.outlined, `${paint.node} must not draw an outline`).toBe(false);
    expect(paint.ring, `${paint.node} must not draw a ring shadow`).toBe(false);
    expect(paint.sides, `${paint.node} top/side edges must not change on focus`).toBe(
      resting[index]?.sides,
    );
  }

  const modeGroup = page.getByRole('group', { name: 'Hybrid UI mode' });
  expect(await undersizedText(page.locator(NATIVE_X).or(modeGroup))).toEqual([]);
  expect(
    await undersizedButtons(
      page
        .locator('.ant-sender, .ant-prompts')
        .getByRole('button')
        .or(modeGroup.getByRole('button')),
    ),
  ).toEqual([]);

  const light = await senderLuminance(intent);
  expect(light.page, 'docs start in the light theme').toBeGreaterThan(0.5);
  expect(light.interior, 'Sender interior is darker than its panel (light)').toBeLessThan(
    light.outer,
  );
  await expectNoPageOverflow(page);
  await attachScreenshot(page, testInfo, 'hybrid-sender-focus-320');

  // The docs own their theme through the Dark theme switch, not prefers-color-scheme.
  const darkSwitch = page.getByRole('switch', { name: /dark theme/i });
  await expect(darkSwitch).toHaveCount(1);
  await darkSwitch.click();
  await expect(darkSwitch).toBeChecked();
  await expect
    .poll(async () => (await senderLuminance(intent)).page, { message: 'page turns dark' })
    .toBeLessThan(0.2);
  const dark = await senderLuminance(intent);
  expect(dark.interior, 'Sender interior is darker than its panel (dark)').toBeLessThan(dark.outer);
  await darkSwitch.click();
  await expect(darkSwitch).not.toBeChecked();
  await expect
    .poll(async () => (await senderLuminance(intent)).page, { message: 'page returns to light' })
    .toBeGreaterThan(0.5);

  // Generate the recorded overview once so the wide layout compares real cards.
  const status = root.locator('.genui-run-result');
  await root.getByRole('button', { name: 'Run recorded stream', exact: true }).click();
  await expect(status).toHaveAttribute('data-genui-run-status', 'success', {
    timeout: RUN_TIMEOUT,
  });
  const canvas = root.locator(GENUI_CANVAS);
  await expect(canvas).toHaveCount(1);
  await expect(root.locator(GENUI_CARD)).toHaveCount(3);

  const wideDraft = 'Wide layout keeps this unsent draft.';
  await intent.fill(wideDraft);
  await markElement(intent, 'hybrid-resize-input');
  await markElement(root, 'hybrid-resize-root');
  await markElement(canvas, 'hybrid-resize-canvas');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('[data-hybrid-mode]')).toHaveAttribute('data-hybrid-mode', 'balanced');
  expect(await readMark(intent), 'resize must not remount the Sender').toBe('hybrid-resize-input');
  expect(await readMark(root), 'resize must not remount the session').toBe('hybrid-resize-root');
  expect(await readMark(canvas), 'resize must not remount the canvas').toBe('hybrid-resize-canvas');
  await expect(intent).toHaveValue(wideDraft);
  await expect(page.locator('.ant-sender')).toHaveCount(1);
  await expect(root.locator(GENUI_CARD)).toHaveCount(3);
  await expect(status).toHaveAttribute('data-genui-run-status', 'success');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.ant-sender')).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  const senderBox = await page.locator('.ant-sender').boundingBox();
  expect(canvasBox && senderBox).toBeTruthy();
  const sideBySide =
    senderBox!.x >= canvasBox!.x + canvasBox!.width - 1 ||
    canvasBox!.x >= senderBox!.x + senderBox!.width - 1;
  expect(sideBySide, 'balanced mode shows canvas and chat panes side by side at 1440').toBe(true);
  await expectNoPageOverflow(page);
  await attachScreenshot(page, testInfo, 'hybrid-balanced-1440');
});
