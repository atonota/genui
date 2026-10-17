import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  safeMediaSource,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export const CAROUSEL_LIMITS = Object.freeze({
  slides: 12,
  label: 120,
  title: 160,
  alt: 300,
  caption: 400,
});

export type CarouselSlide = {
  id: string;
  title: string;
  src: string;
  alt: string;
  caption?: string;
};
export type CarouselView = { label: string; slides: CarouselSlide[] };

function boundedText(value: JsonValue | undefined, path: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${path}: expected non-empty text up to ${max} characters.`);
  return value;
}

/** Validate the exact carousel payload; sources pass the shared same-origin/https gate. */
export function readCarousel(input: unknown): CarouselView {
  const data = nativeRecord(input, ['label', 'slides'], ['label', 'slides']);
  const label = boundedText(data.label, 'Carousel.label', CAROUSEL_LIMITS.label);
  const entries = data.slides;
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > CAROUSEL_LIMITS.slides)
    throw new Error(`Carousel.slides: expected 1 to ${CAROUSEL_LIMITS.slides} slides.`);
  const seen = new Set<string>();
  const slides = entries.map((entry, index) => {
    const path = `Carousel.slides[${index}]`;
    const record = nativeRecord(
      entry,
      ['id', 'title', 'src', 'alt', 'caption'],
      ['id', 'title', 'src', 'alt'],
    );
    assertId(record.id, `${path}.id`);
    if (seen.has(record.id)) throw new Error('Duplicate carousel slide identity.');
    seen.add(record.id);
    const slide: CarouselSlide = {
      id: record.id,
      title: boundedText(record.title, `${path}.title`, CAROUSEL_LIMITS.title),
      src: safeMediaSource(record.src),
      alt: boundedText(record.alt, `${path}.alt`, CAROUSEL_LIMITS.alt),
    };
    if (Object.hasOwn(record, 'caption'))
      slide.caption = boundedText(record.caption, `${path}.caption`, CAROUSEL_LIMITS.caption);
    return slide;
  });
  return { label, slides };
}

export const definition: NativeDefinition = {
  name: 'GenUXCarousel',
  // Slide viewing is ephemeral component state; the runtime value never changes.
  readOnly: true,
  parse(input) {
    const { label, slides } = readCarousel(input);
    return {
      label,
      slides: slides.map(({ caption, ...slide }) =>
        caption === undefined ? { ...slide } : { ...slide, caption },
      ),
    };
  },
};

export const sample: NativePayload = {
  label: 'Workshop gallery',
  slides: [
    {
      id: 'bench',
      title: 'Workbench',
      src: '/media/workshop-bench.jpg',
      alt: 'Wooden workbench with hand tools',
      caption: 'Main bench, east wall',
    },
    {
      id: 'kiln',
      title: 'Kiln room',
      src: 'https://images.genux.test/kiln.jpg',
      alt: 'Ceramic kiln with an open door',
    },
  ],
};
