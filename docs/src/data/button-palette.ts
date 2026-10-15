export const paletteForeground = Object.freeze({ light: '#ffffff', dark: '#141414' });
import {
  COLOR_PRESETS,
  contrastInk,
  generateColorPalette,
  hwbToHex,
  type ColorPreset,
} from './color-system';

export type ButtonColorPreset = Readonly<{
  value: string;
  label: string;
  color: string;
  dark: string;
  tint: string;
  ink: string;
}>;

/** Hue families use 80% pure hue, 10% white and 10% black.
 * Neutral families retain 80% of their source composition, then add the same
 * white/black shares; otherwise distinct greys would all become the same red.
 * Conversion and palette generation remain owned by the Color system.
 */
function buttonSeed(preset: ColorPreset): string {
  const neutral = preset.id.startsWith('grey') || preset.id.startsWith('black');
  return hwbToHex(preset.h, neutral ? preset.w * 0.8 + 10 : 10, neutral ? preset.b * 0.8 + 10 : 10);
}

/** Exactly the 24 Color system presets in catalog order; Buttons add no 25th color. */
export const buttonColorPresets: readonly ButtonColorPreset[] = Object.freeze(
  COLOR_PRESETS.map(preset => {
    const color = buttonSeed(preset);
    const palette = generateColorPalette(color, 'light');
    return Object.freeze({
      value: preset.id,
      label: preset.name,
      color,
      dark: palette[6]!,
      tint: palette[0]!,
      ink: contrastInk(color),
    });
  }),
);

/** Complete documentation palette in Color-system order, shared by Tokens and Pill. */
export const tokenColorPresets: readonly ButtonColorPreset[] = buttonColorPresets;

export function buttonPresetTone(
  value: string,
  tone: 'dark' | 'middle' | 'light' | 'pastel',
): ButtonColorPreset | undefined {
  const preset = buttonColorPresets.find(item => item.value === value);
  if (!preset || tone === 'middle') return preset;
  const palette = generateColorPalette(preset.color, 'light');
  const [faceIndex, edgeIndex] = (
    {
      dark: [6, 8],
      light: [3, 4],
      pastel: [0, 2],
    } as const
  )[tone];
  const color = palette[faceIndex]!;
  return Object.freeze({
    ...preset,
    color,
    dark: palette[edgeIndex]!,
    ink: contrastInk(color),
  });
}
