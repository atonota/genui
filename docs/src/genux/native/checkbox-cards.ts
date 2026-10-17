import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  safeMediaSource,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

/** Presentations mirror the existing selection variants; no new card renderer. */
export const checkboxCardVariants = [
  'horizontal',
  'vertical',
  'boxes',
  'icon-cards',
  'image-cards',
] as const;
/** Trusted icon names rendered by GenUXIcon; the model never supplies SVG. */
export const checkboxCardIcons = ['house', 'sun', 'settings', 'lock-simple'] as const;
/** Trusted decorative scenes served from the docs public selection folder. */
export const checkboxCardScenes = ['forest', 'coast', 'city'] as const;

export type CheckboxCardVariant = (typeof checkboxCardVariants)[number];
export type CheckboxCardIcon = (typeof checkboxCardIcons)[number];
export type CheckboxCardScene = (typeof checkboxCardScenes)[number];
export interface CheckboxCardOption {
  value: string;
  label: string;
  description?: string;
  icon?: CheckboxCardIcon;
  scene?: CheckboxCardScene;
  image?: string;
  disabled?: boolean;
}
export interface CheckboxCards {
  label: string;
  variant: CheckboxCardVariant;
  options: CheckboxCardOption[];
  value: string[];
  readOnly: boolean;
}

const MAX_OPTIONS = 12;
const outerKeys = ['label', 'variant', 'options', 'value', 'readOnly'] as const;
const optionKeys = ['value', 'label', 'description', 'icon', 'scene', 'image', 'disabled'] as const;

const text = (value: unknown, label: string, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${label} is invalid.`);
  return value;
};
const member = <T extends string>(list: readonly T[], value: unknown, label: string): T => {
  if (typeof value !== 'string' || !(list as readonly string[]).includes(value))
    throw new Error(`${label} is not approved.`);
  return value as T;
};
const flag = (value: unknown, label: string): boolean => {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
};

function parseOptions(input: unknown): CheckboxCardOption[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_OPTIONS)
    throw new Error(`Checkbox cards need 1 to ${MAX_OPTIONS} options.`);
  const seen = new Set<string>();
  return input.map(item => {
    const record = nativeRecord(item, optionKeys, ['value', 'label']);
    assertId(record.value, 'Option value');
    if (seen.has(record.value)) throw new Error('Option values must be unique.');
    seen.add(record.value);
    if (record.scene !== undefined && record.image !== undefined)
      throw new Error('An option uses either a scene or an image.');
    const option: CheckboxCardOption = {
      value: record.value,
      label: text(record.label, 'Option label', 120),
    };
    if (record.description !== undefined)
      option.description = text(record.description, 'Option description', 400);
    if (record.icon !== undefined)
      option.icon = member(checkboxCardIcons, record.icon, 'Option icon');
    if (record.scene !== undefined)
      option.scene = member(checkboxCardScenes, record.scene, 'Option scene');
    if (record.image !== undefined) option.image = safeMediaSource(record.image);
    if (record.disabled !== undefined) option.disabled = flag(record.disabled, 'Option disabled');
    return option;
  });
}

function parseMembers(input: unknown, options: readonly CheckboxCardOption[]): string[] {
  if (!Array.isArray(input) || input.length > options.length)
    throw new Error('Checkbox card value must be an array of option values.');
  const known = new Set(options.map(option => option.value));
  const members = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string' || !known.has(item))
      throw new Error('Checkbox card value contains an unknown option.');
    if (members.has(item)) throw new Error('Checkbox card value must be unique.');
    members.add(item);
  }
  return [...members];
}

/** Typed view of an accepted payload for the trusted adapter. */
export function readCheckboxCards(input: unknown): CheckboxCards {
  const record = nativeRecord(input, outerKeys, ['label', 'options', 'value']);
  const options = parseOptions(record.options);
  return {
    label: text(record.label, 'Checkbox cards label', 120),
    variant:
      record.variant === undefined
        ? 'vertical'
        : member(checkboxCardVariants, record.variant, 'Checkbox cards variant'),
    options,
    value: parseMembers(record.value, options),
    readOnly: flag(record.readOnly, 'readOnly'),
  };
}

export const sample: NativePayload = {
  label: 'Plan add-ons',
  variant: 'icon-cards',
  options: [
    {
      value: 'starter',
      label: 'Starter',
      description: 'One workspace for personal projects and early drafts.',
      icon: 'house',
    },
    {
      value: 'team',
      label: 'Team',
      description: 'Shared workspaces with roles and comments for up to 20 people.',
      icon: 'sun',
    },
    {
      value: 'enterprise',
      label: 'Enterprise',
      description: 'Single sign-on, audit history and dedicated support.',
      icon: 'settings',
    },
    {
      value: 'unavailable',
      label: 'Unavailable',
      description: 'Not offered for this account; shown disabled for comparison.',
      icon: 'lock-simple',
      disabled: true,
    },
  ],
  value: ['starter', 'enterprise'],
};

export const definition: NativeDefinition = {
  name: 'GenUXCheckboxCards',
  readOnly: false,
  parse(input) {
    readCheckboxCards(input);
    return nativeRecord(input, outerKeys, ['label', 'options', 'value']);
  },
  /** Local JSON draft only; disabled members keep their membership. */
  withValue(data: NativePayload, value: JsonValue): NativePayload {
    const cards = readCheckboxCards(data);
    if (cards.readOnly) throw new Error('Checkbox cards are read-only.');
    const next = parseMembers(value, cards.options);
    for (const option of cards.options)
      if (option.disabled && cards.value.includes(option.value) !== next.includes(option.value))
        throw new Error('Disabled options cannot change.');
    return { ...structuredClone(data), value: next };
  },
};
