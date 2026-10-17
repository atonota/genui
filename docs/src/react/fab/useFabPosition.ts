import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import fabTokens from '../../data/fab-tokens.json';
import { layoutFab, placeFabTrigger } from '../../fab/geometry';
import {
  FAB_METRICS,
  FAB_MOTION,
  actionUnavailableReason,
  normalizeFabOptions,
} from '../../fab/options';
import type {
  GenUXFabProps,
  FabAction,
  FabConfig,
  FabGeometry,
  FabMeasuredAction,
  FabPoint,
  FabRect,
} from '../../fab/types';
import { useAdaptive } from '../AdaptiveProvider';
import { useTweakerOpen } from '../GenUXTweaker';
import { previewDocumentSelector } from '../PreviewContext';

// Layout effects only run on the client; the server pass uses the inert useEffect.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
// Drag, keyboard and scroll steps derive from the central FAB tokens instead of restating role values.
const DRAG_THRESHOLD = FAB_MOTION.dragThreshold;
const KEY_STEP = fabTokens.position.offset / 2;
const KEY_STEP_LARGE = fabTokens.position.offset * 2;
const NEAR_TOP = FAB_METRICS.md.actionTarget;
// Inline previews render on the page; their document root is the boundary, never the host viewport.
const BOUNDARY_SELECTOR = `[data-fab-boundary],${previewDocumentSelector}`;
// Trigger label footprints use the same collision padding and label spacing the geometry applies to actions.
const PAD = fabTokens.position.collisionPadding;
const LABEL_GAP = fabTokens.position.labelGap;
const FIT_TOLERANCE = 0.5;
// Live parts whose rendered box feeds measurement: action hosts with their native controls, slots and labels, the
// trigger control and its outside label, the visible status card and the drag toolbar. Measurement copies are never
// observed.
const OBSERVED_PARTS = [
  '[data-fab-action-id]',
  '[data-fab-action-id] :is(button, a, .genux-fab-control-slot, .genux-fab-label)',
  '.genux-fab-trigger :is(button, a)',
  ':scope > .genux-fab-label',
  ':scope > :is(.genux-fab-status, .genux-fab-drag)',
].join(',');
const MEASURE_COPY = '[data-fab-measure]';
// Rendered changes that resize content without a data change: busy, disabled and state classes, the rendered mode.
const OBSERVED_ATTRIBUTES: readonly string[] = [
  'class',
  'disabled',
  'data-state',
  'data-fab-mode',
  'hidden',
];
// Root and ancestor attributes that can change the inherited writing direction: semantic dir, RTL classes, inline style.
const DIRECTION_ATTRIBUTES: readonly string[] = ['dir', 'class', 'style'];

type Size = Readonly<{ width: number; height: number }>;
// Client px per local CSS px on each axis; only axis-aligned translation and positive scale are representable.
type Frame = Readonly<{
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  bounds: FabRect;
}>;
type LabelSide = 'left' | 'right' | 'above' | 'below';
type SideOrder = readonly [LabelSide, LabelSide, LabelSide, LabelSide];
type TriggerLabel = Readonly<{ side: LabelSide; rect: FabRect }>;
/** Trigger plus its outside label; dx/dy and the label rect are relative to the trigger origin. */
type Footprint = Readonly<{
  dx: number;
  dy: number;
  width: number;
  height: number;
  label: TriggerLabel | null;
  fitsHome: boolean;
}>;
type LabelledFootprint = Footprint & Readonly<{ label: TriggerLabel }>;
type Measured = Readonly<{
  bounds: FabRect;
  /** Paint-frame corner of the root box; children paint root-local from it. */
  origin: FabPoint;
  anchor: FabRect | null;
  trigger: Size;
  triggerLabel: Size | null;
  /** Intrinsic wrapped box of the visible status card; null while it is empty or unrendered. */
  status: Size | null;
  actions: readonly FabMeasuredAction[];
  obstacles: readonly FabRect[];
  rtl: boolean;
  offscreen: boolean;
  previewed: boolean;
}>;
type Scroll = Readonly<{ direction: 'none' | 'up' | 'down'; nearTop: boolean }>;
type Drag = {
  id: number;
  startX: number;
  startY: number;
  origin: FabPoint;
  restore: FabPoint | null;
  moved: boolean;
  target: HTMLDivElement;
};
type FabPosition = {
  geometry: FabGeometry;
  hidden: boolean;
  collapsed: boolean;
  style: CSSProperties;
  dragHandlers: HTMLAttributes<HTMLDivElement>;
  resetPosition: () => void;
  movePosition: (dx: number, dy: number) => void;
  /** Movement is blocked: not draggable, hidden, disabled, loading, Tweaker-suspended or contextually inactive. */
  dragDisabled: boolean;
  /** A contextual layer without caller-confirmed eligible actions: hidden, closed and never activated. */
  inactive: boolean;
  /** Resolved side and bounds-space rect of the trigger's outside label, also written as --fab-trigger-label-*. */
  triggerLabel: TriggerLabel | null;
  /** Bounds-space rect of the visible status card, also written as --fab-status-*; null while it is empty. */
  status: FabRect | null;
  /** False when no free slot fits the status card and it takes the least covered spot instead; the renderer flags it. */
  statusClear: boolean;
  /** Paint-frame corner of the root box; geometry rects minus this origin are the root-local CSS values. */
  origin: FabPoint;
};

// Token sizes are only fallbacks until the rendered trigger and actions can be measured.
const triggerSize = (config: FabConfig): number => FAB_METRICS[config.size].trigger;
const actionSize = (config: FabConfig): number => FAB_METRICS[config.size].actionTarget;

const inset = (style: CSSStyleDeclaration, side: string): number => {
  const value = Number.parseFloat(style.getPropertyValue(`--fab-safe-${side}`));
  return Number.isFinite(value) ? value : 0;
};

const overlaps = (a: FabRect, b: FabRect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const isRef = (
  value: FabRect | RefObject<HTMLElement | null>,
): value is RefObject<HTMLElement | null> => 'current' in value;

/** Re-expresses a rect from one frame's local CSS px in another frame's local CSS px, through client space. */
const rebase = (rect: FabRect, from: Frame, to: Frame): FabRect => ({
  x: (from.left + rect.x * from.scaleX - to.left) / to.scaleX,
  y: (from.top + rect.y * from.scaleY - to.top) / to.scaleY,
  width: (rect.width * from.scaleX) / to.scaleX,
  height: (rect.height * from.scaleY) / to.scaleY,
});

/** Whole rendered box of a label: every wrapped line plus any overflow past its CSS width cap. */
const boxOf = (element: HTMLElement): Size => ({
  width: Math.max(element.offsetWidth, element.scrollWidth),
  height: Math.max(element.offsetHeight, element.scrollHeight),
});

/** Footprint of the trigger with its outside label on one side, the label centred on the cross axis. */
function labelBox(side: LabelSide, trigger: Size, label: Size): LabelledFootprint {
  const horizontal = side === 'left' || side === 'right';
  const width = horizontal
    ? trigger.width + LABEL_GAP + label.width
    : Math.max(trigger.width, label.width);
  const height = horizontal
    ? Math.max(trigger.height, label.height)
    : trigger.height + LABEL_GAP + label.height;
  // Trigger and label offsets inside the footprint.
  const tx =
    side === 'left' ? label.width + LABEL_GAP : horizontal ? 0 : (width - trigger.width) / 2;
  const ty =
    side === 'above' ? label.height + LABEL_GAP : horizontal ? (height - trigger.height) / 2 : 0;
  const lx =
    side === 'left' ? 0 : side === 'right' ? trigger.width + LABEL_GAP : (width - label.width) / 2;
  const ly =
    side === 'above'
      ? 0
      : side === 'below'
        ? trigger.height + LABEL_GAP
        : (height - label.height) / 2;
  return {
    dx: -tx,
    dy: -ty,
    width,
    height,
    fitsHome: false,
    label: { side, rect: { x: lx - tx, y: ly - ty, width: label.width, height: label.height } },
  };
}

/**
 * Resolves the trigger label side: the configured placement first, then the side with room beside the home spot,
 * then any side whose whole footprint fits, so a start-placed trigger never pushes its label past the start edge.
 */
function footprintOf(measured: Measured, config: FabConfig, home: FabRect): Footprint {
  const { trigger, triggerLabel: label, bounds, obstacles, rtl } = measured;
  if (!label || !(label.width > 0 && label.height > 0)) {
    return {
      dx: 0,
      dy: 0,
      width: trigger.width,
      height: trigger.height,
      label: null,
      fitsHome: true,
    };
  }
  const area: FabRect = {
    x: bounds.x + PAD,
    y: bounds.y + PAD,
    width: Math.max(0, bounds.width - 2 * PAD),
    height: Math.max(0, bounds.height - 2 * PAD),
  };
  // Outside turns toward the bounds interior; start and end follow the writing direction.
  const inward: LabelSide =
    home.x + home.width / 2 > bounds.x + bounds.width / 2 ? 'left' : 'right';
  const outward: LabelSide = inward === 'left' ? 'right' : 'left';
  const start: LabelSide = rtl ? 'right' : 'left';
  const end: LabelSide = rtl ? 'left' : 'right';
  const order: SideOrder =
    config.labelPlacement === 'above'
      ? ['above', 'below', inward, outward]
      : config.labelPlacement === 'below'
        ? ['below', 'above', inward, outward]
        : config.labelPlacement === 'start'
          ? [start, end, 'above', 'below']
          : config.labelPlacement === 'end'
            ? [end, start, 'above', 'below']
            : [inward, outward, 'above', 'below'];
  const boxes = order.map(side => labelBox(side, trigger, label));
  const within = (rect: FabRect): boolean =>
    rect.x >= area.x - FIT_TOLERANCE &&
    rect.y >= area.y - FIT_TOLERANCE &&
    rect.x + rect.width <= area.x + area.width + FIT_TOLERANCE &&
    rect.y + rect.height <= area.y + area.height + FIT_TOLERANCE;
  const atHome = boxes.find(box => {
    const rect: FabRect = {
      ...box.label.rect,
      x: home.x + box.label.rect.x,
      y: home.y + box.label.rect.y,
    };
    return within(rect) && obstacles.every(obstacle => !overlaps(rect, obstacle));
  });
  if (atHome) return { ...atHome, fitsHome: true };
  const fitting = boxes.find(
    box => box.width <= area.width + FIT_TOLERANCE && box.height <= area.height + FIT_TOLERANCE,
  );
  return fitting ?? labelBox(order[0], trigger, label);
}

/**
 * Clamps a dragged trigger into bounds, then takes the nearest clamped spot that clears every obstacle.
 * Candidates come from all obstacle edges at once, so escaping one obstacle never lands on another;
 * when no spot is free the trigger returns to its placeFabTrigger home.
 */
function boundRect(
  rect: FabRect,
  bounds: FabRect,
  obstacles: readonly FabRect[],
  home: FabPoint,
): FabRect {
  const clampX = (x: number) =>
    Math.min(Math.max(x, bounds.x), Math.max(bounds.x, bounds.x + bounds.width - rect.width));
  const clampY = (y: number) =>
    Math.min(Math.max(y, bounds.y), Math.max(bounds.y, bounds.y + bounds.height - rect.height));
  const clamped: FabRect = { ...rect, x: clampX(rect.x), y: clampY(rect.y) };
  const clear = (candidate: FabRect) => obstacles.every(obstacle => !overlaps(candidate, obstacle));
  if (clear(clamped)) return clamped;
  const xs = [
    clamped.x,
    ...obstacles.flatMap(obstacle => [obstacle.x - rect.width, obstacle.x + obstacle.width]),
  ];
  const ys = [
    clamped.y,
    ...obstacles.flatMap(obstacle => [obstacle.y - rect.height, obstacle.y + obstacle.height]),
  ];
  let best: FabRect | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const x of xs) {
    for (const y of ys) {
      const candidate: FabRect = { ...rect, x: clampX(x), y: clampY(y) };
      const moved = Math.hypot(candidate.x - clamped.x, candidate.y - clamped.y);
      if (moved < distance && clear(candidate)) {
        best = candidate;
        distance = moved;
      }
    }
  }
  return best ?? { ...rect, x: home.x, y: home.y };
}

