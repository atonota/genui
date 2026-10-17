import type { FabAction, FabConfig, FabMotion, FabOptions, FabPoint } from './types';
import fabTokens from '../data/fab-tokens.json';
import motion from '../data/motion.json';

// Model-only FAB option tables and validation. No React, DOM or browser globals, so it is SSR safe.

export const FAB_METRICS = fabTokens.size;
export const FAB_MOTION = Object.freeze({
  ...fabTokens.motion,
  ...fabTokens.interaction,
  easing: motion.easing,
});

export const FAB_OPTIONS = Object.freeze({
  type: ['single', 'extended', 'collapsible', 'speed-dial', 'menu', 'contextual', 'adaptive'],
  layout: [
    'linear',
    'diagonal',
    'circle',
    'semi-circle',
    'quarter-circle',
    'custom-arc',
    'multi-directional',
    'floating-menu',
    'sheet',
  ],
  direction: ['up', 'down', 'start', 'end', 'up-start', 'up-end', 'down-start', 'down-end'],
  shape: ['circle', 'rounded-square', 'squircle', 'square', 'pill', 'custom'],
  appearance: [
    'filled',
    'tonal',
    'outlined',
    'soft-outlined',
    'elevated',
    'flat',
    'semi-flat',
    'inset-press',
    'translucent',
    'branded',
  ],
  content: ['icon-only', 'text-only', 'icon-text'],
  labelPlacement: ['inside', 'outside', 'above', 'below', 'start', 'end'],
  labelVisibility: ['always', 'hover', 'focus', 'expanded-only'],
  tooltip: ['none', 'hover', 'focus', 'hover-focus'],
  iconPosition: ['start', 'end', 'top', 'bottom'],
  iconTransition: ['rotate', 'replace', 'morph', 'static'],
  density: ['compact', 'comfortable', 'spacious'],
  trigger: ['click', 'hover', 'long-press', 'gesture'],
  horizontal: ['start', 'center', 'end'],
  vertical: ['top', 'center', 'bottom'],
  anchor: ['viewport', 'container', 'element'],
  positioning: ['fixed', 'absolute', 'sticky'],
  edge: ['normal', 'header-overlap', 'footer-overlap'],
  entrance: ['fade', 'scale', 'slide', 'pop'],
  exit: ['fade', 'scale', 'slide'],
  sequence: ['together', 'staggered'],
  order: ['forward', 'reverse', 'from-center'],
  easing: ['cubic', 'linear', 'ease-out', 'ease-in-out', 'spring'],
  origin: ['trigger-center', 'edge', 'custom'],
  backdrop: ['none', 'transparent', 'dim', 'blur', 'dim-blur'],
  visibility: [
    'always',
    'hide-on-scroll-down',
    'show-on-scroll-up',
    'collapse-on-scroll',
    'expand-near-top',
    'contextual',
    'sticky-boundary',
  ],
  adaptation: ['auto', 'compact', 'expanded', 'sheet'],
  state: ['closed', 'opening', 'open', 'closing', 'disabled', 'busy'],
  actionType: ['action', 'link', 'panel', 'dialog'],
} as const);

const SIZES = ['sm', 'md', 'lg'] as const;
const ALIGNMENTS = ['start', 'center', 'end'] as const;
const RADII = ['0px', '3px', '5px', '100%'] as const;
const DURATIONS = ['fast', 'normal', 'slow'] as const;
const CLOSE_BEHAVIORS = ['inherit', 'close', 'keep-open'] as const;
const TARGETS = ['_self', '_blank'] as const;

// Easing and backdrop policy await a human decision: cubic and none are safe interim defaults, not final acceptance.
const DEFAULT_MOTION = Object.freeze<Required<FabMotion>>({
  entrance: Object.freeze(['scale', 'fade'] as const),
  exit: Object.freeze(['scale', 'fade'] as const),
  sequence: 'staggered',
  order: 'forward',
  duration: 'normal',
  closeDuration: 'normal',
  stagger: fabTokens.motion.stagger,
  easing: 'cubic',
  origin: 'trigger-center',
  customOrigin: Object.freeze({ x: 0.5, y: 0.5 }),
});

