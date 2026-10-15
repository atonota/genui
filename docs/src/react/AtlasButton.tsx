import { useI18n } from './useI18n';
import { useMemo, useSyncExternalStore, type CSSProperties } from 'react';
import { Button, ConfigProvider, type ButtonProps } from 'antd';
import atlas from '../data/atlas.json';
import AtlasIcon, { type AtlasIconName, type IconLibrary } from './AtlasIcon';
import { useAtlasAppearance, atlasLength } from './AtlasAppearance';
import { docsBrandTones } from '../data/docs-brand';
import { useAtlasSize } from './AtlasSizeProfile';
import { contrastRatio as contrast } from '../data/color-system';
import { paletteForeground } from '../data/button-palette';
import { buttonPresetTone } from '../data/button-palette';
import { docsAccessibleThemeColors } from '../data/accessibility';
import { getThemeSnapshot, subscribeTheme, type ThemeMode } from '../theme';
import {
  getServerThemeBuilderSnapshot,
  getThemeBuilderSnapshot,
  subscribeThemeBuilder,
} from '../theme-builder/store';
import { resolveThemeBuilder } from '../theme-builder/model';

const subscribeNothing = () => () => {};
const serverThemeMode = (): ThemeMode => 'light';

export type Palette = keyof typeof atlas.palettes;
export type Tone = keyof typeof atlas.tones.coral | 'middle';
export type ButtonDepth = '3d' | 'flat';
export type { IconLibrary } from './AtlasIcon';

const decisions = atlas.decisions.buttons;
export const buttonStates = [...decisions.state_variants, ...atlas.experiments.state_variants];

export type AtlasButtonProps = Omit<
  ButtonProps,
  | 'size'
  | 'icon'
  | 'iconPlacement'
  | 'iconPosition'
  | 'children'
  | 'type'
  | 'color'
  | 'variant'
  | 'shape'
  | 'danger'
  | 'ghost'
  | 'block'
  | 'loading'
  | 'style'
  | 'styles'
  | 'className'
  | 'classNames'
  | 'rootClassName'
  | 'prefixCls'
  | 'autoInsertSpace'
  | 'aria-busy'
  | 'aria-disabled'
> & {
  /** An approved or experimental state value; busy work uses `loading`. */
  state?: string;
  radius?: string;
  size?: string;
  width?: string;
  palette?: Palette;
  colorPreset?: string;
  tone?: Tone;
  border?: string;
  shadow?: string;
  depth?: ButtonDepth;
  library?: IconLibrary;
  icon?: string;
  position?: string;
  motion?: string;
  /** Canonical surfaces: solid | outline | tint | text | link. */
  fill?: string;
  duration?: string;
  /** Renders inside a field well; the owning frame's slot roles size it. */
  slotted?: boolean;
  /** Class a host such as Input.Search assigns to its slot action. */
  slotClassName?: string;
} & (
    | { iconOnly?: false; text?: string }
    | { iconOnly: true; icon: AtlasIconName; 'aria-label': string; text?: never }
  );