/** Logical frame of the boundary; a scaled preview screen is normalised to its own CSS px. */
function frameOf(boundary: HTMLElement | null, positioning: FabConfig['positioning']): Frame {
  if (!boundary) {
    const viewport = window.visualViewport;
    return {
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      bounds: {
        x: viewport?.offsetLeft ?? 0,
        y: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
      },
    };
  }
  const rect = boundary.getBoundingClientRect();
  // Each axis keeps its own factor, so a scale(2, 1) owner chain never stretches the other axis.
  const scaleX = boundary.offsetWidth > 0 && rect.width > 0 ? rect.width / boundary.offsetWidth : 1;
  const scaleY =
    boundary.offsetHeight > 0 && rect.height > 0 ? rect.height / boundary.offsetHeight : 1;
  // Absolute layers live in the scrolled content box; fixed and sticky layers stay in the visible box.
  const scrolled = positioning === 'absolute';
  const scrollLeft = scrolled ? boundary.scrollLeft : 0;
  const scrollTop = scrolled ? boundary.scrollTop : 0;
  return {
    left: rect.left + (boundary.clientLeft - scrollLeft) * scaleX,
    top: rect.top + (boundary.clientTop - scrollTop) * scaleY,
    scaleX,
    scaleY,
    bounds: {
      x: scrollLeft,
      y: scrollTop,
      width: boundary.clientWidth,
      height: boundary.clientHeight,
    },
  };
}

const tokens = (value: string, separator: string): string[] =>
  value.split(separator).map(token => token.trim());
// Computed values that make an element the containing block of its fixed descendants: transforms, perspective,
// filters, layout or paint containment (content-visibility applies it too), and will-change hints for any of them.
// container-type alone never captures: dimensional query containers no longer apply layout containment.
const CAPTURING_PROPERTIES: readonly string[] = [
  'transform',
  'translate',
  'rotate',
  'scale',
  'perspective',
  'filter',
  'backdrop-filter',
  '-webkit-backdrop-filter',
];
const CAPTURING_CONTAIN: ReadonlySet<string> = new Set(['layout', 'paint', 'strict', 'content']);

function capturesFixed(style: CSSStyleDeclaration): boolean {
  const active = (name: string): boolean => {
    const value = style.getPropertyValue(name).trim();
    return value !== '' && value !== 'none';
  };
  if (CAPTURING_PROPERTIES.some(active)) return true;
  if (tokens(style.getPropertyValue('contain'), ' ').some(token => CAPTURING_CONTAIN.has(token)))
    return true;
  const visibility = style.getPropertyValue('content-visibility').trim();
  if (visibility === 'auto' || visibility === 'hidden') return true;
  return tokens(style.getPropertyValue('will-change'), ',').some(token =>
    CAPTURING_PROPERTIES.includes(token),
  );
}

/** Nearest ancestor capturing fixed descendants; the root's own static transform only contains its children. */
function fixedBlockOf(root: HTMLElement): HTMLElement | null {
  const view = root.ownerDocument.defaultView ?? window;
  for (let node = root.parentElement; node; node = node.parentElement) {
    if (capturesFixed(view.getComputedStyle(node))) return node;
  }
  return null;
}

/**
 * Frame of the containing block the CSS --fab-x/y resolve against, so measurement and paint share one space.
 * Fixed layers paint in the layout viewport, or in the nearest ancestor that captures them, which scrolls them like
 * an absolute block; absolute layers in their offset parent, or the initial containing block
 * when nothing is positioned; sticky layers and roots without a box keep the boundary frame.
 */
function paintFrameOf(
  root: HTMLElement,
  boundary: HTMLElement | null,
  frame: Frame,
  positioning: FabConfig['positioning'],
  owner: HTMLElement | null,
): Frame {
  if (positioning === 'fixed') {
    if (owner) return frameOf(owner, 'absolute');
    return boundary ? { left: 0, top: 0, scaleX: 1, scaleY: 1, bounds: frame.bounds } : frame;
  }
  if (!owner) return frame;
  if (owner === root.ownerDocument.documentElement) {
    const page = owner.getBoundingClientRect();
    return { left: page.left, top: page.top, scaleX: 1, scaleY: 1, bounds: frame.bounds };
  }
  return frameOf(owner, 'absolute');
}

/**
 * Element whose client box places the paint frame: the nearest ancestor capturing a fixed layer, or an absolute
 * layer's offset parent, the root element standing in for the initial containing block. Null when the layout viewport
 * or the boundary frame places it. Its box joins the bounded position tracking, so its moves remeasure.
 */
function paintOwnerOf(
  root: HTMLElement,
  boundary: HTMLElement | null,
  positioning: FabConfig['positioning'],
): HTMLElement | null {
  if (positioning === 'fixed') return fixedBlockOf(root);
  if (positioning !== 'absolute') return null;
  const block = root.offsetParent;
  if (!(block instanceof HTMLElement) || block === boundary) return null;
  const doc = root.ownerDocument;
  return block === doc.body && window.getComputedStyle(block).position === 'static'
    ? doc.documentElement
    : block;
}

const UNSUPPORTED_TRANSFORM =
  'GenUXFab: rotated, skewed, flipped or perspective-transformed owners are unsupported; only axis-aligned translation and positive scale can be measured.';
const AXIS_EPSILON = 1e-6;
type MatrixRule = Readonly<{
  length: number;
  scales: readonly number[];
  neutral: readonly number[];
  unit: readonly number[];
}>;
// matrix(a, b, c, d, e, f) and column-major matrix3d: exactly 6 or 16 finite terms; positive axis scales; cross,
// depth-mixing and perspective terms stay zero and w stays one.
const MATRIX_RULES: Readonly<Record<'2d' | '3d', MatrixRule>> = {
  '2d': { length: 6, scales: [0, 3], neutral: [1, 2], unit: [] },
  '3d': { length: 16, scales: [0, 5], neutral: [1, 2, 3, 4, 6, 7, 8, 9, 11], unit: [15] },
};

/**
 * Whether one computed style maps local to client px by translation and positive per-axis scale alone. A computed
 * perspective, a truncated or overlong matrix and any empty or non-finite term, translation included, all refuse.
 */
