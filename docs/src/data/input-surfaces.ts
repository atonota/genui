/**
 * Inset field wells from the approved input surface reference.
 * Light: soft warm well on a warm white panel. Dark: deep grey well on a grey panel.
 * Colors are read from the central Theme Builder definitions (theme-builder/definitions.json):
 * surface = panel, fieldBg = field, text/label = text, hint/placeholder = muted,
 * border = border, disabledBg = disabled-bg, disabledText = disabled-text.
 * Every shadow keeps a dark blurred edge from above and a light highlight below with
 * neutral shadow RGB. insetBorder is the quiet decorative well edge (neutral, low alpha);
 * it is not the functional border token and makes no 3:1 contrast claim.
 * inputSurfaceVariables maps the roles onto the active theme aliases.
 * inputSurfaceAliasVariables is the mode-independent owner form backed by the theme.ts root roles.
 */
import definitionsSource from '../theme-builder/definitions.json';

type InputSurfaceMode = 'light' | 'dark';
type InputSizeKey = 'sm' | 'md' | 'lg';

export type InputSurface = Readonly<{
  surface: string;
  fieldBg: string;
  text: string;
  label: string;
  hint: string;
  placeholder: string;
  border: string;
  insetBorder: string;
  innerShadow: string;
  innerHover: string;
  disabledBg: string;
  disabledText: string;
  disabledShadow: string;
}>;

const HEX6 = /^#[0-9a-f]{6}$/i;

function definitionList(source: unknown): readonly unknown[] {
  if (Array.isArray(source)) return source;
  if (source !== null && typeof source === 'object') {
    const record = source as Record<string, unknown>;
    const list = record.tokens ?? record.definitions;
    if (Array.isArray(list)) return list;
  }
  throw new TypeError('Theme token definitions must be an array of definitions.');
}

const definitions = definitionList(definitionsSource);

/** One color default from the central definitions; unknown ids or non-color values throw. */
function colorRole(id: string, mode: InputSurfaceMode): string {
  const entry = definitions.find(
    candidate =>
      candidate !== null &&
      typeof candidate === 'object' &&
      (candidate as { id?: unknown }).id === id,
  ) as { kind?: unknown; defaults?: unknown } | undefined;
  if (!entry) throw new TypeError(`Theme token definition ${id} is missing.`);
  const defaults =
    entry.defaults !== null && typeof entry.defaults === 'object'
      ? (entry.defaults as Record<string, unknown>)
      : undefined;
  const value = defaults?.[mode];
  if (entry.kind !== 'color' || typeof value !== 'string' || !HEX6.test(value))
    throw new TypeError(`Theme token definition ${id} must provide a #RRGGBB ${mode} default.`);
  return value.toLowerCase();
}

/** Inset geometry and opacity from the approved reference with neutral RGB.
    insetBorder is the decorative resting well edge, not a 3:1 functional boundary. */
const inputShadows = {
  light: {
    insetBorder: 'rgba(26, 26, 26, 0.035)',
    innerShadow: 'inset 0 1px 2px rgba(26, 26, 26, 0.12), inset 0 -1px 0 rgba(255, 255, 255, 0.8)',
    innerHover:
      'inset 0 1.4px 2.7px rgba(26, 26, 26, 0.15), inset 0 -1px 0 rgba(255, 255, 255, 0.8)',
    disabledShadow: 'inset 0 1px 1px rgba(26, 26, 26, 0.04)',
  },
  dark: {
    insetBorder: 'rgba(255, 255, 255, 0.02)',
    innerShadow: 'inset 0 2px 3px rgba(0, 0, 0, 0.38), inset 0 -1px 0 rgba(255, 255, 255, 0.09)',
    innerHover: 'inset 0 3px 4px rgba(0, 0, 0, 0.43), inset 0 -1px 0 rgba(255, 255, 255, 0.13)',
    disabledShadow:
      'inset 0 1px 1px rgba(0, 0, 0, 0.12), inset 0 -1px 0 rgba(255, 255, 255, 0.025)',
  },
} as const;