export const FAB_DEFAULTS: FabConfig = Object.freeze<FabConfig>({
  type: 'speed-dial',
  layout: 'linear',
  direction: 'up',
  shape: 'rounded-square',
  appearance: 'semi-flat',
  size: 'md',
  radius: '5px',
  density: 'comfortable',
  content: 'icon-only',
  labelPlacement: 'outside',
  labelVisibility: 'always',
  tooltip: 'none',
  iconPosition: 'start',
  iconTransition: 'rotate',
  trigger: 'click',
  horizontal: 'end',
  vertical: 'bottom',
  anchor: 'container',
  positioning: 'absolute',
  edge: 'normal',
  alignment: 'end',
  offset: Object.freeze({ x: fabTokens.position.offset, y: fabTokens.position.offset }),
  arc: Object.freeze({ startAngle: -90, endAngle: 270, radius: 112, angularGap: 0 }),
  motion: DEFAULT_MOTION,
  backdrop: 'none',
  modal: false,
  visibility: 'always',
  adaptation: 'auto',
  critical: false,
  draggable: false,
  closeOnSelect: true,
  closeOnOutside: true,
  closeOnEscape: true,
  closeOnScroll: false,
  closeOnNavigation: true,
  closeOnBlur: true,
  toggleOnTrigger: true,
  keepOpenOnError: true,
  disableWhileLoading: true,
});

type EnumKey =
  | 'type'
  | 'layout'
  | 'direction'
  | 'shape'
  | 'appearance'
  | 'size'
  | 'density'
  | 'content'
  | 'labelPlacement'
  | 'labelVisibility'
  | 'tooltip'
  | 'iconPosition'
  | 'iconTransition'
  | 'trigger'
  | 'horizontal'
  | 'vertical'
  | 'anchor'
  | 'positioning'
  | 'edge'
  | 'alignment'
  | 'backdrop'
  | 'visibility'
  | 'adaptation';

type BooleanKey =
  | 'modal'
  | 'critical'
  | 'draggable'
  | 'closeOnSelect'
  | 'closeOnOutside'
  | 'closeOnEscape'
  | 'closeOnScroll'
  | 'closeOnNavigation'
  | 'closeOnBlur'
  | 'toggleOnTrigger'
  | 'keepOpenOnError'
  | 'disableWhileLoading';

type Duration = Required<FabMotion>['duration'];
type Fields = Readonly<Record<string, unknown>>;

const ENUM_RULES: { readonly [K in EnumKey]: readonly FabConfig[K][] } = {
  type: FAB_OPTIONS.type,
  layout: FAB_OPTIONS.layout,
  direction: FAB_OPTIONS.direction,
  shape: FAB_OPTIONS.shape,
  appearance: FAB_OPTIONS.appearance,
  size: SIZES,
  density: FAB_OPTIONS.density,
  content: FAB_OPTIONS.content,
  labelPlacement: FAB_OPTIONS.labelPlacement,
  labelVisibility: FAB_OPTIONS.labelVisibility,
  tooltip: FAB_OPTIONS.tooltip,
  iconPosition: FAB_OPTIONS.iconPosition,
  iconTransition: FAB_OPTIONS.iconTransition,
  trigger: FAB_OPTIONS.trigger,
  horizontal: FAB_OPTIONS.horizontal,
  vertical: FAB_OPTIONS.vertical,
  anchor: FAB_OPTIONS.anchor,
  positioning: FAB_OPTIONS.positioning,
  edge: FAB_OPTIONS.edge,
  alignment: ALIGNMENTS,
  backdrop: FAB_OPTIONS.backdrop,
  visibility: FAB_OPTIONS.visibility,
  adaptation: FAB_OPTIONS.adaptation,
};

