import {
  AbstractChatProvider,
  type TransformMessage,
  type XRequestOptions,
} from '@ant-design/x-sdk';
import { RECORDED_SCENARIOS, type GenUIRequestInput } from './recorded';
import type { GenUITransport } from './transport';
import type { GenUIStreamChunk } from './sse';

export interface GenUIChatMessage {
  role: 'user' | 'assistant';
  label: string;
  frames: number;
}
/** Genuine native provider, with a canonical validated runtime behind each conversation. */
export class AtlasGenUIChatProvider extends AbstractChatProvider<
  GenUIChatMessage,
  GenUIRequestInput,
  GenUIStreamChunk
> {
  constructor(readonly transport: GenUITransport) {
    super({ request: transport.request });
  }
  transformParams(
    params: Partial<GenUIRequestInput>,
    options: XRequestOptions<GenUIRequestInput, GenUIStreamChunk>,
  ): GenUIRequestInput {
    const input = { ...options.params, ...params };
    if (
      !input.scenario ||
      !RECORDED_SCENARIOS.includes(input.scenario) ||
      typeof input.requestId !== 'string' ||
      typeof input.hasSurface !== 'boolean'
    )
      throw new Error('Recorded request parameters are invalid.');
    if (
      input.intent !== undefined &&
      (typeof input.intent !== 'string' || input.intent.length > 4096)
    )
      throw new Error('Recorded request intent is too long.');
    return {
      scenario: input.scenario,
      requestId: input.requestId,
      hasSurface: input.hasSurface,
      resetSurface: input.resetSurface === true,
      ...(input.intent !== undefined ? { intent: input.intent } : {}),
    };
  }
  transformLocalMessage(params: Partial<GenUIRequestInput>): GenUIChatMessage {
    return {
      role: 'user',
      label: params.intent?.trim() || 'Recorded local stream requested.',
      frames: 0,
    };
  }
  transformMessage({
    originMessage,
    chunk,
  }: TransformMessage<GenUIChatMessage, GenUIStreamChunk>): GenUIChatMessage {
    if (!chunk)
      return originMessage ?? { role: 'assistant', label: 'Recorded stream complete.', frames: 0 };
    this.transport.accept(chunk);
    return {
      role: 'assistant',
      label: 'Recorded command frames received.',
      frames: (originMessage?.frames ?? 0) + 1,
    };
  }
}
