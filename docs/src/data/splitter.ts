export type SplitterOrientation = 'auto' | 'horizontal' | 'vertical';
export type SplitterDirection = Exclude<SplitterOrientation, 'auto'>;
export type SplitterLimits = Readonly<{ min: number; max: number }>;
export type SplitterPanelLimits = Readonly<{ min?: number; max?: number }>;

/** Content thresholds, not a device classifier. Short landscape keeps a stack. */
export const splitterLayout = {
  horizontalMinWidth: 760,
  horizontalMinHeight: 320,
  horizontalMinViewportHeight: 480,
  narrowHeight: 640,
  wideHeight: 560,
  pointerCoarseTarget: 48,
  defaultMin: 20,
  defaultMax: 80,
  keyboardStep: 5,
  keyboardLargeStep: 10,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) ? value : fallback;

/** All public panel limits are percentages. Impossible pairs use the safe default. */
export function splitterLimits(
  panels: readonly [SplitterPanelLimits, SplitterPanelLimits],
): SplitterLimits {
  const limits = panels.map(panel => {
    const min = clamp(finite(panel.min, splitterLayout.defaultMin), 10, 90);
    return { min, max: clamp(finite(panel.max, splitterLayout.defaultMax), min, 90) };
  });
  const min = Math.max(limits[0]!.min, 100 - limits[1]!.max);
  const max = Math.min(limits[0]!.max, 100 - limits[1]!.min);
  return min <= max ? { min, max } : { min: 20, max: 80 };
}

/** Normalize weights without accepting negative, infinite or empty panes. */
export function splitterSizes(
  sizes: readonly number[] | undefined,
  limits: SplitterLimits = { min: 20, max: 80 },
): readonly [number, number] {
  const first = sizes?.[0];
  const second = sizes?.[1];
  const sum = (first ?? 0) + (second ?? 0);
  const valid =
    sizes?.length === 2 &&
    first !== undefined &&
    second !== undefined &&
    Number.isFinite(first) &&
    Number.isFinite(second) &&
    first > 0 &&
    second > 0 &&
    Number.isFinite(sum);
  const ratio = clamp(valid ? (first! / sum) * 100 : 50, limits.min, limits.max);
  return [ratio, 100 - ratio];
}

export function splitterDirection(
  requested: SplitterOrientation,
  area: Readonly<{ width: number; height: number; viewportHeight: number }>,
): SplitterDirection {
  if (requested !== 'auto') return requested;
  return area.width >= splitterLayout.horizontalMinWidth &&
    area.height >= splitterLayout.horizontalMinHeight &&
    area.viewportHeight >= splitterLayout.horizontalMinViewportHeight
    ? 'horizontal'
    : 'vertical';
}

/** Arrow directions follow the divider's movement, with Home/End at its bounds. */
export function splitterKeyRatio(
  key: string,
  direction: SplitterDirection,
  ratio: number,
  limits: SplitterLimits,
  largeStep = false,
  rtl = false,
): number | null {
  if (key === 'Home') return limits.min;
  if (key === 'End') return limits.max;
  const step = largeStep ? splitterLayout.keyboardLargeStep : splitterLayout.keyboardStep;
  const delta =
    direction === 'vertical'
      ? key === 'ArrowUp'
        ? -step
        : key === 'ArrowDown'
          ? step
          : null
      : key === 'ArrowLeft'
        ? rtl
          ? step
          : -step
        : key === 'ArrowRight'
          ? rtl
            ? -step
            : step
          : null;
  return delta === null ? null : clamp(ratio + delta, limits.min, limits.max);
}
