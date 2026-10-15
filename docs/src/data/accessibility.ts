import { docsThemeColors, type ThemeMode } from '../theme';
import { documentationColors } from './docs-brand';

/** Documentation WCAG2.2 AA roles. Field borders flow from the central definitions through
    theme.ts; approved palettes retain their own identity. */
export const docsAccessibleThemeColors = {
  light: { ...docsThemeColors.light, success: '#206d04' },
  dark: { ...docsThemeColors.dark },
} as const;

/** Resolve status inks after native derivation; Form uses base roles, Typography uses text roles. */
export function documentationStatusRoles(mode: ThemeMode) {
  const colors = docsAccessibleThemeColors[mode];
  const brand = documentationColors(mode);
  return {
    colorError: colors.error,
    colorErrorText: colors.error,
    colorErrorTextHover: colors.error,
    colorErrorTextActive: colors.error,
    colorWarning: colors.warning,
    colorWarningText: colors.warning,
    colorWarningTextHover: colors.warning,
    colorWarningTextActive: colors.warning,
    colorSuccess: colors.success,
    colorSuccessText: colors.success,
    colorSuccessTextHover: colors.success,
    colorSuccessTextActive: colors.success,
    colorInfo: brand.actionInk,
    colorInfoText: brand.actionInk,
    colorInfoTextHover: brand.accentHover,
    colorInfoTextActive: brand.accentActive,
  };
}

export function docsAccessibilityVariables(mode: ThemeMode) {
  return {
    '--control-boundary': docsAccessibleThemeColors[mode].fieldBorder,
    '--field-border': docsAccessibleThemeColors[mode].fieldBorder,
    '--success': docsAccessibleThemeColors[mode].success,
    '--docs-placeholder-opacity': '1',
    '--docs-placeholder-active-opacity': '1',
    '--docs-placeholder-hover-opacity': '1',
    '--docs-input-underline-opacity': '1',
    '--docs-input-transition-properties':
      'background-color, border-top-color, border-right-color, border-left-color, color, opacity',
    '--selection-marker-size': '3px',
    '--selection-mark-ink': 'var(--docs-brand-on-primary)',
    '--selection-mixed-mark-ink': 'var(--ink)',
    '--switch-thumb-edge': '#141414',
    '--control-boundary-shadow': 'inset 0 0 0 1px var(--control-boundary)',
    '--switch-thumb-boundary-shadow': 'inset 0 0 0 1px var(--switch-thumb-edge)',
  };
}

export const docsAccessibilityStyleText = (['light', 'dark'] as const)
  .map(mode => {
    const owner =
      mode === 'light'
        ? `:root:not([data-theme]) body[data-atlas-surface='docs'],:root[data-theme='light'] body[data-atlas-surface='docs']`
        : `:root[data-theme='dark'] body[data-atlas-surface='docs']`;
    return `${owner}{${Object.entries(docsAccessibilityVariables(mode))
      .map(([key, value]) => `${key}:${value}`)
      .join(';')}}`;
  })
  .join('\n');
