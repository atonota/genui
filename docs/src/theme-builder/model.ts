import type { ThemeConfig } from 'antd';
import {
  contrastInk,
  contrastRatio,
  generateColorPalette,
  hexToRgb,
  relativeLuminance,
} from '../data/color-system';
import { inputSurfaces } from '../data/input-surfaces';
import motion from '../data/motion.json';
import {
  OVERLAY_TOKEN_IDS,
  overlayDefaultValues,
  overlayVariablesFromValues,
} from '../data/overlay-tokens';
import {
  FULL_ROUND_RADIUS_PX,
  RADIUS_OPTIONS,
  isLegacyRadius,
  isRadiusTokenId,
  radiusCss,
  radiusPx,
} from '../data/radius-options';
import definitionsSource from './definitions.json';

export type ThemeMode = 'light' | 'dark';
export type ThemeTokenKind = 'number' | 'color' | 'choice';
export type ThemeTokenValue = string | number;

export type ThemeTokenGeometry = Readonly<{
  x: number;
  y: number;
  spread: number;
  /** #RRGGBB or the id of a color definition. */
  color: string;
  opacity: number;
  inset: boolean;
  /** Used only when the definition value itself is not the blur radius. */
  blur?: number;
}>;

export type ThemeTokenDefinition = Readonly<{
  id: string;
  label: string;
  group: string;
  kind: ThemeTokenKind;
  defaults: Readonly<{ light: ThemeTokenValue; dark: ThemeTokenValue }>;
  unit: string;
  css: `--${string}`;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
  geometry?: ThemeTokenGeometry;
}>;

export type ThemeValues = Record<string, ThemeTokenValue>;
export type ThemeRecipe = { version: 1; light: ThemeValues; dark: ThemeValues };
export type ThemeRecipeResult =
  | Readonly<{ ok: true; recipe: ThemeRecipe }>
  | Readonly<{ ok: false; error: string }>;

export type BrandTone = Readonly<{ color: string; dark: string; tint: string; ink: string }>;
export type ThemeBuilderResolution = Readonly<{
  variables: Readonly<Record<`--${string}`, string>>;
  token: NonNullable<ThemeConfig['token']>;
  components: NonNullable<ThemeConfig['components']>;
  brandTones: Readonly<{ middle: BrandTone; dark: BrandTone; light: BrandTone; pastel: BrandTone }>;
  brand: Readonly<Record<string, string>>;
  palette: readonly string[];
  shadows: readonly string[];
}>;

export const THEME_RECIPE_VERSION = 1;
/** Recipes written before the overlay group carry exactly these definitions. */
export const LEGACY_THEME_TOKEN_COUNT = 51;
/** The overlay contract adds a fixed set of six definitions shared with the CSS helper. */
export const OVERLAY_THEME_TOKEN_COUNT = 6;
/** Compact row heights added after the overlay group; recipes saved before them gain defaults. */
export const COMPACT_SIZE_TOKEN_IDS = [
  'size-compact-sm',
  'size-compact-md',
  'size-compact-lg',
] as const;
export const COMPACT_THEME_TOKEN_COUNT = COMPACT_SIZE_TOKEN_IDS.length;
/** Editable weight added after compact heights; older complete recipes gain only its default. */
export const FONT_WEIGHT_TOKEN_ID = 'font-weight';
export const FONT_WEIGHT_THEME_TOKEN_COUNT = 1;
/** Badge heights added after editable weight; complete earlier recipes gain only their defaults. */
export const BADGE_SIZE_TOKEN_IDS = ['size-badge-sm', 'size-badge-md', 'size-badge-lg'] as const;
export const BADGE_THEME_TOKEN_COUNT = BADGE_SIZE_TOKEN_IDS.length;
/** Listy presentation added after badge heights; complete earlier recipes gain only its default. */
export const LISTY_SURFACE_TOKEN_ID = 'listy-surface';
export const LISTY_SURFACE_THEME_TOKEN_COUNT = 1;
export const LISTY_SURFACES = ['inset', 'outlined'] as const;
export type ListySurface = (typeof LISTY_SURFACES)[number];
export const THEME_TOKEN_COUNT =
  LEGACY_THEME_TOKEN_COUNT +
  OVERLAY_THEME_TOKEN_COUNT +
  COMPACT_THEME_TOKEN_COUNT +
  FONT_WEIGHT_THEME_TOKEN_COUNT +
  BADGE_THEME_TOKEN_COUNT +
  LISTY_SURFACE_THEME_TOKEN_COUNT;
export const MAX_THEME_RECIPE_BYTES = 32 * 1024;
export const MIN_TEXT_CONTRAST = 4.5;
export const MIN_FONT_SIZE_PX = 14;
/** Fixed shapes are described in the builder but are never definition edits. */
export const FIXED_RADII = Object.freeze({ none: 0, pill: FULL_ROUND_RADIUS_PX, circle: '50%' });

export const THEME_RECIPE_ERRORS = Object.freeze({
  notText: 'Theme JSON must be text.',
  tooLarge: 'Theme JSON must not exceed 32 KiB.',
  syntax: 'Theme JSON could not be parsed.',
  shape: 'A theme recipe must be an object containing only version, light and dark.',
  version: 'Theme recipe version must be 1.',
  modeShape: (mode: ThemeMode) => `The ${mode} theme must be an object.`,
  unknownToken: (mode: ThemeMode) => `The ${mode} theme contains an unknown token.`,
  missingToken: (mode: ThemeMode, id: string) => `The ${mode} theme is missing "${id}".`,
  invalidToken: (mode: ThemeMode, id: string, reason: string) =>
    `"${id}" in the ${mode} theme ${reason}`,
  order: (mode: ThemeMode, group: string) =>
    `${group} values in the ${mode} theme must be ordered small ≤ medium ≤ large.`,
  fieldDarker: (mode: ThemeMode) =>
    `In the ${mode} theme the field background must be darker than the panel.`,
  contrast: (mode: ThemeMode, role: string) =>
    `In the ${mode} theme ${role} text needs 4.5:1 contrast against the panel and field.`,
  overlayScrimNeutral: 'Overlay scrim color must be neutral grey.',
  overlayOrder: (mode: ThemeMode) =>
    `Overlay layers in the ${mode} theme must be ordered scrim < trigger < popup.`,
});

