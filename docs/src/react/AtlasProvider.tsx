import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ConfigProvider, theme, type ThemeConfig } from 'antd';
import trTR from 'antd/locale/tr_TR.js';
import enUS from 'antd/locale/en_US.js';
import { useI18n } from './useI18n';
import { StyleProvider, px2remTransformer } from '@ant-design/cssinjs';
import atlas from '../data/atlas.json';
import motion from '../data/motion.json';
import { getThemeSnapshot, subscribeTheme, themeColors, type ThemeMode } from '../theme';
import { documentationColors } from '../data/docs-brand';
import { tweakerVariables } from '../data/tweaker';
import { selectionSizeProfiles } from '../data/selection-sizes';
import {
  docsAccessibleThemeColors,
  docsAccessibilityVariables,
  documentationStatusRoles,
} from '../data/accessibility';
import {
  docsTypography,
  docsTypographyVariables,
  approvedTypographyVariables,
} from '../data/typography';
import {
  getInputModalitySnapshot,
  getServerInputModalitySnapshot,
  subscribeInputModality,
} from '../input-modality';
import { inputSurfaceAliasVariables } from '../data/input-surfaces';
import {
  getServerThemeBuilderSnapshot,
  getThemeBuilderSnapshot,
  subscribeThemeBuilder,
} from '../theme-builder/store';
import {
  DEFAULT_RADII,
  defaultGeometryVariables,
  resolveThemeBuilder,
} from '../theme-builder/model';
import {
  AtlasSizeContext,
  AtlasSizeControl,
  type AtlasSize,
  type AtlasSizeFamily,
} from './AtlasSizeProfile';
import AtlasTweaker, { useHasTweaker } from './AtlasTweaker';
import AtlasClearIcon from './AtlasClearIcon';
import {
  AtlasAppearanceContext,
  useAtlasAppearance,
  type AtlasAppearance,
  atlasLength,
} from './AtlasAppearance';
export {
  AtlasAppearanceContext,
  useAtlasAppearance,
  type AtlasAppearance,
} from './AtlasAppearance';