export function axisAligned(style: CSSStyleDeclaration): boolean {
  const perspective = style.getPropertyValue('perspective').trim();
  if (perspective !== '' && perspective !== 'none') return false;
  const transform = style.getPropertyValue('transform').trim();
  if (transform !== '' && transform !== 'none') {
    const match = /^matrix(3d)?[(]([^)]*)[)]$/.exec(transform);
    if (!match) return false;
    const m = (match[2] ?? '')
      .split(',')
      .map(term => (term.trim() === '' ? Number.NaN : Number(term)));
    const rule = MATRIX_RULES[match[1] ? '3d' : '2d'];
    if (m.length !== rule.length || !m.every(Number.isFinite)) return false;
    if (rule.scales.some(index => !((m[index] ?? 0) > AXIS_EPSILON))) return false;
    if (rule.neutral.some(index => !(Math.abs(m[index] ?? 1) <= AXIS_EPSILON))) return false;
    if (rule.unit.some(index => !(Math.abs((m[index] ?? 0) - 1) <= AXIS_EPSILON))) return false;
  }
  const rotate = style.getPropertyValue('rotate').trim();
  const angle = rotate.split(' ').pop() ?? '';
  if (rotate !== '' && rotate !== 'none' && Number.parseFloat(angle) !== 0) return false;
  const scale = style.getPropertyValue('scale').trim();
  return (
    scale === '' ||
    scale === 'none' ||
    scale.split(' ').every(value => Number.parseFloat(value) > 0)
  );
}

/**
 * Rotation, skew, flips and perspective cannot be inverted by per-axis frames, so measurement refuses them on the root
 * and every ancestor instead of silently treating them as an axis scale.
 */
function axisAlignedChain(root: HTMLElement): boolean {
  const view = root.ownerDocument.defaultView ?? window;
  for (let node: HTMLElement | null = root; node; node = node.parentElement) {
    if (!axisAligned(view.getComputedStyle(node))) return false;
  }
  return true;
}

/** Numeric signature of a paint frame: origin, per-axis scale and bounds, compared without object identity. */
const frameKey = (frame: Frame): string =>
  JSON.stringify([frame.left, frame.top, frame.scaleX, frame.scaleY, frame.bounds]);
// What one measurement pass resolved for the paint frame; external owner chain mutations compare against it.
type PaintTrack = Readonly<{
  boundary: HTMLElement | null;
  positioning: FabConfig['positioning'];
  aligned: boolean;
  owner: HTMLElement | null;
  key: string;
}>;

const toLocal = (rect: DOMRect, frame: Frame): FabRect => ({
  x: (rect.left - frame.left) / frame.scaleX,
  y: (rect.top - frame.top) / frame.scaleY,
  width: rect.width / frame.scaleX,
  height: rect.height / frame.scaleY,
});

/**
 * Measurement boundary. A viewport anchor means the window's visual viewport for every positioning; neither
 * containerRef nor data-fab-boundary overrides it. Preview exception: inside an inline mockup the layer never escapes
 * it and the mockup screen stands in for the viewport. Container and element anchors keep their own container (one
 * outside the mockup is ignored), then a marked boundary or the parent.
 */
function findBoundary(
  root: HTMLElement,
  props: GenUXFabProps,
  config: FabConfig,
): HTMLElement | null {
  const preview = root.parentElement?.closest<HTMLElement>(previewDocumentSelector) ?? null;
  if (config.anchor === 'viewport') return preview;
  const own = props.containerRef?.current ?? null;
  if (own && (!preview || preview.contains(own))) return own;
  return root.parentElement?.closest<HTMLElement>(BOUNDARY_SELECTOR) ?? root.parentElement;
}

const hasBox = (element: HTMLElement | null | undefined): element is HTMLElement =>
  element !== null && element !== undefined && element.offsetWidth > 0 && element.offsetHeight > 0;

/** Native control of a trigger or action host; the host itself carries sizes this hook wrote. */
const controlOf = (host: HTMLElement): HTMLElement =>
  host.matches('button,a') ? host : (host.querySelector<HTMLElement>('button,a') ?? host);

/**
 * Native border box of a control grown by any wrapped or overflowing inside content, read from the control itself
 * and never from a size this hook wrote to its host.
 */
const controlBox = (control: HTMLElement): Size => ({
  width: Math.max(
    control.offsetWidth,
    control.scrollWidth + control.offsetWidth - control.clientWidth,
  ),
  height: Math.max(
    control.offsetHeight,
    control.scrollHeight + control.offsetHeight - control.clientHeight,
  ),
});

/** A synchronous measurement copy: connected only while one pass reads it, then removed before paint. */
type Mirror = Readonly<{
  node: HTMLElement;
  control: HTMLElement | null;
  label: HTMLElement | null;
  row: boolean;
  /** Flows beside its live host; otherwise it measures under the dial stage. */
  beside: boolean;
}>;
type Plan = Readonly<{ action: FabAction; element: HTMLElement | null; mirror: Mirror | null }>;
// A copy never carries identities, form names or id references; cloneNode never copies listeners.
const COPY_EXCLUDED: readonly string[] = [
  'id',
  'name',
  'form',
  'for',
  'data-fab-action-id',
  'aria-controls',
  'aria-describedby',
  'aria-labelledby',
  'aria-owns',
  'aria-activedescendant',
];
const COPY_STYLE: Readonly<Record<string, string>> = {
  position: 'absolute',
  left: '0px',
  top: '0px',
  visibility: 'hidden',
  'pointer-events': 'none',
};

function scrub<T extends Element>(node: T): T {
  for (const element of [node, ...Array.from(node.querySelectorAll('*'))]) {
    for (const name of COPY_EXCLUDED) element.removeAttribute(name);
  }
  return node;
}

/** Inert, hidden and unpainted at its containing block's corner; it never takes focus, input or an observer. */
function dress(node: HTMLElement): HTMLElement {
  scrub(node);
  node.setAttribute('inert', '');
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('data-fab-measure', '');
  for (const [name, value] of Object.entries(COPY_STYLE)) node.style.setProperty(name, value);
  return node;
}

// Entrance, exit, press and icon layers only decorate, yet scrollable overflow counts their transformed boxes: a copy
// rests them at their settled target, so only real content, wrapped or overflowing, grows the measured box.
const SETTLED_VARIABLES: Readonly<Record<string, string>> = {
  '--fab-tx': '0px',
  '--fab-ty': '0px',
  '--fab-s': '1',
};
const DECORATIVE_LAYERS = [
  '.genux-button-content',
  '.genux-button-lip',
  '.genux-motion-layer',
  '.genux-fab-icon',
  '.genux-fab-icon-turn',
  '.genux-fab-icon-old',
  '.genux-fab-icon-new',
].join(',');
const SETTLED_LAYER: Readonly<Record<string, string>> = {
  transform: 'none',
  translate: 'none',
  rotate: 'none',
  scale: 'none',
};

/**
 * Settles a measurement copy only, before it connects: a fresh copy has no prior style to transition from, and its
 * important neutral transforms outrank any CSS animation. The live layer keeps its motion and styles untouched.
 */
function settle(node: HTMLElement): HTMLElement {
  for (const [name, value] of Object.entries(SETTLED_VARIABLES)) {
    node.style.setProperty(name, value, 'important');
  }
  node.querySelectorAll<HTMLElement | SVGElement>(DECORATIVE_LAYERS).forEach(layer => {
    for (const [name, value] of Object.entries(SETTLED_LAYER)) {
      layer.style.setProperty(name, value, 'important');
    }
  });
  return node;
}

/**
 * Trigger outside label copy at its intrinsic wrapped size: the side, rect, width cap and minimum height the last
 * geometry wrote never reach it; only the current usable measure and the label's own 20em cap bound it.
 */
function labelMirror(label: HTMLElement, measure: number): HTMLElement {
  const node = settle(dress(label.cloneNode(true) as HTMLElement));
  node.style.setProperty('width', 'max-content', 'important');
  node.style.setProperty('height', 'auto', 'important');
  node.style.setProperty('min-height', '0px', 'important');
  node.style.setProperty('max-width', `min(20em, ${measure}px)`, 'important');
  return node;
}

/** A status card shows only while its status or alert region has content, like the stylesheet's visible card rule. */
const statusShown = (status: HTMLElement): boolean =>
  Array.from(status.querySelectorAll('[role=status], [role=alert]')).some(
    region => region.childNodes.length > 0,
  );

/**
 * Status card copy at its intrinsic wrapped size: the rect, width and height cap the last placement wrote never reach
 * it; only the current usable measure and the card's own 20em cap bound it. The copy stays aria-hidden and inert.
 */
function statusMirror(status: HTMLElement, measure: number): HTMLElement {
  const node = settle(dress(status.cloneNode(true) as HTMLElement));
  node.style.setProperty('box-sizing', 'border-box', 'important');
  node.style.setProperty('bottom', 'auto', 'important');
  node.style.setProperty('width', 'max-content', 'important');
  node.style.setProperty('height', 'auto', 'important');
  node.style.setProperty('max-width', `min(20em, ${measure}px)`, 'important');
  node.style.setProperty('max-height', 'none', 'important');
  return node;
}

const coverage = (a: FabRect, b: FabRect): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

type StatusPlacement = Readonly<{ rect: FabRect; clear: boolean }>;
type Slot = Readonly<{ top: number; bottom: number }>;

/**
 * Status card rect inside the padded usable bounds, resolved before the action layout from the trigger and obstacles
 * alone, so the layout reserves it as one more obstacle and never feeds back. Columns align to the trigger's end and
 * start edges, then the padded edges; the trigger, LABEL_GAP around it, and every obstacle split each column into free
 * vertical slots. The card takes the roomiest slot, earlier columns first on ties, capped at its intrinsic height, at
 * the slot end away from the trigger. While actions paint, each slot first keeps `reserve` px for them, so a menu or
 * sheet still scrolls in the rest; only when that leaves under `minimum` does the card use the whole slot. A capped
 * card scrolls inside. An open modal menu's card renders inside its dialog, so this placement never sees it. With no
 * free slot, or a padded area too small for any card, the least covered spot is returned unclear, never claimed as
 * free geometry.
 */