const MODES: readonly ThemeMode[] = ['light', 'dark'];
const HEX6 = /^#[0-9a-f]{6}$/i;
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const CSS_VAR = /^--[a-z][a-z0-9-]{0,63}$/;
const SAFE_UNIT = /^[a-z%]{0,4}$/;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString']);
const UNSAFE_OPTION = /[;{}<>\\`!@]|\/\*|(?:url|expression|image|image-set|src|attr|env)\s*\(/i;

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
const own = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const fmt = (value: number): string => String(Number(value.toFixed(4)));
/** A scrim stays neutral grey: equal red, green and blue channels at any lightness. */
const isNeutralGrey = (hex: string): boolean => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return false;
  const [r, g, b] = [match[1]!, match[2]!, match[3]!].map(channel => channel.toLowerCase());
  return r === g && g === b;
};
const px = (value: number): string => `${fmt(value)}px`;
const kebab = (name: string): string =>
  name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

function invalidDefinitions(message: string): never {
  throw new TypeError(`Theme token definitions are invalid: ${message}.`);
}

// --- Definitions ------------------------------------------------------------

type ValueCheck =
  | Readonly<{ ok: true; value: ThemeTokenValue }>
  | Readonly<{ ok: false; reason: string }>;

function checkValue(def: ThemeTokenDefinition, value: unknown): ValueCheck {
  if (def.kind === 'number') {
    if (!isFiniteNumber(value)) return { ok: false, reason: 'must be a finite number.' };
    if ((def.min !== undefined && value < def.min) || (def.max !== undefined && value > def.max))
      return { ok: false, reason: 'is outside its permitted range.' };
    if (def.step !== undefined) {
      const steps = (value - (def.min ?? 0)) / def.step;
      if (Math.abs(steps - Math.round(steps)) > 1e-6)
        return { ok: false, reason: 'does not match its step.' };
    }
    return { ok: true, value };
  }
  if (def.kind === 'color') {
    if (typeof value !== 'string' || !HEX6.test(value))
      return { ok: false, reason: 'must use the #RRGGBB format.' };
    return { ok: true, value: value.toUpperCase() };
  }
  // Radius roles also keep a legacy whole px number (0-32) exactly until the user edits it.
  if (isRadiusTokenId(def.id) && isLegacyRadius(value)) return { ok: true, value };
  if (typeof value !== 'string' || !def.options?.includes(value))
    return { ok: false, reason: 'must be one of the listed options.' };
  return { ok: true, value };
}

function readText(value: unknown, where: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && value.trim() === ''))
    invalidDefinitions(`${where} must be text of at most ${max} characters`);
  return value;
}

function readOptionalNumber(value: unknown, where: string): number | undefined {
  if (value === undefined) return undefined;
  if (!isFiniteNumber(value)) invalidDefinitions(`${where} must be a finite number`);
  return value;
}

function readOptions(value: unknown, where: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0)
    invalidDefinitions(`${where} options must be a non-empty array`);
  const options = value.map((option: unknown) => {
    const raw = isPlainRecord(option) ? option.value : option;
    const text = readText(raw, `${where} option`, 160);
    if (UNSAFE_OPTION.test(text)) invalidDefinitions(`${where} option contains unsafe CSS`);
    return text;
  });
  if (new Set(options).size !== options.length) invalidDefinitions(`${where} options repeat`);
  return Object.freeze(options);
}

function readGeometry(value: unknown, where: string): ThemeTokenGeometry | undefined {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value)) invalidDefinitions(`${where} geometry must be an object`);
  const number = (name: string): number => {
    const n = value[name];
    if (!isFiniteNumber(n) || Math.abs(n) > 256)
      invalidDefinitions(`${where} geometry ${name} must be a bounded number`);
    return n;
  };
  const color = readText(value.color, `${where} geometry color`, 64);
  if (!HEX6.test(color) && !SAFE_ID.test(color))
    invalidDefinitions(`${where} geometry color must be #RRGGBB or a token id`);
  const opacity = number('opacity');
  if (opacity < 0 || opacity > 1) invalidDefinitions(`${where} geometry opacity must be 0–1`);
  const inset = value.inset === undefined ? false : value.inset;
  if (typeof inset !== 'boolean') invalidDefinitions(`${where} geometry inset must be boolean`);
  const blur = value.blur === undefined ? undefined : number('blur');
  return Object.freeze({
    x: number('x'),
    y: number('y'),
    spread: number('spread'),
    color,
    opacity,
    inset,
    ...(blur === undefined ? {} : { blur }),
  });
}

function readDefinition(raw: unknown, index: number): ThemeTokenDefinition {
  const where = `entry ${index + 1}`;
  if (!isPlainRecord(raw)) invalidDefinitions(`${where} must be an object`);
  const id = readText(raw.id, `${where} id`, 64);
  if (!SAFE_ID.test(id) || RESERVED.has(id)) invalidDefinitions(`${where} id is not a safe name`);
  const kind = raw.kind;
  if (kind !== 'number' && kind !== 'color' && kind !== 'choice')
    invalidDefinitions(`${id} kind must be number, color or choice`);
  const css = readText(raw.css, `${id} css`, 66);
  if (!CSS_VAR.test(css)) invalidDefinitions(`${id} css must be a custom property name`);
  const unit =
    raw.unit === undefined || raw.unit === null ? '' : readText(raw.unit, `${id} unit`, 4, true);
  if (!SAFE_UNIT.test(unit)) invalidDefinitions(`${id} unit is not supported`);
  const min = readOptionalNumber(raw.min, `${id} min`);
  const max = readOptionalNumber(raw.max, `${id} max`);
  const step = readOptionalNumber(raw.step, `${id} step`);
  if (kind === 'number' && (min === undefined || max === undefined || min > max))
    invalidDefinitions(`${id} must declare an ordered min and max`);
  if (step !== undefined && step <= 0) invalidDefinitions(`${id} step must be positive`);
  const options = kind === 'choice' ? readOptions(raw.options, id) : undefined;
  const geometry = readGeometry(raw.geometry, id);
  if (!isPlainRecord(raw.defaults)) invalidDefinitions(`${id} defaults must be an object`);
  const definition: ThemeTokenDefinition = {
    id,
    label: readText(raw.label, `${id} label`, 120),
    group: readText(raw.group, `${id} group`, 80),
    kind,
    defaults: { light: 0, dark: 0 },
    unit,
    css: css as `--${string}`,
    description: readText(raw.description ?? '', `${id} description`, 1024, true),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(step === undefined ? {} : { step }),
    ...(options === undefined ? {} : { options }),
    ...(geometry === undefined ? {} : { geometry }),
  };
  const defaults = raw.defaults;
  const light = checkValue(definition, defaults.light);
  const dark = checkValue(definition, defaults.dark);
  if (!light.ok || !dark.ok) invalidDefinitions(`${id} defaults are not valid values`);
  return Object.freeze({
    ...definition,
    defaults: Object.freeze({ light: light.value, dark: dark.value }),
  });
}

