import {
  GENUX_LIMITS,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

/** The existing GenUXFeedback statuses; the text and icon carry the tone, never color alone. */
export const alertStatuses = ['info', 'success', 'warning', 'error'] as const;
export type AlertStatus = (typeof alertStatuses)[number];

/** Read-only inline message: no dismiss, no action, no HTML, no href and no styling input. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, ['status', 'message', 'description'], ['message']);
  const { status, message, description } = data;
  if (typeof message !== 'string' || !message.trim() || message.length > GENUX_LIMITS.text)
    throw new Error('GenUXAlert.message: expected non-empty bounded text.');
  if (status !== undefined && !(alertStatuses as readonly unknown[]).includes(status))
    throw new Error(`GenUXAlert.status: expected ${alertStatuses.join(' | ')}.`);
  if (
    description !== undefined &&
    (typeof description !== 'string' || description.length > GENUX_LIMITS.text)
  )
    throw new Error('GenUXAlert.description: expected bounded text.');
  return data;
}

export const definition: NativeDefinition = { name: 'GenUXAlert', readOnly: true, parse };

export const sample: NativePayload = { message: 'Records are up to date.' };