function placeStatus(
  size: Size,
  bounds: FabRect,
  trigger: FabRect,
  obstacles: readonly FabRect[],
  reserve: number,
  minimum: number,
): StatusPlacement {
  const area: FabRect = {
    x: bounds.x + PAD,
    y: bounds.y + PAD,
    width: Math.max(0, bounds.width - 2 * PAD),
    height: Math.max(0, bounds.height - 2 * PAD),
  };
  const width = Math.min(size.width, area.width);
  const lower = area.y + area.height;
  if (!(width > FIT_TOLERANCE && area.height > FIT_TOLERANCE)) {
    return {
      rect: { x: area.x, y: area.y, width, height: Math.min(size.height, area.height) },
      clear: false,
    };
  }
  const reserved: readonly FabRect[] = [
    {
      x: trigger.x - LABEL_GAP,
      y: trigger.y - LABEL_GAP,
      width: trigger.width + 2 * LABEL_GAP,
      height: trigger.height + 2 * LABEL_GAP,
    },
    ...obstacles,
  ];
  const clampX = (x: number): number => Math.min(Math.max(x, area.x), area.x + area.width - width);
  const columns = [trigger.x + trigger.width - width, trigger.x, area.x, area.x + area.width].map(
    clampX,
  );
  const middle = trigger.y + trigger.height / 2;
  const slotsAt = (x: number): Slot[] => {
    const slots: Slot[] = [];
    let top = area.y;
    const blockers = reserved
      .filter(o => o.height > 0 && o.x < x + width && x < o.x + o.width)
      .sort((a, b) => a.y - b.y);
    for (const o of blockers) {
      const end = Math.min(o.y, lower);
      if (end > top + FIT_TOLERANCE) slots.push({ top, bottom: end });
      top = Math.max(top, o.y + o.height);
    }
    if (lower > top + FIT_TOLERANCE) slots.push({ top, bottom: lower });
    return slots;
  };
  let best: FabRect | null = null;
  let bestHeight = 0;
  for (const keep of reserve > 0 ? [reserve, 0] : [0]) {
    for (const x of columns) {
      for (const slot of slotsAt(x)) {
        const height = Math.min(size.height, slot.bottom - slot.top - keep);
        if (!(height > bestHeight + FIT_TOLERANCE)) continue;
        best = { x, y: slot.top >= middle ? slot.bottom - height : slot.top, width, height };
        bestHeight = height;
      }
    }
    if (best && bestHeight >= Math.min(size.height, minimum) - FIT_TOLERANCE) break;
  }
  if (best) return { rect: best, clear: true };
  const height = Math.min(size.height, area.height);
  const covered = (rect: FabRect): number =>
    reserved.reduce((sum, other) => sum + coverage(rect, other), 0);
  const least = columns
    .flatMap(x => [
      { x, y: area.y, width, height },
      { x, y: lower - height, width, height },
    ])
    .reduce<FabRect>((pick, rect) => (covered(rect) < covered(pick) ? rect : pick), {
      x: columns[0] ?? area.x,
      y: area.y,
      width,
      height,
    });
  return { rect: least, clear: false };
}

/** Trigger host copy at its intrinsic size; its control never reads the trigger box this hook wrote. */
function triggerMirror(host: HTMLElement): HTMLElement {
  const node = settle(dress(host.cloneNode(true) as HTMLElement));
  node.style.setProperty('width', 'max-content');
  node.style.setProperty('height', 'auto');
  return node;
}

/**
 * Explicit rows at their intrinsic size: a copy of the rendered row beside it flows at max-content, capped by the
 * usable measure, so neither the resolved panel width nor an assigned host size feeds the next layout.
 */
function rowMirror(host: HTMLElement, measure: number): Mirror {
  const node = settle(dress(host.cloneNode(true) as HTMLElement));
  node.style.setProperty('width', 'max-content');
  node.style.setProperty('max-width', `${measure}px`);
  node.style.setProperty('height', 'auto');
  return { node, control: controlOf(node), label: null, row: true, beside: true };
}

// Geometry the hook wrote back onto a rendered dial: placement attributes, union and offset variables, wrapper sizes.
const ASSIGNED_ATTRIBUTES: readonly string[] = [
  'data-fab-control-geometry',
  'data-fab-label-geometry',
];
const ASSIGNED_VARIABLE = /^--fab-(?:action|control|label)-(?:x|y|width|height)$/;
const ASSIGNED_SIZES: readonly string[] = ['width', 'height', 'min-width', 'min-height'];

/**
 * Rendered dials at their intrinsic size: a settled copy beside the live dial keeps its current control, label, group
 * heading and metadata but drops every assigned geometry, so a shortened label measures smaller on the next pass.
 */
function liveDialMirror(host: HTMLElement): Mirror {
  const node = host.cloneNode(true) as HTMLElement;
  for (const name of ASSIGNED_ATTRIBUTES) node.removeAttribute(name);
  for (const name of Array.from(node.style)) {
    if (ASSIGNED_VARIABLE.test(name)) node.style.removeProperty(name);
  }
  const parts = node.querySelectorAll<HTMLElement>(
    ':scope > :is(.genux-fab-control-slot, .genux-fab-label)',
  );
  for (const part of [node, ...Array.from(parts)]) {
    for (const name of ASSIGNED_SIZES) part.style.removeProperty(name);
  }
  settle(dress(node));
  node.style.setProperty('width', 'max-content');
  node.style.setProperty('height', 'auto');
  return {
    node,
    control: controlOf(node),
    label: node.querySelector<HTMLElement>('.genux-fab-label'),
    row: false,
    beside: true,
  };
}

/** The icon-only master control a dial renders for an outside name: the same native control without its text. */
function iconOnly(control: HTMLElement): void {
  control.classList.add('genux-icon-button');
  const content = control.querySelector('.genux-button-content');
  for (const child of Array.from(content?.childNodes ?? [])) {
    const icon =
      child instanceof Element &&
      (child.localName === 'svg' || child.querySelector('svg') !== null);
    if (!icon) child.remove();
  }
}

/**
 * Requested dial anatomy rebuilt from the current row DOM. A row renders every name as native text and moves the
 * group heading and metadata below its control; a dial, as GenUXFab renders it, keeps an icon-only control for an
 * outside name and holds the group heading, name and metadata together in one .genux-fab-label container.
 */
function dialMirror(host: HTMLElement, action: FabAction, config: FabConfig): Mirror {
  const doc = host.ownerDocument;
  const node = doc.createElement('div');
  node.className = host.className;
  node.style.cssText = host.style.cssText;
  node.dataset.fabMode = 'dial';
  dress(node);
  const slot = host.querySelector(':scope > .genux-fab-control-slot');
  const copy = slot ? scrub(slot.cloneNode(true) as HTMLElement) : null;
  const control = copy?.querySelector<HTMLElement>('button,a') ?? null;
  const outside =
    config.content === 'icon-only' &&
    config.labelPlacement !== 'inside' &&
    action.icon !== undefined;
  if (control && outside) iconOnly(control);
  if (copy) node.append(copy);
  const label = doc.createElement('span');
  label.className = 'genux-fab-label';
  const heading = host.querySelector(':scope > .genux-fab-group-name');
  if (heading) label.append(scrub(heading.cloneNode(true) as Element));
  if (outside) {
    const text = doc.createElement('span');
    text.className = 'genux-fab-label-text';
    text.textContent = action.label;
    label.append(text);
  }
  host
    .querySelectorAll(
      ':scope > :is(.genux-fab-action-description, .genux-fab-action-shortcut, .genux-fab-action-reason)',
    )
    .forEach(meta => label.append(scrub(meta.cloneNode(true) as Element)));
  const named = label.childNodes.length > 0;
  if (named) node.append(label);
  settle(node);
  return { node, control, label: named ? label : null, row: false, beside: false };
}

/**
 * Shallow copy of the layer root beside it, carrying the requested dial layout: the rendered fallback's row styles key
 * on the root attributes, so dial copies measure under this stage without touching the live root or its scroll state.
 */
function dialStage(root: HTMLElement, config: FabConfig): HTMLElement {
  const stage = dress(root.cloneNode(false) as HTMLElement);
  stage.dataset.fabLayout = config.layout;
  stage.dataset.fabAdaptation = config.adaptation;
  stage.dataset.fabDirection = config.direction;
  const layer = root.ownerDocument.createElement('div');
  layer.className = 'genux-fab-actions';
  layer.dataset.fabMode = 'dial';
  stage.append(layer);
  return stage;
}

