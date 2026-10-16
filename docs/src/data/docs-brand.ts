import { generate } from '@ant-design/colors';
import { themeColors, type ThemeMode } from '../theme';
import atlas from './atlas.json';
import { contrastRatio } from './color-system';

/** Documentation identity is separate from the approved component palette catalog. */
export const DOCS_BRAND_SEED = '#0099ff';
export const docsApprovedButtonColors = Object.freeze({
  face: atlas.palettes.coral.color,
  edge: atlas.palettes.coral.dark,
  text: '#FFFFFF',
});
export const docsBrandPalette = Object.freeze(generate(DOCS_BRAND_SEED));
export const docsBrandDarkPalette = Object.freeze(
  generate(DOCS_BRAND_SEED, { theme: 'dark', backgroundColor: themeColors.dark.panel }),
);
// The exact seed stays unchanged. Text roles use the first official darker tone
// that remains readable on all light surfaces rather than darkening that seed.
const lightTextIndex = docsBrandPalette.findIndex(
  (color, index) =>
    index >= 6 &&
    [themeColors.light.paper, themeColors.light.panel, themeColors.light.surface].every(
      surface => contrastRatio(color, surface) >= 4.5,
    ),
);
const darkButtonIndex = docsBrandPalette.findIndex(
  (color, index) => index >= 6 && contrastRatio(color, '#FFFFFF') >= 4.5,
);
export const docsBrandTones = Object.freeze({
  middle: Object.freeze({
    color: DOCS_BRAND_SEED,
    dark: docsBrandPalette[6]!,
    tint: docsBrandPalette[0]!,
    ink: '#000000',
  }),
  dark: Object.freeze({
    color: docsBrandPalette[darkButtonIndex]!,
    dark: docsBrandPalette[Math.min(darkButtonIndex + 1, 9)]!,
    tint: docsBrandPalette[0]!,
    ink: '#FFFFFF',
  }),
  light: Object.freeze({
    color: docsBrandPalette[3]!,
    dark: docsBrandPalette[4]!,
    tint: docsBrandPalette[0]!,
    ink: '#000000',
  }),
  pastel: Object.freeze({
    color: docsBrandPalette[0]!,
    dark: docsBrandPalette[1]!,
    tint: docsBrandPalette[0]!,
    ink: '#000000',
  }),
});
export const docsBrandColors = Object.freeze({
  light: Object.freeze({
    primary: DOCS_BRAND_SEED,
    primaryHover: docsBrandPalette[4]!,
    primaryActive: DOCS_BRAND_SEED,
    primaryEdge: docsBrandPalette[6]!,
    onPrimary: '#000000',
    accent: docsBrandPalette[lightTextIndex]!,
    accentHover: docsBrandPalette[Math.min(lightTextIndex + 1, 9)]!,
    accentActive: docsBrandPalette[Math.min(lightTextIndex + 2, 9)]!,
    actionInk: docsBrandPalette[lightTextIndex]!,
    soft: docsBrandPalette[0]!,
    primaryBorder: docsBrandPalette[6]!,
    primaryBg: docsBrandPalette[0]!,
  }),
  dark: Object.freeze({
    primary: DOCS_BRAND_SEED,
    primaryHover: docsBrandPalette[4]!,
    primaryActive: DOCS_BRAND_SEED,
    primaryEdge: docsBrandPalette[6]!,
    onPrimary: '#000000',
    accent: docsBrandDarkPalette[7]!,
    accentHover: docsBrandDarkPalette[8]!,
    accentActive: docsBrandDarkPalette[9]!,
    actionInk: docsBrandDarkPalette[7]!,
    soft: themeColors.dark.soft,
    primaryBorder: docsBrandDarkPalette[7]!,
    primaryBg: docsBrandDarkPalette[0]!,
  }),
});
const cssName = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
/** One mode's documentation brand roles and their aliases as CSS custom properties. The static
    root style text and inline docs preview owners share this single mapping. */
export function documentationVariables(mode: ThemeMode): Record<`--${string}`, string> {
  return {
    ...Object.fromEntries(
      Object.entries(docsBrandColors[mode]).map(([name, value]) => [
        `--docs-brand-${cssName(name)}`,
        value,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(docsApprovedButtonColors).map(([name, value]) => [
        `--docs-approved-button-${name}`,
        value,
      ]),
    ),
    '--accent': 'var(--docs-brand-accent)',
    '--action-ink': 'var(--docs-brand-action-ink)',
    '--primary': 'var(--docs-brand-primary)',
    '--primary-edge': 'var(--docs-brand-primary-edge)',
    '--soft': 'var(--docs-brand-soft)',
  } as Record<`--${string}`, string>;
}
export const docsBrandStyleText = (['light', 'dark'] as const)
  .map(mode => {
    const tokens = Object.entries(documentationVariables(mode))
      .map(([name, value]) => `${name}:${value}`)
      .join(';');
    return `:root[data-theme='${mode}'] body[data-atlas-surface='docs']{${tokens}}`;
  })
  .join('\n');

export function documentationColors(mode: ThemeMode) {
  return docsBrandColors[mode];
}