const sizes = atlas.decisions.buttons.size_variants;
const primary = atlas.palettes.coral;
type ThemeBuilderResolution = ReturnType<typeof resolveThemeBuilder>;
function createAtlasTheme(
  mode: ThemeMode,
  appearance: AtlasAppearance = 'approved',
  builder?: ThemeBuilderResolution,
): ThemeConfig {
  const colors = appearance === 'docs' ? docsAccessibleThemeColors[mode] : themeColors[mode];
  // Approved appearance never consumes an applied builder recipe.
  const activeBuilder = appearance === 'docs' ? builder : undefined;
  // Builder brand roles replace the documented defaults, so the algorithm below
  // cannot force the original primary back over an applied recipe.
  const brand = activeBuilder
    ? { ...documentationColors(mode), ...activeBuilder.brand }
    : documentationColors(mode);
  const nativeAlgorithm = mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm;
  // Keep AntD derivation, then apply documented roles. Dark derivation otherwise shifts
  // the seed's resolved primary; the documentation requires its exact normal fill.
  const documentationAlgorithm = (seed: Parameters<typeof theme.defaultAlgorithm>[0]) => ({
    ...nativeAlgorithm(seed),
    ...documentationStatusRoles(mode),
    colorPrimary: brand.primary,
    colorPrimaryHover: brand.primaryHover,
    colorPrimaryActive: brand.primaryActive,
    colorPrimaryBg: brand.primaryBg,
    colorPrimaryBgHover: brand.primaryBg,
    colorPrimaryBorder: brand.primaryBorder,
    colorPrimaryBorderHover: brand.primaryBorder,
    colorPrimaryText: brand.actionInk,
    colorPrimaryTextHover: brand.accentHover,
    colorPrimaryTextActive: brand.accentActive,
    colorLink: brand.accent,
    colorLinkHover: brand.accentHover,
    colorLinkActive: brand.accentActive,
    ...activeBuilder?.token,
  });
  // Field components read the applied recipe's field roles, not the static defaults.
  const fieldBg = activeBuilder?.variables['--field-bg'] ?? colors.fieldBg;
  const fieldFilledBg =
    activeBuilder?.variables['--field-filled-bg'] ??
    activeBuilder?.variables['--field-bg'] ??
    colors.fieldFilledBg;
  const fieldHoverBg = activeBuilder?.variables['--field-hover-bg'] ?? colors.fieldHoverBg;
  const inputBackgrounds = {
    colorBgContainer: fieldBg,
    colorFillTertiary: fieldFilledBg,
    colorFillSecondary: fieldHoverBg,
    hoverBg: fieldHoverBg,
    activeBg: fieldBg,
  };
  // Recipe component roles merge into each owned component; enclosing focus props stay off.
  const builderComponents: NonNullable<ThemeConfig['components']> = activeBuilder?.components ?? {};
  const noFocusShadow = {
    activeShadow: 'none',
    errorActiveShadow: 'none',
    warningActiveShadow: 'none',
  };
  const noFocusBorder = { activeBorderColor: 'transparent', hoverBorderColor: 'transparent' };
  const fontSize = appearance === 'docs' ? docsTypography.fontSize : 16;
  const largeFontSize = appearance === 'docs' ? docsTypography.fontSizeLG : 16;
  return {
    cssVar: { key: appearance === 'docs' ? 'css-var-atlas-docs' : 'css-var-atlas' },
    ...(appearance === 'docs'
      ? { algorithm: documentationAlgorithm }
      : mode === 'dark'
        ? { algorithm: theme.darkAlgorithm }
        : {}),
    token: {
      fontFamily: docsTypography.fontFamily,
      fontFamilyCode: 'ui-monospace, SFMono-Regular, Consolas, monospace',
      fontSize,
      fontSizeSM: fontSize,
      fontSizeLG: largeFontSize,
      ...(appearance === 'docs'
        ? { lineHeight: docsTypography.lineHeight, fontWeightStrong: docsTypography.fontWeight }
        : {}),
      colorPrimary: appearance === 'docs' ? brand.primary : primary.color,
      colorPrimaryHover: appearance === 'docs' ? brand.primaryHover : primary.color,
      colorPrimaryActive: appearance === 'docs' ? brand.primaryActive : primary.dark,
      ...(appearance === 'docs'
        ? {
            colorLink: brand.accent,
            colorLinkHover: brand.accentHover,
            colorLinkActive: brand.accentActive,
          }
        : {}),
      colorText: colors.ink,
      colorTextSecondary: colors.muted,
      colorTextPlaceholder: colors.muted,
      ...(appearance === 'docs' ? { colorIcon: colors.muted, colorIconHover: colors.ink } : {}),
      colorError: colors.error,
      colorErrorText: colors.error,
      colorWarning: colors.warning,
      colorWarningText: colors.warning,
      colorSuccess: colors.success,
      colorBgContainer: colors.panel,
      colorBgElevated: colors.panel,
      colorBorder: colors.fieldBorder,
      ...(mode === 'dark' ? { colorBorderSecondary: colors.line } : {}),
      borderRadius: DEFAULT_RADII.md,
      borderRadiusSM: DEFAULT_RADII.sm,
      borderRadiusLG: DEFAULT_RADII.lg,
      controlHeightSM: sizes[0].height_px,
      controlHeight: sizes[1].height_px,
      controlHeightLG: sizes[2].height_px,
      lineWidthFocus: 0,
      controlOutlineWidth: 0,
      controlOutline: 'transparent',
      motionEaseInOut: motion.easing,
      motionEaseInOutCirc: motion.easing,
      motionEaseOutCirc: motion.easing,
      motionEaseOutBack: motion.easing,
      motionEaseInBack: motion.easing,
      motionEaseInQuint: motion.easing,
      motionEaseOutQuint: motion.easing,
      motionEaseOut: motion.easing,
      motionDurationFast: motion.durationMs.fast / 1000 + 's',
      motionDurationMid: motion.durationMs.feedback / 1000 + 's',
      motionDurationSlow: motion.durationMs.standard / 1000 + 's',
      // Recipe tokens apply last; enclosing focus outlines stay disabled.
      ...(activeBuilder
        ? {
            ...activeBuilder.token,
            lineWidthFocus: 0,
            controlOutlineWidth: 0,
            controlOutline: 'transparent',
          }
        : {}),
    },
    components: {
      Button: {
        ...(appearance === 'docs'
          ? { primaryColor: activeBuilder?.brandTones.middle.ink ?? brand.onPrimary }
          : {}),
        ...(appearance === 'docs' ? { fontWeight: docsTypography.fontWeight } : {}),
        contentFontSizeSM: fontSize,
        contentFontSize: fontSize,
        contentFontSizeLG: largeFontSize,
        paddingInlineSM: sizes[0].padding_inline_px,
        paddingInline: sizes[1].padding_inline_px,
        paddingInlineLG: sizes[2].padding_inline_px,
        ...builderComponents.Button,
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
      },
      Input: {
        ...inputBackgrounds,
        ...builderComponents.Input,
        ...noFocusShadow,
        ...noFocusBorder,
      },
      Select: {
        showArrowPaddingInlineEnd: 0,
        optionFontSize: fontSize,
        ...builderComponents.Select,
        ...noFocusBorder,
        activeOutlineColor: 'transparent',
      },
      InputNumber: {
        ...inputBackgrounds,
        inputFontSize: fontSize,
        inputFontSizeSM: fontSize,
        inputFontSizeLG: largeFontSize,
        ...builderComponents.InputNumber,
        ...noFocusShadow,
        ...noFocusBorder,
      },
      DatePicker: {
        ...inputBackgrounds,
        inputFontSize: fontSize,
        inputFontSizeSM: fontSize,
        inputFontSizeLG: largeFontSize,
        ...builderComponents.DatePicker,
        ...noFocusShadow,
        ...noFocusBorder,
      },
      Slider: { ...builderComponents.Slider, handleActiveOutlineColor: 'transparent' },
      Collapse: { headerBg: colors.surface, contentBg: colors.panel },
      Segmented: {
        trackBg: colors.fieldBg,
        trackPadding: 4,
        itemColor: colors.muted,
        itemSelectedBg: colors.panel,
        itemSelectedColor: colors.ink,
        itemHoverBg: colors.surface,
        itemHoverColor: colors.ink,
        itemActiveBg: colors.surface,
      },
      Form: { labelFontSize: fontSize, ...builderComponents.Form },
      Card: { ...builderComponents.Card },
      Table: { ...builderComponents.Table },
    },
  };
}
export const atlasTheme = createAtlasTheme('light');
const atlasDarkTheme = createAtlasTheme('dark');
export const atlasDocsTheme = createAtlasTheme('light', 'docs');
export const atlasDocsDarkTheme = createAtlasTheme('dark', 'docs');
const transformers = [px2remTransformer({ rootValue: 16 })];
const pixelTransformers: typeof transformers = [];
const subscribeNothing = () => () => {};
const hydratedSnapshot = () => true;
const hydratingSnapshot = () => false;
// Field well paint resolves from the static :root[data-theme] roles, so SSR markup, hydration
// and a theme switch never inline a mode-specific palette on the owner.
const fieldPaintVariables = inputSurfaceAliasVariables();
// Default general radius and both height families inline on every owner, so SSR markup and the
// first paint read the same roles an applied recipe later overrides.
const geometryVariables = defaultGeometryVariables();
const fieldPaintNames: ReadonlySet<string> = new Set(Object.keys(fieldPaintVariables));
// Mode-resolved field paint and the ink/muted/panel roles the aliases read. With a recipe applied
// the store writes them on the document for the current mode, so the owner inherits them instead
// of inlining a palette; field geometry (size, radius, padding, border width) stays inline.
const inheritedPaintNames: ReadonlySet<string> = new Set([
  '--ink',
  '--muted',
  '--panel',
  '--field-bg',
  '--field-filled-bg',
  '--field-hover-bg',
  '--field-border',
  '--field-inset-border',
  '--field-inner-shadow',
  '--field-inner-hover',
  '--field-disabled-bg',
  '--field-disabled-text',
  '--field-disabled-shadow',
  '--control-boundary',
  '--atlas-input-bg',
  '--atlas-input-bg-hover',
  '--atlas-input-ink',
  '--atlas-input-placeholder',
  '--atlas-input-border-color',
]);
const inheritedPaintVariables = Object.fromEntries(
  [...inheritedPaintNames].map(name => [name, 'inherit']),
) as Record<`--${string}`, string>;
// Style extraction can collect both schemes while the real island keeps light SSR markup.
export const AtlasSsrTheme = createContext<ThemeMode>('light');

