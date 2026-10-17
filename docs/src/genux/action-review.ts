import { actionBindingJSON, type TrustedReviewBinding } from './actions/authorization';
import type {
  GenUXAction,
  GenUXComponent,
  GenUXSnapshot,
  GenUXSurfaceModel,
  JsonValue,
} from './contracts';
import { readPointer } from './policy';

/**
 * A displayable difference. Code-owned sensitive values are never copied here,
 * only whether they changed; the exact value stays in the protected binding.
 */
export type ReviewChange =
  | { label: string; sensitive?: false; before: JsonValue; after: JsonValue }
  | { label: string; sensitive: true; changed: boolean };
/** Native components whose values a review must never display. */
const SENSITIVE_COMPONENTS: ReadonlySet<string> = new Set(['GenUXPasswordInput']);
/** A locally prepared, version-bound review. Preparing it is never an approval. */
export interface PreparedActionReview {
  binding: Omit<TrustedReviewBinding, 'approved'>;
  changes: ReviewChange[];
  selectedRecordIds: string[];
}

type Raw = Record<string, JsonValue>;
const plain = (value: unknown): Raw | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : undefined;
const json = (value: unknown): JsonValue =>
  value === undefined ? null : (structuredClone(value) as JsonValue);
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

/** The host value a component is bound to, before local drafts, selections or native edits. */
function hostSource(surface: GenUXSurfaceModel, node: GenUXComponent): Raw | undefined {
  const binding = node.model ?? node.payload;
  if (!binding) return undefined;
  return plain('path' in binding ? readPointer(surface.data, binding.path) : binding);
}

/**
 * Capture the registered action and the actual differences between the host
 * source and the published local state of its whole surface. The serialized
 * model and surface are the current validated snapshot values, so any later
 * revision, generation or data change no longer matches this binding.
 */
export function captureActionReview(
  snapshot: GenUXSnapshot,
  descriptor: Pick<GenUXAction, 'surfaceId' | 'componentId' | 'actionId' | 'baseRevision'>,
): PreparedActionReview | null {
  if (snapshot.status !== 'success' && snapshot.status !== 'idle') return null;
  if (descriptor.baseRevision !== snapshot.revision) return null;
  const surface = snapshot.surfaces.find(item => item.id === descriptor.surfaceId);
  if (!surface) return null;
  const { componentId, actionId } = descriptor;
  const model = Object.hasOwn(surface.models, componentId)
    ? surface.models[componentId]
    : undefined;
  const block = Object.hasOwn(surface.blocks, componentId)
    ? surface.blocks[componentId]
    : undefined;
  const target = model ?? block;
  const action = (
    model ? [model.primaryAction, ...(model.secondaryActions ?? [])] : [block?.action]
  ).find(item => item?.id === actionId);
  // Same availability rules as dispatchAction: an unavailable action has nothing to review.
  if (
    !target ||
    !action ||
    action.disabled ||
    block?.native?.disabled === true ||
    block?.native?.readOnly === true ||
    ['loading', 'disabled'].includes(model?.state ?? 'ready') ||
    (model?.state === 'error' && action.intent !== 'retry')
  )
    return null;

  const changes: ReviewChange[] = [];
  const selected = new Set<string>();
  for (const node of surface.components) {
    const source = hostSource(surface, node);
    const card = Object.hasOwn(surface.models, node.id) ? surface.models[node.id] : undefined;
    const task = Object.hasOwn(surface.blocks, node.id) ? surface.blocks[node.id] : undefined;
    const current = card ?? task;
    if (!source || !current) continue;
    const title = current.title ?? node.id;
    const compare = (label: string, before: unknown, after: unknown) => {
      if (!same(before, after)) changes.push({ label, before: json(before), after: json(after) });
    };
    const drafts = surface.draftFields[node.id];
    if (drafts) {
      const hostFields = new Map<string, JsonValue>();
      if (Array.isArray(source.fields))
        for (const entry of source.fields) {
          const field = plain(entry);
          if (field && typeof field.key === 'string')
            hostFields.set(field.key, field.value ?? null);
        }
      for (const field of current.fields ?? [])
        if (Object.hasOwn(drafts, field.key))
          compare(`${title} · ${field.label}`, hostFields.get(field.key) ?? null, field.value);
    }
    if (card?.selection)
      compare(title, plain(source.selection)?.selected ?? null, card.selection.selected);
    if (card?.task) compare(title, plain(source.task)?.lane ?? null, card.task.lane);
    if (task?.rows) {
      const ids = new Set(task.rows.map(row => row.id));
      const after = (task.selection ?? []).filter(id => ids.has(id));
      compare(title, Array.isArray(source.selection) ? source.selection : [], after);
      for (const id of after) selected.add(id);
    }
    if (task?.options) compare(title, source.value ?? null, task.value ?? null);
    if (task?.native) {
      const before = plain(source.native)?.value ?? null;
      const after = task.native.value ?? null;
      if (SENSITIVE_COMPONENTS.has(node.component))
        changes.push({ label: title, sensitive: true, changed: !same(before, after) });
      else compare(title, before, after);
      const records = task.native.records;
      const checked = plain(task.native.value)?.checkedIds;
      if (Array.isArray(records) && Array.isArray(checked)) {
        const ids = new Set(
          records.map(record => plain(record)?.id).filter(id => typeof id === 'string'),
        );
        for (const id of checked) if (typeof id === 'string' && ids.has(id)) selected.add(id);
      }
    }
  }

  // The same canonical serialization authorization compares against.
  let modelJSON: string;
  let surfaceJSON: string;
  try {
    modelJSON = actionBindingJSON(target);
    surfaceJSON = actionBindingJSON(surface);
  } catch {
    return null;
  }
  return freeze({
    binding: {
      id: `review-${globalThis.crypto.randomUUID()}`,
      scopeId: snapshot.scopeId,
      surfaceId: surface.id,
      componentId,
      actionId,
      generation: surface.generation,
      revision: snapshot.revision,
      modelJSON,
      surfaceJSON,
    },
    changes,
    selectedRecordIds: [...selected],
  });
}
