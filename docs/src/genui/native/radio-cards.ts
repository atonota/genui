import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  safeMediaSource,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

/** The existing AtlasSelectionVariants radio presentations; no new renderer. */
export const RADIO_CARD_LAYOUTS = [
  'horizontal',
  'vertical',
  'boxes',
  'icon-cards',
  'image-cards',
] as const;
export type RadioCardLayout = (typeof RADIO_CARD_LAYOUTS)[number];

/** JSON names map to trusted AtlasIcon glyphs; markup never comes from the payload. */
export const RADIO_CARD_ICONS = [
  'house',
  'sun',
  'moon',
  'settings',
  'lock-simple',
  'smiley',
  'smiley-sad',
] as const;
export type RadioCardIcon = (typeof RADIO_CARD_ICONS)[number];

export type RadioCardOption = {
  id: string;
  label: string;
  description?: string;
  icon?: RadioCardIcon;
  image?: string;
  disabled?: boolean;
};
export type RadioCardsPayload = {
  label: string;
  layout: RadioCardLayout;
  options: RadioCardOption[];
  value: string | null;
  disabled?: boolean;
};

const MAX_OPTIONS = 12;

function assertText(value: unknown, label: string, max: number): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${label} is invalid.`);
}

function assertFlag(value: unknown, label: string) {
  if (value !== undefined && typeof value !== 'boolean') throw new Error(`${label} is invalid.`);
}

function parseOption(input: unknown, layout: RadioCardLayout): NativePayload {
  const option = nativeRecord(
    input,
    ['id', 'label', 'description', 'icon', 'image', 'disabled'],
    ['id', 'label'],
  );
  assertId(option.id, 'Option ID');
  assertText(option.label, 'Option label', 120);
  if (option.description !== undefined) assertText(option.description, 'Option description', 240);
  if (
    option.icon !== undefined &&
    !(RADIO_CARD_ICONS as readonly JsonValue[]).includes(option.icon)
  )
    throw new Error('Option icon is not registered.');
  if (option.image !== undefined) option.image = safeMediaSource(option.image);
  assertFlag(option.disabled, 'Option disabled');
  if (layout === 'icon-cards' && option.icon === undefined)
    throw new Error('Icon cards require an icon for every option.');
  if (layout === 'image-cards' && option.image === undefined)
    throw new Error('Image cards require an image for every option.');
  return option;
}

function parseRadioCards(input: unknown): NativePayload {
  const data = nativeRecord(
    input,
    ['label', 'layout', 'options', 'value', 'disabled'],
    ['label', 'layout', 'options', 'value'],
  );
  assertText(data.label, 'Label', 160);
  if (!(RADIO_CARD_LAYOUTS as readonly JsonValue[]).includes(data.layout))
    throw new Error('Radio card layout is not approved.');
  const layout = data.layout as RadioCardLayout;
  if (!Array.isArray(data.options) || !data.options.length || data.options.length > MAX_OPTIONS)
    throw new Error(`Radio cards need 1 to ${MAX_OPTIONS} options.`);
  const options = data.options.map(option => parseOption(option, layout));
  const ids = new Set(options.map(option => option.id));
  if (ids.size !== options.length) throw new Error('Option IDs must be unique.');
  if (options.every(option => option.disabled === true))
    throw new Error('At least one option must be available.');
  assertFlag(data.disabled, 'Disabled');
  if (data.value !== null) {
    const member = options.find(option => option.id === data.value);
    if (!member || member.disabled === true)
      throw new Error('Value must be an available option ID.');
  }
  data.options = options;
  return data;
}

/** Typed view for the adapter; the payload is revalidated rather than trusted. */
export function readRadioCards(data: NativePayload): RadioCardsPayload {
  return parseRadioCards(data) as unknown as RadioCardsPayload;
}

export const definition: NativeDefinition = {
  name: 'AtlasRadioCards',
  readOnly: false,
  parse: parseRadioCards,
  /** Draft-only single member; the caller decides whether to accept it. */
  withValue(data, value) {
    const current = parseRadioCards(data);
    if (current.disabled === true) throw new Error('Radio cards are disabled.');
    if (typeof value !== 'string') throw new Error('Value must be an option ID.');
    return parseRadioCards({ ...current, value });
  },
};

export const sample: NativePayload = {
  label: 'Workspace plan',
  layout: 'icon-cards',
  value: 'starter',
  options: [
    {
      id: 'starter',
      label: 'Starter',
      description: 'One workspace for personal projects and early drafts.',
      icon: 'house',
    },
    {
      id: 'team',
      label: 'Team',
      description: 'Shared workspaces with roles and comments for up to 20 people.',
      icon: 'sun',
    },
    {
      id: 'enterprise',
      label: 'Enterprise',
      description: 'Single sign-on, audit history and dedicated support.',
      icon: 'settings',
    },
    {
      id: 'unavailable',
      label: 'Unavailable',
      description: 'Not offered for this account; shown disabled for comparison.',
      icon: 'lock-simple',
      disabled: true,
    },
  ],
};
