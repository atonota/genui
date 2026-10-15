import { pillPaint, type PillPaint } from './pill-surfaces';

export const badgeKinds = ['label', 'count', 'dot', 'ribbon'] as const;
export type BadgeKind = (typeof badgeKinds)[number];
export const badgeVariants = ['solid', 'soft', 'outlined'] as const;
export type BadgeVariant = (typeof badgeVariants)[number];
export const badgeTones = ['neutral', 'brand', 'success', 'warning', 'danger', 'info'] as const;
export type BadgeTone = (typeof badgeTones)[number];
export const badgePlacements = ['top-end', 'top-start', 'bottom-end', 'bottom-start'] as const;
export type BadgePlacement = (typeof badgePlacements)[number];
export const badgeRadii = ['0px', '3px', '5px', '100%'] as const;
export type BadgeRadius = (typeof badgeRadii)[number];
/** Factory defaults of the editable size-badge-sm/md/lg roles; the roles always win. */
export const badgeSizes = { sm: 20, md: 26, lg: 32 } as const;
export type BadgeSize = keyof typeof badgeSizes;
export const badgeHeight = (size: BadgeSize) => `var(--size-badge-${size}, ${badgeSizes[size]}px)`;

export type BadgeSeedToken = Record<
  | 'colorBgContainer'
  | 'colorTextSecondary'
  | 'colorPrimary'
  | 'colorSuccess'
  | 'colorWarning'
  | 'colorError'
  | 'colorInfo',
  string
>;

const hexChannels = (hex: string) => {
  const digits = hex.slice(1);
  const full = digits.length < 6 ? [...digits.slice(0, 3)].map(c => c + c).join('') : digits;
  return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16));
};
const toHex = (channels: number[]) =>
  '#' + channels.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');

/** Composites translucent theme roles (the neutral text tone) onto the surface for the hex pipeline. */
function opaque(color: string, surface: string): string {
  if (color.startsWith('#')) return toHex(hexChannels(color));
  if (!color.startsWith('rgb')) return color;
  const [r = '0', g = '0', b = '0', a = '1'] = color
    .slice(color.indexOf('(') + 1, color.lastIndexOf(')'))
    .split(/[ ,/]+/)
    .filter(Boolean);
  const alpha = a.endsWith('%') ? parseFloat(a) / 100 : Number(a);
  const base = surface.startsWith('#') ? hexChannels(surface) : [255, 255, 255];
  return toHex([r, g, b].map((value, index) => Number(value) * alpha + base[index]! * (1 - alpha)));
}

export function badgeSeed(tone: BadgeTone, token: BadgeSeedToken): string {
  const seeds: Record<BadgeTone, string> = {
    neutral: token.colorTextSecondary,
    brand: token.colorPrimary,
    success: token.colorSuccess,
    warning: token.colorWarning,
    danger: token.colorError,
    info: token.colorInfo,
  };
  const surface = opaque(token.colorBgContainer, token.colorBgContainer);
  return opaque(seeds[tone], surface);
}

/** Soft reuses the shared pill filled surface; contrast choices stay in pillPaint. */
export function badgePaint(seed: string, variant: BadgeVariant, surface: string): PillPaint {
  return pillPaint(seed, variant === 'soft' ? 'filled' : variant, opaque(surface, surface));
}
