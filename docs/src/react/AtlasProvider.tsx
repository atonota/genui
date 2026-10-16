import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ConfigProvider, theme, type ThemeConfig } from 'antd';
import trTR from 'antd/locale/tr_TR.js';
import enUS from 'antd/locale/en_US.js';
import { useI18n } from './useI18n';
import { usePreviewContext, usePreviewTheme } from './PreviewContext';
import { StyleProvider, px2remTransformer } from '@ant-design/cssinjs';
import atlas from '../data/atlas.json';
import motion from '../data/motion.json';
import { docsThemeColors, themeColorVariables, themeColors, type ThemeMode } from '../theme';
import { documentationColors, documentationVariables } from '../data/docs-brand';
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
  registerSpatialPortal,
  subscribeInputModality,
} from '../input-modality';
import { inputSurfaceAliasVariables } from '../data/input-surfaces';
import { AtlasPortalOwner, adaptivePortalAttributes } from './AtlasPortalScope';
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
import { AdaptiveContext, useAdaptive } from './AdaptiveProvider';
import { adaptiveBreakpointTokens } from '../adaptive/policy';
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
      // Viewport breakpoints follow the shared adaptive policy in every appearance.
      ...adaptiveBreakpointTokens,
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

// Preview owners scope their variable class per example, mode and appearance: inline previews
// share the page document, so another mode or recipe must not overwrite the page's variables.
// The key derives only from stable route data, so SSR extraction and hydration agree.
function previewCssVarKey(exampleId: string, mode: ThemeMode, appearance: AtlasAppearance): string {
  const id = exampleId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = appearance === 'docs' ? 'css-var-atlas-docs' : 'css-var-atlas';
  return `${base}-preview-${id || 'example'}-${mode}`;
}

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
  // An isolated preview document owns its mode; it neither follows nor writes shared-origin
  // theme storage. Everywhere else the global theme store stays the source.
  const mode = usePreviewTheme(() => serverMode);
  const preview = usePreviewContext();
  // Only documentation surfaces follow the applied Theme Builder recipe.
  const builderActive = appearance === 'docs';
  const builderRecipe = useSyncExternalStore(
    builderActive ? subscribeThemeBuilder : subscribeNothing,
    builderActive ? getThemeBuilderSnapshot : getServerThemeBuilderSnapshot,
    getServerThemeBuilderSnapshot,
  );
  // Inside an actual preview, that example's in-memory recipe wins over the global one. The
  // focused-preview registry is never read here, so ordinary page owners stay global.
  const effectiveRecipe = preview?.recipe ?? builderRecipe;
  const builder = useMemo(
    () =>
      builderActive && effectiveRecipe ? resolveThemeBuilder(effectiveRecipe, mode) : undefined,
    [builderActive, effectiveRecipe, mode],
  );
  const builderHeight = builder
    ? size === 'sm'
      ? builder.token.controlHeightSM
      : size === 'lg'
        ? builder.token.controlHeightLG
        : builder.token.controlHeight
    : undefined;
  // An inline preview shares the page document but renders its own mode, so it paints that mode's
  // semantic roles locally; the field aliases on this owner then resolve from them. Other owners
  // keep inheriting the static :root[data-theme] roles.
  const ownsPreviewPaint = preview !== null;
  const previewPaintVariables = useMemo(
    () =>
      ownsPreviewPaint
        ? {
            ...themeColorVariables((appearance === 'docs' ? docsThemeColors : themeColors)[mode]),
            // A docs preview also owns that mode's documentation brand roles, exactly as the root
            // docs style text declares them, so the app palette never replaces the docs identity.
            ...(appearance === 'docs' ? documentationVariables(mode) : {}),
          }
        : undefined,
    [ownsPreviewPaint, appearance, mode],
  );
  // The store writes the applied recipe on the document for the current mode; field paint and
  // the roles it reads inherit from there, so only non-field builder roles are inlined here.
  // A preview owner's mode may differ from the document, so it inlines the recipe's paint
  // resolved for its own mode instead of inheriting the host's.
  const builderVariables = useMemo(
    () =>
      builder
        ? ({
            ...Object.fromEntries(
              Object.entries(builder.variables).filter(
                ([name]) =>
                  !fieldPaintNames.has(name) &&
                  (ownsPreviewPaint || !inheritedPaintNames.has(name)),
              ),
            ),
            ...(ownsPreviewPaint ? {} : inheritedPaintVariables),
          } as Record<`--${string}`, string>)
        : undefined,
    [builder, ownsPreviewPaint],
  );
  const sizeStyle: CSSProperties & Record<`--${string}`, string> = {
    // A preview owner's local mode paint comes first; accessibility, size and builder roles below
    // keep their usual precedence over it.
    ...previewPaintVariables,
    // A preview owner also paints its own canvas and ink from those roles, so its content never
    // sits on a host canvas of the other mode; ordinary owners stay transparent and inherit.
    ...(previewPaintVariables
      ? { colorScheme: mode, backgroundColor: 'var(--paper)', color: 'var(--ink)' }
      : {}),
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
  // A preview owner keeps the exact selected theme under its own variable class; exported themes
  // stay untouched and ordinary owners keep their shared keys.
  const cssVarKey = preview ? previewCssVarKey(preview.exampleId, mode, appearance) : undefined;
  const ownedTheme = cssVarKey ? { ...scopedTheme, cssVar: { key: cssVarKey } } : scopedTheme;
  const providerTheme = motionReady
    ? ownedTheme
    : { ...ownedTheme, token: { ...ownedTheme.token, motion: false } };
  // Capabilities resolve from an outer AdaptiveProvider or the shared document store. The owner
  // re-provides that one value, so every nested consumer reads the same retained journey.
  const adaptive = useAdaptive();
  const inputModality = useSyncExternalStore(
    subscribeInputModality,
    getInputModalitySnapshot,
    getServerInputModalitySnapshot,
  );
  // One portal root per owner: native popups (Select, Dropdown, Picker, Modal, Drawer) without
  // an explicit container render into it, so they inherit this owner's roles, local mode paint
  // and adaptive surface. display: contents adds no box or containing block. A preview owner
  // keeps it beside itself inside the same-page mockup, so its popups clip, scroll and paint
  // with that screen; every other owner portals it to the body.
  // It mounts only after hydration, so SSR markup and the hydration render stay unchanged.
  // Each AdaptiveShell inside renders its own portal from this owner's descriptor instead.
  const ownerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const getPopupContainer = useCallback(
    () => portalRef.current ?? ownerRef.current?.ownerDocument.body ?? document.body,
    [],
  );
  useLayoutEffect(() => {
    const owner = ownerRef.current;
    const portal = portalRef.current;
    if (!motionReady || !owner || !portal) return;
    return registerSpatialPortal(owner, portal);
  }, [motionReady]);
  // Theme roles of this owner, its portal and the own portal of every Shell inside it; the
  // adaptive attributes follow each element's effective resolution.
  const themeAttributes = {
    'data-size-profile': size,
    'data-theme-mode': mode,
    'data-atlas-appearance': appearance === 'docs' ? 'docs' : undefined,
    'data-input-modality': inputModality,
  };
  const ownerAttributes = { ...themeAttributes, ...adaptivePortalAttributes(adaptive) };
  const portalDescriptor = {
    className: 'atlas-demo',
    style: sizeStyle,
    attributes: themeAttributes,
  };
  const portalElement =
    motionReady && typeof document !== 'undefined' ? (
      <div
        ref={portalRef}
        className="atlas-demo"
        data-atlas-portal=""
        style={{ ...sizeStyle, display: 'contents' }}
        {...ownerAttributes}
      />
    ) : null;
  const portalRoot =
    portalElement && !preview ? createPortal(portalElement, document.body) : portalElement;
  return (
    <AdaptiveContext.Provider value={adaptive}>
      <AtlasAppearanceContext.Provider value={appearance}>
        <AtlasSizeContext.Provider value={size}>
          <StyleProvider transformers={appearance === 'docs' ? pixelTransformers : transformers}>
            <ConfigProvider
              componentSize={size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'middle'}
              theme={providerTheme}
              locale={locale === 'tr' ? trTR : enUS}
              getPopupContainer={getPopupContainer}
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
              <AtlasPortalOwner descriptor={portalDescriptor} getPopupContainer={getPopupContainer}>
                <div
                  ref={ownerRef}
                  className="atlas-demo"
                  data-atlas-provider-owner=""
                  style={sizeStyle}
                  {...ownerAttributes}
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
                {portalRoot}
              </AtlasPortalOwner>
            </ConfigProvider>
          </StyleProvider>
        </AtlasSizeContext.Provider>
      </AtlasAppearanceContext.Provider>
    </AdaptiveContext.Provider>
  );
}
