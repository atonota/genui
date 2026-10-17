import { expect, test, type Page } from '@playwright/test';

// Shared field inset: light from above at ~65deg, field darker than its painted panel.
const FIELDS = ['#input-filled', '#input-password', '#input-note'];

test.use({ viewport: { width: 320, height: 720 } });

async function readFacts(page: Page) {
  return page.evaluate(async selectors => {
    const rgba = (value: string) => {
      const n = /^rgba?\(/.test(value) ? (value.match(/-?[\d.]+/g) ?? []).map(Number) : [];
      return n.length >= 3 ? { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 } : null;
    };
    const lum = (c: { r: number; g: number; b: number }) =>
      [c.r, c.g, c.b]
        .map(v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const layers = (shadow: string) =>
      shadow === 'none'
        ? []
        : shadow.split(/,(?![^(]*\))/).map(layer => {
            const color = rgba(layer.match(/rgba?\([^)]*\)/)?.[0] ?? '');
            const [x, y] = (layer.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) ?? []).map(
              parseFloat,
            );
            const dark = Boolean(color && color.a > 0 && lum(color) < 0.2);
            return { inset: /\binset\b/.test(layer), dark, x, y };
          });
    const snap = () =>
      selectors.map(sel => {
        const field = document.querySelector(sel);
        if (!field) return { sel, missing: true };
        const owner = field.closest('.ant-input-affix-wrapper') ?? field;
        const style = getComputedStyle(owner);
        let outer = owner.parentElement;
        let outerBg = null;
        while (outer && !outerBg) {
          const c = rgba(getComputedStyle(outer).backgroundColor);
          if (c && c.a > 0) outerBg = c;
          else outer = outer.parentElement;
        }
        const fieldBg = rgba(style.backgroundColor);
        return {
          sel,
          fieldLum: fieldBg && fieldBg.a > 0 ? lum(fieldBg) : null,
          outerLum: outerBg ? lum(outerBg) : null,
          outer: outer ? `${outer.tagName}.${outer.className}` : null,
          shadow: style.boxShadow,
          layers: layers(style.boxShadow),
        };
      });
    const first = JSON.stringify(snap());
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const fields = snap();
    const root = document.documentElement;
    return {
      theme: root.dataset.theme === 'dark' ? 'dark' : 'light',
      stable: !root.dataset.themePaint && first === JSON.stringify(fields),
      fields,
    };
  }, FIELDS);
}

