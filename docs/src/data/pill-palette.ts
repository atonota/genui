import { tokenColorPresets } from './button-palette';
import { COLOR_PRESETS, contrastInk, hwbToHex } from './color-system';

export const pillComposition = Object.freeze({ whiteness: 75, blackness: 5 });
export type PillColorPreset = Readonly<{
  value: string;
  label: string;
  color: string;
  ink: string;
  hue: number;
}>;

/** Follow the token catalog's chromatic Color-system order; neutral families and
 * the identical repeated red endpoint are not Pill color variants.
 */
const colors = new Set<string>();
export const pillColorPresets: readonly PillColorPreset[] = Object.freeze(
  tokenColorPresets.flatMap(token => {
    const source = COLOR_PRESETS.find(preset => preset.id === token.value)!;
    if (source.id.startsWith('grey') || source.id.startsWith('black')) return [];
    const { whiteness, blackness } = pillComposition;
    const color = hwbToHex(source.h, whiteness, blackness);
    if (colors.has(color)) return [];
    colors.add(color);
    return [
      Object.freeze({
        value: token.value,
        label: token.label,
        color,
        ink: contrastInk(color),
        hue: source.h,
      }),
    ];
  }),
);

export function pillColorAt(index: number): PillColorPreset {
  const position = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  return pillColorPresets[position % pillColorPresets.length]!;
}
