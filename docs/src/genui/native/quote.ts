import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const limits = Object.freeze({ quote: 1000, attribution: 160, context: 240 });

function boundedText(value: JsonValue | undefined, key: keyof typeof limits): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limits[key])
    throw new Error(`AtlasQuote.${key}: expected non-empty bounded text.`);
  return value;
}

/** Read-only quotation; attribution is always visible and context discloses examples. */
export const definition: NativeDefinition = {
  name: 'AtlasQuote',
  readOnly: true,
  parse(input): NativePayload {
    const data = nativeRecord(input, ['quote', 'attribution', 'context'], ['quote', 'attribution']);
    const quote = boundedText(data.quote, 'quote');
    const attribution = boundedText(data.attribution, 'attribution');
    if (!Object.hasOwn(data, 'context')) return { quote, attribution };
    return { quote, attribution, context: boundedText(data.context, 'context') };
  },
};

export const sample: NativePayload = {
  quote: 'Calm defaults let teams decide faster than clever ones.',
  attribution: 'Atlas design review',
  context: 'Illustrative example, not an endorsement.',
};
