import { theme, type ThemeConfig } from 'antd';
import {
  docsAccessibleThemeColors,
  docsAccessibilityVariables,
  documentationStatusRoles,
} from './accessibility';
import { inputSurfaceVariables } from './input-surfaces';
import {
  COLOR_TOKEN_NAMES,
  contrastInk,
  convertColorSelection,
  hwbToHex,
  normalizeHue,
  type ColorSelection,
} from './color-system';

export const previewHueOffsets = [0, 60, 120, 180, 240, 300] as const;
export const colorFamilyVariableKeys = previewHueOffsets.map(
  offset => `css-var-atlas-color-family-offset-${offset}`,
);
export function colorPreviewFamilies(selection: ColorSelection) {
  const selected = convertColorSelection(selection);
  return previewHueOffsets.map((offset, index) => {
    const hue = normalizeHue(selected.h + offset);
    const seedHex = hwbToHex(hue, selected.effectiveW, selected.effectiveB);
    return {
      id: `offset-${offset}`,
      variableKey: colorFamilyVariableKeys[index]!,
      offset,
      hue,
      seedHex,
      ink: contrastInk(seedHex),
    };
  });
}
export type ColorPreviewFamily = ReturnType<typeof colorPreviewFamilies>[number];

/** One native algorithm/token contract shared by the selected seed and hue-offset samples. */
export function colorPreviewTheme(seedHex: string, mode: ColorSelection['mode'], key: string) {
  const colors = docsAccessibleThemeColors[mode];
  const algorithm = mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm;
  const calculated = theme.getDesignToken({ algorithm, token: { colorPrimary: seedHex } });
  const roles = Object.fromEntries(
    COLOR_TOKEN_NAMES.map(name => [name, calculated[name]]),
  ) as Record<(typeof COLOR_TOKEN_NAMES)[number], string>;
  const config: ThemeConfig = {
    cssVar: { key },
    algorithm: seed => ({ ...algorithm(seed), ...documentationStatusRoles(mode) }),
    token: {
      colorPrimary: seedHex,
      colorPrimaryHover: roles.colorPrimaryHover,
      colorPrimaryActive: roles.colorPrimaryActive,
      colorPrimaryBg: roles.colorPrimaryBg,
      colorPrimaryBorder: roles.colorPrimaryBorder,
      colorPrimaryText: roles.colorPrimaryText,
      colorText: colors.ink,
      colorTextSecondary: colors.muted,
      colorTextPlaceholder: colors.muted,
      colorIcon: colors.muted,
      colorIconHover: colors.ink,
      colorError: colors.error,
      colorErrorText: colors.error,
      colorWarning: colors.warning,
      colorWarningText: colors.warning,
      colorSuccess: colors.success,
      colorBgContainer: colors.panel,
      colorBgElevated: colors.panel,
      colorBorder: colors.fieldBorder,
    },
    components: {
      Input: {
        colorBgContainer: colors.fieldBg,
        activeBg: colors.fieldBg,
        hoverBg: colors.fieldHoverBg,
      },
      Select: { optionSelectedBg: roles.colorPrimaryBg, optionSelectedColor: colors.ink },
    },
  };
  const variables = {
    ...docsAccessibilityVariables(mode),
    ...inputSurfaceVariables(mode),
    '--paper': colors.paper,
    '--panel': colors.panel,
    '--surface': colors.surface,
    '--ink': colors.ink,
    '--muted': colors.muted,
    '--line': colors.line,
    '--field-bg': colors.fieldBg,
    '--field-hover-bg': colors.fieldHoverBg,
    '--field-border': colors.fieldBorder,
    '--focus-color': colors.ink,
    '--button-face': roles.colorPrimary,
    '--button-edge': roles.colorPrimaryActive,
    '--button-text': contrastInk(roles.colorPrimary),
    '--color-preview-primary': roles.colorPrimary,
    '--color-preview-hover': roles.colorPrimaryHover,
    '--color-preview-active': roles.colorPrimaryActive,
    '--color-preview-ink': contrastInk(roles.colorPrimary),
    '--color-preview-hover-ink': contrastInk(roles.colorPrimaryHover),
    '--color-preview-active-ink': contrastInk(roles.colorPrimaryActive),
    '--switch-thumb-edge': contrastInk(roles.colorPrimary),
    '--selection-mark-ink': contrastInk(roles.colorPrimary),
  };
  return { config, roles, variables };
}
