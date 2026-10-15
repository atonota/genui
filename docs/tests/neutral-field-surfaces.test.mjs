// One node:test scenario. The real docs palette modules are bundled with esbuild (no mocks,
// no source-text surrogate) and checked for central, neutral, readable field surfaces.
// Against the former blue-grey sources (#eff1f4 / #232b35 / #2d3540) the aggregated
// diagnostics below fail; after the central neutral warm palette they pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
const sourcePath = relative => path.join(srcDir, relative);

async function loadDocsModules() {
  const entry = [
    ['theme', 'theme.ts'],
    ['inputSurfaces', 'data/input-surfaces.ts'],
    ['accessibility', 'data/accessibility.ts'],
    ['model', 'theme-builder/model.ts'],
    ['colorSystem', 'data/color-system.ts'],
  ]
    .map(([name, file]) => `export * as ${name} from ${JSON.stringify(sourcePath(file))};`)
    .join(' ');
  const built = await esbuild.build({
    stdin: { contents: entry, resolveDir: srcDir, loader: 'js' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    write: false,
    logLevel: 'silent',
  });
  const dir = await mkdtemp(path.join(tmpdir(), 'atlas-neutral-field-surfaces-'));
  const bundleFile = path.join(dir, 'docs-palette.mjs');
  await writeFile(bundleFile, built.outputFiles[0].text);
  try {
    return await import(pathToFileURL(bundleFile).href);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const channels = hex => {
  assert.match(String(hex), /^#[0-9a-f]{6}$/i, `${hex} must be a #rrggbb color`);
  return [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
};

/** color-system takes hex text or rgb records; use whichever form yields a finite number. */
const metric = (fn, hexToRgb, ...hexes) => {
  const direct = fn(...hexes);
  return Number.isFinite(direct) ? direct : fn(...hexes.map(hex => hexToRgb(hex)));
};

const APPROVED_DOCS_CANVAS = Object.freeze({ dark: '#242424', light: '#e6e2d7' });
const UNIT_OPACITY_VARIABLES = Object.freeze([
  '--docs-placeholder-opacity',
  '--docs-placeholder-active-opacity',
  '--docs-placeholder-hover-opacity',
  '--docs-input-underline-opacity',
]);

test('neutral warm field surfaces are central, neutral and readable (dark then light)', async () => {
  const docs = await loadDocsModules();
  const { themeColors, docsThemeColors } = docs.theme;
  const { inputSurfaces, inputSurfaceVariables } = docs.inputSurfaces;
  const { docsAccessibleThemeColors, docsAccessibilityVariables } = docs.accessibility;
  const { createDefaultRecipe, resolveThemeBuilder, tokenDefinitions } = docs.model;
  const { relativeLuminance, contrastRatio, hexToRgb } = docs.colorSystem;
  const luminance = hex => metric(relativeLuminance, hexToRgb, hex);
  const contrast = (foreground, background) =>
    metric(contrastRatio, hexToRgb, foreground, background);
  const lower = value => String(value).toLowerCase();
  const failures = [];
  const expect = (condition, message) => {
    if (!condition) failures.push(message);
  };

  for (const mode of ['dark', 'light']) {
    const tag = `[${mode}]`;
    const surface = inputSurfaces[mode];
    const colors = themeColors[mode];
    const canvas = lower(docsThemeColors[mode].paper);
    const field = lower(surface.fieldBg);
    const panel = lower(surface.surface);
    const ink = lower(colors.ink);
    const muted = lower(colors.muted);
    const border = lower(colors.fieldBorder);
    const backgrounds = [
      ['field', field],
      ['panel', panel],
      ['canvas', canvas],
    ];

    expect(
      canvas === APPROVED_DOCS_CANVAS[mode],
      `${tag} docs canvas ${canvas} must stay the approved ${APPROVED_DOCS_CANVAS[mode]}`,
    );
    expect(
      [colors.panel, colors.fieldBg, colors.fieldFilledBg, colors.fieldHoverBg]
        .map(lower)
        .join(' ') === [panel, field, field, field].join(' '),
      `${tag} theme.ts panel/field roles ${colors.panel} ${colors.fieldBg} ${colors.fieldFilledBg} ${colors.fieldHoverBg} must derive from inputSurfaces ${panel} ${field}`,
    );
    expect(
      lower(surface.text) === ink &&
        lower(surface.hint) === muted &&
        lower(surface.placeholder) === muted &&
        lower(surface.border) === border,
      `${tag} inputSurfaces text/hint/placeholder/border ${surface.text} ${surface.hint} ${surface.placeholder} ${surface.border} must match theme ink/muted/fieldBorder ${ink} ${muted} ${border}`,
    );

    for (const [name, hex] of backgrounds) {
      const [r, g, b] = channels(hex);
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (mode === 'dark') {
        expect(
          spread === 0,
          `${tag} ${name} ${hex} must be a pure grey; channel spread is ${spread}`,
        );
      } else {
        expect(
          r >= g && g >= b && spread <= 24,
          `${tag} ${name} ${hex} must be warm neutral (R >= G >= B, spread <= 24, no blue overshoot); got r${r} g${g} b${b}`,
        );
      }
    }

    expect(
      luminance(field) < luminance(canvas) && luminance(field) < luminance(panel),
      `${tag} field ${field} must be darker than canvas ${canvas} and panel ${panel}`,
    );

    for (const [role, color] of [
      ['ink', ink],
      ['muted', muted],
    ]) {
      for (const [name, hex] of backgrounds) {
        const ratio = contrast(color, hex);
        expect(
          ratio >= 4.5,
          `${tag} ${role} ${color} on ${name} ${hex} is ${ratio.toFixed(2)}:1; needs 4.5:1`,
        );
      }
    }
    const disabledText = lower(surface.disabledText);
    const disabledBg = lower(surface.disabledBg);
    const disabledRatio = contrast(disabledText, disabledBg);
    expect(
      disabledRatio >= 4.5,
      `${tag} disabled text ${disabledText} on disabled field ${disabledBg} is ${disabledRatio.toFixed(2)}:1; needs 4.5:1`,
    );
    for (const [name, hex] of backgrounds) {
      const ratio = contrast(border, hex);
      expect(
        ratio >= 3,
        `${tag} field border ${border} on ${name} ${hex} is ${ratio.toFixed(2)}:1; needs 3:1`,
      );
    }

    expect(
      lower(docsAccessibleThemeColors[mode].fieldBorder) === border,
      `${tag} docs accessibility field border ${docsAccessibleThemeColors[mode].fieldBorder} must not override the central ${border}`,
    );
    const a11y = docsAccessibilityVariables(mode);
    for (const name of UNIT_OPACITY_VARIABLES) {
      expect(
        a11y[name] === '1',
        `${tag} ${name} is ${a11y[name]}; must be 1 so placeholder and underline contrast is not diluted`,
      );
    }
    expect(
      lower(a11y['--field-border']) === border && lower(a11y['--control-boundary']) === border,
      `${tag} docs --field-border/--control-boundary ${a11y['--field-border']} ${a11y['--control-boundary']} must carry the central border ${border}`,
    );
    const atlasVariables = inputSurfaceVariables(mode);
    expect(
      atlasVariables['--atlas-input-border'] === `var(--field-border, ${surface.border})`,
      `${tag} --atlas-input-border is ${atlasVariables['--atlas-input-border']}; must alias var(--field-border, ${surface.border})`,
    );

    const expectedById = {
      field,
      panel,
      canvas,
      border,
      text: ink,
      muted,
      'disabled-bg': disabledBg,
      'disabled-text': disabledText,
    };
    const factory = createDefaultRecipe();
    const resolved = resolveThemeBuilder(factory, mode);
    for (const [id, expected] of Object.entries(expectedById)) {
      const definition = tokenDefinitions.find(candidate => candidate.id === id);
      expect(definition !== undefined, `${tag} definitions.json must define ${id}`);
      if (!definition) continue;
      expect(
        lower(definition.defaults[mode]) === expected,
        `${tag} definition ${id} default ${definition.defaults[mode]} must equal the docs palette ${expected}`,
      );
      expect(
        lower(factory[mode][id]) === expected,
        `${tag} factory recipe ${id} ${factory[mode][id]} must equal the docs palette ${expected}`,
      );
      expect(
        lower(resolved.variables[definition.css]) === expected,
        `${tag} factory variable ${definition.css} ${resolved.variables[definition.css]} must equal the docs palette ${expected}`,
      );
    }

    const customField = mode === 'dark' ? '#101010' : '#e0e0e0';
    const custom = { version: 1, light: { ...factory.light }, dark: { ...factory.dark } };
    custom[mode].field = customField;
    const fieldDefinition = tokenDefinitions.find(candidate => candidate.id === 'field');
    try {
      const customField_resolved = resolveThemeBuilder(custom, mode).variables[fieldDefinition.css];
      expect(
        lower(customField_resolved) === customField,
        `${tag} custom recipe field ${customField} must survive resolution; got ${customField_resolved}`,
      );
    } catch (error) {
      failures.push(`${tag} custom recipe field ${customField} was rejected: ${error.message}`);
    }
  }

  assert.deepStrictEqual(
    failures,
    [],
    `neutral field surface regressions (dark then light): ${failures.join(' ; ')}`,
  );
});

const WELL_SHADOW_VARIABLES = Object.freeze(['--field-inner-shadow', '--atlas-input-inner-shadow']);

test('resolved input wells reuse neutral shadow roles in both themes', async () => {
  const docs = await loadDocsModules();
  const { inputSurfaces } = docs.inputSurfaces;
  const { createDefaultRecipe, resolveThemeBuilder } = docs.model;
  const shadowRgb = css =>
    [...String(css).matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/g)].map(
      match => match.slice(1, 4).map(Number),
    );
  const isNeutral = ([r, g, b]) => r === g && g === b;
  const failures = [];
  const expect = (condition, message) => {
    if (!condition) failures.push(message);
  };

  const factory = createDefaultRecipe();
  // A valid user edit: legacy 3px corners in both themes and 20px dark body text.
  const custom = { version: 1, light: { ...factory.light }, dark: { ...factory.dark } };
  custom.light['radius-md'] = 3;
  custom.dark['radius-md'] = 3;
  custom.dark['text-body'] = 20;

  for (const mode of ['dark', 'light']) {
    const tag = `[${mode}]`;
    const canonical = inputSurfaces[mode].innerShadow;
    const canonicalRgb = shadowRgb(canonical);
    expect(
      canonicalRgb.length > 0 && canonicalRgb.every(isNeutral),
      `${tag} inputSurfaces innerShadow ${canonical} must hold neutral rgba entries`,
    );
    for (const [label, recipe] of [
      ['factory', factory],
      ['custom', custom],
    ]) {
      let variables;
      try {
        variables = resolveThemeBuilder(recipe, mode).variables;
      } catch (error) {
        failures.push(`${tag} ${label} recipe was rejected: ${error.message}`);
        continue;
      }
      for (const name of WELL_SHADOW_VARIABLES) {
        const actual = variables[name];
        expect(
          actual === canonical,
          `${tag} ${label} ${name} is ${actual}; must reuse inputSurfaces innerShadow ${canonical}`,
        );
        const actualRgb = shadowRgb(actual);
        expect(
          actualRgb.every(isNeutral) && JSON.stringify(actualRgb) === JSON.stringify(canonicalRgb),
          `${tag} ${label} ${name} rgb ${JSON.stringify(actualRgb)} must be neutral and equal ${JSON.stringify(canonicalRgb)}`,
        );
      }
      if (label === 'custom') {
        expect(
          Number.parseFloat(variables['--radius-md']) === 3,
          `${tag} custom --radius-md ${variables['--radius-md']} must keep the edited 3px`,
        );
        if (mode === 'dark')
          expect(
            variables['--font-size-body'] === '20px',
            `${tag} custom --font-size-body ${variables['--font-size-body']} must keep the edited 20px`,
          );
      }
    }
  }

  assert.deepStrictEqual(
    failures,
    [],
    `neutral input well regressions (dark then light): ${failures.join(' ; ')}`,
  );
});
