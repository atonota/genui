import { XRequest, type AbstractXRequestClass } from '@ant-design/x-sdk';
import type { GenUXRuntime } from '../contracts';
import {
  recordedGenUXFetch,
  type GenUXEnvelope,
  type GenUXRequestInput,
  type RecordedScenario,
} from './recorded';
import {
  createSSETransform,
  DEFAULT_STREAM_LIMITS,
  GenUXTransportError,
  type GenUXStreamChunk,
  type StreamLimits,
} from './sse';

export interface GenUXTransportSnapshot {
  status: 'idle' | 'receiving' | 'success' | 'error' | 'aborted';
  requestId: string | null;
  epoch: number;
  receivedFrames: number;
  acceptedFrames: number;
  error: string | null;
}
export interface TrustedGenUXTransport {
  endpoint: string;
  fetch: (url: string, options: RequestInit) => Promise<Response>;
}
export interface GenUXTransportOptions {
  scopeId: string;
  runtime: GenUXRuntime;
  transport?: TrustedGenUXTransport;
  timeoutMs?: number;
  limits?: StreamLimits;
}
export interface GenUXTransport {
  readonly request: AbstractXRequestClass<GenUXRequestInput, GenUXStreamChunk>;
  readonly getSnapshot: () => GenUXTransportSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly prepare: (scenario: RecordedScenario, intent?: string) => GenUXRequestInput;
  readonly accept: (chunk: GenUXStreamChunk) => GenUXEnvelope;
  readonly cancel: () => void;
  readonly dispose: () => void;
}

function combinedSignal(signals: AbortSignal[]): { signal: AbortSignal; release: () => void } {
  if (typeof AbortSignal.any === 'function')
    return { signal: AbortSignal.any(signals), release() {} };
  const combined = new AbortController();
  const subscriptions = new Map<AbortSignal, () => void>();
  const release = () => {
    for (const [signal, listener] of subscriptions) signal.removeEventListener('abort', listener);
    subscriptions.clear();
  };
  for (const signal of signals) {
    const abort = () => {
      combined.abort(signal.reason);
      release();
    };
    if (signal.aborted) {
      abort();
      break;
    }
    subscriptions.set(signal, abort);
    signal.addEventListener('abort', abort, { once: true });
  }
  return { signal: combined.signal, release };
}