/** One action's measurement: its copy when the requested anatomy differs from the rendered one, else its live DOM. */
function readAction(
  { action, element, mirror }: Plan,
  previous: Measured,
  fallback: number,
): FabMeasuredAction {
  const group = action.group ? { group: action.group } : {};
  const button = mirror ? mirror.control : element ? controlOf(element) : null;
  if (!hasBox(button)) {
    // A collapsed or hidden action keeps its last real size until its current control can be read again.
    const last = previous.actions.find(entry => entry.id === action.id);
    if (!last) return { id: action.id, width: fallback, height: fallback, ...group };
    return {
      id: action.id,
      width: last.width,
      height: last.height,
      ...(last.labelWidth !== undefined ? { labelWidth: last.labelWidth } : {}),
      ...(last.labelHeight !== undefined ? { labelHeight: last.labelHeight } : {}),
      ...group,
    };
  }
  // Wrapped or overflowing inside content counts in full, read natively from the control.
  const box = controlBox(button);
  if (mirror?.row) {
    // Rows flow at natural height: the intrinsic copy holds a group header, description, shortcut and reason in full.
    const row = boxOf(mirror.node);
    return {
      id: action.id,
      width: Math.max(box.width, row.width),
      height: Math.max(box.height, row.height),
      ...group,
    };
  }
  // Dials measure the native control alone and the one outside label container separately: its whole wrapped box,
  // overflow past the CSS width cap included, so the collision footprint never undercounts it.
  const label = mirror
    ? mirror.label
    : (element?.querySelector<HTMLElement>('.genux-fab-label') ?? null);
  const outside = label && !button.contains(label) && hasBox(label) ? boxOf(label) : null;
  return {
    id: action.id,
    width: box.width,
    height: box.height,
    ...(outside ? { labelWidth: outside.width, labelHeight: outside.height } : {}),
    ...group,
  };
}

/** Only an on-screen keyboard makes the unzoomed visual viewport shorter than the layout viewport. */
const keyboardOpen = (viewport: VisualViewport): boolean =>
  Math.round(viewport.height * viewport.scale) < window.innerHeight;

/**
 * Docs-only dormancy of an inline preview document: no positive client box, or one wholly outside its owner document's
 * viewport, while focus stays outside it. Its FAB then skips the cloning pass; a focused preview keeps measuring.
 */
function previewDormant(preview: HTMLElement): boolean {
  const doc = preview.ownerDocument;
  const active = doc.activeElement;
  if (active && preview.contains(active)) return false;
  const rect = preview.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return true;
  const view = doc.defaultView ?? window;
  return (
    rect.bottom <= 0 ||
    rect.right <= 0 ||
    rect.top >= view.innerHeight ||
    rect.left >= view.innerWidth
  );
}

function measureLayer(
  root: HTMLElement,
  boundary: HTMLElement | null,
  frame: Frame,
  paint: Frame,
  props: GenUXFabProps,
  config: FabConfig,
  actions: readonly FabAction[],
  previewed: boolean,
  spatial: boolean,
  previous: Measured,
): Measured {
  const style = window.getComputedStyle(root);
  const viewport = window.visualViewport;
  const { x, y, width } = frame.bounds;
  let { height } = frame.bounds;
  // The on-screen keyboard shrinks the visual viewport; never place the FAB below it. A page merely
  // scrolled past a mockup keeps a full-height visual viewport, so the mockup keeps its size.
  if (boundary && viewport && keyboardOpen(viewport)) {
    const visibleBottom = (viewport.offsetTop + viewport.height - frame.top) / frame.scaleY;
    if (visibleBottom > y && visibleBottom < y + height) height = visibleBottom - y;
  }
  const top = inset(style, 'top');
  const right = inset(style, 'right');
  const bottom = inset(style, 'bottom');
  const left = inset(style, 'left');
  const fallback = actionSize(config);
  const host = root.querySelector<HTMLElement>('.genux-fab-trigger');
  // The trigger reads a settled copy beside its live host, so an easing icon or press layer never inflates it.
  const triggerCopy = host ? triggerMirror(host) : null;
  // Extended content sizes the trigger: read its intrinsic width, never the width last written to the host.
  const extended = config.type === 'extended' || config.content !== 'icon-only';
  // The trigger's outside label is a direct child of the layer; its whole wrapped box joins the placement footprint.
  // It reads a settled copy free of the side, rect, width cap and minimum height the last geometry wrote, bounded by
  // the current usable measure alone, so a shortened label shrinks and a widened boundary recovers. A removed label
  // measures as none; a hidden one keeps its last size.
  const outerLabel = root.querySelector<HTMLElement>(':scope > .genux-fab-label');
  // Labels and explicit rows share the current usable measure, never the width last written to the root.
  const rowMeasure = Math.max(0, width - left - right - 2 * PAD);
  const labelCopy = hasBox(outerLabel) ? labelMirror(outerLabel, rowMeasure) : null;
  let triggerLabel: Size | null = outerLabel ? previous.triggerLabel : null;
  // A visible status card reads a settled copy at its intrinsic wrapped size, bounded by the same usable measure; an
  // empty or unrendered card measures as none.
  const statusNode = root.querySelector<HTMLElement>(':scope > .genux-fab-status');
  const statusCopy =
    statusNode && hasBox(statusNode) && statusShown(statusNode)
      ? statusMirror(statusNode, rowMeasure)
      : null;
  let status: Size | null = null;
  // The drag toolbar's wrapped native box: only the root width it wraps in, never a geometry this hook writes onto
  // it, sizes it. A removed or hidden toolbar measures as none.
  const toolbar = root.querySelector<HTMLElement>(':scope > .genux-fab-drag');
  const toolbarSize: Size | null = hasBox(toolbar)
    ? { width: toolbar.offsetWidth, height: toolbar.offsetHeight }
    : null;
  const hosts = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-fab-action-id]').forEach(element => {
    const id = element.dataset.fabActionId;
    if (id) hosts.set(id, element);
  });
  // Each action measures the anatomy its requested layout renders, never a box the last geometry assigned. Explicit
  // rows (menu, sheet, modal, spatial) read an intrinsic copy of the rendered row; a requested dial reads a settled
  // copy of the rendered dial, or, while an adaptive fallback renders it as a row, a dial copy rebuilt from that row's
  // current DOM.
  const explicitRows =
    config.modal ||
    spatial ||
    config.type === 'menu' ||
    config.layout === 'floating-menu' ||
    config.layout === 'sheet' ||
    config.adaptation === 'sheet';
  const plans = actions.map((action): Plan => {
    const element = hosts.get(action.id);
    const live = hasBox(element) ? element : null;
    if (!live) return { action, element: null, mirror: null };
    const dial = live.dataset.fabMode === 'dial';
    // A dial still rendered under explicit rows is a stale frame: it keeps its last real size until its row renders.
    if (dial && explicitRows) return { action, element: null, mirror: null };
    const mirror = dial
      ? liveDialMirror(live)
      : explicitRows
        ? rowMirror(live, rowMeasure)
        : dialMirror(live, action, config);
    return { action, element: live, mirror };
  });
  const stage = plans.some(plan => plan.mirror?.beside === false) ? dialStage(root, config) : null;
  let trigger: Size = previous.trigger;
  let measured: readonly FabMeasuredAction[] = [];
  try {
    if (host && triggerCopy) host.after(triggerCopy);
    if (outerLabel && labelCopy) outerLabel.after(labelCopy);
    if (statusNode && statusCopy) statusNode.after(statusCopy);
    for (const { element, mirror } of plans) {
      if (!element || !mirror) continue;
      if (mirror.beside) element.after(mirror.node);
      else stage?.firstElementChild?.append(mirror.node);
    }
    if (stage) root.after(stage);
    const control = triggerCopy ? controlOf(triggerCopy) : null;
    if (hasBox(control)) {
      const size = controlBox(control);
      // The nominal size token is the minimum; wrapped inside text grows the measured height past it.
      trigger = {
        width: extended ? size.width : control.offsetWidth,
        height: Math.max(triggerSize(config), size.height),
      };
    }
    if (hasBox(labelCopy)) triggerLabel = boxOf(labelCopy);
    if (hasBox(statusCopy)) status = boxOf(statusCopy);
    measured = plans.map(plan => readAction(plan, previous, fallback));
  } finally {
    triggerCopy?.remove();
    labelCopy?.remove();
    statusCopy?.remove();
    for (const { mirror } of plans) mirror?.node.remove();
    stage?.remove();
  }
  // Everything returned lives in the paint frame where --fab-x/y resolve; boundary-local values convert into it.
  const toPaint = (rect: FabRect): FabRect => (paint === frame ? rect : rebase(rect, frame, paint));
  const anchor = config.anchor === 'element' ? props.anchorRef?.current : null;
  const obstacles = (props.obstacles ?? []).flatMap(obstacle =>
    isRef(obstacle)
      ? obstacle.current
        ? [toLocal(obstacle.current.getBoundingClientRect(), paint)]
        : []
      : [toPaint(obstacle)],
  );
  const box = boundary?.getBoundingClientRect();
  // Safe areas are trimmed here once; the root box then covers exactly these usable bounds.
  const bounds = toPaint({
    x: x + left,
    y: y + top,
    width: Math.max(0, width - left - right),
    height: Math.max(0, height - top - bottom),
  });
  // Fixed and absolute roots are placed at the usable bounds; a sticky root stays in flow, so its rendered box is the origin.
  const placed =
    config.positioning === 'sticky'
      ? hasBox(root)
        ? toLocal(root.getBoundingClientRect(), paint)
        : previous.origin
      : bounds;
  const rtl = style.direction === 'rtl';
  // The drag toolbar paints at the root's top inline-end corner, root-local px being paint px; its wrapped native box
  // joins the obstacles, so the trigger, its label, the actions and every drag clear it.
  const toolbarRect: FabRect | null = toolbarSize
    ? {
        x: rtl ? placed.x : placed.x + bounds.width - toolbarSize.width,
        y: placed.y,
        width: toolbarSize.width,
        height: toolbarSize.height,
      }
    : null;
  return {
    bounds,
    origin: { x: placed.x, y: placed.y },
    anchor: anchor ? toLocal(anchor.getBoundingClientRect(), paint) : null,
    trigger,
    triggerLabel,
    status,
    actions: measured,
    obstacles: toolbarRect ? [...obstacles, toolbarRect] : obstacles,
    rtl,
    offscreen: box ? box.bottom <= 0 || box.top >= window.innerHeight : false,
    previewed,
  };
}

