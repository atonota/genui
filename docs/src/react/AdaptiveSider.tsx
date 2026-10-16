import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Layout } from 'antd';
import policy from '../adaptive/policy.json';
import { useAdaptive } from './AdaptiveProvider';

type SiderProps = ComponentProps<typeof Layout.Sider>;
type CollapseType = Parameters<NonNullable<SiderProps['onCollapse']>>[1];

// Native breakpoint matching would compete with the shared environment, so it is excluded.
export type AdaptiveSiderProps = Omit<SiderProps, 'breakpoint' | 'onBreakpoint'> & {
  /** CSS viewport width below which the sider starts collapsed; defaults to the laptop width. */
  collapseBelow?: number;
  breakpoint?: never;
  onBreakpoint?: never;
};

/** AntD Sider whose collapse follows the shared adaptive width while keeping manual choices. */
export default function AdaptiveSider({
  collapseBelow = policy.widths.laptop,
  collapsed,
  defaultCollapsed = false,
  collapsible = true,
  onCollapse,
  ...rest
}: AdaptiveSiderProps) {
  const { environment } = useAdaptive();
  // Layout width, not the visual viewport, so a virtual keyboard never collapses the sider.
  const narrow = environment.width < collapseBelow;
  const [wideCollapsed, setWideCollapsed] = useState(defaultCollapsed);
  const [narrowExpanded, setNarrowExpanded] = useState(false);
  const [lastNarrow, setLastNarrow] = useState(narrow);
  // A manual expand on a narrow width lasts for that narrow stretch only.
  if (lastNarrow !== narrow) {
    setLastNarrow(narrow);
    setNarrowExpanded(false);
  }
  const shown = collapsed ?? (narrow ? !narrowExpanded : wideCollapsed);
  const previous = useRef({ narrow, shown });
  useEffect(() => {
    const before = previous.current;
    previous.current = { narrow, shown };
    if (before.narrow === narrow) return;
    // Controlled callers get the native responsive request only when a narrow width needs it.
    if (collapsed === undefined ? before.shown !== shown : narrow && !collapsed)
      onCollapse?.(collapsed === undefined ? shown : true, 'responsive');
  });
  const handleCollapse = (next: boolean, type: CollapseType) => {
    if (collapsed === undefined) {
      if (narrow) setNarrowExpanded(!next);
      else setWideCollapsed(next);
    }
    onCollapse?.(next, type);
  };
  return (
    <Layout.Sider
      {...rest}
      collapsible={collapsible}
      collapsed={shown}
      onCollapse={handleCollapse}
    />
  );
}
