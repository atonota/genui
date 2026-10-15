import { useI18n } from './useI18n';
import type { CSSProperties, ComponentProps } from 'react';
import { Tag, theme, type TagProps } from 'antd';
import atlas from '../data/atlas.json';
import AtlasIcon from './AtlasIcon';
import { atlasLength, useAtlasAppearance } from './AtlasAppearance';
import { useAtlasSize } from './AtlasSizeProfile';
import { usePillColor } from './AtlasPillColors';
export { AtlasPillColorScope } from './AtlasPillColors';
import { pillColorAt } from '../data/pill-palette';
import {
  indexedPillPaint,
  pillPaint,
  pillSeed,
  pillSizes,
  type PillSize,
  type PillVariant,
} from '../data/pill-surfaces';

export type AtlasPillProps = Omit<TagProps, 'variant' | 'closable' | 'closeIcon'> & {
  variant?: PillVariant;
  size?: PillSize;
  radius?: string;
  closable?: boolean;
  closeLabel?: string;
  colorIndex?: number;
  colorKey?: string;
};

type PillAppearance = Pick<
  AtlasPillProps,
  'variant' | 'size' | 'radius' | 'color' | 'colorIndex' | 'colorKey' | 'style'
>;
function usePillStyle({
  variant = 'filled',
  size: explicitSize,
  radius = '5',
  color,
  colorIndex: explicitIndex,
  colorKey,
  style,
}: PillAppearance) {
  const automaticIndex = usePillColor(colorKey);
  const colorIndex = explicitIndex ?? automaticIndex;
  const appearance = useAtlasAppearance();
  const inheritedSize = useAtlasSize();
  const size = explicitSize ?? inheritedSize;
  const { token } = theme.useToken();
  const preset =
    appearance === 'docs' && color === undefined && colorIndex !== undefined
      ? pillColorAt(colorIndex)
      : undefined;
  const seed = pillSeed(color, token.colorPrimary, {
    success: token.colorSuccess,
    processing: token.colorPrimary,
    warning: token.colorWarning,
    error: token.colorError,
    default: token.colorTextSecondary,
  });
  const paint =
    appearance === 'docs'
      ? preset
        ? indexedPillPaint(colorIndex!, variant, token.colorBgContainer)
        : seed
          ? pillPaint(seed, variant, token.colorBgContainer)
          : undefined
      : undefined;
  const rounding =
    atlas.decisions.buttons.radius_variants.find(item => item.value === radius) ??
    atlas.decisions.buttons.radius_variants.find(item => item.value === '5')!;
  return {
    preset,
    managed: !!paint,
    legacy: appearance === 'approved' && color === undefined && variant === 'filled',
    style: {
      ...(paint
        ? {
            '--pill-bg': paint.background,
            '--pill-ink': paint.ink,
            '--pill-border': paint.border,
          }
        : {}),
      ...(appearance === 'docs' || explicitSize
        ? { '--pill-height': atlasLength(pillSizes[size], appearance) }
        : {}),
      ...style,
      '--pill-radius': rounding.css,
    } as CSSProperties,
  };
}

/** Native Tag owns closing, link, disabled and semantic slot behavior. */
export default function AtlasPill({
  variant = 'filled',
  size,
  radius,
  closable = false,
  closeLabel,
  colorIndex,
  colorKey,
  color,
  className,
  style,
  children,
  styles,
  ...tagProps
}: AtlasPillProps) {
  const { t } = useI18n();
  const paint = usePillStyle({ variant, size, radius, color, colorIndex, colorKey, style });
  const label =
    closeLabel ??
    (typeof children === 'string' ? t('Remove {label} tag', { label: children }) : t('Remove tag'));
  return (
    <Tag
      {...tagProps}
      color={color}
      variant={variant}
      data-pill-variant={variant}
      data-pill-color={paint.preset?.value}
      data-pill-legacy={paint.legacy || undefined}
      data-pill-managed={paint.managed || undefined}
      className={['atlas-pill', className].filter(Boolean).join(' ')}
      styles={
        paint.managed
          ? info => {
              const slots = typeof styles === 'function' ? styles(info) : styles;
              return {
                ...slots,
                root: {
                  backgroundColor: 'var(--pill-bg)',
                  color: 'var(--pill-ink)',
                  borderColor: 'var(--pill-border)',
                  ...slots?.root,
                },
              };
            }
          : styles
      }
      style={paint.style}
      closable={closable}
      closeIcon={
        closable ? (
          <span className="atlas-pill-close" aria-label={label}>
            <AtlasIcon name="x" className="atlas-pill-close-icon" />
          </span>
        ) : (
          false
        )
      }
    >
      <span className="atlas-pill-label">{children}</span>
    </Tag>
  );
}

export type AtlasCheckablePillProps = ComponentProps<typeof Tag.CheckableTag> & PillAppearance;
/** Fully controlled native checkbox semantics; removal is intentionally a separate pattern. */
export function AtlasCheckablePill({
  variant = 'filled',
  size,
  radius,
  color,
  colorIndex,
  colorKey,
  style,
  className,
  children,
  ...props
}: AtlasCheckablePillProps) {
  const paint = usePillStyle({ variant, size, radius, color, colorIndex, colorKey, style });
  return (
    <Tag.CheckableTag
      {...props}
      data-pill-variant={variant}
      data-pill-color={paint.preset?.value}
      data-pill-managed={paint.managed || undefined}
      className={['atlas-pill', 'atlas-pill-checkable', className].filter(Boolean).join(' ')}
      style={paint.style}
    >
      <span className="atlas-pill-label">{children}</span>
    </Tag.CheckableTag>
  );
}