// Geometry-relevant data the measurement key projects; onAction and every other callback are never read.
const KEY_ACTION_FIELDS: readonly string[] = [
  'id',
  'label',
  'description',
  'icon',
  'group',
  'order',
  'visible',
  'disabled',
  'disabledReason',
  'loading',
  'badge',
  'actionType',
  'permission',
  'confirmation',
  'shortcut',
  'closeBehavior',
  'offlineAvailable',
  'href',
  'target',
];
const KEY_GROUP_FIELDS: readonly string[] = [
  'id',
  'label',
  'direction',
  'layout',
  'startAngle',
  'endAngle',
];
const KEY_TRIGGER_FIELDS: readonly string[] = [
  'label',
  'icon',
  'openIcon',
  'badge',
  'online',
  'loading',
  'disabled',
  'visible',
  'counter',
  'progress',
];

/** Primitive values of the named fields only; callbacks, nested objects and their toJSON hooks stay untouched. */
const keyFields = (
  source: Readonly<Record<string, unknown>>,
  names: readonly string[],
): unknown[] =>
  names.map(name => {
    const value = source[name];
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? value
      : null;
  });

/**
 * Stable measurement key of projected primitive data: a new onAction or a recreated but equal action list never
 * measures again, and serialising never calls caller code. The config is normalizeFabOptions output, rebuilt from
 * validated primitives into fresh frozen objects, so no caller toJSON hook is reachable through it. A config that
 * still cannot serialise gets a fresh key and so measures on every render, as before.
 */
function anatomyKey(
  props: GenUXFabProps,
  config: FabConfig,
  actions: readonly FabAction[],
): unknown {
  try {
    return JSON.stringify({
      config,
      actions: actions.map(action => keyFields(action, KEY_ACTION_FIELDS)),
      groups: props.groups?.map(group => keyFields(group, KEY_GROUP_FIELDS)) ?? null,
      trigger: keyFields(props, KEY_TRIGGER_FIELDS),
    });
  } catch {
    return {};
  }
}

