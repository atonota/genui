/**
 * Opt-in directional navigation inside an explicit living-room boundary.
 * The adapter never writes the central input modality and adds no ring; the
 * TV caller asks the central owner from onNavigate after a handled move.
 * Enter/Space stay native clicks and Escape is never intercepted.
 */
export type SpatialDirection = 'up' | 'down' | 'left' | 'right';
export type SpatialRect = Readonly<{ left: number; top: number; right: number; bottom: number }>;
export type SpatialCandidate<T> = Readonly<{ item: T; rect: SpatialRect }>;
export type SpatialMove = Readonly<{
  from: HTMLElement;
  to: HTMLElement;
  direction: SpatialDirection;
}>;

export type SpatialNavigationOptions = Readonly<{
  /** Only an explicit living-room product surface enables the adapter. */
  surface: 'web' | 'living-room';
  /**
   * Active top scope inside the boundary, such as an open dialog; null means no scope handles
   * arrows. Defaults to the top open modal, or the boundary when none is open.
   */
  scope?: () => Element | null;
  onNavigate?: (move: SpatialMove) => void;
  /** Focus the nearest remaining target when the focused one disappears. */
  refocusOnRemoval?: boolean;
}>;

const directions: Readonly<Record<string, SpatialDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Native buttons, links, fields and comboboxes that opted in; fields keep their editing arrows. */
export const spatialTargetSelector = [
  'button',
  'a[href]',
  'input:not([type=hidden])',
  'select',
  'textarea',
  '[role=combobox]',
]
  .map(target => `${target}[data-spatial-target]`)
  .join(',');

const compositeRoles = [
  'combobox',
  'grid',
  'gridcell',
  'listbox',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radiogroup',
  'searchbox',
  'slider',
  'spinbutton',
  'tab',
  'tablist',
  'textbox',
  'toolbar',
  'tree',
  'treegrid',
  'treeitem',
];
/** Multi-line editing, native pickers and explicit composite roles own every arrow key. */
const ownsArrows = [
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable=false])',
  '[role=separator][tabindex]',
  ...compositeRoles.map(role => `[role=${role}]`),
].join(',');
/** Single-line text keeps Left/Right for the caret at every position; only Up/Down may leave. */
const verticalEscapeInputs = new Set(['text', 'search', 'email', 'url', 'tel', 'password']);
/** Activation-only inputs have no arrow behavior of their own. */
const directionalInputs = new Set(['checkbox', 'button', 'submit', 'reset', 'image']);

/** Radio, range, number, date-like and other inputs keep every arrow native. */
function keepsArrowNative(target: Element, direction: SpatialDirection): boolean {
  if (target.closest(ownsArrows)) return true;
  if (target.localName !== 'input') return false;
  const type = ((target as HTMLInputElement).type || 'text').toLowerCase();
  if (directionalInputs.has(type)) return false;
  if (verticalEscapeInputs.has(type)) return direction === 'left' || direction === 'right';
  return true;
}

/** Misalignment across the axis costs more than distance along it. */
const crossWeight = 2;
const edgeTolerance = 1;

const gap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, b0 - a1, a0 - b1);
const middle = (rect: SpatialRect, horizontal: boolean) =>
  horizontal ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2;

/** Pure geometry: nearest candidate lying beyond the origin edge in direction. */
export function findSpatialTarget<T>(
  origin: SpatialRect,
  direction: SpatialDirection,
  candidates: readonly SpatialCandidate<T>[],
): T | null {
  const horizontal = direction === 'left' || direction === 'right';
  let best: T | null = null;
  let bestScore = Infinity;
  let bestDrift = Infinity;
  for (const { item, rect } of candidates) {
    const ahead =
      direction === 'right'
        ? rect.left - origin.right
        : direction === 'left'
          ? origin.left - rect.right
          : direction === 'down'
            ? rect.top - origin.bottom
            : origin.top - rect.bottom;
    if (ahead < -edgeTolerance) continue;
    const across = horizontal
      ? gap(origin.top, origin.bottom, rect.top, rect.bottom)
      : gap(origin.left, origin.right, rect.left, rect.right);
    const score = Math.max(0, ahead) + across * crossWeight;
    const drift = Math.abs(middle(rect, !horizontal) - middle(origin, !horizontal));
    if (score < bestScore || (score === bestScore && drift < bestDrift)) {
      best = item;
      bestScore = score;
      bestDrift = drift;
    }
  }
  return best;
}

