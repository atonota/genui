import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export interface AutoCompleteSuggestion {
  id: string;
  label: string;
  disabled?: boolean;
}
export interface AutoCompletePayload {
  label: string;
  value: string;
  suggestions: readonly AutoCompleteSuggestion[];
  placeholder?: string;
  help?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

const limits = Object.freeze({ label: 200, value: 256, suggestions: 50 });

function text(value: unknown, path: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()))
    throw new Error(`${path}: expected ${allowEmpty ? '' : 'non-empty '}text up to ${max}.`);
  return value;
}
function flag(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'boolean')
    throw new Error(`${path}: expected boolean.`);
}

/** Caller-owned suggestions only; the value is free text and never triggers a query. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(
    input,
    ['label', 'value', 'suggestions', 'placeholder', 'help', 'disabled', 'readOnly'],
    ['label', 'value', 'suggestions'],
  );
  text(data.label, 'AutoComplete.label', limits.label);
  text(data.value, 'AutoComplete.value', limits.value, true);
  if (data.placeholder !== undefined)
    text(data.placeholder, 'AutoComplete.placeholder', limits.label);
  if (data.help !== undefined) text(data.help, 'AutoComplete.help', limits.label);
  flag(data.disabled, 'AutoComplete.disabled');
  flag(data.readOnly, 'AutoComplete.readOnly');
  const suggestions = data.suggestions;
  if (!Array.isArray(suggestions) || !suggestions.length || suggestions.length > limits.suggestions)
    throw new Error(`AutoComplete.suggestions: expected 1 to ${limits.suggestions} entries.`);
  const ids = new Set<string>();
  const labels = new Set<string>();
  suggestions.forEach((entry, index) => {
    const path = `AutoComplete.suggestions[${index}]`;
    const item = nativeRecord(entry, ['id', 'label', 'disabled'], ['id', 'label']);
    assertId(item.id, `${path}.id`);
    const label = text(item.label, `${path}.label`, limits.label);
    flag(item.disabled, `${path}.disabled`);
    // Selection resolves by label, so both identities must be unique.
    if (ids.has(item.id) || labels.has(label)) throw new Error('Duplicate suggestion identity.');
    ids.add(item.id);
    labels.add(label);
  });
  return data;
}

export const definition: NativeDefinition = {
  name: 'GenUXAutoComplete',
  readOnly: false,
  parse,
  withValue(data: NativePayload, value: JsonValue): NativePayload {
    if (typeof value !== 'string') throw new Error('AutoComplete value must be text.');
    return parse({ ...data, value });
  },
};

export const sample: NativePayload = {
  label: 'Destination city',
  value: '',
  suggestions: [
    { id: 'ankara', label: 'Ankara' },
    { id: 'izmir', label: 'Izmir', disabled: true },
  ],
};
