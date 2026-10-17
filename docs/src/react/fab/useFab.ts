import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import { FAB_MOTION, actionUnavailableReason, resolveFabActions } from '../../fab/options';
import type { GenUXFabProps, FabAction, FabConfig, FabState } from '../../fab/types';
import { requestSpatialInputModality } from '../../input-modality';
import { useTweakerOpen } from '../GenUXTweaker';
import { useI18n } from '../useI18n';

type Phase = Extract<FabState, 'closed' | 'opening' | 'open' | 'closing'>;
type Press = { pointerId: number; x: number; y: number; timer: number | null; detach: () => void };
type Transition = { target: Phase; start: number };
type Activation = { admitted: boolean; completion: Promise<boolean> };
type FabController = {
  rootRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLDivElement | null>;
  actions: readonly FabAction[];
  open: boolean;
  state: FabState;
  busyId: string | null;
  /** Every action id whose handler is still in flight, in start order; busyId is the first. */
  busyIds: readonly string[];
  error: string;
  confirmation: FabAction | null;
  suspended: boolean;
  requestOpen: (next: boolean, reason: string) => void;
  /** Resolves true only when the handler of a still offered action settled; it never claims a server write. */
  invoke: (action: FabAction, confirmed?: boolean) => Promise<boolean>;
  /** Admits or refuses synchronously; an admitted id is reserved before any handler runs. */
  activate: (action: FabAction, confirmed?: boolean) => Activation;
  /** Motion phase alone, independent of the busy and disabled state. */
  phase: Phase;
  /** The single roving tab stop among the effectively eligible actions. */
  activeActionId: string | null;
  cancelConfirmation: () => void;
  triggerHandlers: HTMLAttributes<HTMLDivElement>;
  groupHandlers: HTMLAttributes<HTMLDivElement>;
  actionKeyDown: (event: ReactKeyboardEvent<HTMLElement>, id: string) => void;
  /** Focuses the real native trigger control, never its wrapper. */
  focusTrigger: () => void;
  /** Focuses the first enabled action of an open panel; true only when focus actually landed there. */
  focusFirstAction: () => boolean;
};

const LONG_PRESS_MS = FAB_MOTION.longPress;
const LONG_PRESS_SLOP = FAB_MOTION.dragThreshold;
const GESTURE_THRESHOLD = FAB_MOTION.gesture;
// Typeahead memory shares the long-press token, so one central value owns both windows.
const TYPEAHEAD_MS = FAB_MOTION.longPress;
type ActionHandler = FabAction['onAction'];
type Review = { handler: ActionHandler; stamp: string; generation: number };
// The fields a user reviews and activates; callbacks are excluded so host re-renders keep the meaning.
const actionStamp = (action: FabAction): string =>
  JSON.stringify([
    action.id,
    action.actionType ?? 'action',
    action.href ?? '',
    action.target ?? '_self',
    action.label,
    action.description ?? '',
    action.confirmation ?? false,
  ]);
const ITEM_TARGET = `button, a[href], [tabindex]`;
const EDITABLE = `input, textarea, select, [contenteditable=''], [contenteditable='true']`;
const SPATIAL_BOUNDARY = `[data-adaptive-layout='living-room'], [data-adaptive-surface='living-room']`;
// Only these types own a primary action that runs without a listed action.
const PRIMARY_TYPES: ReadonlySet<string> = new Set(['single', 'extended']);
const MODIFIER_ALIASES: Readonly<Record<string, string>> = {
  control: 'ctrl',
  cmd: 'meta',
  command: 'meta',
  option: 'alt',
};
const KEY_ALIASES: Readonly<Record<string, string>> = { esc: 'escape', space: ' ', plus: '+' };

// Layout effects keep handler state current before paint; the server falls back silently.
const useLiveEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// The document realm may differ from this module's, so DOM checks avoid instanceof.
const asElement = (target: EventTarget | null): Element | null =>
  target !== null && 'closest' in target ? (target as Element) : null;

const isEnabled = (item: HTMLElement): boolean =>
  item.getAttribute('aria-disabled') !== 'true' && !item.hasAttribute('disabled');

/** Accessible name for typeahead; icon-only actions carry it in aria-label. */
const itemName = (item: HTMLElement): string =>
  (item.getAttribute('aria-label')?.trim() || item.textContent?.trim() || '').toLowerCase();

/** The caller's own thrown message; an empty result falls back to a translated label. */
function messageOf(cause: unknown): string {
  const text =
    typeof cause === 'string'
      ? cause
      : typeof cause === 'object' && cause !== null
        ? (cause as { message?: unknown }).message
        : undefined;
  return typeof text === 'string' && text.trim() !== '' ? text : '';
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Reduced motion settles the visual state at once; named durations come from the central motion tokens. */
function motionMs(
  reduced: boolean,
  value: FabConfig['motion']['duration'],
  scale: 'open' | 'close',
): number {
  if (reduced) return 0;
  const named: Readonly<Record<string, number>> = FAB_MOTION[scale];
  return typeof value === 'number' ? Math.max(0, value) : (named[value] ?? 0);
}

/** Focusable action targets in DOM order. */
function actionItems(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  const items = new Set<HTMLElement>();
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('.genux-fab-action'))) {
    const target = node.matches(ITEM_TARGET) ? node : node.querySelector<HTMLElement>(ITEM_TARGET);
    if (target) items.add(target);
  }
  return [...items];
}