function readDefinitions(source: unknown): readonly ThemeTokenDefinition[] {
  const list: unknown = Array.isArray(source)
    ? source
    : isPlainRecord(source)
      ? (source.tokens ?? source.definitions)
      : undefined;
  if (!Array.isArray(list)) invalidDefinitions('expected an array of definitions');
  const definitions = list.map(readDefinition);
  if (definitions.length !== THEME_TOKEN_COUNT)
    invalidDefinitions(`expected ${THEME_TOKEN_COUNT} definitions, found ${definitions.length}`);
  if (new Set(definitions.map(d => d.id)).size !== definitions.length)
    invalidDefinitions('ids must be unique');
  if (new Set(definitions.map(d => d.css)).size !== definitions.length)
    invalidDefinitions('css variables must be unique');
  // The overlay ids are a fixed contract with the CSS helper; neither side may drift or go inert.
  const overlayIds = new Set<string>(OVERLAY_TOKEN_IDS);
  if (
    OVERLAY_TOKEN_IDS.length !== OVERLAY_THEME_TOKEN_COUNT ||
    overlayIds.size !== OVERLAY_THEME_TOKEN_COUNT
  )
    invalidDefinitions(`expected ${OVERLAY_THEME_TOKEN_COUNT} overlay token ids`);
  for (const id of overlayIds)
    if (!definitions.some(d => d.id === id))
      invalidDefinitions(`${id} must be defined in the overlay group`);
  for (const def of definitions) {
    const color = def.geometry?.color;
    if (color && !HEX6.test(color) && !definitions.some(d => d.id === color && d.kind === 'color'))
      invalidDefinitions(`${def.id} geometry color must reference a color token`);
  }
  return Object.freeze(definitions);
}

export const tokenDefinitions: readonly ThemeTokenDefinition[] = readDefinitions(definitionsSource);
const definitionsById = new Map(tokenDefinitions.map(def => [def.id, def]));

// --- Semantic roles ---------------------------------------------------------

function requiredRole(id: string, kind: ThemeTokenKind): ThemeTokenDefinition {
  const def = definitionsById.get(id);
  if (!def || def.kind !== kind) return invalidDefinitions(`${id} must be a ${kind} token`);
  return def;
}
const scaleRole = (prefix: string) =>
  Object.freeze({
    sm: requiredRole(`${prefix}-sm`, 'number'),
    md: requiredRole(`${prefix}-md`, 'number'),
    lg: requiredRole(`${prefix}-lg`, 'number'),
  });
/** A general radius step offers exactly the shared four choices, in order. */
const radiusRole = (id: string): ThemeTokenDefinition => {
  const def = requiredRole(id, 'choice');
  const options = def.options ?? [];
  if (
    !isRadiusTokenId(id) ||
    options.length !== RADIUS_OPTIONS.length ||
    RADIUS_OPTIONS.some((option, index) => options[index] !== option)
  )
    invalidDefinitions(`${id} must offer ${RADIUS_OPTIONS.join(', ')}`);
  return def;
};

// Exact id bindings: a renamed or missing definition fails loudly instead of going inert.
const roles = Object.freeze({
  primary: requiredRole('primary', 'color'),
  ink: requiredRole('text', 'color'),
  muted: requiredRole('muted', 'color'),
  paper: requiredRole('canvas', 'color'),
  panel: requiredRole('panel', 'color'),
  field: requiredRole('field', 'color'),
  border: requiredRole('border', 'color'),
  divider: requiredRole('divider', 'color'),
  success: requiredRole('success', 'color'),
  info: requiredRole('info', 'color'),
  warning: requiredRole('warning', 'color'),
  danger: requiredRole('danger', 'color'),
  disabledBg: requiredRole('disabled-bg', 'color'),
  disabledText: requiredRole('disabled-text', 'color'),
  borderWidth: requiredRole('border-width', 'number'),
  borderStyle: requiredRole('border-style', 'choice'),
  radius: Object.freeze({
    sm: radiusRole('radius-sm'),
    md: radiusRole('radius-md'),
    lg: radiusRole('radius-lg'),
  }),
  size: scaleRole('size'),
  sizeCompact: scaleRole('size-compact'),
  sizeBadge: scaleRole('size-badge'),
  spaceLocal: scaleRole('space-local'),
  spaceSection: scaleRole('space-section'),
  spaceLayout: scaleRole('space-layout'),
  insetControl: scaleRole('inset-control'),
  insetContainer: scaleRole('inset-container'),
  insetPage: scaleRole('inset-page'),
  shadow: scaleRole('shadow'),
  textBody: requiredRole('text-body', 'number'),
  textLabel: requiredRole('text-label', 'number'),
  textHelper: requiredRole('text-helper', 'number'),
  textTable: requiredRole('text-table', 'number'),
  textHeading: requiredRole('text-heading', 'number'),
  textCode: requiredRole('text-code', 'number'),
  fontWeight: requiredRole(FONT_WEIGHT_TOKEN_ID, 'number'),
  density: requiredRole('density', 'choice'),
  surfaceDepth: requiredRole('surface', 'choice'),
  listySurface: requiredRole(LISTY_SURFACE_TOKEN_ID, 'choice'),
  overlayScrimColor: requiredRole('overlay-scrim-color', 'color'),
  overlayScrimOpacity: requiredRole('overlay-scrim-opacity', 'number'),
  overlayBackdropBlur: requiredRole('overlay-backdrop-blur', 'number'),
  overlayScrimZ: requiredRole('overlay-scrim-z', 'number'),
  overlayTriggerZ: requiredRole('overlay-trigger-z', 'number'),
  overlayPopupZ: requiredRole('overlay-popup-z', 'number'),
});
for (const def of Object.values(roles.shadow))
  if (!def.geometry) invalidDefinitions(`${def.id} must declare shadow geometry`);
/** The six editable text sizes share the strict 14 px floor whatever their definition minimum. */
const textSizeIds: ReadonlySet<string> = new Set(
  [
    roles.textBody,
    roles.textLabel,
    roles.textHelper,
    roles.textTable,
    roles.textHeading,
    roles.textCode,
  ].map(def => def.id),
);
const TEXT_BELOW_MINIMUM = `is below the ${MIN_FONT_SIZE_PX} px text minimum.`;
// The Listy surface is a fixed two-keyword contract shared with the CSS and the Cascader popup.
const listySurfaceOptions = roles.listySurface.options ?? [];
if (
  listySurfaceOptions.length !== LISTY_SURFACES.length ||
  LISTY_SURFACES.some((option, index) => listySurfaceOptions[index] !== option)
)
  invalidDefinitions(`${LISTY_SURFACE_TOKEN_ID} must offer ${LISTY_SURFACES.join(', ')}`);

