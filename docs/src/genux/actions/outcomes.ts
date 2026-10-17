import type { GenUXCardModel } from '../../data/card-model';
import type { GenUXAction, TaskBlockData } from '../contracts';
import type { ActionAuthorization, AuthorizedAction } from './authorization';

/**
 * Optional host outcome boundary. The host `claim` owns durable idempotency and
 * reservation and must not execute; this client keeps only a bounded local view
 * and cannot certify that guarantee. A fulfilled `execute` is never a commit on
 * its own: only a receipt that matches the exact action, operation and reviewed
 * surface payload, and that the trusted `verifyReceipt` accepts, is labelled
 * succeeded. Nothing is retried automatically.
 */
export interface HostActionReceipt {
  scopeId: string;
  surfaceId: string;
  componentId: string;
  actionId: string;
  idempotencyKey: string;
  operationId: string;
  binding: string;
  state: 'committed' | 'rejected';
}
export interface ActionOutcome {
  key: string;
  status: 'pending' | 'unknown' | 'succeeded' | 'failed';
  operationId: string | null;
  message: string;
  receipt?: HostActionReceipt;
}
type ActionModel = GenUXCardModel | TaskBlockData;
export interface ActionOutcomeController {
  submit(action: GenUXAction, model: ActionModel, signal?: AbortSignal): Promise<ActionOutcome>;
  getSnapshot(): readonly ActionOutcome[];
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const OUTCOME_LIMIT = 256;
const LISTENER_LIMIT = 64;
const KEY_LIMIT = 160;
const RECEIPT_KEYS = [
  'scopeId',
  'surfaceId',
  'componentId',
  'actionId',
  'idempotencyKey',
  'operationId',
  'binding',
  'state',
] as const;

/** Own enumerable data properties of a plain object, without invoking accessors. */
function plainData(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const data: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !descriptor.enumerable) return null;
    data[key] = descriptor.value;
  }
  return data;
}
const boundedId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= KEY_LIMIT;

/** The receipt must name this exact action, operation and reviewed surface payload. */
function matchingReceipt(
  value: unknown,
  context: AuthorizedAction,
  operationId: string,
): HostActionReceipt | null {
  const data = plainData(value);
  if (
    !data ||
    Object.keys(data).length !== RECEIPT_KEYS.length ||
    RECEIPT_KEYS.some(key => !Object.hasOwn(data, key))
  )
    return null;
  const expected: Omit<HostActionReceipt, 'state'> = {
    scopeId: context.scopeId,
    surfaceId: context.action.surfaceId,
    componentId: context.action.componentId,
    actionId: context.action.actionId,
    idempotencyKey: context.action.idempotencyKey,
    operationId,
    binding: context.surfaceJSON,
  };
  for (const [key, item] of Object.entries(expected)) if (data[key] !== item) return null;
  if (data.state !== 'committed' && data.state !== 'rejected') return null;
  return Object.freeze({ ...expected, state: data.state });
}

function claimResult(value: unknown): { operationId: string; receipt?: unknown } | null {
  const data = plainData(value);
  if (!data || !boundedId(data.operationId)) return null;
  if (Object.keys(data).some(key => key !== 'operationId' && key !== 'receipt')) return null;
  return data.receipt === undefined
    ? { operationId: data.operationId }
    : { operationId: data.operationId, receipt: data.receipt };
}

/** A recheck must authorize the same scope, revision and exact reviewed payload. */
const contextIdentity = (context: AuthorizedAction): string =>
  JSON.stringify([
    context.scopeId,
    context.audience,
    context.generation,
    context.revision,
    context.intent,
    context.modelJSON,
    context.surfaceJSON,
    context.reviewId,
    context.action.surfaceId,
    context.action.componentId,
    context.action.actionId,
    context.action.baseRevision,
    context.action.idempotencyKey,
  ]);
const actionIdentity = (action: GenUXAction): string =>
  JSON.stringify([action.surfaceId, action.componentId, action.actionId]);