export default function AtlasProvider({
  children,
  appearance: explicitAppearance,
  sizeFamily = 'component',
}: {
  children: ReactNode;
  appearance?: AtlasAppearance;
  sizeFamily?: AtlasSizeFamily;
}) {
  const { locale } = useI18n();
  const inheritedSize = useContext(AtlasSizeContext);
  const [localSize, setLocalSize] = useState<AtlasSize>('md');
  const inheritedAppearance = useAtlasAppearance();
  const appearance = explicitAppearance ?? inheritedAppearance;
  const clearIcon = <AtlasClearIcon />;
  const hasTweaker = useHasTweaker();
  const ownsTweaker = appearance === 'docs' && !hasTweaker;
  const size = ownsTweaker ? localSize : (inheritedSize ?? localSize);
  const sizeDefinition = sizes.find(item => item.value === size) ?? sizes[1];
  const selectionSizeDefinition =
    selectionSizeProfiles.find(item => item.value === size) ?? selectionSizeProfiles[1];
  const serverMode = useContext(AtlasSsrTheme);
  const mode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => serverMode);
  // Only documentation surfaces follow the applied Theme Builder recipe.
  const builderActive = appearance === 'docs';
  const builderRecipe = useSyncExternalStore(
    builderActive ? subscribeThemeBuilder : subscribeNothing,
    builderActive ? getThemeBuilderSnapshot : getServerThemeBuilderSnapshot,
    getServerThemeBuilderSnapshot,
  );
  const builder = useMemo(
    () => (builderActive && builderRecipe ? resolveThemeBuilder(builderRecipe, mode) : undefined),
    [builderActive, builderRecipe, mode],
  );
  const builderHeight = builder
    ? size === 'sm'
      ? builder.token.controlHeightSM
      : size === 'lg'
        ? builder.token.controlHeightLG
        : builder.token.controlHeight
    : undefined;
  // The store writes the applied recipe on the document for the current mode; field paint and
  // the roles it reads inherit from there, so only non-field builder roles are inlined here.
  const builderVariables = useMemo(
    () =>
      builder
        ? ({
            ...Object.fromEntries(
              Object.entries(builder.variables).filter(
                ([name]) => !fieldPaintNames.has(name) && !inheritedPaintNames.has(name),
              ),
            ),
            ...inheritedPaintVariables,
          } as Record<`--${string}`, string>)
        : undefined,
    [builder],
  );
  const sizeStyle: CSSProperties & Record<`--${string}`, string> = {
    ...(ownsTweaker ? tweakerVariables : {}),
    ...(appearance === 'docs'
      ? { ...docsTypographyVariables, ...docsAccessibilityVariables(mode) }
      : inheritedAppearance === 'docs'
        ? approvedTypographyVariables
        : {}),
    '--atlas-component-height': atlasLength(sizeDefinition.height_px, appearance),
    ...Object.fromEntries(
      selectionSizeProfiles.map(profile => [
        `--atlas-selection-height-${profile.value}`,
        atlasLength(profile.height_px, appearance),
      ]),
    ),
    '--atlas-selection-height': atlasLength(selectionSizeDefinition.height_px, appearance),
    ...geometryVariables,
    // Compact rows follow the shared size profile through the central compact roles.
    '--atlas-compact-height': `var(--size-compact-${size})`,
    ...fieldPaintVariables,
    // Applied builder variables win over the older accessibility and size defaults.
    ...builderVariables,
    ...(typeof builderHeight === 'number'
      ? { '--atlas-component-height': atlasLength(builderHeight, appearance) }
      : {}),
  };
  const builderTheme = useMemo(
    () => (builder ? createAtlasTheme(mode, 'docs', builder) : undefined),
    [builder, mode],
  );
  const selectedTheme =
    builderTheme ??
    (appearance === 'docs'
      ? mode === 'dark'
        ? atlasDocsDarkTheme
        : atlasDocsTheme
      : mode === 'dark'
        ? atlasDarkTheme
        : atlasTheme);
  const scopedTheme =
    appearance === 'approved' && inheritedAppearance === 'docs'
      ? { ...selectedTheme, inherit: false }
      : selectedTheme;
  // AntD motion is off for the hydration render only: server-rendered fields and form help
  // mount without an appear animation, while later validation and client mounts keep motion.
  const motionReady = useSyncExternalStore(subscribeNothing, hydratedSnapshot, hydratingSnapshot);
  const providerTheme = motionReady
    ? scopedTheme
    : { ...scopedTheme, token: { ...scopedTheme.token, motion: false } };
  const inputModality = useSyncExternalStore(
    subscribeInputModality,
    getInputModalitySnapshot,
    getServerInputModalitySnapshot,
  );
  return (
    <AtlasAppearanceContext.Provider value={appearance}>
      <AtlasSizeContext.Provider value={size}>
        <StyleProvider transformers={appearance === 'docs' ? pixelTransformers : transformers}>
          <ConfigProvider
            componentSize={size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'middle'}
            theme={providerTheme}
            locale={locale === 'tr' ? trTR : enUS}
            wave={{ disabled: true }}
            input={{ variant: 'filled' }}
            inputPassword={{ variant: 'filled' }}
            inputSearch={{ variant: 'filled' }}
            inputNumber={{ variant: 'filled' }}
            datePicker={appearance === 'docs' ? { clearIcon } : undefined}
            textArea={{ variant: 'filled' }}
            form={{ variant: 'filled' }}
            select={{
              variant: 'filled',
              classNames: { popup: { root: 'atlas-select-popup' } },
              ...(appearance === 'docs' ? { clearIcon } : {}),
            }}
          >
            <div
              className="atlas-demo"
              data-size-profile={size}
              style={sizeStyle}
              data-theme-mode={mode}
              data-atlas-appearance={appearance === 'docs' ? 'docs' : undefined}
              data-input-modality={inputModality}
            >
              {ownsTweaker ? (
                <AtlasTweaker
                  settings={
                    <AtlasSizeControl
                      value={size}
                      onChange={setLocalSize}
                      sizeFamily={sizeFamily}
                      vertical
                    />
                  }
                >
                  {children}
                </AtlasTweaker>
              ) : (
                children
              )}
            </div>
          </ConfigProvider>
        </StyleProvider>
      </AtlasSizeContext.Provider>
    </AtlasAppearanceContext.Provider>
  );
}