// Preserve the exact 51 / 57 / 60 / 61 / 64 stored generations before the Listy surface.
// Each complete generation upgrades by adding only its missing defaults.
const overlayTokenIds: ReadonlySet<string> = new Set(OVERLAY_TOKEN_IDS);
const compactTokenIds: ReadonlySet<string> = new Set<string>(COMPACT_SIZE_TOKEN_IDS);
const badgeTokenIds: ReadonlySet<string> = new Set<string>(BADGE_SIZE_TOKEN_IDS);
const legacyTokenIds: ReadonlySet<string> = new Set(
  tokenDefinitions
    .filter(
      def =>
        !overlayTokenIds.has(def.id) &&
        !compactTokenIds.has(def.id) &&
        !badgeTokenIds.has(def.id) &&
        def.id !== FONT_WEIGHT_TOKEN_ID &&
        def.id !== LISTY_SURFACE_TOKEN_ID,
    )
    .map(def => def.id),
);
/** Recipes saved before the compact heights hold the legacy and overlay ids. */
const overlayGenerationIds: ReadonlySet<string> = new Set([...legacyTokenIds, ...overlayTokenIds]);
/** Complete recipes saved with compact heights but before editable weight. */
const compactGenerationIds: ReadonlySet<string> = new Set([
  ...overlayGenerationIds,
  ...compactTokenIds,
]);
/** Complete recipes saved with editable weight but before badge heights. */
const weightGenerationIds: ReadonlySet<string> = new Set([
  ...compactGenerationIds,
  FONT_WEIGHT_TOKEN_ID,
]);
/** Complete recipes saved with badge heights but before the Listy surface. */
const badgeGenerationIds: ReadonlySet<string> = new Set([...weightGenerationIds, ...badgeTokenIds]);
if (legacyTokenIds.size !== LEGACY_THEME_TOKEN_COUNT)
  invalidDefinitions(
    `expected ${LEGACY_THEME_TOKEN_COUNT} legacy definitions, found ${legacyTokenIds.size}`,
  );

// Groups such as radius-sm / radius-md / radius-lg must stay ordered.
const orderedGroups: readonly Readonly<{ name: string; sm: string; md: string; lg: string }>[] =
  (() => {
    const groups = new Map<string, Partial<Record<'sm' | 'md' | 'lg', string>>>();
    for (const def of tokenDefinitions) {
      if (def.kind !== 'number') continue;
      const match = /^(.+?)(?:[-_](sm|md|lg)|(Sm|Md|Lg))$/.exec(def.id);
      if (!match) continue;
      const size = (match[2] ?? match[3] ?? '').toLowerCase() as 'sm' | 'md' | 'lg';
      const name = match[1] ?? def.id;
      groups.set(name, { ...groups.get(name), [size]: def.id });
    }
    return [...groups].flatMap(([name, g]) =>
      g.sm && g.md && g.lg ? [Object.freeze({ name, sm: g.sm, md: g.md, lg: g.lg })] : [],
    );
  })();

// --- Validation -------------------------------------------------------------

function validateMode(mode: ThemeMode, input: unknown): ThemeValues | string {
  if (!isPlainRecord(input)) return THEME_RECIPE_ERRORS.modeShape(mode);
  for (const key of Object.keys(input))
    if (!definitionsById.has(key)) return THEME_RECIPE_ERRORS.unknownToken(mode);
  const values: ThemeValues = {};
  for (const def of tokenDefinitions) {
    if (!own(input, def.id)) return THEME_RECIPE_ERRORS.missingToken(mode, def.id);
    const checked = checkValue(def, input[def.id]);
    if (!checked.ok) return THEME_RECIPE_ERRORS.invalidToken(mode, def.id, checked.reason);
    if (textSizeIds.has(def.id) && Number(checked.value) < MIN_FONT_SIZE_PX)
      return THEME_RECIPE_ERRORS.invalidToken(mode, def.id, TEXT_BELOW_MINIMUM);
    values[def.id] = checked.value;
  }
  for (const group of orderedGroups) {
    const [sm, md, lg] = [values[group.sm], values[group.md], values[group.lg]].map(Number);
    if (!(sm! <= md! && md! <= lg!)) return THEME_RECIPE_ERRORS.order(mode, group.name);
  }
  const panel = String(values[roles.panel.id]);
  const field = String(values[roles.field.id]);
  if (relativeLuminance(field) >= relativeLuminance(panel))
    return THEME_RECIPE_ERRORS.fieldDarker(mode);
  for (const [role, def] of [
    ['body', roles.ink],
    ['muted', roles.muted],
  ] as const) {
    const color = String(values[def.id]);
    if (
      contrastRatio(color, panel) < MIN_TEXT_CONTRAST ||
      contrastRatio(color, field) < MIN_TEXT_CONTRAST
    )
      return THEME_RECIPE_ERRORS.contrast(mode, role);
  }
  // Overlay bounds come from the definitions; the model only adds the neutral and layer-order rules.
  if (!isNeutralGrey(String(values[roles.overlayScrimColor.id])))
    return THEME_RECIPE_ERRORS.overlayScrimNeutral;
  const scrimZ = Number(values[roles.overlayScrimZ.id]);
  const triggerZ = Number(values[roles.overlayTriggerZ.id]);
  const popupZ = Number(values[roles.overlayPopupZ.id]);
  if (!(scrimZ < triggerZ && triggerZ < popupZ)) return THEME_RECIPE_ERRORS.overlayOrder(mode);
  return Object.freeze(values);
}

type StoredGeneration = 'legacy' | 'overlay' | 'compact' | 'weight' | 'badge';

/** An earlier mode holds exactly one previous id set: nothing missing, nothing extra. */
const hasExactIds = (input: unknown, ids: ReadonlySet<string>): boolean => {
  if (!isPlainRecord(input)) return false;
  const keys = Object.keys(input);
  return keys.length === ids.size && keys.every(key => ids.has(key));
};
const storedGeneration = (input: unknown): StoredGeneration | null =>
  hasExactIds(input, legacyTokenIds)
    ? 'legacy'
    : hasExactIds(input, overlayGenerationIds)
      ? 'overlay'
      : hasExactIds(input, compactGenerationIds)
        ? 'compact'
        : hasExactIds(input, weightGenerationIds)
          ? 'weight'
          : hasExactIds(input, badgeGenerationIds)
            ? 'badge'
            : null;

/** Keeps every stored value as provided and adds only the missing defaults; never mutates. */
function upgradeStoredMode(mode: ThemeMode, input: unknown, generation: StoredGeneration): unknown {
  if (!isPlainRecord(input)) return input;
  const upgraded: Record<string, unknown> = { ...input };
  if (generation === 'legacy') {
    const defaults = overlayDefaultValues(mode);
    for (const id of OVERLAY_TOKEN_IDS) upgraded[id] = defaults[id];
  }
  if (generation === 'legacy' || generation === 'overlay')
    for (const id of COMPACT_SIZE_TOKEN_IDS) upgraded[id] = definitionsById.get(id)?.defaults[mode];
  // A stored custom weight is kept; only generations before it gain the default.
  if (generation !== 'weight' && generation !== 'badge')
    upgraded[FONT_WEIGHT_TOKEN_ID] = roles.fontWeight.defaults[mode];
  // Stored badge heights are kept; only generations before them gain the defaults.
  if (generation !== 'badge')
    for (const id of BADGE_SIZE_TOKEN_IDS) upgraded[id] = definitionsById.get(id)?.defaults[mode];
  upgraded[LISTY_SURFACE_TOKEN_ID] = roles.listySurface.defaults[mode];
  return upgraded;
}