/** Host-owned endpoint only. Model JSON never configures URL, headers or fetch. */
export function createGenUXTransport(options: GenUXTransportOptions): GenUXTransport {
  const configured = options.transport ?? {
    endpoint: '/__genux_recorded_stream__',
    fetch: recordedGenUXFetch,
  };
  const listeners = new Set<() => void>();
  let snapshot: GenUXTransportSnapshot = Object.freeze({
    status: 'idle',
    requestId: null,
    epoch: 0,
    receivedFrames: 0,
    acceptedFrames: 0,
    error: null,
  });
  let controller: AbortController | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let started = false;
  let disposed = false;
  const publish = (patch: Partial<GenUXTransportSnapshot>) => {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    for (const listener of listeners) listener();
  };
  const finish = (epoch: number, status: 'success' | 'error' | 'aborted', message?: string) => {
    if (epoch !== snapshot.epoch || snapshot.status !== 'receiving') return;
    const requestController = controller;
    clearTimeout(deadline);
    if (snapshot.requestId) options.runtime.finishRequest(snapshot.requestId, status, message);
    const runtimeResult = options.runtime.getSnapshot();
    const finalStatus =
      runtimeResult.requestId === snapshot.requestId && runtimeResult.status === 'error'
        ? 'error'
        : status;
    publish({
      status: finalStatus,
      error:
        finalStatus === 'error'
          ? (runtimeResult.error ?? message ?? 'Recorded request failed.')
          : null,
    });
    if (finalStatus !== 'success' && !requestController?.signal.aborted)
      requestController?.abort(
        new GenUXTransportError(
          message ?? 'Recorded request stopped.',
          epoch,
          finalStatus === 'aborted' ? 'AbortError' : 'GenUXTransportError',
        ),
      );
  };
  const request = XRequest<GenUXRequestInput, GenUXStreamChunk>(configured.endpoint, {
    manual: true,
    // Native automatic retry/timeouts are deliberately unset: host epoch owns them.
    fetch: async (url, init) => {
      const epoch = snapshot.epoch;
      const owner = controller;
      let releaseSignals = () => {};
      started = true;
      try {
        if (!owner || disposed)
          throw new GenUXTransportError('Recorded request cancelled.', epoch, 'AbortError');
        const linked = combinedSignal([owner.signal, ...(init.signal ? [init.signal] : [])]);
        const signal = linked.signal;
        releaseSignals = linked.release;
        const response = await configured.fetch(String(url), { ...init, signal });
        if (signal.aborted) throw signal.reason;
        if (!response.ok)
          throw new GenUXTransportError('Recorded request failed. You can retry locally.', epoch);
        if (!response.body) throw new GenUXTransportError('Recorded response has no body.', epoch);
        const mime = response.headers.get('content-type')?.split(';')[0].trim();
        if (!['text/event-stream', 'application/json'].includes(mime ?? ''))
          throw new GenUXTransportError('Recorded response format is unsupported.', epoch);
        const headers = new Headers(response.headers);
        headers.set('x-genux-host-epoch', String(epoch));
        const reader = response.body.getReader();
        let total = 0;
        let closed = false;
        const cleanup = () => {
          signal.removeEventListener('abort', abort);
          releaseSignals();
          reader.releaseLock();
        };
        const abort = () => {
          void reader.cancel(signal.reason).catch(() => {});
        };
        signal.addEventListener('abort', abort, { once: true });
        const body = new ReadableStream<Uint8Array>({
          async pull(output) {
            try {
              if (signal.aborted) throw signal.reason;
              const next = await reader.read();
              if (signal.aborted) throw signal.reason;
              if (next.done) {
                closed = true;
                cleanup();
                output.close();
                return;
              }
              total += next.value.byteLength;
              if (total > (options.limits ?? DEFAULT_STREAM_LIMITS).maxBytes)
                throw new GenUXTransportError('Recorded stream exceeded its byte limit.', epoch);
              output.enqueue(next.value);
            } catch (error) {
              if (!closed) {
                closed = true;
                void reader.cancel().catch(() => {});
                cleanup();
              }
              output.error(
                error instanceof GenUXTransportError
                  ? error
                  : new GenUXTransportError(
                      'Recorded request failed.',
                      epoch,
                      signal.aborted ? 'AbortError' : 'GenUXTransportError',
                    ),
              );
            }
          },
          async cancel(reason) {
            if (!closed) {
              closed = true;
              await reader.cancel(reason).catch(() => {});
              cleanup();
            }
          },
        });
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        releaseSignals();
        throw error instanceof GenUXTransportError
          ? error
          : new GenUXTransportError(
              'Recorded request failed.',
              epoch,
              owner?.signal.aborted ? 'AbortError' : 'GenUXTransportError',
            );
      }
    },
    transformStream: (_url, headers) =>
      createSSETransform(
        Number(headers.get('x-genux-host-epoch')),
        options.limits,
        headers.get('content-type')?.split(';')[0] === 'application/json' ? 'json' : 'sse',
      ),
    callbacks: {
      onSuccess(chunks, headers) {
        const epoch = Number(headers.get('x-genux-host-epoch'));
        if (!Number.isSafeInteger(epoch) || epoch < 1) return;
        if (chunks.length) finish(epoch, 'success');
        else finish(epoch, 'error', 'Recorded stream returned no data.');
      },
      onError(error) {
        if (error instanceof GenUXTransportError)
          finish(error.hostEpoch, error.name === 'AbortError' ? 'aborted' : 'error', error.message);
      },
    },
  });
  const cancel = () => {
    if (snapshot.status !== 'receiving') return;
    const epoch = snapshot.epoch;
    finish(epoch, 'aborted');
    controller?.abort(new GenUXTransportError('Recorded request cancelled.', epoch, 'AbortError'));
    if (started) request.abort();
  };
  return {
    request,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    prepare(scenario, intent) {
      if (disposed) throw new Error('Recorded session has been removed.');
      if (intent !== undefined && (typeof intent !== 'string' || intent.length > 4096))
        throw new Error('Recorded request intent is too long.');
      cancel();
      const epoch = snapshot.epoch + 1;
      const requestId = `request-${globalThis.crypto.randomUUID()}`;
      controller = new AbortController();
      started = false;
      options.runtime.beginRequest(requestId);
      publish({
        status: 'receiving',
        requestId,
        epoch,
        receivedFrames: 0,
        acceptedFrames: 0,
        error: null,
      });
      deadline = setTimeout(
        () => {
          finish(
            epoch,
            'error',
            'Recorded request timed out. Your last valid cards remain available.',
          );
          controller?.abort(
            new GenUXTransportError('Recorded request timed out.', epoch, 'TimeoutError'),
          );
          if (started) request.abort();
        },
        scenario === 'timeout'
          ? Math.min(options.timeoutMs ?? 5000, 800)
          : (options.timeoutMs ?? (scenario === 'task-workspace' ? 10000 : 5000)),
      );
      const surface = options.runtime.getSnapshot().surfaces.find(item => item.id === 'studio');
      const root = surface?.components?.find(item => item.id === 'root')?.component;
      const resetSurface =
        !!root &&
        (scenario === 'task-workspace' ? root !== 'GenUXTaskSurface' : root === 'GenUXTaskSurface');
      return {
        scenario,
        requestId,
        hasSurface: !!surface && !resetSurface,
        resetSurface,
        ...(intent !== undefined ? { intent } : {}),
      };
    },
    accept(chunk) {
      if (chunk.hostEpoch !== snapshot.epoch || snapshot.status !== 'receiving')
        throw new GenUXTransportError(
          'A previous recorded request was discarded.',
          chunk.hostEpoch,
          'AbortError',
        );
      let envelope: GenUXEnvelope;
      try {
        const parsed: unknown = JSON.parse(chunk.data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        const record = parsed as Record<string, unknown>;
        if (
          Object.keys(record).some(key => !['sequence', 'commands'].includes(key)) ||
          !Number.isSafeInteger(record.sequence) ||
          !Array.isArray(record.commands)
        )
          throw new Error();
        envelope = { sequence: record.sequence as number, commands: record.commands };
      } catch {
        throw new GenUXTransportError(
          'Recorded stream contained an invalid command envelope.',
          chunk.hostEpoch,
        );
      }
      publish({ receivedFrames: snapshot.receivedFrames + 1 });
      let result;
      try {
        result = options.runtime.applyBatch({ requestId: snapshot.requestId!, ...envelope });
      } catch (error) {
        throw new GenUXTransportError(
          error instanceof Error ? error.message : 'Recorded commands were rejected.',
          chunk.hostEpoch,
        );
      }
      if (!result.ok)
        throw new GenUXTransportError(
          result.error ?? 'Recorded commands were rejected.',
          chunk.hostEpoch,
        );
      publish({ acceptedFrames: snapshot.acceptedFrames + 1 });
      return envelope;
    },
    cancel,
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      clearTimeout(deadline);
      listeners.clear();
    },
  };
}
