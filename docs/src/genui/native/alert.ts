import {
  GENUI_LIMITS,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

/** The existing AtlasFeedback statuses; the text and icon carry the tone, never color alone. */
export const alertStatuses = ['info', 'success', 'warning', 'error'] as const;
export type AlertStatus = (typeof alertStatuses)[number];

/** Read-only inline message: no dismiss, no action, no HTML, no href and no styling input. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, ['status', 'message', 'description'], ['message']);
  const { status, message, description } = data;
  if (typeof message !== 'string' || !message.trim() || message.length > GENUI_LIMITS.text)
    throw new Error('AtlasAlert.message: expected non-empty bounded text.');
  if (status !== undefined && !(alertStatuses as readonly unknown[]).includes(status))
    throw new Error(`AtlasAlert.status: expected ${alertStatuses.join(' | ')}.`);
  if (
    description !== undefined &&
    (typeof description !== 'string' || description.length > GENUI_LIMITS.text)
  )
    throw new Error('AtlasAlert.description: expected bounded text.');
  return data;
}

export const definition: NativeDefinition = { name: 'AtlasAlert', readOnly: true, parse };

export const sample: NativePayload = { message: 'Records are up to date.' };