function surfaceModel(mode: InputSurfaceMode): InputSurface {
  const text = colorRole('text', mode);
  const muted = colorRole('muted', mode);
  return Object.freeze({
    surface: colorRole('panel', mode),
    fieldBg: colorRole('field', mode),
    text,
    label: text,
    hint: muted,
    placeholder: muted,
    border: colorRole('border', mode),
    insetBorder: inputShadows[mode].insetBorder,
    innerShadow: inputShadows[mode].innerShadow,
    innerHover: inputShadows[mode].innerHover,
    disabledBg: colorRole('disabled-bg', mode),
    disabledText: colorRole('disabled-text', mode),
    disabledShadow: inputShadows[mode].disabledShadow,
  });
}

export const inputSurfaces: Readonly<Record<InputSurfaceMode, InputSurface>> = Object.freeze({
  light: surfaceModel('light'),
  dark: surfaceModel('dark'),
});

/** Inline padding per shared size; heights come from the GenUX size profiles. */
export const inputPaddingInline: Record<InputSizeKey, number> = { sm: 12, md: 14, lg: 16 };

type InputPrimitive =
  | 'border'
  | 'insetBorder'
  | 'innerShadow'
  | 'innerHover'
  | 'disabledBg'
  | 'disabledText'
  | 'disabledShadow';

/** Input-specific primitives a caller may override; semantic roles follow the theme. */
export type InputSurfaceOverrides = Partial<Record<InputPrimitive, string>>;

/** --genux-input-* variables for one mode; owners spread them on their paint root.
    Aliases resolve on that owner, so a local theme or color preview recolors fields. */
export function inputSurfaceVariables(
  mode: InputSurfaceMode,
  overrides: InputSurfaceOverrides = {},
): Record<`--genux-input-${string}`, string> {
  const model = inputSurfaces[mode];
  const roles = {
    ...model,
    fieldBg: `var(--field-bg, ${model.fieldBg})`,
    text: `var(--ink, ${model.text})`,
    hint: `var(--muted, ${model.hint})`,
    placeholder: `var(--muted, ${model.placeholder})`,
    border: `var(--field-border, ${model.border})`,
    insetBorder: `var(--field-inset-border, ${model.insetBorder})`,
    focus: 'var(--color-preview-primary, var(--focus-indicator-color))',
  };
  const entries = [...Object.entries(roles), ...Object.entries(overrides)].filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return Object.fromEntries(
    entries.map(([name, value]) => [
      `--genux-input-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`,
      value,
    ]),
  ) as Record<`--genux-input-${string}`, string>;
}

/** Mode-independent aliases of the root field roles. theme.ts emits those roles for both
    :root[data-theme] modes from this model, so an owner spreading these aliases never inlines a
    resolved light or dark palette: SSR, hydration and a theme switch repaint from the root. */
const inputRoleAliases: Readonly<Record<keyof InputSurface | 'focus', string>> = Object.freeze({
  surface: 'var(--panel)',
  fieldBg: 'var(--field-bg)',
  text: 'var(--ink)',
  label: 'var(--ink)',
  hint: 'var(--muted)',
  placeholder: 'var(--muted)',
  border: 'var(--field-border)',
  insetBorder: 'var(--field-inset-border)',
  innerShadow: 'var(--field-inner-shadow)',
  innerHover: 'var(--field-inner-hover)',
  disabledBg: 'var(--field-disabled-bg)',
  disabledText: 'var(--field-disabled-text)',
  disabledShadow: 'var(--field-disabled-shadow)',
  focus: 'var(--color-preview-primary, var(--focus-indicator-color))',
});

export function inputSurfaceAliasVariables(): Record<`--genux-input-${string}`, string> {
  return Object.fromEntries(
    Object.entries(inputRoleAliases).map(([name, value]) => [
      `--genux-input-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`,
      value,
    ]),
  ) as Record<`--genux-input-${string}`, string>;
}
