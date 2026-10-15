import type { AtlasCardModel } from '../data/card-model';
import {
  ATLAS_CARD_CATALOG_ID,
  ATLAS_PUBLIC_CATALOG_ID,
  type GenUIAction,
  type GenUIBatch,
  type GenUIComponent,
  type GenUIEvent,
  type GenUIResult,
  type GenUIRuntime,
  type GenUISnapshot,
  type GenUISurface,
  type JsonValue,
  type TaskBlockData,
} from './contracts';
import type { NativePayload } from './native-contract';
import { nativeActionReadinessError } from './native-action-readiness';
import { nativeDefinition } from './native-registry';
import {
  assertId,
  assertPlainJSON,
  GENUI_LIMITS,
  pointerParts,
  readPointer,
  validateCardModel,
  validateComponent,
  validateTaskBlock,
  writePointer,
} from './policy';

interface WorkingSurface {
  id: string;
  generation: number;
  revision: number;
  components: GenUIComponent[];
  data: JsonValue;
  draftFields: Record<string, Record<string, string>>;
  local: Record<string, Partial<Pick<AtlasCardModel, 'selection' | 'task'>>>;
  blockValues: Record<string, string | readonly string[]>;
  selections: Record<string, readonly string[]>;
  /** Local native values, keyed to the component, binding path and serialized host source they were validated against. */
  nativeValues: Record<string, { source: string; value: JsonValue }>;
}
type SurfaceMap = Map<string, WorkingSurface>;
const cloneMap = (map: SurfaceMap): SurfaceMap =>
  new Map([...map].map(([id, value]) => [id, structuredClone(value)]));
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a command object.');
  return value as Record<string, unknown>;
};
function exact(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)))
    throw new Error('Command properties are invalid.');
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
function nativeSource(surface: WorkingSurface, node: GenUIComponent): NativePayload | undefined {
  if (!node.payload) return undefined;
  const value =
    'path' in node.payload ? readPointer(surface.data, node.payload.path) : node.payload;
  return value === undefined ? undefined : validateTaskBlock(node.component, value).native;
}
/** A local native value belongs to one component type, binding path and host source. */
const nativeFingerprint = (node: GenUIComponent, source: NativePayload | undefined): string =>
  JSON.stringify([
    node.component,
    node.payload && 'path' in node.payload ? node.payload.path : null,
    source ?? null,
  ]);

