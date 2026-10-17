import { pillSizes } from './pill-surfaces';

/** Circle Radio, Checkbox and Switch controls share the compact Pill height family. */
export const selectionSizeProfiles = [
  { value: 'sm', label: `Small · ${pillSizes.sm} px`, height_px: pillSizes.sm },
  { value: 'md', label: `Medium · ${pillSizes.md} px`, height_px: pillSizes.md },
  { value: 'lg', label: `Large · ${pillSizes.lg} px`, height_px: pillSizes.lg },
] as const;

/** Header controls outside a React provider alias the central compact height roles. */
export const selectionSizeStyleText = `body[data-genux-surface='docs']{${selectionSizeProfiles
  .map(
    profile =>
      `--genux-selection-height-${profile.value}:var(--size-compact-${profile.value},${profile.height_px}px)`,
  )
  .join(';')}}`;