/** Measured placement, scroll visibility and drag for one FAB layer; geometry itself stays in fab/geometry. */
export function useFabPosition(
  props: GenUXFabProps,
  config: FabConfig,
  rootRef: RefObject<HTMLDivElement | null>,
  actions: readonly FabAction[],
  open: boolean,
  requestOpen: (next: boolean, reason: string) => void,
  /** Whether actions paint now: open or retaining their exit; only then does the status card leave room for them. */
  shown = open,
): FabPosition {
  const { environment, surface } = useAdaptive();
  // Living-room surfaces are driven by a remote: always the spatial menu.
  const spatial = String(surface) === 'living-room';
  const [measured, setMeasured] = useState<Measured>(() => {
    const size = triggerSize(config);
    const target = actionSize(config);
    return {
      bounds: { x: 0, y: 0, width: environment.width, height: environment.height },
      origin: { x: 0, y: 0 },
      anchor: null,
      trigger: { width: size, height: size },
      triggerLabel: null,
      status: null,
      actions: actions.map(action => ({
        id: action.id,
        width: target,
        height: target,
        ...(action.group ? { group: action.group } : {}),
      })),
      obstacles: [],
      rtl: false,
      offscreen: false,
      previewed: false,
    };
  });
  const [scroll, setScroll] = useState<Scroll>({ direction: 'none', nearTop: true });
  const [focused, setFocused] = useState(false);
  const [internal, setInternal] = useState<FabPoint | null>(props.defaultDragPosition ?? null);
  // Effective reference elements; observers and scroll listeners rebind whenever measuring resolves new ones.
  const [boundaryElement, setBoundaryElement] = useState<HTMLElement | null>(null);
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  // The element placing the paint frame; its box joins the bounded position tracking below.
  const [paintElement, setPaintElement] = useState<HTMLElement | null>(null);
  // An owner chain the axis-aligned frames cannot represent; the render rejects it with a public error.
  const [unsupported, setUnsupported] = useState(false);
  const tweakerOpen = useTweakerOpen();
  const latest = useRef({ props, config, actions, open, requestOpen, spatial });
  const frameRef = useRef<Frame | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // Mirrors dragDisabled for handlers created before the latest render.
  const blockedRef = useRef(false);
  const measuredRef = useRef(measured);
  const previewRef = useRef(false);
  // What the last measurement pass resolved for the paint frame; the owner chain observer compares against it.
  const paintTrackRef = useRef<PaintTrack | null>(null);
  const suppressClickRef = useRef(false);
  useIsomorphicLayoutEffect(() => {
    latest.current = { props, config, actions, open, requestOpen, spatial };
    measuredRef.current = measured;
  });

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const { props: current, config: options, actions: list, spatial: remote } = latest.current;
    const boundary = findBoundary(root, current, options);
    // Inside a mockup a fixed layer must not escape to the host page; it lays out absolutely in the preview.
    const previewDocument =
      root.parentElement?.closest<HTMLElement>(previewDocumentSelector) ?? null;
    const previewed = previewDocument !== null;
    const positioning =
      previewed && options.positioning === 'fixed' ? 'absolute' : options.positioning;
    // Rotated, skewed, flipped or perspective owners cannot map through per-axis frames; the render rejects them.
    const aligned = axisAlignedChain(root);
    setUnsupported(!aligned);
    if (!aligned) {
      paintTrackRef.current = { boundary, positioning, aligned, owner: null, key: '' };
      return;
    }
    const frame = frameOf(boundary, positioning);
    const owner = paintOwnerOf(root, boundary, positioning);
    const paint = paintFrameOf(root, boundary, frame, positioning, owner);
    // The owner chain observer compares against exactly what this pass resolved.
    paintTrackRef.current = { boundary, positioning, aligned, owner, key: frameKey(paint) };
    setBoundaryElement(boundary);
    setPaintElement(owner);
    setAnchorElement(options.anchor === 'element' ? (current.anchorRef?.current ?? null) : null);
    previewRef.current = previewed;
    frameRef.current = paint;
    // An unfocused preview document out of the host viewport, or without a box, skips the cloning pass and keeps its
    // last valid geometry; only the cheap preview and offscreen flags follow, so a fixed layer never escapes the
    // mockup. Tracking above stays bound, so scroll, resize and the position loop measure it once it shows again.
    if (previewDocument && previewDormant(previewDocument)) {
      const box = boundary?.getBoundingClientRect();
      const offscreen = box ? box.bottom <= 0 || box.top >= window.innerHeight : false;
      setMeasured(prev =>
        prev.previewed === previewed && prev.offscreen === offscreen
          ? prev
          : { ...prev, previewed, offscreen },
      );
      return;
    }
    const next = measureLayer(
      root,
      boundary,
      frame,
      paint,
      current,
      options,
      list,
      previewed,
      remote,
      measuredRef.current,
    );
    // A collapsed or hidden boundary measures empty; keep the last valid layout so geometry never sees zero.
    if (!(next.bounds.width > 0 && next.bounds.height > 0)) return;
    // Only numeric changes commit state, so measuring after every render cannot loop.
    setMeasured(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [rootRef]);

  // Measurement invalidates on geometry-relevant data, never on fresh object or callback identities; content the data
  // cannot see (fonts, tokens, translated text, busy visuals) reaches it through the observers below.
  const anatomy = anatomyKey(props, config, actions);
  useIsomorphicLayoutEffect(measure, [
    measure,
    spatial,
    anatomy,
    open,
    environment.width,
    environment.height,
    props.obstacles,
    props.anchorRef,
    props.containerRef,
  ]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let pending = 0;
    // Scrolls and content mutations coalesce to at most one measurement per animation frame.
    const schedule = () => {
      if (pending !== 0) return;
      pending = window.requestAnimationFrame(() => {
        pending = 0;
        measure();
      });
    };
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    const fixed = [
      root,
      boundaryElement,
      anchorElement,
      ...(props.obstacles ?? []).map(obstacle => (isRef(obstacle) ? obstacle.current : null)),
    ];
    const observed = new Set<Element>();
    // Live hosts, native controls, slots and labels are observed directly, so font, token and text changes measure
    // again without a data change; remounted parts bind on insertion and detached ones are released.
    const bind = () => {
      if (!observer) return;
      const live = new Set<Element>(
        [...fixed, ...Array.from(root.querySelectorAll<HTMLElement>(OBSERVED_PARTS))].filter(
          (target): target is HTMLElement =>
            target !== null && target.closest(MEASURE_COPY) === null,
        ),
      );
      observed.forEach(target => {
        if (live.has(target)) return;
        observer.unobserve(target);
        observed.delete(target);
      });
      live.forEach(target => {
        if (observed.has(target)) return;
        observer.observe(target);
        observed.add(target);
      });
    };
    bind();
    const copy = (node: Node): boolean => node instanceof Element && node.matches(MEASURE_COPY);
    const inCopy = (node: Node): boolean =>
      ((node instanceof Element ? node : node.parentElement)?.closest(MEASURE_COPY) ?? null) !==
      null;
    // Measurement copies connect and disconnect within one synchronous pass; their records never measure again.
    const mutations =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(records => {
            const relevant = records.filter(
              record =>
                !inCopy(record.target) &&
                !(
                  record.type === 'childList' &&
                  [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].every(copy)
                ),
            );
            if (relevant.length === 0) return;
            if (relevant.some(record => record.type === 'childList')) bind();
            schedule();
          });
    mutations?.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...OBSERVED_ATTRIBUTES],
    });
    // Owner direction (semantic dir, RTL classes, inline direction) and the paint frame owner (an ancestor that starts
    // or stops capturing a fixed layer, a new offset parent, a moved or rescaled owner) change on the root or any
    // ancestor without touching the data key. One observer watches only that chain, no subtree; a record measures
    // again only when the computed direction, the axis-aligned verdict, the effective owner or its numeric frame
    // differs from what the last pass resolved, even while no owner was tracked, so this hook's own root style writes
    // never feed back.
    const view = root.ownerDocument.defaultView ?? window;
    const paintChanged = (): boolean => {
      const track = paintTrackRef.current;
      if (!track) return true;
      const aligned = axisAlignedChain(root);
      if (aligned !== track.aligned) return true;
      if (!aligned) return false;
      const owner = paintOwnerOf(root, track.boundary, track.positioning);
      if (owner !== track.owner) return true;
      const frame = frameOf(track.boundary, track.positioning);
      const paint = paintFrameOf(root, track.boundary, frame, track.positioning, owner);
      return frameKey(paint) !== track.key;
    };
    const directions =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            const rtl = view.getComputedStyle(root).direction === 'rtl';
            if (rtl !== measuredRef.current.rtl || paintChanged()) schedule();
          });
    for (let node: HTMLElement | null = root; node; node = node.parentElement) {
      directions?.observe(node, { attributes: true, attributeFilter: [...DIRECTION_ATTRIBUTES] });
    }
    const viewport = window.visualViewport;
    // Scroll does not bubble: one capture listener sees every scrolling ancestor of the anchor, obstacles and
    // boundary.
    const onAncestorScroll = schedule;
    const onFocusIn = () => setFocused(true);
    const onFocusOut = (event: FocusEvent) =>
      setFocused(event.relatedTarget instanceof Node && root.contains(event.relatedTarget));
    // Docs-only: focus entering the nearest inline preview document, outside this root too, lifts its dormancy without
    // any resize or scroll; measuring synchronously applies the focused-preview exception before a key moves the layer.
    const previewDocument =
      root.parentElement?.closest<HTMLElement>(previewDocumentSelector) ?? null;
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    root.ownerDocument.addEventListener('scroll', onAncestorScroll, {
      capture: true,
      passive: true,
    });
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    previewDocument?.addEventListener('focusin', measure);
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      directions?.disconnect();
      observed.clear();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      root.ownerDocument.removeEventListener('scroll', onAncestorScroll, { capture: true });
      if (pending !== 0) window.cancelAnimationFrame(pending);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      previewDocument?.removeEventListener('focusin', measure);
    };
  }, [rootRef, measure, open, props.obstacles, boundaryElement, anchorElement]);

  useEffect(() => {
    const boundary = boundaryElement;
    // A mockup scrolls on its own; host page scrolling must not hide or collapse a FAB inside it.
    const element =
      props.scrollRef?.current ??
      (boundary && (previewRef.current || boundary.scrollHeight > boundary.clientHeight)
        ? boundary
        : null);
    const read = () => (element ? element.scrollTop : window.scrollY);
    let last = read();
    const onScroll = () => {
      const y = read();
      const delta = y - last;
      last = y;
      const { config: options, open: isOpen, requestOpen: request } = latest.current;
      if (delta !== 0 && options.closeOnScroll && isOpen) request(false, 'scroll');
      setScroll(prev => {
        const direction = delta === 0 ? prev.direction : delta > 0 ? 'down' : 'up';
        const nearTop = y <= NEAR_TOP;
        return prev.direction === direction && prev.nearTop === nearTop
          ? prev
          : { direction, nearTop };
      });
      measure();
    };
    const target: HTMLElement | Window = element ?? window;
    onScroll();
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [
    measure,
    props.scrollRef,
    props.containerRef,
    config.positioning,
    config.anchor,
    boundaryElement,
  ]);

  const visibility = config.visibility;
  const scrolledDown = scroll.direction === 'down' && !scroll.nearTop;
  const wantsHide =
    props.visible === false ||
    ((visibility === 'hide-on-scroll-down' || visibility === 'show-on-scroll-up') &&
      scrolledDown) ||
    (visibility === 'sticky-boundary' && measured.offscreen);
  const wantsCollapse =
    (visibility === 'collapse-on-scroll' && scrolledDown) ||
    (visibility === 'expand-near-top' && !scroll.nearTop);
  // Contextual FABs are caller-owned: type or visibility 'contextual' shows and activates the layer only while the
  // caller passes visible={true} and at least one action is eligible now. Otherwise the layer stays hidden even when
  // focused or open, closes, and swallows activation, so the option is never a plain speed-dial alias.
  const contextual = config.type === 'contextual' || visibility === 'contextual';
  const eligible = actions.some(
    action =>
      action.visible !== false &&
      action.permission !== false &&
      action.disabled !== true &&
      actionUnavailableReason(action, props.online) === undefined,
  );
  const inactive = contextual && !(props.visible === true && eligible);
  // Critical or focused FABs and an open layer never disappear; they collapse instead.
  const protectedFab = config.critical || focused || open;
  const hidden = inactive || (wantsHide && !protectedFab);
  const collapsed = !open && (wantsCollapse || (wantsHide && protectedFab));
  // One movement policy for pointer drag, keyboard steps, reset and the renderer's alternative movement buttons.
  // External loading blocks movement only when the layer disables itself while loading.
  const dragDisabled =
    !config.draggable ||
    hidden ||
    props.disabled === true ||
    (props.loading === true && config.disableWhileLoading) ||
    tweakerOpen;

  const bare = useMemo(
    () =>
      placeFabTrigger({
        bounds: measured.bounds,
        ...(measured.anchor ? { anchor: measured.anchor } : {}),
        width: measured.trigger.width,
        height: measured.trigger.height,
        options: config,
        obstacles: measured.obstacles,
        rtl: measured.rtl,
      }),
    [measured, config],
  );
  const footprint = useMemo(() => footprintOf(measured, config, bare), [measured, config, bare]);
  const placed = useMemo<FabRect>(() => {
    if (footprint.label === null || footprint.fitsHome) return bare;
    // No side fits beside the bare home: place the whole footprint so the trigger label stays inside the bounds.
    const box = placeFabTrigger({
      bounds: measured.bounds,
      ...(measured.anchor ? { anchor: measured.anchor } : {}),
      width: footprint.width,
      height: footprint.height,
      options: config,
      obstacles: measured.obstacles,
      rtl: measured.rtl,
    });
    return { ...bare, x: box.x - footprint.dx, y: box.y - footprint.dy };
  }, [bare, footprint, measured, config]);
  const dragPoint = config.draggable ? (props.dragPosition ?? internal) : null;
  const dragX = dragPoint?.x;
  const dragY = dragPoint?.y;
  const trigger = useMemo<FabRect>(() => {
    if (dragX === undefined || dragY === undefined) return placed;
    // The dragged footprint, trigger label included, is clamped and cleared of obstacles as one box.
    const rect = boundRect(
      {
        x: dragX + footprint.dx,
        y: dragY + footprint.dy,
        width: footprint.width,
        height: footprint.height,
      },
      measured.bounds,
      measured.obstacles,
      { x: placed.x + footprint.dx, y: placed.y + footprint.dy },
    );
    return {
      x: rect.x - footprint.dx,
      y: rect.y - footprint.dy,
      width: measured.trigger.width,
      height: measured.trigger.height,
    };
  }, [placed, dragX, dragY, measured, footprint]);
  const triggerLabel = useMemo<TriggerLabel | null>(() => {
    if (footprint.label === null) return null;
    const { side, rect } = footprint.label;
    return { side, rect: { ...rect, x: trigger.x + rect.x, y: trigger.y + rect.y } };
  }, [footprint, trigger]);
  // Actions avoid the trigger's own outside label like any other obstacle.
  const obstacles = useMemo(
    () => (triggerLabel ? [...measured.obstacles, triggerLabel.rect] : measured.obstacles),
    [measured.obstacles, triggerLabel],
  );
  // The visible status card is placed before the layout from the trigger, its label and every obstacle, never from the
  // action geometry, so closed or hidden actions never push it and nothing feeds back. While actions paint it leaves
  // one row with its padding and gaps for them; an open modal menu moves its card into the dialog instead.
  const metrics = FAB_METRICS[config.size];
  const statusPlacement = useMemo(() => {
    if (!measured.status) return null;
    const reserve = shown && !config.modal ? metrics.actionTarget + 2 * PAD + 2 * metrics.gap : 0;
    return placeStatus(
      measured.status,
      measured.bounds,
      trigger,
      obstacles,
      reserve,
      metrics.actionTarget,
    );
  }, [measured.status, measured.bounds, trigger, obstacles, shown, config.modal, metrics]);
  const status = statusPlacement?.rect ?? null;
  // The layout treats the placed card as one more obstacle, so a menu or sheet scrolls in the remaining free slot.
  const layoutObstacles = useMemo(
    () => (status && !config.modal ? [...obstacles, status] : obstacles),
    [obstacles, status, config.modal],
  );
  // A menu type lays out as a floating menu whatever layout was requested, so it never falls back to a dial.
  const layoutOptions = useMemo(
    () =>
      config.type === 'menu' && config.layout !== 'floating-menu' && config.layout !== 'sheet'
        ? normalizeFabOptions({ ...config, layout: 'floating-menu' })
        : config,
    [config],
  );
  const geometry = useMemo(
    () =>
      layoutFab({
        bounds: measured.bounds,
        trigger,
        actions: measured.actions,
        options: layoutOptions,
        ...(props.groups ? { groups: props.groups } : {}),
        obstacles: layoutObstacles,
        rtl: measured.rtl,
        spatial,
      }),
    [measured, trigger, layoutOptions, props.groups, spatial, layoutObstacles],
  );
  const positionRef = useRef({ measured, placed, trigger, footprint, point: dragPoint });
  useIsomorphicLayoutEffect(() => {
    positionRef.current = { measured, placed, trigger, footprint, point: dragPoint };
    blockedRef.current = dragDisabled;
  });

  const style = useMemo(
    () =>
      ({
        // A fixed layer inside a mockup stays absolute so it never escapes to the host viewport.
        position:
          measured.previewed && config.positioning === 'fixed' ? 'absolute' : config.positioning,
        // The root box covers the usable bounds in the paint frame; children paint root-local from its origin.
        '--fab-root-x': `${measured.origin.x}px`,
        '--fab-root-y': `${measured.origin.y}px`,
        '--fab-root-width': `${measured.bounds.width}px`,
        '--fab-root-height': `${measured.bounds.height}px`,
        // Renderer CSS bounds label measures by the usable width the geometry places into.
        '--fab-usable-width': `${measured.bounds.width}px`,
        '--fab-x': `${trigger.x - measured.origin.x}px`,
        '--fab-y': `${trigger.y - measured.origin.y}px`,
        '--fab-trigger-width': `${trigger.width}px`,
        '--fab-trigger-height': `${trigger.height}px`,
        // The outside trigger label paints at its resolved side, in the same space as --fab-x/y.
        ...(triggerLabel
          ? {
              '--fab-trigger-label-x': `${triggerLabel.rect.x - measured.origin.x}px`,
              '--fab-trigger-label-y': `${triggerLabel.rect.y - measured.origin.y}px`,
              '--fab-trigger-label-width': `${triggerLabel.rect.width}px`,
              '--fab-trigger-label-height': `${triggerLabel.rect.height}px`,
            }
          : {}),
        // The placed status card paints at its rect in the same space; oversized content scrolls inside it.
        ...(status
          ? {
              '--fab-status-x': `${status.x - measured.origin.x}px`,
              '--fab-status-y': `${status.y - measured.origin.y}px`,
              '--fab-status-width': `${status.width}px`,
              '--fab-status-height': `${status.height}px`,
            }
          : {}),
      }) as CSSProperties,
    [
      config.positioning,
      measured.previewed,
      measured.origin,
      measured.bounds,
      trigger,
      triggerLabel,
      status,
    ],
  );

  // An inactive contextual layer closes whenever it is open.
  useEffect(() => {
    if (inactive && open) latest.current.requestOpen(false, 'contextual');
  }, [inactive, open]);

  // Activation guard: an inactive contextual layer swallows presses and clicks, programmatic ones included.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !inactive) return undefined;
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    root.addEventListener('click', swallow, true);
    root.addEventListener('pointerdown', swallow, true);
    return () => {
      root.removeEventListener('click', swallow, true);
      root.removeEventListener('pointerdown', swallow, true);
    };
  }, [rootRef, inactive]);

  // Position-only moves of the anchor, a ref obstacle, the boundary or the paint frame's owner (a transformed ancestor
  // capturing a fixed layer, or an offset parent) fire neither resize nor scroll; translating or scaling that owner
  // moves the paint frame even for a viewport-anchored fixed layer. While the layer is visible, open or closed, one
  // animation frame loop compares their numeric boxes and remeasures only when one changed; this hook's own root
  // style writes never move them, so the loop settles. It stops when the layer hides, unmounts or its tracked
  // elements change.
  useEffect(() => {
    if (hidden) return undefined;
    const elements = [
      anchorElement,
      boundaryElement,
      paintElement,
      ...(props.obstacles ?? []).map(obstacle => (isRef(obstacle) ? obstacle.current : null)),
    ].filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return undefined;
    const read = (): number[] =>
      elements.flatMap(element => {
        const rect = element.getBoundingClientRect();
        return [rect.left, rect.top, rect.width, rect.height];
      });
    let last = read();
    let frame = 0;
    const tick = () => {
      const next = read();
      if (next.some((value, index) => value !== last[index])) {
        last = next;
        measure();
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [hidden, anchorElement, boundaryElement, paintElement, props.obstacles, measure]);

  // Controlled dragPosition: the parent is authoritative and only receives the request.
  const commit = useCallback((point: FabPoint) => {
    const { measured: current, placed: home, footprint: box } = positionRef.current;
    const { props: owner } = latest.current;
    // The footprint, trigger label included, is what must stay in bounds and clear of obstacles.
    const rect = boundRect(
      { x: point.x + box.dx, y: point.y + box.dy, width: box.width, height: box.height },
      current.bounds,
      current.obstacles,
      { x: home.x + box.dx, y: home.y + box.dy },
    );
    const next = { x: rect.x - box.dx, y: rect.y - box.dy };
    if (owner.dragPosition === undefined) setInternal(next);
    owner.onPositionChange?.(next);
  }, []);

  const movePosition = useCallback(
    (dx: number, dy: number) => {
      if (blockedRef.current) return;
      const current = positionRef.current.trigger;
      commit({ x: current.x + dx, y: current.y + dy });
    },
    [commit],
  );

  // Unconditional return to the home placement; the public reset and drag cancellation share it.
  const returnHome = useCallback(() => {
    const { props: owner } = latest.current;
    const home = positionRef.current.placed;
    if (owner.dragPosition === undefined) setInternal(null);
    owner.onPositionChange?.({ x: home.x, y: home.y });
  }, []);

  const resetPosition = useCallback(() => {
    if (!blockedRef.current) returnHome();
  }, [returnHome]);

  // Ends an active drag without committing it: the layer returns exactly to where the drag started.
  const cancelDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    suppressClickRef.current = false;
    if (drag.target.hasPointerCapture(drag.id)) drag.target.releasePointerCapture(drag.id);
    if (!drag.moved) return;
    if (drag.restore) commit(drag.restore);
    else returnHome();
  }, [commit, returnHome]);

  // Losing eligibility mid-drag (disabled, loading, suspended, hidden) cancels the drag back to its start.
  useEffect(() => {
    if (dragDisabled) cancelDrag();
  }, [dragDisabled, cancelDrag]);

  const dragHandlers = useMemo<HTMLAttributes<HTMLDivElement>>(() => {
    if (!config.draggable) return {};
    const finish = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== event.pointerId) return;
      // A cancelled drag returns exactly to its start, including the untouched home placement.
      if (cancelled) {
        cancelDrag();
        return;
      }
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      // A completed drag is not a press: the click that follows must not run the trigger action.
      suppressClickRef.current = drag.moved;
    };
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        // Disabled, loading, suspended or hidden layers never start a drag.
        if (event.button !== 0 || dragRef.current || blockedRef.current) return;
        suppressClickRef.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
        const { trigger: current, point } = positionRef.current;
        dragRef.current = {
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          origin: { x: current.x, y: current.y },
          restore: point,
          moved: false,
          target: event.currentTarget,
        };
      },
      onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        if (blockedRef.current) {
          cancelDrag();
          return;
        }
        // Client deltas convert per axis into the paint frame's local px.
        const dx = (event.clientX - drag.startX) / (frameRef.current?.scaleX ?? 1);
        const dy = (event.clientY - drag.startY) / (frameRef.current?.scaleY ?? 1);
        if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        drag.moved = true;
        commit({ x: drag.origin.x + dx, y: drag.origin.y + dy });
      },
      onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => finish(event, false),
      onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => finish(event, true),
      // Capture lost without pointerup or pointercancel (removed node, stolen capture) cancels back to the start.
      onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.id === event.pointerId) cancelDrag();
      },
      onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
      onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
        // The renderer may already have handled this key; moving here too would step twice. Blocked layers never move.
        if (event.defaultPrevented || blockedRef.current) return;
        const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
        const moves: Readonly<Record<string, readonly [number, number]>> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const move = moves[event.key];
        if (move) {
          event.preventDefault();
          movePosition(move[0], move[1]);
        } else if (event.key === 'Home') {
          event.preventDefault();
          resetPosition();
        }
      },
    };
  }, [config.draggable, commit, movePosition, resetPosition, cancelDrag]);

  // A rejected owner transform surfaces as a public render error, never as a silently wrong axis scale.
  if (unsupported) throw new Error(UNSUPPORTED_TRANSFORM);

  return {
    geometry,
    hidden,
    collapsed,
    style,
    dragHandlers,
    resetPosition,
    movePosition,
    dragDisabled,
    inactive,
    triggerLabel,
    status,
    statusClear: statusPlacement?.clear ?? true,
    origin: measured.origin,
  };
}
