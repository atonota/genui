import type { GenUISnapshot, JsonValue } from './contracts';
import { assertId } from './native-contract';

export interface HybridSelection {
  surfaceId: string;
  generation: number;
  componentId: string;
  recordIds: string[];
}
export interface HybridSelectionContext {
  scopeId: string;
  revision: number;
  selections: HybridSelection[];
}

/** Native record collection; compared by name so this helper does not depend on the registry. */
const RECORD_COLLECTION = 'AtlasRecordCollection';

const plainObject = (value: JsonValue | undefined): value is { [key: string]: JsonValue } =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown): value is string => {
  try {
    assertId(value);
    return true;
  } catch {
    return false;
  }
};

/** Keep only selected IDs that name an actual record, in record order, once each. */
function existingIds(recordIds: readonly unknown[], selected: readonly unknown[]): string[] {
  const chosen = new Set(selected.filter(isId));
  return [...new Set(recordIds.filter((id): id is string => isId(id) && chosen.has(id)))];
}

function nativeRecordSelection(native: Record<string, JsonValue> | undefined): string[] {
  if (!native || !Array.isArray(native.records) || !plainObject(native.value)) return [];
  const checked = native.value.checkedIds;
  if (!Array.isArray(checked)) return [];
  return existingIds(
    native.records.map(record => (plainObject(record) ? record.id : undefined)),
    checked,
  );
}

/**
 * Selected records from the published, validated snapshot only: reachable
 * collection blocks and their canonical controlled selection. Unreachable
 * nodes, DOM state and IDs without a matching record are never included.
 */
export function getSelectionContext(snapshot: GenUISnapshot): HybridSelectionContext | null {
  // A stream in progress can still replace the records it would describe.
  if (snapshot.status === 'receiving') return null;
  const selections: HybridSelection[] = [];
  for (const surface of snapshot.surfaces)
    for (const node of surface.components) {
      const block = Object.hasOwn(surface.blocks, node.id) ? surface.blocks[node.id] : undefined;
      if (!block) continue;
      let recordIds: string[] = [];
      if (node.component === 'AtlasCollection' && block.rows && block.selection)
        recordIds = existingIds(
          block.rows.map(row => row.id),
          block.selection,
        );
      else if ((node.component as string) === RECORD_COLLECTION)
        recordIds = nativeRecordSelection(block.native);
      if (recordIds.length)
        selections.push({
          surfaceId: surface.id,
          generation: surface.generation,
          componentId: node.id,
          recordIds,
        });
    }
  return selections.length
    ? { scopeId: snapshot.scopeId, revision: snapshot.revision, selections }
    : null;
}

/** A prepared context stays valid only while the snapshot still yields the same context. */
export function isSelectionContextCurrent(
  snapshot: GenUISnapshot,
  context: HybridSelectionContext,
): boolean {
  const current = getSelectionContext(snapshot);
  return !!current && JSON.stringify(current) === JSON.stringify(context);
}
