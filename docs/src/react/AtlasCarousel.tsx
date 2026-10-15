import { useId, useState } from 'react';
import AtlasButton from './AtlasButton';
import AtlasMediaFrame from './AtlasMediaFrame';
import { useI18n } from './useI18n';

export type AtlasCarouselSlide = {
  id: string;
  title: string;
  src: string;
  alt: string;
  caption?: string;
};

export type AtlasCarouselProps = {
  slides: AtlasCarouselSlide[];
  label: string;
};

/** Manual carousel: only the active slide is in the DOM; no autoplay, swipe or timers. */
export default function AtlasCarousel({ slides, label }: AtlasCarouselProps) {
  const { t } = useI18n();
  const slideId = useId();
  const [requested, setRequested] = useState(0);
  const total = slides.length;
  if (total === 0) {
    return (
      <section className="atlas-carousel" aria-label={label} data-carousel-state="empty">
        <p className="atlas-carousel-empty">{t('No slides available')}</p>
      </section>
    );
  }
  // Callers may shorten the list; the shown slide stays inside the supplied range.
  const index = Math.min(requested, total - 1);
  const slide = slides[index]!;
  const position = t('Slide {current} of {total}', {
    current: String(index + 1),
    total: String(total),
  });
  const single = total < 2;
  // Boundaries wrap, so a pressed control never disables itself and drops focus.
  const show = (step: number) => setRequested((index + step + total) % total);
  return (
    <section
      className="atlas-carousel"
      aria-roledescription={t('carousel')}
      aria-label={label}
      data-carousel-state={single ? 'single' : 'multiple'}
    >
      <div
        id={slideId}
        className="atlas-carousel-slide"
        role="group"
        aria-roledescription={t('slide')}
        aria-label={position}
        data-slide-id={slide.id}
      >
        <p className="atlas-carousel-title">{slide.title}</p>
        <AtlasMediaFrame
          key={slide.id}
          src={slide.src}
          alt={slide.alt}
          caption={slide.caption}
          fit="cover"
          ratio="landscape"
        />
      </div>
      <p className="atlas-carousel-status" role="status">
        {position}
      </p>
      <div className="atlas-carousel-controls">
        <AtlasButton
          fill="tint"
          text={t('Previous slide')}
          aria-controls={slideId}
          disabled={single}
          onClick={() => show(-1)}
        />
        <AtlasButton
          fill="tint"
          text={t('Next slide')}
          aria-controls={slideId}
          disabled={single}
          onClick={() => show(1)}
        />
      </div>
    </section>
  );
}
