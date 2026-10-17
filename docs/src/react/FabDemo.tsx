import { useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Input, InputNumber, Select, Switch } from 'antd';
import GenUXProvider from './GenUXProvider';
import { Drawer, Modal } from './GenUXOverlay';
import { GenUXPopupScopeContext } from './GenUXPortalScope';
import GenUXButton from './GenUXButton';
import GenUXFab from './GenUXFab';
import ExamplePreview from './ExamplePreview';
import { TweakerSettings } from './GenUXTweaker';
import { useI18n } from './useI18n';
import type { GenUXIconName } from './GenUXIcon';
import fabTokens from '../data/fab-tokens.json';
import { FAB_DEFAULTS, FAB_OPTIONS, normalizeFabOptions, validateFabActions } from '../fab/options';
import type {
  GenUXFabProps,
  FabAction,
  FabAppearance,
  FabConfig,
  FabGroup,
  FabOptions,
  FabPoint,
} from '../fab/types';

type Translate = (text: string) => string;
type Motion = FabConfig['motion'];
type Pending = { resolve: () => void; reject: (error: Error) => void };
type Errors = Readonly<Record<string, string>>;
type Drafts = Readonly<Record<string, number>>;

const axes = FAB_OPTIONS as unknown as Record<string, readonly string[]>;
const motionKeys = new Set(['entrance', 'exit', 'sequence', 'order', 'easing', 'origin']);
const multiKeys = new Set(['entrance', 'exit']);
// state is derived read-only output, actionType is edited per action, the rest have typed controls below.
const ownKeys = new Set(['state', 'actionType', 'size', 'radius', 'alignment']);
const flags = [
  'closeOnSelect',
  'closeOnOutside',
  'closeOnEscape',
  'closeOnScroll',
  'closeOnNavigation',
  'closeOnBlur',
  'toggleOnTrigger',
  'keepOpenOnError',
  'disableWhileLoading',
  'modal',
  'critical',
  'draggable',
] as const;
const actionFlags = [
  'loading',
  'visible',
  'disabled',
  'permission',
  'confirmation',
  'offlineAvailable',
] as const;
const speeds = ['fast', 'normal', 'slow'];
const radii = ['0px', '3px', '5px', '100%'];
const contained: FabOptions = { anchor: 'container', positioning: 'absolute' };
const triggerIcon: GenUXIconName = 'plus';
const closeIcon: GenUXIconName = 'x';
// Approved per-action icon subset; none keeps the renderer default.
const actionIcons: readonly GenUXIconName[] = ['plus', 'check', 'settings', 'trash', 'x'];
// Arc fields validate as one group so an intermediate span stays a visible draft instead of throwing.
const arcFields = {
  'arc-start': 'startAngle',
  'arc-end': 'endAngle',
  'arc-radius': 'radius',
  'arc-gap': 'angularGap',
} as const;
type ArcKey = keyof typeof arcFields;
const arcKeys = Object.keys(arcFields) as ArcKey[];
const isActionKey = (key: string) => key === 'action' || key.startsWith('action-');

const human = (value: string) => {
  const text = value
    .replace(/([A-Z])/g, ' $1')
    .replace(/-/g, ' ')
    .toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const choices = (values: readonly string[], t: Translate) =>
  values.map(value => ({ value, label: t(human(value)) }));
// Easing and backdrop policy await a human decision: only implemented values are selectable, the rest stay listed but disabled.
const implemented: Partial<Record<string, ReadonlySet<string>>> = {
  easing: new Set(['cubic']),
  // none is the provisional default and dim-blur the implemented layer; transparent, dim and blur wait for the decision.
  backdrop: new Set(['none', 'dim-blur']),
};
const pendingChoices = (values: readonly string[], ready: ReadonlySet<string>, t: Translate) =>
  values.map(value =>
    ready.has(value)
      ? { value, label: t(human(value)) }
      : { value, label: `${t(human(value))} (${t('Pending decision')})`, disabled: true },
  );
// A modal FAB always paints its dim-blur mask, so none is unavailable while modal is on; pending values stay pending.
const modalBackdropChoices = (values: readonly string[], t: Translate) =>
  pendingChoices(values, implemented.backdrop ?? new Set<string>(), t).map(choice =>
    choice.value === 'none'
      ? {
          value: choice.value,
          label: `${t(human(choice.value))} (${t('Not available with modal')})`,
          disabled: true,
        }
      : choice,
  );
// validateFabActions caps the list at this many actions; labels only need to be non-empty and unique.
const maxActions = fabTokens.position.maxActions;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
function without<T>(
  record: Readonly<Record<string, T>>,
  drop: (key: string) => boolean,
): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !drop(key)));
}
const localize = (list: readonly FabAction[], t: Translate): FabAction[] =>
  list.map(action => ({
    ...action,
    label: t(action.label),
    description: action.description && t(action.description),
    disabledReason: action.disabledReason && t(action.disabledReason),
    confirmation:
      typeof action.confirmation === 'string' ? t(action.confirmation) : action.confirmation,
  }));