function resolve(
  surface: WorkingSurface,
  mode: 'recorded' | 'host',
  audience: 'panel' | 'frontpage',
): { surface: GenUISurface | null; pending: boolean } {
  if (!surface.components.length) return { surface: null, pending: true };
  const nodes = new Map(surface.components.map(node => [node.id, node]));
  const parents = new Map<string, number>();
  let missing = !nodes.has('root');
  const active = new Set<string>();
  const done = new Set<string>();
  const walk = (id: string, depth: number): void => {
    if (depth > GENUI_LIMITS.depth) throw new Error('Component depth limit exceeded.');
    if (active.has(id)) throw new Error('Component graph contains a cycle.');
    if (done.has(id)) return;
    const node = nodes.get(id);
    if (!node) {
      missing = true;
      return;
    }
    active.add(id);
    const children = node.child ? [node.child] : [...(node.children ?? [])];
    for (const child of children) {
      const count = (parents.get(child) ?? 0) + 1;
      parents.set(child, count);
      if (count > 1) throw new Error('A component may have only one parent.');
      walk(child, depth + 1);
    }
    active.delete(id);
    done.add(id);
  };
  for (const id of nodes.keys()) walk(id, 0);
  if (missing) return { surface: null, pending: true };
  const reachable = new Set<string>();
  const collect = (id: string): void => {
    reachable.add(id);
    const node = nodes.get(id)!;
    for (const child of node.child ? [node.child] : (node.children ?? [])) collect(child);
  };
  collect('root');
  const components = surface.components.filter(node => reachable.has(node.id));
  const models: Record<string, AtlasCardModel> = {};
  const blocks: Record<string, TaskBlockData> = {};
  const cardNames = new Set([
    'AtlasEntityCard',
    'AtlasMetricCard',
    'AtlasPurposeCard',
    'AtlasTaskSurface',
  ]);
  const checkNesting = (id: string, inside: boolean): void => {
    const node = nodes.get(id)!;
    // Code-owned native metadata: a native that renders peer Cards counts as a Card.
    const isCard =
      cardNames.has(node.component) || nativeDefinition(node.component)?.containsCards === true;
    if (inside && isCard) throw new Error('Card inside Card is prohibited.');
    for (const child of node.child ? [node.child] : (node.children ?? []))
      checkNesting(child, inside || isCard);
  };
  checkNesting('root', false);
  for (const node of components) {
    if (node.payload) {
      const value =
        'path' in node.payload ? readPointer(surface.data, node.payload.path) : node.payload;
      if (value === undefined) return { surface: null, pending: true };
      let block = validateTaskBlock(node.component, value);
      if (
        audience === 'frontpage' &&
        (node.component === 'AtlasForm' ||
          (block.action && !['inspect', 'open'].includes(block.action.intent)))
      )
        throw new Error('Public scope does not permit this operation.');
      const definition = nativeDefinition(node.component);
      if (definition) {
        if (audience === 'frontpage' && !definition.readOnly)
          throw new Error('Public scope does not permit interactive native components.');
        const override = Object.hasOwn(surface.nativeValues, node.id)
          ? surface.nativeValues[node.id]
          : undefined;
        if (override) {
          // A host change to this node's type, binding or source supersedes the local value.
          let native: NativePayload | null = null;
          if (
            definition.withValue &&
            !definition.readOnly &&
            override.source === nativeFingerprint(node, block.native)
          )
            try {
              native = definition.withValue(block.native!, override.value);
            } catch {
              native = null;
            }
          if (native) block = { ...block, native };
          else delete surface.nativeValues[node.id];
        }
      }
      const drafts = surface.draftFields[node.id];
      if (drafts && block.fields)
        block = {
          ...block,
          fields: block.fields.map(field =>
            Object.hasOwn(drafts, field.key) ? { ...field, value: drafts[field.key]! } : field,
          ),
        };
      if (Object.hasOwn(surface.blockValues, node.id))
        block = { ...block, value: surface.blockValues[node.id] };
      if (Object.hasOwn(surface.selections, node.id))
        block = { ...block, selection: surface.selections[node.id] };
      blocks[node.id] = validateTaskBlock(node.component, block);
      continue;
    }
    if (node.component === 'AtlasText') {
      const value =
        typeof node.text === 'object' ? readPointer(surface.data, node.text.path) : node.text;
      if (value === undefined) return { surface: null, pending: true };
      if (typeof value !== 'string') throw new Error('Text binding must resolve to text.');
      continue;
    }
    if (!node.model) continue;
    const value = 'path' in node.model ? readPointer(surface.data, node.model.path) : node.model;
    if (value === undefined) return { surface: null, pending: true };
    let model = validateCardModel(value);
    if (
      audience === 'frontpage' &&
      (model.fields ||
        model.task ||
        [model.primaryAction, ...(model.secondaryActions ?? [])].some(
          action => action && !['inspect', 'open'].includes(action.intent),
        ))
    )
      throw new Error('Public Card scope is read-only.');
    if (node.component === 'AtlasEntityCard' && model.kind !== 'entity')
      throw new Error('Entity renderer requires an entity model.');
    if (node.component === 'AtlasMetricCard' && model.kind !== 'metric')
      throw new Error('Metric renderer requires a metric model.');
    const drafts = surface.draftFields[node.id];
    if (drafts && model.fields)
      model = {
        ...model,
        fields: model.fields.map(field =>
          Object.hasOwn(drafts, field.key) ? { ...field, value: drafts[field.key]! } : field,
        ),
      };
    model = validateCardModel({ ...model, ...surface.local[node.id] });
    if (model.source) model = { ...model, source: { ...model.source, mode } };
    models[node.id] = model;
  }
  const draftFields = Object.fromEntries(
    Object.entries(surface.draftFields).filter(([id]) => reachable.has(id)),
  );
  surface.components = components;
  surface.draftFields = draftFields;
  surface.local = Object.fromEntries(
    Object.entries(surface.local).filter(([id]) => reachable.has(id)),
  );
  surface.nativeValues = Object.fromEntries(
    Object.entries(surface.nativeValues).filter(([id]) => reachable.has(id)),
  );
  return {
    pending: false,
    surface: {
      id: surface.id,
      generation: surface.generation,
      revision: surface.revision,
      components,
      data: structuredClone(surface.data),
      models,
      blocks,
      draftFields: structuredClone(draftFields),
    },
  };
}

