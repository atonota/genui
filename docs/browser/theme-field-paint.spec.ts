import { test, expect, type Page, type TestInfo } from '@playwright/test';

/**
 * P0-A red control: themed field paint is atomic with the root theme.
 *
 * Both tests observe real Chromium rAF frames from a context init script, so the first
 * measurement happens before the first paint and before SSR hydration. Only the field
 * palette is sampled (well fill, ink, functional bottom edge, inset well shadow).
 * Component motion keeps its normal Cubic profile. The user classifies theme application
 * as a general token change: the themed palette must switch in one frame and the inset
 * shadow must not tween. If a motion gate reads that as a missing transition, report the
 * conflict instead of adding an allowlist entry.
 *
 * Expected red today: the SSR provider inlines light field variables under a dark root
 * (white bottom inset alpha 0.8 instead of 0.09 until hydration), and the input frame lists
 * box-shadow in transition-property, so a theme switch tweens the well shadow.
 */

type ThemeMode = 'light' | 'dark';
const MODES: readonly ThemeMode[] = ['light', 'dark'];
const DIRECTIONS: readonly (readonly [ThemeMode, ThemeMode])[] = [
  ['light', 'dark'],
  ['dark', 'light'],
];
const THEME_TOGGLE = '[data-theme-toggle]';
/** Field paint owners on /components/input/: frame, filled Select, stepper, validation frame. */
const FIELD_SELECTORS: readonly string[] = [
  '.atlas-input-frame[data-atlas-input]',
  '.ant-select .ant-select-selector',
  '.atlas-number-stepper',
  '.atlas-input-frame[data-atlas-input]:has([aria-invalid=true])',
];
const PAINT_KEYS = ['boxShadow', 'backgroundColor', 'color', 'borderBottomColor'] as const;

type AnimationNote = Readonly<{ kind: string; target: string | null; playState: string }>;
type PaintSample = Readonly<{
  selector: string;
  boxShadow: string;
  backgroundColor: string;
  color: string;
  borderBottomColor: string;
  animations: readonly AnimationNote[];
}>;
type Frame = Readonly<{
  index: number;
  t: number;
  readyState: string;
  rootTheme: string | null;
  rootPaint: string | null;
  ssrPending: boolean;
  demoMode: string | null;
  inlineInnerShadow: string | null;
  first: PaintSample | null;
  fields: readonly PaintSample[];
}>;
type Recorder = { frames: Frame[]; sample: () => Frame; stop: () => void };

declare global {
  interface Window {
    __atlasFieldPaint: Recorder;
  }
}

/** Runs at document start in every page of the context; it cannot see the outer scope. */
function installRecorder({ mode, selectors }: { mode: ThemeMode; selectors: readonly string[] }) {
  try {
    window.localStorage.setItem('atlas-theme', mode);
  } catch {
    // The page bootstrap falls back to prefers-color-scheme; the tests assert the root theme.
  }
  const frames: Frame[] = [];
  let running = true;
  const note = (animation: Animation): AnimationNote => ({
    kind: animation.constructor.name,
    target:
      'transitionProperty' in animation
        ? String((animation as CSSTransition).transitionProperty)
        : 'animationName' in animation
          ? String((animation as CSSAnimation).animationName)
          : null,
    playState: animation.playState,
  });
  const read = (selector: string, element: Element): PaintSample => {
    const style = getComputedStyle(element);
    return {
      selector,
      boxShadow: style.boxShadow,
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderBottomColor: style.borderBottomColor,
      animations: element.getAnimations({ subtree: true }).map(note),
    };
  };
  const sample = (): Frame => {
    const root = document.documentElement as HTMLElement | null;
    const first = document.querySelector(selectors.join(','));
    const demo = first?.closest<HTMLElement>('.atlas-demo') ?? null;
    const frame: Frame = {
      index: frames.length,
      t: performance.now(),
      readyState: document.readyState,
      rootTheme: root?.dataset.theme ?? null,
      rootPaint: root?.dataset.themePaint ?? null,
      ssrPending: document.querySelector('astro-island[ssr]') !== null,
      demoMode: demo?.dataset.themeMode ?? null,
      inlineInnerShadow: demo?.style.getPropertyValue('--atlas-input-inner-shadow') || null,
      first: first
        ? read(selectors.find(selector => first.matches(selector)) ?? 'unknown', first)
        : null,
      fields: selectors.flatMap(selector => {
        const element = document.querySelector(selector);
        return element ? [read(selector, element)] : [];
      }),
    };
    frames.push(frame);
    return frame;
  };
  const loop = () => {
    if (!running) return;
    sample();
    window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
  window.__atlasFieldPaint = {
    frames,
    sample,
    stop: () => {
      running = false;
    },
  };
}

const pageUrl = (testInfo: TestInfo): string =>
  new URL('/components/input/', testInfo.project.use.baseURL ?? 'http://127.0.0.1:4324').toString();

const attachJson = (testInfo: TestInfo, name: string, data: unknown) =>
  testInfo.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });

const attachShot = async (testInfo: TestInfo, name: string, page: Page) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });

/** Settled: at least 1 s after navigation start, document complete and every island hydrated. */
const waitForSettle = (page: Page) =>
  page.waitForFunction(
    () =>
      performance.now() >= 1000 &&
      document.readyState === 'complete' &&
      document.querySelector('astro-island[ssr]') === null,
    undefined,
    { timeout: 15_000 },
  );

/** Alpha of the white, inset, upward (negative y) shadow layer; null when none is painted. */
function whiteBottomInsetAlpha(boxShadow: string): number | null {
  if (!boxShadow || boxShadow === 'none') return null;
  for (const layer of boxShadow.split(/,(?![^(]*\))/)) {
    if (!/\binset\b/.test(layer)) continue;
    const color = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(layer);
    if (!color) continue;
    if ([color[1], color[2], color[3]].some(channel => Number(channel) < 250)) continue;
    const lengths = layer
      .replace(color[0], ' ')
      .replace(/\binset\b/, ' ')
      .trim()
      .split(/\s+/)
      .map(parseFloat);
    const y = lengths[1];
    if (y === undefined || !(y < 0)) continue;
    return color[4] === undefined ? 1 : Number(color[4]);
  }
  return null;
}

const paintDiff = (frame: PaintSample, settled: PaintSample) =>
  PAINT_KEYS.filter(key => frame[key] !== settled[key]);

test('reload: the first field paints its settled theme palette from the first rAF frame in light and dark', async ({
  browser,
}, testInfo) => {
  for (const mode of MODES) {
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
    await context.addInitScript(installRecorder, { mode, selectors: FIELD_SELECTORS });
    const page = await context.newPage();
    await page.goto(pageUrl(testInfo), { waitUntil: 'commit' });
    await attachShot(testInfo, `reload-${mode}-early.png`, page);
    await waitForSettle(page);
    const settled = await page.evaluate(() => {
      window.__atlasFieldPaint.stop();
      return window.__atlasFieldPaint.sample();
    });
    const frames = await page.evaluate(() => window.__atlasFieldPaint.frames);
    await attachShot(testInfo, `reload-${mode}-settled.png`, page);
    await attachJson(testInfo, `reload-${mode}-raf-sequence.json`, { settled, frames });

    expect(settled.rootTheme, `${mode}: root carries the requested theme`).toBe(mode);
    const settledFirst = settled.first;
    expect(settledFirst, `${mode}: a field exists after settle`).not.toBeNull();
    if (!settledFirst) throw new Error(`${mode}: no field after settle`);
    const painted = frames.flatMap(frame => (frame.first ? [{ frame, first: frame.first }] : []));
    expect(painted.length, `${mode}: rAF frames observed the field while loading`).toBeGreaterThan(
      0,
    );
    const mismatches = painted.flatMap(({ frame, first }) => {
      const diff = paintDiff(first, settledFirst);
      return diff.length
        ? [
            {
              index: frame.index,
              t: Math.round(frame.t),
              readyState: frame.readyState,
              rootTheme: frame.rootTheme,
              ssrPending: frame.ssrPending,
              demoMode: frame.demoMode,
              inlineInnerShadow: frame.inlineInnerShadow,
              diff: Object.fromEntries(
                diff.map(key => [key, { frame: first[key], settled: settledFirst[key] }]),
              ),
            },
          ]
        : [];
    });
    expect(
      mismatches,
      `${mode}: every rAF frame must already paint the settled ${settledFirst.selector} palette`,
    ).toEqual([]);
    const animated = frames.flatMap(frame =>
      frame.fields
        .filter(field => field.animations.length > 0)
        .map(field => ({
          index: frame.index,
          t: Math.round(frame.t),
          selector: field.selector,
          animations: field.animations,
        })),
    );
    expect(animated, `${mode}: no field may run an animation or transition while loading`).toEqual(
      [],
    );
    await context.close();
  }
});