const localizeGroups = (list: readonly FabGroup[], t: Translate): FabGroup[] =>
  list.map(group => ({ ...group, label: group.label && t(group.label) }));

const mainActions: readonly FabAction[] = [
  { id: 'create', label: 'Create item', icon: 'plus', order: 1 },
  { id: 'export', label: 'Export records', icon: 'check', order: 2 },
  { id: 'review', label: 'Review changes', icon: 'settings', order: 3 },
];
// Multi-directional example: each group fans out in its own direction when the layout is multi-directional.
const geometryGroups: readonly FabGroup[] = [
  { id: 'up', label: 'Up', direction: 'up' },
  { id: 'start', label: 'Start', direction: 'start' },
  { id: 'end', label: 'End', direction: 'end' },
];
const geometryActions: readonly FabAction[] = [
  { id: 'create', label: 'Create item', group: 'up', order: 1 },
  { id: 'export', label: 'Export records', group: 'up', order: 2 },
  { id: 'review', label: 'Review changes', group: 'start', order: 3 },
  { id: 'share', label: 'Share link', actionType: 'dialog', group: 'start', order: 4 },
  { id: 'archive', label: 'Archive item', group: 'end', order: 5 },
  { id: 'print', label: 'Print summary', actionType: 'panel', group: 'end', order: 6 },
];
const asyncActions: readonly FabAction[] = [
  {
    id: 'sync',
    label: 'Sync records',
    description: 'Waits for Resolve action or Reject action',
    order: 1,
  },
  { id: 'delete', label: 'Delete draft', confirmation: 'Delete this draft?', order: 2 },
  { id: 'publish', label: 'Publish release', permission: false, order: 3 },
  {
    id: 'lock',
    label: 'Edit locked record',
    disabled: true,
    disabledReason: 'Locked records cannot be edited',
    order: 4,
  },
  { id: 'save', label: 'Save offline copy', offlineAvailable: true, order: 5 },
  { id: 'upload', label: 'Upload attachments', offlineAvailable: false, order: 6 },
];
const longActions: readonly FabAction[] = [
  'Create a new customer onboarding checklist',
  'Export quarterly financial records',
  'Review pending contract changes',
  'Schedule the regional planning meeting',
  'Share the project status summary',
  'Archive completed support conversations',
].map((label, index) => ({ id: `long-${index + 1}`, label, order: index + 1 }));

/** Label plus control pair inside a settings grid, with an optional inline validation message. */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="genux-fab-settings-control">
        {children}
        {error && (
          <span id={`${id}-error`} className="genux-fab-settings-error" role="alert">
            {error}
          </span>
        )}
      </div>
    </>
  );
}

type Surface = Readonly<{ kind: 'panel' | 'dialog'; action: FabAction }>;

type StageProps = Omit<GenUXFabProps, keyof FabOptions | 'containerRef' | 'scrollRef'> & {
  options: FabConfig;
  overrides?: FabOptions;
  contain?: boolean;
  scrollLabel?: string;
  dir?: 'ltr' | 'rtl';
  /** Status-only report after this Stage opened its own panel or dialog surface. */
  onSurface?: (action: FabAction) => void;
  children?: ReactNode;
};

/**
 * Bounded preview surface: owns the container and scroll refs the FAB measures against.
 * contain forces container anchoring and is opt-in; other stages follow the Tweaker anchor and positioning.
 * Panel and dialog actions open the shared overlay in this preview's own portal and return focus on close.
 */
