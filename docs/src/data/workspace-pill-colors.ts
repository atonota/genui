import type { Currency, RecordStatus } from './workspace';
import { pillColorPresets } from './pill-palette';

function colorIndex(value: string): number {
  const index = pillColorPresets.findIndex(preset => preset.value === value);
  if (index < 0) throw new Error(`Missing workspace Pill color: ${value}`);
  return index;
}

/** Stable category positions in the shared 75/5 Pill palette.
 * Use raw model values, never row order, translated labels or formatted totals.
 * Separate hue families make the categories visibly distinct. Resolve by preset
 * identity so catalog order changes cannot silently recolor an existing value.
 */
export const workspacePillColorIndex = Object.freeze({
  status: Object.freeze({
    draft: colorIndex('red'),
    pending: colorIndex('orange'),
    approved: colorIndex('green'),
    shipped: colorIndex('cyan-blue'),
  } satisfies Record<RecordStatus, number>),
  currency: Object.freeze({
    USD: colorIndex('violet'),
    EUR: colorIndex('magenta-red'),
  } satisfies Record<Currency, number>),
});