/** One roving tab stop: the focused target takes tabIndex 0, every other action -1. */
function setRoving(items: readonly HTMLElement[], target: HTMLElement): void {
  for (const item of items) item.tabIndex = item === target ? 0 : -1;
}

/** Ids that may hold the roving tab stop: offered, available, enabled and not held by running work. */
function eligibleIds(
  actions: readonly FabAction[],
  online: boolean,
  busyIds: readonly string[],
  holdOthers: boolean,
): string[] {
  return actions
    .filter(
      action =>
        action.disabled !== true &&
        actionUnavailableReason(action, online) === undefined &&
        !busyIds.includes(action.id) &&
        !(holdOthers && busyIds.some(id => id !== action.id)),
    )
    .map(action => action.id);
}

const actionIdOf = (item: Element): string | null =>
  item.closest('[data-fab-action-id]')?.getAttribute('data-fab-action-id') ?? null;

type Box = { left: number; top: number; right: number; bottom: number };

/** Union of the rendered boxes; zero-size boxes are skipped, so nothing rendered yields null. */
function boxUnion(elements: readonly Element[]): Box | null {
  let union: Box | null = null;
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    union = union
      ? {
          left: Math.min(union.left, rect.left),
          top: Math.min(union.top, rect.top),
          right: Math.max(union.right, rect.right),
          bottom: Math.max(union.bottom, rect.bottom),
        }
      : { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }
  return union;
}

const inBox = (box: Box, x: number, y: number): boolean =>
  x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;

// Unlike a button, an anchor menuitem has no native Space activation.
const ANCHOR_ITEM = `a[href][role='menuitem']`;

function matchesShortcut(shortcut: string, event: KeyboardEvent): boolean {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map(part => part.trim());
  const raw = parts.pop();
  if (!raw) return false;
  const key = KEY_ALIASES[raw] ?? raw;
  const modifiers = new Set(parts.map(part => MODIFIER_ALIASES[part] ?? part));
  if (modifiers.has('ctrl') !== event.ctrlKey || modifiers.has('meta') !== event.metaKey)
    return false;
  if (modifiers.has('alt') !== event.altKey || modifiers.has('shift') !== event.shiftKey)
    return false;
  const code = event.code.toLowerCase();
  return event.key.toLowerCase() === key || code === `key${key}` || code === `digit${key}`;
}

