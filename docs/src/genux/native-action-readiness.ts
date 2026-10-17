import { validateRecord } from '../data/field-kit';
import type { GenUXSurfaceModel, JsonValue } from './contracts';
import type { NativePayload } from './native-contract';
import { readConnectedWorkspace } from './native/connected-workspace';
import { parseNativeGrid } from './native/editable-grid';
import {
  nativeFieldDefinitions,
  type NativeRecord,
  type NativeRecordField,
} from './native/record-fields';
import { readRecordForm } from './native/record-form';
import { readRepeatingRecords } from './native/repeating-records';

// Code-owned readiness for create/review actions. Payload schemas keep drafts
// editable and incomplete; this applies the existing field-kit domain rules to the
// current published values without trusting serialized validators.
const textInputs: ReadonlySet<string> = new Set([
  'GenUXInput',
  'GenUXTextArea',
  'GenUXPasswordInput',
  'GenUXSearchInput',
]);

function invalidRecords(
  fields: readonly NativeRecordField[],
  records: readonly NativeRecord[],
  editable: boolean,
): boolean {
  const definitions = nativeFieldDefinitions(fields, editable);
  return records.some(record => Object.keys(validateRecord(record, definitions)).length > 0);
}

/** Bounded emptiness for other natives; arbitrary JSON values are not validated further. */
function emptyValue(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === 'object' && Object.keys(value).length === 0;
}

function nativeReady(component: string, native: NativePayload): boolean {
  if (textInputs.has(component)) {
    const value = native.value;
    return native.required !== true || (typeof value === 'string' && !!value.trim());
  }
  if (component === 'GenUXRecordForm') {
    const form = readRecordForm(native);
    return !invalidRecords(form.fields, [form.value], true);
  }
  if (component === 'GenUXConnectedWorkspace') {
    const { fields, value } = readConnectedWorkspace(native);
    const records = [...(value.records ?? []), ...(value.draft ? [value.draft] : [])];
    return !invalidRecords(fields, records, true);
  }
  if (component === 'GenUXEditableGrid') {
    const grid = parseNativeGrid(native);
    return !invalidRecords(grid.fields, Object.values(grid.drafts), !grid.readOnly);
  }
  if (component === 'GenUXRepeatingRecords') {
    const state = readRepeatingRecords(native);
    return !invalidRecords(state.fields, state.rows, !state.readOnly);
  }
  return native.required !== true || !emptyValue(native.value);
}

/**
 * The first native readiness failure on a whole published surface, or null. A
 * payload that no longer parses counts as not ready rather than as an error.
 */
export function nativeActionReadinessError(surface: GenUXSurfaceModel): string | null {
  for (const node of surface.components) {
    const native = Object.hasOwn(surface.blocks, node.id)
      ? surface.blocks[node.id]!.native
      : undefined;
    if (!native) continue;
    let ready = false;
    try {
      ready = nativeReady(node.component, native);
    } catch {
      ready = false;
    }
    if (!ready) return `Native component ${node.id} is not ready for this action.`;
  }
  return null;
}