test('theme toggle: once the root is the target theme, the field well highlight never exceeds the settled target', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  await context.addInitScript(installRecorder, {
    mode: 'light' as const,
    selectors: FIELD_SELECTORS,
  });
  const page = await context.newPage();
  await page.goto(pageUrl(testInfo), { waitUntil: 'load' });
  await waitForSettle(page);
  const toggle = page.locator(THEME_TOGGLE);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  const settledAlpha: Partial<Record<ThemeMode, { selector: string; alpha: number }>> = {};

  for (const [from, to] of DIRECTIONS) {
    const before = await page.evaluate(() => window.__atlasFieldPaint.sample());
    expect(before.rootTheme, `${from} to ${to}: starts on ${from}`).toBe(from);
    expect(before.rootPaint, `${from} to ${to}: no paint lock before the switch`).toBeNull();
    await attachShot(testInfo, `toggle-${from}-to-${to}-before.png`, page);
    const startIndex = before.index;
    await toggle.click();
    await page.waitForFunction(
      ({ to, startIndex }) => {
        const first = window.__atlasFieldPaint.frames.find(
          frame => frame.index > startIndex && frame.rootTheme === to,
        );
        return (
          first !== undefined &&
          document.documentElement.dataset.theme === to &&
          document.documentElement.dataset.themePaint === undefined &&
          document.querySelector<HTMLElement>('.atlas-demo')?.dataset.themeMode === to &&
          performance.now() - first.t >= 1000
        );
      },
      { to, startIndex },
      { timeout: 15_000 },
    );
    const settled = await page.evaluate(() => window.__atlasFieldPaint.sample());
    const frames = (await page.evaluate(() => window.__atlasFieldPaint.frames)).filter(
      frame => frame.index > startIndex,
    );
    await attachShot(testInfo, `toggle-${from}-to-${to}-after.png`, page);
    await attachJson(testInfo, `toggle-${from}-to-${to}-raf-sequence.json`, {
      before,
      settled,
      frames,
    });
    await expect(toggle).toHaveAttribute('aria-checked', String(to === 'dark'));

    const targetFrames = frames.filter(frame => frame.rootTheme === to);
    expect(
      targetFrames.length,
      `${from} to ${to}: rAF frames observed the ${to} root`,
    ).toBeGreaterThan(0);
    const targets = settled.fields.flatMap(field => {
      const alpha = whiteBottomInsetAlpha(field.boxShadow);
      return alpha === null ? [] : [{ selector: field.selector, alpha }];
    });
    expect(
      targets.length,
      `${from} to ${to}: at least one field paints a white bottom inset highlight`,
    ).toBeGreaterThan(0);
    const overshoot = targetFrames.flatMap(frame =>
      targets.flatMap(target => {
        const field = frame.fields.find(candidate => candidate.selector === target.selector);
        const alpha = field ? whiteBottomInsetAlpha(field.boxShadow) : null;
        return field && alpha !== null && alpha > target.alpha + 1e-6
          ? [
              {
                index: frame.index,
                t: Math.round(frame.t),
                rootPaint: frame.rootPaint,
                demoMode: frame.demoMode,
                selector: target.selector,
                alpha,
                target: target.alpha,
                boxShadow: field.boxShadow,
              },
            ]
          : [];
      }),
    );
    expect(
      overshoot,
      `${from} to ${to}: with the root on ${to}, the white bottom inset alpha must never exceed the settled ${to} value`,
    ).toEqual([]);
    settledAlpha[to] = targets[0];
  }

  expect(settledAlpha.light?.selector, 'both directions settled on the same field').toBe(
    settledAlpha.dark?.selector,
  );
  expect(
    settledAlpha.light?.alpha ?? 0,
    'the light well highlight is brighter than the dark one',
  ).toBeGreaterThan(settledAlpha.dark?.alpha ?? 1);
  await context.close();
});
