import type { JsonValue } from '../contracts';
import {
  nativeRecord,
  safeMediaSource,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const ratios = ['landscape', 'square', 'portrait'] as const;
const fits = ['cover', 'contain'] as const;
const textLimit = 240;

function oneOf(value: JsonValue | undefined, values: readonly string[], label: string): string {
  if (typeof value !== 'string' || !values.includes(value))
    throw new Error(`AtlasMediaFrame ${label} must be ${values.join(' | ')}.`);
  return value;
}

/** Read-only image: approved source, text alternative, optional caption, explicit ratio and fit. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(
    input,
    ['src', 'alt', 'caption', 'ratio', 'fit'],
    ['src', 'alt', 'ratio', 'fit'],
  );
  const src = safeMediaSource(data.src);
  if (!src) throw new Error('AtlasMediaFrame src is not an approved image source.');
  const { alt, caption } = data;
  // An empty alt marks a decorative image; whitespace-only text is neither.
  if (typeof alt !== 'string' || alt.length > textLimit || (alt !== '' && !alt.trim()))
    throw new Error('AtlasMediaFrame alt must be bounded text or empty for decorative images.');
  const media: NativePayload = {
    src,
    alt,
    ratio: oneOf(data.ratio, ratios, 'ratio'),
    fit: oneOf(data.fit, fits, 'fit'),
  };
  if (caption !== undefined) {
    if (typeof caption !== 'string' || !caption.trim() || caption.length > textLimit)
      throw new Error('AtlasMediaFrame caption must be non-empty bounded text.');
    media.caption = caption;
  }
  return media;
}

export const definition: NativeDefinition = {
  name: 'AtlasMediaFrame',
  readOnly: true,
  parse,
};

export const sample: NativePayload = {
  src: '/media/aster-workshop.jpg',
  alt: 'Workshop bench with labelled tool drawers',
  caption: 'Aster Workshop, east bay',
  ratio: 'landscape',
  fit: 'cover',
};