export function createActionOutcomeController({
  authorization,
  claim,
  execute,
  verifyReceipt,
}: {
  authorization: ActionAuthorization;
  claim: (
    context: AuthorizedAction,
    signal: AbortSignal,
  ) => Promise<{ operationId: string; receipt?: unknown }>;
  execute: (
    context: AuthorizedAction,
    operationId: string,
    signal: AbortSignal,
  ) => Promise<unknown>;
  verifyReceipt: (
    receipt: unknown,
    context: AuthorizedAction,
    operationId: string,
  ) => boolean | Promise<boolean>;
}): ActionOutcomeController {
  const outcomes = new Map<string, ActionOutcome>();
  /** Per key: the exact context identity bound at capture and the scoped blocking tuple. */
  const owners = new Map<string, { identity: string; tuple: string }>();
  const listeners = new Set<() => void>();
  const operations = new Set<AbortController>();
  let snapshot: readonly ActionOutcome[] = Object.freeze([]);
  let disposed = false;

  const unresolved = (outcome: ActionOutcome | undefined) =>
    outcome?.status === 'pending' || outcome?.status === 'unknown';
  const refused = (key: string, message: string): ActionOutcome =>
    Object.freeze({ key, status: 'failed', operationId: null, message });
  const record = (
    key: string,
    status: ActionOutcome['status'],
    operationId: string | null,
    message: string,
    receipt?: HostActionReceipt,
  ): ActionOutcome => {
    const outcome: ActionOutcome = Object.freeze({
      key,
      status,
      operationId,
      message,
      ...(receipt ? { receipt } : {}),
    });
    outcomes.set(key, outcome);
    snapshot = Object.freeze([...outcomes.values()]);
    if (!disposed) for (const listener of [...listeners]) listener();
    return outcome;
  };
  /** Evict the oldest resolved outcome; pending and unknown entries keep blocking. */
  const reserveSlot = (): boolean => {
    if (outcomes.size < OUTCOME_LIMIT) return true;
    for (const [key, outcome] of outcomes)
      if (!unresolved(outcome)) {
        outcomes.delete(key);
        owners.delete(key);
        return true;
      }
    return false;
  };
  const trusted = async (
    receipt: HostActionReceipt,
    context: AuthorizedAction,
    operationId: string,
  ): Promise<boolean> => {
    try {
      return (await verifyReceipt({ ...receipt }, context, operationId)) === true;
    } catch {
      return false;
    }
  };
  const settle = async (
    key: string,
    value: unknown,
    context: AuthorizedAction,
    operationId: string,
    replayed: boolean,
  ): Promise<ActionOutcome> => {
    const receipt = matchingReceipt(value, context, operationId);
    if (!receipt || !(await trusted(receipt, context, operationId)))
      return record(
        key,
        'unknown',
        operationId,
        'The host result could not be verified. Check the host before acting again; nothing is retried automatically.',
      );
    if (receipt.state === 'rejected')
      return record(key, 'failed', operationId, 'The host rejected this action.', receipt);
    return record(
      key,
      'succeeded',
      operationId,
      replayed
        ? 'The host receipt for an earlier run was verified; the action was not run again.'
        : 'The host receipt was verified as committed.',
      receipt,
    );
  };
  const run = async (
    key: string,
    action: GenUXAction,
    model: ActionModel,
    context: AuthorizedAction,
    signal: AbortSignal,
  ): Promise<ActionOutcome> => {
    if (signal.aborted)
      return record(key, 'failed', null, 'Cancelled before the host claim; nothing was executed.');
    let claimed: ReturnType<typeof claimResult> = null;
    try {
      claimed = claimResult(await claim(context, signal));
    } catch {
      claimed = null;
    }
    if (!claimed)
      return record(key, 'failed', null, 'The host claim failed; the action was not executed.');
    const { operationId } = claimed;
    if (Object.hasOwn(claimed, 'receipt'))
      return settle(key, claimed.receipt, context, operationId, true);
    // Recheck against the current runtime: a changed revision or payload stops here.
    let fresh: AuthorizedAction | null = null;
    if (!signal.aborted && !disposed)
      try {
        const next = authorization.authorize(action, model);
        if (contextIdentity(next) === contextIdentity(context)) fresh = next;
      } catch {
        fresh = null;
      }
    if (!fresh)
      return record(
        key,
        'failed',
        operationId,
        'Claimed but not executed: the Card changed or the request was cancelled. The host keeps its reservation.',
      );
    let result: unknown;
    try {
      result = await execute(fresh, operationId, signal);
    } catch {
      return record(
        key,
        'unknown',
        operationId,
        'The host did not confirm the result. Check the host before acting again; nothing is retried automatically.',
      );
    }
    if (signal.aborted)
      return record(
        key,
        'unknown',
        operationId,
        'Cancelled after the host started; the result is unknown and is not retried.',
      );
    return settle(key, result, fresh, operationId, false);
  };

  return {
    async submit(action, model, signal) {
      const key = typeof action?.idempotencyKey === 'string' ? action.idempotencyKey : '';
      if (!boundedId(key)) return refused(key, 'The action needs a valid idempotency key.');
      if (disposed) return refused(key, 'Action outcomes are closed; nothing was sent.');
      // A cached key is reused only for the exact, freshly authorized context it was bound to.
      let context: AuthorizedAction;
      try {
        context = authorization.authorize(action, model);
      } catch {
        return refused(key, 'The action was not authorized; nothing was sent.');
      }
      const identity = contextIdentity(context);
      const existing = outcomes.get(key);
      if (existing)
        return owners.get(key)?.identity === identity
          ? existing
          : refused(
              key,
              'This idempotency key belongs to another action or Card state; nothing was sent.',
            );
      const tuple = JSON.stringify([context.scopeId, actionIdentity(action)]);
      for (const [other, owner] of owners)
        if (owner.tuple === tuple && unresolved(outcomes.get(other)))
          return refused(key, 'An earlier attempt of this action is unresolved; nothing was sent.');
      if (!reserveSlot()) return refused(key, 'Too many unresolved actions; nothing was sent.');
      owners.set(key, { identity, tuple });
      record(key, 'pending', null, 'Waiting for the host.');
      const operation = new AbortController();
      operations.add(operation);
      const linked = signal ? AbortSignal.any([signal, operation.signal]) : operation.signal;
      try {
        return await run(key, action, model, context, linked);
      } finally {
        operations.delete(operation);
      }
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => {};
      if (listeners.size >= LISTENER_LIMIT) throw new Error('Outcome listener limit exceeded.');
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      listeners.clear();
      for (const operation of operations) operation.abort();
      operations.clear();
    },
  };
}