/** Accepts only plain data with every known token in both modes; unknown input is never merged. */
export function validateRecipe(input: unknown): ThemeRecipeResult {
  if (!isPlainRecord(input)) return { ok: false, error: THEME_RECIPE_ERRORS.shape };
  const keys = Object.keys(input);
  if (keys.length !== 3 || !own(input, 'version') || !own(input, 'light') || !own(input, 'dark'))
    return { ok: false, error: THEME_RECIPE_ERRORS.shape };
  if (input.version !== THEME_RECIPE_VERSION)
    return { ok: false, error: THEME_RECIPE_ERRORS.version };
  // Only a complete earlier generation in both modes is upgraded; partial or mixed sets fail.
  const generation = storedGeneration(input.light);
  const upgrade = generation === storedGeneration(input.dark) ? generation : null;
  const lightInput = upgrade ? upgradeStoredMode('light', input.light, upgrade) : input.light;
  const light = validateMode('light', lightInput);
  if (typeof light === 'string') return { ok: false, error: light };
  const darkInput = upgrade ? upgradeStoredMode('dark', input.dark, upgrade) : input.dark;
  const dark = validateMode('dark', darkInput);
  if (typeof dark === 'string') return { ok: false, error: dark };
  return { ok: true, recipe: Object.freeze({ version: THEME_RECIPE_VERSION, light, dark }) };
}

type RecipeJson = Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false; error: string }>;

/** Shared by strict and stored reads: text type, 32 KiB bound and JSON syntax. */
function readRecipeJson(text: string): RecipeJson {
  if (typeof text !== 'string') return { ok: false, error: THEME_RECIPE_ERRORS.notText };
  if (new TextEncoder().encode(text).byteLength > MAX_THEME_RECIPE_BYTES)
    return { ok: false, error: THEME_RECIPE_ERRORS.tooLarge };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: THEME_RECIPE_ERRORS.syntax };
  }
}

export function parseRecipe(text: string): ThemeRecipeResult {
  const json = readRecipeJson(text);
  return json.ok ? validateRecipe(json.value) : json;
}

/** Text sizes saved under the earlier 12 px floor; only storage lifts them to the minimum. */
const STORED_TEXT_SIZES: ReadonlySet<unknown> = new Set([12, 13]);

/** Copies a stored mode and lifts only exact 12 or 13 px text sizes; every other field is kept. */
function migrateStoredText(input: unknown): unknown {
  if (!isPlainRecord(input)) return input;
  const migrated: Record<string, unknown> = { ...input };
  for (const id of textSizeIds)
    if (own(input, id) && STORED_TEXT_SIZES.has(input[id])) migrated[id] = MIN_FONT_SIZE_PX;
  return migrated;
}

/** Storage-only read: a version 1 recipe has its 12-13 px text sizes lifted to 14 px, then the
    strict validation and earlier-generation upgrade decide. Imports keep using parseRecipe. */
export function parseStoredRecipe(text: string): ThemeRecipeResult {
  const json = readRecipeJson(text);
  if (!json.ok) return json;
  const input = json.value;
  if (
    !isPlainRecord(input) ||
    Object.keys(input).length !== 3 ||
    input.version !== THEME_RECIPE_VERSION ||
    !own(input, 'light') ||
    !own(input, 'dark')
  )
    return validateRecipe(input);
  return validateRecipe({
    version: input.version,
    light: migrateStoredText(input.light),
    dark: migrateStoredText(input.dark),
  });
}

/** Complete, stable export: version first, tokens in definition order. */
export function serializeRecipe(recipe: ThemeRecipe): string {
  const checked = validateRecipe(recipe);
  if (!checked.ok) throw new TypeError(checked.error);
  return JSON.stringify(checked.recipe, null, 2);
}

function buildDefaultRecipe(): ThemeRecipe {
  const pick = (mode: ThemeMode): ThemeValues =>
    Object.fromEntries(tokenDefinitions.map(def => [def.id, def.defaults[mode]]));
  return { version: THEME_RECIPE_VERSION, light: pick('light'), dark: pick('dark') };
}
const defaultCheck = validateRecipe(buildDefaultRecipe());
if (!defaultCheck.ok)
  invalidDefinitions(`defaults do not form a valid recipe (${defaultCheck.error})`);

export function createDefaultRecipe(): ThemeRecipe {
  return buildDefaultRecipe();
}

/** Listy presentation of an applied recipe in one scheme; without a recipe the default applies. */
export function listySurfaceOf(
  recipe: ThemeRecipe | null | undefined,
  mode: ThemeMode,
): ListySurface {
  const value = recipe?.[mode][LISTY_SURFACE_TOKEN_ID] ?? roles.listySurface.defaults[mode];
  return LISTY_SURFACES.find(surface => surface === value) ?? 'inset';
}

/** Factory corner radii as AntD numbers (100% maps to the safe full-round value); the general
    --radius role is Radius MD. */
export const DEFAULT_RADII = Object.freeze({
  sm: radiusPx(roles.radius.sm.defaults.light),
  md: radiusPx(roles.radius.md.defaults.light),
  lg: radiusPx(roles.radius.lg.defaults.light),
});

/** Default radius and every height family as CSS variables, so static CSS and providers paint the
    general radius and size roles before any recipe resolves. */
export function defaultGeometryVariables(
  mode: ThemeMode = 'light',
): Readonly<Record<`--${string}`, string>> {
  const variables: Record<`--${string}`, string> = {};
  for (const def of Object.values(roles.radius)) variables[def.css] = radiusCss(def.defaults[mode]);
  for (const group of [roles.size, roles.sizeCompact, roles.sizeBadge])
    for (const def of Object.values(group))
      variables[def.css] = formatValue(def, def.defaults[mode]);
  variables['--radius'] = radiusCss(roles.radius.md.defaults[mode]);
  return Object.freeze(variables);
}

// --- Resolver ---------------------------------------------------------------

const MOTION_EASING = motion.easing;
const motionMs = (name: keyof typeof motion.durationMs): number => motion.durationMs[name];
const seconds = (ms: number): string => `${fmt(ms / 1000)}s`;
const DENSITY_FACTORS: Readonly<Record<string, number>> = Object.freeze({
  compact: 0.75,
  standard: 1,
  comfortable: 1.25,
});
const SURFACE_DEPTHS: readonly string[] = ['flat', 'inset', 'raised'];
for (const option of roles.density.options ?? [])
  if (!own(DENSITY_FACTORS, option)) invalidDefinitions(`density option ${option} has no factor`);
for (const option of roles.surfaceDepth.options ?? [])
  if (!SURFACE_DEPTHS.includes(option))
    invalidDefinitions(`surface option ${option} is not supported`);
