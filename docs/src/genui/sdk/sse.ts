import type { SSEOutput } from '@ant-design/x-sdk';

export interface GenUIStreamChunk extends SSEOutput {
  data: string;
  hostEpoch: number;
}
export interface StreamLimits {
  maxBytes: number;
  maxFrameBytes: number;
  maxFrames: number;
}
export const DEFAULT_STREAM_LIMITS: Readonly<StreamLimits> = Object.freeze({
  maxBytes: 262144,
  maxFrameBytes: 65536,
  maxFrames: 32,
});

export class GenUITransportError extends Error {
  constructor(
    message: string,
    readonly hostEpoch: number,
    name = 'GenUITransportError',
  ) {
    super(message);
    this.name = name;
  }
}

/** Fresh native XStream transformer per response: LF/CRLF, comments and multiline SSE. */
export function createSSETransform(
  hostEpoch: number,
  limits: StreamLimits = DEFAULT_STREAM_LIMITS,
  format: 'sse' | 'json' = 'sse',
): TransformStream<string, GenUIStreamChunk> {
  if (
    !Number.isSafeInteger(hostEpoch) ||
    hostEpoch < 1 ||
    Object.values(limits).some(value => !Number.isSafeInteger(value) || value < 1) ||
    limits.maxFrameBytes > limits.maxBytes
  )
    throw new Error('Stream limits and request epoch must be positive bounded integers.');
  let buffer = '';
  let bytes = 0;
  let frameBytes = 0;
  let frames = 0;
  let data: string[] = [];
  let event = '';
  let id = '';
  const encoder = new TextEncoder();
  const fail = (message: string): never => {
    throw new GenUITransportError(message, hostEpoch);
  };
  const emit = (controller: TransformStreamDefaultController<GenUIStreamChunk>) => {
    if (data.length) {
      if (++frames > limits.maxFrames) fail('Recorded stream exceeded its frame limit.');
      controller.enqueue({ data: data.join('\n'), event, id, hostEpoch });
    }
    data = [];
    event = '';
    frameBytes = 0;
  };
  const line = (value: string, controller: TransformStreamDefaultController<GenUIStreamChunk>) => {
    frameBytes += encoder.encode(value).byteLength;
    if (frameBytes > limits.maxFrameBytes) fail('Recorded stream exceeded its frame size limit.');
    if (!value) {
      emit(controller);
      return;
    }
    if (value.startsWith(':')) return;
    const colon = value.indexOf(':');
    const key = colon === -1 ? value : value.slice(0, colon);
    let content = colon === -1 ? '' : value.slice(colon + 1);
    if (content.startsWith(' ')) content = content.slice(1);
    if (key === 'data') data.push(content);
    else if (key === 'event') event = content;
    else if (key === 'id' && !content.includes('\0')) id = content;
  };
  const drain = (controller: TransformStreamDefaultController<GenUIStreamChunk>, final = false) => {
    while (buffer.length) {
      const match = /[\r\n]/.exec(buffer);
      if (!match) break;
      const position = match.index;
      if (!final && buffer[position] === '\r' && position === buffer.length - 1) break;
      const width = buffer[position] === '\r' && buffer[position + 1] === '\n' ? 2 : 1;
      line(buffer.slice(0, position), controller);
      buffer = buffer.slice(position + width);
    }
    if (encoder.encode(buffer).byteLength + frameBytes > limits.maxFrameBytes)
      fail('Recorded stream exceeded its frame size limit.');
    if (final) {
      if (buffer) line(buffer, controller);
      buffer = '';
      emit(controller);
    }
  };
  return new TransformStream({
    transform(chunk, controller) {
      bytes += encoder.encode(chunk).byteLength;
      if (bytes > limits.maxBytes) fail('Recorded stream exceeded its byte limit.');
      buffer += chunk;
      if (format === 'sse') drain(controller);
      else if (bytes > limits.maxFrameBytes) fail('Recorded JSON exceeded its frame size limit.');
    },
    flush(controller) {
      if (format === 'json') {
        if (!buffer.trim()) fail('Recorded stream returned no data.');
        controller.enqueue({ data: buffer, hostEpoch });
      } else drain(controller, true);
    },
  });
}
