import { expect, test, type Locator } from '@playwright/test';

test.use({ viewport: { width: 320, height: 700 } });

type Facts = Awaited<ReturnType<typeof readFacts>>;
type Layer = { inset: boolean; x: number; y: number; blur: number; spread: number; alpha: number };

const alpha = (color: string) => {
  if (!color || color === 'transparent') return 0;
  const m =
    color.match(/\/\s*([\d.]+)(%?)\s*\)$/) ??
    color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)(%?)\)$/);
  return m ? Number(m[1]) / (m[2] ? 100 : 1) : 1;
};

const layers = (value: string): Layer[] =>
  value === 'none'
    ? []
    : value.split(/,(?![^(]*\))/).map(raw => {
        const color =
          raw.match(
            /(?:rgba?|color|oklch|oklab|lab|lch|hsla?)\([^)]*\)|transparent|#[\da-f]+/i,
          )?.[0] ?? '';
        const [x = 0, y = 0, blur = 0, spread = 0] = (
          raw.replace(color, '').match(/-?[\d.]+px/g) ?? []
        ).map(parseFloat);
        return { inset: /\binset\b/.test(raw), x, y, blur, spread, alpha: alpha(color) };
      });

const key = (l: Layer) => [l.inset, l.x, l.y, l.blur, l.spread].join();
const visible = ([width, style, color]: string[]) =>
  style === 'none' || style === 'hidden' || alpha(color) === 0 ? 0 : parseFloat(width);

function readFacts(field: Locator) {
  return field.evaluate(el => {
    const s = getComputedStyle(el);
    const i = getComputedStyle(el.querySelector('input')!);
    const side = (k: string) =>
      ['width', 'style', 'color'].map(p => s.getPropertyValue(`border-${k}-${p}`));
    return {
      boxShadow: s.boxShadow,
      inputShadow: i.boxShadow,
      outline: [s.outlineStyle, s.outlineWidth],
      inputOutline: [i.outlineStyle, i.outlineWidth],
      top: side('top'),
      right: side('right'),
      bottom: side('bottom'),
      left: side('left'),
    };
  });
}

function violations(rest: Facts, now: Facts) {
  const found: string[] = [];
  const restLayers = layers(rest.boxShadow);
  const nowLayers = layers(now.boxShadow);
  const restKeys = new Set([...restLayers, ...layers(rest.inputShadow)].map(key));
  const nowKeys = new Set(nowLayers.filter(l => l.alpha > 0).map(key));
  if (nowLayers.some(l => l.inset && l.x > 0 && !l.y && !l.blur && !l.spread && l.alpha > 0))
    found.push('inset left-edge focus shadow');
  for (const side of ['top', 'right', 'left'] as const)
    if (visible(now[side]) > visible(rest[side])) found.push(`added ${side} border`);
  for (const [style, width] of [now.outline, now.inputOutline])
    if (style !== 'none' && parseFloat(width) > 0) found.push('enclosing outline');
  if (
    [...nowLayers, ...layers(now.inputShadow)].some(
      l => l.spread > 0 && l.alpha > 0 && !restKeys.has(key(l)),
    )
  )
    found.push('enclosing focus ring');
  if (restLayers.some(l => l.inset && l.alpha > 0 && !nowKeys.has(key(l))))
    found.push('resting inset shadow lost');
  const bottomChanged = visible(now.bottom) > 0 && now.bottom.join() !== rest.bottom.join();
  const bottomMarker = nowLayers.some(
    l => l.inset && !l.x && l.y < 0 && !l.blur && !l.spread && l.alpha > 0 && !restKeys.has(key(l)),
  );
  if (!bottomChanged && !bottomMarker) found.push('no visible non-enclosing focus indicator');
  return found;
}

test('password field keyboard focus marks the bottom edge without a left marker', async ({
  page,
}, testInfo) => {
  await page.goto('/components/input/');
  const input = page.locator('input#input-password:not(:disabled)').first();
  await expect(input).toBeEditable();
  const field = input.locator(
    'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " ant-input-affix-wrapper ")][1]',
  );
  await expect(field).toBeVisible();
  const rest = await readFacts(field);
  let focused: Facts | undefined;
  try {
    await input.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(input).not.toBeFocused();
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
    expect(await input.evaluate(el => el.matches(':focus-visible'))).toBe(true);
    await expect.poll(async () => violations(rest, (focused = await readFacts(field)))).toEqual([]);
  } finally {
    await testInfo.attach('input-focus-facts', {
      body: JSON.stringify({ rest, focused }, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('focused-field', {
      body: await field.screenshot(),
      contentType: 'image/png',
    });
  }
});
