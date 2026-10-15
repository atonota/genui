import type { AtlasCardModel, CardAction } from '../../data/card-model';
import type { GenUIAction, GenUIRuntime, TaskBlockData } from '../contracts';
import { nativeActionReadinessError } from '../native-action-readiness';
import { assertId, UNSAFE_JSON_KEYS } from '../native-contract';

/** Host-owned review binding; only a trusted store supplies it after an explicit human approval. */
export interface TrustedReviewBinding {
  id: string;
  scopeId: string;
  surfaceId: string;
  componentId: string;
  actionId: string;
  generation: number;
  revision: number;
  modelJSON: string;
  surfaceJSON: string;
  approved: true;
}
export interface AuthorizedAction {
  action: GenUIAction;
  model: AtlasCardModel | TaskBlockData;
  scopeId: string;
  audience: 'panel' | 'frontpage';
  generation: number;
  revision: number;
  intent: CardAction['intent'];
  modelJSON: string;
  surfaceJSON: string;
  reviewId: string | null;
}
/** Client policy only: a passing check is not server authorization proof. */
export interface ActionAuthorization {
  authorize(action: GenUIAction, model: AtlasCardModel | TaskBlockData): AuthorizedAction;
}
type ContextPredicate = (context: Readonly<AuthorizedAction>) => boolean;

const writeIntents: ReadonlySet<string> = new Set(['create', 'move', 'connect']);
const publicIntents: ReadonlySet<string> = new Set(['inspect', 'open']);
const actionKeys = ['actionId', 'baseRevision', 'componentId', 'idempotencyKey', 'surfaceId'];
const bindingKeys = [
  'actionId',
  'approved',
  'componentId',
  'generation',
  'id',
  'modelJSON',
  'revision',
  'scopeId',
  'surfaceId',
  'surfaceJSON',
];
const idempotencyKey = /^[\x21-\x7E]{1,160}$/;
const JSON_LIMITS = Object.freeze({ depth: 64, nodes: 50000, length: 1 << 20 });