function Stage({
  options,
  overrides = {},
  contain = false,
  scrollLabel,
  dir,
  onAction,
  onSurface,
  children,
  ...fab
}: StageProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const popupScope = useContext(GenUXPopupScopeContext);
  const [surface, setSurface] = useState<Surface | null>(null);
  const [shown, setShown] = useState(false);
  const config = normalizeFabOptions({
    ...options,
    ...(contain ? contained : {}),
    ...overrides,
    motion: { ...options.motion, ...overrides.motion },
    arc: { ...options.arc, ...overrides.arc },
  });
  // Panel and dialog open here, so this preview owns the surface; the outer callback only reports status.
  const handleAction = useCallback(
    (action: FabAction): void | Promise<void> => {
      if (action.actionType === 'panel' || action.actionType === 'dialog') {
        const doc = containerRef.current?.ownerDocument;
        const active = doc?.activeElement;
        returnFocus.current = active instanceof HTMLElement && active !== doc?.body ? active : null;
        setSurface({ kind: action.actionType, action });
        setShown(true);
        onSurface?.(action);
        return;
      }
      return onAction?.(action);
    },
    [onAction, onSurface],
  );
  const close = () => setShown(false);
  // Return focus to the invoking action while it is still a live, visible, enabled control; otherwise, or when focus
  // does not land, to the trigger's native control, never its wrapper.
  const restoreFocus = () => {
    const target = returnFocus.current;
    returnFocus.current = null;
    setSurface(null);
    const focusTo = (element: HTMLElement | null | undefined): boolean => {
      if (!element?.isConnected || element.matches(':disabled')) return false;
      if (element.closest('[inert],[hidden],[aria-hidden="true"]')) return false;
      const view = element.ownerDocument.defaultView;
      if (
        element.getClientRects().length === 0 ||
        view?.getComputedStyle(element).visibility === 'hidden'
      )
        return false;
      element.focus();
      return element.ownerDocument.activeElement === element;
    };
    if (focusTo(target)) return;
    focusTo(
      containerRef.current?.querySelector<HTMLElement>(
        '.genux-fab-trigger button, .genux-fab-trigger a[href], button.genux-fab-trigger, a[href].genux-fab-trigger',
      ),
    );
  };
  const getContainer = popupScope?.getPopupContainer;
  return (
    <div ref={containerRef} className="genux-fab-demo-stage" dir={dir}>
      <div
        ref={scrollRef}
        className="genux-fab-demo-content"
        data-fab-scroll={scrollLabel ? 'true' : undefined}
        role={scrollLabel ? 'region' : undefined}
        aria-label={scrollLabel}
        tabIndex={scrollLabel ? 0 : undefined}
      >
        {children}
      </div>
      <GenUXFab
        {...config}
        {...fab}
        {...(config.type === 'contextual' || config.visibility === 'contextual'
          ? { visible: true }
          : {})}
        onAction={handleAction}
        containerRef={containerRef}
        scrollRef={scrollRef}
      />
      <Drawer
        open={shown && surface?.kind === 'panel'}
        placement="bottom"
        title={surface?.action.label}
        getContainer={getContainer}
        onClose={close}
        afterOpenChange={next => {
          if (!next) restoreFocus();
        }}
      >
        <p>{surface?.action.description ?? t('This panel belongs to the selected FAB action.')}</p>
        <GenUXButton text={t('Close panel')} onClick={close} />
      </Drawer>
      <Modal
        open={shown && surface?.kind === 'dialog'}
        title={surface?.action.label}
        getContainer={getContainer}
        onCancel={close}
        afterClose={restoreFocus}
        footer={<GenUXButton text={t('Close')} onClick={close} />}
      >
        <p>{surface?.action.description ?? t('This dialog belongs to the selected FAB action.')}</p>
      </Modal>
    </div>
  );
}

