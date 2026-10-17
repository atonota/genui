import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Progress, Tooltip } from 'antd';
import GenUXButton, { type ButtonDepth } from './GenUXButton';
import GenUXBadge from './GenUXBadge';
import type { GenUXIconName } from './GenUXIcon';
import { Modal } from './GenUXOverlay';
import { GenUXPopupScopeContext } from './GenUXPortalScope';
import { useI18n } from './useI18n';
import { useFab } from './fab/useFab';
import { useFabPosition } from './fab/useFabPosition';
import FabIcon from './fab/FabIcon';
import fabTokens from '../data/fab-tokens.json';
import {
  FAB_DEFAULTS,
  FAB_METRICS,
  actionUnavailableReason,
  normalizeFabOptions,
} from '../fab/options';
import { fabActionMotionStyle, fabMotionStyle } from '../fab/motion';
import type { GenUXFabProps, FabAction, FabConfig, FabOptions } from '../fab/types';

type FabStyle = CSSProperties & Record<`--${string}`, string | number>;
type ButtonBase = Omit<
  ComponentProps<typeof GenUXButton>,
  'iconOnly' | 'text' | 'icon' | 'aria-label'
>;

const OPTION_KEYS = Object.keys(FAB_DEFAULTS) as (keyof FabOptions)[];
const MENU_TYPES: ReadonlySet<string> = new Set([
  'collapsible',
  'speed-dial',
  'menu',
  'contextual',
  'adaptive',
]);
const TEXT_TYPES: ReadonlySet<string> = new Set(['extended', 'collapsible']);
// Only these types own a synthetic primary action, matching the useFab admission rule.
const PRIMARY_TYPES: ReadonlySet<string> = new Set(['single', 'extended']);
const FLAT_APPEARANCES: ReadonlySet<string> = new Set([
  'flat',
  'outlined',
  'soft-outlined',
  'translucent',
]);
// Same grammar as the model href policy in ../fab/options; the renderer never accepts more.
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HTTP_URL = /^https?:[/][/][^/?#]/i;
const DEFAULT_ICON: GenUXIconName = 'plus';
const DEFAULT_OPEN_ICON: GenUXIconName = 'x';
// Built-in model reasons are translation keys; a caller's own disabledReason is shown exactly as written.
const BUILT_IN_REASONS: ReadonlySet<string> = new Set(
  [
    actionUnavailableReason({ id: 'reason', label: 'reason', disabled: true }),
    actionUnavailableReason({ id: 'reason', label: 'reason', loading: true }),
    actionUnavailableReason({ id: 'reason', label: 'reason' }, false),
  ].filter((reason): reason is string => reason !== undefined),
);
const MOVE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-fabTokens.position.offset, 0],
  ArrowRight: [fabTokens.position.offset, 0],
  ArrowUp: [0, -fabTokens.position.offset],
  ArrowDown: [0, fabTokens.position.offset],
};
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
// Inside the modal dialog the menu and its rows flow in normal layout; the floating geometry never offsets them twice.
const MODAL_FLOW: CSSProperties = {
  position: 'relative',
  inset: 'auto',
  width: '100%',
  height: 'auto',
};
const px = (value: number) => `${value}px`;
// A modal FAB stays inside its own logical stage: wrapper and mask stay fixed, because the native dialog engages its own
// focus lock only for a fixed wrapper, and the FAB root's static transform makes that fixed box fill the FAB layer
// instead of escaping to the viewport. The wrapper scrolls the whole dialog, and the dialog keeps the central offset
// token on every side. The FAB layer ignores pointers, so both dialog layers take them back explicitly.
const STAGE_GAP = px(fabTokens.position.offset);
const STAGE_MODAL_STYLES: Readonly<Record<'wrapper' | 'mask', CSSProperties>> = {
  wrapper: { position: 'fixed', inset: 0, overflow: 'auto', pointerEvents: 'auto' },
  mask: { position: 'fixed', inset: 0, pointerEvents: 'auto' },
};
const STAGE_MODAL_STYLE: CSSProperties = {
  top: STAGE_GAP,
  maxWidth: `calc(100% - 2 * ${STAGE_GAP})`,
  paddingBottom: STAGE_GAP,
};

/** Only public FabOptions keys reach the normaliser; business props stay out. */
function pickFabOptions(props: GenUXFabProps): FabOptions {
  const picked: Record<string, unknown> = {};
  for (const key of OPTION_KEYS) if (props[key] !== undefined) picked[key] = props[key];
  // A modal FAB paints the shared dim-blur mask, so an unspecified backdrop reports that layer.
  if (picked.modal === true && picked.backdrop === undefined) picked.backdrop = 'dim-blur';
  return picked as FabOptions;
}

// Easing and backdrop alternatives await the pending human decision; the API rejects them instead of painting
// the cubic or dim-blur baseline in their place.
const PENDING_BACKDROPS: ReadonlySet<string> = new Set(['transparent', 'dim', 'blur']);

function validateFabPolicy({ motion, backdrop, modal }: FabConfig): void {
  if (motion.easing !== 'cubic') {
    throw new Error(
      `GenUXFab: easing ${motion.easing} awaits a pending decision; only cubic is supported.`,
    );
  }
  if (PENDING_BACKDROPS.has(backdrop)) {
    throw new Error(
      `GenUXFab: backdrop ${backdrop} awaits a pending decision; use none or dim-blur.`,
    );
  }
  if (modal && backdrop === 'none') {
    throw new Error(
      'GenUXFab: a modal FAB paints the dim-blur mask; backdrop none is unsupported.',
    );
  }
}