const FONT_FAMILY = 'Outfit, system-ui, sans-serif';

function formatValue(def: ThemeTokenDefinition, value: ThemeTokenValue): string {
  return typeof value === 'number' ? `${fmt(value)}${def.unit}` : value;
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${fmt(alpha)})`;
}

function shadowRecipe(def: ThemeTokenDefinition, values: ThemeValues, ink: string) {
  const geometry = def.geometry!;
  const value = values[def.id]!;
  const referenced = HEX6.test(geometry.color) ? geometry.color : values[geometry.color];
  const color =
    def.kind === 'color' ? String(value) : typeof referenced === 'string' ? referenced : ink;
  const blur = def.kind === 'number' ? Number(value) : (geometry.blur ?? 0);
  const css =
    def.kind === 'choice' && value === 'none'
      ? 'none'
      : `${geometry.inset ? 'inset ' : ''}${px(geometry.x)} ${px(geometry.y)} ${px(blur)} ${px(geometry.spread)} ${rgba(color, geometry.opacity)}`;
  return { css, color, blur, geometry };
}

function readableIndex(
  palette: readonly string[],
  start: number,
  surfaces: readonly string[],
): number | null {
  const readable = (index: number) =>
    surfaces.every(surface => contrastRatio(palette[index]!, surface) >= MIN_TEXT_CONTRAST);
  for (let index = start; index < palette.length; index += 1) if (readable(index)) return index;
  for (let index = start - 1; index >= 0; index -= 1) if (readable(index)) return index;
  return null;
}

function readableRun(palette: readonly string[], surfaces: readonly string[], fallback: string) {
  const index = readableIndex(palette, 5, surfaces);
  if (index === null) return { base: fallback, hover: fallback, active: fallback };
  const at = (offset: number) => {
    const color = palette[Math.min(index + offset, palette.length - 1)]!;
    return surfaces.every(s => contrastRatio(color, s) >= MIN_TEXT_CONTRAST)
      ? color
      : palette[index]!;
  };
  return { base: palette[index]!, hover: at(1), active: at(2) };
}

function tone(color: string, dark: string, tint: string): BrandTone {
  return Object.freeze({ color, dark, tint, ink: contrastInk(color) });
}

function resolveMode(recipe: ThemeRecipe, mode: ThemeMode): ThemeBuilderResolution {
  const values = recipe[mode];
  const color = (def: ThemeTokenDefinition): string => String(values[def.id]).toUpperCase();
  const num = (def: ThemeTokenDefinition): number => Number(values[def.id]);
  const scale = (group: Readonly<Record<'sm' | 'md' | 'lg', ThemeTokenDefinition>>) => ({
    sm: num(group.sm),
    md: num(group.md),
    lg: num(group.lg),
  });

  const panel = color(roles.panel);
  const field = color(roles.field);
  const paper = color(roles.paper);
  // Surface depth is a keyword role; raised surfaces keep the panel color.
  const surface = panel;
  const ink = color(roles.ink);
  const muted = color(roles.muted);
  const border = color(roles.border);
  const divider = color(roles.divider);
  const seed = color(roles.primary);
  const surfaces = [...new Set([panel, field, paper])];

  const palette = Object.freeze(generateColorPalette(seed, mode, panel).map(c => c.toUpperCase()));
  const lightPalette = generateColorPalette(seed, 'light').map(c => c.toUpperCase());
  const p = (index: number): string => palette[index]!;
  const accent = readableRun(palette, surfaces, ink);
  const onPrimary = contrastInk(seed);
  const edge = p(mode === 'light' ? 6 : 7);

  const brand = Object.freeze({
    primary: seed,
    primaryHover: p(4),
    primaryActive: p(6),
    primaryEdge: edge,
    onPrimary,
    accent: accent.base,
    accentHover: accent.hover,
    accentActive: accent.active,
    actionInk: accent.base,
    soft: p(0),
    primaryBorder: edge,
    primaryBg: p(0),
  });

  const darkToneIndex = Math.max(
    6,
    lightPalette.findIndex((c, i) => i >= 6 && contrastRatio(c, '#FFFFFF') >= MIN_TEXT_CONTRAST),
  );
  const lp = (index: number): string => lightPalette[Math.min(index, 9)]!;
  const brandTones = Object.freeze({
    middle: tone(seed, lp(6), lp(0)),
    dark: tone(lp(darkToneIndex), lp(darkToneIndex + 1), lp(0)),
    light: tone(lp(3), lp(4), lp(0)),
    pastel: tone(lp(0), lp(1), lp(0)),
  });

  // Each status keeps its exact editable seed; readable text, background and border derive from it.
  const statusRoles = {
    success: roles.success,
    warning: roles.warning,
    error: roles.danger,
    info: roles.info,
  };
  const status = Object.fromEntries(
    Object.entries(statusRoles).map(([name, def]) => {
      const base = color(def);
      const shades = generateColorPalette(base, mode, panel).map(c => c.toUpperCase());
      const readable = surfaces.every(s => contrastRatio(base, s) >= MIN_TEXT_CONTRAST);
      const text = readable ? base : readableRun(shades, surfaces, ink).base;
      return [name, { color: base, text, bg: shades[0]!, border: shades[2]! }];
    }),
  ) as Record<
    keyof typeof statusRoles,
    { color: string; text: string; bg: string; border: string }
  >;

  // Radius roles hold a choice or a legacy whole px: CSS keeps 100%, AntD gets safe numbers.
  const radius = {
    sm: radiusCss(values[roles.radius.sm.id]),
    md: radiusCss(values[roles.radius.md.id]),
    lg: radiusCss(values[roles.radius.lg.id]),
  };
  const radiusNumber = {
    sm: radiusPx(values[roles.radius.sm.id]),
    md: radiusPx(values[roles.radius.md.id]),
    lg: radiusPx(values[roles.radius.lg.id]),
  };
  // Control heights keep their 48/56/64 minima; density never changes them.
  const size = scale(roles.size);
  const space = scale(roles.spaceLocal);
  const controlInset = scale(roles.insetControl);
  const containerInset = scale(roles.insetContainer);
  const sectionSpace = scale(roles.spaceSection);
  const density = DENSITY_FACTORS[String(values[roles.density.id])]!;
  // Density scales gaps and padding only, staying on the 4px rhythm.
  const gap = (value: number): number => Math.max(4, Math.round((value * density) / 4) * 4);
  // Central field/group gaps share the density rhythm; a group always separates more than a field.
  const fieldGap = gap(space.md);
  const fieldGapCompact = gap(space.sm);
  const fieldGapDense = gap((space.sm * 2) / 3);
  const sectionGap = Math.max(gap(sectionSpace.sm), fieldGap + 4);
  const borderWidth = num(roles.borderWidth);
  const borderStyle = String(values[roles.borderStyle.id]);
  const fontFamily = FONT_FAMILY;
  const fontWeight = fmt(num(roles.fontWeight));
  const fontPx = (def: ThemeTokenDefinition): number => Math.max(MIN_FONT_SIZE_PX, num(def));
  const fontSize = fontPx(roles.textBody);
  const labelSize = fontPx(roles.textLabel);
  const helperSize = fontPx(roles.textHelper);
  const tableSize = fontPx(roles.textTable);
  const codeSize = fontPx(roles.textCode);
  // Headings never drop below body text and the title stays above the section heading.
  const sectionSize = Math.max(fontSize, fontPx(roles.textHeading));
  const titleSize = Math.round(sectionSize * 1.25);
  const largeSize = Math.max(fontSize + 2, labelSize);
  const disabledInk = color(roles.disabledText);
  const disabledBg = color(roles.disabledBg);
  const depth = String(values[roles.surfaceDepth.id]);
  // Fields stay inset whatever the panel depth and reuse the canonical neutral well shadow.
  const inputInnerShadow = inputSurfaces[mode].innerShadow;
  const shadowCss = (def: ThemeTokenDefinition): string => shadowRecipe(def, values, ink).css;
  const surfaceShadow =
    depth === 'flat' ? 'none' : depth === 'raised' ? shadowCss(roles.shadow.md) : inputInnerShadow;
  const surfaceBorderWidth = depth === 'inset' ? px(borderWidth) : '0px';

  const variables: Record<`--${string}`, string> = {};
  const shadows: string[] = [];
  for (const def of tokenDefinitions) {
    const value = values[def.id]!;
    if (!def.geometry) {
      variables[def.css] = isRadiusTokenId(def.id) ? radiusCss(value) : formatValue(def, value);
      continue;
    }
    const shadow = shadowRecipe(def, values, ink);
    shadows.push(shadow.css);
    variables[def.css] = shadow.css;
    variables[`${def.css}-x`] = px(shadow.geometry.x);
    variables[`${def.css}-y`] = px(shadow.geometry.y);
    variables[`${def.css}-blur`] = px(shadow.blur);
    variables[`${def.css}-spread`] = px(shadow.geometry.spread);
    variables[`${def.css}-color`] = shadow.color;
    variables[`${def.css}-opacity`] = fmt(shadow.geometry.opacity);
  }
  // Derived overlay output (RGBA scrim, blur, layers, motion and dropdown aliases) follows the raw
  // overlay roles so the active recipe, custom or default, drives the backdrop.
  Object.assign(variables, overlayVariablesFromValues(values));

  Object.assign(variables, {
    '--paper': paper,
    '--panel': panel,
    '--surface': surface,
    '--field-bg': field,
    '--field-filled-bg': field,
    '--field-hover-bg': field,
    // Root well role read by the provider's mode-independent field aliases.
    '--field-inner-shadow': inputInnerShadow,
    '--field-border': border,
    '--control-boundary': border,
    '--ink': ink,
    '--muted': muted,
    '--border': border,
    '--primary': seed,
    '--primary-hover': brand.primaryHover,
    '--primary-active': brand.primaryActive,
    '--primary-edge': brand.primaryEdge,
    '--on-primary': onPrimary,
    '--accent': accent.base,
    '--action-ink': accent.base,
    '--link': accent.base,
    '--link-hover': accent.hover,
    '--link-active': accent.active,
    '--soft': brand.soft,
    '--focus-indicator': accent.base,
    '--focus-color': accent.base,
    '--field-focus-underline': accent.base,
    '--selection-bg': p(1),
    '--selection-ink': ink,
    '--disabled-ink': disabledInk,
    '--disabled-bg': disabledBg,
    // One general corner role shared by field wells, slot actions and buttons.
    '--radius': radius.md,
    '--radius-none': '0px',
    '--radius-sm': radius.sm,
    '--radius-md': radius.md,
    '--radius-lg': radius.lg,
    '--radius-pill': `${FIXED_RADII.pill}px`,
    '--radius-circle': FIXED_RADII.circle,
    '--genux-size-sm': px(size.sm),
    '--genux-size-md': px(size.md),
    '--genux-size-lg': px(size.lg),
    // Density-scaled aliases; the raw named spacing and inset scales stay untouched.
    '--space-sm': px(gap(space.sm)),
    '--space-md': px(gap(space.md)),
    '--space-lg': px(gap(space.lg)),
    '--inset-sm': px(gap(containerInset.sm)),
    '--inset-md': px(gap(containerInset.md)),
    '--inset-lg': px(gap(containerInset.lg)),
    '--genux-gap-sm': px(gap(space.sm)),
    '--genux-gap-md': px(gap(space.md)),
    '--genux-gap-lg': px(gap(space.lg)),
    '--space-xs': px(fieldGapDense),
    '--space-xl': px(Math.max(sectionGap, gap(space.lg) + 4)),
    '--space-section': px(sectionGap),
    '--field-gap': px(fieldGap),
    '--field-gap-compact': px(fieldGapCompact),
    '--field-gap-dense': px(fieldGapDense),
    '--section-gap': px(sectionGap),
    '--genux-density-factor': fmt(density),
    '--genux-surface-shadow': surfaceShadow,
    '--genux-surface-border-width': surfaceBorderWidth,
    // Legacy consumer aliases follow the same editable shadow scale as the AntD tokens.
    '--shadow-contact': shadowCss(roles.shadow.sm),
    '--shadow-soft': shadowCss(roles.shadow.md),
    '--shadow-raised': shadowCss(roles.shadow.lg),
    '--font-family': fontFamily,
    '--font-size-body': px(fontSize),
    '--font-size-label': px(labelSize),
    '--font-size-helper': px(helperSize),
    '--font-size-table': px(tableSize),
    '--font-size-code': px(codeSize),
    '--text-section': px(sectionSize),
    '--text-title': px(titleSize),
    '--font-weight-body': fontWeight,
    '--field-border-width': px(borderWidth),
    '--field-border-style': borderStyle,
    '--genux-input-bg': field,
    '--genux-input-bg-hover': field,
    '--genux-input-ink': ink,
    '--genux-input-placeholder': muted,
    '--genux-input-border-color': border,
    '--genux-input-border-width': px(borderWidth),
    '--genux-input-border-style': borderStyle,
    '--genux-input-radius': radius.md,
    '--genux-input-height-sm': px(size.sm),
    '--genux-input-height-md': px(size.md),
    '--genux-input-height-lg': px(size.lg),
    '--genux-input-padding-inline': px(gap(controlInset.md)),
    '--genux-input-font-size': px(fontSize),
    '--genux-input-inner-shadow': inputInnerShadow,
    '--genux-input-focus': accent.base,
  });
  for (const [name, value] of Object.entries(brand))
    variables[`--docs-brand-${kebab(name)}`] = value;
  for (const [name, value] of Object.entries(brandTones))
    for (const [part, partValue] of Object.entries(value))
      variables[`--brand-tone-${name}-${part}`] = partValue;
  for (const [name, value] of Object.entries(status)) {
    variables[`--status-${name}`] = value.color;
    variables[`--status-${name}-text`] = value.text;
    variables[`--status-${name}-bg`] = value.bg;
    variables[`--status-${name}-border`] = value.border;
  }
  // Motion is locked to motion.json; definitions cannot override it.
  variables['--motion-easing'] = MOTION_EASING;
  variables['--motion-delay'] = `${motion.delayMs}ms`;
  for (const [name, ms] of Object.entries(motion.durationMs))
    variables[`--motion-duration-${name}`] = `${fmt(ms)}ms`;

  const token: NonNullable<ThemeConfig['token']> = {
    colorPrimary: seed,
    colorPrimaryHover: brand.primaryHover,
    colorPrimaryActive: brand.primaryActive,
    colorPrimaryBg: p(0),
    colorPrimaryBgHover: p(1),
    colorPrimaryBorder: p(2),
    colorPrimaryBorderHover: p(3),
    colorPrimaryText: accent.base,
    colorPrimaryTextHover: accent.hover,
    colorPrimaryTextActive: accent.active,
    colorLink: accent.base,
    colorLinkHover: accent.hover,
    colorLinkActive: accent.active,
    colorInfo: status.info.color,
    colorInfoText: status.info.text,
    colorInfoBg: status.info.bg,
    colorInfoBorder: status.info.border,
    colorSuccess: status.success.color,
    colorSuccessText: status.success.text,
    colorSuccessBg: status.success.bg,
    colorSuccessBorder: status.success.border,
    colorWarning: status.warning.color,
    colorWarningText: status.warning.text,
    colorWarningBg: status.warning.bg,
    colorWarningBorder: status.warning.border,
    colorError: status.error.color,
    colorErrorText: status.error.text,
    colorErrorBg: status.error.bg,
    colorErrorBorder: status.error.border,
    colorText: ink,
    colorTextSecondary: muted,
    colorTextTertiary: muted,
    colorTextDescription: muted,
    colorTextPlaceholder: muted,
    colorTextLightSolid: onPrimary,
    colorTextDisabled: disabledInk,
    colorBgContainerDisabled: disabledBg,
    colorBgContainer: field,
    colorBgElevated: panel,
    colorBgLayout: paper,
    colorBorder: border,
    colorBorderSecondary: divider,
    colorSplit: divider,
    borderRadiusSM: radiusNumber.sm,
    borderRadius: radiusNumber.md,
    borderRadiusLG: radiusNumber.lg,
    controlHeightSM: size.sm,
    controlHeight: size.md,
    controlHeightLG: size.lg,
    fontFamily,
    fontSize,
    fontSizeSM: helperSize,
    fontSizeLG: largeSize,
    fontSizeHeading1: titleSize,
    fontSizeHeading2: sectionSize,
    lineWidth: borderWidth,
    lineType: borderStyle,
    // Enclosing focus rings are forbidden; the CSS layer draws a bottom-only indicator.
    controlOutline: 'transparent',
    controlOutlineWidth: 0,
    lineWidthFocus: 0,
    wireframe: false,
    motionEaseInOut: MOTION_EASING,
    motionEaseOut: MOTION_EASING,
    motionEaseInOutCirc: MOTION_EASING,
    motionEaseOutCirc: MOTION_EASING,
    motionEaseOutBack: MOTION_EASING,
    motionEaseInBack: MOTION_EASING,
    motionEaseInQuint: MOTION_EASING,
    motionEaseOutQuint: MOTION_EASING,
    motionDurationFast: seconds(motionMs('fast')),
    motionDurationMid: seconds(motionMs('standard')),
    motionDurationSlow: seconds(motionMs('deliberate')),
    boxShadowTertiary: shadowCss(roles.shadow.sm),
    boxShadow: shadowCss(roles.shadow.md),
    boxShadowSecondary: shadowCss(roles.shadow.lg),
  };

  // Fields stay inset (darker) while raised surfaces keep the panel color.
  const components: NonNullable<ThemeConfig['components']> = {
    Card: { colorBgContainer: panel },
    Table: {
      colorBgContainer: panel,
      cellFontSize: tableSize,
      cellFontSizeMD: tableSize,
      cellFontSizeSM: tableSize,
    },
    Button: {
      defaultBg: panel,
      contentFontSizeSM: fontSize,
      contentFontSize: fontSize,
      contentFontSizeLG: fontSize,
    },
    Form: { labelFontSize: labelSize },
    Input: {
      colorBgContainer: field,
      activeBg: field,
      hoverBg: field,
      inputFontSize: fontSize,
      inputFontSizeSM: fontSize,
      inputFontSizeLG: fontSize,
    },
    InputNumber: {
      colorBgContainer: field,
      activeBg: field,
      hoverBg: field,
      inputFontSize: fontSize,
      inputFontSizeSM: fontSize,
      inputFontSizeLG: fontSize,
    },
    DatePicker: {
      colorBgContainer: field,
      activeBg: field,
      hoverBg: field,
      inputFontSize: fontSize,
      inputFontSizeSM: fontSize,
      inputFontSizeLG: fontSize,
    },
    Select: { selectorBg: field, optionFontSize: fontSize },
  };

  return Object.freeze({
    variables: Object.freeze(variables),
    token: Object.freeze(token),
    components: Object.freeze(components),
    brandTones,
    brand,
    palette,
    shadows: Object.freeze(shadows),
  });
}

const resolutionCache = new WeakMap<object, Partial<Record<ThemeMode, ThemeBuilderResolution>>>();
// A mutable recipe could change after resolution, so only fully frozen recipes are memoized.
const isFrozenRecipe = (recipe: unknown): boolean =>
  isPlainRecord(recipe) &&
  Object.isFrozen(recipe) &&
  isPlainRecord(recipe.light) &&
  Object.isFrozen(recipe.light) &&
  isPlainRecord(recipe.dark) &&
  Object.isFrozen(recipe.dark);

/** Pure and memoized per frozen recipe identity; uses no browser globals. */
export function resolveThemeBuilder(recipe: ThemeRecipe, mode: ThemeMode): ThemeBuilderResolution {
  if (!MODES.includes(mode)) throw new TypeError('Theme mode must be light or dark.');
  const cacheable = isFrozenRecipe(recipe);
  const cached = cacheable ? resolutionCache.get(recipe)?.[mode] : undefined;
  if (cached) return cached;
  const checked = validateRecipe(recipe);
  if (!checked.ok) throw new TypeError(checked.error);
  const resolved = resolveMode(checked.recipe, mode);
  if (cacheable) resolutionCache.set(recipe, { ...resolutionCache.get(recipe), [mode]: resolved });
  return resolved;
}