const ENUM_KEYS = Object.keys(ENUM_RULES) as EnumKey[];
const BOOLEAN_KEYS: readonly BooleanKey[] = [
  'modal',
  'critical',
  'draggable',
  'closeOnSelect',
  'closeOnOutside',
  'closeOnEscape',
  'closeOnScroll',
  'closeOnNavigation',
  'closeOnBlur',
  'toggleOnTrigger',
  'keepOpenOnError',
  'disableWhileLoading',
];

const OPTION_KEYS: ReadonlySet<string> = new Set(Object.keys(FAB_DEFAULTS));
const MOTION_KEYS: ReadonlySet<string> = new Set(Object.keys(DEFAULT_MOTION));
const ARC_KEYS: ReadonlySet<string> = new Set(Object.keys(FAB_DEFAULTS.arc));
const POINT_KEYS: ReadonlySet<string> = new Set(['x', 'y']);
const ACTION_KEYS: ReadonlySet<string> = new Set([
  'id',
  'label',
  'description',
  'icon',
  'order',
  'group',
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
  'onAction',
]);

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const SCHEME = /^[a-z][a-z\d+.-]*:/i;
const HTTP_URL = /^https?:\/\/[^/?#]/i;

function fields(value: unknown, name: string, keys: ReadonlySet<string>): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) throw new TypeError(`${name} has unknown key ${key}.`);
  }
  return value as Fields;
}

function pickEnum<T>(value: unknown, allowed: readonly T[], fallback: T, name: string): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T))
    throw new RangeError(`${name} must be one of: ${allowed.join(', ')}.`);
  return value as T;
}