/** Action button renderer for approved states and the experimental playground. */
export default function AtlasButton({
  text,
  state = 'default',
  radius: explicitRadius,
  size,
  width = 'content',
  palette,
  colorPreset,
  tone = 'middle',
  border = 'none',
  shadow = 'none',
  depth = '3d',
  library = 'phosphor',
  icon = 'none',
  position = 'left',
  motion = 'static',
  fill = 'solid',
  duration = 'deliberate',
  iconOnly = false,
  slotted = false,
  slotClassName,
  disabled,
  ...buttonProps
}: AtlasButtonProps) {
  const { t } = useI18n();
  const appearance = useAtlasAppearance();
  const inheritedSize = useAtlasSize();
  // Only documentation surfaces follow the applied Theme Builder recipe.
  const builderActive = appearance === 'docs';
  const builderRecipe = useSyncExternalStore(
    builderActive ? subscribeThemeBuilder : subscribeNothing,
    builderActive ? getThemeBuilderSnapshot : getServerThemeBuilderSnapshot,
    getServerThemeBuilderSnapshot,
  );
  const themeMode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, serverThemeMode);
  const builder = useMemo(
    () =>
      builderActive && builderRecipe ? resolveThemeBuilder(builderRecipe, themeMode) : undefined,
    [builderActive, builderRecipe, themeMode],
  );
  const brandTones = builder?.brandTones ?? docsBrandTones;
  const builderSurfaces =
    builder && themeMode === 'light'
      ? (['--paper', '--panel', '--surface', '--field-bg'] as const)
          .map(name => builder.variables[name])
          .filter(
            (value): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
          )
      : [];

  const { componentDisabled } = ConfigProvider.useConfig();
  const interactionDisabled = disabled ?? componentDisabled;
  // Legacy call sites keep working while all public choices use sm / md / lg.
  const aliases: Record<string, string> = {
    compact: 'sm',
    normal: 'sm',
    large: 'md',
    tall: 'lg',
  };
  const requestedSize = size ?? inheritedSize;
  const dimensions =
    decisions.size_variants.find(
      item => item.value === (aliases[requestedSize] ?? requestedSize),
    ) ??
    decisions.size_variants.find(item => item.value === inheritedSize) ??
    decisions.size_variants[0]!;
  const rounding =
    decisions.radius_variants.find(item => item.value === (explicitRadius ?? '5')) ??
    decisions.radius_variants.find(item => item.value === '5')!;
  // Builder profiles only replace defaults; explicit size and radius props keep their intent.
  const builderHeight =
    builder && size === undefined
      ? dimensions.value === 'sm'
        ? builder.token.controlHeightSM
        : dimensions.value === 'lg'
          ? builder.token.controlHeightLG
          : builder.token.controlHeight
      : undefined;
  const heightPx =
    typeof builderHeight === 'number' ? Math.max(48, builderHeight) : dimensions.height_px;
  // Without an explicit corner every button reads the general radius role; gallery corners stay.
  const radiusCss = explicitRadius === undefined ? `var(--radius, ${rounding.css})` : rounding.css;
  const breadth =
    decisions.width_variants.find(item => item.value === (iconOnly ? 'content' : width)) ??
    decisions.width_variants.find(item => item.value === 'content')!;
  // Retired state and surface aliases are not resolved; busy work uses `loading`.
  const status = buttonStates.find(item => item.value === state) ?? buttonStates[0]!;
  const surface =
    decisions.fill_variants.find(item => item.value === fill) ?? decisions.fill_variants[0]!;
  const elevation =
    decisions.shadow_variants.find(item => item.value === shadow) ??
    atlas.experiments.shadow_variants.find(item => item.value === shadow) ??
    decisions.shadow_variants.find(item => item.value === 'none')!;
  // Flat removes the extrusion geometry and shadows only; motion timing stays shared.
  const flat = depth === 'flat';
  const timing =
    decisions.duration_variants.find(item => item.value === duration) ??
    decisions.duration_variants[0]!;
  const displayPalette =
    status.kind === 'success'
      ? 'moss'
      : status.kind === 'error'
        ? 'coral'
        : status.kind === 'warning'
          ? 'amber'
          : (palette ?? 'coral');
  const preset = ['success', 'error', 'warning'].includes(status.kind)
    ? undefined
    : colorPreset === undefined
      ? undefined
      : buttonPresetTone(colorPreset, tone);
  const docsDefault =
    appearance === 'docs' &&
    palette === undefined &&
    preset === undefined &&
    !['success', 'error', 'warning'].includes(status.kind);
  const colors =
    preset ??
    (docsDefault
      ? brandTones[tone]
      : tone === 'middle'
        ? atlas.palettes[displayPalette]
        : atlas.tones[displayPalette][tone]);
  const candidateSurfaceInk = preset
    ? contrast(colors.dark, colors.tint) >= 4.5 &&
      contrast(colors.dark, paletteForeground.light) >= 4.5
      ? colors.dark
      : paletteForeground.dark
    : contrast(colors.dark, colors.tint) >= 4.5 &&
        contrast(colors.dark, paletteForeground.light) >= 4.5
      ? colors.dark
      : docsDefault
        ? brandTones.dark.dark
        : atlas.palettes[displayPalette].dark;
  // Transparent actions also sit on gray field/playground surfaces. A foreground
  // that passes on white or its tint alone can still fall below 4.5:1 there.
  const surfaceInk =
    appearance === 'docs' &&
    [
      ...(['paper', 'panel', 'surface', 'fieldBg', 'fieldHoverBg'] as const).map(
        key => docsAccessibleThemeColors.light[key],
      ),
      ...builderSurfaces,
    ].some(background => contrast(candidateSurfaceInk, background) < 4.5)
      ? paletteForeground.dark
      : candidateSurfaceInk;
  const transparentInk = tone === 'middle' ? 'var(--button-transparent-ink)' : 'var(--ink)';
  const solidInk =
    preset?.ink ??
    (docsDefault
      ? brandTones[tone].ink
      : contrast(colors.color, paletteForeground.light) >=
          contrast(colors.color, paletteForeground.dark)
        ? paletteForeground.light
        : paletteForeground.dark);
  const fills = {
    solid: { face: colors.color, text: solidInk },
    tint: { face: colors.tint, text: surfaceInk },
    outline: { face: 'transparent', text: transparentInk },
    text: { face: 'transparent', text: transparentInk },
    link: { face: 'transparent', text: transparentInk },
  }[surface.value as 'solid' | 'tint' | 'outline' | 'text' | 'link'];
  const paint =
    border === 'hairline' && surface.value === 'solid'
      ? { face: 'var(--panel)', text: 'var(--button-outlined-ink)' }
      : fills;
  const neutral = status.kind === 'queued' || status.kind === 'offline';
  const textSurface = ['text', 'link'].includes(surface.value);
  const transparent = !neutral && surface.value === 'outline';
  const style = {
    '--button-face': neutral ? 'var(--button-neutral-face)' : paint.face,
    '--button-body': transparent || textSurface ? 'transparent' : colors.dark,
    '--button-edge': colors.dark,
    '--button-border-color': colors.color,
    '--button-outline-ink': preset
      ? contrast(colors.tint, paletteForeground.dark) >= 4.5
        ? colors.tint
        : paletteForeground.light
      : docsDefault
        ? 'var(--docs-brand-action-ink)'
        : atlas.tones[displayPalette].light.color,
    '--button-transparent-light-ink': surfaceInk,
    '--button-text': neutral ? 'var(--button-neutral-text)' : paint.text,
    // Slots stay coaxial with the owning well's radius role.
    '--button-radius': slotted ? 'var(--slot-radius)' : radiusCss,
    '--button-shadow': flat ? 'none' : elevation.css,
    '--button-pressed-shadow': flat
      ? 'none'
      : 'pressed_css' in elevation
        ? elevation.pressed_css
        : 'none',
    ...(flat ? { '--lip': '0px', '--top-lip': '0px' } : {}),
    '--button-duration': 'var(--motion-duration-deliberate)',
    '--press-duration': 'var(--motion-duration-deliberate)',
    '--release-duration': 'var(--motion-duration-deliberate)',
    '--shadow-accent-rgb': colors.color
      .match(/[a-f\d]{2}/gi)
      ?.map(value => parseInt(value, 16))
      .join(','),
    // Slots take their square from the owning well's --slot-size role instead.
    minHeight: slotted ? undefined : atlasLength(heightPx, appearance),
    height: iconOnly && !slotted ? atlasLength(heightPx, appearance) : undefined,
    width: iconOnly && !slotted ? atlasLength(heightPx, appearance) : undefined,
    minWidth: slotted
      ? undefined
      : iconOnly
        ? atlasLength(heightPx, appearance)
        : breadth.min_width_px === null
          ? undefined
          : `min(100%, ${atlasLength(breadth.min_width_px, appearance)})`,
    paddingInline: iconOnly
      ? '0px'
      : `var(--button-padding-inline, ${atlasLength(dimensions.padding_inline_px, appearance)})`,
    paddingBlock: iconOnly ? '0px' : undefined,
  } as CSSProperties;
  return (
    <Button
      {...buttonProps}
      color="primary"
      variant={surface.value === 'text' || surface.value === 'link' ? surface.value : 'solid'}
      className={`atlas-button ${border === 'hairline' || surface.value === 'outline' ? 'atlas-button-outlined' : ''}${iconOnly ? ' atlas-icon-button' : ''}${slotted ? ' atlas-slot-button' : ''}${slotClassName ? ` ${slotClassName}` : ''}`}
      style={style}
      block={breadth.block}
      loading={status.busy ? { icon: <></> } : false}
      styles={status.busy ? { icon: { display: 'none' } } : undefined}
      disabled={interactionDisabled || (status.blocked && !status.busy)}
      data-pressed={status.value === 'pressed'}
      data-state={status.value}
      data-state-kind={status.kind}
      data-docs-brand-default={docsDefault ? 'true' : undefined}
      data-docs-brand-tone={docsDefault ? tone : undefined}
      data-size={dimensions.value}
      data-fill={surface.value}
      data-color-preset={preset?.value}
      data-shadow={elevation.value}
      data-depth={flat ? 'flat' : '3d'}
      data-duration={timing.value}
      data-width={breadth.value}
      data-icon-only={iconOnly ? 'true' : undefined}
      data-icon-position={position}
      aria-busy={status.busy}
      aria-disabled={interactionDisabled || status.blocked}
    >
      <span className="atlas-button-content">
        {icon !== 'none' && <AtlasIcon name={icon} library={library} motion={motion} />}
        {!iconOnly && <span>{status.text ? t(status.text) : text || t('Continue')}</span>}
      </span>
      {transparent && <span className="atlas-button-lip" aria-hidden="true" />}
      {status.busy && <span className="atlas-button-progress" aria-hidden="true" />}
    </Button>
  );
}