function validateFabProps({ label, progress, counter, groups }: GenUXFabProps): void {
  if (!label.trim()) throw new Error('GenUXFab: label must be a non-empty string.');
  if (progress !== undefined && !Number.isFinite(progress))
    throw new Error('GenUXFab: progress must be finite.');
  if (counter !== undefined && (!Number.isInteger(counter) || counter < 0)) {
    throw new Error('GenUXFab: counter must be a non-negative integer.');
  }
  const ids = new Set<string>();
  for (const group of groups ?? []) {
    if (!group.id || ids.has(group.id))
      throw new Error(`GenUXFab: group id ${group.id} must be unique and non-empty.`);
    ids.add(group.id);
    for (const angle of [group.startAngle, group.endAngle]) {
      if (angle !== undefined && !Number.isFinite(angle))
        throw new Error(`GenUXFab: group ${group.id} angles must be finite.`);
    }
  }
}

function safeHref(href: string | undefined): string | undefined {
  if (!href || href.trim() !== href || href.startsWith('//')) return undefined;
  for (const char of href) {
    const code = char.codePointAt(0) ?? 0;
    // C0/C1 control characters and backslash (0x5c), as rejected by the model policy.
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x5c) return undefined;
  }
  return !SCHEME.test(href) || HTTP_URL.test(href) ? href : undefined;
}

