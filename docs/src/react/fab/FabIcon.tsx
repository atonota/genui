import type { CSSProperties } from 'react';
import GenUXIcon, { type GenUXIconName } from '../GenUXIcon';
import type { FabOptions } from '../../fab/types';

type FabIconProps = {
  icon: GenUXIconName;
  openIcon: GenUXIconName;
  open: boolean;
  transition: FabOptions['iconTransition'];
  size: number;
};

// Geometric morph is exact only for plus -> X (two lines rotated 45deg); any other pair falls back to a cross-fade.
const PLUS: ReadonlySet<string> = new Set(['plus', 'add']);
const CROSS: ReadonlySet<string> = new Set(['close', 'x', 'cross']);

// Motion is stylesheet-owned: .genux-fab-icon-turn / -old / -new key off the root [data-open] and use the
// central motion tokens; genux-motion-layer marks them decorative for prefers-reduced-motion. Only the
// size is passed inline (--fab-icon-size).
export default function FabIcon({
  icon,
  openIcon,
  open,
  transition = 'static',
  size,
}: FabIconProps) {
  const mode =
    transition === 'morph' && !(PLUS.has(icon) && CROSS.has(openIcon)) ? 'replace' : transition;
  const box = { '--fab-icon-size': `${size}px` } as CSSProperties;
  const common = {
    className: 'genux-fab-icon',
    style: box,
    'aria-hidden': true,
    'data-fab-icon-transition': mode,
    'data-open': open ? 'true' : 'false',
  } as const;

  if (mode === 'morph') {
    return (
      <span {...common}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          focusable="false"
        >
          <g className="genux-fab-icon-turn genux-motion-layer">
            <line x1={12} y1={5} x2={12} y2={19} />
            <line x1={5} y1={12} x2={19} y2={12} />
          </g>
        </svg>
      </span>
    );
  }
  if (mode === 'rotate') {
    return (
      <span {...common}>
        <span className="genux-fab-icon-turn genux-motion-layer">
          <GenUXIcon name={icon} />
        </span>
      </span>
    );
  }
  if (mode === 'replace') {
    return (
      <span {...common}>
        <span className="genux-fab-icon-old genux-motion-layer">
          <GenUXIcon name={icon} />
        </span>
        <span className="genux-fab-icon-new genux-motion-layer">
          <GenUXIcon name={openIcon} />
        </span>
      </span>
    );
  }
  return (
    <span {...common}>
      <GenUXIcon name={icon} />
    </span>
  );
}