function FabExamples() {
  const { t } = useI18n();
  const sid = useId();
  const id = (key: string) => `${sid}-${key}`;
  const [options, setOptions] = useState<FabConfig>(() => normalizeFabOptions(FAB_DEFAULTS));
  // actions is the editable draft; published is the last list validateFabActions accepted and the FABs render.
  const [actions, setActions] = useState<readonly FabAction[]>(mainActions);
  const [published, setPublished] = useState<readonly FabAction[]>(mainActions);
  const [errors, setErrors] = useState<Errors>({});
  const [drafts, setDrafts] = useState<Drafts>({});
  const [selected, setSelected] = useState('create');
  const [online, setOnline] = useState(true);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FabPoint>();
  const [appearance, setAppearance] = useState<FabAppearance>('tonal');
  const [badge, setBadge] = useState(3);
  const [counter, setCounter] = useState(12);
  const [progress, setProgress] = useState(40);
  const [rtl, setRtl] = useState(false);
  const [critical, setCritical] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [asyncList, setAsyncList] = useState<readonly FabAction[]>(asyncActions);
  const [adaptive, setAdaptive] = useState<readonly FabAction[]>(longActions);
  const [draft, setDraft] = useState('');
  const obstacle = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const pending = useRef<Pending | null>(null);
  const mounted = useRef(true);
  const nextId = useRef(1);

  // Settle a still-pending deferred action on unmount; mounted guards the follow-up state.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const entry = pending.current;
      pending.current = null;
      entry?.resolve();
    };
  }, []);

  // Every option edit goes through normalizeFabOptions here; a rejection becomes an inline error, never a render crash.
  const commit = (
    key: string,
    build: (current: FabConfig, pendingDrafts: Drafts) => Record<string, unknown>,
    group: readonly string[] = [key],
    value?: number,
  ) => {
    const pendingDrafts = value === undefined ? drafts : { ...drafts, [key]: value };
    let next: FabConfig;
    try {
      next = normalizeFabOptions({ ...options, ...build(options, pendingDrafts) } as FabOptions);
    } catch (error) {
      setErrors(current => ({ ...current, [key]: message(error) }));
      if (value !== undefined) setDrafts(current => ({ ...current, [key]: value }));
      return;
    }
    setOptions(next);
    setErrors(current => without(current, name => group.includes(name)));
    setDrafts(current => without(current, name => group.includes(name)));
  };
  const update = (key: string, patch: Record<string, unknown>) => commit(key, () => patch);
  const updateMotion = (key: string, patch: Record<string, unknown>, value?: number) =>
    commit(key, current => ({ motion: { ...current.motion, ...patch } }), [key], value);
  const updateArc = (key: ArcKey, value: number) =>
    commit(
      key,
      (current, pendingDrafts) => {
        const arc: Record<string, number> = { ...current.arc };
        for (const name of arcKeys) {
          const pendingValue = pendingDrafts[name];
          if (pendingValue !== undefined) arc[arcFields[name]] = pendingValue;
        }
        return { arc };
      },
      arcKeys,
      value,
    );

  // Keep the draft editable on every keystroke and publish only a list the validator accepts.
  const publishActions = (key: string, next: readonly FabAction[]) => {
    setActions(next);
    try {
      validateFabActions(localize(next, t));
    } catch (error) {
      setErrors(current => ({ ...without(current, isActionKey), [key]: message(error) }));
      return;
    }
    setPublished(next);
    setErrors(current => without(current, isActionKey));
  };
  const editAction = (key: string, patch: Record<string, unknown>) =>
    publishActions(
      key,
      actions.map(action =>
        action.id === selected ? ({ ...action, ...patch } as FabAction) : action,
      ),
    );

  const runAction = useCallback(
    (action: FabAction): void | Promise<void> => {
      // Panel and dialog actions are opened by their own Stage; this runs the remaining action types.
      if (action.actionType === 'link') {
        setStatus(`${t('Followed link')}: ${action.label}`);
        return;
      }
      if (action.id !== 'sync') {
        setCount(value => value + 1);
        setStatus(`${t('Completed')}: ${action.label}`);
        return;
      }
      pending.current?.reject(new Error('Superseded'));
      setSyncing(true);
      setStatus(t('Sync records is waiting for Resolve action or Reject action'));
      return new Promise<void>((resolve, reject) => {
        pending.current = { resolve, reject };
      })
        .then(() => {
          if (!mounted.current) return;
          setCount(value => value + 1);
          setStatus(`${t('Resolved')}: ${action.label}`);
        })
        .finally(() => {
          if (mounted.current && pending.current === null) setSyncing(false);
        });
    },
    [t],
  );
  const settle = (ok: boolean) => {
    const entry = pending.current;
    pending.current = null;
    if (ok) entry?.resolve();
    else entry?.reject(new Error(t('Action rejected')));
  };
  const onError = (_error: unknown, action: FabAction) =>
    setStatus(`${t('Failed')}: ${action.label}`);
  // Status only: the originating Stage already owns the opened surface.
  const reportSurface = (action: FabAction) =>
    setStatus(
      `${action.actionType === 'dialog' ? t('Opened dialog') : t('Opened panel')}: ${action.label}`,
    );
  const ordered = [...actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const selectedIndex = ordered.findIndex(action => action.id === selected);
  const addAction = () => {
    const n = nextId.current++;
    publishActions('action', [
      ...actions,
      { id: `custom-${n}`, label: `${t('New action')} ${n}`, order: actions.length + 1 },
    ]);
    setSelected(`custom-${n}`);
  };
  const removeAction = () => {
    const rest = actions.filter(action => action.id !== selected);
    publishActions('action', rest);
    setSelected(rest[0]?.id ?? '');
  };
  const moveAction = (delta: -1 | 1) => {
    const to = selectedIndex + delta;
    if (selectedIndex < 0 || to < 0 || to >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(selectedIndex, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    publishActions(
      'action',
      next.map((action, index) => ({ ...action, order: index + 1 })),
    );
  };
  const togglePermission = () => {
    const granted = asyncList.find(action => action.id === 'publish')?.permission === false;
    setAsyncList(list =>
      list.map(action => (action.id === 'publish' ? { ...action, permission: granted } : action)),
    );
    setStatus(
      `${t('Publish release')}: ${t(granted ? 'Permission granted' : 'Permission removed')}`,
    );
  };
  const toggleOnline = () => {
    setOnline(!online);
    setStatus(t(online ? 'Offline' : 'Online'));
  };
  // Validate an adaptive addition with the model before committing it, so a rejection stays a recoverable field error.
  const adaptiveFull = adaptive.length >= maxActions;
  const addDraft = () => {
    const n = nextId.current;
    const next = [
      ...adaptive,
      { id: `draft-${n}`, label: draft.trim(), order: adaptive.length + 1 },
    ];
    try {
      validateFabActions(localize(next, t));
    } catch (error) {
      setErrors(current => ({ ...current, draft: message(error) }));
      return;
    }
    nextId.current = n + 1;
    setAdaptive(next);
    setDraft('');
    setErrors(current => without(current, name => name === 'draft'));
  };

  const groups =
    options.layout === 'multi-directional' ? localizeGroups(geometryGroups, t) : undefined;
  const shared = {
    label: t('Actions'),
    icon: triggerIcon,
    openIcon: closeIcon,
    online,
    onAction: runAction,
    onSurface: reportSurface,
    onError,
    groups,
  };
  const main = localize(published, t);
  const current = actions.find(action => action.id === selected);
  const derivedState = open ? 'open' : 'closed';
  const radius = options.radius;
  const issue = (key: string) => {
    const text = errors[key];
    return text ? t(text) : undefined;
  };
  const invalid = (key: string) =>
    errors[key]
      ? { status: 'error' as const, 'aria-invalid': true, 'aria-describedby': `${id(key)}-error` }
      : {};
  const num = (
    key: string,
    label: string,
    value: number,
    onChange: (next: number) => void,
    min = -360,
    max = 360,
    step = 1,
  ) => (
    <Field key={key} id={id(key)} label={label} error={issue(key)}>
      <InputNumber
        id={id(key)}
        min={min}
        max={max}
        step={step}
        value={drafts[key] ?? value}
        {...invalid(key)}
        onChange={next => typeof next === 'number' && onChange(next)}
      />
    </Field>
  );
  const duration = (key: 'duration' | 'closeDuration') => {
    const value = options.motion[key];
    return (
      <Field key={key} id={id(key)} label={t(human(key))} error={issue(key)}>
        <Select
          id={id(key)}
          value={typeof value === 'number' ? 'custom' : value}
          onChange={(next: string) => updateMotion(key, { [key]: next === 'custom' ? 240 : next })}
          options={[...choices(speeds, t), { value: 'custom', label: t('Custom') }]}
        />
        <InputNumber
          aria-label={`${t(human(key))} (ms)`}
          min={16}
          max={2000}
          step={10}
          disabled={typeof value !== 'number'}
          value={typeof value === 'number' ? (drafts[key] ?? value) : null}
          {...invalid(key)}
          onChange={next => typeof next === 'number' && updateMotion(key, { [key]: next }, next)}
        />
      </Field>
    );
  };

  return (
    <div className="genux-fab-demo" data-demo="fab">
      <TweakerSettings title={t('FAB playground')}>
        <div className="genux-fab-settings">
          {Object.entries(axes).map(([key, values]) => {
            if (ownKeys.has(key)) return null;
            const inMotion = motionKeys.has(key);
            const value = inMotion
              ? options.motion[key as keyof Motion]
              : options[key as keyof FabConfig];
            const ready = implemented[key];
            return (
              <Field key={key} id={id(key)} label={t(human(key))} error={issue(key)}>
                <Select
                  id={id(key)}
                  mode={multiKeys.has(key) ? 'multiple' : undefined}
                  value={value as string | string[]}
                  {...invalid(key)}
                  onChange={(next: string | string[]) => {
                    // normalizeFabOptions rejects an empty effect list; keep the last effect and explain why.
                    if (Array.isArray(next) && next.length === 0) {
                      setErrors(current => ({ ...current, [key]: 'Keep at least one effect.' }));
                      return;
                    }
                    (inMotion ? updateMotion : update)(key, { [key]: next });
                  }}
                  options={
                    key === 'backdrop' && options.modal
                      ? modalBackdropChoices(values, t)
                      : ready
                        ? pendingChoices(values, ready, t)
                        : choices(values, t)
                  }
                />
              </Field>
            );
          })}
          <Field id={id('size')} label={t('Size')} error={issue('size')}>
            <Select
              id={id('size')}
              value={options.size}
              onChange={next => update('size', { size: next })}
              options={['sm', 'md', 'lg'].map(value => ({ value, label: value.toUpperCase() }))}
            />
          </Field>
          <Field id={id('radius')} label={t('Radius')} error={issue('radius')}>
            <Select
              id={id('radius')}
              value={typeof radius === 'number' ? 'custom' : radius}
              onChange={(next: string) =>
                update('radius', { radius: next === 'custom' ? 8 : next })
              }
              options={[
                ...radii.map(value => ({ value, label: value })),
                { value: 'custom', label: t('Custom') },
              ]}
            />
            <InputNumber
              aria-label={`${t('Radius')} (px)`}
              min={0}
              max={32}
              disabled={typeof radius !== 'number'}
              value={typeof radius === 'number' ? radius : null}
              onChange={next => typeof next === 'number' && update('radius', { radius: next })}
            />
          </Field>
          <Field id={id('alignment')} label={t('Alignment')} error={issue('alignment')}>
            <Select
              id={id('alignment')}
              value={options.alignment}
              onChange={next => update('alignment', { alignment: next })}
              options={choices(['start', 'center', 'end'], t)}
            />
          </Field>
          {flags.map(key => (
            <Field key={key} id={id(key)} label={t(human(key))} error={issue(key)}>
              <Switch
                id={id(key)}
                checked={options[key]}
                // Modal paints the dim-blur mask, so turning it on selects that backdrop in the same edit.
                onChange={next =>
                  update(
                    key,
                    key === 'modal' && next
                      ? { modal: true, backdrop: 'dim-blur' }
                      : { [key]: next },
                  )
                }
              />
            </Field>
          ))}
          {num('arc-start', t('Arc start angle'), options.arc.startAngle, next =>
            updateArc('arc-start', next),
          )}
          {num('arc-end', t('Arc end angle'), options.arc.endAngle, next =>
            updateArc('arc-end', next),
          )}
          {num(
            'arc-radius',
            t('Arc radius'),
            options.arc.radius,
            next => updateArc('arc-radius', next),
            1,
            400,
          )}
          {num(
            'arc-gap',
            t('Angular gap'),
            options.arc.angularGap,
            next => updateArc('arc-gap', next),
            0,
            90,
          )}
          {num(
            'offset-x',
            t('Offset X'),
            options.offset.x,
            next =>
              commit(
                'offset-x',
                current => ({ offset: { ...current.offset, x: next } }),
                ['offset-x'],
                next,
              ),
            -200,
            200,
          )}
          {num(
            'offset-y',
            t('Offset Y'),
            options.offset.y,
            next =>
              commit(
                'offset-y',
                current => ({ offset: { ...current.offset, y: next } }),
                ['offset-y'],
                next,
              ),
            -200,
            200,
          )}
          {duration('duration')}
          {duration('closeDuration')}
          {num(
            'stagger',
            t('Stagger'),
            options.motion.stagger,
            next => updateMotion('stagger', { stagger: next }, next),
            0,
            100,
          )}
          {/* customOrigin is a normalized point inside the action box, so both axes stay 0 to 1. */}
          {num(
            'origin-x',
            t('Custom origin X'),
            options.motion.customOrigin.x,
            next =>
              updateMotion(
                'origin-x',
                { customOrigin: { ...options.motion.customOrigin, x: next } },
                next,
              ),
            0,
            1,
            0.01,
          )}
          {num(
            'origin-y',
            t('Custom origin Y'),
            options.motion.customOrigin.y,
            next =>
              updateMotion(
                'origin-y',
                { customOrigin: { ...options.motion.customOrigin, y: next } },
                next,
              ),
            0,
            1,
            0.01,
          )}
          <span id={id('state')}>{t('State')}</span>
          <output aria-labelledby={id('state')}>{t(human(derivedState))}</output>
          <label htmlFor={id('online')}>{t('Online')}</label>
          <Switch id={id('online')} checked={online} onChange={setOnline} />
          <Field id={id('action')} label={t('Action')} error={issue('action')}>
            <Select
              id={id('action')}
              value={selected}
              onChange={setSelected}
              {...invalid('action')}
              options={actions.map(action => ({ value: action.id, label: t(action.label) }))}
            />
          </Field>
          {current && (
            <>
              <Field id={id('action-label')} label={t('Label')} error={issue('action-label')}>
                <Input
                  id={id('action-label')}
                  value={current.label}
                  {...invalid('action-label')}
                  onChange={event => editAction('action-label', { label: event.target.value })}
                />
              </Field>
              <Field
                id={id('action-description')}
                label={t('Description')}
                error={issue('action-description')}
              >
                <Input
                  id={id('action-description')}
                  value={current.description ?? ''}
                  {...invalid('action-description')}
                  onChange={event =>
                    editAction('action-description', {
                      description: event.target.value || undefined,
                    })
                  }
                />
              </Field>
              <Field
                id={id('action-reason')}
                label={t('Disabled reason')}
                error={issue('action-reason')}
              >
                <Input
                  id={id('action-reason')}
                  value={current.disabledReason ?? ''}
                  {...invalid('action-reason')}
                  onChange={event =>
                    editAction('action-reason', { disabledReason: event.target.value || undefined })
                  }
                />
              </Field>
              <Field
                id={id('action-shortcut')}
                label={t('Shortcut')}
                error={issue('action-shortcut')}
              >
                <Input
                  id={id('action-shortcut')}
                  value={current.shortcut ?? ''}
                  {...invalid('action-shortcut')}
                  onChange={event =>
                    editAction('action-shortcut', { shortcut: event.target.value || undefined })
                  }
                />
              </Field>
              <Field id={id('action-icon')} label={t('Icon')} error={issue('action-icon')}>
                <Select
                  id={id('action-icon')}
                  value={(current.icon ?? 'none') as string}
                  onChange={(next: string) =>
                    editAction('action-icon', { icon: next === 'none' ? undefined : next })
                  }
                  options={[{ value: 'none', label: t('Default') }, ...choices(actionIcons, t)]}
                />
              </Field>
              <Field id={id('action-group')} label={t('Group')} error={issue('action-group')}>
                <Select
                  id={id('action-group')}
                  value={current.group ?? 'none'}
                  onChange={(next: string) =>
                    editAction('action-group', { group: next === 'none' ? undefined : next })
                  }
                  options={[
                    { value: 'none', label: t('None') },
                    ...geometryGroups.map(group => ({
                      value: group.id,
                      label: t(group.label ?? human(group.id)),
                    })),
                  ]}
                />
              </Field>
              {num(
                'action-badge',
                t('Badge'),
                typeof current.badge === 'number' ? current.badge : 0,
                next => editAction('action-badge', { badge: next || undefined }),
                0,
                999,
              )}
              {num(
                'action-order',
                t('Sort order'),
                current.order ?? 0,
                next => editAction('action-order', { order: next }),
                0,
                99,
              )}
              <Field id={id('action-type')} label={t('Action type')} error={issue('action-type')}>
                <Select
                  id={id('action-type')}
                  value={current.actionType ?? 'action'}
                  // A link must carry a safe href in the same edit, otherwise validation would reject the switch.
                  onChange={(next: string) =>
                    editAction('action-type', {
                      actionType: next,
                      href: next === 'link' ? (current.href ?? '#fab-actions') : current.href,
                    })
                  }
                  options={choices(axes.actionType ?? [], t)}
                />
              </Field>
              {current.actionType === 'link' && (
                <Field
                  id={id('action-href')}
                  label={t('Link address')}
                  error={issue('action-href')}
                >
                  <Input
                    id={id('action-href')}
                    value={current.href ?? ''}
                    {...invalid('action-href')}
                    onChange={event =>
                      editAction('action-href', { href: event.target.value || undefined })
                    }
                  />
                </Field>
              )}
              <Field
                id={id('action-close')}
                label={t('Close behavior')}
                error={issue('action-close')}
              >
                <Select
                  id={id('action-close')}
                  value={current.closeBehavior ?? 'inherit'}
                  onChange={next => editAction('action-close', { closeBehavior: next })}
                  options={choices(['inherit', 'close', 'keep-open'], t)}
                />
              </Field>
              {actionFlags.map(key => (
                <Field
                  key={key}
                  id={id(`action-${key}`)}
                  label={t(human(key))}
                  error={issue(`action-${key}`)}
                >
                  <Switch
                    id={id(`action-${key}`)}
                    checked={
                      key === 'visible' || key === 'permission'
                        ? current[key] !== false
                        : Boolean(current[key])
                    }
                    onChange={next => editAction(`action-${key}`, { [key]: next })}
                  />
                </Field>
              ))}
              <GenUXButton
                text={t('Move action up')}
                disabled={selectedIndex <= 0}
                onClick={() => moveAction(-1)}
              />
              <GenUXButton
                text={t('Move action down')}
                disabled={selectedIndex < 0 || selectedIndex >= ordered.length - 1}
                onClick={() => moveAction(1)}
              />
              <GenUXButton text={t('Remove action')} onClick={removeAction} />
            </>
          )}
          <GenUXButton text={t('Add action')} onClick={addAction} />
        </div>
      </TweakerSettings>
      <p className="genux-fab-demo-status" role="status">
        {t('Completed actions')}: {count}. {status}
      </p>
      {/* Cases follow the Tweaker options; overrides are limited to the axis each case demonstrates. */}
      <div className="genux-fab-demo-case" data-fab-case="foundations">
        <ExamplePreview id="fab-foundations" title={t('Foundations')}>
          <Stage options={options} {...shared} actions={main} />
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="geometry">
        <ExamplePreview id="fab-geometry" title={t('Geometry')}>
          {/* Illustrative: a centered trigger leaves room for every geometry layout the Tweaker selects, multi-directional
              groups included, so no layout is forced here; Playground keeps every setting. */}
          <Stage
            options={options}
            overrides={{ horizontal: 'center', vertical: 'center' }}
            {...shared}
            actions={localize(geometryActions, t)}
          />
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="appearance">
        <div className="genux-fab-demo-controls">
          <label htmlFor={id('appearance-case')}>{t('Appearance')}</label>
          <Select<FabAppearance>
            id={id('appearance-case')}
            value={appearance}
            onChange={setAppearance}
            options={choices(axes.appearance ?? [], t) as { value: FabAppearance; label: string }[]}
          />
        </div>
        <ExamplePreview id="fab-appearance" title={t('Appearance')}>
          <Stage options={options} overrides={{ appearance }} {...shared} actions={main} />
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="content">
        <div className="genux-fab-demo-controls">
          {num('content-badge', t('Badge'), badge, setBadge, 0, 999)}
          {num('content-counter', t('Counter'), counter, setCounter, 0, 999)}
          {num('content-progress', t('Progress'), progress, setProgress, 0, 100)}
        </div>
        <ExamplePreview id="fab-content" title={t('Content')}>
          {/* Specialized: badge, counter and progress need the extended icon-text trigger to be visible. */}
          <Stage
            options={options}
            overrides={{ type: 'extended', content: 'icon-text' }}
            {...shared}
            actions={main}
            badge={badge}
            counter={counter}
            progress={progress}
          />
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="interaction">
        <div className="genux-fab-demo-controls">
          <label htmlFor={id('open')}>{t('Open')}</label>
          <Switch id={id('open')} checked={open} onChange={setOpen} />
          <output>
            {t('Drag position')}:{' '}
            {position ? `${Math.round(position.x)}, ${Math.round(position.y)}` : t('Default')}
          </output>
        </div>
        <ExamplePreview id="fab-interaction" title={t('Interaction')}>
          {/* Specialized: dragging is measured against this stage, so it stays contained and draggable. */}
          <Stage
            options={options}
            contain
            overrides={{ draggable: true }}
            {...shared}
            actions={main}
            open={open}
            onOpenChange={(next, reason) => {
              setOpen(next);
              setStatus(`${t(next ? 'Opened' : 'Closed')}: ${t(human(reason))}`);
            }}
            dragPosition={position}
            onPositionChange={setPosition}
          />
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="positioning">
        <div className="genux-fab-demo-controls">
          <label htmlFor={id('rtl')}>{t('Right to left')}</label>
          <Switch id={id('rtl')} checked={rtl} onChange={setRtl} />
        </div>
        <ExamplePreview id="fab-positioning" title={t('Positioning')}>
          {/* Specialized: the trigger anchors to its own reference element while still clearing the obstacle bar. */}
          <Stage
            options={options}
            contain
            overrides={{ anchor: 'element' }}
            {...shared}
            actions={main}
            anchorRef={anchor}
            obstacles={[obstacle]}
            dir={rtl ? 'rtl' : 'ltr'}
          >
            <div ref={obstacle} className="genux-fab-demo-obstacle">
              {t('Reference bar')}
            </div>
            <div ref={anchor} className="genux-fab-demo-anchor">
              {t('Anchor element')}
            </div>
          </Stage>
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="motion">
        <p>
          {t('Entrance')}: {options.motion.entrance.map(value => t(human(value))).join(', ')}.{' '}
          {t('Exit')}: {options.motion.exit.map(value => t(human(value))).join(', ')}. {t('Easing')}
          : {t(human(options.motion.easing))}.
        </p>
        <ExamplePreview id="fab-motion" title={t('Motion')}>
          <Stage options={options} {...shared} actions={main} />
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="backdrop">
        <p>
          {t(
            'Easing and backdrop policy awaits a human decision; Cubic easing stays current until then.',
          )}
        </p>
        <ExamplePreview id="fab-backdrop" title={t('Backdrop')}>
          <Stage options={options} {...shared} actions={main} />
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="scroll">
        <div className="genux-fab-demo-controls">
          <label htmlFor={id('critical-case')}>{t('Critical')}</label>
          <Switch id={id('critical-case')} checked={critical} onChange={setCritical} />
        </div>
        <ExamplePreview id="fab-scroll" title={t('Scroll')}>
          {/* Specialized: scroll visibility reacts to this stage's own scroll region. */}
          <Stage
            options={options}
            contain
            overrides={{
              critical,
              visibility:
                options.visibility === 'always' ? 'hide-on-scroll-down' : options.visibility,
            }}
            {...shared}
            actions={main}
            scrollLabel={t('Scrollable records')}
          >
            {Array.from({ length: 16 }, (_, index) => (
              <p key={index}>
                {t('Record row')} {index + 1}
              </p>
            ))}
          </Stage>
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="actions">
        <div className="genux-fab-demo-controls">
          <label htmlFor={id('online-case')}>{t('Online')}</label>
          <Switch id={id('online-case')} checked={online} onChange={setOnline} />
          <GenUXButton text={t('Toggle online')} onClick={toggleOnline} />
          <GenUXButton text={t('Toggle permission')} onClick={togglePermission} />
          <GenUXButton
            text={t('Resolve action')}
            disabled={!syncing}
            onClick={() => settle(true)}
          />
          <GenUXButton
            text={t('Reject action')}
            disabled={!syncing}
            onClick={() => settle(false)}
          />
        </div>
        <ExamplePreview id="fab-actions" title={t('Actions')}>
          <Stage
            options={options}
            {...shared}
            actions={localize(asyncList, t).map(action =>
              action.id === 'sync' ? { ...action, loading: syncing } : action,
            )}
          />
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="adaptive">
        <div className="genux-fab-demo-controls">
          <Field id={id('draft')} label={t('Draft action label')} error={issue('draft')}>
            <Input
              id={id('draft')}
              value={draft}
              {...invalid('draft')}
              onChange={event => {
                setDraft(event.target.value);
                setErrors(current => without(current, name => name === 'draft'));
              }}
            />
          </Field>
          <GenUXButton
            text={t('Add action')}
            disabled={!draft.trim() || adaptiveFull}
            onClick={addDraft}
          />
          {adaptiveFull && (
            <span id={id('draft-limit')} className="genux-fab-settings-error">
              {t('Action limit reached; remove an action before adding another.')}
            </span>
          )}
          <GenUXButton
            text={t('Remove last action')}
            disabled={adaptive.length === 0}
            onClick={() => {
              setAdaptive(list => list.slice(0, -1));
              setErrors(current => without(current, name => name === 'draft'));
            }}
          />
        </div>
        <ExamplePreview id="fab-adaptive" title={t('Adaptive')}>
          {/* Specialized: the adaptive type with automatic adaptation starts from a circle so long actions fall back to a menu on phone and TV. */}
          <Stage
            options={options}
            overrides={{ type: 'adaptive', adaptation: 'auto', layout: 'circle' }}
            {...shared}
            actions={localize(adaptive, t)}
          />
        </ExamplePreview>
      </div>
      <div className="genux-fab-demo-case" data-fab-case="playground">
        <ExamplePreview id="fab-playground" title={t('Playground')}>
          <Stage options={options} {...shared} actions={main} />
        </ExamplePreview>
      </div>
    </div>
  );
}

export default function FabDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <FabExamples />
    </GenUXProvider>
  );
}