/** Floating action button renderer over the frozen useFab/useFabPosition contract. */
export default function GenUXFab(props: GenUXFabProps) {
  const { t } = useI18n();
  const scope = useContext(GenUXPopupScopeContext);
  const optionKey = JSON.stringify(pickFabOptions(props));
  const config = useMemo(
    () => normalizeFabOptions(JSON.parse(optionKey) as FabOptions),
    [optionKey],
  );
  const fab = useFab(props, config);
  // Movement follows the effective loading state: the caller's flag, or running work only when the config blocks on it.
  const positionProps = {
    ...props,
    loading: props.loading === true || (config.disableWhileLoading && fab.busyIds.length > 0),
  };
  const hasMenu = MENU_TYPES.has(config.type) && fab.actions.length > 0;
  // Menu actions paint while open and through their retained exit; only then does the status card leave room for them.
  const place = useFabPosition(
    positionProps,
    config,
    fab.rootRef,
    fab.actions,
    fab.open,
    fab.requestOpen,
    hasMenu && (fab.open || fab.phase === 'closing'),
  );
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const baseId = useId();
  const actionsId = `${baseId}-actions`;
  const statusId = `${baseId}-status`;
  const statusRef = useRef<HTMLDivElement | null>(null);
  const closed = !fab.open || fab.suspended;
  // Confirmation settles after later renders; navigation re-checks the newest actions and the caller's own input
  // actions, not the click-time snapshot.
  const latestRef = useRef({ actions: fab.actions, inputs: props.actions, online: props.online });
  useIsoLayoutEffect(() => {
    actionsRef.current?.toggleAttribute('inert', closed);
  }, [closed, hasMenu]);
  useIsoLayoutEffect(() => {
    latestRef.current = { actions: fab.actions, inputs: props.actions, online: props.online };
  }, [fab.actions, props.actions, props.online]);
  // Both dialogs portal into the FAB root, so the menu keeps its preview, theme and the useFab key/focus scope.
  const ownContainer = useCallback(
    () => fab.rootRef.current ?? scope?.getPopupContainer() ?? document.body,
    [fab.rootRef, scope],
  );
  // The overlay title also carries the tweaker control, and the installed dialog panel names itself from the whole header
  // without spreading caller ARIA. Each panel ref names its dialog by the dedicated title text alone; the panel's own
  // ariaId stays stable, so React never rewrites the override.
  const menuTitleId = `${baseId}-menu-title`;
  const confirmTitleId = `${baseId}-confirm-title`;
  const menuPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      node?.setAttribute('aria-labelledby', menuTitleId);
    },
    [menuTitleId],
  );
  const confirmPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      node?.setAttribute('aria-labelledby', confirmTitleId);
    },
    [confirmTitleId],
  );

  // A hidden or inactive contextual layer withdraws a pending review through the hook's own cancel, so the shared
  // native dialog closes once; Tweaker suspension only pauses the layer and keeps the review.
  const withdrawn = props.visible === false || place.inactive;
  const { confirmation: reviewing, cancelConfirmation } = fab;
  useEffect(() => {
    if (withdrawn && reviewing) cancelConfirmation();
  }, [withdrawn, reviewing, cancelConfirmation]);

  validateFabProps(props);
  validateFabPolicy(config);

  // Geometry stays in the paint frame; every CSS position below subtracts the root origin once.
  const { geometry, origin } = place;
  const metrics = FAB_METRICS[config.size];
  const masterIcon = props.icon ?? DEFAULT_ICON;
  const openIcon = props.openIcon ?? DEFAULT_OPEN_ICON;
  const visible = props.visible !== false && !place.hidden;
  const disabled = props.disabled === true || fab.state === 'disabled';
  const busy = props.loading === true || fab.state === 'busy';
  // Unspecified radius inherits the Tweaker --radius; the normalised 5px default must not override it.
  const radiusCss =
    props.radius === undefined
      ? undefined
      : typeof config.radius === 'number'
        ? px(config.radius)
        : config.radius;
  const fill =
    config.appearance === 'tonal'
      ? 'tint'
      : config.appearance === 'outlined' || config.appearance === 'soft-outlined'
        ? 'outline'
        : 'solid';
  const depth: ButtonDepth = FLAT_APPEARANCES.has(config.appearance) ? 'flat' : '3d';
  const iconSide = config.iconPosition === 'end' ? 'right' : 'left';
  const iconActive = config.content !== 'text-only' && config.iconTransition !== 'static';
  // The overlay covers the native icon slot exactly; geometry is in layout px, undoing any device mockup scale.
  useIsoLayoutEffect(() => {
    const trigger = fab.triggerRef.current as HTMLElement | null;
    if (!trigger) return;
    const names = [
      '--fab-trigger-icon-x',
      '--fab-trigger-icon-y',
      '--fab-trigger-icon-width',
      '--fab-trigger-icon-height',
      '--fab-trigger-icon-ink',
    ];
    const svg = iconActive
      ? trigger.querySelector<SVGSVGElement>('.genux-fab-trigger-button .genux-button-content svg')
      : null;
    // The native master control owns the resolved ink; the overlay copies its final --button-text role, never an
    // interpolated svg colour, so a running colour transition cannot freeze an intermediate frame.
    const control = svg?.closest<HTMLElement>('.genux-fab-trigger-button') ?? null;
    const view = trigger.ownerDocument.defaultView;
    const measure = () => {
      if (!svg?.isConnected) {
        for (const name of names) trigger.style.removeProperty(name);
        trigger.removeAttribute('data-fab-icon-slot');
        return;
      }
      const box = trigger.getBoundingClientRect();
      const icon = svg.getBoundingClientRect();
      const scaleX = trigger.offsetWidth > 0 && box.width > 0 ? box.width / trigger.offsetWidth : 1;
      const scaleY =
        trigger.offsetHeight > 0 && box.height > 0 ? box.height / trigger.offsetHeight : 1;
      trigger.style.setProperty('--fab-trigger-icon-x', px((icon.left - box.left) / scaleX));
      trigger.style.setProperty('--fab-trigger-icon-y', px((icon.top - box.top) / scaleY));
      trigger.style.setProperty('--fab-trigger-icon-width', px(icon.width / scaleX));
      trigger.style.setProperty('--fab-trigger-icon-height', px(icon.height / scaleY));
      const ink =
        control && view
          ? view.getComputedStyle(control).getPropertyValue('--button-text').trim()
          : '';
      if (ink) trigger.style.setProperty('--fab-trigger-icon-ink', ink);
      else trigger.style.removeProperty('--fab-trigger-icon-ink');
      trigger.setAttribute('data-fab-icon-slot', 'measured');
    };
    measure();
    const resizer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    resizer?.observe(trigger);
    if (svg) resizer?.observe(svg);
    // Theme, recipe, fill and state switches restyle the native control or its nearest themed owner outside the FAB
    // without resizing anything. Only those attributes are watched; trigger.style, which measure writes, never is.
    const owner =
      fab.rootRef.current?.parentElement?.closest<HTMLElement>('[data-theme-mode]') ??
      trigger.ownerDocument.documentElement;
    const mutations =
      control && typeof MutationObserver !== 'undefined'
        ? new MutationObserver(measure)
        : undefined;
    if (control && mutations) {
      mutations.observe(control, {
        attributes: true,
        attributeFilter: ['style', 'class', 'disabled', 'data-state'],
      });
      mutations.observe(owner, {
        attributes: true,
        attributeFilter: ['style', 'class', 'data-theme-mode', 'data-theme'],
      });
    }
    return () => {
      resizer?.disconnect();
      mutations?.disconnect();
    };
  }, [
    iconActive,
    masterIcon,
    busy,
    config.appearance,
    config.size,
    config.type,
    config.content,
    config.iconPosition,
    config.labelPlacement,
    place.collapsed,
  ]);
  // Extended and collapsible FABs carry their label inside and size to it until collapsed; text-only always does.
  const textInside =
    config.content === 'text-only' ||
    (!place.collapsed &&
      (TEXT_TYPES.has(config.type) ||
        (config.content === 'icon-text' && config.labelPlacement === 'inside')));
  const outerLabel = !textInside && config.labelPlacement !== 'inside';
  const progress =
    props.progress === undefined ? undefined : Math.min(100, Math.max(0, props.progress));
  const tooltipTrigger: ('hover' | 'focus')[] =
    config.tooltip === 'hover'
      ? ['hover']
      : config.tooltip === 'focus'
        ? ['focus']
        : ['hover', 'focus'];
  // An open modal menu owns the stage: its status card joins the native dialog below the menu, so the dialog's focus
  // containment and stacking cover it, and the two share the dialog's usable height. A closed one never reserves it.
  const modalOpen = config.modal && hasMenu && fab.open;
  const statusShown = progress !== undefined || Boolean(fab.error) || props.counter !== undefined;
  const modalAvail = `(${px(geometry.maxHeight)} - 2 * ${STAGE_GAP} - ${px(metrics.trigger)})`;
  const modalStatusMax = modalOpen && statusShown ? `calc(${modalAvail} / 2)` : '0px';
  const modalMenuReserve = modalOpen && statusShown ? `(${modalAvail} / 2 + ${STAGE_GAP})` : '0px';
  const [modalStatusSlot, setModalStatusSlot] = useState<HTMLDivElement | null>(null);
  // The live card node itself moves into the dialog slot and back, never remounting, so its status and alert children
  // keep their identity and announce only real data changes. It renders right after the trigger host, where React
  // never inserts a sibling before it, and returns there when the dialog closes or unmounts.
  useIsoLayoutEffect(() => {
    const node = statusRef.current;
    const root = fab.rootRef.current;
    if (!modalOpen || !node || !root || !modalStatusSlot) return undefined;
    modalStatusSlot.appendChild(node);
    return () => {
      const trigger = fab.triggerRef.current as HTMLElement | null;
      if (trigger?.parentNode === root) root.insertBefore(node, trigger.nextSibling);
      else root.appendChild(node);
    };
  }, [modalOpen, modalStatusSlot]);
  // A clipped card, placed or inside the modal dialog, scrolls inside, so keyboard users reach it as one named region
  // and the central ringless cue marks its focus. Its live regions stay as rendered.
  useIsoLayoutEffect(() => {
    const node = statusRef.current;
    if (!node) return undefined;
    const sync = () => {
      const scrollable =
        (place.status !== null || modalOpen) && node.scrollHeight > node.clientHeight + 1;
      if (scrollable) {
        node.tabIndex = 0;
        node.setAttribute('role', 'region');
        node.setAttribute('aria-label', props.label);
        return;
      }
      node.removeAttribute('tabindex');
      node.removeAttribute('role');
      node.removeAttribute('aria-label');
    };
    sync();
    const resizer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(sync);
    resizer?.observe(node);
    for (const child of Array.from(node.children)) resizer?.observe(child);
    return () => resizer?.disconnect();
  }, [place.status, modalOpen, modalStatusSlot, props.label, fab.error, progress, props.counter]);
  const popupContainer = () => scope?.getPopupContainer() ?? fab.rootRef.current ?? document.body;
  const placeStyle = place.style as FabStyle | undefined;
  // Non-dial modes paint the explicit outer panel box the geometry resolved, padding included; the union of every
  // reserved action box is only the fallback for a dial or a geometry without a panel. Height is capped at the usable height and rows scroll inside.
  const panel = geometry.mode === 'dial' ? undefined : geometry.panel;
  const menuRect =
    panel ??
    geometry.positions.reduce<Readonly<Record<'x' | 'y' | 'width' | 'height', number>> | undefined>(
      (union, item) => {
        if (!union) return { x: item.x, y: item.y, width: item.width, height: item.height };
        const x = Math.min(union.x, item.x);
        const y = Math.min(union.y, item.y);
        return {
          x,
          y,
          width: Math.max(union.x + union.width, item.x + item.width) - x,
          height: Math.max(union.y + union.height, item.y + item.height) - y,
        };
      },
      undefined,
    );
  // Position first, then the motion role owner; size and radius roles win last.
  // A text-inside trigger keeps the width the position hook measured instead of resetting it to auto.
  const rootStyle: FabStyle = {
    ...placeStyle,
    ...fabMotionStyle(config, fab.actions.length),
    ...(menuRect
      ? {
          '--fab-menu-x': px(menuRect.x - origin.x),
          '--fab-menu-y': px(menuRect.y - origin.y),
          '--fab-menu-width': px(menuRect.width),
          '--fab-menu-height': px(Math.min(menuRect.height, geometry.maxHeight)),
        }
      : {}),
    '--fab-trigger-width': textInside
      ? (placeStyle?.['--fab-trigger-width'] ?? 'auto')
      : px(metrics.trigger),
    // Wrapped inside text keeps the measured height, never below the nominal size, so host, control and collision box
    // agree; the native control's --slot-size stays on the nominal role and never grows to the text height.
    '--fab-trigger-height': textInside
      ? (placeStyle?.['--fab-trigger-height'] ?? px(metrics.trigger))
      : px(metrics.trigger),
    '--fab-trigger-nominal': px(metrics.trigger),
    '--fab-action-visual': px(metrics.action),
    '--fab-action-target': px(metrics.actionTarget),
    '--fab-action-hit': px(metrics.actionTarget),
    '--fab-action-icon': px(metrics.actionIcon),
    '--fab-radius': radiusCss ?? 'var(--radius, 5px)',
    '--fab-max-height': px(geometry.maxHeight),
    // An open modal menu's status card scrolls inside its share of the dialog height.
    '--fab-modal-status-max': modalStatusMax,
    // Collision padding and label gap feed the CSS label measure that bounds wrapped text to the usable width.
    '--fab-collision-pad': px(fabTokens.position.collisionPadding),
    '--fab-label-gap': px(fabTokens.position.labelGap),
    // Only a floating sheet insets its rows by the collision padding inside its panel; menus and the modal menu flow edge to edge.
    '--fab-panel-inset':
      !config.modal && geometry.mode === 'sheet' ? px(fabTokens.position.collisionPadding) : '0px',
  };

  // Built-in reasons translate like every other renderer string; caller reasons keep their own wording.
  const shownReason = (reason: string | undefined): string | undefined =>
    reason === undefined ? undefined : BUILT_IN_REASONS.has(reason) ? t(reason) : reason;
  // Caller wording comes only from the original input action with the resolved id: resolveFabActions writes its built-in
  // keys onto the normalised action, so only an explicitly disabled input action's own non-empty disabledReason is shown
  // exactly as written, even when it equals a built-in key. The synthetic primary has no input action.
  const callerReason = (action: FabAction | undefined): string | undefined => {
    if (!action) return undefined;
    const original = props.actions?.find(item => item.id === action.id);
    return original?.disabled === true && original.disabledReason?.trim()
      ? original.disabledReason
      : undefined;
  };
  // A running item blocks itself; other running items block it only when the config disables actions while loading.
  const isActionDisabled = (action: FabAction) =>
    actionUnavailableReason(action, props.online) !== undefined ||
    action.disabled === true ||
    (config.disableWhileLoading && fab.busyIds.some(id => id !== action.id));
  const isActionBusy = (action: FabAction) =>
    fab.busyIds.includes(action.id) || action.loading === true;
  // A single FAB runs its first resolved action. The synthetic primary exists only for a single or extended FAB whose
  // caller passed no actions, so a collection whose every entry was denied never becomes a callable trigger.
  const primary: FabAction | undefined = hasMenu
    ? undefined
    : (fab.actions[0] ??
      ((props.actions?.length ?? 0) === 0 && PRIMARY_TYPES.has(config.type) && props.onAction
        ? { id: `${baseId}-primary`, label: props.label }
        : undefined));
  // A trigger with neither a menu nor a runnable primary is unavailable, never a dead enabled control.
  const primaryMissing = !hasMenu && primary === undefined;
  const primaryBlocked =
    disabled ||
    busy ||
    (primary !== undefined && (isActionDisabled(primary) || isActionBusy(primary)));
  const primaryHref = primary?.actionType === 'link' ? safeHref(primary.href) : undefined;
  // Only a plain, available link is a native anchor; a confirmed link stays a button until the dialog accepts.
  const primaryNative = primaryHref !== undefined && !primaryBlocked && !primary?.confirmation;
  // A single or extended trigger is its primary action: an unavailable primary disables the native control, a running
  // one shows loading, and the translated reason stays in the trigger's description.
  const primaryUnavailable = primaryMissing || (primary !== undefined && isActionDisabled(primary));
  const primaryProcessing = primary !== undefined && isActionBusy(primary);
  // A missing primary takes the generic translated reason, so a denied action's label never leaks.
  const primaryReasonKey =
    primary === undefined
      ? primaryMissing
        ? 'This action is unavailable.'
        : undefined
      : (actionUnavailableReason(primary, props.online) ??
        (primaryUnavailable ? primary.disabledReason : undefined));
  const primaryReason =
    callerReason(primary) ?? (primaryReasonKey ? t(primaryReasonKey) : undefined);
  const primaryReasonId = `${baseId}-primary-reason`;
  const triggerDescribedBy =
    [progress !== undefined || fab.error ? statusId : '', primaryReason ? primaryReasonId : '']
      .filter(Boolean)
      .join(' ') || undefined;
  const navigate = (href: string, target: FabAction['target']) => {
    const view = fab.rootRef.current?.ownerDocument.defaultView;
    if (!view) return;
    if (target === '_blank') view.open(href, '_blank', 'noopener,noreferrer');
    else view.location.assign(href);
  };
  const confirmPending = async () => {
    const action = fab.confirmation;
    if (!action) return;
    // The reviewed destination is the snapshot the dialog showed, read before invoke so later renders cannot swap it.
    const reviewed = action.actionType === 'link' ? safeHref(action.href) : undefined;
    const reviewedTarget = action.target;
    // invoke resolves true only when the action ran; cancelled, failed or rejected confirmations never navigate.
    const accepted: unknown = await fab.invoke(action, true);
    if (accepted !== true || !reviewed) return;
    const { actions, inputs, online } = latestRef.current;
    const current = actions.find(item => item.id === action.id);
    // Settlement judges the caller's own input action: the resolver turns a loading presentation into a synthetic
    // disabled state, and loading set on already admitted work never withdraws it. An explicit caller disabled flag,
    // permission, visibility or offline availability still does.
    const input = inputs?.find(item => item.id === action.id);
    if (
      !current ||
      !input ||
      input.actionType !== 'link' ||
      input.visible === false ||
      input.permission === false
    )
      return;
    if (actionUnavailableReason({ ...input, loading: false }, online) !== undefined) return;
    // A destination or target changed while the dialog was open was never reviewed.
    if (safeHref(input.href) !== reviewed || input.target !== reviewedTarget) return;
    navigate(reviewed, reviewedTarget);
  };
  const onTriggerClick = (event: MouseEvent<HTMLElement>) => {
    if (hasMenu) return;
    event.stopPropagation();
    // Disabled, busy or missing primaries never navigate or run; a plain link keeps native navigation.
    if (!primary || primaryBlocked) {
      event.preventDefault();
      return;
    }
    // Admission is synchronous: a refused primary never follows its href, an admitted plain link stays native.
    if (!fab.activate(primary).admitted) event.preventDefault();
  };
  // Escape, the close control and the mask dismiss the modal menu with their own reason; focus returns to the real trigger control.
  // A pending confirmation is the top layer and owns its own cancel, so the menu beneath it stays open.
  // The shared native mask keeps its standard paint; only its closability follows closeOnOutside.
  const dismissModalMenu = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    if (fab.confirmation) return;
    const control = event.currentTarget as Element | null;
    const reason =
      event.type === 'keydown' ? 'escape' : control?.tagName === 'BUTTON' ? 'close' : 'outside';
    fab.requestOpen(false, reason);
    fab.focusTrigger();
  };
  // The native dialog settles its own focus after motion; then an opened menu focuses its first eligible item,
  // and a closed one returns focus to the real trigger only while focus is still left in the closed layer.
  const onModalMenuOpenChange = (next: boolean) => {
    if (fab.suspended) return;
    if (next) {
      fab.focusFirstAction();
      return;
    }
    const root = fab.rootRef.current;
    const active = root?.ownerDocument.activeElement;
    const layer = root?.querySelector('.genux-fab-modal-owner');
    if (!active || active === root?.ownerDocument.body || layer?.contains(active))
      fab.focusTrigger();
  };
  const onActionClick = (
    event: MouseEvent<HTMLElement>,
    action: FabAction,
    href: string | undefined,
    blocked: boolean,
  ) => {
    // Busy or disabled items never navigate or run.
    if (blocked) {
      event.preventDefault();
      return;
    }
    // Confirmed links navigate only after the dialog accepts; a refused activation never follows its href,
    // and an admitted plain link keeps native navigation.
    const { admitted } = fab.activate(action);
    if (!admitted || (href && action.confirmation)) event.preventDefault();
  };
  const onDragKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Home') {
      event.preventDefault();
      place.resetPosition();
      return;
    }
    const delta = MOVE_KEYS[event.key];
    if (!delta) return;
    event.preventDefault();
    place.movePosition(delta[0], delta[1]);
  };

  const triggerBase: ButtonBase = {
    slotted: true,
    slotClassName: 'genux-fab-trigger-button',
    radius: radiusCss,
    fill,
    depth,
    disabled: disabled || primaryUnavailable,
    position: iconSide,
    state: busy || primaryProcessing ? 'loading' : 'default',
    href: primaryNative ? primaryHref : undefined,
    target: primaryNative ? primary?.target : undefined,
    rel: primaryNative && primary?.target === '_blank' ? 'noopener noreferrer' : undefined,
    onClick: onTriggerClick,
    'aria-expanded': hasMenu ? fab.open : undefined,
    'aria-controls': hasMenu ? actionsId : undefined,
    'aria-haspopup': hasMenu ? (config.modal ? 'dialog' : 'menu') : undefined,
    'aria-describedby': triggerDescribedBy,
  };
  // The slot keeps the nominal trigger role; measured text height sizes only the host and the inside-text control.
  const triggerStyle: FabStyle = {
    '--slot-size': 'var(--fab-trigger-nominal)',
    '--slot-radius': 'var(--fab-radius)',
  };
  // The icon overlay sits outside the master button, so it paints the native control's resolved --button-text role,
  // copied onto the trigger by the icon-slot measurement, instead of picking a theme role of its own.
  const overlayInk = 'var(--fab-trigger-icon-ink, var(--ink))';
  // The badge attaches to the native trigger control itself, so its corner tracks the real button box.
  const triggerControl = !textInside ? (
    <GenUXButton {...triggerBase} iconOnly icon={masterIcon} aria-label={props.label} />
  ) : (
    // Busy text shows the master progress text; the explicit name keeps the configured trigger label.
    <GenUXButton
      {...triggerBase}
      text={props.label}
      icon={config.content === 'text-only' ? 'none' : masterIcon}
      aria-label={props.label}
    />
  );

  const count = fab.actions.length;
  // Named groups are visible and accessible: each consecutive run of one group opens with its group name.
  const groupLabels = new Map<string, string>(
    (props.groups ?? []).flatMap((group): [string, string][] =>
      group.label?.trim() ? [[group.id, group.label]] : [],
    ),
  );
  const groupNameAt = (index: number): string | undefined => {
    const group = fab.actions[index]?.group;
    return group !== undefined && fab.actions[index - 1]?.group !== group
      ? groupLabels.get(group)
      : undefined;
  };
  const actionNodes = fab.actions.map((action, index) => {
    // A modal menu flows its rows inside the dialog body, so the floating geometry is not applied to them.
    const rect = config.modal ? undefined : geometry.positions.find(item => item.id === action.id);
    const unavailable = actionUnavailableReason(action, props.online);
    // The described reason is the translated text; a caller's own disabledReason stays as written.
    const reasonText =
      callerReason(action) ??
      shownReason(unavailable ?? (action.disabled ? action.disabledReason : undefined));
    const reasonId = `${baseId}-reason-${index}`;
    const descriptionId = `${baseId}-description-${index}`;
    const shortcutId = `${baseId}-shortcut-${index}`;
    const groupName = groupNameAt(index);
    // The group name sits in this first action's measured footprint, outside its control, so action names stay clean.
    const groupHeading = groupName ? (
      <span id={`${baseId}-group-${index}`} className="genux-fab-group-name" aria-hidden="true">
        {groupName}
      </span>
    ) : null;
    const href = action.actionType === 'link' ? safeHref(action.href) : undefined;
    const actionDisabled = isActionDisabled(action);
    const processing = isActionBusy(action);
    // Disabled, busy and confirmed items render as buttons; only a plain available link keeps a native href.
    const nativeHref = actionDisabled || processing || action.confirmation ? undefined : href;
    const describedBy = [
      action.description ? descriptionId : '',
      action.shortcut ? shortcutId : '',
      reasonText ? reasonId : '',
    ]
      .filter(Boolean)
      .join(' ');
    const actionIcon = action.icon;
    // Rows follow the resolved geometry mode: an adaptive menu, a sheet or a modal menu always shows real label text in the native control.
    const rows = config.modal || geometry.mode !== 'dial';
    // Only an icon-only dial keeps the name outside; inside placement renders the real text in the control.
    const outsideLabel =
      !rows &&
      config.content === 'icon-only' &&
      config.labelPlacement !== 'inside' &&
      actionIcon !== undefined;
    const controlIcon = config.content === 'text-only' ? 'none' : (actionIcon ?? 'none');
    const controlRect = rect?.control;
    const labelRect = rect?.label;
    // Delay and order rank come from the motion role owner; transitions stay in CSS.
    // The slot is the full hit target; the stylesheet paints the smaller visual inside it.
    // Control and label offsets are relative to the reserved union box the wrapper occupies.
    const style: FabStyle = {
      ...fabActionMotionStyle(config, index, count),
      '--slot-size': 'var(--fab-action-hit)',
      ...(config.modal ? MODAL_FLOW : {}),
      '--slot-radius': 'var(--fab-radius)',
      ...(rect
        ? {
            '--fab-action-x': px(rect.x - origin.x),
            '--fab-action-y': px(rect.y - origin.y),
            '--fab-action-width': px(rect.width),
            '--fab-action-height': px(rect.height),
          }
        : {}),
      ...(rect && controlRect
        ? {
            '--fab-control-x': px(controlRect.x - rect.x),
            '--fab-control-y': px(controlRect.y - rect.y),
            '--fab-control-width': px(controlRect.width),
            '--fab-control-height': px(controlRect.height),
          }
        : {}),
      ...(rect && labelRect
        ? {
            '--fab-label-x': px(labelRect.x - rect.x),
            '--fab-label-y': px(labelRect.y - rect.y),
            '--fab-label-width': px(labelRect.width),
            '--fab-label-height': px(labelRect.height),
          }
        : {}),
    };
    const base: ButtonBase = {
      slotted: true,
      slotClassName: 'genux-fab-action-button',
      radius: radiusCss,
      fill,
      depth,
      position: iconSide,
      role: 'menuitem',
      // useFab's activeActionId is the sole roving tab stop; the renderer never picks one of its own.
      tabIndex: action.id === fab.activeActionId ? 0 : -1,
      disabled: actionDisabled,
      state: processing ? 'loading' : 'default',
      href: nativeHref,
      target: nativeHref ? action.target : undefined,
      rel: nativeHref && action.target === '_blank' ? 'noopener noreferrer' : undefined,
      'aria-describedby': describedBy || undefined,
      onKeyDown: event => fab.actionKeyDown(event, action.id),
      onClick: event => onActionClick(event, action, href, actionDisabled || processing),
    };
    const metadata = (
      <>
        {action.description ? (
          <span id={descriptionId} className="genux-fab-action-description">
            {action.description}
          </span>
        ) : null}
        {action.shortcut ? (
          <kbd id={shortcutId} className="genux-fab-action-shortcut">
            {action.shortcut}
          </kbd>
        ) : null}
        {reasonText ? (
          <span id={reasonId} className="genux-fab-action-reason">
            {reasonText}
          </span>
        ) : null}
      </>
    );
    const hasMetadata = Boolean(action.description || action.shortcut || reasonText);
    // Rows put metadata below the control at natural height; a dial keeps the outside name and every metadata line
    // in one visible .genux-fab-label container so the geometry measures it and avoids collisions with it.
    const labelNode = rows ? (
      metadata
    ) : outsideLabel || hasMetadata || groupHeading ? (
      <span className="genux-fab-label">
        {groupHeading}
        {outsideLabel ? (
          <span className="genux-fab-label-text" aria-hidden="true">
            {action.label}
          </span>
        ) : null}
        {metadata}
      </span>
    ) : null;
    const control =
      outsideLabel && actionIcon ? (
        <GenUXButton {...base} iconOnly icon={actionIcon} aria-label={action.label} />
      ) : (
        // Busy text shows the master progress text; the explicit name keeps this action's own label.
        <GenUXButton {...base} text={action.label} icon={controlIcon} aria-label={action.label} />
      );
    return (
      <div
        key={action.id}
        className="genux-fab-action"
        data-fab-action-id={action.id}
        data-fab-group={action.group}
        data-fab-mode={config.modal ? 'menu' : geometry.mode}
        data-fab-control-geometry={controlRect ? '' : undefined}
        data-fab-label-geometry={labelRect ? '' : undefined}
        style={style}
      >
        {rows ? groupHeading : null}
        <span className="genux-fab-control-slot">
          {action.badge !== undefined ? (
            <GenUXBadge kind="count" label={action.label} count={action.badge}>
              {control}
            </GenUXBadge>
          ) : (
            control
          )}
        </span>
        {labelNode}
      </div>
    );
  });

  // A named run wraps its actions in a real group labelled by its visible heading; order and count never change.
  const groupedNodes = fab.actions
    .reduce<{ start: number; nodes: ReactNode[] }[]>((runs, action, index) => {
      const last = runs[runs.length - 1];
      if (last && fab.actions[index - 1]?.group === action.group) {
        last.nodes.push(actionNodes[index]);
      } else runs.push({ start: index, nodes: [actionNodes[index]] });
      return runs;
    }, [])
    .flatMap(run =>
      groupNameAt(run.start)
        ? [
            <div
              key={`group-${run.start}`}
              role="group"
              className="genux-fab-group"
              aria-labelledby={`${baseId}-group-${run.start}`}
            >
              {run.nodes}
            </div>,
          ]
        : run.nodes,
    );
  const menu = hasMenu ? (
    <div
      ref={actionsRef}
      id={actionsId}
      className="genux-fab-actions"
      role={fab.open ? 'menu' : undefined}
      aria-label={props.label}
      aria-hidden={closed || undefined}
      data-fab-mode={config.modal ? 'menu' : geometry.mode}
      data-fab-collision={geometry.collision}
      style={
        config.modal
          ? {
              ...MODAL_FLOW,
              // The dialog heading keeps one trigger row and the stage gap above and below, and a shown status card
              // keeps its share below the menu; rows scroll inside the rest.
              maxHeight: `max(${px(metrics.actionTarget)}, calc(${modalAvail} - ${modalMenuReserve}))`,
              overflowY: 'auto',
            }
          : geometry.mode === 'dial'
            ? undefined
            : { maxHeight: px(geometry.maxHeight), overflowY: 'auto' }
      }
      {...fab.groupHandlers}
    >
      {groupedNodes}
    </div>
  ) : null;
  const pending = fab.confirmation;
  // A modal menu really renders as a floating menu in its dialog, so the root reports that layout for the row styles;
  // the requested layout stays in the config. The native dialog owns the one shared mask, so no second scrim paints.
  const renderedLayout = config.modal && hasMenu ? 'floating-menu' : geometry.layout;
  const ownBackdrop = hasMenu && !config.modal && config.backdrop !== 'none';

  return (
    <div
      ref={fab.rootRef}
      className={['genux-fab', props.className].filter(Boolean).join(' ')}
      hidden={!visible}
      style={rootStyle}
      data-fab-state={fab.state}
      data-fab-phase={fab.phase}
      data-fab-positioning={config.positioning}
      data-fab-type={config.type}
      data-fab-layout={renderedLayout}
      data-fab-direction={geometry.direction}
      data-fab-shape={config.shape}
      data-fab-appearance={config.appearance}
      data-fab-size={config.size}
      data-fab-expanded={fab.open}
      data-fab-label-placement={config.labelPlacement}
      data-fab-label-visibility={config.labelVisibility}
      data-fab-icon-position={config.iconPosition}
      data-fab-icon-transition={config.iconTransition}
      data-fab-backdrop={config.backdrop}
      data-fab-modal={config.modal}
      data-fab-entrance={config.motion.entrance.join(' ')}
      data-fab-exit={config.motion.exit.join(' ')}
      data-fab-sequence={config.motion.sequence}
      data-fab-order={config.motion.order}
      data-fab-origin={config.motion.origin}
      data-fab-visibility={config.visibility}
      data-fab-adaptation={config.adaptation}
      data-fab-content={config.content}
      data-fab-collapsed={place.collapsed}
      data-fab-trigger-label-side={place.triggerLabel?.side}
      data-fab-status-placed={place.status ? '' : undefined}
      data-fab-status-collision={place.status && !place.statusClear ? '' : undefined}
    >
      {ownBackdrop ? (
        <div
          className="genux-fab-backdrop"
          aria-hidden="true"
          data-fab-backdrop={config.backdrop}
          data-fab-expanded={fab.open}
          onClick={() => {
            if (config.closeOnOutside) fab.requestOpen(false, 'outside');
          }}
        />
      ) : null}
      {config.modal && menu ? (
        <Modal
          open={fab.open}
          title={<span id={menuTitleId}>{props.label}</span>}
          panelRef={menuPanelRef}
          footer={null}
          forceRender
          keyboard={config.closeOnEscape}
          mask={{ closable: config.closeOnOutside }}
          rootClassName="genux-fab-modal-owner"
          getContainer={ownContainer}
          styles={STAGE_MODAL_STYLES}
          style={STAGE_MODAL_STYLE}
          afterOpenChange={onModalMenuOpenChange}
          onCancel={dismissModalMenu}
        >
          {menu}
          <div ref={setModalStatusSlot} className="genux-fab-modal-status" />
        </Modal>
      ) : (
        menu
      )}
      <div
        ref={fab.triggerRef}
        className={
          iconActive ? 'genux-fab-trigger genux-fab-icon-overlay-active' : 'genux-fab-trigger'
        }
        style={triggerStyle}
        {...fab.triggerHandlers}
      >
        <Tooltip
          title={config.tooltip === 'none' ? undefined : props.label}
          trigger={tooltipTrigger}
          getPopupContainer={popupContainer}
        >
          <span className="genux-fab-tooltip-anchor">
            {props.badge !== undefined ? (
              <GenUXBadge kind="count" label={props.label} count={props.badge}>
                {triggerControl}
              </GenUXBadge>
            ) : (
              triggerControl
            )}
          </span>
        </Tooltip>
        {primaryReason ? (
          <span id={primaryReasonId} className="genux-fab-action-reason">
            {primaryReason}
          </span>
        ) : null}
        {iconActive ? (
          <span
            className="genux-fab-trigger-icon-overlay"
            aria-hidden="true"
            style={{ color: overlayInk }}
          >
            <FabIcon
              icon={masterIcon}
              openIcon={openIcon}
              open={fab.open}
              transition={config.iconTransition}
              size={metrics.icon}
            />
          </span>
        ) : null}
      </div>
      <div ref={statusRef} id={statusId} className="genux-fab-status">
        <div role="status">
          {progress !== undefined ? (
            <Progress percent={progress} showInfo={false} aria-label={props.label} />
          ) : null}
          {progress !== undefined ? `${Math.round(progress)}%` : null}
          {props.counter !== undefined ? (
            <span className="genux-fab-counter">{`${props.label}: ${props.counter}`}</span>
          ) : null}
        </div>
        <p role="alert">{fab.error}</p>
      </div>
      {outerLabel ? (
        <span className="genux-fab-label" aria-hidden="true">
          {props.label}
        </span>
      ) : null}
      {config.draggable ? (
        <div className="genux-fab-drag">
          <div
            className="genux-fab-drag-handle"
            data-fab-drag-disabled={place.dragDisabled || undefined}
            {...(place.dragDisabled ? {} : place.dragHandlers)}
          >
            <GenUXButton
              slotted
              slotClassName="genux-fab-drag-button"
              radius={radiusCss}
              text={t('Move actions')}
              disabled={place.dragDisabled}
              onKeyDown={onDragKeyDown}
            />
          </div>
          <div className="genux-fab-drag-alternatives">
            <GenUXButton
              fill="outline"
              text={t('Move left')}
              disabled={place.dragDisabled}
              onClick={() => place.movePosition(-fabTokens.position.offset, 0)}
            />
            <GenUXButton
              fill="outline"
              text={t('Move right')}
              disabled={place.dragDisabled}
              onClick={() => place.movePosition(fabTokens.position.offset, 0)}
            />
            <GenUXButton
              fill="outline"
              text={t('Reset position')}
              disabled={place.dragDisabled}
              onClick={() => place.resetPosition()}
            />
          </div>
        </div>
      ) : null}
      <Modal
        open={pending !== null && !withdrawn}
        title={<span id={confirmTitleId}>{t('Confirm action')}</span>}
        panelRef={confirmPanelRef}
        onCancel={() => fab.cancelConfirmation()}
        getContainer={ownContainer}
        styles={STAGE_MODAL_STYLES}
        style={STAGE_MODAL_STYLE}
        footer={[
          <GenUXButton
            key="cancel"
            fill="outline"
            text={t('Cancel')}
            onClick={() => fab.cancelConfirmation()}
          />,
          <GenUXButton
            key="confirm"
            text={t('Confirm action')}
            onClick={() => void confirmPending()}
          />,
        ]}
      >
        <p>
          {pending && typeof pending.confirmation === 'string'
            ? pending.confirmation
            : pending?.label}
        </p>
      </Modal>
    </div>
  );
}