for (const mode of ['light', 'dark'] as const) {
  test(`${mode}: field inset lights from above at ~65deg and stays darker`, async ({
    page,
  }, testInfo) => {
    await page.goto('/components/input/');
    const note = page.locator('#input-note');
    await expect(note).toBeVisible();
    const theme = () =>
      page.evaluate(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
    if ((await theme()) !== mode) await page.locator('.theme-toggle').first().click();
    await expect.poll(theme).toBe(mode);

    let facts = await readFacts(page);
    await expect.poll(async () => (facts = await readFacts(page)).stable).toBe(true);
    await testInfo.attach(`input-inset-${mode}.json`, {
      body: JSON.stringify(facts, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach(`input-inset-${mode}.png`, {
      body: await note.screenshot(),
      contentType: 'image/png',
    });

    for (const field of facts.fields) {
      expect(field.missing, `${field.sel} exists`).toBeFalsy();
      expect(field.fieldLum, `${field.sel} painted field`).not.toBeNull();
      expect(field.outerLum, `${field.sel} painted panel`).not.toBeNull();
      expect(field.fieldLum!, `${field.sel} darker than ${field.outer}`).toBeLessThan(
        field.outerLum!,
      );
      const angles = (field.layers ?? [])
        .filter(l => l.inset && l.dark && l.x > 0 && l.y > 0)
        .map(l => (Math.atan2(l.y, l.x) * 180) / Math.PI);
      expect(
        angles.some(angle => angle >= 60 && angle <= 70),
        `${field.sel} upper inner dark layer ~65deg in "${field.shadow}"`,
      ).toBe(true);
    }
  });
}

// Appended well case: the painted owner is .genux-input-frame[data-genux-input], measured at rest and on keyboard focus.
const inputWellBase = 'http://127.0.0.1:4324';
const inputWellViews = [320, 1440].flatMap(width =>
  (['dark', 'light'] as const).map(mode => ({ width, mode })),
);
const inputWellPaper = { dark: [36, 36, 36], light: [230, 226, 215] };
const inputWellField = { dark: [27, 27, 27], light: [222, 217, 204] };
const inputWellFocus = '#input-filled';
const inputWellSides = ['top', 'right', 'bottom', 'left'] as const;
const inputWellTargets = [
  { sel: '#input-filled', well: true },
  { sel: '#input-password', well: true },
  { sel: '#input-note', well: true },
  { sel: '#input-department', well: false },
  { sel: 'aside input[type="search"], [role="search"] input, input[type="search"]', well: false },
];

async function inputWellFacts(page: Page) {
  return page.evaluate(
    ({ targets, sides }) => {
      type C = { r: number; g: number; b: number; a: number; raw?: string };
      const rgba = (v: string): C => {
        // Computed colors arrive as rgb()/rgba() or, for CSS Color 4 aliases, color(srgb r g b / a)
        // whose channels are normalized 0..1; scale those to 0..255 so one numeric path serves both.
        const srgb = /^color\(srgb\s/.test(v);
        const n = srgb || /^rgba?\(/.test(v) ? (v.match(/-?[\d.]+/g) ?? []).map(Number) : [];
        if (srgb && n.length >= 3) for (let i = 0; i < 3; i++) n[i] *= 255;
        // Unparsed colors become NaN so every numeric check fails loudly instead of passing by accident.
        return n.length >= 3
          ? { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 }
          : { r: NaN, g: NaN, b: NaN, a: 1, raw: v };
      };
      const lum = (c: C) =>
        [c.r, c.g, c.b]
          .map(v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const over = (t: C, b: C): C => ({
        r: t.r * t.a + b.r * (1 - t.a),
        g: t.g * t.a + b.g * (1 - t.a),
        b: t.b * t.a + b.b * (1 - t.a),
        a: 1,
      });
      const contrast = (x: C, y: C) => {
        const [h, l] = [lum(x), lum(y)].sort((p, q) => q - p);
        return (h + 0.05) / (l + 0.05);
      };
      const edge = (cs: CSSStyleDeclaration, s: string, bg: C) => {
        const width = parseFloat(cs.getPropertyValue(`border-${s}-width`)) || 0;
        const c = rgba(cs.getPropertyValue(`border-${s}-color`));
        const alpha = width > 0 && cs.getPropertyValue(`border-${s}-style`) !== 'none' ? c.a : 0;
        return { width, alpha, contrast: alpha ? contrast(over(c, bg), bg) : 1 };
      };
      const pseudo = (el: Element, p: string, bg: C) => {
        const cs = getComputedStyle(el, p);
        const c = rgba(cs.backgroundColor);
        const drawn = cs.content !== 'none' && c.a > 0;
        return {
          content: cs.content,
          height: parseFloat(cs.height) || 0,
          width: parseFloat(cs.width) || 0,
          contrast: drawn ? contrast(over(c, bg), bg) : 1,
        };
      };
      // A valid bottom-only focus marker may be a flat background-image: one linear-gradient whose stops are
      // all the same color, no-repeat, as wide as its positioning area, 1..4px tall and placed at the bottom.
      // Anything else that paints (ring gradients, full-box images, repeats) is reported but is never a mark.
      const image = (cs: CSSStyleDeclaration, bg: C, frameW: number, frameH: number) => {
        const img = cs.backgroundImage;
        const stops =
          img === 'none' ? [] : (img.match(/(?:rgba?|color)\([^)]*\)/g) ?? []).map(rgba);
        const opaque = stops.filter(s => s.a > 0);
        const flat =
          img.startsWith('linear-gradient(') &&
          (img.match(/gradient\(/g) ?? []).length === 1 &&
          stops.length >= 2 &&
          stops.every(
            s =>
              Math.abs(s.r - stops[0].r) < 0.5 &&
              Math.abs(s.g - stops[0].g) < 0.5 &&
              Math.abs(s.b - stops[0].b) < 0.5 &&
              Math.abs(s.a - stops[0].a) < 0.01,
          );
        const inset = (p: string) => parseFloat(cs.getPropertyValue(p)) || 0;
        const trim = (side: 'left' | 'right' | 'top' | 'bottom') =>
          cs.backgroundOrigin === 'border-box'
            ? 0
            : inset(`border-${side}-width`) +
              (cs.backgroundOrigin === 'content-box' ? inset(`padding-${side}`) : 0);
        const areaW = frameW - trim('left') - trim('right');
        const areaH = frameH - trim('top') - trim('bottom');
        const px = (v: string, full: number) =>
          v === '' || v === 'auto'
            ? full
            : v.endsWith('%')
              ? (parseFloat(v) / 100) * full
              : parseFloat(v) || 0;
        const [sw = '', sh = ''] = cs.backgroundSize.split(/\s+/);
        const width = px(sw, areaW);
        const height = px(sh, areaH);
        const y = cs.backgroundPosition.split(/\s+/)[1] ?? '';
        const bottom = y === '100%' || Math.abs(px(y, areaH) - (areaH - height)) < 0.5;
        const painted = opaque.length > 0;
        const mark =
          painted &&
          flat &&
          cs.backgroundRepeat === 'no-repeat' &&
          width >= areaW - 0.5 &&
          height >= 1 &&
          height <= 4 &&
          bottom;
        return {
          image: img,
          size: cs.backgroundSize,
          position: cs.backgroundPosition,
          repeat: cs.backgroundRepeat,
          origin: cs.backgroundOrigin,
          flat,
          mark,
          height: painted ? height : 0,
          width: painted ? width : 0,
          contrast: painted ? Math.max(...opaque.map(s => contrast(over(s, bg), bg))) : 1,
        };
      };
      return {
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
        active: (document.activeElement as HTMLElement | null)?.id ?? null,
        targets: targets.map(({ sel, well }) => {
          const child = document.querySelector<HTMLElement>(sel);
          const frame =
            child?.closest<HTMLElement>('.genux-input-frame[data-genux-input]') ??
            // AntD 6 paints the Select well on .ant-select itself; .ant-select-selector no longer exists.
            (well ? null : (child?.closest<HTMLElement>('.ant-select') ?? child));
          if (!child || !frame) return { sel, well, missing: child ? 'frame owner' : 'selector' };
          const cs = getComputedStyle(frame);
          const ccs = getComputedStyle(child);
          const bg = rgba(cs.backgroundColor);
          const painted: { tag: string; color: C }[] = [];
          for (let p = frame.parentElement; p; p = p.parentElement) {
            const c = rgba(getComputedStyle(p).backgroundColor);
            if (c.a > 0) painted.push({ tag: `${p.tagName}.${p.className}`, color: c });
          }
          const ph = child.hasAttribute('placeholder')
            ? rgba(getComputedStyle(child, '::placeholder').color)
            : null;
          const r = frame.getBoundingClientRect();
          const layers = (cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/)).map(
            l => {
              const color = rgba(l.match(/(?:rgba?|color)\([^)]*\)/)?.[0] ?? l);
              const [x = 0, y = 0, blur = 0] = (
                l.replace(/(?:rgba?|color)\([^)]*\)/, '').match(/-?[\d.]+px/g) ?? []
              ).map(parseFloat);
              return {
                inset: /\binset\b/.test(l),
                x,
                y,
                blur,
                alpha: color.a,
                lum: lum(color),
                contrast: color.a ? contrast(over(color, bg), bg) : 1,
              };
            },
          );
          const sideFacts = Object.fromEntries(sides.map(s => [s, edge(cs, s, bg)])) as Record<
            (typeof sides)[number],
            ReturnType<typeof edge>
          >;
          return {
            sel,
            well,
            bg,
            bgLum: lum(bg),
            paper: painted.length ? painted[painted.length - 1].color : null,
            ancestor: painted.length ? { tag: painted[0].tag, lum: lum(painted[0].color) } : null,
            sides: sideFacts,
            shadow: cs.boxShadow,
            layers,
            outline:
              cs.outlineStyle !== 'none' && (parseFloat(cs.outlineWidth) || 0) > 0
                ? `${cs.outlineWidth} ${cs.outlineStyle}`
                : null,
            after: pseudo(frame, '::after', bg),
            before: pseudo(frame, '::before', bg),
            image: image(cs, bg, r.width, r.height),
            child: {
              bgAlpha: rgba(ccs.backgroundColor).a,
              border: Math.max(...sides.map(s => edge(ccs, s, bg).alpha * edge(ccs, s, bg).width)),
              text: contrast(over(rgba(ccs.color), bg), bg),
              placeholder: ph && ph.a > 0 ? contrast(over(ph, bg), bg) : null,
              fontSize: parseFloat(ccs.fontSize) || 0,
            },
            rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            focused: child === document.activeElement,
          };
        }),
      };
    },
    { targets: inputWellTargets, sides: inputWellSides },
  );
}

type InputWellFacts = Awaited<ReturnType<typeof inputWellFacts>>;

function inputWellJudge(
  label: string,
  mode: 'dark' | 'light',
  facts: InputWellFacts,
  rest?: InputWellFacts,
) {
  const out: string[] = [];
  const fail = (sel: string, ok: boolean, why: string) => {
    if (!ok) out.push(`${label} ${sel}: ${why}`);
  };
  const isRgb = (c: { r: number; g: number; b: number } | null, e: number[]) =>
    !!c && [c.r, c.g, c.b].every((v, i) => Math.round(v) === e[i]);
  for (const t of facts.targets) {
    if ('missing' in t) {
      out.push(`${label} ${t.sel}: MISSING ${t.missing}`);
      continue;
    }
    const quiet = (s: (typeof inputWellSides)[number]) =>
      t.sides[s].alpha <= 0.08 || t.sides[s].contrast <= 1.25;
    // Any painted background-image that is not a flat bottom marker surrounds or fills the well.
    const ring = t.image.height > 0 && !t.image.mark;
    const loud = t.layers.some(l => !l.inset && l.alpha > 0) || t.outline !== null || ring;
    const thick = (p: { height: number; contrast: number }) => p.height > 1 && p.contrast > 1.25;
    const edges = JSON.stringify(t.sides);
    const paint = `image ${t.image.image} ${t.image.size} ${t.image.position} ${t.image.repeat} ${t.image.origin}`;
    if (rest) {
      if (t.sel !== inputWellFocus) continue;
      const was = rest.targets.find(r => r.sel === t.sel);
      fail(t.sel, t.focused && facts.active === t.sel.slice(1), `activeElement is ${facts.active}`);
      fail(
        t.sel,
        !!was && !('missing' in was) && JSON.stringify(was.rect) === JSON.stringify(t.rect),
        `focus changed geometry ${JSON.stringify(t.rect)}`,
      );
      fail(
        t.sel,
        quiet('top') && quiet('left') && quiet('right') && !loud,
        `focus is not bottom-only: ${edges} "${t.shadow}" ${t.outline ?? ''} ${paint}`,
      );
      const mark =
        (t.sides.bottom.width >= 1 && t.sides.bottom.contrast >= 3) ||
        t.layers.some(l => l.inset && l.y < 0 && l.contrast >= 3) ||
        (t.after.height >= 1 &&
          t.after.height <= 4 &&
          t.after.width > 0 &&
          t.after.contrast >= 3) ||
        (t.image.mark && t.image.contrast >= 3);
      fail(
        t.sel,
        mark,
        `no bottom focus mark with contrast >= 3: ${edges}, after ${JSON.stringify(t.after)}, "${t.shadow}", ${paint} contrast ${t.image.contrast.toFixed(2)}`,
      );
      continue;
    }
    fail(
      t.sel,
      t.sides.bottom.width <= 1 &&
        !thick(t.after) &&
        !thick(t.before) &&
        !thick(t.image) &&
        !t.layers.some(l => l.inset && l.y <= -2 && l.blur === 0 && l.contrast > 1.25),
      `resting bottom stripe: ${edges}, after ${JSON.stringify(t.after)}, "${t.shadow}", ${paint}`,
    );
    if (!t.well) continue;
    fail(
      t.sel,
      isRgb(t.bg, inputWellField[mode]),
      `well background ${JSON.stringify(t.bg)} != default field ${inputWellField[mode]}`,
    );
    fail(
      t.sel,
      isRgb(t.paper, inputWellPaper[mode]),
      `page paper ${JSON.stringify(t.paper)} != ${inputWellPaper[mode]}`,
    );
    fail(
      t.sel,
      !!t.ancestor && t.bgLum < t.ancestor.lum,
      `frame not darker than ${t.ancestor?.tag}`,
    );
    fail(t.sel, inputWellSides.every(quiet), `enclosing edge at rest: ${edges}`);
    const other = Math.max(t.sides.top.width, t.sides.left.width, t.sides.right.width);
    fail(
      t.sel,
      t.sides.bottom.width === 0 || t.sides.bottom.width === other,
      `resting bottom ${t.sides.bottom.width}px != other ${other}px`,
    );
    fail(
      t.sel,
      t.layers.some(l => l.inset && l.y > 0 && l.blur > 0 && l.alpha > 0 && l.lum < 0.2),
      `no dark blurred inset layer from above in "${t.shadow}"`,
    );
    fail(
      t.sel,
      t.layers.some(l => l.inset && l.y < 0 && l.alpha > 0 && l.lum > t.bgLum),
      `no faint bottom highlight in "${t.shadow}"`,
    );
    fail(
      t.sel,
      !loud,
      `outer shadow/outline/image at rest: "${t.shadow}" ${t.outline ?? ''} ${ring ? paint : ''}`,
    );
    fail(
      t.sel,
      t.child.bgAlpha === 0 && t.child.border === 0,
      `child paints a second well: bg alpha ${t.child.bgAlpha}, border ${t.child.border}`,
    );
    fail(
      t.sel,
      t.child.text >= 4.5 && (t.child.placeholder ?? 4.5) >= 4.5 && t.child.fontSize >= 14,
      `text ${t.child.text.toFixed(2)}, placeholder ${t.child.placeholder?.toFixed(2) ?? 'n/a'}, ${t.child.fontSize}px`,
    );
  }
  return out;
}

test('input well: frame owner paints a quiet inset well at rest and a bottom-only keyboard focus mark', async ({
  browser,
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== 'chromium',
    'runs under the dedicated Chromium-only config against :4324',
  );
  test.setTimeout(120_000);
  const failures: string[] = [];
  const shot = (name: string) => {
    const file = `${process.env.GENUX_INPUT_WELL_PHASE ?? 'candidate'}-input-well-${name}.png`;
    const dir = process.env.GENUX_INPUT_WELL_EVIDENCE_DIR;
    return dir ? `${dir}/${file}` : testInfo.outputPath(file);
  };
  const settled = async (page: Page, label: string) => {
    let facts = await inputWellFacts(page);
    await expect
      .poll(
        async () => {
          await page.evaluate(
            () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
          );
          const next = await inputWellFacts(page);
          const same = JSON.stringify(next) === JSON.stringify(facts);
          facts = next;
          return same;
        },
        { message: `${label} paint settled` },
      )
      .toBe(true);
    return facts;
  };
  for (const { width, mode } of inputWellViews) {
    const label = `${width}px ${mode}`;
    const context = await browser.newContext({
      baseURL: inputWellBase,
      locale: 'en',
      colorScheme: mode,
      viewport: { width, height: 900 },
    });
    await context.addInitScript(theme => {
      localStorage.setItem('genux-theme', theme);
      localStorage.setItem('genux-locale', 'en');
    }, mode);
    const page = await context.newPage();
    await page.goto('/components/input/');
    const theme = () =>
      page.evaluate(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
    if ((await theme()) !== mode) await page.locator('.theme-toggle').first().click();
    await expect
      .poll(theme, { message: `${label} theme from localStorage genux-theme` })
      .toBe(mode);
    await page.locator(inputWellFocus).scrollIntoViewIfNeeded();
    await page.waitForFunction(sel => {
      const el = document.querySelector(sel);
      const island = el?.closest('astro-island');
      return (
        !!el &&
        !(island && island.hasAttribute('ssr')) &&
        document.fonts.status === 'loaded' &&
        !document.documentElement.dataset.themePaint
      );
    }, inputWellFocus);
    await page.mouse.move(0, 0);
    const rest = await settled(page, `${label} rest`);
    await page.screenshot({ path: shot(`${width}-${mode}-rest`) });
    await testInfo.attach(`input-well-${width}-${mode}-rest.json`, {
      body: JSON.stringify(rest, null, 2),
      contentType: 'application/json',
    });
    failures.push(...inputWellJudge(label, mode, rest));
    await page.locator(inputWellFocus).focus();
    const focus = await settled(page, `${label} focus`);
    await page.screenshot({ path: shot(`${width}-${mode}-focus`) });
    await testInfo.attach(`input-well-${width}-${mode}-focus.json`, {
      body: JSON.stringify(focus, null, 2),
      contentType: 'application/json',
    });
    failures.push(...inputWellJudge(label, mode, focus, rest));
    const invalid = page
      .locator(
        '.genux-input-frame[data-genux-input]:is([data-status="error"], :has([aria-invalid="true"]))',
      )
      .first();
    const help = page.locator('.ant-form-item-explain-error').first();
    if (
      !(await invalid.isVisible()) ||
      !(await help.isVisible()) ||
      !(await help.innerText()).trim()
    )
      failures.push(`${label}: invalid field frame or its help text is not visible`);
    if (width === 1440 && mode === 'light') {
      const nav = page.locator('.nav-search input').first();
      await page.emulateMedia({ forcedColors: 'active' });
      const forced = () =>
        nav.evaluate(el => {
          const rgb = (c: string) => {
            const m = c.match(
              /^(rgba?|color)\(\s*(?:srgb\s+)?([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?/,
            );
            if (!m) return null;
            const num = (v: string, max: number) =>
              v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / max;
            const max = m[1] === 'color' ? 1 : 255;
            const [r, g, b] = [m[2], m[3], m[4]].map(v => {
              const x = num(v, max);
              return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
            });
            return {
              lum: 0.2126 * r + 0.7152 * g + 0.0722 * b,
              a: m[5] === undefined ? 1 : num(m[5], 1),
            };
          };
          let bg: { lum: number; a: number } | null = null;
          for (let n: Element | null = el; n && !(bg && bg.a > 0); n = n.parentElement)
            bg = rgb(getComputedStyle(n).backgroundColor);
          const own = (n: Element) => {
            const s = getComputedStyle(n);
            const edge = (side: string) => {
              const w =
                s.getPropertyValue(`border-${side}-style`) === 'none'
                  ? 0
                  : parseFloat(s.getPropertyValue(`border-${side}-width`));
              const color = s.getPropertyValue(`border-${side}-color`);
              const c = rgb(color);
              const contrast =
                w > 0 && c && c.a > 0 && bg
                  ? (Math.max(c.lum, bg.lum) + 0.05) / (Math.min(c.lum, bg.lum) + 0.05)
                  : 0;
              return { w, color, contrast };
            };
            const r = n.getBoundingClientRect();
            return {
              tag: `${n.tagName.toLowerCase()}${n.classList[0] ? `.${n.classList[0]}` : ''}`,
              sides: {
                top: edge('top'),
                right: edge('right'),
                bottom: edge('bottom'),
                left: edge('left'),
              },
              outline:
                s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0
                  ? `${s.outlineStyle} ${s.outlineWidth}`
                  : null,
              outer: s.boxShadow !== 'none' && !s.boxShadow.includes('inset') ? s.boxShadow : null,
              image: s.backgroundImage,
              box: [r.x, r.y, r.width, r.height].map(Math.round),
            };
          };
          const owners = [el, el.parentElement, el.closest('.nav-search')].filter(
            (n, i, a): n is Element => !!n && a.indexOf(n) === i,
          );
          return {
            active: document.activeElement === el,
            bg: getComputedStyle(el).backgroundColor,
            owners: owners.map(own),
          };
        });
      const before = await forced();
      await nav.focus();
      const after = await forced();
      await page.screenshot({ path: shot(`${width}-${mode}-forced-colors-focus`) });
      await testInfo.attach(`input-well-${width}-${mode}-forced-colors.json`, {
        body: JSON.stringify({ before, after }, null, 2),
        contentType: 'application/json',
      });
      const cue = after.owners.find(o => {
        const b = o.sides.bottom;
        return (
          b.w >= 1 &&
          b.contrast >= 3 &&
          [o.sides.top, o.sides.left, o.sides.right].every(s => s.w !== b.w || s.color !== b.color)
        );
      });
      const loudOwner = after.owners.find(o => o.outline || o.outer);
      const moved = after.owners.some(
        (o, i) => JSON.stringify(o.box) !== JSON.stringify(before.owners[i]?.box),
      );
      if (!after.active || loudOwner || !cue || moved)
        failures.push(
          `${label} forced-colors focus: active ${after.active}, outline/outer glow ${loudOwner ? `${loudOwner.tag} ${loudOwner.outline ?? loudOwner.outer}` : 'none'}, distinct bottom cue ${cue?.tag ?? 'none'}, geometry moved ${moved}, field ${after.bg}, owners ${JSON.stringify(after.owners.map(o => [o.tag, o.sides, o.image]))}`,
        );
    }
    await context.close();
  }
  expect(
    failures,
    'input well evidence (MISSING = selector/owner absent; everything else is a paint failure)',
  ).toEqual([]);
});
