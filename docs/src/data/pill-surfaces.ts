import { generate, presetPrimaryColors } from '@ant-design/colors';
import { contrastInk, contrastRatio, hexToRgb, hexToHwb, hwbToHex } from './color-system';
import { pillColorAt } from './pill-palette';
import { tokenColorPresets } from './button-palette';

export const pillVariants = ['filled', 'solid', 'outlined'] as const;
export type PillVariant = (typeof pillVariants)[number];
export const pillSizes = { sm: 32, md: 40, lg: 48 } as const;
export type PillSize = keyof typeof pillSizes;
export const pillSizeProfiles = Object.entries(pillSizes).map(([value, height]) => ({
  value,
  label: `${value === 'sm' ? 'Small' : value === 'md' ? 'Medium' : 'Large'} · ${height} px`,
}));
export type PillPaint = { background: string; ink: string; border: string };

/** Choose a readable tone from the installed AntD generator, retaining the seed hue. */
function readableTone(seed: string, background: string): string {
  const tones = [seed, ...generate(seed)];
  return tones.find(color => contrastRatio(color, background) >= 4.5) ?? contrastInk(background);
}
export function pillPaint(
  seed: string,
  variant: PillVariant,
  surface: string,
  fill?: string,
): PillPaint {
  if (variant === 'solid')
    return { background: seed, ink: contrastInk(seed), border: 'transparent' };
  if (variant === 'outlined') {
    const ink = readableTone(seed, surface);
    return { background: 'transparent', ink, border: ink };
  }
  const channels = hexToHwb(seed);
  const background =
    fill ?? (channels.w + channels.b > 95 ? hwbToHex(0, 94, 6) : hwbToHex(channels.h, 92, 0));
  return { background, ink: readableTone(seed, background), border: 'transparent' };
}

export function pillSeed(
  color: string | undefined,
  primary: string,
  statuses: Record<string, string>,
): string | undefined {
  if (color === undefined) return primary;
  if (Object.hasOwn(statuses, color)) return statuses[color];
  const preset = tokenColorPresets.find(p => p.value === color || p.label === color);
  if (preset) return preset.color;
  if (Object.hasOwn(presetPrimaryColors, color))
    return presetPrimaryColors[color as keyof typeof presetPrimaryColors];
  try {
    const seed = /^#[a-f\d]{3}$/i.test(color)
      ? '#' + [...color.slice(1)].map(c => c + c).join('')
      : color;
    hexToRgb(seed);
    return seed;
  } catch {
    return undefined;
  }
}

export function indexedPillPaint(index: number, variant: PillVariant, surface: string): PillPaint {
  const preset = pillColorAt(index);
  const seed = tokenColorPresets.find(token => token.value === preset.value)!.color;
  return variant === 'filled'
    ? pillPaint(preset.color, variant, surface, preset.color)
    : pillPaint(seed, variant, surface);
}
