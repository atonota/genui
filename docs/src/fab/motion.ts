import type { CSSProperties } from 'react';
import type { FabConfig, FabOptions } from './types';
import fabTokens from '../data/fab-tokens.json';
import { FAB_MOTION, normalizeFabOptions } from './options';

// Internal FAB motion-role owner. It only emits validated semantic CSS custom properties; transitions,
// animations and the reduced-motion zero overrides of these same roles belong to the stylesheet.
// No React runtime, DOM or browser globals, so it is SSR safe.

// Easing policy awaits a human decision: only the existing Cubic baseline (var(--motion-easing)) is
// implemented. linear, ease-out, ease-in-out and spring are rejected until that choice is reconciled.
const IMPLEMENTED_EASING: FabConfig['motion']['easing'] = 'cubic';
const EASING_ROLE = 'var(--motion-easing)';
const MAX_ACTIONS = fabTokens.position.maxActions;

type Motion = FabConfig['motion'];
type Duration = Motion['duration'];
type DurationTable = Readonly<Record<'fast' | 'normal' | 'slow', number>>;

function resolveMotion(input: FabOptions): Motion {
  const { motion } = normalizeFabOptions(input);
  if (motion.easing !== IMPLEMENTED_EASING) {
    throw new RangeError(
      `FAB motion easing ${motion.easing} is pending a policy decision; only cubic is implemented.`,
    );
  }
  return motion;
}

function requireCount(count: unknown): number {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > MAX_ACTIONS) {
    throw new RangeError(`FAB motion count must be an integer from 0 to ${MAX_ACTIONS}.`);
  }
  return count;
}

function requireIndex(index: unknown, count: number): number {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`FAB motion index must be an integer from 0 to below ${count}.`);
  }
  return index;
}

function resolveDuration(value: Duration, table: DurationTable): number {
  // Numeric durations are already bounded to 16..2000 by normalizeFabOptions.
  return typeof value === 'number' ? value : table[value];
}

function durationFor(motion: Motion, open: boolean): number {
  return open
    ? resolveDuration(motion.duration, FAB_MOTION.open)
    : resolveDuration(motion.closeDuration, FAB_MOTION.close);
}

// normalizeFabOptions rejects origin fractions outside 0..1, so every accepted value maps to its own percentage.
function originPercent(value: number): string {
  return `${Math.round(value * 10000) / 100}%`;
}

function orderRank(order: Motion['order'], index: number, count: number): number {
  if (order === 'forward') return index;
  if (order === 'reverse') return count - 1 - index;
  // from-center: nearest to the middle first; equal distances keep source order.
  const distance = (position: number): number => Math.abs(2 * position - (count - 1));
  const own = distance(index);
  let rank = 0;
  for (let other = 0; other < count; other += 1) {
    const value = distance(other);
    if (value < own || (value === own && other < index)) rank += 1;
  }
  return rank;
}

function roles(values: Record<string, string>): CSSProperties {
  return Object.freeze(values) as CSSProperties;
}

export function fabMotionDuration(input: FabOptions, open: boolean): number {
  const motion = resolveMotion(input);
  if (typeof open !== 'boolean') throw new TypeError('FAB motion open must be a boolean.');
  return durationFor(motion, open);
}

export function fabMotionStyle(input: FabOptions, count: number): CSSProperties {
  const motion = resolveMotion(input);
  requireCount(count);
  return roles({
    '--fab-open-duration': `${durationFor(motion, true)}ms`,
    '--fab-close-duration': `${durationFor(motion, false)}ms`,
    '--fab-stagger': `${motion.stagger}ms`,
    '--fab-easing': EASING_ROLE,
    '--fab-custom-origin-x': originPercent(motion.customOrigin.x),
    '--fab-custom-origin-y': originPercent(motion.customOrigin.y),
  });
}

export function fabActionMotionStyle(
  input: FabOptions,
  index: number,
  count: number,
): CSSProperties {
  const motion = resolveMotion(input);
  const total = requireCount(count);
  const position = requireIndex(index, total);
  const rank = orderRank(motion.order, position, total);
  // rank < maxActions and stagger <= 100, so the delay is bounded by (maxActions - 1) * 100 ms.
  const delay = motion.sequence === 'together' ? 0 : rank * motion.stagger;
  return roles({
    '--fab-delay': `${delay}ms`,
    '--fab-order-index': `${rank}`,
  });
}
