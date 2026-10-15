import type { JsonValue } from '../contracts';
import { nativeRecord, safeMediaSource, type NativeDefinition } from '../native-contract';

const keys = ['src', 'alt', 'caption', 'width', 'height'] as const;
const maxAlt = 1000;
const maxCaption = 200;
const maxExtent = 8192;

export type ScreenshotData = {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
};

function text(value: JsonValue | undefined, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`Screenshot ${label} must be non-empty text up to ${max} characters.`);
  return value;
}

function extent(value: JsonValue | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > maxExtent)
    throw new Error(`Screenshot ${label} must be a whole CSS pixel size from 1 to ${maxExtent}.`);
  return value;
}

/** A recorded screenshot: safe source, required text alternative and original CSS size. */
export function parseScreenshot(input: unknown): ScreenshotData {
  const data = nativeRecord(input, keys, keys);
  const src = safeMediaSource(data.src);
  if (!src) throw new Error('Screenshot source is not a safe media address.');
  return {
    src,
    alt: text(data.alt, 'alt', maxAlt),
    caption: text(data.caption, 'caption', maxCaption),
    width: extent(data.width, 'width'),
    height: extent(data.height, 'height'),
  };
}

export const definition = {
  name: 'AtlasScreenshot',
  readOnly: true,
  parse: parseScreenshot,
} satisfies NativeDefinition;

export const sample: ScreenshotData = {
  src: '/screenshots/genui-review-panel.png',
  alt: 'Review panel listing three pending supplier records with their totals.',
  caption: 'Supplier review panel',
  width: 1280,
  height: 800,
};