/** Disabled, inert, hidden, unrendered and non-sequential targets are skipped, ancestors included. */
export function isSpatialTargetEligible(
  element: Element | null | undefined,
  scope: Element,
): element is HTMLElement {
  if (!element?.isConnected || !scope.contains(element) || !element.matches(spatialTargetSelector))
    return false;
  if (
    element.matches(':disabled') ||
    element.closest('[inert],[hidden],[aria-hidden=true],[aria-disabled=true]')
  )
    return false;
  if ((element as HTMLElement).tabIndex < 0 || element.getClientRects().length === 0) return false;
  return element.ownerDocument.defaultView?.getComputedStyle(element).visibility !== 'hidden';
}

const controllerSelector = '[data-adaptive-shell]';
const surfaceAttribute = 'data-adaptive-surface';

/**
 * Nearest-controller ownership: a nested Shell controller or a nearer declared non-TV surface
 * owns its subtree, while same-surface wrappers inside the boundary still navigate. A stale
 * non-TV surface declared on or above the boundary owns nothing, so no marker can leak.
 */
export function isSpatialBoundaryOwned(element: Element, boundary: Element): boolean {
  const declared = boundary.closest(`[${surfaceAttribute}]`);
  if (declared && declared.getAttribute(surfaceAttribute) !== 'living-room') return false;
  let node: Element | null = element;
  while (node !== boundary) {
    if (!node || node.matches(controllerSelector)) return false;
    const surface = node.getAttribute(surfaceAttribute);
    if (surface !== null && surface !== 'living-room') return false;
    node = node.parentElement;
  }
  return true;
}

const modalSelector = 'dialog[open], [aria-modal=true]';

/**
 * The last rendered open modal owns arrows: the boundary when none is open or it holds the
 * boundary, the modal when it lies inside, and null when it is outside the boundary.
 */
export function topModalScope(boundary: Element): Element | null {
  const modals = Array.from(boundary.ownerDocument.querySelectorAll(modalSelector)).filter(
    modal => !modal.closest('[hidden],[inert]') && modal.getClientRects().length > 0,
  );
  const top = modals[modals.length - 1];
  if (!top || top.contains(boundary)) return boundary;
  return boundary.contains(top) ? top : null;
}

export class SpatialNavigationAdapter {
  private readonly boundary: Element;
  private readonly options: SpatialNavigationOptions;
  private readonly view: Document['defaultView'];
  private readonly observer: MutationObserver | null;
  private lastFocused: HTMLElement | null = null;
  private lastPointer: HTMLElement | null = null;
  /** A real pointermove picked lastPointer since the last Tab or handled move. */
  private pointerOrigin = false;
  private lastRect: SpatialRect | null = null;
  private suspended = false;
  private disposed = false;