function pickBoolean(value: unknown, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean.`);
  return value;
}

function requireFinite(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new RangeError(`${name} must be a finite number.`);
  return value;
}

function pickNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (value === undefined) return fallback;
  const number = requireFinite(value, name);
  if (number < min || number > max) throw new RangeError(`${name} must be from ${min} to ${max}.`);
  return number;
}

function requireText(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new TypeError(`${name} must be a non-empty string.`);
  return value;
}

function pickRadius(value: unknown): FabConfig['radius'] {
  if (typeof value === 'string')
    return pickEnum(value, RADII, FAB_DEFAULTS.radius, 'FAB option radius');
  return value === undefined
    ? FAB_DEFAULTS.radius
    : pickNumber(value, 0, 0, 32, 'FAB option radius');
}

function pickDuration(value: unknown, fallback: Duration, name: string): Duration {
  if (typeof value === 'string') return pickEnum(value, DURATIONS, fallback, name);
  return value === undefined ? fallback : pickNumber(value, 0, 16, 2000, name);
}

function pickPoint(value: unknown, fallback: FabPoint, name: string): FabPoint {
  if (value === undefined) return fallback;
  const point = fields(value, name, POINT_KEYS);
  return Object.freeze({
    x: requireFinite(point.x, `${name} x`),
    y: requireFinite(point.y, `${name} y`),
  });
}

// A custom motion origin is a fraction of the trigger box; values outside 0..1 are rejected, never clamped.
function pickFraction(value: unknown, fallback: FabPoint, name: string): FabPoint {
  const point = pickPoint(value, fallback, name);
  for (const axis of ['x', 'y'] as const) {
    if (point[axis] < 0 || point[axis] > 1)
      throw new RangeError(`${name} ${axis} must be from 0 to 1.`);
  }
  return point;
}

function pickEffects<T>(
  value: unknown,
  allowed: readonly T[],
  fallback: readonly T[],
  name: string,
): readonly T[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.length === 0)
    throw new TypeError(`${name} must be a non-empty array.`);
  const effects: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const effect = pickEnum<T>(value[index], allowed, allowed[0], `${name} item ${index}`);
    if (value[index] === undefined) throw new TypeError(`${name} item ${index} is missing.`);
    if (effects.includes(effect))
      throw new RangeError(`${name} contains duplicate ${String(effect)}.`);
    effects.push(effect);
  }
  return Object.freeze(effects);
}

function normalizeArc(value: unknown): FabConfig['arc'] {
  const fallback = FAB_DEFAULTS.arc;
  if (value === undefined) return fallback;
  const arc = fields(value, 'FAB option arc', ARC_KEYS);
  const startAngle =
    arc.startAngle === undefined
      ? fallback.startAngle
      : requireFinite(arc.startAngle, 'FAB arc startAngle');
  const endAngle =
    arc.endAngle === undefined
      ? fallback.endAngle
      : requireFinite(arc.endAngle, 'FAB arc endAngle');
  const radius =
    arc.radius === undefined ? fallback.radius : requireFinite(arc.radius, 'FAB arc radius');
  const angularGap = pickNumber(arc.angularGap, fallback.angularGap, 0, 360, 'FAB arc angularGap');
  const span = endAngle - startAngle;
  if (radius <= 0) throw new RangeError('FAB arc radius must be greater than 0.');
  if (!(span > 0 && span <= 360))
    throw new RangeError('FAB arc span must be greater than 0 and at most 360 degrees.');
  return Object.freeze({ startAngle, endAngle, radius, angularGap });
}

function normalizeMotion(value: unknown): FabConfig['motion'] {
  if (value === undefined) return DEFAULT_MOTION;
  const input = fields(value, 'FAB option motion', MOTION_KEYS);
  return Object.freeze<Required<FabMotion>>({
    entrance: pickEffects(
      input.entrance,
      FAB_OPTIONS.entrance,
      DEFAULT_MOTION.entrance,
      'FAB motion entrance',
    ),
    exit: pickEffects(input.exit, FAB_OPTIONS.exit, DEFAULT_MOTION.exit, 'FAB motion exit'),
    sequence: pickEnum(
      input.sequence,
      FAB_OPTIONS.sequence,
      DEFAULT_MOTION.sequence,
      'FAB motion sequence',
    ),
    order: pickEnum(input.order, FAB_OPTIONS.order, DEFAULT_MOTION.order, 'FAB motion order'),
    duration: pickDuration(input.duration, DEFAULT_MOTION.duration, 'FAB motion duration'),
    closeDuration: pickDuration(
      input.closeDuration,
      DEFAULT_MOTION.closeDuration,
      'FAB motion closeDuration',
    ),
    stagger: pickNumber(input.stagger, DEFAULT_MOTION.stagger, 0, 100, 'FAB motion stagger'),
    easing: pickEnum(input.easing, FAB_OPTIONS.easing, DEFAULT_MOTION.easing, 'FAB motion easing'),
    origin: pickEnum(input.origin, FAB_OPTIONS.origin, DEFAULT_MOTION.origin, 'FAB motion origin'),
    customOrigin: pickFraction(
      input.customOrigin,
      DEFAULT_MOTION.customOrigin,
      'FAB motion customOrigin',
    ),
  });
}

export function normalizeFabOptions(input?: FabOptions): FabConfig {
  if (input === undefined) return FAB_DEFAULTS;
  const source = fields(input, 'FAB options', OPTION_KEYS);
  const config: Record<string, unknown> = {};
  for (const key of ENUM_KEYS) {
    config[key] = pickEnum<FabConfig[EnumKey]>(
      source[key],
      ENUM_RULES[key],
      FAB_DEFAULTS[key],
      `FAB option ${key}`,
    );
  }
  for (const key of BOOLEAN_KEYS)
    config[key] = pickBoolean(source[key], FAB_DEFAULTS[key], `FAB option ${key}`);
  // A modal FAB paints the shared dim-blur mask, so only an unspecified modal backdrop derives it; an explicit
  // backdrop, none included, is kept for the renderer policy to judge.
  if (source.modal === true && source.backdrop === undefined) config.backdrop = 'dim-blur';
  config.radius = pickRadius(source.radius);
  config.offset = pickPoint(source.offset, FAB_DEFAULTS.offset, 'FAB option offset');
  config.arc = normalizeArc(source.arc);
  config.motion = normalizeMotion(source.motion);
  return Object.freeze(config) as unknown as FabConfig;
}

function isSafeHref(href: string): boolean {
  if (href === '' || href.trim() !== href || CONTROL_CHARACTERS.test(href)) return false;
  if (href.includes('\\') || href.startsWith('//')) return false;
  return !SCHEME.test(href) || HTTP_URL.test(href);
}

function validateAction(value: unknown, index: number): FabAction {
  const name = `FAB action ${index}`;
  const input = fields(value, name, ACTION_KEYS);
  requireText(input.id, `${name} id`);
  requireText(input.label, `${name} label`);
  for (const key of ['description', 'icon', 'group', 'disabledReason', 'shortcut'] as const) {
    if (input[key] !== undefined) requireText(input[key], `${name} ${key}`);
  }
  for (const key of ['visible', 'disabled', 'loading', 'permission', 'offlineAvailable'] as const) {
    pickBoolean(input[key], false, `${name} ${key}`);
  }
  if (input.order !== undefined) requireFinite(input.order, `${name} order`);
  if (input.badge !== undefined && typeof input.badge !== 'string')
    requireFinite(input.badge, `${name} badge`);
  const actionType = pickEnum(
    input.actionType,
    FAB_OPTIONS.actionType,
    'action',
    `${name} actionType`,
  );
  const closeBehavior = pickEnum(
    input.closeBehavior,
    CLOSE_BEHAVIORS,
    'inherit',
    `${name} closeBehavior`,
  );
  if (input.target !== undefined) pickEnum(input.target, TARGETS, '_self', `${name} target`);
  if (input.confirmation !== undefined && typeof input.confirmation !== 'boolean') {
    requireText(input.confirmation, `${name} confirmation`);
  }
  if (input.href !== undefined && (typeof input.href !== 'string' || !isSafeHref(input.href))) {
    throw new RangeError(
      `${name} href must be an http, https, root-relative, relative or hash URL.`,
    );
  }
  if (actionType === 'link' && input.href === undefined)
    throw new TypeError(`${name} link requires href.`);
  if (input.onAction !== undefined && typeof input.onAction !== 'function') {
    throw new TypeError(`${name} onAction must be a function.`);
  }
  const action = value as FabAction;
  return Object.freeze<FabAction>({
    ...action,
    actionType,
    closeBehavior,
    visible: action.visible ?? true,
    permission: action.permission ?? true,
    offlineAvailable: action.offlineAvailable ?? false,
  });
}

export function validateFabActions(actions: readonly FabAction[]): readonly FabAction[] {
  if (!Array.isArray(actions)) throw new TypeError('FAB actions must be an array.');
  if (actions.length > fabTokens.position.maxActions) {
    throw new RangeError(
      `FAB actions must contain at most ${fabTokens.position.maxActions} items.`,
    );
  }
  const ids = new Set<string>();
  const validated: FabAction[] = [];
  // Labels only need to be non-empty; equal labels, for example in different groups, stay distinct by their unique IDs.
  for (let index = 0; index < actions.length; index += 1) {
    const action = validateAction(actions[index], index);
    if (ids.has(action.id)) throw new RangeError(`FAB action id ${action.id} is duplicated.`);
    ids.add(action.id);
    validated.push(action);
  }
  return Object.freeze(validated);
}

export function actionUnavailableReason(action: FabAction, online = true): string | undefined {
  if (action.disabled === true) {
    return action.disabledReason !== undefined && action.disabledReason.trim() !== ''
      ? action.disabledReason
      : 'This action is disabled.';
  }
  if (action.loading === true) return 'This action is in progress.';
  if (!online && action.offlineAvailable !== true) return 'This action is unavailable offline.';
  return undefined;
}

export function resolveFabActions(
  actions: readonly FabAction[],
  online = true,
): readonly FabAction[] {
  if (typeof online !== 'boolean') throw new TypeError('FAB online state must be a boolean.');
  const entries = validateFabActions(actions)
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => action.visible !== false && action.permission !== false);
  entries.sort((a, b) => (a.action.order ?? 0) - (b.action.order ?? 0) || a.index - b.index);
  return Object.freeze(
    entries.map(({ action }) => {
      const reason = actionUnavailableReason(action, online);
      return reason === undefined
        ? action
        : Object.freeze<FabAction>({ ...action, disabled: true, disabledReason: reason });
    }),
  );
}