export function createGenUIRuntime({
  scopeId,
  mode = 'recorded',
  audience = 'panel',
  onAction,
}: {
  scopeId: string;
  mode?: 'recorded' | 'host';
  audience?: 'panel' | 'frontpage';
  onAction?: (action: GenUIAction, model: AtlasCardModel | TaskBlockData) => void;
}): GenUIRuntime {
  assertId(scopeId, 'Scope ID');
  let working: SurfaceMap = new Map();
  let generations = new Map<string, number>();
  const accumulatedIds = new Map<string, Set<string>>();
  const listeners = new Set<() => void>();
  const history = new Map<number, SurfaceMap>();
  const actionKeys = new Set<string>();
  let eventId = 0;
  let pending = false;
  // A rejected stream frame stays unresolved until an accepted replacement frame or
  // a new request; it is tracked apart from general UI errors.
  let frameRejected = false;
  let snapshot: GenUISnapshot = freeze({
    scopeId,
    audience,
    sourceMode: mode,
    revision: 0,
    status: 'idle',
    requestId: null,
    sequence: 0,
    surfaces: [],
    events: [],
    error: null,
    actionResult: null,
    history: [],
  });
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const event = (
    kind: GenUIEvent['kind'],
    message: string,
    requestId = snapshot.requestId,
    sequence: number | null = snapshot.sequence,
  ): GenUIEvent => ({
    id: ++eventId,
    kind,
    message,
    requestId,
    sequence,
    revision: snapshot.revision,
  });
  const publish = (changes: Partial<GenUISnapshot>, entry?: GenUIEvent) => {
    snapshot = freeze({
      ...snapshot,
      ...changes,
      events: entry ? [...snapshot.events, entry].slice(-GENUI_LIMITS.events) : snapshot.events,
      history: [...history.keys()],
    });
    emit();
  };
  const reject = (message: string): GenUIResult => {
    publish({ error: message }, event('rejected', message));
    return { ok: false, error: message };
  };
  const remember = () => {
    if (pending) return;
    history.set(snapshot.revision, cloneMap(working));
    while (history.size > GENUI_LIMITS.history) history.delete(history.keys().next().value!);
  };
  const materialize = (
    map: SurfaceMap,
    old: readonly GenUISurface[],
  ): { surfaces: GenUISurface[]; pending: boolean } => {
    const surfaces: GenUISurface[] = [];
    let incomplete = false;
    for (const surface of map.values()) {
      const result = resolve(surface, mode, audience);
      incomplete ||= result.pending;
      if (result.surface) surfaces.push(result.surface);
      else {
        const previous = old.find(
          item => item.id === surface.id && item.generation === surface.generation,
        );
        if (previous) {
          const models = Object.fromEntries(
            Object.entries(previous.models).map(([id, model]) => [
              id,
              {
                ...model,
                ...surface.local[id],
                fields: model.fields?.map(field =>
                  Object.hasOwn(surface.draftFields[id] ?? {}, field.key)
                    ? { ...field, value: surface.draftFields[id]![field.key]! }
                    : field,
                ),
              },
            ]),
          );
          const blocks = Object.fromEntries(
            Object.entries(previous.blocks).map(([id, block]) => [
              id,
              {
                ...block,
                fields: block.fields?.map(field =>
                  Object.hasOwn(surface.draftFields[id] ?? {}, field.key)
                    ? { ...field, value: surface.draftFields[id]![field.key]! }
                    : field,
                ),
              },
            ]),
          );
          surfaces.push({
            ...previous,
            revision: surface.revision,
            models,
            blocks,
            draftFields: structuredClone(surface.draftFields),
          });
        } else
          surfaces.push({
            id: surface.id,
            generation: surface.generation,
            revision: surface.revision,
            components: [],
            data: {},
            models: {},
            blocks: {},
            draftFields: {},
          });
      }
    }
    return { surfaces, pending: incomplete };
  };
  const updateLocal = (
    surfaceId: string,
    componentId: string,
    update: (surface: WorkingSurface, model: AtlasCardModel) => void,
    message: string,
  ): GenUIResult => {
    const previous = snapshot.surfaces.find(item => item.id === surfaceId);
    const model =
      previous?.models[componentId] ??
      (previous?.blocks[componentId]
        ? {
            id: componentId,
            kind: 'form' as const,
            title: previous.blocks[componentId]!.title ?? 'Task field',
            fields: previous.blocks[componentId]!.fields,
          }
        : undefined);
    if (
      !model ||
      model.state === 'disabled' ||
      model.state === 'loading' ||
      model.state === 'error'
    )
      return reject('This Card is unavailable.');
    const candidate = cloneMap(working);
    const surface = candidate.get(surfaceId);
    if (!surface) return reject('Surface no longer exists.');
    let next: ReturnType<typeof materialize>;
    try {
      update(surface, model);
      surface.revision = snapshot.revision + 1;
      next = materialize(candidate, snapshot.surfaces);
    } catch (error) {
      return reject(error instanceof Error ? error.message : 'Local update rejected.');
    }
    working = candidate;
    pending = next.pending;
    snapshot = freeze({ ...snapshot, revision: snapshot.revision + 1 });
    remember();
    publish({ surfaces: next.surfaces, error: null }, event('draft', message));
    return { ok: true };
  };
  const runtime: GenUIRuntime = {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    beginRequest(requestId) {
      assertId(requestId, 'Request ID');
      if (pending) {
        working = new Map(
          snapshot.surfaces
            .filter(surface => surface.components.length)
            .map(surface => [
              surface.id,
              {
                id: surface.id,
                generation: surface.generation,
                revision: surface.revision,
                components: structuredClone([...surface.components]),
                data: structuredClone(surface.data),
                draftFields: structuredClone(surface.draftFields),
                local: Object.fromEntries(
                  Object.entries(surface.models).map(([id, model]) => [
                    id,
                    {
                      ...(model.selection ? { selection: model.selection } : {}),
                      ...(model.task ? { task: model.task } : {}),
                    },
                  ]),
                ),
                blockValues: Object.fromEntries(
                  Object.entries(surface.blocks)
                    .filter(([, block]) => block.value !== undefined)
                    .map(([id, block]) => [id, block.value!]),
                ),
                selections: Object.fromEntries(
                  Object.entries(surface.blocks)
                    .filter(([, block]) => block.selection)
                    .map(([id, block]) => [id, block.selection!]),
                ),
                nativeValues:
                  working.get(surface.id)?.generation === surface.generation
                    ? structuredClone(working.get(surface.id)!.nativeValues)
                    : {},
              },
            ]),
        );
        pending = false;
      }
      frameRejected = false;
      publish(
        {
          requestId,
          sequence: 0,
          status: 'receiving',
          surfaces: snapshot.surfaces.filter(surface => working.has(surface.id)),
          error: null,
          actionResult: null,
        },
        event('request', 'Stream started.', requestId, null),
      );
    },
    applyBatch(batch: GenUIBatch) {
      if (batch.requestId !== snapshot.requestId || snapshot.status !== 'receiving')
        return { ok: false, error: 'Stale or inactive request was ignored.' };
      if (!Number.isSafeInteger(batch.sequence) || batch.sequence !== snapshot.sequence + 1) {
        // A duplicate or out-of-order frame of the active request is also unresolved.
        frameRejected = true;
        return reject('Duplicate or out-of-order stream frame.');
      }
      let candidate: SurfaceMap;
      let next: ReturnType<typeof materialize>;
      const nextGenerations = new Map(generations);
      const nextIds = new Map([...accumulatedIds].map(([key, value]) => [key, new Set(value)]));
      try {
        assertPlainJSON(batch.commands);
        if (
          !Array.isArray(batch.commands) ||
          !batch.commands.length ||
          batch.commands.length > GENUI_LIMITS.commands
        )
          throw new Error('Command batch size is invalid.');
        candidate = cloneMap(working);
        for (const unknownCommand of batch.commands) {
          const command = record(unknownCommand);
          const keys = Object.keys(command).filter(key => key !== 'version');
          if (command.version !== 'v0.9' || keys.length !== 1 || Object.keys(command).length !== 2)
            throw new Error('Only one A2UI v0.9 command per object is accepted.');
          const name = keys[0]!;
          const payload = record(command[name]);
          assertId(payload.surfaceId, 'Surface ID');
          const surfaceId = payload.surfaceId;
          if (name === 'createSurface') {
            exact(payload, ['surfaceId', 'catalogId']);
            if (
              payload.catalogId !==
              (audience === 'panel' ? ATLAS_CARD_CATALOG_ID : ATLAS_PUBLIC_CATALOG_ID)
            )
              throw new Error('Only the local catalog for this host audience is accepted.');
            if (candidate.has(surfaceId)) throw new Error('Surface already exists.');
            if (candidate.size >= GENUI_LIMITS.surfaces) throw new Error('Surface limit exceeded.');
            const generation = (nextGenerations.get(surfaceId) ?? 0) + 1;
            nextGenerations.set(surfaceId, generation);
            nextIds.set(surfaceId, new Set());
            candidate.set(surfaceId, {
              id: surfaceId,
              generation,
              revision: snapshot.revision + 1,
              components: [],
              data: {},
              draftFields: {},
              local: {},
              blockValues: {},
              selections: {},
              nativeValues: {},
            });
          } else {
            const surface = candidate.get(surfaceId);
            if (!surface) throw new Error('Command refers to an unknown surface.');
            if (name === 'deleteSurface') {
              exact(payload, ['surfaceId']);
              candidate.delete(surfaceId);
              nextIds.delete(surfaceId);
            } else if (name === 'updateDataModel') {
              exact(payload, ['surfaceId', 'path', 'value']);
              pointerParts(payload.path);
              surface.data = writePointer(
                surface.data,
                payload.path as string,
                payload.value as JsonValue,
              );
              surface.revision = snapshot.revision + 1;
            } else if (name === 'updateComponents') {
              exact(payload, ['surfaceId', 'components']);
              if (
                !Array.isArray(payload.components) ||
                !payload.components.length ||
                payload.components.length > GENUI_LIMITS.nodes
              )
                throw new Error('Component count is invalid.');
              const seen = new Set<string>();
              const nodes = new Map(surface.components.map(node => [node.id, node]));
              for (const value of payload.components) {
                const component = validateComponent(value);
                if (seen.has(component.id))
                  throw new Error('Duplicate component ID in one update.');
                seen.add(component.id);
                const previous = nodes.get(component.id);
                if (previous && previous.component !== component.component)
                  throw new Error('Changing a component type requires an explicit lifecycle.');
                nodes.set(component.id, component);
                nextIds.get(surfaceId)!.add(component.id);
              }
              if (
                nodes.size > GENUI_LIMITS.nodes ||
                nextIds.get(surfaceId)!.size > GENUI_LIMITS.nodes
              )
                throw new Error('Surface component lifetime limit exceeded.');
              surface.components = [...nodes.values()];
              surface.revision = snapshot.revision + 1;
            } else throw new Error('Unknown A2UI command.');
          }
        }
        next = materialize(candidate, snapshot.surfaces);
      } catch (error) {
        // The frame's commands never reached the surface; a successful finish must wait
        // for an accepted replacement frame.
        frameRejected = true;
        return reject(error instanceof Error ? error.message : 'Command batch rejected.');
      }
      working = candidate;
      generations = nextGenerations;
      accumulatedIds.clear();
      for (const [id, ids] of nextIds) accumulatedIds.set(id, ids);
      pending = next.pending;
      frameRejected = false;
      snapshot = freeze({ ...snapshot, revision: snapshot.revision + 1, sequence: batch.sequence });
      remember();
      publish(
        { surfaces: next.surfaces, error: null },
        event(
          'accepted',
          pending
            ? 'Frame staged; waiting for complete Card data.'
            : 'Validated Card revision accepted.',
        ),
      );
      return { ok: true };
    },
    finishRequest(requestId, status, message) {
      if (requestId !== snapshot.requestId || snapshot.status !== 'receiving') return;
      const finalStatus = status === 'success' && (pending || frameRejected) ? 'error' : status;
      const error =
        finalStatus === 'error'
          ? (message ??
            (pending
              ? 'Stream ended with incomplete Card data.'
              : frameRejected
                ? 'Stream ended with an unresolved rejected frame.'
                : 'Stream failed.'))
          : snapshot.error;
      publish(
        { status: finalStatus, error },
        event(
          'terminal',
          message ??
            (finalStatus === 'success'
              ? 'Recorded stream complete.'
              : finalStatus === 'aborted'
                ? 'Recorded stream cancelled.'
                : error!),
        ),
      );
    },
    patchField(surfaceId, componentId, fieldKey, value) {
      return updateLocal(
        surfaceId,
        componentId,
        (surface, model) => {
          const field = model.fields?.find(item => item.key === fieldKey);
          if (
            !field ||
            field.readOnly ||
            typeof value !== 'string' ||
            value.length > GENUI_LIMITS.text
          )
            throw new Error('Field edit is unavailable.');
          surface.draftFields[componentId] = {
            ...surface.draftFields[componentId],
            [fieldKey]: value,
          };
        },
        'Local draft updated; no record was sent.',
      );
    },
    setSelection(surfaceId, componentId, selected) {
      if (snapshot.status === 'receiving') return reject('Wait for the stream before selecting.');
      return updateLocal(
        surfaceId,
        componentId,
        (surface, model) => {
          if (!model.selection || typeof selected !== 'boolean')
            throw new Error('Card is not selectable.');
          if (model.selection.mode === 'single' && selected)
            for (const [id, other] of Object.entries(
              snapshot.surfaces.find(item => item.id === surfaceId)!.models,
            )) {
              if (other.selection?.group === model.selection.group)
                surface.local[id] = {
                  ...surface.local[id],
                  selection: { ...other.selection, selected: false },
                };
            }
          surface.local[componentId] = {
            ...surface.local[componentId],
            selection: { ...model.selection, selected },
          };
        },
        'Local selection updated.',
      );
    },
    moveTask(surfaceId, componentId, lane) {
      if (snapshot.status === 'receiving')
        return reject('Wait for the stream before moving a task.');
      return updateLocal(
        surfaceId,
        componentId,
        (surface, model) => {
          if (!model.task || !['planned', 'active', 'done'].includes(lane))
            throw new Error('Task destination is unavailable.');
          surface.local[componentId] = {
            ...surface.local[componentId],
            task: { ...model.task, lane },
          };
        },
        'Task moved locally.',
      );
    },
    chooseValue(surfaceId, componentId, value) {
      return updateLocal(
        surfaceId,
        componentId,
        surface => {
          const block = snapshot.surfaces.find(item => item.id === surfaceId)?.blocks[componentId];
          if (!block || (!block.options && !block.rows))
            throw new Error('Task block is not selectable.');
          if (block.options) {
            const values = typeof value === 'string' ? [value] : value;
            if (
              values.some(id => !block.options!.some(option => option.id === id)) ||
              !!block.multiple !== Array.isArray(value)
            )
              throw new Error('Choice is unavailable.');
            surface.blockValues[componentId] = Array.isArray(value) ? [...value] : value;
          } else {
            if (!Array.isArray(value) || value.some(id => !block.rows!.some(row => row.id === id)))
              throw new Error('Record selection is invalid.');
            surface.selections[componentId] = [...value];
          }
        },
        'Local task selection updated.',
      );
    },
    changeNativeValue(surfaceId, componentId, value, generation, baseRevision) {
      if (audience !== 'panel') return reject('Public scope does not permit native edits.');
      if (pending || (snapshot.status !== 'success' && snapshot.status !== 'idle'))
        return reject('Native edits require a complete valid stream.');
      const published = snapshot.surfaces.find(item => item.id === surfaceId);
      const owner = working.get(surfaceId);
      if (
        !published ||
        !owner ||
        published.generation !== generation ||
        owner.generation !== generation
      )
        return reject('Native edit refers to a stale surface generation.');
      if (baseRevision !== snapshot.revision)
        return reject('Native edit refers to a stale Card revision.');
      const node = owner.components.find(item => item.id === componentId);
      const definition = node ? nativeDefinition(node.component) : undefined;
      const block = Object.hasOwn(published.blocks, componentId)
        ? published.blocks[componentId]
        : undefined;
      if (!node || !definition || !block?.native)
        return reject('Native component is not registered for this surface.');
      const withValue = definition.withValue;
      if (
        definition.readOnly ||
        !withValue ||
        block.native.disabled === true ||
        block.native.readOnly === true
      )
        return reject('This native control is read-only.');
      const publishedNative = block.native;
      return updateLocal(
        surfaceId,
        componentId,
        surface => {
          assertPlainJSON(value);
          const current = surface.components.find(item => item.id === componentId);
          const source = current ? nativeSource(surface, current) : undefined;
          if (!current || !source) throw new Error('Native source is unavailable.');
          // Validate the transition from the currently published value, so a disabled
          // option removed locally cannot be re-added; the fingerprint stays bound to
          // the host source, which resolve() re-applies on every revision.
          withValue(publishedNative, value);
          surface.nativeValues[componentId] = {
            source: nativeFingerprint(current, source),
            value: structuredClone(value),
          };
        },
        'Native value updated locally; no record was sent.',
      );
    },
    dispatchAction(action) {
      const model = snapshot.surfaces.find(item => item.id === action.surfaceId)?.models[
        action.componentId
      ];
      const block = snapshot.surfaces.find(item => item.id === action.surfaceId)?.blocks[
        action.componentId
      ];
      const registeredAction = [
        model?.primaryAction,
        ...(model?.secondaryActions ?? []),
        block?.action,
      ].find(item => item?.id === action.actionId);
      if ((!model && !block) || !registeredAction)
        return reject('Action is not registered for this Card.');
      if (snapshot.status !== 'success' && snapshot.status !== 'idle')
        return reject('Card actions require a complete valid stream.');
      if (action.baseRevision !== snapshot.revision)
        return reject('Action refers to a stale Card revision.');
      if (
        !action.idempotencyKey ||
        action.idempotencyKey.length > 160 ||
        actionKeys.has(action.idempotencyKey)
      )
        return reject('Duplicate action was ignored.');
      // A validated disabled/readOnly native control also blocks its outer action.
      if (
        registeredAction.disabled ||
        block?.native?.disabled === true ||
        block?.native?.readOnly === true ||
        ['loading', 'disabled'].includes(model?.state ?? 'ready') ||
        (model?.state === 'error' && registeredAction.intent !== 'retry')
      )
        return reject(registeredAction.reason ?? 'Action is unavailable.');
      if (['create', 'review'].includes(registeredAction.intent)) {
        const owner = snapshot.surfaces.find(item => item.id === action.surfaceId)!;
        const fields = [
          ...Object.values(owner.models).flatMap(item => item.fields ?? []),
          ...Object.values(owner.blocks).flatMap(item => item.fields ?? []),
        ];
        if (
          fields.some(field => field.error || (field.required && !field.value.trim())) ||
          nativeActionReadinessError(owner) !== null
        )
          return reject('Complete the required fields before continuing.');
      }
      actionKeys.add(action.idempotencyKey);
      if (actionKeys.size > 256) actionKeys.delete(actionKeys.values().next().value!);
      try {
        onAction?.(action, model ?? block!);
      } catch {
        return reject('Host action failed; it will not be replayed automatically.');
      }
      publish(
        {
          actionResult: `${registeredAction.label}: ${model?.title ?? block?.title ?? 'Task'}. Local result only.`,
          error: null,
        },
        event('action', 'Registered Card action handled locally.'),
      );
      return { ok: true };
    },
    restoreRevision(revision) {
      const saved = history.get(revision);
      if (!saved) return reject('Local revision is no longer available.');
      const candidate = cloneMap(saved);
      // Restoring is an explicit lifecycle boundary: native caches from a later
      // revision cannot outlive the restored graph or its resource accounting.
      accumulatedIds.clear();
      for (const [id, surface] of candidate) {
        const generation = Math.max(generations.get(id) ?? 0, surface.generation) + 1;
        generations.set(id, generation);
        surface.generation = generation;
        surface.revision = snapshot.revision + 1;
        accumulatedIds.set(id, new Set(surface.components.map(component => component.id)));
      }
      const next = materialize(candidate, []);
      working = candidate;
      pending = false;
      frameRejected = false;
      snapshot = freeze({ ...snapshot, revision: snapshot.revision + 1 });
      remember();
      publish(
        {
          requestId: null,
          sequence: 0,
          status: 'success',
          surfaces: next.surfaces,
          error: null,
          actionResult: null,
        },
        event('restore', `Local revision ${revision} restored.`, null, null),
      );
      return { ok: true };
    },
  };
  return runtime;
}