  constructor(boundary: Element, options: SpatialNavigationOptions) {
    this.boundary = boundary;
    this.options = options;
    this.view = boundary.ownerDocument.defaultView;
    const enabled = options.surface === 'living-room';
    this.observer =
      enabled && this.view?.MutationObserver
        ? new this.view.MutationObserver(this.onMutation)
        : null;
    if (!enabled) return;
    boundary.addEventListener('keydown', this.onKeyDown);
    boundary.addEventListener('focusin', this.onFocusIn);
    boundary.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.view?.addEventListener('blur', this.suspend);
    this.view?.addEventListener('focus', this.resume);
    this.observer?.observe(boundary, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'disabled',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-disabled',
        'tabindex',
        'data-spatial-target',
        'class',
        'style',
      ],
    });
  }

  readonly suspend = (): void => {
    this.suspended = true;
    this.lastPointer = null;
    this.pointerOrigin = false;
  };

  readonly resume = (): void => {
    this.suspended = false;
  };

  /** Idempotent; removes every listener and observer. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.boundary.removeEventListener('keydown', this.onKeyDown);
    this.boundary.removeEventListener('focusin', this.onFocusIn);
    this.boundary.removeEventListener('pointermove', this.onPointerMove);
    this.view?.removeEventListener('blur', this.suspend);
    this.view?.removeEventListener('focus', this.resume);
    this.lastFocused = this.lastPointer = null;
  }

  private scope(): Element | null {
    const scope = this.options.scope ? this.options.scope() : topModalScope(this.boundary);
    return scope && this.boundary.contains(scope) && isSpatialBoundaryOwned(scope, this.boundary)
      ? scope
      : null;
  }

  /** Eligible in scope and owned by this boundary's own controller, never a nested one. */
  private owns(element: Element | null | undefined, scope: Element): element is HTMLElement {
    return (
      isSpatialTargetEligible(element, scope) && isSpatialBoundaryOwned(element, this.boundary)
    );
  }

  private candidates(scope: Element): HTMLElement[] {
    return Array.from(scope.querySelectorAll(spatialTargetSelector)).filter(
      (element): element is HTMLElement => this.owns(element, scope),
    );
  }

  private readonly onKeyDown = (event: Event): void => {
    const key = event as KeyboardEvent;
    // Tab hands navigation back to sequential focus, so the pointer no longer leads.
    if (key.key === 'Tab') this.pointerOrigin = false;
    const direction = directions[key.key];
    if (!direction || this.disposed || this.suspended || key.defaultPrevented || key.isComposing)
      return;
    if (key.altKey || key.ctrlKey || key.metaKey || key.shiftKey) return;
    const scope = this.scope();
    const target = key.target as Element | null;
    if (!scope || !target?.closest || !scope.contains(target)) return;
    if (keepsArrowNative(target, direction)) return;
    // Keys bubbling from a nested web or TV Shell belong to that controller, not this one.
    if (!isSpatialBoundaryOwned(target, this.boundary)) return;
    const active = this.boundary.ownerDocument.activeElement;
    // After a real pointer move the remote continues from the pointed target, then from focus.
    const order = this.pointerOrigin
      ? [this.lastPointer, active, this.lastFocused]
      : [active, this.lastFocused, this.lastPointer];
    const origin = order.find(candidate => this.owns(candidate, scope)) as HTMLElement | undefined;
    if (!origin) return;
    const next = findSpatialTarget(
      origin.getBoundingClientRect(),
      direction,
      this.candidates(scope)
        .filter(item => item !== origin)
        .map(item => ({ item, rect: item.getBoundingClientRect() })),
    );
    // Without an actual candidate the key keeps its native behavior.
    if (!next) return;
    key.preventDefault();
    this.pointerOrigin = false;
    next.focus();
    this.options.onNavigate?.({ from: origin, to: next, direction });
  };

  private readonly onFocusIn = (event: Event): void => {
    const target = event.target as Element | null;
    if (!this.owns(target, this.boundary)) return;
    this.lastFocused = target;
    this.lastRect = target.getBoundingClientRect();
  };

  private readonly onPointerMove = (event: Event): void => {
    if (this.suspended) return;
    const target = (event.target as Element | null)?.closest?.(spatialTargetSelector);
    // Records the origin only; focus and actions stay untouched.
    if (!this.owns(target, this.boundary)) return;
    this.lastPointer = target;
    this.pointerOrigin = true;
  };

  private readonly onMutation = (): void => {
    if (this.lastPointer && !this.owns(this.lastPointer, this.boundary)) this.lastPointer = null;
    const lost = this.lastFocused;
    if (!lost || this.owns(lost, this.boundary)) return;
    this.lastFocused = null;
    const doc = this.boundary.ownerDocument;
    const active = doc.activeElement;
    const rect = this.lastRect;
    const scope = this.scope();
    if (!this.options.refocusOnRemoval || this.suspended || !rect || !scope) return;
    if (active && active !== doc.body && active !== lost) return;
    let best: HTMLElement | null = null;
    let distance = Infinity;
    for (const candidate of this.candidates(scope)) {
      const next = candidate.getBoundingClientRect();
      const d = Math.hypot(
        middle(next, true) - middle(rect, true),
        middle(next, false) - middle(rect, false),
      );
      if (d < distance) {
        best = candidate;
        distance = d;
      }
    }
    best?.focus();
  };
}

/** Attaches to one explicit boundary; returns an idempotent detach. */
export function attachSpatialNavigation(
  boundary: Element,
  options: SpatialNavigationOptions,
): () => void {
  const adapter = new SpatialNavigationAdapter(boundary, options);
  return () => adapter.dispose();
}
