import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export const SWITCH_CARD_LAYOUTS = [
  'horizontal',
  'vertical',
  'boxes',
  'icon-cards',
  'image-cards',
] as const;
/** Code-owned GenUXIcon names; JSON never supplies SVG paths. */
export const SWITCH_CARD_ICONS = ['house', 'sun', 'moon', 'settings', 'lock-simple'] as const;
/** Code-owned decorative scenes served from public/selection; JSON never supplies URLs. */
export const SWITCH_CARD_MEDIA = ['forest', 'coast', 'city'] as const;

export type SwitchCardLayout = (typeof SWITCH_CARD_LAYOUTS)[number];
export type SwitchCardIcon = (typeof SWITCH_CARD_ICONS)[number];
export type SwitchCardMedia = (typeof SWITCH_CARD_MEDIA)[number];
export type SwitchCardOption = {
  id: string;
  label: string;
  description?: string;
  icon?: SwitchCardIcon;
  media?: SwitchCardMedia;
  disabled?: boolean;
};
export type SwitchCardsPayload = {
  label: string;
  help?: string;
  layout?: SwitchCardLayout;
  options: SwitchCardOption[];
  value: string[];
};

const MAX_OPTIONS = 12;
const OPTION_KEYS = ['id', 'label', 'description', 'icon', 'media', 'disabled'] as const;

const oneOf = (list: readonly string[], value: JsonValue | undefined) =>
  typeof value === 'string' && list.includes(value);

function assertText(value: unknown, label: string, max: number): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${label} is invalid.`);
}

function parseOptions(input: JsonValue | undefined): SwitchCardOption[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_OPTIONS)
    throw new Error('Switch card options are invalid.');
  const ids = new Set<string>();
  return input.map(item => {
    const option = nativeRecord(item, OPTION_KEYS, ['id', 'label']);
    assertId(option.id, 'Switch card option ID');
    if (ids.has(option.id)) throw new Error(`Switch card option ${option.id} is duplicated.`);
    ids.add(option.id);
    assertText(option.label, 'Switch card label', 120);
    if (option.description !== undefined)
      assertText(option.description, 'Switch card description', 400);
    if (option.icon !== undefined && !oneOf(SWITCH_CARD_ICONS, option.icon))
      throw new Error('Switch card icon is not approved.');
    if (option.media !== undefined && !oneOf(SWITCH_CARD_MEDIA, option.media))
      throw new Error('Switch card media is not approved.');
    if (option.disabled !== undefined && typeof option.disabled !== 'boolean')
      throw new Error('Switch card disabled flag is invalid.');
    return option as unknown as SwitchCardOption;
  });
}

/** Selected IDs are unique, known options; each switch is an independent boolean. */
function parseValue(value: unknown, options: readonly SwitchCardOption[]): string[] {
  if (!Array.isArray(value) || value.length > options.length)
    throw new Error('Switch card value is invalid.');
  const known = new Set(options.map(option => option.id));
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== 'string' || !known.has(id) || seen.has(id))
      throw new Error('Switch card value is invalid.');
    seen.add(id);
  }
  return value as string[];
}

export function parseSwitchCards(input: unknown): SwitchCardsPayload {
  const data = nativeRecord(
    input,
    ['label', 'help', 'layout', 'options', 'value'],
    ['label', 'options', 'value'],
  );
  assertText(data.label, 'Switch card group label', 120);
  if (data.help !== undefined) assertText(data.help, 'Switch card help', 400);
  if (data.layout !== undefined && !oneOf(SWITCH_CARD_LAYOUTS, data.layout))
    throw new Error('Switch card layout is not approved.');
  parseValue(data.value, parseOptions(data.options));
  return data as unknown as SwitchCardsPayload;
}

export const definition: NativeDefinition = {
  name: 'GenUXSwitchCards',
  readOnly: false,
  parse: input => parseSwitchCards(input) as unknown as NativePayload,
  withValue(data, value) {
    const current = parseSwitchCards(data);
    const next = parseValue(value, current.options);
    for (const option of current.options)
      if (option.disabled && current.value.includes(option.id) !== next.includes(option.id))
        throw new Error(`Switch card ${option.id} is unavailable.`);
    return definition.parse({ ...data, value: [...next] });
  },
};

export const sample: NativePayload = {
  label: 'Notifications',
  help: 'Each channel turns on or off on its own.',
  layout: 'icon-cards',
  options: [
    {
      id: 'digest',
      label: 'Daily digest',
      description: 'A morning summary of workspace activity.',
      icon: 'sun',
    },
    {
      id: 'quiet',
      label: 'Quiet hours',
      description: 'Hold non-urgent alerts overnight.',
      icon: 'moon',
    },
    {
      id: 'account',
      label: 'Account changes',
      description: 'Role, billing and member updates.',
      icon: 'settings',
    },
    {
      id: 'security',
      label: 'Security alerts',
      description: 'Always on for this workspace; shown disabled for comparison.',
      icon: 'lock-simple',
      disabled: true,
    },
  ],
  value: ['digest', 'security'],
};