function deny(reason: string): never {
  throw new Error(`Action authorization denied: ${reason}`);
}
function own(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) deny('a property is missing or is an accessor.');
  return descriptor.value;
}
function plainObject(value: unknown, label: string): object {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    deny(`${label} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    deny(`${label} must be a plain object.`);
  return value;
}
function exactKeys(value: object, keys: readonly string[], label: string): void {
  if (Reflect.ownKeys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)))
    deny(`${label} properties are invalid.`);
}
function safeId(value: unknown, label: string): string {
  try {
    assertId(value, label);
  } catch {
    deny(`${label} is invalid.`);
  }
  return value as string;
}
function frozenCopy<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) {
      Object.freeze(item);
      for (const child of Object.values(item)) freeze(child);
    }
  };
  freeze(copy);
  return copy;
}
const isCardModel = (value: AtlasCardModel | TaskBlockData): value is AtlasCardModel =>
  Object.hasOwn(value, 'kind');

/**
 * Deterministic, bounded serialization of a validated snapshot value: plain JSON
 * only, object keys sorted. Review capture must use this same function so a
 * trusted binding compares exactly with authorization.
 */
export function actionBindingJSON(value: unknown): string {
  let nodes = 0;
  const write = (item: unknown, depth: number): string => {
    if (++nodes > JSON_LIMITS.nodes || depth > JSON_LIMITS.depth)
      deny('payload complexity limit exceeded.');
    if (item === null || typeof item === 'boolean' || typeof item === 'string')
      return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (Array.isArray(item)) {
      if (
        Object.getPrototypeOf(item) !== Array.prototype ||
        Reflect.ownKeys(item).length !== item.length + 1
      )
        deny('payload is not plain JSON.');
      return `[${Array.from({ length: item.length }, (_, index) =>
        write(own(item, String(index)), depth + 1),
      ).join(',')}]`;
    }
    const record = plainObject(item, 'Payload');
    const keys = Reflect.ownKeys(record);
    if (keys.some(key => typeof key !== 'string' || UNSAFE_JSON_KEYS.has(key)))
      deny('payload has an unsafe key.');
    return `{${(keys as string[])
      .sort()
      .map(key => `${JSON.stringify(key)}:${write(own(record, key), depth + 1)}`)
      .join(',')}}`;
  };
  const text = write(value, 0);
  if (text.length > JSON_LIMITS.length) deny('payload size limit exceeded.');
  return text;
}

function readAction(value: unknown): GenUIAction {
  const record = plainObject(value, 'Action');
  exactKeys(record, actionKeys, 'Action');
  const baseRevision = own(record, 'baseRevision');
  const key = own(record, 'idempotencyKey');
  if (typeof baseRevision !== 'number' || !Number.isSafeInteger(baseRevision) || baseRevision < 0)
    deny('base revision is invalid.');
  if (typeof key !== 'string' || !idempotencyKey.test(key)) deny('idempotency key is invalid.');
  return {
    surfaceId: safeId(own(record, 'surfaceId'), 'Surface ID'),
    componentId: safeId(own(record, 'componentId'), 'Component ID'),
    actionId: safeId(own(record, 'actionId'), 'Action ID'),
    baseRevision,
    idempotencyKey: key,
  };
}

/** Every bound value must equal the current context; model JSON never supplies approval. */
function readReview(value: unknown, context: Readonly<AuthorizedAction>): string {
  if (value === undefined) deny('this action requires an approved review.');
  const record = plainObject(value, 'Review');
  exactKeys(record, bindingKeys, 'Review');
  const expected: Omit<TrustedReviewBinding, 'id'> = {
    scopeId: context.scopeId,
    surfaceId: context.action.surfaceId,
    componentId: context.action.componentId,
    actionId: context.action.actionId,
    generation: context.generation,
    revision: context.revision,
    modelJSON: context.modelJSON,
    surfaceJSON: context.surfaceJSON,
    approved: true,
  };
  for (const [key, item] of Object.entries(expected))
    if (own(record, key) !== item) deny('the review binding does not match the current action.');
  return safeId(own(record, 'id'), 'Review ID');
}

function decide(
  check: ContextPredicate,
  context: Readonly<AuthorizedAction>,
  label: string,
): boolean {
  let result: unknown;
  try {
    result = check(context);
  } catch {
    deny(`${label} failed.`);
  }
  if (typeof result !== 'boolean') deny(`${label} returned a non-boolean.`);
  return result;
}

export function createActionAuthorization({
  runtime,
  authorize,
  requiresReview,
  getReview,
}: {
  runtime: GenUIRuntime;
  authorize?: ContextPredicate;
  requiresReview?: ContextPredicate;
  getReview?: (context: Readonly<AuthorizedAction>) => TrustedReviewBinding | undefined;
}): ActionAuthorization {
  if (!runtime || typeof runtime.getSnapshot !== 'function')
    throw new Error('Action authorization requires a GenUI runtime.');
  return Object.freeze({
    authorize(input: GenUIAction, model: AtlasCardModel | TaskBlockData): AuthorizedAction {
      const allow = authorize;
      if (typeof allow !== 'function') deny('no trusted host authorization is configured.');
      const action = readAction(input);
      // Scope, audience and state come only from the runtime, never from the caller.
      const snapshot = runtime.getSnapshot();
      if (snapshot.status !== 'success') deny('actions require a complete valid stream.');
      if (action.baseRevision !== snapshot.revision) deny('the action refers to a stale revision.');
      const surface = snapshot.surfaces.find(item => item.id === action.surfaceId);
      if (!surface || !surface.components.some(node => node.id === action.componentId))
        deny('the component is not on the current surface.');
      const resolved = Object.hasOwn(surface.models, action.componentId)
        ? surface.models[action.componentId]
        : Object.hasOwn(surface.blocks, action.componentId)
          ? surface.blocks[action.componentId]
          : undefined;
      if (!resolved) deny('the component has no validated model.');
      const modelJSON = actionBindingJSON(resolved);
      if (actionBindingJSON(model) !== modelJSON)
        deny('the model does not match the current validated model.');
      const card = isCardModel(resolved) ? resolved : undefined;
      const block = card ? undefined : (resolved as TaskBlockData);
      const registered = (
        card ? [card.primaryAction, ...(card.secondaryActions ?? [])] : [block!.action]
      ).find(item => item?.id === action.actionId);
      if (!registered) deny('the action is not registered for this component.');
      if (
        registered.disabled === true ||
        block?.native?.disabled === true ||
        block?.native?.readOnly === true ||
        card?.state === 'loading' ||
        card?.state === 'disabled' ||
        (card?.state === 'error' && registered.intent !== 'retry')
      )
        deny('the action is unavailable.');
      if (snapshot.audience !== 'panel' && !publicIntents.has(registered.intent))
        deny('public scope permits only inspect and open.');
      if (registered.intent === 'create' || registered.intent === 'review') {
        const fields = [...Object.values(surface.models), ...Object.values(surface.blocks)].flatMap(
          item => item.fields ?? [],
        );
        if (fields.some(field => field.error || (field.required && !field.value.trim())))
          deny('required fields are incomplete.');
        if (nativeActionReadinessError(surface) !== null)
          deny('required native fields are incomplete.');
      }
      const base: AuthorizedAction = {
        action,
        model: resolved,
        scopeId: snapshot.scopeId,
        audience: snapshot.audience,
        generation: surface.generation,
        revision: snapshot.revision,
        intent: registered.intent,
        modelJSON,
        surfaceJSON: actionBindingJSON(surface),
        reviewId: null,
      };
      let context = frozenCopy(base);
      // A host policy may add review to other intents; it can never waive a write review.
      const hostReview = requiresReview ? decide(requiresReview, context, 'Review policy') : false;
      const reviewRequired = writeIntents.has(context.intent) || hostReview;
      if (reviewRequired) {
        const lookup = getReview;
        if (typeof lookup !== 'function') deny('this action requires an approved review.');
        let review: unknown;
        try {
          review = lookup(context);
        } catch {
          deny('review lookup failed.');
        }
        context = frozenCopy({ ...base, reviewId: readReview(review, context) });
      }
      if (decide(allow, context, 'Host authorization') !== true)
        deny('the host did not authorize this action.');
      // Trusted callbacks must not observe one surface and approve another.
      if (runtime.getSnapshot() !== snapshot) deny('the surface changed during authorization.');
      return context;
    },
  });
}

export function createAuthorizedActionHandler({
  authorization,
  execute,
}: {
  authorization: ActionAuthorization;
  execute: (context: AuthorizedAction) => void;
}): (action: GenUIAction, model: AtlasCardModel | TaskBlockData) => void {
  if (typeof authorization?.authorize !== 'function' || typeof execute !== 'function')
    throw new Error('An action authorization and an execute callback are required.');
  // Denials and execute errors propagate to the runtime, which rejects the action
  // without replaying it. A returning execute is a local completion, not a commit.
  return (action, model) => {
    execute(authorization.authorize(action, model));
  };
}