export function useFab(props: GenUXFabProps, config: FabConfig): FabController {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const suspended = useTweakerOpen();
  const { t } = useI18n();
  const online = props.online ?? true;
  const actions = useMemo(
    () => resolveFabActions(props.actions ?? [], online),
    [props.actions, online],
  );
  const blocked =
    Boolean(props.disabled) ||
    props.visible === false ||
    (config.disableWhileLoading && Boolean(props.loading));
  const controlled = props.open !== undefined;
  const [internalOpen, setInternalOpen] = useState(() => Boolean(props.defaultOpen));
  const requested = controlled ? Boolean(props.open) : internalOpen;
  const open = requested && !blocked && actions.length > 0;
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed');
  const [busyIds, setBusyIds] = useState<readonly string[]>(() => Object.freeze([]));
  const busyId = busyIds[0] ?? null;
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<FabAction | null>(null);
  // Effective eligibility, running work included, decides the single roving tab stop.
  const eligible = useMemo(
    () => eligibleIds(actions, online, busyIds, config.disableWhileLoading),
    [actions, online, busyIds, config.disableWhileLoading],
  );
  const [activeActionId, setActiveActionId] = useState<string | null>(() => eligible[0] ?? null);
  const activeRef = useRef(activeActionId);
  const eligibleRef = useRef(eligible);
  // Reduced motion follows the live preference of the FAB's own document, so a change mid-transition settles it.
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(REDUCED_MOTION).matches),
  );
  useEffect(() => {
    const view = rootRef.current?.ownerDocument.defaultView ?? window;
    const query = view.matchMedia?.(REDUCED_MOTION);
    if (!query) return undefined;
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const live = useRef({ props, config, actions, online, open, blocked, controlled, suspended, t });
  // A request stays pending only until the next commit, so a controlled owner remains authoritative.
  const intent = useRef<boolean | null>(null);
  // Each removal bumps an id's generation, so a re-added action never inherits an operation started before it.
  const generations = useRef(new Map<string, number>());
  const presentIds = useRef<ReadonlySet<string>>(new Set(actions.map(action => action.id)));
  useLiveEffect(() => {
    live.current = { props, config, actions, online, open, blocked, controlled, suspended, t };
    intent.current = null;
    const ids = new Set(actions.map(action => action.id));
    for (const id of presentIds.current) {
      if (!ids.has(id)) generations.current.set(id, (generations.current.get(id) ?? 0) + 1);
    }
    presentIds.current = ids;
  });
  const mounted = useRef(false);
  // In-flight operations by action id; each start takes a fresh token so only its own completion releases it.
  const running = useRef(new Map<string, number>());
  const operationSeq = useRef(0);
  const confirmationRef = useRef<FabAction | null>(null);
  const pendingFocus = useRef(false);
  const hoverOpened = useRef(false);
  const suppression = useRef<{ detach: () => void } | null>(null);
  const press = useRef<Press | null>(null);
  const lastItem = useRef<{ element: HTMLElement; index: number; id: string | null } | null>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const previousOpen = useRef(open);
  const transition = useRef<Transition | null>(null);
  const blockNotified = useRef(false);

  // live.current.open is only what the owner rendered; the pending intent dedupes repeats until it answers.
  const requestOpen = useCallback((next: boolean, reason: string): boolean => {
    const current = live.current;
    if (next && (current.blocked || current.suspended || current.actions.length === 0))
      return false;
    if ((intent.current ?? current.open) === next) return false;
    intent.current = next;
    pendingFocus.current = next && reason !== 'hover';
    if (!next) hoverOpened.current = false;
    if (!current.controlled) setInternalOpen(next);
    current.props.onOpenChange?.(next, reason);
    return true;
  }, []);

  // Focus returns to the real native control (button or link), never the wrapper div.
  const focusTrigger = useCallback(() => {
    triggerRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
  }, []);

  const reviewRef = useRef<Review | null>(null);
  const setPending = useCallback((action: FabAction | null, handler?: ActionHandler) => {
    confirmationRef.current = action;
    // The reviewed handler, meaning and action generation are frozen when the confirmation opens.
    reviewRef.current = action
      ? {
          handler,
          stamp: actionStamp(action),
          generation: generations.current.get(action.id) ?? 0,
        }
      : null;
    setConfirmation(action);
  }, []);

  const commitActive = useCallback((id: string | null) => {
    activeRef.current = id;
    setActiveActionId(id);
  }, []);

  // The one roving owner: every focus path writes the DOM tab stop and activeActionId together.
  const rove = useCallback(
    (items: readonly HTMLElement[], target: HTMLElement) => {
      setRoving(items, target);
      const id = actionIdOf(target);
      if (id !== null) commitActive(id);
    },
    [commitActive],
  );

  // Focus returns to the real trigger only while that control can take it; a disabled or hidden trigger hands
  // focus to the nearest focusable host of the preview instead of the body or a hidden control.
  const focusFallback = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const control = triggerRef.current?.querySelector<HTMLElement>('button, a[href]');
    if (control && isEnabled(control) && !control.closest('[hidden], [inert]')) {
      control.focus();
      if (root.ownerDocument.activeElement === control) return;
    }
    const host = root.parentElement?.closest<HTMLElement>('[tabindex]');
    if (host && !host.closest('[hidden], [inert]')) host.focus();
  }, []);

  const cancelPress = useCallback(() => {
    const pending = press.current;
    press.current = null;
    if (!pending) return;
    if (pending.timer !== null) window.clearTimeout(pending.timer);
    pending.detach();
  }, []);

  // A press that opened the panel suppresses only its own compatibility click; the scope ends with that click, the
  // next task after a release over the trigger, a cancel, a release away from the trigger, a blur, the next press or
  // unmount.
  const releaseSuppression = useCallback(() => {
    const scope = suppression.current;
    suppression.current = null;
    scope?.detach();
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      running.current.clear();
      cancelPress();
      releaseSuppression();
    };
  }, [cancelPress, releaseSuppression]);

  // Disabled, hidden or loading-blocked panels report one close; a controlled owner stays authoritative.
  useEffect(() => {
    if (!blocked) {
      blockNotified.current = false;
      return;
    }
    if (!requested || blockNotified.current) return;
    blockNotified.current = true;
    if (!controlled) setInternalOpen(false);
    live.current.props.onOpenChange?.(
      false,
      props.disabled ? 'disabled' : props.visible === false ? 'hidden' : 'loading',
    );
  }, [blocked, requested, controlled, props.disabled, props.visible]);

  // A blocked, hidden or inactive contextual FAB withdraws a pending review and closes its native dialog; an open
  // Tweaker only suspends the FAB and keeps the review. Focus a consumer moved elsewhere stays where it is.
  const contextualInactive =
    (config.type === 'contextual' || config.visibility === 'contextual') && props.visible !== true;
  const withdrawn = blocked || contextualInactive;
  useEffect(() => {
    if (!withdrawn || !confirmationRef.current) return;
    setPending(null);
    const root = rootRef.current;
    const active = root?.ownerDocument.activeElement;
    if (!root || (active && active !== root.ownerDocument.body && !root.contains(active))) return;
    focusFallback();
  }, [withdrawn, setPending, focusFallback]);

  // A timing or action-count change mid-transition recomputes the remaining time instead of settling early;
  // reduced motion turning on mid-transition clears the timer and settles at once.
  const { duration, closeDuration, sequence, stagger } = config.motion;
  useEffect(() => {
    const target: Phase = open ? 'open' : 'closed';
    if (previousOpen.current !== open) transition.current = { target, start: Date.now() };
    previousOpen.current = open;
    const running = transition.current;
    if (!running || running.target !== target) return undefined;
    const base = motionMs(reducedMotion, open ? duration : closeDuration, open ? 'open' : 'close');
    const total =
      base > 0 && sequence === 'staggered'
        ? base + Math.max(0, stagger) * Math.max(0, actions.length - 1)
        : base;
    const remaining = total - (Date.now() - running.start);
    const settle = () => {
      transition.current = null;
      setPhase(target);
    };
    if (remaining <= 0) {
      settle();
      return undefined;
    }
    setPhase(open ? 'opening' : 'closing');
    const timer = window.setTimeout(settle, remaining);
    return () => window.clearTimeout(timer);
  }, [open, duration, closeDuration, sequence, stagger, actions.length, reducedMotion]);

  // A modal panel requests focus on every opening path, including defaultOpen and a controlled owner;
  // the focus effect below still waits until the actions are visible.
  useEffect(() => {
    if (open) {
      if (live.current.config.modal) pendingFocus.current = true;
      return;
    }
    hoverOpened.current = false;
    pendingFocus.current = false;
  }, [open]);

  // A requested open moves focus to the first enabled action once the renderer has mounted it.
  // Closed/closing actions are still visibility-hidden and reject focus, so wait for opening/open
  // and keep the request pending until focus actually lands on the action.
  useEffect(() => {
    if (!open || !pendingFocus.current || suspended) return;
    if (phase !== 'opening' && phase !== 'open') return;
    const items = actionItems(rootRef.current);
    const first = items.find(isEnabled);
    if (!first) return;
    rove(items, first);
    first.focus();
    if (first.ownerDocument.activeElement === first) pendingFocus.current = false;
  }, [open, phase, actions, suspended, rove]);

  // Removal or lost availability cancels a pending confirmation.
  useEffect(() => {
    const pending = confirmationRef.current;
    if (pending) {
      const now = actions.find(action => action.id === pending.id);
      if (!now || actionUnavailableReason(now, online)) setPending(null);
      else if (actionStamp(now) !== reviewRef.current?.stamp) {
        // A changed label, link or confirmation is a different decision, so the stale review is withdrawn.
        setPending(null);
        setError(live.current.t('This action changed. Review it again.'));
      }
    }
  }, [actions, online, setPending]);

  // The roving tab stop follows effective eligibility, running work included, so a stable action array still
  // repairs when busyIds change. A still eligible stop is kept even when an earlier action becomes enabled.
  useEffect(() => {
    const previous = eligibleRef.current;
    eligibleRef.current = eligible;
    const current = activeRef.current;
    const kept = current !== null && eligible.includes(current);
    const index = current === null ? 0 : Math.max(previous.indexOf(current), 0);
    const next = kept ? current : (eligible[Math.min(index, eligible.length - 1)] ?? null);
    if (next !== current) commitActive(next);
    const root = rootRef.current;
    if (!open || !root) return;
    const all = actionItems(root);
    const target = all.find(item => next !== null && actionIdOf(item) === next);
    if (target) setRoving(all, target);
    // Removed, disabled, loading, offline or busy actions lose eligibility while they may still hold focus;
    // focus moves only when the focused action itself lost it.
    const last = lastItem.current;
    if (!last || last.id === null || last.id !== current) return;
    const active = root.ownerDocument.activeElement;
    const dropped = !active || active === root.ownerDocument.body;
    if (kept) {
      // A regrouped action keeps its id but remounts its control under a new group wrapper; focus that dropped
      // with the detached control lands on the same id's new control. Focus moved elsewhere stays.
      if (!last.element.isConnected && dropped && target) target.focus();
      return;
    }
    lastItem.current = null;
    // Only focus still on the lost action or dropped to the body is repaired; focus moved elsewhere stays.
    if (!dropped && !last.element.contains(active)) return;
    if (target) target.focus();
    else focusTrigger();
  }, [eligible, open, commitActive, focusTrigger]);

  const activate = useCallback(
    (action: FabAction, confirmed = false): Activation => {
      const denied: Activation = { admitted: false, completion: Promise.resolve(false) };
      // Contextual FABs act only while the caller explicitly shows them. A Tweaker suspension and component loading
      // only pause new input, so admission refuses them while settlement keeps work admitted before them.
      const contextualHidden = (state: typeof live.current): boolean =>
        (state.config.type === 'contextual' || state.config.visibility === 'contextual') &&
        state.props.visible !== true;
      const authorized = (state: typeof live.current): boolean =>
        !state.blocked && !contextualHidden(state);
      const settleable = (state: typeof live.current): boolean =>
        !state.props.disabled && state.props.visible !== false && !contextualHidden(state);
      const permitted = (state: typeof live.current): boolean =>
        !state.suspended && authorized(state);
      // Only a single or extended FAB configured without any actions runs its own primary action;
      // denied or hidden configured actions never fall back to it.
      const primaryOffered = (state: typeof live.current): boolean =>
        (state.props.actions === undefined || state.props.actions.length === 0) &&
        PRIMARY_TYPES.has(state.config.type) &&
        state.props.onAction !== undefined;
      const current = live.current;
      if (!permitted(current)) return denied;
      // disableWhileLoading holds every new start while any work is pending; otherwise only the same id waits.
      // Admission is synchronous, so a reentrant or rapid second activation already sees the reservation below.
      const busy = running.current;
      if (busy.has(action.id) || (current.config.disableWhileLoading && busy.size > 0))
        return denied;
      const listed = current.actions.find(candidate => candidate.id === action.id);
      const target = listed ?? (primaryOffered(current) ? action : undefined);
      if (!target) return denied;
      const unavailable = actionUnavailableReason(target, current.online);
      if (unavailable) {
        setError(current.t(unavailable));
        return denied;
      }
      const offered = listed ? (target.onAction ?? current.props.onAction) : current.props.onAction;
      const stamp = actionStamp(target);
      const generation = generations.current.get(target.id) ?? 0;
      // A confirmation counts only for the live pending review of this same generation and meaning, whatever the
      // action's current confirmation flag says; it runs the exact reviewed handler, never a newer callback.
      const review = reviewRef.current;
      if (
        confirmed &&
        (confirmationRef.current?.id !== target.id ||
          !review ||
          review.stamp !== stamp ||
          review.generation !== generation)
      )
        return denied;
      if (!confirmed && target.confirmation) {
        setPending(target, offered);
        return denied;
      }
      const handler = confirmed ? review?.handler : offered;
      setPending(null);
      const closeAfter = () => {
        const latest = live.current;
        const close =
          target.closeBehavior === 'close' ||
          (target.closeBehavior !== 'keep-open' && latest.config.closeOnSelect);
        if (close && latest.open) {
          requestOpen(false, 'select');
          // An open Tweaker keeps its focus; a run settling under it only closes the panel.
          if (!latest.suspended) focusTrigger();
        }
      };
      const token = (operationSeq.current += 1);
      const release = () => {
        // Only this operation's own token releases its id; other in-flight work keeps its ownership.
        if (running.current.get(target.id) === token) running.current.delete(target.id);
      };
      if (!handler) {
        // A link without a callback navigates natively; any other action without one cannot succeed.
        if (target.actionType !== 'link' || !target.href) {
          setError(current.t('This action is unavailable.'));
          return denied;
        }
        // The id stays reserved until the next microtask so a rapid second click is refused; no busy state is
        // published, so the accepted anchor keeps its native default navigation.
        busy.set(target.id, token);
        setError('');
        closeAfter();
        const completion = Promise.resolve().then(() => {
          release();
          return true;
        });
        return { admitted: true, completion };
      }
      const publish = () => setBusyIds(Object.freeze([...running.current.keys()]));
      // Success or failure counts only for this mounted operation of the same action generation that is still offered,
      // available and authorized now; a host re-render that only recreates the callback does not change that meaning,
      // and an open Tweaker pauses only new input, so admitted work still settles once under it.
      const owned = (): boolean => {
        if (!mounted.current || running.current.get(target.id) !== token) return false;
        if ((generations.current.get(target.id) ?? 0) !== generation) return false;
        const latest = live.current;
        if (!settleable(latest)) return false;
        const now = listed ? latest.actions.find(candidate => candidate.id === target.id) : target;
        // The caller's own input decides availability: the resolver turns loading into a synthetic disabled state,
        // and a loading flag set on admitted work is presentation while a caller disabled flag still withdraws it.
        const input = listed
          ? latest.props.actions?.find(candidate => candidate.id === target.id)
          : target;
        if (
          !now ||
          !input ||
          actionStamp(now) !== stamp ||
          actionUnavailableReason({ ...input, loading: false }, latest.online)
        )
          return false;
        return listed !== undefined || primaryOffered(latest);
      };
      busy.set(target.id, token);
      publish();
      setError('');
      const completion = (async (): Promise<boolean> => {
        try {
          await handler(target);
          if (!owned()) return false;
          closeAfter();
          return true;
        } catch (cause) {
          if (!owned()) return false;
          try {
            live.current.props.onError?.(cause, target);
          } catch {
            // A failing reporter must not replace the original error or leave the action busy.
          }
          setError(messageOf(cause) || live.current.t('This action failed.'));
          if (!live.current.config.keepOpenOnError) requestOpen(false, 'error');
          return false;
        } finally {
          release();
          if (mounted.current) publish();
        }
      })();
      return { admitted: true, completion };
    },
    [requestOpen, focusTrigger, setPending],
  );

  // The promise form keeps the earlier contract and shares the same atomic admission.
  const invoke = useCallback(
    (action: FabAction, confirmed = false): Promise<boolean> =>
      activate(action, confirmed).completion,
    [activate],
  );

  /** Moves focus to the first enabled action of an open panel; true only when focus actually landed there. */
  const focusFirstAction = useCallback((): boolean => {
    const current = live.current;
    if (!current.open || current.suspended) return false;
    const items = actionItems(rootRef.current);
    const first = items.find(isEnabled);
    if (!first) return false;
    rove(items, first);
    first.focus();
    const landed = first.ownerDocument.activeElement === first;
    if (landed) pendingFocus.current = false;
    return landed;
  }, [rove]);

  const cancelConfirmation = useCallback(() => {
    if (!confirmationRef.current) return;
    setPending(null);
    const last = lastItem.current?.element;
    if (last?.isConnected) last.focus();
    else focusTrigger();
  }, [setPending, focusTrigger]);

  /** APG menu navigation over enabled actions; returns true only when it actually moved focus. */
  const navigate = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      const root = rootRef.current;
      const current = live.current;
      if (!root || current.suspended || current.blocked || !current.open || event.defaultPrevented)
        return false;
      if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing)
        return false;
      const all = actionItems(root);
      // Native disabled targets cannot take focus, so roving skips every disabled action.
      const items = all.filter(isEnabled);
      const count = items.length;
      if (count === 0) return false;
      const active = root.ownerDocument.activeElement;
      const index = items.findIndex(item => item === active || item.contains(active));
      const rtl = root.ownerDocument.defaultView?.getComputedStyle(root).direction === 'rtl';
      const forward = (index + 1) % count;
      const backward = index < 0 ? count - 1 : (index - 1 + count) % count;
      let next = -1;
      switch (event.key) {
        case 'ArrowDown':
          next = forward;
          break;
        case 'ArrowUp':
          next = backward;
          break;
        case 'ArrowRight':
          next = rtl ? backward : forward;
          break;
        case 'ArrowLeft':
          next = rtl ? forward : backward;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = count - 1;
          break;
        default: {
          if (event.key.length !== 1 || event.key === ' ') break;
          const memory = typeahead.current;
          const char = event.key.toLowerCase();
          memory.text = event.timeStamp - memory.at > TYPEAHEAD_MS ? char : memory.text + char;
          memory.at = event.timeStamp;
          const start = memory.text.length > 1 ? Math.max(index, 0) : index + 1;
          for (let step = 0; step < count && next < 0; step++) {
            const candidate = (start + step) % count;
            const item = items[candidate];
            if (item && itemName(item).startsWith(memory.text)) next = candidate;
          }
        }
      }
      const target = items[next];
      if (!target) return false;
      event.preventDefault();
      rove(all, target);
      target.focus();
      if (event.key.startsWith('Arrow')) {
        const boundary = root.closest<HTMLElement>(SPATIAL_BOUNDARY);
        if (boundary) requestSpatialInputModality(boundary);
      }
      return true;
    },
    [rove],
  );

  // Item and group handlers see the same bubbling key, so roving and typeahead run once per native event.
  const [navigated] = useState(() => new WeakSet<Event>());
  const navigateOnce = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (navigated.has(event.nativeEvent)) return;
      navigated.add(event.nativeEvent);
      navigate(event);
    },
    [navigate, navigated],
  );

  // Enter stays with the native click and Space with a native button, so an action never runs twice. An anchor
  // menuitem has no native Space activation, so Space prevents scrolling and clicks it once; the shared WeakSet
  // keeps the bubbling item and group handlers to one pass per native event.
  const actionKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (navigated.has(event.nativeEvent)) return;
      navigated.add(event.nativeEvent);
      const current = live.current;
      const anchor = asElement(event.target)?.closest<HTMLElement>(ANCHOR_ITEM);
      const plainSpace =
        event.key === ' ' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing;
      if (
        plainSpace &&
        !event.defaultPrevented &&
        anchor &&
        event.currentTarget.contains(anchor) &&
        current.open &&
        !current.suspended &&
        !current.blocked &&
        isEnabled(anchor) &&
        !anchor.closest('[hidden], [inert]')
      ) {
        event.preventDefault();
        if (!event.repeat) anchor.click();
        return;
      }
      navigate(event);
    },
    [navigate, navigated],
  );

  const groupHandlers = useMemo<HTMLAttributes<HTMLDivElement>>(
    () => ({
      onKeyDown: event => {
        navigateOnce(event);
      },
    }),
    [navigateOnce],
  );

  // Root keys: Escape for this panel, the modal Tab trap and shortcuts while focus is inside.
  // The document bubble listener runs after React's delegated handlers, so a descendant that
  // prevented or stopped the key keeps it.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const doc = root.ownerDocument;
    const childPopup = `[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox'], [aria-expanded='true']`;
    const onKeyDown = (event: KeyboardEvent) => {
      const current = live.current;
      const target = asElement(event.target);
      if (!target || !root.contains(target)) return;
      if (current.suspended || current.blocked || event.defaultPrevented) return;
      // An IME composition owns every key, Escape included.
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') {
        if (!current.open || confirmationRef.current || !current.config.closeOnEscape) return;
        // A nested popup or composite owns Escape; the FAB's own action menu and trigger do not count.
        const popup = target.closest(childPopup);
        const foreign =
          popup !== null &&
          root.contains(popup) &&
          popup !== root &&
          !triggerRef.current?.contains(popup) &&
          popup.querySelector('.genux-fab-action') === null;
        if (foreign) return;
        event.preventDefault();
        requestOpen(false, 'escape');
        focusTrigger();
        return;
      }
      // Tab stays native; the shared modal overlay owns any focus trap.
      if (event.key === 'Tab') return;
      if (confirmationRef.current || target.closest(EDITABLE)) return;
      const action = current.actions.find(
        candidate => candidate.shortcut && matchesShortcut(candidate.shortcut, event),
      );
      if (!action) return;
      // The shortcut clicks the rendered item, so its own handler runs once and links activate natively.
      const item = actionItems(root).find(
        candidate =>
          candidate.closest('[data-fab-action-id]')?.getAttribute('data-fab-action-id') ===
          action.id,
      );
      if (!item || !isEnabled(item) || item.closest('[hidden], [inert]')) return;
      event.preventDefault();
      item.click();
    };
    const onFocusIn = (event: FocusEvent) => {
      const all = actionItems(root);
      const items = all.filter(isEnabled);
      const index = items.findIndex(item => item === event.target);
      const element = items[index];
      if (!element) return;
      lastItem.current = { element, index, id: actionIdOf(element) };
      // Pointer and programmatic focus move the single tab stop through the same owner.
      rove(all, element);
    };
    const onFocusOut = (event: FocusEvent) => {
      const current = live.current;
      if (current.suspended || current.blocked || !current.open || !current.config.closeOnBlur)
        return;
      // The native modal dialog owns focus for a modal menu; its Tab wrap briefly focuses outside
      // the root before its own lock returns it, so only a non-modal panel closes on blur.
      if (current.config.modal || confirmationRef.current) return;
      const next = event.relatedTarget;
      if (next && 'nodeType' in next && !root.contains(next as Node)) requestOpen(false, 'blur');
    };
    // A hover-opened panel owns the bounding box of its trigger and action boxes, gaps included. The root's own box may
    // cover blank stage area that never fires pointerleave, so one owner-document pointermove listener tracks a mouse or
    // hovering pen for the whole hover-opened presentation and closes once the pointer leaves that box. Nothing
    // intercepts pointers; the effect re-runs on every open change, so any close path and unmount remove it at once.
    const hoverRegion = () =>
      boxUnion([
        ...(triggerRef.current ? [triggerRef.current] : []),
        ...Array.from(root.querySelectorAll('.genux-fab-action')),
      ]);
    let hoverTrack: (() => void) | null = null;
    const stopHoverTrack = () => {
      hoverTrack?.();
      hoverTrack = null;
    };
    const closeHover = () => {
      stopHoverTrack();
      requestOpen(false, 'hover');
    };
    // Hover opens only from a mouse or a hovering pen, so only those pointers leaving close it.
    const hovering = (event: PointerEvent) =>
      event.pointerType === 'mouse' || event.pointerType === 'pen';
    // Geometry alone decides departure: blank area inside the root's own box is still outside the FAB's parts.
    const leaveHover = (event: PointerEvent) => {
      if (!hoverOpened.current) {
        stopHoverTrack();
        return;
      }
      const current = live.current;
      if (!hovering(event) || current.suspended || current.blocked) return;
      const region = hoverRegion();
      if (!region || !inBox(region, event.clientX, event.clientY)) closeHover();
    };
    if (open && hoverOpened.current) {
      doc.addEventListener('pointermove', leaveHover, true);
      hoverTrack = () => doc.removeEventListener('pointermove', leaveHover, true);
    }
    doc.addEventListener('keydown', onKeyDown);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    root.addEventListener('pointerleave', leaveHover);
    return () => {
      stopHoverTrack();
      doc.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('pointerleave', leaveHover);
    };
  }, [open, requestOpen, focusTrigger, rove]);

  // Outside press, actual link activation and history navigation close an open panel under their own flags.
  // Scroll closing belongs to the position hook alone, so closeOnScroll has no listener here.
  useEffect(() => {
    const root = rootRef.current;
    const view = root?.ownerDocument.defaultView;
    if (!open || suspended || !root || !view) return undefined;
    const doc = root.ownerDocument;
    const outside = (target: EventTarget | null) => {
      const element = asElement(target);
      return !element || !root.contains(element) || element.closest('.genux-fab-backdrop') !== null;
    };
    const onPointer = (event: Event) => {
      if (live.current.config.closeOnOutside && !confirmationRef.current && outside(event.target))
        requestOpen(false, 'outside');
    };
    // A prevented click is app routing, which needs an app bridge; this hook never patches history.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const link = asElement(event.target)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.hasAttribute('download') || (link.target !== '' && link.target !== '_self'))
        return;
      if (live.current.config.closeOnNavigation) requestOpen(false, 'navigation');
    };
    const onNavigation = () => {
      if (live.current.config.closeOnNavigation) requestOpen(false, 'navigation');
    };
    const options: AddEventListenerOptions = { capture: true, passive: true };
    doc.addEventListener('pointerdown', onPointer, options);
    doc.addEventListener('click', onClick);
    view.addEventListener('hashchange', onNavigation);
    view.addEventListener('popstate', onNavigation);
    return () => {
      doc.removeEventListener('pointerdown', onPointer, options);
      doc.removeEventListener('click', onClick);
      view.removeEventListener('hashchange', onNavigation);
      view.removeEventListener('popstate', onNavigation);
    };
  }, [open, suspended, requestOpen]);

  const triggerHandlers = useMemo<HTMLAttributes<HTMLDivElement>>(() => {
    const activate = (reason: string, doc: Document, pointerId: number) => {
      cancelPress();
      releaseSuppression();
      const view = doc.defaultView;
      // A release over the trigger dispatches its compatibility click in that same task, so without one the scope
      // expires on the next event-loop task; a cancel or a release elsewhere delivers none and ends it at once. The
      // 0 ms timer is a lifecycle task, not a motion duration.
      let expiry: number | null = null;
      const onEnd = (end: PointerEvent) => {
        if (end.pointerId !== pointerId) return;
        const target = asElement(end.target);
        if (end.type === 'pointercancel' || !target || !triggerRef.current?.contains(target)) {
          releaseSuppression();
          return;
        }
        if (expiry === null && view) expiry = view.setTimeout(releaseSuppression, 0);
      };
      const onBlur = () => releaseSuppression();
      doc.addEventListener('pointerup', onEnd, true);
      doc.addEventListener('pointercancel', onEnd, true);
      view?.addEventListener('blur', onBlur);
      suppression.current = {
        detach: () => {
          if (expiry !== null) view?.clearTimeout(expiry);
          expiry = null;
          doc.removeEventListener('pointerup', onEnd, true);
          doc.removeEventListener('pointercancel', onEnd, true);
          view?.removeEventListener('blur', onBlur);
        },
      };
      requestOpen(true, reason);
    };
    // Document listeners follow the pointer off the trigger, so a release, cancel or blur anywhere ends the press.
    const startPress = (event: ReactPointerEvent<HTMLDivElement>, timed: boolean) => {
      const doc = event.currentTarget.ownerDocument;
      const view = doc.defaultView;
      const { pointerId } = event;
      const onMove = (move: PointerEvent) => {
        const pending = press.current;
        if (!pending || move.pointerId !== pending.pointerId) return;
        const distance = Math.hypot(move.clientX - pending.x, move.clientY - pending.y);
        if (pending.timer !== null) {
          if (distance > LONG_PRESS_SLOP) cancelPress();
        } else if (distance >= GESTURE_THRESHOLD) activate('gesture', doc, pointerId);
      };
      const onEnd = (end: PointerEvent) => {
        if (end.pointerId === pointerId) cancelPress();
      };
      const onBlur = () => cancelPress();
      doc.addEventListener('pointermove', onMove, true);
      doc.addEventListener('pointerup', onEnd, true);
      doc.addEventListener('pointercancel', onEnd, true);
      view?.addEventListener('blur', onBlur);
      const detach = () => {
        doc.removeEventListener('pointermove', onMove, true);
        doc.removeEventListener('pointerup', onEnd, true);
        doc.removeEventListener('pointercancel', onEnd, true);
        view?.removeEventListener('blur', onBlur);
      };
      const timer = timed
        ? window.setTimeout(() => activate('long-press', doc, pointerId), LONG_PRESS_MS)
        : null;
      press.current = { pointerId, x: event.clientX, y: event.clientY, timer, detach };
    };
    return {
      onClick: event => {
        // Only the press's own pointer click is consumed; a keyboard detail-0 click ends the scope and still runs.
        if (suppression.current) {
          releaseSuppression();
          if (event.detail !== 0) {
            event.preventDefault();
            return;
          }
        }
        const current = live.current;
        if (current.suspended || current.blocked) return;
        // Enter and Space reach here as a detail-0 click and open whatever the trigger mode;
        // closing follows toggleOnTrigger exactly like a pointer press.
        const keyboard = event.detail === 0;
        if (!current.open) requestOpen(true, keyboard ? 'keyboard' : 'trigger');
        else if (hoverOpened.current && !keyboard) hoverOpened.current = false;
        else if (current.config.toggleOnTrigger)
          requestOpen(false, keyboard ? 'keyboard' : 'trigger');
      },
      onPointerDown: event => {
        releaseSuppression();
        cancelPress();
        const current = live.current;
        if (current.suspended || current.blocked || !event.isPrimary) return;
        // Long press and swipe only open a menu; a single or extended FAB keeps its own click action.
        if (current.actions.length === 0 || PRIMARY_TYPES.has(current.config.type)) return;
        const { trigger } = current.config;
        const touchLike = event.pointerType === 'touch' || event.pointerType === 'pen';
        if (trigger === 'long-press' && touchLike) startPress(event, true);
        else if (trigger === 'gesture') startPress(event, false);
      },
      onContextMenu: event => {
        if (suppression.current) event.preventDefault();
      },
      onPointerEnter: event => {
        const current = live.current;
        if (
          current.suspended ||
          current.blocked ||
          current.open ||
          current.config.trigger !== 'hover'
        )
          return;
        // A hybrid device with a coarse primary pointer still hovers with an attached mouse; a pen
        // counts only while it hovers without contact. Click and keyboard keep opening either way.
        const mouse = event.pointerType === 'mouse';
        const hoveringPen =
          event.pointerType === 'pen' && event.buttons === 0 && event.pressure === 0;
        if (!mouse && !hoveringPen) return;
        const view = event.currentTarget.ownerDocument.defaultView;
        if (!view?.matchMedia?.('(any-hover: hover)').matches) return;
        if (mouse && !view.matchMedia('(any-pointer: fine)').matches) return;
        hoverOpened.current = requestOpen(true, 'hover');
      },
    };
  }, [requestOpen, cancelPress, releaseSuppression]);

  const state: FabState = props.disabled
    ? 'disabled'
    : busyId !== null || props.loading
      ? 'busy'
      : phase;

  return {
    rootRef,
    triggerRef,
    actions,
    open,
    state,
    busyId,
    busyIds,
    error,
    confirmation,
    suspended,
    requestOpen,
    invoke,
    activate,
    phase,
    activeActionId,
    cancelConfirmation,
    triggerHandlers,
    groupHandlers,
    actionKeyDown,
    focusTrigger,
    focusFirstAction,
  };
}
