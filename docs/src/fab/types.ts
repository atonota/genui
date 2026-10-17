import type { RefObject } from 'react';
import type { GenUXIconName } from '../react/GenUXIcon';
export type FabSize = 'sm' | 'md' | 'lg';
export type FabType =
  | 'single'
  | 'extended'
  | 'collapsible'
  | 'speed-dial'
  | 'menu'
  | 'contextual'
  | 'adaptive';
export type FabLayout =
  | 'linear'
  | 'diagonal'
  | 'circle'
  | 'semi-circle'
  | 'quarter-circle'
  | 'custom-arc'
  | 'multi-directional'
  | 'floating-menu'
  | 'sheet';
export type FabDirection =
  | 'up'
  | 'down'
  | 'start'
  | 'end'
  | 'up-start'
  | 'up-end'
  | 'down-start'
  | 'down-end';
export type FabShape = 'circle' | 'rounded-square' | 'squircle' | 'square' | 'pill' | 'custom';
export type FabAppearance =
  | 'filled'
  | 'tonal'
  | 'outlined'
  | 'soft-outlined'
  | 'elevated'
  | 'flat'
  | 'semi-flat'
  | 'inset-press'
  | 'translucent'
  | 'branded';
export type FabState = 'closed' | 'opening' | 'open' | 'closing' | 'disabled' | 'busy';
export type FabEasing = 'cubic' | 'linear' | 'ease-out' | 'ease-in-out' | 'spring';
export type FabEffect = 'fade' | 'scale' | 'slide' | 'pop';
export type FabRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type FabPoint = Readonly<{ x: number; y: number }>;
export type FabGroup = Readonly<{
  id: string;
  label?: string;
  direction: FabDirection;
  /** One dial arm: menus, sheets and nested multi-directional layouts stay top-level only. */
  layout?: Exclude<FabLayout, 'multi-directional' | 'floating-menu' | 'sheet'>;
  startAngle?: number;
  endAngle?: number;
}>;
export type FabAction = Readonly<{
  id: string;
  label: string;
  description?: string;
  icon?: GenUXIconName;
  order?: number;
  group?: string;
  visible?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  badge?: number | string;
  actionType?: 'action' | 'link' | 'panel' | 'dialog';
  permission?: boolean;
  confirmation?: boolean | string;
  shortcut?: string;
  closeBehavior?: 'inherit' | 'close' | 'keep-open';
  offlineAvailable?: boolean;
  href?: string;
  target?: '_self' | '_blank';
  onAction?: (action: FabAction) => void | Promise<void>;
}>;
export type FabMotion = Readonly<{
  entrance?: readonly FabEffect[];
  exit?: readonly Exclude<FabEffect, 'pop'>[];
  sequence?: 'together' | 'staggered';
  order?: 'forward' | 'reverse' | 'from-center';
  duration?: 'fast' | 'normal' | 'slow' | number;
  closeDuration?: 'fast' | 'normal' | 'slow' | number;
  stagger?: number;
  easing?: FabEasing;
  origin?: 'trigger-center' | 'edge' | 'custom';
  customOrigin?: FabPoint;
}>;
export type FabOptions = Readonly<{
  type?: FabType;
  layout?: FabLayout;
  direction?: FabDirection;
  shape?: FabShape;
  appearance?: FabAppearance;
  size?: FabSize;
  radius?: number | '0px' | '3px' | '5px' | '100%';
  density?: 'compact' | 'comfortable' | 'spacious';
  content?: 'icon-only' | 'text-only' | 'icon-text';
  labelPlacement?: 'inside' | 'outside' | 'above' | 'below' | 'start' | 'end';
  labelVisibility?: 'always' | 'hover' | 'focus' | 'expanded-only';
  tooltip?: 'none' | 'hover' | 'focus' | 'hover-focus';
  iconPosition?: 'start' | 'end' | 'top' | 'bottom';
  iconTransition?: 'rotate' | 'replace' | 'morph' | 'static';
  trigger?: 'click' | 'hover' | 'long-press' | 'gesture';
  horizontal?: 'start' | 'center' | 'end';
  vertical?: 'top' | 'center' | 'bottom';
  anchor?: 'viewport' | 'container' | 'element';
  positioning?: 'fixed' | 'absolute' | 'sticky';
  edge?: 'normal' | 'header-overlap' | 'footer-overlap';
  alignment?: 'start' | 'center' | 'end';
  offset?: FabPoint;
  arc?: Readonly<{ startAngle?: number; endAngle?: number; radius?: number; angularGap?: number }>;
  motion?: FabMotion;
  backdrop?: 'none' | 'transparent' | 'dim' | 'blur' | 'dim-blur';
  modal?: boolean;
  visibility?:
    | 'always'
    | 'hide-on-scroll-down'
    | 'show-on-scroll-up'
    | 'collapse-on-scroll'
    | 'expand-near-top'
    | 'contextual'
    | 'sticky-boundary';
  adaptation?: 'auto' | 'compact' | 'expanded' | 'sheet';
  critical?: boolean;
  draggable?: boolean;
  closeOnSelect?: boolean;
  closeOnOutside?: boolean;
  closeOnEscape?: boolean;
  closeOnScroll?: boolean;
  closeOnNavigation?: boolean;
  closeOnBlur?: boolean;
  toggleOnTrigger?: boolean;
  keepOpenOnError?: boolean;
  disableWhileLoading?: boolean;
}>;
export type FabConfig = Required<Omit<FabOptions, 'motion' | 'arc'>> & {
  motion: Required<FabMotion>;
  arc: Required<NonNullable<FabOptions['arc']>>;
};
export type GenUXFabProps = FabOptions & {
  label: string;
  icon?: GenUXIconName;
  openIcon?: GenUXIconName;
  actions?: readonly FabAction[];
  groups?: readonly FabGroup[];
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  loading?: boolean;
  visible?: boolean;
  online?: boolean;
  badge?: number | string;
  counter?: number;
  progress?: number;
  className?: string;
  onOpenChange?: (open: boolean, reason: string) => void;
  onAction?: (action: FabAction) => void | Promise<void>;
  onError?: (error: unknown, action: FabAction) => void;
  onPositionChange?: (position: FabPoint) => void;
  dragPosition?: FabPoint;
  defaultDragPosition?: FabPoint;
  containerRef?: RefObject<HTMLElement | null>;
  anchorRef?: RefObject<HTMLElement | null>;
  scrollRef?: RefObject<HTMLElement | null>;
  obstacles?: readonly (FabRect | RefObject<HTMLElement | null>)[];
};
export type FabMeasuredAction = Readonly<{
  id: string;
  width: number;
  height: number;
  labelWidth?: number;
  labelHeight?: number;
  group?: string;
}>;
export type FabGeometryInput = Readonly<{
  bounds: FabRect;
  trigger: FabRect;
  actions: readonly FabMeasuredAction[];
  options: FabConfig;
  groups?: readonly FabGroup[];
  obstacles?: readonly FabRect[];
  rtl?: boolean;
  spatial?: boolean;
}>;
// Position x/y/width/height stay the reserved box; optional control/label are absolute bounds-space rects whose exact
// union is that box. Dial actions report both (label only when measured external); menu/sheet rows report control only.
// Menu and sheet results also report panel, the exact outer panel rect in bounds space; maxHeight is that outer
// height, including the sheet's top and bottom padding. Dials omit panel.
export type FabGeometry = Readonly<{
  layout: FabLayout;
  direction: FabDirection;
  trigger: FabPoint;
  positions: readonly (FabRect & {
    id: string;
    angle?: number;
    control?: FabRect;
    label?: FabRect;
  })[];
  radius: number;
  mode: 'dial' | 'menu' | 'sheet';
  collision: boolean;
  maxHeight: number;
  panel?: FabRect;
}>;
// Required exports in options.ts: FAB_OPTIONS, FAB_DEFAULTS, normalizeFabOptions(input?:FabOptions):FabConfig,
// validateFabActions(actions:readonly FabAction[]):readonly FabAction[], resolveFabActions(actions:readonly FabAction[],online?:boolean):readonly FabAction[],
// actionUnavailableReason(action:FabAction,online?:boolean):string|undefined.
// geometry.ts exports layoutFab(input:FabGeometryInput):FabGeometry and placeFabTrigger(input:{bounds:FabRect;anchor?:FabRect;width:number;height:number;options:FabConfig;obstacles?:readonly FabRect[];rtl?:boolean}):FabRect.
// Required UI anatomy classes: genux-fab, genux-fab-trigger, genux-fab-actions, genux-fab-action,
// genux-fab-label, genux-fab-icon, genux-fab-backdrop, genux-fab-status, genux-fab-drag-handle.
// data-fab-state/type/layout/direction/shape/appearance/size/expanded/label-placement/label-visibility/
// icon-position/icon-transition/backdrop/modal/entrance/exit/sequence/order/origin/visibility/adaptation.
// Geometry stylevars --fab-x/y, --fab-trigger-width/height, --fab-action-x/y/width/height,
// --fab-action-visual/target, --fab-open-duration/close-duration/stagger/easing, --fab-order-index.
